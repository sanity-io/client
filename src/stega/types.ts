import type {
  ContentSourceMap,
  ContentSourceMapDocuments,
  ContentSourceMapParsedPath,
  ResolveStudioUrl,
  StudioUrl,
} from '../csm'
import {ClientConfig, InitializedClientConfig, RawQueryResponse} from '../types'

export type {
  ContentSourceMapParsedPath,
  ContentSourceMapParsedPathKeyedSegment,
  StudioBaseRoute,
  StudioBaseUrl,
  StudioUrl,
} from '../csm/types'
export type * from '../types'

export type {ContentSourceMap, ResolveStudioUrl}

/** @public */
export type ContentSourceMapQueryResponse =
  | RawQueryResponse<unknown>
  | Pick<RawQueryResponse<unknown>, 'result' | 'resultSourceMap'>

/** @public */
export interface StegaConfig {
  /**
     * Enable or disable stega encoded strings in query results
     * ```ts
      {
        enabled: process.env.VERCEL_ENV !== 'production'
      }
    * ```
    * @defaultValue `false`
    */
  enabled?: boolean

  /**
   * Where the Studio is hosted.
   * If it's embedded in the app, use the base path for example `/studio`.
   * Otherwise provide the full URL to where the Studio is hosted, for example: `https://blog.sanity.studio`.
   *
   */
  studioUrl?: StudioUrl | ResolveStudioUrl

  filter?: FilterDefault

  /**
   * Specify a `console.log` compatible logger to see debug logs, which keys are encoded and which are not.
   */
  logger?: Logger
  /**
   * Set to `true` to omit cross dataset reference specific data from encoded strings
   */
  omitCrossDatasetReferenceData?: boolean
}

/** @public */
export type StegaConfigRequiredKeys = Extract<keyof StegaConfig, 'enabled'>

/** @public */
export type InitializedStegaConfig = Omit<StegaConfig, StegaConfigRequiredKeys> &
  Required<Pick<StegaConfig, StegaConfigRequiredKeys>>

/**
 * @public
 * @deprecated -- use `ClientConfig` instead
 */
export interface ClientStegaConfig extends ClientConfig {}

/**
 * @public
 * @deprecated -- use `InitializedClientConfig` instead
 */
export interface InitializedClientStegaConfig extends InitializedClientConfig {}

/** @public */
export type FilterDefault = (props: {
  /**
   * The path to the value in the source document, for example if you queried for a document like this:
   * `*[_type == "author"][0]{"slug": slug.current}`
   * Then the `sourcePath` for `result.slug` would be `['slug', 'current']`.
   *
   */
  sourcePath: ContentSourceMapParsedPath
  /**
   * If `sourcePath` alone isn't enough to tell you if it's safe to contain stega strings, then you can use `sourceDocument`
   * for additional metadata.
   * It'll always have a `_type` property, which can be used to trace it to the Studio Schema that were used initially.
   * It also has `_id` to help you debug and look at the whole document when troubleshooting.
   * Finally, if the document origins in a Cross Dataset Reference you'll also have `_projectId` and `_dataset` properties to help you trace it.
   */
  sourceDocument: ContentSourceMapDocuments[number]
  /**
   * If you don't colocate your Studio Schemas with your GROQ queries it might be hard to make sense of `sourcePath`,
   * as it operates on the original shape of a document.
   * In that case `resultPath` can be used, as it mirrors the path to the value in the result.
   * For example in a query like this:
   * `*[_type == "author"][0]{"slug": slug.current}`
   * The `resultPath` for `result.slug` would be `['slug']`, while `sourcePath` will be `['slug', 'current']`.
   */
  resultPath: ContentSourceMapParsedPath
  /**
   * You can also use your own string validation logic to determine if it's safe.
   */
  value: string
  /**
   * If you want to keep the default filtering behavior, but only override it for a specific path, you can use `filterDefault` to do that.
   * For example, here all "icon" documents in a Page Builder skips encoding:
   * ```ts
        {
          filter: (props) => {
            switch (props.sourceDocument._type) {
              case 'icon':
                return false
              default:
                return props.filterDefault(props)
            }
          }
        }
       * ```
   */
  filterDefault: FilterDefault
}) => boolean

/** @public */
export type Logger =
  | typeof console
  | Partial<
      Pick<typeof console, 'debug' | 'error' | 'groupCollapsed' | 'groupEnd' | 'log' | 'table'>
    >

/**
 * @internal
 */
export type Encoder = (context: {
  sourcePath: ContentSourceMapParsedPath
  sourceDocument: ContentSourceMapDocuments[number]
  resultPath: ContentSourceMapParsedPath
  value: string
}) => string
