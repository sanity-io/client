import {type Observable} from 'rxjs'

import {_request} from '../../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {AgentActionParams, Any, HttpRequest, IdentifiedSanityDocumentStub} from '../../types'
import {hasDataset} from '../../validators'
import type {
  AgentActionAsync,
  AgentActionPathSegment,
  AgentActionRequestBase,
  AgentActionSync,
  AgentActionTarget,
  AgentActionTargetInclude,
} from './commonTypes'

/**  @beta */
export type GenerateOperation = 'set' | 'append' | 'mixed'

/**  @beta */
export interface GenerateRequestBase extends AgentActionRequestBase {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string
  /**
   * Instruct the LLM how it should generate content. Be as specific and detailed as needed.
   *
   * The LLM only has access to information in the instruction, plus the target schema.
   *
   * String template with support for $variable from `instructionParams`.
   * */
  instruction: string
  /**
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
   * client.agent.action.generate({
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
   * client.agent.action.generate({
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
   * client.agent.action.generate({
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
   * client.agent.action.generate({
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
   *   target: {path: 'title' }
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
   * ## Generating images
   *
   * Generate will generate images the same was as AI Assist, for images that have been configured using
   * [AI Assist schema options](https://github.com/sanity-io/assist/tree/main/plugin#image-generation).
   *
   * To generate images _without_ changing the schema, directly target an image asset path.
   *
   * For example, all the following will generate an image into the provided asset:
   * * `target: {path: ['image', 'asset'] }`
   * * `target: {path: 'image', include: ['asset'] }`
   *
   * Image generation can be combined with regular content targets:
   * * `target: [{path: ['image', 'asset'] }, {include: ['title', 'description']}]`
   *
   * Since Generate happens in a single LLM pass, the image will be contextually related to other generated content.
   * @see AgentActionRequestBase#conditionalPaths
   */
  target?: GenerateTarget | GenerateTarget[]
}

/**  @beta */
export interface GenerateTargetInclude extends AgentActionTargetInclude {
  /**
   * Sets the operation for this path, and all its children.
   * This overrides any operation set parents or the root target.
   * @see #GenerateTarget.operation
   * @see #include
   */
  operation?: GenerateOperation

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Fields or array items not on the include list, are implicitly excluded.
   */
  include?: (AgentActionPathSegment | GenerateTargetInclude)[]
}

/**  @beta */
export interface GenerateTarget extends AgentActionTarget {
  /**
   * Sets the default operation for all paths in the target.
   * Generate runs in `'mixed'` operation mode by default:
   * Changes are set in all non-array fields, and append to all array fields.
   *
   * ### Operation types
   * - `'set'` – an *overwriting* operation, and replaces the full field value.
   * - `'append'`:
   *    – array fields: appends new items to the end of the array,
   *    - string fields: '"existing content" "new content"'
   *    - text fields: '"existing content"\\n"new content"'
   *    - number fields: existing + new
   *    - other field types not mentioned will set instead (dates, url)
   * - `'mixed'` – (default) sets non-array fields, and appends to array fields
   *
   * The default operation can be overridden on a per-path basis using `include`.
   *
   * Nested fields inherit the operation specified by their parent and falls back to the
   * top level target operation if not otherwise specified.
   *
   * Use `include` to change the `operation` of individual fields or items.
   *
   * #### Appending in the middle of arrays
   * `target: {path: ['array'], operation: 'append'}` will append the output of the instruction to the end of the array.
   *
   * To insert in the middle of the array, use `target: {path: ['array', {_key: 'appendAfterKey'}], operation: 'append'}`.
   * Here, the output of the instruction will be appended after the array item with key `'appendAfterKey'`.
   *
   * @see #AgentActionTargetInclude.operation
   * @see #include
   * @see #AgentActionTargetInclude.include
   * @see #AgentActionSchema.forcePublishedWrite
   */
  operation?: GenerateOperation

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Fields or array items not on the include list, are implicitly excluded.
   */
  include?: (AgentActionPathSegment | GenerateTargetInclude)[]
}

/**  @beta */
export type GenerateTargetDocument<T extends Record<string, Any> = Record<string, Any>> =
  | {
      operation: 'edit'
      /**
       * @see #AgentActionSchema.forcePublishedWrite
       */
      _id: string
    }
  | {
      operation: 'create'
      /**
       * @see #AgentActionSchema.forcePublishedWrite
       */
      _id?: string
      _type: string
      initialValues?: T
    }
  | {
      operation: 'createIfNotExists'
      /**
       * @see #AgentActionSchema.forcePublishedWrite
       */
      _id: string
      _type: string
      initialValues?: T
    }
  | {
      operation: 'createOrReplace'
      /**
       * @see #AgentActionSchema.forcePublishedWrite
       */
      _id: string
      _type: string
      initialValues?: T
    }

/**
 * Instruction for an existing document.
 * @beta
 */
interface GenerateExistingDocumentRequest {
  /**
   * @see #AgentActionSchema.forcePublishedWrite
   */
  documentId: string
  targetDocument?: never
}

/**
 * Instruction to create a new document
 * @beta
 */
interface GenerateTargetDocumentRequest<T extends Record<string, Any> = Record<string, Any>> {
  /**
   * @see #AgentActionSchema.forcePublishedWrite
   */
  targetDocument: GenerateTargetDocument<T>
  documentId?: never
}

/** @beta */
export type GenerateSyncInstruction<T extends Record<string, Any> = Record<string, Any>> = (
  | GenerateExistingDocumentRequest
  | GenerateTargetDocumentRequest<T>
) &
  GenerateRequestBase &
  AgentActionSync

/** @beta */
export type GenerateAsyncInstruction<T extends Record<string, Any> = Record<string, Any>> = (
  | GenerateExistingDocumentRequest
  | GenerateTargetDocumentRequest<T>
) &
  GenerateRequestBase &
  AgentActionAsync

/** @beta */
export type GenerateInstruction<T extends Record<string, Any> = Record<string, Any>> =
  | GenerateSyncInstruction<T>
  | GenerateAsyncInstruction<T>

export function _generate<DocumentShape extends Record<string, Any>>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  request: GenerateInstruction<DocumentShape>,
): Observable<
  (typeof request)['async'] extends true
    ? {_id: string}
    : IdentifiedSanityDocumentStub & DocumentShape
> {
  const dataset = hasDataset(client.config())
  return _request(client, httpRequest, {
    method: 'POST',
    uri: `/agent/action/generate/${dataset}`,
    body: request,
  })
}
