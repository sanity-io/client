import {
  catchError,
  concat,
  defer,
  mergeMap,
  Observable,
  of,
  type OperatorFunction,
  tap,
  throwError,
  timer,
} from 'rxjs'

import {ConnectionFailedError} from './eventsource'

const RETRYABLE_STATUSES = new Set([408, 429])

const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30_000

/**
 * Note: connection failure is not the same as network disconnect which may happen more frequent.
 * The EventSource instance will automatically reconnect in case of a network disconnect, however,
 * in some rare cases a ConnectionFailed Error will be thrown and this operator explicitly retries these
 *
 * Retries use exponential backoff (1s, 2s, 4s, … capped at 30s) so that a server that keeps
 * rejecting the connection isn't hammered at a constant, tight cadence. The backoff resets once
 * the connection recovers and delivers an event.
 */
export function reconnectOnConnectionFailure<T>(): OperatorFunction<T, T | {type: 'reconnect'}> {
  return function (source: Observable<T>) {
    // `defer` scopes the failure count per subscription, not per operator instance.
    return defer(() => {
      let consecutiveFailures = 0
      return source.pipe(
        tap((event) => {
          // Any real event means the connection recovered — reset the backoff. Emitted
          // `reconnect` values are the failures being counted, so they don't reset it.
          if ((event as {type?: unknown} | null)?.type !== 'reconnect') {
            consecutiveFailures = 0
          }
        }),
        catchError((err, caught) => {
          // Only reconnect on transient connection failures. A 4xx response is a
          // rejection, not a transient failure — the server will keep rejecting
          // (eg an expired token), so reconnecting would loop forever. The named
          // exceptions are the explicitly transient 4xx statuses: 408 (request
          // timeout) and 429 (rate limited). Anything else surfaces to the
          // consumer instead.
          if (
            err instanceof ConnectionFailedError &&
            (typeof err.status !== 'number' ||
              err.status < 400 ||
              err.status >= 500 ||
              RETRYABLE_STATUSES.has(err.status))
          ) {
            consecutiveFailures++
            const delay = Math.min(
              INITIAL_RECONNECT_DELAY * 2 ** (consecutiveFailures - 1),
              MAX_RECONNECT_DELAY,
            )
            return concat(
              of({type: 'reconnect' as const}),
              timer(delay).pipe(mergeMap(() => caught)),
            )
          }
          return throwError(() => err)
        }),
      )
    })
  }
}
