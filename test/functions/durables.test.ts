import {createClient as createCoreClient} from '@sanity/client'
import {lastValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock, testResolveFetch} from '../helpers/mockFetch'

const PROJECT_ID = 'test123'
const HOST = `https://${PROJECT_ID}.api.sanity.io`
const API_VERSION = '2025-02-19'
const BASE = `/v${API_VERSION}`
// these can contain base64 so might get fked if you pop em in the url
const CALLBACK_ID = 'YXJuOmF3czpsYW1iZGE+/dXMtZWFzdC0x+Zm9v/YmFy=='

const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

const getClient = () =>
  createClient({projectId: PROJECT_ID, apiVersion: API_VERSION, useCdn: false})

const callbackUri = (callbackId: string, outcome: 'success' | 'failure') =>
  `${BASE}/functions/durables/callback/${encodeURIComponent(callbackId)}/${outcome}`

describe('client.functions.durables.callbackSuccess', () => {
  test('encodes the callback id into a single path segment', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('POST', callbackUri(CALLBACK_ID, 'success')).respond({status: 200})

    await getClient().functions.durables.callbackSuccess(CALLBACK_ID, {approved: true})

    const [request] = mock.getRequests()
    expect(request.fullUrl).toBe(`${HOST}${callbackUri(CALLBACK_ID, 'success')}`)
  })

  test('posts the result as the JSON body and resolves with undefined', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', callbackUri(CALLBACK_ID, 'success'), {body: {approved: true}})
      .respond({status: 200})

    const result = await getClient().functions.durables.callbackSuccess(CALLBACK_ID, {
      approved: true,
    })

    expect(result).toBeUndefined()
    expect(mock).toHaveReceivedRequest('POST', callbackUri(CALLBACK_ID, 'success'))
  })

  // The transport sends strings verbatim and rejects numbers and booleans, so
  // each of these only arrives as JSON because the client encodes it.
  const values: [label: string, value: unknown, wire: string][] = [
    ['a string', 'approved', '"approved"'],
    ['a number', 42, '42'],
    ['a boolean', false, 'false'],
    ['null', null, 'null'],
    ['no result', undefined, 'null'],
  ]
  for (const [label, value, wire] of values) {
    test(`sends ${label} as a JSON value`, async () => {
      const mock = getActiveMock()
      mock.scope(HOST).on('POST', callbackUri(CALLBACK_ID, 'success')).respond({status: 200})

      await getClient().functions.durables.callbackSuccess(CALLBACK_ID, value)

      const [request] = mock.getRequests()
      expect(request.headers.get('content-type')).toBe('application/json')
      expect(JSON.stringify(request.body)).toBe(wire)
    })
  }

  test('needs no project, dataset, token or stack', async () => {
    const mock = getActiveMock()
    mock
      .scope('https://api.sanity.io')
      .on('POST', callbackUri(CALLBACK_ID, 'success'))
      .respond({status: 200})

    await createClient({
      useProjectHostname: false,
      apiVersion: API_VERSION,
      useCdn: false,
    }).functions.durables.callbackSuccess(CALLBACK_ID, {})

    expect(mock).toHaveReceivedRequest('POST', callbackUri(CALLBACK_ID, 'success'))
  })

  test('rejects when the callback is unknown', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', callbackUri(CALLBACK_ID, 'success'))
      .respond({status: 404, body: {error: 'NOT_FOUND', message: 'Callback not found'}})

    await expect(
      getClient().functions.durables.callbackSuccess(CALLBACK_ID, {}),
    ).rejects.toMatchObject({statusCode: 404})
  })

  test('the observable client emits undefined and completes', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', callbackUri(CALLBACK_ID, 'success'))
      .respond({status: 200})

    const result = await lastValueFrom(
      getClient().observable.functions.durables.callbackSuccess(CALLBACK_ID, {ok: true}),
    )

    expect(result).toBeUndefined()
  })
})

describe('client.functions.durables.callbackFailure', () => {
  test('posts the failure fields as given', async () => {
    const mock = getActiveMock()
    const failure = {
      errorMessage: 'rejected',
      errorData: '{"reason":"budget"}',
      stackTrace: ['at approve (approvals.ts:1:1)'],
    }
    mock
      .scope(HOST)
      .on('POST', callbackUri(CALLBACK_ID, 'failure'), {body: failure})
      .respond({status: 200})

    const result = await getClient().functions.durables.callbackFailure(CALLBACK_ID, failure)

    expect(result).toBeUndefined()
    expect(mock).toHaveReceivedRequest('POST', callbackUri(CALLBACK_ID, 'failure'))
  })

  test('reports an Error by its message and stack frames', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('POST', callbackUri(CALLBACK_ID, 'failure')).respond({status: 200})
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at approve (approvals.ts:1:1)'

    await getClient().functions.durables.callbackFailure(CALLBACK_ID, error)

    const [request] = mock.getRequests()
    expect(request.body).toEqual({
      errorMessage: 'boom',
      stackTrace: ['Error: boom', '    at approve (approvals.ts:1:1)'],
    })
  })

  test('reports an Error without a stack by its message alone', async () => {
    const mock = getActiveMock()
    mock.scope(HOST).on('POST', callbackUri(CALLBACK_ID, 'failure')).respond({status: 200})
    const error = new Error('boom')
    error.stack = undefined

    await getClient().functions.durables.callbackFailure(CALLBACK_ID, error)

    const [request] = mock.getRequests()
    expect(request.body).toEqual({errorMessage: 'boom'})
  })

  test('posts an empty failure when given nothing', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', callbackUri(CALLBACK_ID, 'failure'), {body: {}})
      .respond({status: 200})

    await getClient().functions.durables.callbackFailure(CALLBACK_ID)

    expect(mock).toHaveReceivedRequest('POST', callbackUri(CALLBACK_ID, 'failure'))
  })

  test('the observable client emits undefined and completes', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', callbackUri(CALLBACK_ID, 'failure'))
      .respond({status: 200})

    const result = await lastValueFrom(
      getClient().observable.functions.durables.callbackFailure(CALLBACK_ID, new Error('boom')),
    )

    expect(result).toBeUndefined()
  })
})

const FUNCTION_ID = 'abcd123456'
const EXECUTION_ID = '1/durable-execution/my-function/721704c1-73ae-3004-95fa-f472e130fb15'
const STOP_TIMESTAMP = 1763500000000
const ORG_ID = 'oOrG12345'
const OTHER_ORG_ID = 'oOtHeR9999'
const PROJECT_HEADERS = {'X-Sanity-Scope-Type': 'project', 'X-Sanity-Scope-Id': PROJECT_ID}
const ORG_HEADERS = {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': ORG_ID}

const stopUri = (functionId: string, executionId: string) =>
  `${BASE}/functions/durables/${functionId}/executions/${encodeURIComponent(executionId)}/stop`

const stoppedBody = {execution: {executionId: EXECUTION_ID, stopTimestamp: STOP_TIMESTAMP}}

describe('client.functions.durables.stopExecution', () => {
  test('encodes the function and execution ids into single path segments', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', stopUri(FUNCTION_ID, EXECUTION_ID))
      .respond({status: 202, body: stoppedBody})

    await getClient().functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID)

    const [request] = mock.getRequests()
    expect(request.fullUrl).toBe(`${HOST}${stopUri(FUNCTION_ID, EXECUTION_ID)}`)
    expect(request.fullUrl).toContain('%2Fdurable-execution%2F')
  })

  test('resolves with the stopped execution, including its stopTimestamp', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', stopUri(FUNCTION_ID, EXECUTION_ID))
      .respond({status: 202, body: stoppedBody})

    const result = await getClient().functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID)

    expect(result).toEqual({executionId: EXECUTION_ID, stopTimestamp: STOP_TIMESTAMP})
  })

  test('sends the project scope headers by default', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', stopUri(FUNCTION_ID, EXECUTION_ID), {headers: PROJECT_HEADERS})
      .respond({status: 202, body: stoppedBody})

    await getClient().functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID)

    expect(mock).toHaveReceivedRequest('POST', stopUri(FUNCTION_ID, EXECUTION_ID), {
      headers: PROJECT_HEADERS,
    })
  })

  test('scopes to the organization when `organizationId` is configured', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', stopUri(FUNCTION_ID, EXECUTION_ID), {headers: ORG_HEADERS})
      .respond({status: 202, body: stoppedBody})

    const client = createClient({
      projectId: PROJECT_ID,
      apiVersion: API_VERSION,
      useCdn: false,
      organizationId: ORG_ID,
    })

    await client.functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID)

    expect(mock).toHaveReceivedRequest('POST', stopUri(FUNCTION_ID, EXECUTION_ID), {
      headers: ORG_HEADERS,
    })
  })

  test('a per-call organizationId overrides the client config', async () => {
    const mock = getActiveMock()
    mock
      .scope(HOST)
      .on('POST', stopUri(FUNCTION_ID, EXECUTION_ID), {
        headers: {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': OTHER_ORG_ID},
      })
      .respond({status: 202, body: stoppedBody})

    const client = createClient({
      projectId: PROJECT_ID,
      apiVersion: API_VERSION,
      useCdn: false,
      organizationId: ORG_ID,
    })

    await client.functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID, {
      organizationId: OTHER_ORG_ID,
    })

    expect(mock).toHaveReceivedRequest('POST', stopUri(FUNCTION_ID, EXECUTION_ID), {
      headers: {'X-Sanity-Scope-Type': 'organization', 'X-Sanity-Scope-Id': OTHER_ORG_ID},
    })
  })

  test('rejects rather than throwing when projectId is missing', async () => {
    const client = createClient({apiVersion: API_VERSION, useProjectHostname: false})

    await expect(
      client.functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID),
    ).rejects.toThrow('requires a `projectId`')
  })

  test('rejects when the response carries no stopped execution', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', stopUri(FUNCTION_ID, EXECUTION_ID))
      .respond({status: 202, body: {}})

    await expect(
      getClient().functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID),
    ).rejects.toThrow('Expected the stopped execution in the response')
  })

  test('rejects when the execution is not found', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', stopUri(FUNCTION_ID, EXECUTION_ID))
      .respond({status: 404, body: {error: 'NOT_FOUND', message: 'Execution not found'}})

    await expect(
      getClient().functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID),
    ).rejects.toMatchObject({statusCode: 404})
  })

  test('the observable client emits the stopped execution and completes', async () => {
    getActiveMock()
      .scope(HOST)
      .on('POST', stopUri(FUNCTION_ID, EXECUTION_ID))
      .respond({status: 202, body: stoppedBody})

    const result = await lastValueFrom(
      getClient().observable.functions.durables.stopExecution(FUNCTION_ID, EXECUTION_ID),
    )

    expect(result).toEqual({executionId: EXECUTION_ID, stopTimestamp: STOP_TIMESTAMP})
  })
})
