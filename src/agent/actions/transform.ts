import type {
  AgentActionAsync,
  AgentActionPathSegment,
  AgentActionRequestBase,
  AgentActionSync,
  AgentActionTarget,
  AgentActionTargetInclude,
} from '@sanity/client/agent/actions/commonTypes'
import {type Observable} from 'rxjs'

import {_request} from '../../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {AgentActionParams, Any, HttpRequest, IdentifiedSanityDocumentStub} from '../../types'
import {hasDataset} from '../../validators'

/**  @beta */
export interface TransformRequestBase extends AgentActionRequestBase {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string

  documentId: string
  targetDocument?: TransformTargetDocument

  /** string template using $variable  */
  transformation: string
  /** param values for the string template, keys are the variable name, ie if the template has "$variable", one key must be "variable" */
  transformationParams?: AgentActionParams

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
   * @see AgentActionRequestBase#conditionalPaths
   */
  target?: TransformTarget | TransformTarget[]
}

/**  @beta */
export type TransformTargetDocument =
  | {operation: 'get'; _id: string}
  | {operation: 'create'; _id?: string}
  | {operation: 'createIfNotExists'; _id: string}
  | {operation: 'createOrReplace'; _id: string}

/**  @beta */
export interface TransformTargetInclude extends AgentActionTargetInclude {
  /** string template using $variable from instructionParams  */
  transformation?: string

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
  /** string template using $variable from instructionParams  */
  transformation?: string

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
export type TransformDocumentSync = TransformRequestBase & AgentActionSync

/** @beta */
export type TransformDocumentAsync = TransformRequestBase & AgentActionAsync

/** @beta */
export type TransformDocument = TransformDocumentSync | TransformDocumentAsync

export function _transform<
  DocumentShape extends Record<string, Any>,
  Req extends TransformDocument,
>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  request: Req,
): Observable<
  Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
> {
  const dataset = hasDataset(client.config())
  return _request(client, httpRequest, {
    method: 'POST',
    uri: `/agent/action/transform/${dataset}`,
    body: request,
  })
}
