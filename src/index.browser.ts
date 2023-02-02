import envMiddleware from './http/browserMiddleware'
import {defineHttpRequest} from './http/request'
import {SanityClient} from './SanityClient'
import type {ClientConfig} from './types'

export * from './data/patch'
export * from './data/transaction'
export {ClientError, ServerError} from './http/errors'
export * from './SanityClient'
export * from './types'

// Set the http client to use for requests, and its environment specific middleware
const httpRequest = defineHttpRequest(envMiddleware)
/** @public */
export const requester = httpRequest.defaultRequester

/** @public */
export const createClient = (config: ClientConfig) => new SanityClient(httpRequest, config)

export {migrationNotice as default} from './migrationNotice'
