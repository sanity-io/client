import type {Middlewares} from 'get-it'

import {defineHttpRequest} from './http/request'
import type {Any, ClientConfig, HttpRequest} from './types'

export * from './data/patch'
export * from './data/transaction'
export {ClientError, ServerError} from './http/errors'
export * from './SanityClient'
export * from './types'

/** @alpha */
export {adapter as unstable__adapter, environment as unstable__environment} from 'get-it'

/**
 * Create the `requester` and `createClient` exports, that have environment specific middleware for node and browsers
 * @internal
 */
export default function defineCreateClientExports<
  SanityClientType,
  ClientConfigType extends ClientConfig,
>(
  envMiddleware: Middlewares,
  ClassConstructor: new (httpRequest: HttpRequest, config: ClientConfigType) => SanityClientType,
) {
  // Set the http client to use for requests, and its environment specific middleware
  const defaultRequester = defineHttpRequest(envMiddleware)

  const createClient = (config: ClientConfigType) =>
    new ClassConstructor(
      (options, requester) =>
        (requester || defaultRequester)({
          maxRedirects: 0,
          maxRetries: config.maxRetries,
          retryDelay: config.retryDelay,
          ...options,
        } as Any),
      config,
    )

  return {requester: defaultRequester, createClient}
}
