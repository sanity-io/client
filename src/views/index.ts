import type {RequestOptions as GetItRequestOptions} from 'get-it'
import {type QueryParams, type QueryWithoutParams, requester as defaultRequester} from '@sanity/client'
import {lastValueFrom} from 'rxjs'
import type {
  ClientReturn,
  RawQueryResponse,
  HttpRequest,
  QueryOptions,
  ClientConfig,
  Any
} from '../types'
import {_fetch} from '../data/dataMethods'
import {initConfig} from '../config'

/** @public */
export interface ViewClientConfig extends Omit<ClientConfig, 'dataset' | 'projectId' | 'useCdn' | 'useProjectHostname'> {
  // TODO: Add our own config options
}

/** @public */
export const createViewClient = (config: ViewClientConfig) => new ViewClient(
  (options, requester) => (requester || defaultRequester)(options as GetItRequestOptions),
  config,
)

/** @public */
export type ViewsQueryOptions = Pick<QueryOptions, 'perspective' | 'resultSourceMap' | 'filterResponse'>

/** @public */
export class ViewClient {
  #config: ViewClientConfig
  #httpRequest: HttpRequest

  constructor(httpRequest: HttpRequest, config: ViewClientConfig) {
    this.#config = config
    this.#httpRequest = httpRequest
  }

  /**
   * Perform a GROQ-query against the configured dataset.
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
