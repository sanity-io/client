import {type MonoTypeOperatorFunction, Observable} from 'rxjs'

/**
 * The rejection an aborted operation produces: the same `AbortError`
 * `DOMException` a `fetch` aborted through its `signal` rejects with, carrying
 * the signal's `reason` when one was given.
 */
function createAbortError(signal?: AbortSignal): DOMException {
  return new DOMException(signal?.reason ?? 'The operation was aborted.', 'AbortError')
}

/**
 * Errors the stream with an `AbortError` when `signal` aborts, and
 * unsubscribes from the source. An already-aborted signal errors immediately
 * without subscribing.
 *
 * @internal
 */
export function withAbortSignal<T>(signal: AbortSignal): MonoTypeOperatorFunction<T> {
  return (input) =>
    new Observable<T>((observer) => {
      const abort = () => observer.error(createAbortError(signal))

      if (signal.aborted) {
        abort()
        return
      }
      const subscription = input.subscribe(observer)
      signal.addEventListener('abort', abort)
      return () => {
        signal.removeEventListener('abort', abort)
        subscription.unsubscribe()
      }
    })
}
