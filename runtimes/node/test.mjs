import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'

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

const {default: pkg} = await import('@sanity/client/package.json', {with: {type: 'json'}})

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

test('the built declaration files declare the global SanityQueries registry', async (t) => {
  // API Extractor drops `declare global` blocks from the rollups, and
  // `scripts/append-global-types.mjs` puts the block back after `pkg build`.
  // Every rollup that inlines the exported interface has to carry it, or the
  // `extends globalThis.SanityQueries` clause refers to a global nothing declares.
  const require = createRequire(import.meta.url)
  const distDir = dirname(require.resolve('@sanity/client'))
  for (const entry of ['index.d.ts', 'stega.d.ts']) {
    await t.test(entry, async () => {
      const dts = await readFile(join(distDir, entry), 'utf8')
      assert.match(dts, /interface SanityQueries(?:_\d+)? extends globalThis\.SanityQueries \{\}/)
      assert.match(dts, /declare global \{\s*(?:\/\*\*[\s\S]*?\*\/\s*)?interface SanityQueries \{\}\s*\}/)
    })
  }
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
