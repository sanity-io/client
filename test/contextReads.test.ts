import {type ClientConfig, createClient} from '@sanity/client'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock, testResolveFetch} from './helpers/mockFetch'

const apiHost = 'https://api.sanity.url'
const organizationId = 'org-123'
const knowledgeBaseId = 'kb3do82whm'
const queryPath = `/v2026-08-25/context/organizations/${organizationId}/query`

const PAGE_SIZE = 200

const baseConfig = {
  apiHost,
  apiVersion: '2026-08-25',
  context: {organizationId},
  resource: {type: 'knowledge-base', id: knowledgeBaseId},
  useCdn: false,
  useProjectHostname: false,
} satisfies Partial<ClientConfig>

const getMockClient = (config: Partial<ClientConfig> = {}) =>
  createClient({...baseConfig, resolveFetch: testResolveFetch, ...config})

/** The canned reads always pass values as GROQ params, JSON-encoded on the wire. */
const params = (values: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`$${key}`, JSON.stringify(value)]),
  )

describe('context GROQ read helpers', () => {
  test('entries.get reads one entry by path, knowledge-base scoped', async () => {
    const entry = {
      _id: 'entry-1',
      _type: 'sanity.context.entry',
      knowledgeBaseId,
      path: 'billing/refunds',
      title: 'Refunds',
      body: 'Refunds are processed within 5 days.',
      citations: [],
      status: 'filled',
    }
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {
        query: {
          query: '*[_type == "sanity.context.entry" && knowledgeBaseId == $kb && path == $path][0]',
          ...params({kb: knowledgeBaseId, path: 'billing/refunds'}),
        },
      })
      .respond({status: 200, body: {result: entry}})

    await expect(getMockClient().context.entries.get({path: 'billing/refunds'})).resolves.toEqual(
      entry,
    )
  })

  test('entries.get resolves null when no entry sits at the path', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath)
      .respond({status: 200, body: {result: null}})

    await expect(getMockClient().context.entries.get({path: 'no/such'})).resolves.toBeNull()
  })

  test('entries.list drains keyset pages on path and terminates on a short raw page', async () => {
    const entryAt = (index: number) => ({
      _id: `entry-${index}`,
      path: `topics/${`${index}`.padStart(4, '0')}`,
      title: `Topic ${index}`,
      status: 'filled',
    })
    const fullPage = Array.from({length: PAGE_SIZE}, (_, index) => entryAt(index))
    const shortPage = [entryAt(PAGE_SIZE), entryAt(PAGE_SIZE + 1)]
    const pageQuery = `*[_type == "sanity.context.entry" && knowledgeBaseId == $kb && path > $after] | order(path asc) [0...${PAGE_SIZE}] {_id, path, title, tldr, status}`

    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', queryPath, {
        query: {
          query: pageQuery,
          ...params({kb: knowledgeBaseId, after: ''}),
        },
      })
      .respond({status: 200, body: {result: fullPage}})
    scope
      .on('GET', queryPath, {
        query: {
          query: pageQuery,
          ...params({
            kb: knowledgeBaseId,
            after: fullPage[fullPage.length - 1].path,
          }),
        },
      })
      .respond({status: 200, body: {result: shortPage}})

    const entries = await getMockClient().context.entries.list()

    expect(entries).toHaveLength(PAGE_SIZE + shortPage.length)
    expect(entries[0]).toEqual(entryAt(0))
    expect(entries[entries.length - 1]).toEqual(entryAt(PAGE_SIZE + 1))
    // Two requests: the full page demanded another, the short page ended it.
    expect(getActiveMock().getRequests()).toHaveLength(2)
  })

  test('issues.list drains (_createdAt, _id) keyset pages and terminates on a short raw page', async () => {
    const issueAt = (index: number) => ({
      _id: `issue-${`${index}`.padStart(4, '0')}`,
      _type: 'sanity.context.issue',
      _createdAt: '2026-08-26T00:00:00.000Z',
      knowledgeBaseId,
      status: 'open',
    })
    const fullPage = Array.from({length: PAGE_SIZE}, (_, index) => issueAt(index))
    const shortPage = [issueAt(PAGE_SIZE)]
    const last = fullPage[fullPage.length - 1]

    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', queryPath, {
        query: {
          query: `*[_type == "sanity.context.issue" && knowledgeBaseId == $kb] | order(_createdAt asc, _id asc) [0...${PAGE_SIZE}]`,
          ...params({kb: knowledgeBaseId}),
        },
      })
      .respond({status: 200, body: {result: fullPage}})
    scope
      .on('GET', queryPath, {
        query: {
          query: `*[_type == "sanity.context.issue" && knowledgeBaseId == $kb && (_createdAt > $c || (_createdAt == $c && _id > $i))] | order(_createdAt asc, _id asc) [0...${PAGE_SIZE}]`,
          ...params({kb: knowledgeBaseId, c: last._createdAt, i: last._id}),
        },
      })
      .respond({status: 200, body: {result: shortPage}})

    const issues = await getMockClient().context.issues.list()

    expect(issues).toHaveLength(PAGE_SIZE + 1)
    expect(issues[issues.length - 1]._id).toBe(shortPage[0]._id)
  })

  test('issues.list({status}) narrows the query with the status as a param', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {
        query: {
          query: `*[_type == "sanity.context.issue" && knowledgeBaseId == $kb && status == $status] | order(_createdAt asc, _id asc) [0...${PAGE_SIZE}]`,
          ...params({kb: knowledgeBaseId, status: 'open'}),
        },
      })
      .respond({status: 200, body: {result: []}})

    await expect(getMockClient().context.issues.list({status: 'open'})).resolves.toEqual([])
  })

  test('issues.get reads one issue by document id, knowledge-base scoped', async () => {
    const issue = {
      _id: 'issue-1',
      _type: 'sanity.context.issue',
      _createdAt: '2026-08-26T00:00:00.000Z',
      knowledgeBaseId,
      status: 'open',
    }
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {
        query: {
          query: '*[_type == "sanity.context.issue" && knowledgeBaseId == $kb && _id == $id][0]',
          ...params({kb: knowledgeBaseId, id: 'issue-1'}),
        },
      })
      .respond({status: 200, body: {result: issue}})

    await expect(getMockClient().context.issues.get({issueId: 'issue-1'})).resolves.toEqual(issue)
  })

  test('instructions.list reads current-schema instructions, oldest first', async () => {
    const instruction = {
      _id: 'instruction-1',
      _type: 'sanity.context.instruction',
      _createdAt: '2026-08-26T00:00:00.000Z',
      knowledgeBaseId,
      schemaVersion: 1,
      statement: 'Prefer the EU refund policy.',
      status: 'active',
    }
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {
        query: {
          query: `*[_type == "sanity.context.instruction" && knowledgeBaseId == $kb && schemaVersion == 1] | order(_createdAt asc, _id asc) [0...${PAGE_SIZE}]`,
          ...params({kb: knowledgeBaseId}),
        },
      })
      .respond({status: 200, body: {result: [instruction]}})

    await expect(getMockClient().context.instructions.list()).resolves.toEqual([instruction])
  })

  test('mcpEndpoints.list and get read org-scoped endpoint configurations', async () => {
    const endpoint = {
      _id: 'mcp-1',
      _type: 'sanity.context.mcp',
      organizationId,
      name: 'support-agent',
      title: 'Support agent',
    }
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', queryPath, {
        query: {
          query:
            '*[_type == "sanity.context.mcp" && organizationId == $org] | order(_createdAt asc, _id asc) [0...500]',
          ...params({org: organizationId}),
        },
      })
      .respond({status: 200, body: {result: [endpoint]}})
    scope
      .on('GET', queryPath, {
        query: {
          query: '*[_type == "sanity.context.mcp" && organizationId == $org && name == $name][0]',
          ...params({org: organizationId, name: 'support-agent'}),
        },
      })
      .respond({status: 200, body: {result: endpoint}})

    await expect(getMockClient().context.mcpEndpoints.list()).resolves.toEqual([endpoint])
    await expect(
      getMockClient().context.mcpEndpoints.get({name: 'support-agent'}),
    ).resolves.toEqual(endpoint)
  })

  test('conversations.get reads one recorded conversation by thread id', async () => {
    const conversation = {
      _id: 'conversation-1',
      _type: 'sanity.context.conversation',
      organizationId,
      threadId: 'thread-1',
      messages: [],
    }
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {
        query: {
          query:
            '*[_type == "sanity.context.conversation" && organizationId == $org && threadId == $threadId][0]',
          ...params({org: organizationId, threadId: 'thread-1'}),
        },
      })
      .respond({status: 200, body: {result: conversation}})

    await expect(
      getMockClient().context.conversations.get({threadId: 'thread-1'}),
    ).resolves.toEqual(conversation)
  })

  test('entries.rebuild POSTs to the encoded entry path and resolves the accepted job', async () => {
    const accepted = {
      jobId: 'job-1',
      affectedEntries: [{id: 'entry-1', path: 'billing/refunds', title: 'Refunds'}],
    }
    getActiveMock()
      .scope(apiHost)
      .on(
        'POST',
        `/v2026-08-25/context/knowledge-bases/${knowledgeBaseId}/entries/billing%2Frefunds/rebuild`,
      )
      .respond({status: 202, body: accepted})

    await expect(
      getMockClient().context.entries.rebuild({path: 'billing/refunds'}),
    ).resolves.toEqual(accepted)
  })

  test('the observable client mirrors the read helpers over the same plumbing', async () => {
    const entry = {
      _id: 'entry-1',
      _type: 'sanity.context.entry',
      knowledgeBaseId,
      path: 'billing/refunds',
      title: 'Refunds',
      status: 'filled',
    }
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {
        query: {
          query: '*[_type == "sanity.context.entry" && knowledgeBaseId == $kb && path == $path][0]',
          ...params({kb: knowledgeBaseId, path: 'billing/refunds'}),
        },
      })
      .respond({status: 200, body: {result: entry}})

    await expect(
      firstValueFrom(
        getMockClient().observable.context.entries.get({
          path: 'billing/refunds',
        }),
      ),
    ).resolves.toEqual(entry)
  })

  test('knowledge-base scoped reads require the knowledge-base resource', () => {
    const noResource = getMockClient({
      resource: undefined,
      '~experimental_resource': undefined,
    })
    const resourceError =
      '`resource` of type `knowledge-base` must be configured to use knowledge-base methods'

    expect(() => noResource.context.entries.list()).toThrow(resourceError)
    expect(() => noResource.context.issues.list()).toThrow(resourceError)
    expect(() => noResource.context.instructions.list()).toThrow(resourceError)
  })

  test('org-scoped reads require context.organizationId', () => {
    const withoutOrg = getMockClient({context: undefined})
    const orgError = '`context.organizationId` must be configured to query Context documents'

    expect(() => withoutOrg.context.mcpEndpoints.list()).toThrow(orgError)
    expect(() => withoutOrg.context.mcpEndpoints.get({name: 'a'})).toThrow(orgError)
    expect(() => withoutOrg.context.conversations.get({threadId: 't'})).toThrow(orgError)
  })
})
