import {
  type QueryParams,
  type QueryWithoutParams,
  type ViewOverride,
  ViewResourceType,
} from '@sanity/client'
import {lastValueFrom, Observable} from 'rxjs'

import {initConfig} from '../config'
import {_fetch} from '../data/dataMethods'
import {defineHttpRequest} from '../http/request'
import type {
  Any,
  ClientConfig,
  ClientReturn,
  HttpRequest,
  RawQueryResponse,
  ViewQueryOptions,
} from '../types'

/**
 * Helper function to check if a view has any dataset connections
 * @internal
 */
function hasDatasetConnections(viewId: string, viewOverrides?: ViewOverride[]): boolean {
  if (!viewOverrides) return false

  const viewOverride = viewOverrides.find((override) => override.resourceId === viewId)
  if (!viewOverride || !viewOverride.connections.length) return false

  // Check if any connection has dataset resourceType
  return viewOverride.connections.some((conn) => conn.resourceType === ViewResourceType.Dataset)
}

/** @public */
export interface ViewClientConfig
  extends Omit<ClientConfig, 'dataset' | 'projectId' | 'useCdn' | 'useProjectHostname'> {
  viewOverrides?: ViewOverride[]
  apiVersion: string
}

/**
 * Creates a new ViewClient instance with the given configuration
 *
 * @param config - Configuration for the ViewClient
 * @public
 */
export function createViewClient(config: ViewClientConfig): ViewClient {
  // Validate we have the correct view resourceType
  // Fail early if we don't.
  if (config.viewOverrides) {
    config.viewOverrides.forEach((override: ViewOverride) => {
      if (override.resourceType !== ViewResourceType.View) {
        throw new Error('View overrides only support resource type "view"')
      }
    })
  }

  const clientRequester = defineHttpRequest([])
  return new ViewClient(
    (options, requester) =>
      (requester || clientRequester)({
        maxRedirects: 0,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
        ...options,
      } as Any),
    config,
  )
}

/** @public */
export class ViewClient {
  #config: ViewClientConfig
  #httpRequest: HttpRequest

  /**
   * Observable version of the view client, with the same configuration as the promise-based one
   */
  observable: ObservableViewClient

  constructor(httpRequest: HttpRequest, config: ViewClientConfig) {
    this.#config = config
    this.#httpRequest = httpRequest

    this.observable = new ObservableViewClient(httpRequest, config)
  }

  /**
   * Clone the client with a new (partial) configuration.
   *
   * @param newConfig - New client configuration properties, shallowly merged with existing configuration
   */
  withConfig(newConfig?: Partial<ViewClientConfig>): ViewClient {
    return new ViewClient(this.#httpRequest, {
      ...this.#config,
      ...newConfig,
    })
  }

  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams = QueryWithoutParams,
    const G extends string = string,
  >(viewId: string, query: G, params?: Q | QueryWithoutParams): Promise<ClientReturn<G, R>>
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    viewId: string,
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options?: ViewQueryOptions,
  ): Promise<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>>
  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<R, Q, const G extends string>(
    viewId: string,
    query: G,
    params?: Q,
    options?: ViewQueryOptions,
  ): Promise<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>> {
    // Check if this view has dataset connections
    const useEmulate = hasDatasetConnections(viewId, this.#config.viewOverrides)

    // Get connections for this view if using emulate endpoint
    const viewOverride = this.#config.viewOverrides?.find(
      (override) => override.resourceId === viewId,
    )
    const connections = useEmulate ? viewOverride?.connections || [] : undefined

    const cfg = initConfig(
      {
        '~experimental_resource': {
          id: viewId,
          type: 'view',
        },
      },
      this.#config,
    )
    const opts = {
      returnQuery: false,
      ...options,
      useCdn: true,
      useEmulate,
      connections,
    }

    return lastValueFrom(_fetch(cfg, this.#httpRequest, {enabled: false}, query, params, opts))
  }
}

/** @public */
export class ObservableViewClient {
  #config: ViewClientConfig
  #httpRequest: HttpRequest

  constructor(httpRequest: HttpRequest, config: ViewClientConfig) {
    this.#config = config
    this.#httpRequest = httpRequest
  }

  /**
   * Clone the client with a new (partial) configuration.
   *
   * @param newConfig - New client configuration properties, shallowly merged with existing configuration
   */
  withConfig(newConfig?: Partial<ViewClientConfig>): ObservableViewClient {
    return new ObservableViewClient(this.#httpRequest, {
      ...this.#config,
      ...newConfig,
    })
  }

  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams = QueryWithoutParams,
    const G extends string = string,
  >(viewId: string, query: G, params?: Q | QueryWithoutParams): Observable<ClientReturn<G, R>>
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    viewId: string,
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options?: ViewQueryOptions,
  ): Observable<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>>
  fetch<R, Q, const G extends string>(
    viewId: string,
    query: G,
    params?: Q,
    options?: ViewQueryOptions,
  ): Observable<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>> {
    // Check if this view has dataset connections
    const useEmulateEndpoint = hasDatasetConnections(viewId, this.#config.viewOverrides)

    // Get connections for this view if using emulate endpoint
    const viewOverride = this.#config.viewOverrides?.find(
      (override) => override.resourceId === viewId,
    )
    const connections = useEmulateEndpoint ? viewOverride?.connections || [] : undefined

    const cfg = initConfig(
      {
        '~experimental_resource': {
          id: viewId,
          type: 'view',
        },
      },
      this.#config,
    )
    const opts = {
      returnQuery: false,
      ...options,
      useCdn: true,
      useEmulate: useEmulateEndpoint,
      connections,
    }

    return _fetch(cfg, this.#httpRequest, {enabled: false}, query, params, opts)
  }
}
