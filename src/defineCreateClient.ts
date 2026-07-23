import {defineRequester, type EnvironmentOptions} from './http/request'
import type {ClientConfig, HttpRequest} from './types'

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
    // this in `new Observable(...)` (see `_observe` in dataMethods).
    // Redirects are surfaced rather than followed unless a request opts in
    // (via the public `maxRedirects` option, translated in `requestOptions`).
    const httpRequest: HttpRequest = async (options) => {
      const event = await clientRequesterPromise({redirect: 'manual', ...options})
      return event.body
    }
    // Populate `requester` on the initialized config so internal paths
    // (e.g. the asset upload event stream) can reach the underlying transport.
    // `resolveFetch` is threaded onto the config so request building and
    // EventSource fetches can reach the environment's fetch without importing
    // `get-it/node` from a browser-shared module (would leak `undici` into
    // the browser bundle). A caller-supplied `resolveFetch` wins over the
    // environment's — that is the supported way to swap the transport (the
    // test suite injects its mock fetch through it).
    const resolvedConfig = {
      ...config,
      requester: clientRequester,
      resolveFetch: config.resolveFetch ?? envOptions.resolveFetch,
    }
    return new ClassConstructor(httpRequest, resolvedConfig)
  }

  return {requester: defaultRequester, createClient}
}
