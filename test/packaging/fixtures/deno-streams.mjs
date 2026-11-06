import assert from 'node:assert/strict'
import process from 'node:process'

import {createClient} from '@sanity/client'
import {createMockFetch} from 'get-it/mock'

import {assertNodeStreamBodies} from './stream-bodies.mjs'

assert.ok(process.versions.deno, 'The package smoke test must run under Deno')
await assertNodeStreamBodies(process.argv[2])

const client = createClient({
  projectId: 'abc123',
  dataset: 'production',
  apiVersion: '1',
  useCdn: false,
  maxRetries: 0,
})
assert.equal(client.config().resolveFetch, undefined, 'Deno must keep the default fetch transport')

const mock = createMockFetch()
mock
  .scope('https://abc123.api.sanity.io')
  .on('GET', '/v1/native-fetch')
  .respond({status: 200, body: {nativeFetch: true}})

// Fetch selection itself is under test here. A config.resolveFetch override
// would bypass the default transport and could hide an undici regression.
const originalFetch = globalThis.fetch
try {
  globalThis.fetch = mock.fetch
  assert.deepEqual(await client.request({url: '/native-fetch'}), {nativeFetch: true})
  mock.assertAllConsumed()
} finally {
  globalThis.fetch = originalFetch
}
