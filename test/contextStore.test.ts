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
