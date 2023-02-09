import {getIt, type Middlewares} from 'get-it'
import {jsonRequest, jsonResponse, observable, progress} from 'get-it/middleware'
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
export function defineHttpRequest(envMiddleware: Middlewares): HttpRequest {
  const request = getIt([
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
