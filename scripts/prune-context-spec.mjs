/* eslint-disable no-console */
// Filters the vendored Context API spec down to the paths the client.context
// namespace exposes, so `generate:context` emits types for that surface only.
//
// src/context/openapi.json stays the full spec verbatim (it mirrors the
// Context API's published spec, so refreshing it is a plain copy); only the
// generated types shrink. This script writes the pruned intermediate that
// openapi-typescript consumes. It keeps the allowlisted paths, the explicitly
// kept component schemas, and everything they transitively $ref.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname} from 'node:path'

const KB = '/{apiVersion}/context/knowledge-bases/{knowledgeBaseId}'

// The paths the client.context namespace uses: the knowledge-base collection
// plus the KnowledgeBaseHandle's routes. Future namespaces (MCP endpoints,
// conversations, insights, ...) opt in by adding their paths here.
const PATH_ALLOWLIST = [
  '/{apiVersion}/context/knowledge-bases',
  KB,
  // Conversation ingest + classification: the API-owned writes. Reads go
  // through the GROQ surface (context.fetch/listen), so the REST reads are
  // deliberately not exposed here.
  '/{apiVersion}/context/organizations/{organizationId}/conversations/{threadId}',
  `${KB}/activity`,
  `${KB}/build`,
  `${KB}/build/cancel`,
  `${KB}/changes`,
  `${KB}/crawl-options`,
  `${KB}/entries`,
  `${KB}/entries/{entryPath}`,
  `${KB}/imports`,
  `${KB}/imports/crawl-preview`,
  `${KB}/imports/uploads`,
  `${KB}/imports/uploads/{importId}/complete`,
  `${KB}/imports/{importId}`,
  `${KB}/imports/{importId}/download`,
  `${KB}/instructions`,
  `${KB}/instructions/{instructionId}`,
  `${KB}/issues`,
  `${KB}/issues/apply`,
  `${KB}/issues/{issueId}`,
  `${KB}/issues/{issueId}/dismiss`,
  `${KB}/issues/{issueId}/reopen`,
  `${KB}/issues/{issueId}/resolve`,
  `${KB}/jobs/{jobId}`,
  `${KB}/outline`,
  `${KB}/refresh`,
  `${KB}/revisions`,
  `${KB}/revisions/{revisionId}/outline`,
  `${KB}/revisions/{revisionId}/report`,
  `${KB}/sources`,
  `${KB}/sources/{sourceId}`,
  `${KB}/sources/{sourceId}/content`,
]

// Component schemas the namespace re-exports directly (the document shapes
// stored in the organization's document store, for typing GROQ reads) even
// though no allowlisted path references them.
const COMPONENT_ALLOWLIST = ['EntryDoc', 'InstructionDoc', 'IssueDoc']

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/prune-context-spec.mjs <input> <output>')
  process.exit(1)
}

const spec = JSON.parse(readFileSync(inputPath, 'utf8'))

const missingPaths = PATH_ALLOWLIST.filter((p) => !spec.paths?.[p])
if (missingPaths.length > 0) {
  console.error(`Allowlisted paths missing from ${inputPath}:`)
  for (const p of missingPaths) console.error(`  ${p}`)
  process.exit(1)
}

/** Collect every `#/components/...` ref reachable from a node. */
function collectRefs(node, refs) {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs)
  } else if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') refs.add(node.$ref)
    for (const value of Object.values(node)) collectRefs(value, refs)
  }
  return refs
}

function resolveRef(ref) {
  const match = /^#\/components\/([^/]+)\/(.+)$/.exec(ref)
  if (!match) throw new Error(`Unsupported $ref format: ${ref} (only #/components/... is handled)`)
  const [, section, name] = match
  const target = spec.components?.[section]?.[name]
  if (target === undefined) throw new Error(`Dangling $ref: ${ref}`)
  return {section, name, target}
}

const prunedPaths = Object.fromEntries(PATH_ALLOWLIST.map((p) => [p, spec.paths[p]]))

const seedRefs = collectRefs(prunedPaths, new Set())
for (const name of COMPONENT_ALLOWLIST) {
  if (spec.components?.schemas?.[name] === undefined) {
    throw new Error(`Allowlisted component schema missing from ${inputPath}: ${name}`)
  }
  seedRefs.add(`#/components/schemas/${name}`)
}

// Transitive closure: a kept component may itself $ref further components.
const keptBySection = new Map()
const queue = [...seedRefs]
const seen = new Set()
while (queue.length > 0) {
  const ref = queue.shift()
  if (seen.has(ref)) continue
  seen.add(ref)
  const {section, name, target} = resolveRef(ref)
  if (!keptBySection.has(section)) keptBySection.set(section, new Map())
  keptBySection.get(section).set(name, target)
  for (const next of collectRefs(target, new Set())) queue.push(next)
}

// Stable ordering keeps the pruned output (and therefore the generated types
// and the CI drift check) deterministic regardless of allowlist edit order.
const sortEntries = (entries) => [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

const components = Object.fromEntries(
  sortEntries(keptBySection).map(([section, byName]) => [
    section,
    Object.fromEntries(sortEntries(byName)),
  ]),
)

const pruned = {
  ...spec,
  paths: Object.fromEntries(sortEntries(Object.entries(prunedPaths))),
  components,
}

mkdirSync(dirname(outputPath), {recursive: true})
writeFileSync(outputPath, `${JSON.stringify(pruned, null, 2)}\n`)
console.log(
  `Pruned ${Object.keys(spec.paths).length} paths -> ${PATH_ALLOWLIST.length}, ` +
    `components kept: ${[...keptBySection.values()].reduce((n, m) => n + m.size, 0)}`,
)
