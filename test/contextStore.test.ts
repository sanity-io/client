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

  test('conversations.save PUTs the transcript, classify PATCHes the verdict, and delete DELETEs the thread', async () => {
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
    scope
      .on('DELETE', `/v2026-08-25/context/organizations/${organizationId}/conversations/thread-1`)
      .respond({status: 204})

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
    await expect(
      getMockClient().context.conversations.delete({threadId: 'thread-1'}),
    ).resolves.toBeUndefined()
  })

  test('conversation writes require context.organizationId and a threadId', () => {
    const withoutOrg = getMockClient({context: undefined})
    const orgError = '`context.organizationId` must be configured to record conversations'

    expect(() =>
      withoutOrg.context.conversations.save({threadId: 'thread-1', messages: []}),
    ).toThrow(orgError)
    expect(() => withoutOrg.context.conversations.delete({threadId: 'thread-1'})).toThrow(orgError)
    expect(() => getMockClient().context.conversations.delete({threadId: ''})).toThrow(
      '`threadId` must be provided',
    )
  })

  test('mcpEndpoints.create POSTs to the organization, edit PATCHes and delete DELETEs by name', async () => {
    const endpoint = {
      id: 'mcpabc12345',
      organizationId,
      title: 'Support agent',
      name: 'support-agent',
      sources: [{type: 'knowledge-base', id: 'kb3do82whm'}],
      instructions: null,
      groqFilter: null,
      url: `https://api.sanity.io/v1/context/organizations/${organizationId}/mcp/support-agent`,
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-20T09:00:00.000Z',
    }
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('POST', `/v2026-08-25/context/organizations/${organizationId}/mcp`, {
        body: {
          title: 'Support agent',
          name: 'support-agent',
          sources: [{type: 'knowledge-base', id: 'kb3do82whm'}],
        },
      })
      .respond({status: 201, body: endpoint})
    scope
      .on('PATCH', `/v2026-08-25/context/organizations/${organizationId}/mcp/support-agent`, {
        body: {title: 'Support', instructions: null},
      })
      .respond({status: 200, body: {...endpoint, title: 'Support'}})
    scope
      .on('DELETE', `/v2026-08-25/context/organizations/${organizationId}/mcp/support-agent`)
      .respond({status: 204})

    await expect(
      getMockClient().context.mcpEndpoints.create({
        title: 'Support agent',
        name: 'support-agent',
        sources: [{type: 'knowledge-base', id: 'kb3do82whm'}],
      }),
    ).resolves.toEqual(endpoint)
    await expect(
      getMockClient().context.mcpEndpoints.edit({
        name: 'support-agent',
        title: 'Support',
        instructions: null,
      }),
    ).resolves.toEqual({...endpoint, title: 'Support'})
    await expect(
      getMockClient().context.mcpEndpoints.delete({name: 'support-agent'}),
    ).resolves.toBeUndefined()
  })

  test('mcpEndpoints management requires context.organizationId and a name', () => {
    expect(() =>
      getMockClient({context: undefined}).context.mcpEndpoints.create({
        title: 'Support agent',
        name: 'support-agent',
        sources: [{type: 'knowledge-base', id: 'kb3do82whm'}],
      }),
    ).toThrow('`context.organizationId` must be configured to use MCP endpoints')
    expect(() => getMockClient().context.mcpEndpoints.delete({name: ''})).toThrow(
      '`name` must be provided',
    )
  })

  test('mcpEndpoints.status and initialContext read an endpoint by name with its runtime options', async () => {
    const status = {
      requiredOk: true,
      checks: {
        studio: null,
        semanticSearch: null,
        schema: null,
        knowledgeBases: {ok: true, resolved: ['kb3do82whm']},
      },
    }
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', `/v2026-08-25/context/organizations/${organizationId}/mcp/support-agent/status`, {
        query: {mode: 'knowledge_base'},
      })
      .respond({status: 200, body: status})
    scope
      .on(
        'GET',
        `/v2026-08-25/context/organizations/${organizationId}/mcp/support-agent/initial-context`,
        {query: {heading_offset: '2'}},
      )
      .respond({
        status: 200,
        headers: {'content-type': 'text/plain; charset=utf-8'},
        body: '### Support agent',
      })

    await expect(
      getMockClient().context.mcpEndpoints.status({name: 'support-agent', mode: 'knowledge_base'}),
    ).resolves.toEqual(status)
    await expect(
      getMockClient().context.mcpEndpoints.initialContext({
        name: 'support-agent',
        heading_offset: '2',
      }),
    ).resolves.toBe('### Support agent')
  })

  test('mcpEndpoints serving reads require context.organizationId and a name', () => {
    const orgError = '`context.organizationId` must be configured to use MCP endpoints'

    expect(() =>
      getMockClient({context: undefined}).context.mcpEndpoints.status({name: 'support-agent'}),
    ).toThrow(orgError)
    expect(() => getMockClient().context.mcpEndpoints.initialContext({name: ''})).toThrow(
      '`name` must be provided',
    )
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
