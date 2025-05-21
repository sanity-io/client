import {lastValueFrom, Observable} from 'rxjs'
import {type QueryParams, type QueryWithoutParams} from '@sanity/client'
import type {
  ClientReturn,
  RawQueryResponse,
  HttpRequest,
  QueryOptions,
  ClientConfig,
  Any,
} from '../types'
import {_fetch} from '../data/dataMethods'
import {initConfig} from '../config'
import {defineHttpRequest} from '../http/request'

/** @public */
export interface ViewClientConfig extends Omit<ClientConfig, 'dataset' | 'projectId' | 'useCdn' | 'useProjectHostname'> {
  // TODO: Add our own config options
}

/**
 * Creates a new ViewClient instance with the given configuration
 *
 * @param config - Configuration for the ViewClient
 * @public
 */
export function createViewClient(config: ViewClientConfig): ViewClient {
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
export type ViewsQueryOptions = Pick<QueryOptions, 'perspective' | 'resultSourceMap' | 'filterResponse'>

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
    options?: ViewsQueryOptions,
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
    options?: ViewsQueryOptions,
  ): Promise<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>> {
    const cfg = initConfig(
      {
        '~experimental_resource': {
          id: viewId,
          type: 'views',
        },
      },
      this.#config,
    )
    const opts = {
      returnQuery: false,
      ...options,
      useCdn: true,
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
  fetch<R, Q, const G extends string>(
    viewId: string,
    query: G,
    params?: Q,
    options?: ViewsQueryOptions,
  ): Observable<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>> {
    const cfg = initConfig(
      {
        '~experimental_resource': {
          id: viewId,
          type: 'views',
        },
      },
      this.#config,
    )
    const opts = {
      returnQuery: false,
      ...options,
      useCdn: true,
    }

    return _fetch(cfg, this.#httpRequest, {enabled: false}, query, params, opts)
  }
}
