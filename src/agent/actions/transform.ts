import {type Observable} from 'rxjs'

import {_request} from '../../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {
  AgentActionParams,
  AgentActionPath,
  Any,
  HttpRequest,
  IdentifiedSanityDocumentStub,
} from '../../types'
import {hasDataset} from '../../validators'
import type {
  AgentActionAsync,
  AgentActionPathSegment,
  AgentActionRequestBase,
  AgentActionSync,
  AgentActionTarget,
  AgentActionTargetInclude,
} from './commonTypes'

/** @beta */
export interface TransformRequestBase extends AgentActionRequestBase {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string

  /**
   * The source document the transformation will use as input.
   *
   * @see #AgentActionSchema.forcePublishedWrite
   */
  documentId: string

  /**
   * The source document's content is first copied to the target,
   * then it is transformed according to the instruction.
   *
   * When omitted, the source document (documentId) is also the target document.
   *
   *  @see #AgentActionSchema.forcePublishedWrite
   */
  targetDocument?: TransformTargetDocument

  /**
   * Instruct the LLM how to transform the input to th output.
   *
   * String template with support for $variable from `instructionParams`.
   *
   * Capped to 2000 characters, after variables has been injected.
   * */
  instruction: string
  /**
   *
   * param values for the string template, keys are the variable name, ie if the template has "$variable", one key must be "variable"
   *
   * ### Examples
   *
   * #### Constant
   *
   * ##### Shorthand
   * ```ts
   * client.agent.action.generate({
   *   schemaId,
   *   documentId,
   *   instruction: 'Give the following topic:\n $topic \n ---\nGenerate the full article.',
   *   instructionParams: {
   *     topic: 'Grapefruit'
   *   },
   * })
   * ```
   * ##### Object-form
   *
   * ```ts
   * client.agent.action.transform({
   *   schemaId,
   *   documentId,
   *   instruction: 'Give the following topic:\n $topic \n ---\nGenerate the full article.',
   *   instructionParams: {
   *     topic: {
   *       type: 'constant',
   *       value: 'Grapefruit'
   *     },
   *   },
   * })
   * ```
   * #### Field
   * ```ts
   * client.agent.action.transform({
   *   schemaId,
   *   documentId,
   *   instruction: 'Give the following field value:\n $pte \n ---\nGenerate keywords.',
   *   instructionParams: {
   *     pte: {
   *       type: 'field',
   *       path: ['pteField'],
   *     },
   *   },
   *   target: {path: 'keywords' }
   * })
   * ```
   * #### Document
   * ```ts
   * client.agent.action.transform({
   *   schemaId,
   *   documentId,
   *   instruction: 'Give the following document value:\n $document \n ---\nGenerate keywords.',
   *   instructionParams: {
   *     document: {
   *       type: 'document',
   *     },
   *   },
   *   target: {path: 'keywords' }
   * })
   * ```
   *
   * #### GROQ
   * ```ts
   * client.agent.action.transform({
   *   schemaId,
   *   documentId,
   *   instruction: 'Give the following list of titles:\n $list \n ---\nGenerate a similar title.',
   *   instructionParams: {
   *     list: {
   *       type: 'groq',
   *       query: '* [_type==$type].title',
   *       params: {type: 'article'}
   *     },
   *   },
   *   target: {path: 'title'}
   * })
   * ```
   * */
  instructionParams?: AgentActionParams

  /**
   * Target defines which parts of the document will be affected by the instruction.
   * It can be an array, so multiple parts of the document can be separately configured in detail.
   *
   * Omitting target implies that the document itself is the root.
   *
   * Notes:
   * - instruction can only affect fields up to `maxPathDepth`
   * - when multiple targets are provided, they will be coalesced into a single target sharing a common target root.
   * It is therefor an error to provide conflicting include/exclude across targets (ie, include title in one, and exclude it in another)
   *
   * Default max depth for transform: 12
   *
   * ## Transforming images
   *
   * To transform an existing image, directly target an image asset path.
   *
   * For example, all the following will transform the image into the provided asset:
   * * `target: {path: ['image', 'asset'] }`
   * * `target: {path: 'image', include: ['asset'] }`
   *
   * Image transform can be combined with regular content targets:
   * * `target: [{path: ['image', 'asset'] }, {include: ['title', 'description']}]`
   *
   * Image transform can have per-path instructions, just like any other target paths:
   * * `target: [{path: ['image', 'asset'], instruction: 'Make the sky blue' }`
   *
   * @see AgentActionRequestBase#conditionalPaths
   */
  target?: TransformTarget | TransformTarget[]
}

/**
 * @see #AgentActionSchema.forcePublishedWrite
 *
 * @beta
 */
export type TransformTargetDocument =
  | {operation: 'edit'; _id: string}
  | {operation: 'create'; _id?: string}
  | {operation: 'createIfNotExists'; _id: string}
  | {operation: 'createOrReplace'; _id: string}

/**
 *
 * @see #TransformOperation
 * @beta
 */
export type ImageDescriptionOperation = {
  type: 'image-description'
  /**
   * When omitted, parent image value will be inferred from the arget path.
   *
   * When specified, the `sourcePath` should be a path to an image (or image asset) field:
   * - `['image']`
   * - `['wrapper', 'mainImage']`
   * - `['heroImage', 'asset'] // the asset segment is optional, but supported`
   */
  sourcePath?: AgentActionPath
} & (
  | {
      /**
       * When omitted, parent image value will be inferred from the target path.
       *
       * When specified, the `sourcePath` should be a path to an image (or image asset) field:
       * - `['image']`
       * - `['wrapper', 'mainImage']`
       * - `['heroImage', 'asset'] // the asset segment is optional, but supported`
       *
       * Incompatible with `imageUrl`
       *
       */
      sourcePath?: AgentActionPath
      imageUrl?: never
    }
  | {
      /**
       * When specified, the image source to be described will be fetched from the URL.
       *
       * Incompatible with `sourcePath`
       */
      imageUrl?: `https://${string}`
      sourcePath?: never
    }
)

/**
 *
 * ## `set` by default
 * By default, Transform will change the value of every target field in place using a set operation.
 *
 * ## Image description
 *
 * ### Targeting image fields
 * Images can be transformed to a textual description by targeting a `string`, `text` or Portable Text field (`array` with `block`)
 * with `operation: {type: 'image-description'}`.
 *
 * Custom instructions for image description targets will be used to generate the description.
 *
 * Such targets must be a descendant field of an image object.
 *
 * For example:
 * - `target: {path: ['image', 'description'], operation: {type: 'image-description'} }`
 * - `target: {path: ['array', {_key: 'abc'}, 'alt'], operation: {type: 'image-description'} } //assuming the item in the array on the key-ed path is an image`
 * - `target: {path: ['image'], include: ['portableTextField'], operation: {type: 'image-description'}, instruction: 'Use formatting and headings to describe the image in great detail' }`
 *
 * ### Targeting non-image fields
 * If the target image description lives outside an image object, use the `sourcePath` option to specify the path to the image field.
 * `sourcePath` must be an image or image asset field.
 *
 * For example:
 * - `target: {path: ['description'], operation: operation: {type: 'image-description', sourcePath: ['image', 'asset'] }`
 * - `target: {path: ['wrapper', 'title'], operation: {type: 'image-description', sourcePath: ['array', {_key: 'abc'}, 'image'] }`
 * - `target: {path: ['wrapper'], include: ['portableTextField'], operation: {type: 'image-description', sourcePath: ['image', 'asset'] }, instruction: 'Use formatting and headings to describe the image in great detail' }`
 *
 * ### Targeting images outside the document (URL)
 * If the source image is available on a https URL outside the target document, it is possible to get a description for it using `imageUrl`.
 *
 * Example:
 * - `target: {path: ['description'], operation: operation: {type: 'image-description', imageUrL: 'https://www.sanity.io/static/images/favicons/android-icon-192x192.png?v=2' }`
 * @beta
 */
export type TransformOperation = 'set' | ImageDescriptionOperation

/**
 * @see #TransformOperation
 * @beta
 * */
export interface TransformTargetInclude extends AgentActionTargetInclude {
  /**
   * Specifies a tailored instruction of this target.
   *
   * String template with support for $variable from `instructionParams`.  */
  instruction?: string

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Fields or array items not on the include list, are implicitly excluded.
   */
  include?: (AgentActionPathSegment | TransformTargetInclude)[]

  /**
   * Default: `set`
   * @see #TransformOperation
   */
  operation?: TransformOperation
}

/**
 * @see #TransformOperation
 * @beta
 * */
export interface TransformTarget extends AgentActionTarget {
  /**
   * Specifies a tailored instruction of this target.
   *
   * String template with support for $variable from `instructionParams`.
   * */
  instruction?: string

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Fields or array items not on the include list, are implicitly excluded.
   */
  include?: (AgentActionPathSegment | TransformTargetInclude)[]

  /**
   * Default: `set`
   * @see #TransformOperation
   */
  operation?: TransformOperation
}

/** @beta */
// need the generics to hold optional call-site response generics
// eslint-disable-next-line unused-imports/no-unused-vars
export type TransformDocumentSync<T extends Record<string, Any> = Record<string, Any>> =
  TransformRequestBase & AgentActionSync

/** @beta */
export type TransformDocumentAsync = TransformRequestBase & AgentActionAsync

/** @beta */
export type TransformDocument<T extends Record<string, Any> = Record<string, Any>> =
  | TransformDocumentSync<T>
  | TransformDocumentAsync

export function _transform<DocumentShape extends Record<string, Any>>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  request: TransformDocument<DocumentShape>,
): Observable<
  (typeof request)['async'] extends true
    ? {_id: string}
    : IdentifiedSanityDocumentStub & DocumentShape
> {
  const dataset = hasDataset(client.config())
  return _request(client, httpRequest, {
    method: 'POST',
    uri: `/agent/action/transform/${dataset}`,
    body: request,
  })
}
