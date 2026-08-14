import {lastValueFrom, type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest} from '../types'
import {_invoke, type InvokeFunctionRequest} from './invoke'

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
   * the client config. Passes the function's return value once it finishes.
   *
   * @param functionName - name of the function, as declared in the blueprint
   * @param request - payload and request options
   */
  invoke<R = unknown>(
    functionName: string,
    request?: InvokeFunctionRequest,
  ): Observable<R | undefined> {
    return _invoke<R>(this.#client, this.#httpRequest, functionName, request)
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
   * stack has no function by that name, or if the name resolves to anything
   * other than a `sanity.function.pubsub` function.
   *
   * The lookup is scoped to `projectId`, or to `organizationId` when one is set
   * for a stack deployed at organization scope.
   *
   * The request stays open until the function finishes, and resolves with its
   * return value, or `undefined` if it returns nothing. Long-running functions
   * may need an explicit `timeout`.
   *
   * @param functionName - name of the function, as declared in the blueprint
   * @param request - payload and request options
   */
  invoke<R = unknown>(
    functionName: string,
    request?: InvokeFunctionRequest,
  ): Promise<R | undefined> {
    return lastValueFrom(_invoke<R>(this.#client, this.#httpRequest, functionName, request))
  }
}
