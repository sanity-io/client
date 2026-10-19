import {type ClientConfig, createClient} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock, streamBody, streamStall, testResolveFetch} from './helpers/mockFetch'

const apiHost = 'https://api.sanity.url'
const organizationId = 'org-123'

const conversationDocument = {
  _id: 'conversation-1',
  _type: 'sanity.context.conversation',
  _createdAt: '2026-08-26T09:58:00.000Z',
  _updatedAt: '2026-08-26T09:58:00.000Z',
  _rev: 'rev-1',
  threadId: 'thread-1',
  classification: {outcome: 'failed'},
}

const baseConfig = {
  apiHost,
  apiVersion: '2026-08-25',
  context: {
    organizationId,
  },
  useCdn: false,
  useProjectHostname: false,
}

/**
 * Client whose requests - including the EventSource connection `listen()`
 * opens - go to the per-test `get-it/mock` transport.
 */
const getMockClient = (config: Partial<ClientConfig> = {}) =>
  createClient({...baseConfig, resolveFetch: testResolveFetch, ...config})

describe('context GROQ reads', () => {
  const query = '*[_type == "sanity.context.conversation" && classification.outcome == $outcome]'

  test('fetches conversation documents with a GROQ query and params', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', `/v2026-08-25/context/organizations/${organizationId}/query`, {
        query: {
          $outcome: JSON.stringify('failed'),
          query,
        },
      })
      .respond({status: 200, body: {result: [conversationDocument]}})

    await expect(getMockClient().context.fetch(query, {outcome: 'failed'})).resolves.toEqual([
      conversationDocument,
    ])
  })

  test('switches to POST past the GET size limit, keeping the organization in the path', async () => {
    const hugeQuery = `${query} // ${'x'.repeat(12000)}`

    getActiveMock()
      .scope(apiHost)
      .on('POST', `/v2026-08-25/context/organizations/${organizationId}/query`, {
        body: {query: hugeQuery, params: {outcome: 'failed'}},
      })
      .respond({status: 200, body: {result: []}})

    await expect(getMockClient().context.fetch(hugeQuery, {outcome: 'failed'})).resolves.toEqual([])
  })

  test('requires context.organizationId in the client configuration', () => {
    const withoutOrg = getMockClient({context: undefined})
    const orgError = '`context.organizationId` must be configured to query Context documents'

    expect(() => withoutOrg.context.fetch(query)).toThrow(orgError)
    expect(() => withoutOrg.context.listen(query)).toThrow(orgError)
  })

  test('conversations.save PUTs the transcript and classify PATCHes the verdict', async () => {
    const conversation = {...conversationDocument, id: 'conversation-1'}
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('PUT', `/v2026-08-25/context/organizations/${organizationId}/conversations/thread-1`, {
        body: {
          messages: [{role: 'user', content: 'hi'}],
          metadata: {mcpEndpoints: ['support-agent'], plan: 'enterprise'},
        },
      })
      .respond({status: 200, body: conversation})
    scope
      .on('PATCH', `/v2026-08-25/context/organizations/${organizationId}/conversations/thread-1`, {
        body: {coreMetrics: {successScore: 9, sentiment: 'positive', contentGaps: []}},
      })
      .respond({status: 200, body: conversation})

    await expect(
      getMockClient().context.conversations.save({
        threadId: 'thread-1',
        messages: [{role: 'user', content: 'hi'}],
        metadata: {mcpEndpoints: ['support-agent'], plan: 'enterprise'},
      }),
    ).resolves.toEqual(conversation)
    await expect(
      getMockClient().context.conversations.classify({
        threadId: 'thread-1',
        coreMetrics: {successScore: 9, sentiment: 'positive', contentGaps: []},
      }),
    ).resolves.toEqual(conversation)
  })

  test('conversations.delete DELETEs the thread and rejects an unknown one with 404', async () => {
    const path = `/v2026-08-25/context/organizations/${organizationId}/conversations`
    const scope = getActiveMock().scope(apiHost)
    scope.on('DELETE', `${path}/thread-1`).respond({status: 204})
    scope.on('DELETE', `${path}/thread-2`).respond({status: 204})
    scope.on('DELETE', `${path}/missing`).respond({
      status: 404,
      body: {statusCode: 404, error: 'Not Found', code: 'conversationNotFound'},
    })

    await expect(
      getMockClient().context.conversations.delete({threadId: 'thread-1'}),
    ).resolves.toBeUndefined()
    await expect(
      firstValueFrom(
        getMockClient().observable.context.conversations.delete({threadId: 'thread-2'}),
      ),
    ).resolves.toBeUndefined()
    await expect(
      getMockClient().context.conversations.delete({threadId: 'missing'}),
    ).rejects.toMatchObject({statusCode: 404})
  })

  test('conversations.delete forwards the request tag and the abort signal on both clients', async () => {
    const path = `/v2026-08-25/context/organizations/${organizationId}/conversations/thread-1`
    const scope = getActiveMock().scope(apiHost)
    scope.on('DELETE', path).respond({status: 204})
    scope.on('DELETE', path).respond({status: 204})
    const client = getMockClient()

    await client.context.conversations.delete({threadId: 'thread-1'}, {tag: 'erasure'})
    await firstValueFrom(
      client.observable.context.conversations.delete({threadId: 'thread-1'}, {tag: 'erasure'}),
    )
    expect(
      getActiveMock()
        .getRequests()
        .map((request) => request.query.tag),
    ).toEqual(['erasure', 'erasure'])

    scope.on('DELETE', path).respond({status: 204, delay: 60_000})
    scope.on('DELETE', path).respond({status: 204, delay: 60_000})
    const promiseCaller = new AbortController()
    const observableCaller = new AbortController()
    const promiseDelete = client.context.conversations.delete(
      {threadId: 'thread-1'},
      {signal: promiseCaller.signal},
    )
    const observableDelete = firstValueFrom(
      client.observable.context.conversations.delete(
        {threadId: 'thread-1'},
        {signal: observableCaller.signal},
      ),
    )
    promiseCaller.abort()
    observableCaller.abort()
    await expect(promiseDelete).rejects.toHaveProperty('name', 'AbortError')
    await expect(observableDelete).rejects.toHaveProperty('name', 'AbortError')
  })

  test('conversation writes require context.organizationId in the client configuration', () => {
    const withoutOrg = getMockClient({context: undefined})
    const orgError = '`context.organizationId` must be configured to record conversations'

    expect(() =>
      withoutOrg.context.conversations.save({threadId: 'thread-1', messages: []}),
    ).toThrow(orgError)
    expect(() => withoutOrg.context.conversations.delete({threadId: 'thread-1'})).toThrow(orgError)
  })

  test('conversations.delete rejects an empty threadId before any request', async () => {
    expect(() => getMockClient().context.conversations.delete({threadId: ''})).toThrow(
      '`threadId` must be provided',
    )
    await expect(
      firstValueFrom(getMockClient().observable.context.conversations.delete({threadId: ''})),
    ).rejects.toThrow('`threadId` must be provided')
  })

  test('listen opens an EventSource scoped to the organization and emits mutation events', async () => {
    const mutation = {
      documentId: 'conversation-1',
      eventId: 'event-1',
      identity: 'user-1',
      mutations: [],
      timestamp: '2026-08-26T09:58:00.000Z',
      transactionCurrentEvent: 0,
      transactionId: 'txn-1',
      transactionTotalEvents: 1,
      transition: 'appear',
      visibility: 'query',
    }

    getActiveMock()
      .scope(apiHost)
      .on('GET', `/v2026-08-25/context/organizations/${organizationId}/listen`)
      .respond({
        status: 200,
        body: streamBody(
          encode({event: 'mutation', data: JSON.stringify(mutation)}),
          streamStall(),
        ),
        headers: {'content-type': 'text/event-stream; charset=utf-8'},
      })

    const event = await firstValueFrom(getMockClient().context.listen(query, {outcome: 'failed'}))

    expect(event).toEqual({type: 'mutation', ...mutation})

    const [request] = getActiveMock().getRequests()
    expect(request.url).toContain(`/context/organizations/${organizationId}/listen`)
    expect(request.query).toMatchObject({
      query,
      $outcome: JSON.stringify('failed'),
    })
  })
})
