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

/** @beta */
export interface TransformRequestBase extends AgentActionRequestBase {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string

  /**
   * The source document the transformation will use as input.
   */
  documentId: string

  /**
   * The source document's content is first copied to the target,
   * then it is transformed according to the instruction.
   *
   * When omitted, the source document (documentId) is also the target document.
   */
  targetDocument?: TransformTargetDocument

  /**
   * Instruct the LLM how to transform the input to th output.
   *
   * String template using $variable from instructionParams.
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
   * @see AgentActionRequestBase#conditionalPaths
   */
  target?: TransformTarget | TransformTarget[]
}

/**  @beta */
export type TransformTargetDocument =
  | {operation: 'edit'; _id: string}
  | {operation: 'create'; _id?: string}
  | {operation: 'createIfNotExists'; _id: string}
  | {operation: 'createOrReplace'; _id: string}

/**  @beta */
export interface TransformTargetInclude extends AgentActionTargetInclude {
  /**
   * Specifies a tailored instruction of this target.
   *
   * string template using $variable from instructionParams  */
  instruction?: string

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Fields or array items not on the include list, are implicitly excluded.
   */
  include?: (AgentActionPathSegment | TransformTargetInclude)[]
}

/**  @beta */
export interface TransformTarget extends AgentActionTarget {
  /**
   * Specifies a tailored instruction of this target.
   *
   * string template using $variable from instructionParams.
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
