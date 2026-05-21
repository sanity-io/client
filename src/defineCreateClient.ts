import type {Observable} from 'rxjs'
import {filter, map} from 'rxjs/operators'

import {defineHttpRequest, type EnvironmentOptions} from './http/request'
import type {Any, ClientConfig, HttpRequest} from './types'

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
  ClassConstructor: new (httpRequest: HttpRequest, config: ClientConfigType) => SanityClientType,
) {
  // Set the http client to use for requests, and its environment specific options
  const defaultRequester = defineHttpRequest(envOptions)

  const createClient = (config: ClientConfigType) => {
    const clientRequester = defineHttpRequest(envOptions, {
      ignoreWarnings: config.ignoreWarnings,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
    })
    const httpRequest: HttpRequest = (options, requester) => {
      const stream: Observable<Any> = (requester || clientRequester)({
        maxRedirects: 0,
        lineage: config.lineage,
        ...options,
      } as Any)
      return stream.pipe(
        filter((event: Any) => event?.type === 'response'),
        map((event: Any) => event.body as unknown),
      )
    }
    // Ensure `config.requester` is always populated so internal paths
    // (e.g. the asset upload event stream) can reach the underlying transport.
    const resolvedConfig = {...config, requester: config.requester ?? clientRequester}
    return new ClassConstructor(httpRequest, resolvedConfig)
  }

  return {requester: defaultRequester, createClient}
}
