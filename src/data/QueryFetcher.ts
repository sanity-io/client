import { Observable } from 'rxjs'
import type {
  Any,
  ClientConfig,
  HttpRequest,
  InitializedClientConfig,
  InitializedStegaConfig,
  QueryOptions,
  RawQueryResponse,
  RawQuerylessQueryResponse,
} from '../types'
import { _fetch } from './dataMethods'
import { initConfig } from '../config'

/**
 * A reusable class for executing GROQ queries against Sanity resources
 * @internal
 */
export class QueryFetcher {
  #httpRequest: HttpRequest

  constructor(httpRequest: HttpRequest) {
    this.#httpRequest = httpRequest
  }

  /**
   * Execute a GROQ query against a Sanity resource
   *
   * @param config - Client configuration
   * @param query - GROQ query to execute
   * @param params - Query parameters
   * @param options - Query options
   * @param stegaConfig - Stega configuration for encoding content source maps
   * @param configOverrides - Optional configuration overrides
   * @returns Observable of query results
   * @internal
   */
  executeFetch<R = Any, Q = any, G extends string = string>(
    config: ClientConfig,
    query: G,
    params?: Q,
    options?: QueryOptions,
    stegaConfig?: InitializedStegaConfig | { enabled: boolean },
    configOverrides?: Partial<ClientConfig>
  ): Observable<RawQueryResponse<R> | RawQuerylessQueryResponse<R> | R> {
    const cfg = configOverrides
      ? initConfig(configOverrides, config)
      : config as InitializedClientConfig

    return _fetch<R, Q>(
      cfg,
      this.#httpRequest,
      stegaConfig || { enabled: false },
      query,
      params,
      options
    )
  }
}
