import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {resolve} from 'node:path'

import {describe, expect, test} from 'vitest'

import {stripInternalClassMembers} from '../scripts/stripInternalMembers'

// `__dirname` rather than `import.meta.url`: the happy-dom suite rewrites `import.meta.url` to an
// http URL, which `node:path` can't resolve.
const distDir = resolve(__dirname, '../dist')

/**
 * Guards the build-time pass that keeps `@internal` class members (the `_client`/`_httpRequest`
 * plumbing every client class carries) out of the published `.d.ts` files. See
 * `scripts/stripInternalMembers.ts` for why TypeScript's own `stripInternal` can't be used here.
 */
describe('stripInternalClassMembers', () => {
  test('removes tagged properties and methods from class bodies', () => {
    const {code, removed} = stripInternalClassMembers(
      [
        'declare class UsersClient {',
        '  /** @internal */',
        '  _client: SanityClient;',
        '  /** @internal */',
        '  _request(options: RequestOptions): void;',
        '  constructor(client: SanityClient);',
        '  getById(id: string): Promise<SanityUser>;',
        '}',
        '',
      ].join('\n'),
    )

    expect(removed).toBe(2)
    expect(code).toBe(
      [
        'declare class UsersClient {',
        '  constructor(client: SanityClient);',
        '  getById(id: string): Promise<SanityUser>;',
        '}',
        '',
      ].join('\n'),
    )
  })

  test('takes the explanatory comment block above the tag with it', () => {
    const {code, removed} = stripInternalClassMembers(
      [
        'declare class Patch {',
        '  /**',
        '   * Not `#private`: that brands the class nominally.',
        '   */',
        '  /** @internal */',
        '  _selection: PatchSelection;',
        '  commit(): void;',
        '}',
        '',
      ].join('\n'),
    )

    expect(removed).toBe(1)
    expect(code).toBe(['declare class Patch {', '  commit(): void;', '}', ''].join('\n'))
  })

  test('keeps semicolons inside an inline object type from ending the member early', () => {
    const {code, removed} = stripInternalClassMembers(
      [
        'declare class Transaction {',
        '  /** @internal */',
        '  _state: {id: string; mutations: Mutation[]};',
        '  commit(): void;',
        '}',
        '',
      ].join('\n'),
    )

    expect(removed).toBe(1)
    expect(code).toBe(['declare class Transaction {', '  commit(): void;', '}', ''].join('\n'))
  })

  test('finds the class body after a heritage clause with an inline object type', () => {
    const {code, removed} = stripInternalClassMembers(
      [
        'declare class LiveClient extends Base<{id: string}> {',
        '  /** @internal */',
        '  _sse: EventSourceInstance;',
        '  events(): Observable<LiveEvent>;',
        '}',
        '',
      ].join('\n'),
    )

    expect(removed).toBe(1)
    expect(code).toBe(
      [
        'declare class LiveClient extends Base<{id: string}> {',
        '  events(): Observable<LiveEvent>;',
        '}',
        '',
      ].join('\n'),
    )
  })

  test('leaves interface members, type literals and exported declarations alone', () => {
    const source = [
      '/** @internal */',
      'declare function validateApiPerspective(perspective: unknown): void;',
      'interface ClientConfig {',
      '  /** @internal */',
      '  resolveFetch?: () => FetchFunction;',
      '  projectId?: string;',
      '}',
      'type Internals = {',
      '  /** @internal */',
      '  httpRequest: HttpRequest;',
      '};',
      '',
    ].join('\n')

    const {code, removed} = stripInternalClassMembers(source)

    expect(removed).toBe(0)
    expect(code).toBe(source)
  })

  test('leaves untagged members and their doc comments untouched', () => {
    const source = [
      'declare class AssetsClient {',
      '  /**',
      '   * Uploads an asset.',
      '   *',
      '   * @param body - The asset contents',
      '   */',
      '  upload(body: Blob): Promise<SanityAssetDocument>;',
      '}',
      '',
    ].join('\n')

    const {code, removed} = stripInternalClassMembers(source)

    expect(removed).toBe(0)
    expect(code).toBe(source)
  })
})

/**
 * Catches the pass silently going missing - a pkg-utils upgrade that stops routing plugins at the
 * declaration output would otherwise publish the internals again without failing anything. Requires
 * a build; `npm test` on a clean checkout skips.
 */
describe.skipIf(!existsSync(resolve(distDir, 'index.d.ts')))('built declarations', () => {
  const declarationFiles = readdirSync(distDir).filter((file) => file.endsWith('.d.ts'))

  test('every emitted .d.ts is already stripped', () => {
    expect(declarationFiles.length).toBeGreaterThan(0)

    const remaining = declarationFiles.filter(
      (file) => stripInternalClassMembers(readFileSync(resolve(distDir, file), 'utf8')).removed > 0,
    )

    expect(remaining).toEqual([])
  })
})
