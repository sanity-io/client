import {createRequire} from 'node:module'

import {expect, test} from 'vitest'

// Smoke-tests that CommonJS `require('@sanity/client')` continues to work on
// Node 22.12+ via the runtime's native `require(esm)` support. The package
// itself is ESM-only, but `require(esm)` makes that a soft constraint.
//
// `createRequire` returns Node's real `require`, so it resolves through the
// package's actual `exports` map (built `dist/`, not source) exactly like a
// consumer's `require('@sanity/client')` would.
const require = createRequire(import.meta.url)

test('require("@sanity/client") exposes the expected named exports', () => {
  const {
    createClient,
    Patch,
    Transaction,
    ClientError,
    ServerError,
    requester,
  } = require('@sanity/client')
  expect(typeof createClient).toBe('function')
  expect(typeof Patch).toBe('function')
  expect(typeof Transaction).toBe('function')
  expect(typeof ClientError).toBe('function')
  expect(typeof ServerError).toBe('function')
  expect(typeof requester).toBe('function')
})

test('require("@sanity/client/package.json") resolves the package manifest', () => {
  const {version} = require('@sanity/client/package.json')
  expect(typeof version).toBe('string')
})

test('require() resolves the Node build, not the fetch build', () => {
  // The `node` exports branch must catch the `require` condition too,
  // otherwise CommonJS consumers silently get the platform-neutral build and
  // lose the Node middleware (Readable upload bodies, explicit proxy
  // support, lineage/User-Agent headers).
  expect(require.resolve('@sanity/client')).toMatch(/index\.node\.js$/)
})

test('the same named exports are exposed via require and import', async () => {
  // Node adds an `__esModule` interop flag to the CJS view of any ESM module
  // loaded via `require(esm)`. That is expected, so it is ignored here.
  const cjs = Object.keys(require('@sanity/client'))
    .filter((key) => key !== '__esModule')
    .sort()
  const esm = Object.keys(await import('@sanity/client')).sort()
  expect(cjs).toEqual(esm)
})
