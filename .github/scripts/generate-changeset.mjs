/* eslint-disable no-console */
import {randomUUID} from 'node:crypto'
import {appendFileSync} from 'node:fs'

// --- Env vars ---
const {
  GH_TOKEN,
  GITHUB_OUTPUT,
  GITHUB_REPOSITORY,
  PR_BODY = '',
  PR_HEAD_SHA,
  PR_NUMBER,
  PR_REPO,
  PR_TITLE,
} = process.env

if (
  !GH_TOKEN ||
  !GITHUB_REPOSITORY ||
  !GITHUB_OUTPUT ||
  !PR_HEAD_SHA ||
  !PR_NUMBER ||
  !PR_TITLE ||
  !PR_REPO
) {
  throw new Error(
    'Missing required env vars: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT, PR_HEAD_SHA, PR_NUMBER, PR_TITLE, PR_REPO',
  )
}

const PACKAGE_NAME = '@sanity/client'
// Paths that affect the published package - changes elsewhere (CI, docs, tests) don't warrant a
// release. The build config counts: package.config.ts controls the entry points and the exports
// map, rollup.config.cjs builds the umd bundle, and tsconfig.dist.json controls declaration
// emit, so any of them can change what consumers receive.
const RELEVANT_PATHS = [
  'src/',
  'package.json',
  'package.config.ts',
  'rollup.config.cjs',
  'tsconfig.dist.json',
]

const CHANGESET_FILE = `.changeset/pr-${PR_NUMBER}.md`
const AUTO_GENERATED_MARKER = '<!-- auto-generated -->'

// --- Helpers ---

async function ghApi(path) {
  const url = path.startsWith('https://') ? path : `https://api.github.com${path}`
  const res = await fetch(url, {
    headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${GH_TOKEN}`},
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`)
  return res.json()
}

function setOutput(key, value) {
  appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`)
}

function parseConventionalCommit(title) {
  const match = title.match(/^([a-z]+)(\((.+)\))?(!)?:\s.+/)
  if (!match) return null
  return {breaking: match[4] === '!', type: match[1]}
}

function determineBump(type, breaking, body) {
  if (breaking) return 'major'
  if (body.split('\n').some((l) => l.startsWith('BREAKING CHANGE:'))) return 'major'
  if (type === 'feat') return 'minor'
  if (['fix', 'perf', 'revert'].includes(type)) return 'patch'
  return null
}

// Fetch all changed file paths for the PR, handling pagination.
async function getChangedFiles() {
  const files = []
  let page = 1

  while (true) {
    const data = await ghApi(
      `/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`,
    )
    if (data.length === 0) break
    // Keep `status`: a file the PR deletes still shows up here, and the two callers below
    // want different things from that.
    files.push(...data.map((f) => ({path: f.filename, status: f.status})))
    page++
  }

  return files
}

// Check if the auto-generated changeset file exists on the PR branch via API.
// Returns its content if it exists, or null.
async function getExistingChangeset() {
  const url = `https://api.github.com/repos/${PR_REPO}/contents/${CHANGESET_FILE}?ref=${PR_HEAD_SHA}`
  const res = await fetch(url, {
    headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${GH_TOKEN}`},
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return Buffer.from(data.content, 'base64').toString()
}

// --- Main ---

// 0. Work out whether the bot still owns this PR's changeset.
const prChangedFiles = await getChangedFiles()
const existingChangeset = await getExistingChangeset()

// A changeset written by hand always wins. Check for one regardless of whether we already
// wrote ours: a contributor can run `pnpm changeset` after the bot has committed, and if we
// only looked when ours was absent both files would survive and the release would carry two
// entries for the same PR.
//
// Only count changesets that still exist on the head commit. A PR that deletes an unreleased
// changeset from the base branch also lists it here, and treating that as "the contributor
// wrote their own" would make us delete our file and then skip forever, leaving the PR with
// no changeset at all.
const manualChangesets = prChangedFiles
  .filter((f) => f.status !== 'removed')
  .map((f) => f.path)
  .filter(
    (p) =>
      p.startsWith('.changeset/') &&
      p.endsWith('.md') &&
      p !== '.changeset/README.md' &&
      p !== CHANGESET_FILE,
  )

// Ours, but edited by hand - the marker is gone, so stop touching it.
if (existingChangeset !== null && !existingChangeset.startsWith(AUTO_GENERATED_MARKER)) {
  console.log('Skipping: changeset was manually edited (marker removed)')
  setOutput('action', 'skip')
  process.exit(0)
}

if (manualChangesets.length > 0) {
  const names = manualChangesets.map((f) => f.replace('.changeset/', ''))
  console.log(`Found manual changeset(s) in PR: ${names.join(', ')}`)
  if (existingChangeset === null) {
    setOutput('action', 'skip')
  } else {
    // We wrote one before the contributor added theirs. Drop ours.
    console.log('Removing the auto-generated changeset in favour of the manual one')
    setOutput('action', 'remove')
    setOutput('changeset_file', CHANGESET_FILE)
  }
  process.exit(0)
}

// 1. Parse conventional commit
const parsed = parseConventionalCommit(PR_TITLE)
if (!parsed) {
  console.log('::warning::PR title does not match conventional commit format')
  if (existingChangeset === null) {
    setOutput('action', 'skip')
  } else {
    setOutput('action', 'remove')
    setOutput('changeset_file', CHANGESET_FILE)
  }
  process.exit(0)
}

// 2. Determine bump
const bump = determineBump(parsed.type, parsed.breaking, PR_BODY)
if (!bump) {
  console.log(`PR type '${parsed.type}' does not require a changeset`)
  if (existingChangeset === null) {
    setOutput('action', 'skip')
  } else {
    setOutput('action', 'remove')
    setOutput('changeset_file', CHANGESET_FILE)
  }
  process.exit(0)
}

// 3. Preserve the full conventional commit title so the changelog function can parse type and scope
const releaseNotes = PR_TITLE

// 4. Only generate a changeset when the published package is affected. Deletions count here:
// removing a source file changes what consumers receive just as much as adding one.
const affectsPackage = prChangedFiles.some(({path: file}) =>
  RELEVANT_PATHS.some((path) => (path.endsWith('/') ? file.startsWith(path) : file === path)),
)

if (!affectsPackage) {
  console.log('No published files affected by changed files')
  if (existingChangeset === null) {
    setOutput('action', 'skip')
  } else {
    setOutput('action', 'remove')
    setOutput('changeset_file', CHANGESET_FILE)
  }
  process.exit(0)
}

// 5. Output changeset content for the workflow to commit
const changesetContent = `${AUTO_GENERATED_MARKER}\n---\n'${PACKAGE_NAME}': ${bump}\n---\n\n${releaseNotes}\n`

console.log('Generated changeset:')
console.log(changesetContent)

setOutput('action', 'write')
setOutput('changeset_file', CHANGESET_FILE)
// Use delimiter syntax with a random delimiter to prevent output injection
const delimiter = `CHANGESET_EOF_${randomUUID().replaceAll('-', '')}`
appendFileSync(GITHUB_OUTPUT, `changeset_content<<${delimiter}\n${changesetContent}${delimiter}\n`)
