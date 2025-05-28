import {type Observable} from 'rxjs'

import {_request} from '../../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {
  AgentActionPath,
  AgentActionPathSegment,
  Any,
  GenerateTargetDocument,
  HttpRequest,
  IdentifiedSanityDocumentStub,
} from '../../types'
import {hasDataset} from '../../validators'
import type {AgentActionAsync, AgentActionSchema, AgentActionSync} from './commonTypes'

/**  @beta */
export type PatchOperation = 'set' | 'append' | 'mixed' | 'unset'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNonNullable = Exclude<any, null | undefined>

/**  @beta */
export interface PatchRequestBase extends AgentActionSchema {
  /**
   * Target defines which parts of the document will be affected by the instruction.
   * It can be an array, so multiple parts of the document can be separately configured in detail.
   *
   * Omitting target implies that the document itself is the root.
   *
   * Notes:
   * - instruction can only affect fields up to `maxPathDepth`
   * - when multiple targets are provided, they will be coalesced into a single target sharing a common target root.
   * It is therefore an error to provide conflicting include/exclude across targets (ie, include title in one, and exclude it in another)
   *
   * @see AgentActionRequestBase#conditionalPaths
   */
  target: PatchTarget | PatchTarget[]
}

/**  @beta */
export type PatchTarget = {
  /**
   * Determines how the target path will be patched.
   *
   * ### Operation types
   * - `'set'` – an *overwriting* operation: sets the full field value for primitive targets, and merges the provided value with existing values for objects
   * - `'append'`:
   *    – array fields: appends new items to the end of the array,
   *    - string fields: '"existing content" "new content"'
   *    - text fields: '"existing content"\\n"new content"'
   *    - number fields: existing + new
   *    - other field types not mentioned will set instead (dates, url)
   * - `'mixed'` –  sets non-array fields, and appends to array fields
   * - `'unset'` – removes whatever value is on the target path
   *
   * All operations except unset requires a `value`.
   *
   * #### Appending in the middle of arrays
   * To append to an array, use the 'append' operation, and provide an array value with one or more array items.
   *
   * `target: {path: ['array'], operation: 'append', value: [{_type: 'item' _key: 'a'}]}` will append the items in the value to the existing array.
   *
   * To insert in the middle of the array, use `target: {path: ['array', {_key: 'appendAfterKey'}], operation: 'append', value: [{_type: 'item' _key: 'a'}]}`.
   * Here, `{_type: 'item' _key: 'a'}` will be appended after the array item with key `'appendAfterKey'`
   *
   * It is optional to provide a _key for inserted array items; if one isn't provided, it will be generated.
   */
  operation: PatchOperation

  path: AgentActionPathSegment | AgentActionPath
} & (
  | {operation: 'unset'; value?: never}
  | {operation: Exclude<PatchOperation, 'unset'>; value: AnyNonNullable}
)

/**
 * Patches an existing document
 * @beta
 */
interface PatchExistingDocumentRequest {
  /**
   * @see #AgentActionSchema.forcePublishedWrite
   */
  documentId: string
  targetDocument?: never
}

/**
 * Create a new document, then patch it
 * @beta
 */
interface PatchTargetDocumentRequest<T extends Record<string, Any> = Record<string, Any>> {
  /**
   * @see #AgentActionSchema.forcePublishedWrite
   */
  targetDocument: GenerateTargetDocument<T>
  documentId?: never
}

/** @beta */
export type PatchDocumentSync<T extends Record<string, Any> = Record<string, Any>> = (
  | PatchExistingDocumentRequest
  | PatchTargetDocumentRequest<T>
) &
  PatchRequestBase &
  AgentActionSync

/** @beta */
export type PatchDocumentAsync<T extends Record<string, Any> = Record<string, Any>> = (
  | PatchExistingDocumentRequest
  | PatchTargetDocumentRequest<T>
) &
  PatchRequestBase &
  AgentActionAsync

/** @beta */
export type PatchDocument<T extends Record<string, Any> = Record<string, Any>> =
  | PatchDocumentSync<T>
  | PatchDocumentAsync<T>

export function _patch<DocumentShape extends Record<string, Any>>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  request: PatchDocument<DocumentShape>,
): Observable<
  (typeof request)['async'] extends true
    ? {_id: string}
    : IdentifiedSanityDocumentStub & DocumentShape
> {
  const dataset = hasDataset(client.config())
  return _request(client, httpRequest, {
    method: 'POST',
    uri: `/agent/action/patch/${dataset}`,
    body: request,
  })
}
