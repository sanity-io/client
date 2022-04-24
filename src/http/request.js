/* eslint-disable no-empty-function, no-process-env */
import getIt from 'get-it'
import observable from 'get-it/lib/middleware/observable'
import jsonRequest from 'get-it/lib/middleware/jsonRequest'
import jsonResponse from 'get-it/lib/middleware/jsonResponse'
import progress from 'get-it/lib/middleware/progress'
import {Observable} from '../util/observable'
import {ClientError, ServerError} from './errors'
// Environment-specific middleware.
import {middleware as envSpecific} from './nodeMiddleware'

const httpError = {
  onResponse: (res) => {
    if (res.statusCode >= 500) {
      throw new ServerError(res)
    } else if (res.statusCode >= 400) {
      throw new ClientError(res)
    }

    return res
  },
}

const printWarnings = {
  onResponse: (res) => {
    const warn = res.headers['x-sanity-warning']
    const warnings = Array.isArray(warn) ? warn : [warn]
    warnings.filter(Boolean).forEach((msg) => console.warn(msg)) // eslint-disable-line no-console
    return res
  },
}

const middleware = envSpecific.concat([
  printWarnings,
  jsonRequest(),
  jsonResponse(),
  progress(),
  httpError,
  observable({implementation: Observable}),
])

const request = getIt(middleware)

export function httpRequest(options, requester = request) {
  return requester(Object.assign({maxRedirects: 0}, options))
}

httpRequest.defaultRequester = request
httpRequest.ClientError = ClientError
httpRequest.ServerError = ServerError
