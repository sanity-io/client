import {defer, map, mergeMap, type Observable} from 'rxjs'

import {_requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, InitializedClientConfig} from '../types'

/** Function resource types in a blueprint are namespaced under this prefix. */
const FUNCTION_RESOURCE_PREFIX = 'sanity.function.'
const INVOKABLE_FUNCTION_TYPE = 'sanity.function.pubsub'

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
   * Stack to resolve the function name against.
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

/**
 * Subset of a stack resource the client needs in order to resolve a name.
 *
 * @internal
 */
interface StackResource {
  name: string
  type: string
  /** Provider-side id. For a function resource, the function id. */
  externalId?: string
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

/**
 * The invoke route is keyed by function id, but callers know functions by the
 * name declared in the blueprint. Names are unique within a stack, so the stack
 * both makes the name resolvable and confines the call to its own functions.
 *
 * @internal
 */
function _resolveFunctionId(
  client: Client,
  httpRequest: HttpRequest,
  functionName: string,
  stackId: string,
  headers: Record<string, string>,
  request: InvokeFunctionRequest | undefined,
): Observable<string> {
  return _requestObservable<{resources?: StackResource[]}>(client, httpRequest, {
    method: 'GET',
    url: `/blueprints/stacks/${stackId}`,
    headers,
    signal: request?.signal,
  }).pipe(
    map((stack) => {
      const match = (stack?.resources || []).find(
        (resource) =>
          resource.type?.startsWith(FUNCTION_RESOURCE_PREFIX) && resource.name === functionName,
      )

      if (!match) {
        throw new Error(`Function "${functionName}" not found in stack "${stackId}"`)
      }

      if (!match.externalId) {
        throw new Error(
          `Function "${functionName}" is declared in stack "${stackId}" but is not deployed`,
        )
      }

      if (match.type !== INVOKABLE_FUNCTION_TYPE) {
        throw new Error(`Function invocation is not supported for ${match.type}`)
      }

      return match.externalId
    }),
  )
}

/** @internal */
export function _invoke<R = unknown>(
  client: Client,
  httpRequest: HttpRequest,
  functionName: string,
  request?: InvokeFunctionRequest,
): Observable<R | undefined> {
  // Deferred so a bad config surfaces as an error on the returned observable
  // (and so a rejected promise) rather than throwing at the call site.
  return defer(() => {
    const config = client.config()
    const headers = scopeHeaders(config, request)
    const stackId = resolveStackId(config, request)

    return _resolveFunctionId(client, httpRequest, functionName, stackId, headers, request).pipe(
      // A function that returns nothing answers 204, which the transport parses
      // to an `undefined` body. The status code is not observable from here —
      // the `HttpRequest` boundary resolves to the body alone — so an empty
      // response and a function that returned nothing both surface as
      // `undefined`.
      mergeMap((functionId) =>
        _requestObservable<R | undefined>(client, httpRequest, {
          method: 'POST',
          url: `/functions/${functionId}/invoke`,
          headers,
          body: {event: {data: request?.event?.data ?? {}}},
          timeout: request?.timeout,
          signal: request?.signal,
        }),
      ),
    )
  })
}
