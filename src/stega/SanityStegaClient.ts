import {Observable} from 'rxjs'
import {map} from 'rxjs/operators'

import {defaultConfig} from '../config'
import {
  ObservableSanityClient as INTERNAL_DO_NOT_USE_DIRECTLY_ObservableSanityClient,
  SanityClient as INTERNAL_DO_NOT_USE_DIRECTLY_SanityClient,
} from '../SanityClient'
import type {
  Any,
  ClientConfig,
  FilteredResponseQueryOptions,
  HttpRequest,
  QueryParams,
  RawQueryResponse,
  UnfilteredResponseQueryOptions,
} from '../types'
import {defaultStegaConfig, initStegaConfig, splitConfig} from './config'
import {stegaEncodeSourceMap} from './stegaEncodeSourceMap'
import {ClientStegaConfig, InitializedClientStegaConfig, InitializedStegaConfig} from './types'

/** @public */
export class ObservableSanityStegaClient extends INTERNAL_DO_NOT_USE_DIRECTLY_ObservableSanityClient {
  /**
   * Private properties
   */
  #httpRequest: HttpRequest
  private stegaConfig: InitializedStegaConfig

  constructor(httpRequest: HttpRequest, config: ClientStegaConfig = defaultConfig) {
    const {clientConfig, stegaConfig} = splitConfig(config)
    super(httpRequest, clientConfig)

    this.#httpRequest = httpRequest
    this.stegaConfig = initStegaConfig(stegaConfig, defaultStegaConfig)
  }

  /**
   * Clone the client - returns a new instance
   */
  clone(): ObservableSanityStegaClient {
    return new ObservableSanityStegaClient(this.#httpRequest, this.config())
  }

  /**
   * Returns the current client configuration
   */
  config(): InitializedClientStegaConfig
  /**
   * Reconfigure the client. Note that this _mutates_ the current client.
   */
  config(newConfig?: Partial<ClientStegaConfig>): this
  config(newConfig?: Partial<ClientStegaConfig>): ClientStegaConfig | this {
    if (newConfig === undefined) {
      return {...super.config(), stega: {...this.stegaConfig}}
    }

    const {clientConfig, stegaConfig} = splitConfig(newConfig)
    super.config(clientConfig)

    this.stegaConfig = initStegaConfig(stegaConfig, this.stegaConfig || {})
    return this
  }

  /**
   * Clone the client with a new (partial) configuration.
   *
   * @param newConfig - New client configuration properties, shallowly merged with existing configuration
   */
  withConfig(newConfig?: Partial<ClientConfig>): ObservableSanityStegaClient {
    const thisConfig = this.config()
    const {stegaConfig} = splitConfig(newConfig || {})
    return new ObservableSanityStegaClient(this.#httpRequest, {
      ...thisConfig,
      ...newConfig,
      stega: {
        ...(thisConfig.stega || {}),
        ...(stegaConfig || {}),
      },
    })
  }

  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   */
  fetch<R = Any>(query: string): Observable<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Query parameters
   */
  fetch<R = Any, Q = QueryParams>(query: string, params: Q): Observable<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Query parameters
   * @param options - Request options
   */
  fetch<R = Any, Q = QueryParams>(
    query: string,
    params: Q | undefined,
    options: FilteredResponseQueryOptions,
  ): Observable<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Query parameters
   * @param options - Request options
   */
  fetch<R = Any, Q = QueryParams>(
    query: string,
    params: Q | undefined,
    options: UnfilteredResponseQueryOptions,
  ): Observable<RawQueryResponse<R>>
  fetch<R, Q extends QueryParams>(
    query: string,
    params?: Q,
    options: FilteredResponseQueryOptions | UnfilteredResponseQueryOptions = {},
  ): Observable<RawQueryResponse<R> | R> {
    if (!this.stegaConfig.enabled) {
      return super.fetch<R, Q>(query, params, options as Any)
    }
    const {filterResponse: originalFilterResponse = true} = options
    return super
      .fetch<R, Q>(
        query,
        params,
        Object.assign({}, options as Any, {
          filterResponse: false,
          resultSourceMap: 'withKeyArraySelector',
        }),
      )
      .pipe(
        map((res: Any) => {
          const {result: _result, resultSourceMap} = res as RawQueryResponse<R>
          const result = stegaEncodeSourceMap(_result, resultSourceMap, this.stegaConfig)
          return originalFilterResponse ? result : {...res, result}
        }),
      )
  }
}

/** @public */
export class SanityStegaClient extends INTERNAL_DO_NOT_USE_DIRECTLY_SanityClient {
  /**
   * Observable version of the Sanity client, with the same configuration as the promise-based one
   */
  observable: ObservableSanityStegaClient

  /**
   * Private properties
   */
  #httpRequest: HttpRequest
  private stegaConfig: InitializedStegaConfig

  constructor(httpRequest: HttpRequest, config: ClientStegaConfig = defaultConfig) {
    const {clientConfig, stegaConfig} = splitConfig(config)
    super(httpRequest, clientConfig)

    this.#httpRequest = httpRequest
    this.stegaConfig = initStegaConfig(stegaConfig, defaultStegaConfig)

    this.observable = new ObservableSanityStegaClient(httpRequest, config)
  }

  /**
   * Clone the client - returns a new instance
   */
  clone(): SanityStegaClient {
    return new SanityStegaClient(this.#httpRequest, this.config())
  }

  /**
   * Returns the current client configuration
   */
  config(): InitializedClientStegaConfig
  /**
   * Reconfigure the client. Note that this _mutates_ the current client.
   */
  config(newConfig?: Partial<ClientStegaConfig>): this
  config(newConfig?: Partial<ClientStegaConfig>): ClientStegaConfig | this {
    if (newConfig === undefined) {
      return {...super.config(), stega: {...this.stegaConfig}}
    }

    const {clientConfig, stegaConfig} = splitConfig(newConfig)
    super.config(clientConfig)

    this.stegaConfig = initStegaConfig(stegaConfig, {...(this.stegaConfig || {})})
    return this
  }

  /**
   * Clone the client with a new (partial) configuration.
   *
   * @param newConfig - New client configuration properties, shallowly merged with existing configuration
   */
  withConfig(newConfig?: Partial<ClientStegaConfig>): SanityStegaClient {
    const thisConfig = this.config()
    const {stegaConfig} = splitConfig(newConfig || {})
    return new SanityStegaClient(this.#httpRequest, {
      ...thisConfig,
      ...newConfig,
      stega: {
        ...(thisConfig.stega || {}),
        ...(stegaConfig || {}),
      },
    })
  }

  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   */
  fetch<R = Any>(query: string): Promise<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   */
  fetch<R = Any, Q = QueryParams>(query: string, params: Q): Promise<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<R = Any, Q = QueryParams>(
    query: string,
    params: Q | undefined,
    options: FilteredResponseQueryOptions,
  ): Promise<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<R = Any, Q = QueryParams>(
    query: string,
    params: Q | undefined,
    options: UnfilteredResponseQueryOptions,
  ): Promise<RawQueryResponse<R>>
  fetch<R, Q extends QueryParams>(
    query: string,
    params?: Q,
    options: FilteredResponseQueryOptions | UnfilteredResponseQueryOptions = {},
  ): Promise<RawQueryResponse<R> | R> {
    if (!this.stegaConfig.enabled) {
      return super.fetch<R, Q>(query, params, options as Any)
    }
    const {filterResponse: originalFilterResponse = true} = options
    return super
      .fetch<R, Q>(
        query,
        params,
        Object.assign({}, options as Any, {
          filterResponse: false,
          resultSourceMap: 'withKeyArraySelector',
        }),
      )
      .then((res: Any) => {
        const {result: _result, resultSourceMap} = res as RawQueryResponse<R>
        const result = stegaEncodeSourceMap(_result, resultSourceMap, this.stegaConfig)
        return originalFilterResponse ? result : {...res, result}
      })
  }
}

export type {
  INTERNAL_DO_NOT_USE_DIRECTLY_ObservableSanityClient,
  INTERNAL_DO_NOT_USE_DIRECTLY_SanityClient,
}
