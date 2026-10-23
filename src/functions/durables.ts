import {defer, map, type Observable} from 'rxjs'

import {_requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest} from '../types'

/** @public */
export interface DurableCallbackFailure {
  /** A human-readable error message. */
  errorMessage?: string
  /** Machine-readable error data. */
  errorData?: string
  /** Stack trace, one frame per entry. */
  stackTrace?: string[]
}

/** @public */
export interface DurableCallbackRequestOptions {
  /** Milliseconds to wait for the callback to be accepted. */
  timeout?: number
  /** Abort the request. */
  signal?: AbortSignal
}

type Client = SanityClient | ObservableSanityClient

/**
 * An `Error` is reported by its message and stack
 * @internal
 */
export function _toCallbackFailure(
  failure: Error | DurableCallbackFailure,
): DurableCallbackFailure {
  if (!(failure instanceof Error)) {
    return failure
  }

  return {
    errorMessage: failure.message,
    ...(failure.stack ? {stackTrace: failure.stack.split('\n')} : {}),
  }
}

/** @internal */
export function _callback(
  client: Client,
  httpRequest: HttpRequest,
  callbackId: string,
  outcome: 'success' | 'failure',
  body: unknown,
  options?: DurableCallbackRequestOptions,
): Observable<void> {
  return defer(() =>
    _requestObservable<unknown>(client, httpRequest, {
      method: 'POST',
      // Callback ids are base64 and may contain `/`, `+` and `=` - must encode
      url: `/functions/durables/callback/${encodeURIComponent(callbackId)}/${outcome}`,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body ?? null),
      timeout: options?.timeout,
      signal: options?.signal,
    }).pipe(map((): void => undefined)),
  )
}
