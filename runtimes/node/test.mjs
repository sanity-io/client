import test from 'node:test'
import assert from 'node:assert/strict'

import deprecatedClient, {
  createClient,
  Patch,
  Transaction,
  ClientError,
  ServerError,
  requester,
} from '@sanity/client'
import pkg from '@sanity/client/package.json' assert {type: 'json'}

test('top-level imports', async (t) => {
  await t.test('@sanity/client', () => {
    assert.equal(typeof createClient, 'function')
    assert.equal(typeof Patch, 'function')
    assert.equal(typeof Transaction, 'function')
    assert.equal(typeof ClientError, 'function')
    assert.equal(typeof ServerError, 'function')
    assert.equal(typeof requester, 'function')
  })

  await t.test('@sanity/client/package.json', () => {
    const {version} = pkg
    assert.equal(typeof version, 'string')
  })

  await t.test('throws a deprecation error on the default export', () => {
    assert.throws(
      () => {
        deprecatedClient()
      },
      {
        name: /^TypeError$/,
        message: /deprecated/,
      }
    )

    assert.throws(
      () => {
        new deprecatedClient()
      },
      {
        name: /^TypeError$/,
        message: /deprecated/,
      }
    )
  })
})
