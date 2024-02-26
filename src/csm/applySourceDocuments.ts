import {DRAFTS_PREFIX, getPublishedId} from './getPublishedId'
import {parseJsonPath} from './jsonPath'
import {resolveMapping} from './resolveMapping'
import * as paths from './studioPath'
import type {
  Any,
  ApplySourceDocumentsUpdateFunction,
  ClientPerspective,
  ContentSourceMap,
  ContentSourceMapDocuments,
  Path,
  SanityDocument,
} from './types'
import {walkMap} from './walkMap'

const defaultUpdateFunction = <T = unknown>(changed: T): T => changed

/**
 * Optimistically applies source documents to a result, using the content source map to trace fields.
 * Can be used to apply mutations to documents being edited in a Studio, or any mutation on Content Lake, to a result with extremely low latency.
 * @alpha
 */
export function applySourceDocuments<Result = unknown>(
  result: Result,
  resultSourceMap: ContentSourceMap | undefined,
  getCachedDocument: (
    sourceDocument: ContentSourceMapDocuments[number],
  ) => Partial<SanityDocument> | null | undefined,
  updateFn: ApplySourceDocumentsUpdateFunction = defaultUpdateFunction,
  perspective: ClientPerspective = 'raw',
): Result {
  if (!resultSourceMap) return result

  if (perspective !== 'published' && perspective !== 'raw' && perspective !== 'previewDrafts') {
    throw new Error(`Unknown perspective "${perspective}"`)
  }

  return walkMap(JSON.parse(JSON.stringify(result)), (value, path) => {
    const resolveMappingResult = resolveMapping(path, resultSourceMap)
    if (!resolveMappingResult) {
      // console.warn('no mapping for path', path)
      return value
    }

    const {mapping, pathSuffix} = resolveMappingResult
    if (mapping.type !== 'value') {
      return value
    }

    if (mapping.source.type !== 'documentValue') {
      return value
    }

    const sourceDocument = resultSourceMap.documents[mapping.source.document]
    const sourcePath = resultSourceMap.paths[mapping.source.path]

    if (sourceDocument) {
      const parsedPath = parseJsonPath(sourcePath + pathSuffix)
      const stringifiedPath = paths.toString(parsedPath as Path)

      // The _id is sometimes used used as `key` in lists, and should not be changed optimistically
      if (stringifiedPath === '_id') {
        return value
      }

      let cachedDocument: Partial<SanityDocument> | null | undefined
      if (perspective === 'previewDrafts') {
        cachedDocument = getCachedDocument(
          sourceDocument._id.startsWith(DRAFTS_PREFIX)
            ? sourceDocument
            : {...sourceDocument, _id: `${DRAFTS_PREFIX}${sourceDocument._id}}`},
        )
        if (!cachedDocument) {
          cachedDocument = getCachedDocument(
            sourceDocument._id.startsWith(DRAFTS_PREFIX)
              ? {...sourceDocument, _id: getPublishedId(sourceDocument._id)}
              : sourceDocument,
          )
        }
        if (cachedDocument) {
          cachedDocument = {
            ...cachedDocument,
            _id: getPublishedId(sourceDocument._id),
            _originalId: sourceDocument._id,
          }
        }
      } else {
        cachedDocument = getCachedDocument(sourceDocument)
      }

      if (!cachedDocument) {
        return value
      }

      const changedValue = cachedDocument
        ? paths.get<Result[keyof Result]>(cachedDocument, stringifiedPath, value)
        : value
      return value === changedValue
        ? value
        : updateFn<Result[keyof Result]>(changedValue as Any, {
            cachedDocument,
            previousValue: value as Result[keyof Result],
            sourceDocument,
            sourcePath: parsedPath,
          })
    }

    return value
  }) as Result
}
