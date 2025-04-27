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
import type {
  AgentActionParams,
  Any,
  HttpRequest,
  IdentifiedSanityDocumentStub,
  SanityDocumentStub,
} from '../../types'
import {hasDataset} from '../../validators'

/**  @beta */
export type GenerateOperation = 'set' | 'append' | 'mixed'

/**  @beta */
export interface GenerateRequestBase extends AgentActionRequestBase {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string
  /** string template using $variable  */
  instruction: string
  /** param values for the string template, keys are the variable name, ie if the template has "$variable", one key must be "variable" */
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
   *    - string fields: '<existing content> <new content>'
   *    - text fields: '<existing content>\n<new content>'
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

/**
 * Instruction for an existing document.
 * @beta
 */
interface GenerateExistingDocumentRequest {
  documentId: string
  createDocument?: never
}

/**
 * Instruction to create a new document
 * @beta
 */
interface GenerateCreateDocumentRequest<T extends Record<string, Any> = Record<string, Any>> {
  createDocument: {
    /** if no _id is provided, one will be generated. _id is always returned when the requests succeed */
    _id?: string
    _type: string
  } & SanityDocumentStub<T>
  documentId?: never
}

/** @beta */
export type GenerateSyncInstruction<T extends Record<string, Any> = Record<string, Any>> = (
  | GenerateExistingDocumentRequest
  | GenerateCreateDocumentRequest<T>
) &
  GenerateRequestBase &
  AgentActionSync

/** @beta */
export type GenerateAsyncInstruction<T extends Record<string, Any> = Record<string, Any>> = (
  | GenerateExistingDocumentRequest
  | GenerateCreateDocumentRequest<T>
) &
  GenerateRequestBase &
  AgentActionAsync

/** @beta */
export type GenerateInstruction<T extends Record<string, Any> = Record<string, Any>> =
  | GenerateSyncInstruction<T>
  | GenerateAsyncInstruction<T>

export function _generate<
  DocumentShape extends Record<string, Any>,
  Req extends GenerateInstruction<DocumentShape>,
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
    uri: `/agent/action/generate/${dataset}`,
    body: request,
  })
}
