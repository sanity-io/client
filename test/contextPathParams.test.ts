import {type ClientConfig, createClient, type SanityClient} from '@sanity/client'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock, testResolveFetch} from './helpers/mockFetch'

const apiHost = 'https://api.sanity.url'
const route = 'PUT /organizations/{organizationId}/conversations/{threadId}'
const prefix = '/v2026-05-26/context/organizations'
const response = {messages: []}
type Api = 'promise' | 'observable' | 'bytes'
const apis: Api[] = ['promise', 'observable', 'bytes']
const dotSegments = ['.', '..']
const identifiers = [
  {id: 'thread-A', encoded: 'thread-A'},
  {id: 'a/../b', encoded: 'a%2F..%2Fb'},
  {id: '%2e%2e', encoded: '%252e%252e'},
  {id: 'a..b', encoded: 'a..b'},
  {id: '会話 café', encoded: '%E4%BC%9A%E8%A9%B1%20caf%C3%A9'},
]

const getMockClient = (config: Partial<ClientConfig> = {}) =>
  createClient({
    apiHost,
    apiVersion: '2026-05-26',
    useCdn: false,
    useProjectHostname: false,
    maxRetries: 0,
    resolveFetch: testResolveFetch,
    context: {organizationId: 'configured-org'},
    ...config,
  })

function send(client: SanityClient, api: Api, params: {organizationId?: string; threadId: string}) {
  const init = {params, body: {messages: []}}
  if (api === 'observable') {
    return firstValueFrom(client.observable.context.request(route, init))
  }
  if (api === 'bytes') return client.context.requestBytes(route, init)
  return client.context.request(route, init)
}

async function expectRequest(
  api: Api,
  client: SanityClient,
  params: {organizationId?: string; threadId: string},
  path: string,
) {
  const mock = getActiveMock()
  mock
    .scope(apiHost)
    .on('PUT', path, {body: {messages: []}})
    .respond({
      status: 200,
      body: response,
      headers: {'content-type': 'application/json'},
    })

  const result = await send(client, api, params)
  expect(result).toEqual(
    api === 'bytes' ? new TextEncoder().encode(JSON.stringify(response)) : response,
  )
  expect(mock.getRequests()).toEqual([
    expect.objectContaining({method: 'PUT', fullUrl: `${apiHost}${path}`, body: {messages: []}}),
  ])
}

// The same route builder serves JSON, Observable and raw-byte requests.
// Exact dot segments must fail before transport; encoded slashes and percent signs remain data.
describe.each(apis)('context path parameters (%s)', (api) => {
  test.each(dotSegments)(
    'rejects an explicit thread dot segment %s before transport',
    async (id) => {
      await expect(send(getMockClient(), api, {threadId: id})).rejects.toThrow(
        '`params.threadId` must not be a dot segment',
      )
      expect(getActiveMock().getRequests()).toEqual([])
    },
  )

  test.each(dotSegments)(
    'rejects an explicit organization dot segment %s before transport',
    async (id) => {
      await expect(
        send(getMockClient(), api, {organizationId: id, threadId: 'thread-A'}),
      ).rejects.toThrow('`params.organizationId` must not be a dot segment')
      expect(getActiveMock().getRequests()).toEqual([])
    },
  )

  test.each(dotSegments)(
    'rejects a configured organization dot segment %s before transport',
    async (id) => {
      const client = getMockClient({context: {organizationId: id}})
      await expect(send(client, api, {threadId: 'thread-A'})).rejects.toThrow(
        '`params.organizationId` must not be a dot segment',
      )
      expect(getActiveMock().getRequests()).toEqual([])
    },
  )

  test.each(identifiers)('preserves the encoded thread identifier $id', async ({id, encoded}) => {
    await expectRequest(
      api,
      getMockClient(),
      {threadId: id},
      `${prefix}/configured-org/conversations/${encoded}`,
    )
  })

  test.each(identifiers)(
    'preserves the encoded organization identifier $id',
    async ({id, encoded}) => {
      await expectRequest(
        api,
        getMockClient(),
        {organizationId: id, threadId: 'thread-A'},
        `${prefix}/${encoded}/conversations/thread-A`,
      )
    },
  )

  test('takes an explicit organization over an invalid configured fallback', async () => {
    const client = getMockClient({context: {organizationId: '..'}})
    await expectRequest(
      api,
      client,
      {organizationId: 'explicit-org', threadId: 'thread-A'},
      `${prefix}/explicit-org/conversations/thread-A`,
    )
  })
})
