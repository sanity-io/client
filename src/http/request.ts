import {getIt, type HttpContext, type Middlewares, type Requester} from 'get-it'
import {jsonRequest, jsonResponse, observable, progress, retry} from 'get-it/middleware'
import {Observable} from 'rxjs'

import type {Any} from '../types'
import {ClientError, ServerError} from './errors'

const httpError = {
  onResponse: (res: Any, context: HttpContext) => {
    if (res.statusCode >= 500) {
      throw new ServerError(res)
    } else if (res.statusCode >= 400) {
      throw new ClientError(res, context)
    }

    return res
  },
}

function printWarnings(config: {ignoreWarnings?: string | RegExp | Array<string | RegExp>} = {}) {
  const seen: Record<string, boolean> = {}

  // Helper function to check if a warning should be ignored
  const shouldIgnoreWarning = (message: string): boolean => {
    if (config.ignoreWarnings === undefined) return false

    const patterns = Array.isArray(config.ignoreWarnings)
      ? config.ignoreWarnings
      : [config.ignoreWarnings]

    return patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return message.includes(pattern)
      } else if (pattern instanceof RegExp) {
        return pattern.test(message)
      }
      return false
    })
  }

  return {
    onResponse: (res: Any) => {
      const warn = res.headers['x-sanity-warning']
      const warnings = Array.isArray(warn) ? warn : [warn]
      for (const msg of warnings) {
        if (!msg || seen[msg]) continue

        // Skip warnings that match ignore patterns
        if (shouldIgnoreWarning(msg)) {
          continue
        }

        seen[msg] = true
        console.warn(msg) // eslint-disable-line no-console
      }
      return res
    },
  }
}

type HttpRequestConfig = {
  ignoreWarnings?: string | RegExp | Array<string | RegExp>
}

/** @internal */
export function defineHttpRequest(
  envMiddleware: Middlewares,
  config: HttpRequestConfig = {},
): Requester {
  return getIt([
    retry({shouldRetry}),
    ...envMiddleware,
    printWarnings(config),
    jsonRequest(),
    jsonResponse(),
    progress(),
    httpError,
    observable({implementation: Observable}),
  ])
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shouldRetry(err: any, attempt: number, options: any) {
  // Allow opting out of retries
  if (options.maxRetries === 0) return false

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
