import {createSourceDocumentResolver} from './createSourceDocumentResolver'
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
  ) =>
    | (Partial<SanityDocument> & Required<Pick<SanityDocument, '_id' | '_type'>>)
    | null
    | undefined,
  updateFn: ApplySourceDocumentsUpdateFunction,
  perspective: Exclude<ClientPerspective, 'raw'>,
): Result {
  if (!resultSourceMap) return result

  const resolveDocument = createSourceDocumentResolver(getCachedDocument, perspective)
  const cachedDocuments = resultSourceMap.documents?.map?.(resolveDocument) || []

  return walkMap(JSON.parse(JSON.stringify(result)), (value, path) => {
    const resolveMappingResult = resolveMapping(path, resultSourceMap)
    if (!resolveMappingResult) {
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
      const cachedDocument = cachedDocuments[mapping.source.document]

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
