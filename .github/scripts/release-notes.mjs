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
function headingVersion(line) {
  const [token] = line.slice(3).trim().split(/\s+/)
  return token.replace(/^\[/, '').replace(/\].*$/, '')
}

const lines = changelog.split('\n')

// A `## ` line inside a fenced code block is not a heading. `changesets/action` parses the
// changelog as markdown and gets this for free; here the fences are tracked by hand, otherwise
// an entry containing a code sample with a markdown heading in it would cut the notes short.
let openFence = null
const isHeading = lines.map((line) => {
  const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/)
  if (openFence !== null) {
    if (
      fenceMatch &&
      fenceMatch[1][0] === openFence[0] &&
      fenceMatch[1].length >= openFence.length
    ) {
      openFence = null
    }
    return false
  }
  if (fenceMatch) {
    openFence = fenceMatch[1]
    return false
  }
  return line.startsWith('## ')
})

const start = lines.findIndex((line, i) => isHeading[i] && headingVersion(line) === version)

if (start === -1) {
  throw new Error(`Could not find a changelog entry for ${version} in CHANGELOG.md`)
}

let end = lines.length
for (let i = start + 1; i < lines.length; i++) {
  if (isHeading[i]) {
    end = i
    break
  }
}

console.log(
  lines
    .slice(start + 1, end)
    .join('\n')
    .trim(),
)
