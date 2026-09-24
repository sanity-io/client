import {getPublishedId} from '@sanity/client/csm'

import type {ClientConfig} from '../types'
import type {CollaborationCommentDocument} from './types'

/**
 * The resource comments are stored against: one of the client's resource configurations.
 *
 * @internal
 */
export type CommentResource = NonNullable<ClientConfig['resource']>

/**
 * Build the global document reference a comment stores in `target.document._ref`,
 * without a client.
 *
 * `client.collaboration.comments.getTargetDocumentRef` reads the resource off the
 * client's configuration and calls this. Use this directly when the resource is
 * already at hand and no client should be involved, for example inside a state
 * selector that has to stay free of side effects.
 *
 * The reference always names the published document: a draft or version ID is
 * reduced to its published form first.
 *
 * @example
 * ```ts
 * getCommentTargetDocumentRef({type: 'dataset', id: 'abc123.production'}, 'drafts.doc-1')
 * // 'dataset:abc123.production:doc-1'
 * ```
 *
 * @param resource - The resource the comments are stored against, as `ClientConfig['resource']` takes it
 * @param documentId - Document ID, in published, draft or version form
 * @returns Global document reference, of the form `resourceType:resourceId:documentId`
 * @alpha
 */
export function getCommentTargetDocumentRef(
  resource: CommentResource,
  documentId: string,
): CollaborationCommentDocument['target']['document']['_ref'] {
  if (!documentId) {
    throw new Error('Document ID must be provided')
  }

  return `${resource.type}:${resource.id}:${getPublishedId(documentId)}`
}
