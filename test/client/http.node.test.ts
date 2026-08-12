import {encode} from 'eventsource-encoder'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

import {getActiveMock, streamBody, streamStall} from '../helpers/mockFetch'
import {apiHost, getClient, projectHost} from './helpers'

const resourceDoc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}

test('listeners connect to listen resource configured endpoint, emits events', async () => {
  expect.assertions(1)

  const response = streamBody(
    encode({
      event: 'welcome',
      data: JSON.stringify({listenerName: 'LGFXwOqrf1GHawAjZRnhd6'}),
    }),
    encode({event: 'mutation', data: JSON.stringify({result: resourceDoc})}),
    streamStall(),
  )

  getActiveMock()
    .scope(`https://${apiHost}`)
    .on('GET', '/v1/media-libraries/res-id/listen?query=foo.bar&includeResult=true')
    .respond({
      status: 200,
      body: response,
      headers: {
        'cache-control': 'no-cache',
        'content-type': 'text/event-stream; charset=utf-8',
        'transfer-encoding': 'chunked',
      },
    })

  const evt = await firstValueFrom(
    getClient({'~experimental_resource': {type: 'media-library', id: 'res-id'}}).listen('foo.bar'),
  )
  expect(evt.result).toEqual(resourceDoc)
})

describe('lineage', () => {
  test('adds lineage header through client constructor', async () => {
    const client = getClient({lineage: 'my-lineage-id'})
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false', {
        headers: {'x-sanity-lineage': 'my-lineage-id'},
      })
      .respond({status: 200, body: {result: []}})

    await expect(client.fetch('*')).resolves.not.toThrow()
  })

  test('adds lineage header through environment variable', async () => {
    vi.stubEnv('X_SANITY_LINEAGE', 'env-lineage-id')

    const client = getClient()

    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{createOrReplace: doc}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
        headers: {'x-sanity-lineage': 'env-lineage-id'},
      })
      .respond({
        status: 200,
        body: {transactionId: '123abc', results: [{id: 'abc123', operation: 'create'}]},
      })

    await expect(client.createOrReplace(doc)).resolves.not.toThrow()
  })

  test('environment variable overrides client constructor option', async () => {
    vi.stubEnv('X_SANITY_LINEAGE', 'env-lineage-id')

    const client = getClient({lineage: 'client-lineage-id'})

    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{createOrReplace: doc}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({
        status: 200,
        body: {transactionId: '123abc', results: [{id: 'abc123', operation: 'create'}]},
      })

    await expect(client.createOrReplace(doc)).resolves.not.toThrow()
  })
})
