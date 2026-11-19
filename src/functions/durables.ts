import {defer, map, type Observable} from 'rxjs'

import {_requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest} from '../types'
import {_scopeHeaders} from './scope'

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

/** @public */
export interface DurableExecution {
  /** ID of the execution. */
  executionId: string
  /** When the stop was recorded, as reported by the API. */
  stopTimestamp: number
}

/** @public */
export interface DurableStopExecutionOptions extends DurableCallbackRequestOptions {
  /**
   * Organization owning the stack.
   * Overrides `organizationId` from the client config.
   */
  organizationId?: string
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDurableExecution(value: unknown): value is DurableExecution {
  return (
    isRecord(value) &&
    typeof value.executionId === 'string' &&
    typeof value.stopTimestamp === 'number'
  )
}

/** @internal */
export function _stopExecution(
  client: Client,
  httpRequest: HttpRequest,
  functionId: string,
  executionId: string,
  options?: DurableStopExecutionOptions,
): Observable<DurableExecution> {
  return defer(() => {
    const headers = _scopeHeaders(client.config(), options?.organizationId)
    return _requestObservable<unknown>(client, httpRequest, {
      method: 'POST',
      // Execution ids contain `/` - each id must be encoded as a single path segment
      url: `/functions/durables/${encodeURIComponent(functionId)}/executions/${encodeURIComponent(executionId)}/stop`,
      headers,
      timeout: options?.timeout,
      signal: options?.signal,
    }).pipe(
      map((body): DurableExecution => {
        if (isRecord(body) && isDurableExecution(body.execution)) {
          return body.execution
        }
        throw new Error('Expected the stopped execution in the response')
      }),
    )
  })
}
