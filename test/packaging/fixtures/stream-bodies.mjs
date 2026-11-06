import assert from 'node:assert/strict'
import {Buffer} from 'node:buffer'
import {createReadStream, readFileSync} from 'node:fs'
import {PassThrough} from 'node:stream'

import {createClient} from '@sanity/client'
import {bodyBytes, createMockFetch} from 'get-it/mock'

export async function assertNodeStreamBodies(file) {
  assert.ok(file, 'A file-stream fixture is required')

  const bodies = [
    {
      name: 'PassThrough',
      bytes: Buffer.from('streamed request body'),
      create() {
        const stream = new PassThrough()
        stream.end(this.bytes)
        return stream
      },
    },
    {name: 'file stream', bytes: readFileSync(file), create: () => createReadStream(file)},
  ]

  for (const body of bodies) {
    for (const operation of ['request', 'upload']) {
      const mock = createMockFetch()
      const path = operation === 'request' ? '/v1/stream-test' : '/v1/assets/files/production'
      mock
        .scope('https://abc123.api.sanity.io')
        .on('POST', path, {body: bodyBytes(body.bytes)})
        .respond({status: 200, body: {document: {_id: 'file-stream-test'}}})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '1',
        useCdn: false,
        maxRetries: 0,
        resolveFetch: () => mock.fetch,
      })

      try {
        if (operation === 'request') {
          const result = await client.request({
            url: '/stream-test',
            method: 'POST',
            body: body.create(),
          })
          assert.deepEqual(result, {document: {_id: 'file-stream-test'}})
        } else {
          const result = await client.assets.upload('file', body.create())
          assert.equal(result._id, 'file-stream-test')
        }
        mock.assertAllConsumed()
      } catch (error) {
        throw new Error(`${operation}() failed with a ${body.name} body`, {cause: error})
      }
    }
  }
}
