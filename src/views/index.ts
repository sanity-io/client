import {lastValueFrom, Observable} from 'rxjs'
import type {RequestOptions as GetItRequestOptions} from 'get-it'
import {type QueryParams, type QueryWithoutParams, requester as defaultRequester} from '@sanity/client'
import type {
  ClientReturn,
  RawQueryResponse,
  HttpRequest,
  QueryOptions,
  ClientConfig,
  Any,
  FilteredResponseQueryOptions,
  UnfilteredResponseQueryOptions,
  UnfilteredResponseWithoutQuery,
  RawQuerylessQueryResponse,
} from '../types'
import {QueryFetcher} from '../data/QueryFetcher'

/** @public */
export interface ViewClientConfig extends Omit<ClientConfig, 'dataset' | 'projectId' | 'useCdn' | 'useProjectHostname'> {
  // TODO: Add our own config options
}

/** @public */
export const createViewClient = (config: ViewClientConfig) => {
  const httpRequest = (options: any, requester?: any) =>
    (requester || defaultRequester)(options as GetItRequestOptions)

  return new ViewClient(httpRequest, config)
}

/** @public */
export const createObservableViewClient = (config: ViewClientConfig) => {
  const httpRequest = (options: any, requester?: any) =>
    (requester || defaultRequester)(options as GetItRequestOptions)

  return new ObservableViewClient(httpRequest, config)
}

/** @public */
export type ViewsQueryOptions = Pick<QueryOptions, 'perspective' | 'resultSourceMap' | 'filterResponse'>

/** @public */
export class ViewClient {
  #config: ViewClientConfig
  #httpRequest: HttpRequest
  #fetcher: QueryFetcher

  constructor(httpRequest: HttpRequest, config: ViewClientConfig) {
    this.#config = config
    this.#httpRequest = httpRequest
    this.#fetcher = new QueryFetcher(httpRequest)
  }

  /**
   * Clone the client with a new (partial) configuration.
   *
   * @param newConfig - New client configuration properties, shallowly merged with existing configuration
   */
  withConfig(newConfig?: Partial<ViewClientConfig>): ViewClient {
    const mergedConfig = {
      ...this.#config,
      ...newConfig,
    }
    return new ViewClient(this.#httpRequest, mergedConfig)
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
  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Optional request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    viewId: string,
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options?: FilteredResponseQueryOptions,
  ): Promise<ClientReturn<G, R>>
  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    viewId: string,
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options: UnfilteredResponseQueryOptions,
  ): Promise<RawQueryResponse<ClientReturn<G, R>>>
  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    viewId: string,
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options: UnfilteredResponseWithoutQuery,
  ): Promise<RawQuerylessQueryResponse<ClientReturn<G, R>>>
  fetch<R, Q, const G extends string>(
    viewId: string,
    query: G,
    params?: Q,
    options?: QueryOptions,
  ): Promise<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>> {
    const configOverrides = {
      '~experimental_resource': {
        id: viewId,
        type: 'views' as const,
      },
    }

    const opts = {
      returnQuery: false,
      ...options,
      useCdn: true,
    }

    return lastValueFrom(
      this.#fetcher.executeFetch<ClientReturn<G, R>, Q, G>(
        this.#config,
        query,
        params,
        opts,
        { enabled: false },
        configOverrides
      )
    ) as Promise<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>>
  }
}

/** @public */
export class ObservableViewClient {
  #config: ViewClientConfig
  #httpRequest: HttpRequest
  #fetcher: QueryFetcher

  constructor(httpRequest: HttpRequest, config: ViewClientConfig) {
    this.#config = config
    this.#httpRequest = httpRequest
    this.#fetcher = new QueryFetcher(httpRequest)
  }

  /**
   * Clone the client with a new (partial) configuration.
   *
   * @param newConfig - New client configuration properties, shallowly merged with existing configuration
   */
  withConfig(newConfig?: Partial<ViewClientConfig>): ObservableViewClient {
    const mergedConfig = {
      ...this.#config,
      ...newConfig,
    }
    return new ObservableViewClient(this.#httpRequest, mergedConfig)
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
  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Optional request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    viewId: string,
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options?: FilteredResponseQueryOptions,
  ): Observable<ClientReturn<G, R>>
  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    viewId: string,
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options: UnfilteredResponseQueryOptions,
  ): Observable<RawQueryResponse<ClientReturn<G, R>>>
  /**
   * Perform a GROQ-query against the configured view.
   *
   * @param viewId - ID of the view to query
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    viewId: string,
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options: UnfilteredResponseWithoutQuery,
  ): Observable<RawQuerylessQueryResponse<ClientReturn<G, R>>>
  fetch<R, Q, const G extends string>(
    viewId: string,
    query: G,
    params?: Q,
    options?: QueryOptions,
  ): Observable<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>> {
    const configOverrides = {
      '~experimental_resource': {
        id: viewId,
        type: 'views' as const,
      },
    }

    const opts = {
      returnQuery: false,
      ...options,
      useCdn: true,
    }

    return this.#fetcher.executeFetch<ClientReturn<G, R>, Q, G>(
      this.#config,
      query,
      params,
      opts,
      { enabled: false },
      configOverrides
    ) as Observable<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>>
  }
}
