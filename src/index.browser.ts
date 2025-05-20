import defineCreateClientExports, {type ClientConfig, SanityClient} from './defineCreateClient'
import {defineDeprecatedCreateClient} from './defineDeprecatedCreateClient'
import envMiddleware from './http/browserMiddleware'

export * from './defineCreateClient'

const exp = defineCreateClientExports<SanityClient, ClientConfig>(envMiddleware, SanityClient)

/** @public */
export const requester = exp.requester

/** @public */
export const createClient = exp.createClient

/**
 * @public
 * @deprecated Use the named export `createClient` instead of the `default` export
 */
const deprecatedCreateClient = defineDeprecatedCreateClient(createClient)
export default deprecatedCreateClient
