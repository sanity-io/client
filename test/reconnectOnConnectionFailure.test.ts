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

  test('rethrows errors that are not connection failures', async () => {
    const error = new Error('unrelated')
    await expect(firstEmission(error)).resolves.toBe(error)
  })
})
