import {existsSync, readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'

import {describe, expect, test} from 'vitest'

/**
 * Guards a failure mode that `test/exports.test.ts` structurally cannot catch.
 *
 * `pkg build` emits the default entries (`index.js`, `csm.js`, `stega.js`,
 * `media-library.js`) and the `node` condition entry (`index.node.js`) in two
 * separate rollup passes that share one chunk directory. If chunk filenames
 * aren't content-hashed, the second pass overwrites chunks the first pass
 * already wrote - splicing `index.node.js` (and with it `node:stream` and
 * `get-it/node`, hence undici) into the browser graph. The `exports` map still
 * resolves correctly; the *bundle it points at* is what's poisoned, so only
 * walking the built output finds it.
 */

// `__dirname` rather than `import.meta.url`: the happy-dom suite rewrites
// `import.meta.url` to an http URL, which `node:path` can't resolve.
const distDir = resolve(__dirname, '../dist')

/** Matches `from "x"`, `import "x"` and `import("x")` in generated ESM. */
const SPECIFIER_RE = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g

/**
 * Walks the built module graph from `entry`, following relative specifiers and
 * collecting every bare (package or builtin) specifier it can reach.
 */
function reachableSpecifiers(entry: string): Set<string> {
  const visited = new Set<string>()
  const bare = new Set<string>()
  const queue = [resolve(distDir, entry)]

  while (queue.length > 0) {
    const file = queue.pop()!
    if (visited.has(file)) continue
    visited.add(file)

    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(SPECIFIER_RE)) {
      if (specifier.startsWith('.')) {
        queue.push(resolve(dirname(file), specifier))
      } else {
        bare.add(specifier)
      }
    }
  }

  return bare
}

// Only meaningful against real build output. The `test:browser` CI job restores
// it before running this suite; `npm test` on a clean checkout skips.
describe.skipIf(!existsSync(resolve(distDir, 'index.js')))('dist module graph', () => {
  // Every entry a non-Node runtime can reach. `stega.js` imports `@sanity/client`
  // as a bare specifier, so it re-enters through the `exports` map rather than
  // through this graph walk - which is the correct boundary to stop at.
  const fetchEntries = ['index.js', 'csm.js', 'stega.js', 'media-library.js']

  for (const entry of fetchEntries) {
    test(`${entry} reaches no Node builtin`, () => {
      const builtins = [...reachableSpecifiers(entry)].filter((id) => id.startsWith('node:'))
      expect(builtins).toEqual([])
    })

    test(`${entry} reaches no Node-only dependency`, () => {
      const specifiers = reachableSpecifiers(entry)
      expect(specifiers).not.toContain('get-it/node')
      expect(specifiers).not.toContain('undici')
    })
  }

  test('the walk is non-vacuous: index.node.js DOES reach node:stream and undici', () => {
    // If the walker silently resolved nothing, every assertion above would pass
    // for the wrong reason.
    const specifiers = reachableSpecifiers('index.node.js')
    expect(specifiers).toContain('node:stream')
    expect(specifiers).toContain('get-it/node')
  })
})
