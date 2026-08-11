/* eslint-disable no-console */
// Prints the CHANGELOG.md section for a given version, for use as GitHub release notes.
//
// `changesets/action` normally creates the GitHub release itself, but it does not pass
// `make_latest`, so GitHub marks whatever was released most recently as "Latest". That is wrong
// for maintenance branches: a 7.x patch released after 8.0.0 would steal the badge. The release
// workflow therefore runs with `createGithubReleases: false` and creates the release itself, and
// needs the changelog entry that the action would have used.
import {readFile} from 'node:fs/promises'

const version = process.argv[2]

if (!version) {
  throw new Error('Usage: node .github/scripts/release-notes.mjs <version>')
}

const changelog = await readFile('CHANGELOG.md', 'utf8')

// Find the level-2 heading for this version, then take everything up to the next level-2 heading.
// Changesets writes `## 7.26.3`; the release-please entries already in the file are linked, as in
// `## [7.26.2](https://github.com/sanity-io/client/compare/v7.26.1...v7.26.2) (2026-08-04)`, so
// match on the first token of the heading with any link syntax stripped.
const isHeading = (line) => line.startsWith('## ')

function headingVersion(line) {
  const [token] = line.slice(3).trim().split(/\s+/)
  return token.replace(/^\[/, '').replace(/\].*$/, '')
}

const lines = changelog.split('\n')
const start = lines.findIndex((line) => isHeading(line) && headingVersion(line) === version)

if (start === -1) {
  throw new Error(`Could not find a changelog entry for ${version} in CHANGELOG.md`)
}

const rest = lines.slice(start + 1)
const end = rest.findIndex(isHeading)
const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()

console.log(body)
