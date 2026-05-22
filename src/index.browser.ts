import defineCreateClientExports, {type ClientConfig, SanityClient} from './defineCreateClient'
import {defineDeprecatedCreateClient} from './defineDeprecatedCreateClient'
import environment from './http/browserMiddleware'
import type {Requester} from './types'

export * from './defineCreateClient'

const exp = defineCreateClientExports<SanityClient, ClientConfig>(environment, SanityClient)

/** @public */
export const requester: Requester = exp.requester

/** @public */
export const createClient = exp.createClient

/**
 * @public
 * @deprecated Use the named export `createClient` instead of the `default` export
 */
const deprecatedCreateClient = defineDeprecatedCreateClient(createClient)
export default deprecatedCreateClient
