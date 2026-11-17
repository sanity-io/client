import {defer, type Observable} from 'rxjs'

import {_requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, InitializedClientConfig} from '../types'

/** @public */
export interface InvokeFunctionEvent {
  /**
   * Payload handed to the function.
   * The function receives it as `event.data`.
   */
  data?: unknown
}

/** @public */
export interface InvokeFunctionRequest {
  event?: InvokeFunctionEvent
  /**
   * Stack the function belongs to.
   * Overrides `stackId` from the client config.
   */
  stackId?: string
  /**
   * Organization owning the stack.
   */
  organizationId?: string
  /**
   * Milliseconds to wait for the function to return.
   */
  timeout?: number
  /** Abort the invocation. */
  signal?: AbortSignal
}

/** @public */
export interface InvokeFunctionOptions {
  /**
   * Wait for the function to finish and resolve with its return value.
   *
   * Defaults to `false`: the invocation is started, the request resolves as soon
   * as it is accepted, and the value is always `undefined`. Only function types
   * that support running inline can be invoked synchronously.
   */
  sync?: boolean
}

type Client = SanityClient | ObservableSanityClient

const scopeHeaders = (
  config: InitializedClientConfig,
  request: InvokeFunctionRequest | undefined,
): Record<string, string> => {
  const organizationId = request?.organizationId || config.organizationId
  if (organizationId) {
    return {
      'X-Sanity-Scope-Type': 'organization',
      'X-Sanity-Scope-Id': organizationId,
    }
  }

  const {projectId} = config
  if (!projectId) {
    throw new Error(
      '`functions.invoke()` requires a `projectId` to be set in the client config, or an ' +
        '`organizationId` for a stack deployed at organization scope',
    )
  }

  return {
    'X-Sanity-Scope-Type': 'project',
    'X-Sanity-Scope-Id': projectId,
  }
}

/**
 * A per-call `stackId` overrides the one in the client config.
 */
const resolveStackId = (
  config: InitializedClientConfig,
  request: InvokeFunctionRequest | undefined,
): string => {
  const stackId = request?.stackId || config.stackId
  if (!stackId) {
    throw new Error(
      '`functions.invoke()` requires a `stackId`, either in the client config or on the request. ' +
        'Function names are only unique within a stack.',
    )
  }

  return stackId
}

/** @internal */
export function _invoke<R = unknown>(
  client: Client,
  httpRequest: HttpRequest,
  functionName: string,
  request?: InvokeFunctionRequest,
  options?: InvokeFunctionOptions,
): Observable<R | undefined> {
  // Deferred so a bad config surfaces as an error on the returned observable
  // (and so a rejected promise) rather than throwing at the call site.
  return defer(() => {
    const config = client.config()
    const headers = scopeHeaders(config, request)
    const stackId = resolveStackId(config, request)
    const sync = options?.sync ?? false

    // An async invocation is only acknowledged (202, no body), and a sync
    // function that returns nothing answers 204, which the transport parses
    // to an `undefined` body. The status code is not observable from here —
    // the `HttpRequest` boundary resolves to the body alone — so an empty
    // response and a function that returned nothing both surface as
    // `undefined`.
    //
    // The route is async by default, so `sync=false` is left off the wire
    // rather than spelled out.
    return _requestObservable<R | undefined>(client, httpRequest, {
      method: 'POST',
      url: `/functions/${functionName}/invoke?blueprintStackId=${stackId}${sync ? '&sync=true' : ''}`,
      headers,
      body: {event: {data: request?.event?.data ?? {}}},
      timeout: request?.timeout,
      signal: request?.signal,
    })
  })
}
