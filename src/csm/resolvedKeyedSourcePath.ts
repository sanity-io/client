import {jsonPath, parseJsonPath} from './jsonPath'
import type {ContentSourceMapParsedPath} from './types'

/**
 * @internal
 */
export function resolvedKeyedSourcePath(options: {
  keyedResultPath: ContentSourceMapParsedPath
  pathSuffix?: string
  sourceBasePath: string
}): ContentSourceMapParsedPath {
  const {keyedResultPath, pathSuffix, sourceBasePath} = options

  const inferredResultPath = pathSuffix === undefined ? [] : parseJsonPath(pathSuffix)

  const inferredPath = keyedResultPath.slice(keyedResultPath.length - inferredResultPath.length)

  const inferredPathSuffix = inferredPath.length ? jsonPath(inferredPath).slice(1) : ''

  return parseJsonPath(sourceBasePath + inferredPathSuffix)
}
