const test = require('node:test')
const assert = require('node:assert/strict')

test('top-level imports', async (t) => {
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

  await t.test('the same named exports are used as ESM', async () => {
    const cjs = Object.keys(require('@sanity/client')).sort()
    const esm = Object.keys(await import('@sanity/client')).sort()
    assert.deepEqual(cjs, esm)
  })

  // @TODO re-enable in v6
  /*
  await t.test('throws a deprecation error on the default export', () => {
    const {default: createClient} = require('@sanity/client')

    assert.throws(
      () => {
        createClient()
      },
      {
        name: /^TypeError$/,
        message: /deprecated/,
      }
    )

    const {default: SanityClient} = require('@sanity/client')

    assert.throws(
      () => {
        new SanityClient()
      },
      {
        name: /^TypeError$/,
        message: /deprecated/,
      }
    )
  })
  // */
})
