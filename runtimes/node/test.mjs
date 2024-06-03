import test from 'node:test'
import assert from 'node:assert/strict'

import createLegacyClient from '@sanity/client'
import {
  createClient,
  SanityClient,
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

  // @TODO re-enable in v6
  /*
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
  // */
})

test('createClient and the deprecated sanityClient default export are equivalent', async (t) => {
  await t.test('createClient instanceof SanityClient', () => {
    assert.equal(
      createClient({
        projectId: 'abc123',
        dataset: 'production',
        useCdn: true,
        apiVersion: '2023-11-01',
      }) instanceof SanityClient,
      true,
    )
  })
  await t.test('createLegacyClient instanceof SanityClient', () => {
    assert.equal(
      createLegacyClient({
        projectId: 'abc123',
        dataset: 'production',
        useCdn: true,
        apiVersion: '2023-11-01',
      }) instanceof SanityClient,
      true,
    )
  })
})
