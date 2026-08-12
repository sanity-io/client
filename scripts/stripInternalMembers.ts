// @env node
import type {PkgConfigOptions} from '@sanity/pkg-utils'
import {createScanner, LanguageVariant, type Scanner, SyntaxKind} from 'typescript/unstable/ast'

/**
 * Removes `@internal` members from the class declarations in the emitted `.d.ts` files.
 *
 * TypeScript's own `stripInternal` is all-or-nothing: it also drops the `@internal` types and
 * functions re-exported from `defineCreateClient` (`validateApiPerspective`, `BaseMutationOptions`,
 * `connectEventSource`, ...), and since it removes the declarations without touching references to
 * them, the declaration rollup fails with dangling re-exports. Restricting the pass to class bodies
 * keeps implementation details such as `SanityClient._httpRequest` out of the published types while
 * every exported `@internal` declaration keeps its typings.
 *
 * Interface and type-literal members are deliberately left alone: `@internal` on those (say
 * `ClientConfig.resolveFetch`) marks an unsupported option, not a private field, and removing it
 * would change what callers are allowed to pass.
 */
type PkgPlugin = NonNullable<PkgConfigOptions['plugins']>

interface Comment {
  start: number
  end: number
}

interface Removal {
  start: number
  end: number
}

interface PendingRemoval {
  start: number
  /** Container depth the member started at, so a `;` nested inside it doesn't end it early. */
  depth: number
}

interface StripResult {
  code: string
  removed: number
}

/**
 * `template` tracks the substitutions of a template literal type: its closing `}` is a template
 * token rather than a container close, and mistaking the two desynchronizes the rest of the file.
 */
type ContainerKind = 'class' | 'other' | 'template'

const DECLARATION_FILE_RE = /\.d\.[cm]?ts$/
const INTERNAL_TAG_RE = /(?:^|\s)@internal(?:\s|$)/

const TRIVIA_TOKENS = new Set([
  SyntaxKind.SingleLineCommentTrivia,
  SyntaxKind.MultiLineCommentTrivia,
  SyntaxKind.NewLineTrivia,
  SyntaxKind.WhitespaceTrivia,
  SyntaxKind.ConflictMarkerTrivia,
  SyntaxKind.NonTextFileMarkerTrivia,
])

const COMMENT_TOKENS = new Set([
  SyntaxKind.SingleLineCommentTrivia,
  SyntaxKind.MultiLineCommentTrivia,
])

const OPENING_TOKENS = new Set([
  SyntaxKind.OpenBraceToken,
  SyntaxKind.OpenParenToken,
  SyntaxKind.OpenBracketToken,
])

const CLOSING_TOKENS = new Set([
  SyntaxKind.CloseBraceToken,
  SyntaxKind.CloseParenToken,
  SyntaxKind.CloseBracketToken,
])

/**
 * Tokens a class body's `{` can follow: the class name, the end of a heritage clause (`>` is scanned
 * greedily, so nested type arguments arrive as `>>`), or an anonymous `class {`. An inline object
 * type in a heritage clause (`extends Foo<{a: 1}>`) follows `<` or `,` instead, which is how that
 * brace is told apart from the body that comes after it.
 */
const CLASS_BODY_PRECEDERS = new Set([
  SyntaxKind.Identifier,
  SyntaxKind.GreaterThanToken,
  SyntaxKind.GreaterThanGreaterThanToken,
  SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
  SyntaxKind.CloseParenToken,
  SyntaxKind.ClassKeyword,
])

function lineStartOf(code: string, pos: number): number {
  return code.lastIndexOf('\n', pos - 1) + 1
}

function startsLine(code: string, pos: number): boolean {
  return code.slice(lineStartOf(code, pos), pos).trim() === ''
}

/**
 * Where the removal starts for a member carrying the given leading comments, or `undefined` when
 * none of them tag it `@internal`.
 */
function findRemovalStart(code: string, comments: readonly Comment[]): number | undefined {
  const internalIndex = comments.findIndex((comment) =>
    INTERNAL_TAG_RE.test(code.slice(comment.start, comment.end)),
  )
  if (internalIndex === -1) return undefined

  // Comments on their own line above the tag document the member that is going away, so take those
  // too rather than leaving them stranded above whichever member follows.
  let firstIndex = internalIndex
  while (firstIndex > 0 && startsLine(code, comments[firstIndex - 1].start)) firstIndex--

  const start = comments[firstIndex].start
  return startsLine(code, start) ? lineStartOf(code, start) : start
}

/** Extends a removal past the trailing whitespace and line break left behind by the member. */
function findRemovalEnd(code: string, end: number): number {
  let next = end
  while (code[next] === ' ' || code[next] === '\t') next++
  if (code[next] === '\r') next++
  if (code[next] === '\n') next++
  return next
}

/**
 * Re-reads a `}` that closes a template literal substitution, which the scanner only knows to do
 * when asked. Returns the token it turned out to be: a tail ends the template, a middle opens the
 * next substitution.
 */
function rescanTemplateToken(scanner: Scanner): SyntaxKind {
  return scanner.reScanTemplateToken(false)
}

/** Removes every `@internal` class member from a declaration file's source text. */
export function stripInternalClassMembers(code: string): StripResult {
  const scanner = createScanner(false, LanguageVariant.Standard, code)
  const containers: ContainerKind[] = []
  const comments: Comment[] = []
  const removals: Removal[] = []
  let pending: PendingRemoval | undefined
  let previousToken = SyntaxKind.Unknown
  let pendingClass = false
  let token = scanner.scan()

  // Every token advances at least one character, so anything past this means the scanner stopped
  // making progress and the pass would spin. Fail the build rather than hang it.
  const maxSteps = code.length * 2 + 1000
  let steps = 0

  while (token !== SyntaxKind.EndOfFile) {
    if (steps++ > maxSteps) {
      throw new Error(
        `stripInternalClassMembers: scanner stopped advancing at offset ${scanner.getTokenStart()}`,
      )
    }

    if (TRIVIA_TOKENS.has(token)) {
      if (COMMENT_TOKENS.has(token)) {
        comments.push({start: scanner.getTokenStart(), end: scanner.getTokenEnd()})
      }
      token = scanner.scan()
      continue
    }

    if (!pending && containers[containers.length - 1] === 'class' && !CLOSING_TOKENS.has(token)) {
      const start = findRemovalStart(code, comments)
      if (start !== undefined) pending = {start, depth: containers.length}
    }

    comments.length = 0

    if (token === SyntaxKind.ClassKeyword) {
      pendingClass = true
    } else if (token === SyntaxKind.TemplateHead) {
      containers.push('template')
    } else if (OPENING_TOKENS.has(token)) {
      const opensClassBody =
        pendingClass &&
        token === SyntaxKind.OpenBraceToken &&
        CLASS_BODY_PRECEDERS.has(previousToken)
      containers.push(opensClassBody ? 'class' : 'other')
      if (opensClassBody) pendingClass = false
    } else if (
      token === SyntaxKind.CloseBraceToken &&
      containers[containers.length - 1] === 'template'
    ) {
      token = rescanTemplateToken(scanner)
      if (token === SyntaxKind.TemplateTail) containers.pop()
    } else if (CLOSING_TOKENS.has(token)) {
      containers.pop()
    } else if (token === SyntaxKind.SemicolonToken) {
      pendingClass = false
    }

    if (pending) {
      if (token === SyntaxKind.SemicolonToken && containers.length === pending.depth) {
        removals.push({start: pending.start, end: findRemovalEnd(code, scanner.getTokenEnd())})
        pending = undefined
      } else if (containers.length < pending.depth) {
        // The class body ended before the member was terminated by a `;`.
        removals.push({start: pending.start, end: findRemovalEnd(code, scanner.getTokenStart())})
        pending = undefined
      }
    }

    previousToken = token
    token = scanner.scan()
  }

  if (removals.length === 0) return {code, removed: 0}

  let stripped = ''
  let cursor = 0
  for (const removal of removals) {
    if (removal.start < cursor) continue
    stripped += code.slice(cursor, removal.start)
    cursor = removal.end
  }

  return {code: stripped + code.slice(cursor), removed: removals.length}
}

/** pkg-utils plugin that applies {@link stripInternalClassMembers} to every emitted `.d.ts`. */
export function stripInternalMembers(): PkgPlugin {
  return {
    name: 'strip-internal-members',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk' || !DECLARATION_FILE_RE.test(output.fileName)) continue
        const {code, removed} = stripInternalClassMembers(output.code)
        if (removed > 0) output.code = code
      }
    },
  }
}
