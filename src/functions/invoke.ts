import {defer, map, mergeMap, type Observable} from 'rxjs'

import {_requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, InitializedClientConfig} from '../types'

/** Function resource types in a blueprint are namespaced under this prefix. */
const FUNCTION_RESOURCE_PREFIX = 'sanity.function.'
const SYNC_INVOCABLE_FUNCTION_TYPES = ['sanity.function.pubsub']
const ASYNC_INVOCABLE_FUNCTION_TYPES = [
  'sanity.function.durable',
  'sanity.function.pubsub',
  'sanity.function.queue',
]
const INVOCABLE_FUNCTION_TYPES = [
  ...new Set([...SYNC_INVOCABLE_FUNCTION_TYPES, ...ASYNC_INVOCABLE_FUNCTION_TYPES]),
]

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
  sync: boolean,
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

      if (!INVOCABLE_FUNCTION_TYPES.includes(match.type)) {
        throw new Error(`Function invocation is not supported for ${match.type}`)
      }
      if (sync && !SYNC_INVOCABLE_FUNCTION_TYPES.includes(match.type)) {
        throw new Error(`Synchronous function invocation is not supported for ${match.type}`)
      }
      if (!sync && !ASYNC_INVOCABLE_FUNCTION_TYPES.includes(match.type)) {
        throw new Error(`Asynchronous function invocation is not supported for ${match.type}`)
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
  options?: InvokeFunctionOptions,
): Observable<R | undefined> {
  // Deferred so a bad config surfaces as an error on the returned observable
  // (and so a rejected promise) rather than throwing at the call site.
  return defer(() => {
    const config = client.config()
    const headers = scopeHeaders(config, request)
    const stackId = resolveStackId(config, request)
    const sync = options?.sync ?? false

    return _resolveFunctionId(
      client,
      httpRequest,
      functionName,
      stackId,
      headers,
      request,
      sync,
    ).pipe(
      // An async invocation is only acknowledged (202, no body), and a sync
      // function that returns nothing answers 204, which the transport parses
      // to an `undefined` body. The status code is not observable from here —
      // the `HttpRequest` boundary resolves to the body alone — so an empty
      // response and a function that returned nothing both surface as
      // `undefined`.
      //
      // The route is async by default, so `sync=false` is left off the wire
      // rather than spelled out.
      mergeMap((functionId) =>
        _requestObservable<R | undefined>(client, httpRequest, {
          method: 'POST',
          url: `/functions/${functionId}/invoke${sync ? '?sync=true' : ''}`,
          headers,
          body: {event: {data: request?.event?.data ?? {}}},
          timeout: request?.timeout,
          signal: request?.signal,
        }),
      ),
    )
  })
}
