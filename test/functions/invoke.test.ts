import {createClient as createCoreClient} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {getActiveMock, testResolveFetch} from '../helpers/mockFetch'

const PROJECT_ID = 'test123'
const HOST = `https://${PROJECT_ID}.api.sanity.io`
const API_VERSION = '2025-02-19'
const BASE = `/v${API_VERSION}`
const STACK_ID = 'ST-1234567890'
const OTHER_STACK_ID = 'ST-9876543210'
const ORG_ID = 'oOrG12345'
const OTHER_ORG_ID = 'oOtHeR9999'

// Clients in this suite go through the per-test mock, injected via the
// public `resolveFetch` config option.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

const getClient = (overrides: {stackId?: string} = {stackId: STACK_ID}) =>
  createClient({
    projectId: PROJECT_ID,
    dataset: 'prod',
    apiVersion: API_VERSION,
    useCdn: false,
    token: 'my-token',
    ...overrides,
  })

const stackUri = (stackId: string) => `${BASE}/blueprints/stacks/${stackId}`
// The route is async by default, so only a sync invoke carries the query param.
const invokeUri = (functionId: string, sync = false) =>
  `${BASE}/functions/${functionId}/invoke${sync ? '?sync=true' : ''}`

const SYNC_INVOCABLE_RESOURCES = [
  {name: 'my-func', type: 'sanity.function.pubsub', externalId: 'fn-abc123'},
]
const ASYNC_INVOCABLE_RESOURCES = [
  ...SYNC_INVOCABLE_RESOURCES,
  {name: 'my-durable', type: 'sanity.function.durable', externalId: 'fn-durable'},
  {name: 'my-queue', type: 'sanity.function.queue', externalId: 'fn-queue'},
]
// INVOCABLE, but only when queued — asking for a synchronous run must be refused.
const ASYNC_ONLY_RESOURCES = ASYNC_INVOCABLE_RESOURCES.filter(
  (resource) => !SYNC_INVOCABLE_RESOURCES.includes(resource),
)
const NON_INVOCABLE_RESOURCES = [
  {name: 'doc-func', type: 'sanity.function.document', externalId: 'fn-def456'},
  {name: 'cron-func', type: 'sanity.function.cron', externalId: 'fn-ghi789'},
]

const STACK = {
  id: STACK_ID,
  name: 'my-stack',
  resources: [
    ...ASYNC_INVOCABLE_RESOURCES,
    ...NON_INVOCABLE_RESOURCES,
    // A non-function resource sharing a name must not be picked up.
    {name: 'my-func', type: 'sanity.cors.origin', externalId: 'co-000000'},
  ],
}

describe('client.functions.invoke', () => {
  for (const resource of ASYNC_INVOCABLE_RESOURCES) {
    test(`resolves the name within the stack and posts the event payload for ${resource.type}`, async () => {
      const mock = getActiveMock()
      mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
      mock
        .scope(HOST)
        .on('POST', invokeUri(resource.externalId, false), {
          body: {event: {data: {hello: 'world'}}},
        })
        .respond({status: 202})

      const result = await getClient().functions.invoke(resource.name, {
        event: {data: {hello: 'world'}},
      })

      expect(result).toEqual(undefined)
      expect(mock).toHaveReceivedRequest('GET', stackUri(STACK_ID))
      expect(mock).toHaveReceivedRequest('POST', invokeUri(resource.externalId, false))
    })

    test(`resolves the name within the stack and posts the event payload for ${resource.type} and async requested`, async () => {
      const mock = getActiveMock()
      mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
      mock
        .scope(HOST)
        .on('POST', invokeUri(resource.externalId, false), {
          body: {event: {data: {hello: 'world'}}},
        })
        .respond({status: 202})

      const result = await getClient().functions.invoke(
        resource.name,
        {
          event: {data: {hello: 'world'}},
        },
        {sync: false},
      )

      expect(result).toEqual(undefined)
      expect(mock).toHaveReceivedRequest('GET', stackUri(STACK_ID))
      expect(mock).toHaveReceivedRequest('POST', invokeUri(resource.externalId, false))
    })
  }

  for (const resource of SYNC_INVOCABLE_RESOURCES) {
    test(`resolves the name within the stack and posts the event payload for ${resource.type} and sync requested`, async () => {
      const mock = getActiveMock()
      mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
      mock
        .scope(HOST)
        .on('POST', invokeUri(resource.externalId, true), {body: {event: {data: {hello: 'world'}}}})
        .respond({status: 200, body: {ok: true}})

      const result = await getClient().functions.invoke(
        resource.name,
        {
          event: {data: {hello: 'world'}},
        },
        {sync: true},
      )

      expect(result).toEqual({ok: true})
      expect(mock).toHaveReceivedRequest('GET', stackUri(STACK_ID))
      expect(mock).toHaveReceivedRequest('POST', invokeUri(resource.externalId, true))
    })
  }

  for (const resource of ASYNC_ONLY_RESOURCES) {
    test(`rejects a sync invoke of ${resource.type} without calling the Functions service`, async () => {
      const mock = getActiveMock()
      mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})

      await expect(
        getClient().functions.invoke(resource.name, undefined, {sync: true}),
      ).rejects.toThrow(`Synchronous function invocation is not supported for ${resource.type}`)
      expect(mock).toHaveReceivedRequestTimes('POST', invokeUri(resource.externalId, true), 0)
    })
  }

  test('matches only resources of a function type', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-abc123'))
      .respond({status: 200, body: {ok: true}})

    await getClient().functions.invoke('my-func')

    expect(mock).toHaveReceivedRequest('POST', invokeUri('fn-abc123'))
  })

  test('rejects when the stack has no function by that name', async () => {
    getActiveMock().scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})

    await expect(getClient().functions.invoke('not-in-stack')).rejects.toThrow(
      `Function "not-in-stack" not found in stack "${STACK_ID}"`,
    )
  })

  test('rejects when the function is declared but not yet deployed', async () => {
    getActiveMock()
      .scope(HOST)
      .on('GET', stackUri(STACK_ID))
      .respond({
        status: 200,
        body: {...STACK, resources: [{name: 'pending-func', type: 'sanity.function.pubsub'}]},
      })

    await expect(getClient().functions.invoke('pending-func')).rejects.toThrow('is not deployed')
  })

  for (const resource of NON_INVOCABLE_RESOURCES) {
    test(`rejects a ${resource.type} without calling the Functions service`, async () => {
      const mock = getActiveMock()
      mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})

      await expect(getClient().functions.invoke(resource.name)).rejects.toThrow(
        `Function invocation is not supported for ${resource.type}`,
      )
      expect(mock).toHaveReceivedRequestTimes('POST', invokeUri(resource.externalId), 0)
    })
  }

  test('a per-call stackId overrides the client config', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('GET', stackUri(OTHER_STACK_ID))
      .respond({
        status: 200,
        body: {
          id: OTHER_STACK_ID,
          resources: [{name: 'my-func', type: 'sanity.function.pubsub', externalId: 'fn-other999'}],
        },
      })
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-other999', false))
      .respond({status: 200, body: {ok: true}})

    await getClient().functions.invoke('my-func', {stackId: OTHER_STACK_ID})

    expect(mock).toHaveReceivedRequest('POST', invokeUri('fn-other999', false))
    // The stack from the client config is never consulted.
    expect(mock).toHaveReceivedRequestTimes('GET', stackUri(STACK_ID), 0)
  })

  test('rejects when no stackId is configured or passed', async () => {
    await expect(getClient({}).functions.invoke('my-func')).rejects.toThrow('requires a `stackId`')
  })

  test('rejects rather than throwing when projectId is missing', async () => {
    const client = createClient({
      apiVersion: API_VERSION,
      useProjectHostname: false,
      stackId: STACK_ID,
    })

    await expect(client.functions.invoke('my-func')).rejects.toThrow('requires a `projectId`')
  })

  test('does not require a dataset', async () => {
    // Functions are project-scoped: the routes carry no dataset segment and the
    // scope headers name only the project, so a dataset-less client must work.
    const mock = getActiveMock()
    mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-abc123'))
      .respond({status: 200, body: {ok: true}})

    const client = createClient({
      projectId: PROJECT_ID,
      apiVersion: API_VERSION,
      useCdn: false,
      token: 'my-token',
      stackId: STACK_ID,
    })

    await expect(client.functions.invoke('my-func')).resolves.toEqual({ok: true})
  })

  test('sends the project scope headers the services require', async () => {
    const scopeHeaders = {'X-Sanity-Scope-Type': 'project', 'X-Sanity-Scope-Id': PROJECT_ID}
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('GET', stackUri(STACK_ID), {headers: scopeHeaders})
      .respond({status: 200, body: STACK})
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-abc123'), {headers: scopeHeaders})
      .respond({status: 200, body: {ok: true}})

    await getClient().functions.invoke('my-func')

    expect(mock).toHaveReceivedRequest('POST', invokeUri('fn-abc123'), {
      headers: scopeHeaders,
    })
  })

  test('scopes to the organization when `organizationId` is configured', async () => {
    const orgHeaders = {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': ORG_ID}
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('GET', stackUri(STACK_ID), {headers: orgHeaders})
      .respond({status: 200, body: STACK})
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-abc123'), {headers: orgHeaders})
      .respond({status: 200, body: {ok: true}})

    const client = createClient({
      projectId: PROJECT_ID,
      apiVersion: API_VERSION,
      useCdn: false,
      token: 'my-token',
      stackId: STACK_ID,
      organizationId: ORG_ID,
    })

    await expect(client.functions.invoke('my-func')).resolves.toEqual({ok: true})
    // Organization scope wins over the configured project.
    expect(mock).toHaveReceivedRequest('GET', stackUri(STACK_ID), {
      headers: {'X-Sanity-Scope-Type': 'organization'},
    })
  })

  test('a per-call organizationId overrides the client config', async () => {
    const orgHeaders = {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': OTHER_ORG_ID}
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('GET', stackUri(STACK_ID), {headers: orgHeaders})
      .respond({status: 200, body: STACK})
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-abc123'), {headers: orgHeaders})
      .respond({status: 200, body: {ok: true}})

    const client = createClient({
      projectId: PROJECT_ID,
      apiVersion: API_VERSION,
      useCdn: false,
      token: 'my-token',
      stackId: STACK_ID,
      organizationId: ORG_ID,
    })

    await expect(
      client.functions.invoke('my-func', {organizationId: OTHER_ORG_ID}),
    ).resolves.toEqual({ok: true})
  })

  test('organization scope does not require a projectId', async () => {
    const orgHeaders = {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': ORG_ID}
    const mock = getActiveMock()
    const globalHost = 'https://api.sanity.io'
    mock
      .scope(globalHost)
      .on('GET', stackUri(STACK_ID), {headers: orgHeaders})
      .respond({status: 200, body: STACK})
    mock
      .scope(globalHost)
      .on('POST', invokeUri('fn-abc123'), {headers: orgHeaders})
      .respond({status: 200, body: {ok: true}})

    const client = createClient({
      apiVersion: API_VERSION,
      useProjectHostname: false,
      useCdn: false,
      token: 'my-token',
      stackId: STACK_ID,
      organizationId: ORG_ID,
    })

    await expect(client.functions.invoke('my-func')).resolves.toEqual({ok: true})
  })

  test('defaults the payload to an empty object when no event is given', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-abc123'), {body: {event: {data: {}}}})
      .respond({status: 200, body: {ok: true}})

    await getClient().functions.invoke('my-func')

    expect(mock).toHaveReceivedRequest('POST', invokeUri('fn-abc123'))
  })

  test('resolves to undefined when the function returns nothing (204)', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
    mock.scope(HOST).on('POST', invokeUri('fn-abc123')).respond({status: 204})

    await expect(getClient().functions.invoke('my-func')).resolves.toBeUndefined()
  })

  test('surfaces a function error as a rejection', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-abc123'))
      .respond({status: 500, body: {error: {description: 'Function invoke failed!'}}})

    await expect(getClient().functions.invoke('my-func')).rejects.toThrow()
  })

  test('does not invoke when the stack request fails', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('GET', stackUri(STACK_ID))
      .respond({status: 404, body: {error: {description: 'Stack not found'}}})

    await expect(getClient().functions.invoke('my-func')).rejects.toThrow()
    expect(mock).toHaveReceivedRequestTimes('POST', invokeUri('fn-abc123'), 0)
  })

  test('is available on the observable client', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('GET', stackUri(STACK_ID)).respond({status: 200, body: STACK})
    mock
      .scope(HOST)
      .on('POST', invokeUri('fn-abc123'))
      .respond({status: 200, body: {ok: true}})

    const results: unknown[] = []
    await new Promise<void>((resolve, reject) => {
      getClient()
        .observable.functions.invoke('my-func')
        .subscribe({
          next: (value) => results.push(value),
          error: reject,
          complete: resolve,
        })
    })

    expect(results).toEqual([{ok: true}])
  })
})
