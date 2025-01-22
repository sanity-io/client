import {getDraftId, getPublishedId, getVersionId} from './draftUtils'
import {resolvePerspectives} from './resolvePerspectives'
import type {ClientPerspective, ContentSourceMapDocuments, SanityDocument} from './types'

/** @internal */
export type ResolvedDocument = Partial<SanityDocument> &
  Required<Pick<SanityDocument, '_id' | '_type'>>

/** @internal */
export type MatchedDocument = Partial<SanityDocument> &
  Required<Pick<SanityDocument, '_id' | '_type' | '_originalId'>>

/** @internal */
export function createSourceDocumentResolver(
  getCachedDocument: (
    sourceDocument: ContentSourceMapDocuments[number],
  ) => ResolvedDocument | null | undefined,
  _perspective: Exclude<ClientPerspective, 'raw'>,
) {
  const perspectives = resolvePerspectives(_perspective)
  function findDocument(sourceDocument: ContentSourceMapDocuments[number]) {
    for (const perspective of perspectives) {
      let match: ReturnType<typeof getCachedDocument> = null
      if (perspective.startsWith('r')) {
        match = getCachedDocument({
          ...sourceDocument,
          _id: getVersionId(sourceDocument._id, perspective),
        })
      }
      if (perspective === 'drafts') {
        match = getCachedDocument({
          ...sourceDocument,
          _id: getDraftId(sourceDocument._id),
        })
      }
      if (perspective === 'published') {
        match = getCachedDocument({
          ...sourceDocument,
          _id: getPublishedId(sourceDocument._id),
        })
      }
      if (match) {
        return {...match, _id: getPublishedId(match._id), _originalId: match._id}
      }
    }
    return null
  }
  // define resolver that loops over source documents and perspectives
  return function resolveSourceDocument(
    sourceDocument: ContentSourceMapDocuments[number],
  ): MatchedDocument | null {
    return findDocument(sourceDocument)
  }
}
