export * from '@sanity/client'
import {
  createClient as originalCreateClient,
  ObservableSanityClient,
  requester as originalRequester,
  SanityClient,
} from '@sanity/client'

export {encodeIntoResult} from './encodeIntoResult'
export {stegaClean, vercelStegaCleanAll} from './stegaClean'
export {stegaEncodeSourceMap} from './stegaEncodeSourceMap'
export * from './types'

/**
 * @deprecated -- Use `import {SanityClient} from '@sanity/client'` instead
 * @public
 */
export class SanityStegaClient extends SanityClient {}

/**
 * @deprecated -- Use `import {ObservableSanityClient} from '@sanity/client'` instead
 * @public
 */
export class ObservableSanityStegaClient extends ObservableSanityClient {}

/**
 * @deprecated -- Use `import {requester} from '@sanity/client'` instead
 * @public
 */
export const requester = originalRequester

/**
 * @deprecated -- Use `import {createClient} from '@sanity/client'` instead
 * @public
 */
export const createClient = originalCreateClient
