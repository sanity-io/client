export {encodeIntoResult} from './encodeIntoResult'
export * from './SanityStegaClient'
export {stegaEncodeSourceMap} from './stegaEncodeSourceMap'
export * from './types'
export {vercelStegaCleanAll} from './vercelStegaCleanAll'

/**
 * @deprecated -- Use `import type {SanityClient} from '@sanity/client'` instead
 * @public
 */
export type SanityClient = never

/**
 * @deprecated -- Use `import type {ObservableSanityClient} from '@sanity/client'` instead
 * @public
 */
export type ObservableSanityClient = never
