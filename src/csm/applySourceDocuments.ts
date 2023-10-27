import {parseJsonPath} from './jsonPath'
import {resolveMapping} from './resolveMapping'
import * as paths from './studioPath'
import type {
  Any,
  ApplySourceDocumentsUpdateFunction,
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
  ) => SanityDocument | undefined,
  updateFn: ApplySourceDocumentsUpdateFunction = defaultUpdateFunction,
): Result {
  if (!resultSourceMap) return result

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
      const cachedDocument = getCachedDocument(sourceDocument)
      if (!cachedDocument) {
        return value
      }

      const parsedPath = parseJsonPath(sourcePath + pathSuffix)
      const changedValue = cachedDocument
        ? paths.get<Result[keyof Result]>(cachedDocument, paths.toString(parsedPath as Path), value)
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
