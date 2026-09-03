import {
  catchError,
  concat,
  from,
  mergeMap,
  Observable,
  of,
  type OperatorFunction,
  throwError,
  timer,
} from 'rxjs'

import {ConnectionFailedError} from './eventsource'

const RETRYABLE_STATUSES = new Set([408, 429])

/**
 * Minimum spacing between 401-triggered auth refreshes. A refresh → reconnect
 * → 401 cycle completes within seconds, so a second 401 inside this window
 * means the server is rejecting freshly refreshed tokens — surface it rather
 * than rotate refresh tokens forever. A 401 after the window (a token that
 * expired hours into a healthy connection) gets its own refresh.
 */
const AUTH_RETRY_WINDOW = 30_000

/**
 * Note: connection failure is not the same as network disconnect which may happen more frequent.
 * The EventSource instance will automatically reconnect in case of a network disconnect, however,
 * in some rare cases a ConnectionFailed Error will be thrown and this operator explicitly retries these
 *
 * @param refreshAuth - When the connection authenticates via an OAuth token
 * setup, the setup's single-flight refresher. A connection rejected with a 401
 * then refreshes and reconnects once, mirroring the request handler's 401
 * semantics.
 */
export function reconnectOnConnectionFailure<T>(
  refreshAuth?: () => Promise<unknown>,
): OperatorFunction<T, T | {type: 'reconnect'}> {
  return function (source: Observable<T>) {
    let lastAuthRetryAt = -Infinity
    return source.pipe(
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
          return concat(of({type: 'reconnect' as const}), timer(1000).pipe(mergeMap(() => caught)))
        }
        if (
          refreshAuth &&
          err instanceof ConnectionFailedError &&
          err.status === 401 &&
          Date.now() - lastAuthRetryAt >= AUTH_RETRY_WINDOW
        ) {
          lastAuthRetryAt = Date.now()
          return concat(
            of({type: 'reconnect' as const}),
            from(refreshAuth()).pipe(
              // Surface the original connection error, not the refresh failure
              // — `onAuthError` has already fired inside the refresher. Placed
              // before `mergeMap` so it only catches the refresh promise, never
              // errors from the resubscribed stream.
              catchError(() => throwError(() => err)),
              mergeMap(() => caught),
            ),
          )
        }
        return throwError(() => err)
      }),
    )
  }
}
