import {ObservableSanityClient, SanityClient} from '../SanityClient'

export * from '../SanityClient'
export {encodeIntoResult} from './encodeIntoResult'
export {stegaEncodeSourceMap} from './stegaEncodeSourceMap'
export * from './types'
export {vercelStegaCleanAll} from './vercelStegaCleanAll'

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
