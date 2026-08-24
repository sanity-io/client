import {lastValueFrom, type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest} from '../types'
import {_invoke, type InvokeFunctionOptions, type InvokeFunctionRequest} from './invoke'

/** @public */
export class ObservableFunctionsClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Invoke a deployed function by its blueprint name.
   *
   * The name is resolved within the stack given by `stackId` on the request or
   * the client config. Starts the invocation and emits `undefined` as soon as
   * it is accepted; pass `{sync: true}` to wait for the function's return value
   * instead.
   *
   * @param functionName - name of the function, as declared in the blueprint
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
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Invoke a deployed function by its blueprint name.
   *
   * The name is resolved within the stack given by `stackId` on the request or
   * the client config, which costs one extra request per call. Rejects if the
   * stack has no function by that name, or if the name resolves to a function
   * type that cannot be invoked the way it was asked for.
   *
   * The lookup is scoped to `projectId`, or to `organizationId` when one is set
   * for a stack deployed at organization scope.
   *
   * The invocation is started by default: the promise resolves with `undefined`
   * as soon as the call is accepted, without waiting for the function to run.
   * Pass `{sync: true}` to keep the request open until the function finishes
   * and resolve with its return value — long-running functions may then need an
   * explicit `timeout`. Only `sanity.function.pubsub` functions can be invoked
   * synchronously.
   *
   * @param functionName - name of the function, as declared in the blueprint
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
