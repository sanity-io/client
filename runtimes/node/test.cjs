// Smoke-test that CommonJS `require('@sanity/client')` continues to work on
// Node 22.12+ via the runtime's native `require(esm)` support. The package
// itself is ESM-only, but require(esm) makes that a soft constraint.

const test = require('node:test')
const assert = require('node:assert/strict')

test('CommonJS interop via require(esm)', async (t) => {
  await t.test('@sanity/client', () => {
    const {
      createClient,
      Patch,
      Transaction,
      ClientError,
      ServerError,
      requester,
    } = require('@sanity/client')
    assert.equal(typeof createClient, 'function')
    assert.equal(typeof Patch, 'function')
    assert.equal(typeof Transaction, 'function')
    assert.equal(typeof ClientError, 'function')
    assert.equal(typeof ServerError, 'function')
    assert.equal(typeof requester, 'function')
  })

  await t.test('@sanity/client/package.json', () => {
    const {version} = require('@sanity/client/package.json')
    assert.equal(typeof version, 'string')
  })

  await t.test('the same named exports are exposed via require and import', async () => {
    // Node adds an `__esModule` interop flag to the CJS view of any ESM
    // module loaded via `require(esm)` — that's expected, so we ignore it.
    const cjs = Object.keys(require('@sanity/client'))
      .filter((key) => key !== '__esModule')
      .sort()
    const esm = Object.keys(await import('@sanity/client')).sort()
    assert.deepEqual(cjs, esm)
  })
})
