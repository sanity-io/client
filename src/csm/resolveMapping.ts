import {jsonPath, jsonPathArray, jsonPathToMappingPath} from './jsonPath'
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

  const resultMappingPathArray = jsonPathArray(jsonPathToMappingPath(resultPath))
  for (let i = resultMappingPathArray.length - 1; i >= 0; i--) {
    const key = `$${resultMappingPathArray.slice(0, i).join('')}`
    const mappingFound = csm.mappings[key]
    if (mappingFound) {
      const pathSuffix = resultMappingPath.substring(key.length)
      return {mapping: mappingFound, matchedPath: key, pathSuffix}
    }
  }

  return undefined
}
