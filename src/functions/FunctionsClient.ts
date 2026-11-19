import {lastValueFrom, type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest} from '../types'
import {
  _callback,
  _stopExecution,
  _toCallbackFailure,
  type DurableCallbackFailure,
  type DurableCallbackRequestOptions,
  type DurableExecution,
  type DurableStopExecutionOptions,
} from './durables'
import {_invoke, type InvokeFunctionOptions, type InvokeFunctionRequest} from './invoke'

/** @public */
export class ObservableDurablesClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Resume a durable function waiting on a callback, handing it a result.
   *
   * Emits `undefined` once the callback is accepted.
   *
   * @param callbackId - the id the function handed out from `step.waitForCallback`
   * @param result - JSON-serializable value the waiting step resolves with
   * @param options - request options
   */
  callbackSuccess(
    callbackId: string,
    result?: unknown,
    options?: DurableCallbackRequestOptions,
  ): Observable<void> {
    return _callback(this.#client, this.#httpRequest, callbackId, 'success', result, options)
  }

  /**
   * Resume a durable function waiting on a callback, failing the waiting step.
   *
   * Emits `undefined` once the callback is accepted.
   *
   * @param callbackId - the id the function handed out from `step.waitForCallback`
   * @param failure - an `Error`, reported by its message and stack, or the failure fields
   * @param options - request options
   */
  callbackFailure(
    callbackId: string,
    failure: Error | DurableCallbackFailure = {},
    options?: DurableCallbackRequestOptions,
  ): Observable<void> {
    return _callback(
      this.#client,
      this.#httpRequest,
      callbackId,
      'failure',
      _toCallbackFailure(failure),
      options,
    )
  }

  /**
   * Stop a durable function execution.
   *
   * Emits the stopped execution, including its `stopTimestamp`, once the stop is accepted.
   *
   * @param functionId - ID of the durable function
   * @param executionId - ID of the execution to stop
   * @param options - request options
   */
  stopExecution(
    functionId: string,
    executionId: string,
    options?: DurableStopExecutionOptions,
  ): Observable<DurableExecution> {
    return _stopExecution(this.#client, this.#httpRequest, functionId, executionId, options)
  }
}

/** @public */
export class DurablesClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Resume a durable function waiting on a callback, handing it a result.
   *
   * The waiting `step.waitForCallback` resolves with `result`, which must be
   * JSON-serializable. Omitting it resolves the step with `null`. The callback
   * id is the only credential the route needs.
   *
   * Resolves with `undefined` once the callback is accepted.
   *
   * @param callbackId - the id the function handed out from `step.waitForCallback`
   * @param result - JSON-serializable value the waiting step resolves with
   * @param options - request options
   */
  callbackSuccess(
    callbackId: string,
    result?: unknown,
    options?: DurableCallbackRequestOptions,
  ): Promise<void> {
    return lastValueFrom(
      _callback(this.#client, this.#httpRequest, callbackId, 'success', result, options),
    )
  }

  /**
   * Resume a durable function waiting on a callback, failing the waiting step.
   *
   * The waiting `step.waitForCallback` rejects. Pass an `Error` to report its
   * message and stack, or the failure fields directly. `errorData` must be a
   * string; serialize structured data before passing it.
   *
   * Resolves with `undefined` once the callback is accepted.
   *
   * @param callbackId - the id the function handed out from `step.waitForCallback`
   * @param failure - an `Error`, reported by its message and stack, or the failure fields
   * @param options - request options
   */
  callbackFailure(
    callbackId: string,
    failure: Error | DurableCallbackFailure = {},
    options?: DurableCallbackRequestOptions,
  ): Promise<void> {
    return lastValueFrom(
      _callback(
        this.#client,
        this.#httpRequest,
        callbackId,
        'failure',
        _toCallbackFailure(failure),
        options,
      ),
    )
  }

  /**
   * Stop a durable function execution.
   *
   * Resolves with the stopped execution, including its `stopTimestamp`, once the stop is accepted.
   *
   * @param functionId - ID of the durable function
   * @param executionId - ID of the execution to stop
   * @param options - request options
   */
  stopExecution(
    functionId: string,
    executionId: string,
    options?: DurableStopExecutionOptions,
  ): Promise<DurableExecution> {
    return lastValueFrom(
      _stopExecution(this.#client, this.#httpRequest, functionId, executionId, options),
    )
  }
}

/** @public */
export class ObservableFunctionsClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  /** Report back to durable functions. */
  durables: ObservableDurablesClient
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
    this.durables = new ObservableDurablesClient(client, httpRequest)
  }

  /**
   * Invoke a deployed function by its name and stackId.
   *
   * The function is invoked within the stack given by `stackId` on the request
   * or the client config. Starts the invocation and emits `undefined` as soon as
   * it is accepted; pass `{sync: true}` to wait for the function's return value
   * instead.
   *
   * @param functionName - name of the deployed function, as declared in the blueprint
   * @param request - payload and request options
   * @param options - invocation options
   */
  invoke(
    functionName: string,
    request?: InvokeFunctionRequest,
    options?: InvokeFunctionOptions & {sync?: false},
  ): Observable<undefined>
  invoke<R = unknown>(
    functionName: string,
    request: InvokeFunctionRequest | undefined,
    options: InvokeFunctionOptions & {sync: true},
  ): Observable<R>
  invoke<R = unknown>(
    functionName: string,
    request?: InvokeFunctionRequest,
    options?: InvokeFunctionOptions,
  ): Observable<R | undefined>
  // Implementation signature — not part of the public API.
  invoke<R = unknown>(
    functionName: string,
    request?: InvokeFunctionRequest,
    options?: InvokeFunctionOptions,
  ): Observable<R | undefined> {
    return _invoke<R>(this.#client, this.#httpRequest, functionName, request, options)
  }
}

/** @public */
export class FunctionsClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  /** Report back to durable functions. */
  durables: DurablesClient
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
    this.durables = new DurablesClient(client, httpRequest)
  }

  /**
   * Invoke a deployed function by its name and stack ID.
   *
   * The function is invoked within the stack given by `stackId` on the request
   * or the client config. Rejects if neither supplies one.
   *
   * The call is scoped to `projectId`, or to `organizationId` when one is set
   * for a stack deployed at organization scope.
   *
   * The invocation is started by default: the promise resolves with `undefined`
   * as soon as the call is accepted, without waiting for the function to run.
   * Pass `{sync: true}` to keep the request open until the function finishes
   * and resolve with its return value — long-running functions may then need an
   * explicit `timeout`. Only some function types can be invoked synchronously.
   *
   * @param functionName - name of the deployed function, as declared in the blueprint
   * @param request - payload and request options
   * @param options - invocation options
   */
  invoke(
    functionName: string,
    request?: InvokeFunctionRequest,
    options?: InvokeFunctionOptions & {sync?: false},
  ): Promise<undefined>
  invoke<R = unknown>(
    functionName: string,
    request: InvokeFunctionRequest | undefined,
    options: InvokeFunctionOptions & {sync: true},
  ): Promise<R>
  invoke<R = unknown>(
    functionName: string,
    request?: InvokeFunctionRequest,
    options?: InvokeFunctionOptions,
  ): Promise<R | undefined>
  // Implementation signature — not part of the public API.
  invoke<R = unknown>(
    functionName: string,
    request?: InvokeFunctionRequest,
    options?: InvokeFunctionOptions,
  ): Promise<R | undefined> {
    return lastValueFrom(
      _invoke<R>(this.#client, this.#httpRequest, functionName, request, options),
    )
  }
}
