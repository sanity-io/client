import {lastValueFrom} from 'rxjs'
import {filter, map} from 'rxjs/operators'

import {defineRequester, type EnvironmentOptions} from './http/request'
import type {Any, ClientConfig, HttpRequestPromise} from './types'

export {validateApiPerspective} from './config'
export {
  ChannelError,
  connectEventSource,
  ConnectionFailedError,
  DisconnectError,
  type EventSourceEvent,
  type EventSourceInstance,
  MessageError,
  MessageParseError,
  type ServerSentEvent,
} from './data/eventsource'
export * from './data/patch'
export * from './data/transaction'
export {
  ClientError,
  CorsOriginError,
  formatQueryParseError,
  type HttpError,
  isHttpError,
  isQueryParseError,
  ServerError,
} from './http/errors'
export * from './SanityClient'
export * from './types'

/**
 * Create the `requester` and `createClient` exports, that have environment specific middleware for node and browsers
 * @internal
 */
export default function defineCreateClientExports<
  SanityClientType,
  ClientConfigType extends ClientConfig,
>(
  envOptions: EnvironmentOptions,
  ClassConstructor: new (
    httpRequestPromise: HttpRequestPromise,
    config: ClientConfigType,
  ) => SanityClientType,
) {
  // Set the http client to use for requests, and its environment specific options
  const defaultRequester = defineRequester(envOptions).observable

  const createClient = (config: ClientConfigType) => {
    const {observable: clientRequester, promise: clientRequesterPromise} = defineRequester(
      envOptions,
      {
        ignoreWarnings: config.ignoreWarnings,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
      },
    )
    // The single transport for the whole client. Resolves a request to its
    // parsed response body as a Promise; the observable client surface wraps
    // this in `new Observable(...)` (see `_observe` in dataMethods). A
    // user-supplied custom `requester` (deprecated, observable-typed) is
    // honored by bridging it through `lastValueFrom` — the only path that
    // touches RxJS here.
    const userRequester = config.requester
    const httpRequestPromise: HttpRequestPromise = async (options) => {
      const requestOptions = {
        maxRedirects: 0,
        lineage: config.lineage,
        ...options,
      } as Any
      if (userRequester) {
        return lastValueFrom(
          userRequester(requestOptions).pipe(
            filter((event: Any) => event?.type === 'response'),
            map((event: Any) => event.body as unknown),
          ),
        )
      }
      const event = await clientRequesterPromise(requestOptions)
      return event.body
    }
    // Ensure `config.requester` is always populated so internal paths
    // (e.g. the asset upload event stream) can reach the underlying transport.
    // `resolveProxyFetch` is threaded onto the config so EventSource fetches
    // can reach a proxy-aware fetch without importing `get-it/node` from a
    // browser-shared module (would leak `undici` into the browser bundle).
    const resolvedConfig = {
      ...config,
      requester: config.requester ?? clientRequester,
      resolveProxyFetch: envOptions.resolveProxyFetch,
    }
    return new ClassConstructor(httpRequestPromise, resolvedConfig)
  }

  return {requester: defaultRequester, createClient}
}
