import {catchError, firstValueFrom, of, throwError} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {ConnectionFailedError} from '../src/data/eventsource'
import {reconnectOnConnectionFailure} from '../src/data/reconnectOnConnectionFailure'

const failingSource = (error: unknown) =>
  throwError(() => error).pipe(reconnectOnConnectionFailure())

const firstEmission = (error: unknown) =>
  firstValueFrom(failingSource(error).pipe(catchError((err) => of(err))))

describe('reconnectOnConnectionFailure()', () => {
  test('reconnects when the failure has no status (native EventSource, network drop)', async () => {
    await expect(firstEmission(new ConnectionFailedError('failed'))).resolves.toEqual({
      type: 'reconnect',
    })
  })

  test('reconnects on a 5xx (transient server error)', async () => {
    await expect(
      firstEmission(new ConnectionFailedError('failed', {status: 503})),
    ).resolves.toEqual({type: 'reconnect'})
  })

  test('reconnects on 429 (rate limited — transient by definition)', async () => {
    await expect(
      firstEmission(new ConnectionFailedError('failed', {status: 429})),
    ).resolves.toEqual({type: 'reconnect'})
  })

  test('reconnects on 408 (request timeout — explicitly retryable)', async () => {
    await expect(
      firstEmission(new ConnectionFailedError('failed', {status: 408})),
    ).resolves.toEqual({type: 'reconnect'})
  })

  test('rethrows on a 401 (permanent rejection)', async () => {
    const error = new ConnectionFailedError('failed', {status: 401})
    await expect(firstEmission(error)).resolves.toBe(error)
  })

  test('rethrows on a 404 (permanent rejection)', async () => {
    const error = new ConnectionFailedError('failed', {status: 404})
    await expect(firstEmission(error)).resolves.toBe(error)
  })

  test('classifies by status alone, whether or not the rejected response was captured', async () => {
    // The attached response is informational: it must not change which
    // statuses are retried, and the rethrown error must be the same instance
    // so the response reaches the consumer intact.
    const response = (statusCode: number) => ({
      statusCode,
      statusMessage: null,
      headers: {},
      body: {error: 'Unauthorized', message: 'Session is expired', errorCode: 'SIO-401-AEX'},
      url: 'https://abc123.api.sanity.io/v1/data/listen/prod',
      method: 'GET',
    })
    const rejected = new ConnectionFailedError('Unauthorized - Session is expired', {
      status: 401,
      response: response(401),
    })
    await expect(firstEmission(rejected)).resolves.toBe(rejected)

    await expect(
      firstEmission(new ConnectionFailedError('failed', {status: 503, response: response(503)})),
    ).resolves.toEqual({type: 'reconnect'})
  })

  test('derives `status` from the response when only the response is given', () => {
    const error = new ConnectionFailedError('failed', {
      response: {
        statusCode: 401,
        statusMessage: null,
        headers: {},
        body: '',
        url: 'https://abc123.api.sanity.io/v1/data/listen/prod',
        method: 'GET',
      },
    })
    expect(error.status).toBe(401)
    expect(error.statusCode).toBe(401)
  })

  test('rethrows errors that are not connection failures', async () => {
    const error = new Error('unrelated')
    await expect(firstEmission(error)).resolves.toBe(error)
  })
})
