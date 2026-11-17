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

// The route is async by default, so only a sync invoke carries `sync=true`.
const invokeUri = (functionName: string, stackId = STACK_ID, sync = false) =>
  `${BASE}/functions/${functionName}/invoke?blueprintStackId=${stackId}${sync ? '&sync=true' : ''}`

const FUNCTION_NAME = 'my-function'

describe('client.functions.invoke', () => {
  test('posts the event payload to the function within the stack', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME), {body: {event: {data: {hello: 'world'}}}})
      .respond({status: 202})

    const result = await getClient().functions.invoke(FUNCTION_NAME, {
      event: {data: {hello: 'world'}},
    })

    expect(result).toBeUndefined()
    expect(mock).toHaveReceivedRequest('POST', invokeUri(FUNCTION_NAME))
  })

  test('leaves `sync` off the wire when async is requested explicitly', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('POST', invokeUri(FUNCTION_NAME)).respond({status: 202})

    await getClient().functions.invoke(FUNCTION_NAME, undefined, {sync: false})

    expect(mock).toHaveReceivedRequest('POST', invokeUri(FUNCTION_NAME))
  })

  test('adds `sync=true` and resolves with the return value', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME, STACK_ID, true), {
        body: {event: {data: {hello: 'world'}}},
      })
      .respond({status: 200, body: {ok: true}})

    const result = await getClient().functions.invoke(
      FUNCTION_NAME,
      {event: {data: {hello: 'world'}}},
      {sync: true},
    )

    expect(result).toEqual({ok: true})
    expect(mock).toHaveReceivedRequest('POST', invokeUri(FUNCTION_NAME, STACK_ID, true))
  })

  test('does not call the blueprints service', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('POST', invokeUri(FUNCTION_NAME)).respond({status: 202})

    await getClient().functions.invoke(FUNCTION_NAME)

    expect(mock).toHaveReceivedRequestTimes('GET', `${BASE}/blueprints/stacks/${STACK_ID}`, 0)
  })

  test('a per-call stackId overrides the client config', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('POST', invokeUri(FUNCTION_NAME, OTHER_STACK_ID)).respond({status: 202})

    await getClient().functions.invoke(FUNCTION_NAME, {stackId: OTHER_STACK_ID})

    expect(mock).toHaveReceivedRequest('POST', invokeUri(FUNCTION_NAME, OTHER_STACK_ID))
    expect(mock).toHaveReceivedRequestTimes('POST', invokeUri(FUNCTION_NAME, STACK_ID), 0)
  })

  test('rejects when no stackId is configured or passed', async () => {
    await expect(getClient({}).functions.invoke(FUNCTION_NAME)).rejects.toThrow(
      'requires a `stackId`',
    )
  })

  test('rejects rather than throwing when projectId is missing', async () => {
    const client = createClient({
      apiVersion: API_VERSION,
      useProjectHostname: false,
      stackId: STACK_ID,
    })

    await expect(client.functions.invoke(FUNCTION_NAME)).rejects.toThrow('requires a `projectId`')
  })

  test('does not require a dataset', async () => {
    // Functions are project-scoped: the routes carry no dataset segment and the
    // scope headers name only the project, so a dataset-less client must work.
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME))
      .respond({status: 200, body: {ok: true}})

    const client = createClient({
      projectId: PROJECT_ID,
      apiVersion: API_VERSION,
      useCdn: false,
      token: 'my-token',
      stackId: STACK_ID,
    })

    await expect(client.functions.invoke(FUNCTION_NAME)).resolves.toEqual({ok: true})
  })

  test('sends the project scope headers the services require', async () => {
    const scopeHeaders = {'X-Sanity-Scope-Type': 'project', 'X-Sanity-Scope-Id': PROJECT_ID}
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME), {headers: scopeHeaders})
      .respond({status: 200, body: {ok: true}})

    await getClient().functions.invoke(FUNCTION_NAME)

    expect(mock).toHaveReceivedRequest('POST', invokeUri(FUNCTION_NAME), {headers: scopeHeaders})
  })

  test('scopes to the organization when `organizationId` is configured', async () => {
    const orgHeaders = {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': ORG_ID}
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME), {headers: orgHeaders})
      .respond({status: 200, body: {ok: true}})

    const client = createClient({
      projectId: PROJECT_ID,
      apiVersion: API_VERSION,
      useCdn: false,
      token: 'my-token',
      stackId: STACK_ID,
      organizationId: ORG_ID,
    })

    // Organization scope wins over the configured project.
    await expect(client.functions.invoke(FUNCTION_NAME)).resolves.toEqual({ok: true})
  })

  test('a per-call organizationId overrides the client config', async () => {
    const orgHeaders = {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': OTHER_ORG_ID}
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME), {headers: orgHeaders})
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
      client.functions.invoke(FUNCTION_NAME, {organizationId: OTHER_ORG_ID}),
    ).resolves.toEqual({ok: true})
  })

  test('organization scope does not require a projectId', async () => {
    const orgHeaders = {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': ORG_ID}
    const mock = getActiveMock()
    mock
      .scope('https://api.sanity.io')
      .on('POST', invokeUri(FUNCTION_NAME), {headers: orgHeaders})
      .respond({status: 200, body: {ok: true}})

    const client = createClient({
      apiVersion: API_VERSION,
      useProjectHostname: false,
      useCdn: false,
      token: 'my-token',
      stackId: STACK_ID,
      organizationId: ORG_ID,
    })

    await expect(client.functions.invoke(FUNCTION_NAME)).resolves.toEqual({ok: true})
  })

  test('defaults the payload to an empty object when no event is given', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME), {body: {event: {data: {}}}})
      .respond({status: 200, body: {ok: true}})

    await getClient().functions.invoke(FUNCTION_NAME)

    expect(mock).toHaveReceivedRequest('POST', invokeUri(FUNCTION_NAME))
  })

  test('resolves to undefined when the function returns nothing (204)', async () => {
    getActiveMock().scope(HOST).on('POST', invokeUri(FUNCTION_NAME)).respond({status: 204})

    await expect(getClient().functions.invoke(FUNCTION_NAME)).resolves.toBeUndefined()
  })

  test('surfaces a function error as a rejection', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME))
      .respond({status: 500, body: {error: {description: 'Function invoke failed!'}}})

    await expect(getClient().functions.invoke(FUNCTION_NAME)).rejects.toThrow()
  })

  test('is available on the observable client', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', invokeUri(FUNCTION_NAME))
      .respond({status: 200, body: {ok: true}})

    const results: unknown[] = []
    await new Promise<void>((resolve, reject) => {
      getClient()
        .observable.functions.invoke(FUNCTION_NAME)
        .subscribe({
          next: (value) => results.push(value),
          error: reject,
          complete: resolve,
        })
    })

    expect(results).toEqual([{ok: true}])
  })
})
