import defineCreateClientExports, {type ClientConfig, SanityClient} from './defineCreateClient'
import {defineDeprecatedCreateClient} from './defineDeprecatedCreateClient'
import envMiddleware from './http/nodeMiddleware'

export * from './defineCreateClient'

const exp = defineCreateClientExports<SanityClient, ClientConfig>(envMiddleware, SanityClient)

/** @public */
export const requester = exp.requester

/**
 * @remarks
 * As of API version `v2025-02-19`, the default perspective used by the client has changed from `raw` to `published`. {@link https://www.sanity.io/changelog/676aaa9d-2da6-44fb-abe5-580f28047c10|Changelog}
 * @public
 */
export const createClient = exp.createClient

/**
 * @public
 * @deprecated Use the named export `createClient` instead of the `default` export
 */
const deprecatedCreateClient = defineDeprecatedCreateClient(createClient)
export default deprecatedCreateClient
