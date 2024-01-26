export * from '../defineCreateClient'

import defineCreateClientExports from '../defineCreateClient'
import envMiddleware from '../http/nodeMiddleware'
import {SanityClient} from '../SanityClient'
import type {ClientConfig} from './types'

const exp = defineCreateClientExports<SanityClient, ClientConfig>(envMiddleware, SanityClient)

export * from './shared'

/** @public */
export const requester = exp.requester

/** @public */
export const createClient = exp.createClient
