/* eslint-disable no-empty-function, no-process-env */
import getIt from 'get-it'
import {observable, jsonRequest, jsonResponse, progress} from 'get-it/middleware'
import {ClientError, ServerError} from './errors'
import envMiddleware from './nodeMiddleware'
import {Observable} from 'rxjs'

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

// Environment-specific middleware.
const envSpecific = envMiddleware

const middleware = envSpecific.concat([
  printWarnings,
  jsonRequest(),
  jsonResponse(),
  progress(),
  httpError,
  observable({implementation: Observable}),
])

const request = getIt(middleware)

function httpRequest(options, requester = request) {
  return requester(Object.assign({maxRedirects: 0}, options))
}

httpRequest.defaultRequester = request
httpRequest.ClientError = ClientError
httpRequest.ServerError = ServerError

export default httpRequest
