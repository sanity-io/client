import {getDraftId, getVersionId} from '@sanity/client/csm'
import {customAlphabet} from 'nanoid'

import type {IdentifiedSanityDocumentStub, SanityDocumentStub} from '../types'
import {validateVersionIdMatch} from '../validators'

/**
 * @internal
 *
 * ~24 years (or 7.54e+8 seconds) needed, in order to have a 1% probability of at least one collision if 10 ID's are generated every hour.
 */
export const generateReleaseId = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  8,
)

/** @internal */
export const getDocumentVersionId = (publishedId: string, releaseId?: string) =>
  releaseId ? getVersionId(publishedId, releaseId) : getDraftId(publishedId)

/** @internal */
export function deriveDocumentVersionId(
  op: string,
  {
    releaseId,
    publishedId,
    document,
  }: {
    releaseId?: string
    publishedId?: string
    document: SanityDocumentStub | IdentifiedSanityDocumentStub
  },
): string {
  if (publishedId && document._id) {
    const documentVersionId = getDocumentVersionId(publishedId, releaseId)
    validateVersionIdMatch(documentVersionId, document)
    return documentVersionId
  }

  if (document._id) {
    return document._id
  }

  if (publishedId) {
    return getDocumentVersionId(publishedId, releaseId)
  }

  throw new Error(`${op}() requires either a publishedId or a document with an _id`)
}
