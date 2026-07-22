import {catchError, concat, defer, firstValueFrom, of, throwError} from 'rxjs'
import {afterEach, beforeEach, describe, expect, test, vitest} from 'vitest'

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

  describe('backoff', () => {
    beforeEach(() => {
      vitest.useFakeTimers()
    })
    afterEach(() => {
      vitest.useRealTimers()
    })

    test('reconnects with exponential backoff instead of a constant cadence', () => {
      let attempts = 0
      const source = defer(() => {
        attempts++
        return throwError(() => new ConnectionFailedError('failed'))
      })

      const subscription = source.pipe(reconnectOnConnectionFailure()).subscribe({
        // Swallow emissions; this test only cares about the resubscription timing
        error: () => {},
      })

      // Subscribing consumes the first attempt right away
      expect(attempts).toBe(1)

      // 1s, 2s, 4s, 8s...
      vitest.advanceTimersByTime(1000)
      expect(attempts).toBe(2)
      vitest.advanceTimersByTime(1000)
      expect(attempts, 'second retry waits 2s, not 1s').toBe(2)
      vitest.advanceTimersByTime(1000)
      expect(attempts).toBe(3)
      vitest.advanceTimersByTime(4000)
      expect(attempts).toBe(4)

      // ...capped at 30s
      vitest.advanceTimersByTime(8000)
      expect(attempts).toBe(5)
      vitest.advanceTimersByTime(16_000)
      expect(attempts).toBe(6)
      vitest.advanceTimersByTime(30_000)
      expect(attempts).toBe(7)
      vitest.advanceTimersByTime(30_000)
      expect(attempts).toBe(8)

      subscription.unsubscribe()
    })

    test('an emitted event resets the backoff', () => {
      let attempts = 0
      const source = defer(() => {
        attempts++
        // The second attempt recovers and delivers an event before failing again
        return attempts === 2
          ? concat(
              of({type: 'welcome'}),
              throwError(() => new ConnectionFailedError('failed')),
            )
          : throwError(() => new ConnectionFailedError('failed'))
      })

      const subscription = source.pipe(reconnectOnConnectionFailure()).subscribe({
        error: () => {},
      })

      expect(attempts).toBe(1)
      // First retry after 1s: emits a welcome event (resetting the backoff), then fails again
      vitest.advanceTimersByTime(1000)
      expect(attempts).toBe(2)
      // The failure after the reset is treated as the first failure again: 1s, not 2s
      vitest.advanceTimersByTime(1000)
      expect(attempts).toBe(3)

      subscription.unsubscribe()
    })
  })
})
