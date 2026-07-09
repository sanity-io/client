import {
  catchError,
  concat,
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
 * Note: connection failure is not the same as network disconnect which may happen more frequent.
 * The EventSource instance will automatically reconnect in case of a network disconnect, however,
 * in some rare cases a ConnectionFailed Error will be thrown and this operator explicitly retries these
 */
export function reconnectOnConnectionFailure<T>(): OperatorFunction<T, T | {type: 'reconnect'}> {
  return function (source: Observable<T>) {
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
        return throwError(() => err)
      }),
    )
  }
}
