import {jsonPath, jsonPathToMappingPath} from './jsonPath'
import type {ContentSourceMap, ContentSourceMapMapping, ContentSourceMapParsedPath} from './types'

/**
 * @internal
 */
export function resolveMapping(
  resultPath: ContentSourceMapParsedPath,
  csm?: ContentSourceMap,
):
  | {
      mapping: ContentSourceMapMapping
      matchedPath: string
      pathSuffix: string
    }
  | undefined {
  if (!csm?.mappings) {
    return undefined
  }
  const resultMappingPath = jsonPath(jsonPathToMappingPath(resultPath))

  if (csm.mappings[resultMappingPath] !== undefined) {
    return {
      mapping: csm.mappings[resultMappingPath],
      matchedPath: resultMappingPath,
      pathSuffix: '',
    }
  }

  const mappings = Object.entries(csm.mappings)
    .filter(([key]) => resultMappingPath.startsWith(key))
    .sort(([key1], [key2]) => key2.length - key1.length)

  if (mappings.length == 0) {
    return undefined
  }

  const [matchedPath, mapping] = mappings[0]
  const pathSuffix = resultMappingPath.substring(matchedPath.length)
  return {mapping, matchedPath, pathSuffix}
}
