import {lastValueFrom} from 'rxjs'
import type {RequestOptions as GetItRequestOptions} from 'get-it'
import {requester as defaultRequester} from '@sanity/client'
import type {
  ClientReturn,
  RawQueryResponse,
  HttpRequest,
  QueryOptions,
  ClientConfig,
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
