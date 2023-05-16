import {getIt, type Middlewares} from 'get-it'
import {jsonRequest, jsonResponse, observable, progress, retry} from 'get-it/middleware'
import {Observable} from 'rxjs'

import type {Any, HttpRequest, RequestOptions} from '../types'
import {ClientError, ServerError} from './errors'

const httpError = {
  onResponse: (res: Any) => {
    if (res.statusCode >= 500) {
      throw new ServerError(res)
    } else if (res.statusCode >= 400) {
      throw new ClientError(res)
    }

    return res
  },
}

const printWarnings = {
  onResponse: (res: Any) => {
    const warn = res.headers['x-sanity-warning']
    const warnings = Array.isArray(warn) ? warn : [warn]
    warnings.filter(Boolean).forEach((msg) => console.warn(msg)) // eslint-disable-line no-console
    return res
  },
}

/** @internal */
export function defineHttpRequest(
  envMiddleware: Middlewares,
  {
    maxRetries = 5,
    retryDelay,
  }: {maxRetries?: number; retryDelay?: (attemptNumber: number) => number}
): HttpRequest {
  const request = getIt([
    maxRetries > 0
      ? retry({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          retryDelay: retryDelay as any, // This option is typed incorrectly in get-it.
          maxRetries,
          shouldRetry,
        })
      : {},
    ...envMiddleware,
    printWarnings,
    jsonRequest(),
    jsonResponse(),
    progress(),
    httpError,
    observable({implementation: Observable}),
  ])

  function httpRequest(options: RequestOptions, requester = request) {
    return requester({maxRedirects: 0, ...options} as Any)
  }

  httpRequest.defaultRequester = request

  return httpRequest
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shouldRetry(err: any, attempt: number, options: any) {
  // By default `retry.shouldRetry` doesn't retry on server errors so we add our own logic.

  const isSafe = options.method === 'GET' || options.method === 'HEAD'
  const uri = options.uri || options.url
  const isQuery = uri.startsWith('/data/query')
  const isRetriableResponse =
    err.response &&
    (err.response.statusCode === 429 ||
      err.response.statusCode === 502 ||
      err.response.statusCode === 503)

  // We retry the following errors:
  // - 429 means that the request was rate limited. It's a bit difficult
  //   to know exactly how long it makes sense to wait and/or how many
  //   attempts we should retry, but the backoff should alleviate the
  //   additional load.
  // - 502/503 can occur when certain components struggle to talk to their
  //   upstream dependencies. This is most likely a temporary problem
  //   and retrying makes sense.

  if ((isSafe || isQuery) && isRetriableResponse) return true

  return retry.shouldRetry(err, attempt, options)
}
