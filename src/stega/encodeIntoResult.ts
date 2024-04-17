import type {ContentSourceMap} from '@sanity/client/csm'

import {parseJsonPath} from '../csm/jsonPath'
import {resolveMapping} from '../csm/resolveMapping'
import {walkMap} from '../csm/walkMap'
import type {Encoder} from './types'

/**
 * @internal
 */
export function encodeIntoResult<Result>(
  result: Result,
  csm: ContentSourceMap,
  encoder: Encoder,
): Result {
  return walkMap(result, (value, path) => {
    // Only map strings, we could extend this in the future to support other types like integers...
    if (typeof value !== 'string') {
      return value
    }

    const resolveMappingResult = resolveMapping(path, csm)
    if (!resolveMappingResult) {
      return value
    }

    const {mapping, matchedPath} = resolveMappingResult
    if (mapping.type !== 'value') {
      return value
    }

    if (mapping.source.type !== 'documentValue') {
      return value
    }

    const sourceDocument = csm.documents[mapping.source.document!]
    const sourcePath = csm.paths[mapping.source.path]

    const matchPathSegments = parseJsonPath(matchedPath)
    const sourcePathSegments = parseJsonPath(sourcePath)
    const fullSourceSegments = sourcePathSegments.concat(path.slice(matchPathSegments.length))

    return encoder({
      sourcePath: fullSourceSegments,
      sourceDocument,
      resultPath: path,
      value,
    })
  }) as Result
}
