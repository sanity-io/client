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

/**
 * Note: connection failure is not the same as network disconnect which may happen more frequent.
 * The EventSource instance will automatically reconnect in case of a network disconnect, however,
 * in some rare cases a ConnectionFailed Error will be thrown and this operator explicitly retries these
 */
export function reconnectOnConnectionFailure<T>(): OperatorFunction<T, T | {type: 'reconnect'}> {
  return function (source: Observable<T>) {
    return source.pipe(
      catchError((err, caught) => {
        if (err instanceof ConnectionFailedError) {
          return concat(of({type: 'reconnect' as const}), timer(1000).pipe(mergeMap(() => caught)))
        }
        return throwError(() => err)
      }),
    )
  }
}
