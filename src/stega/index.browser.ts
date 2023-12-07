export * from '../defineCreateClient'

import defineCreateClientExports from '../defineCreateClient'
import envMiddleware from '../http/browserMiddleware'
import {SanityStegaClient} from './SanityStegaClient'
import type {ClientStegaConfig} from './types'

const exp = defineCreateClientExports<SanityStegaClient, ClientStegaConfig>(
  envMiddleware,
  SanityStegaClient,
)

export type {ObservableSanityClient, SanityClient} from './shared'
export * from './shared'

/** @public */
export const requester = exp.requester

/** @public */
export const createClient = exp.createClient
