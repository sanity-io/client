import {
  getDraftId,
  getVersionFromId,
  getVersionId,
  isDraftId,
  isVersionId,
} from '@sanity/client/csm'
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
    const versionId = getDocumentVersionId(publishedId, releaseId)
    validateVersionIdMatch(versionId, document)
    return versionId
  }

  if (document._id) {
    const isDraft = isDraftId(document._id)
    const isVersion = isVersionId(document._id)

    if (!isDraft && !isVersion) {
      throw new Error(
        `\`${op}()\` requires a document with an \`_id\` that is a version or draft ID`,
      )
    }

    if (releaseId) {
      if (isDraft) {
        throw new Error(
          `\`${op}()\` was called with a document ID (\`${document._id}\`) that is a draft ID, but a release ID (\`${releaseId}\`) was also provided.`,
        )
      }

      const builtVersionId = getVersionFromId(document._id)
      if (builtVersionId !== releaseId) {
        throw new Error(
          `\`${op}()\` was called with a document ID (\`${document._id}\`) that is a version ID, but the release ID (\`${releaseId}\`) does not match the document's version ID (\`${builtVersionId}\`).`,
        )
      }
    }

    return document._id
  }

  if (publishedId) {
    return getDocumentVersionId(publishedId, releaseId)
  }

  throw new Error(`\`${op}()\` requires either a publishedId or a document with an \`_id\``)
}
