export * from '../defineCreateClient'

import defineCreateClientExports from '../defineCreateClient'
import envMiddleware from '../http/nodeMiddleware'
import {SanityClient} from '../SanityClient'
import type {ClientConfig} from './types'

const exp = defineCreateClientExports<SanityClient, ClientConfig>(envMiddleware, SanityClient)

export * from './shared'

/**
 * @deprecated -- Use `import {requester} from '@sanity/client'` instead
 * @public
 */
export const requester = originalRequester

/** @public */
export const createClient = exp.createClient
