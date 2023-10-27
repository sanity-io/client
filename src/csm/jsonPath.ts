import * as studioPath from './studioPath'
import type {
  ContentSourceMapParsedPath,
  ContentSourceMapParsedPathKeyedSegment,
  ContentSourceMapPaths,
  Path,
} from './types'

const ESCAPE: Record<string, string> = {
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  "'": "\\'",
  '\\': '\\\\',
}

const UNESCAPE: Record<string, string> = {
  '\\f': '\f',
  '\\n': '\n',
  '\\r': '\r',
  '\\t': '\t',
  "\\'": "'",
  '\\\\': '\\',
}

/**
 * @internal
 */
export function jsonPath(path: ContentSourceMapParsedPath): ContentSourceMapPaths[number] {
  return `$${path
    .map((segment) => {
      if (typeof segment === 'string') {
        const escapedKey = segment.replace(/[\f\n\r\t'\\]/g, (match) => {
          return ESCAPE[match]
        })
        return `['${escapedKey}']`
      }

      if (typeof segment === 'number') {
        return `[${segment}]`
      }

      if (segment._key !== '') {
        const escapedKey = segment._key.replace(/['\\]/g, (match) => {
          return ESCAPE[match]
        })
        return `[?(@._key=='${escapedKey}')]`
      }

      return `[${segment._index}]`
    })
    .join('')}`
}

/**
 * @internal
 */
export function parseJsonPath(path: ContentSourceMapPaths[number]): ContentSourceMapParsedPath {
  const parsed: ContentSourceMapParsedPath = []

  const parseRe = /\['(.*?)'\]|\[(\d+)\]|\[\?\(@\._key=='(.*?)'\)\]/g
  let match: RegExpExecArray | null

  while ((match = parseRe.exec(path)) !== null) {
    if (match[1] !== undefined) {
      const key = match[1].replace(/\\(\\|f|n|r|t|')/g, (m) => {
        return UNESCAPE[m]
      })

      parsed.push(key)
      continue
    }

    if (match[2] !== undefined) {
      parsed.push(parseInt(match[2], 10))
      continue
    }

    if (match[3] !== undefined) {
      const _key = match[3].replace(/\\(\\')/g, (m) => {
        return UNESCAPE[m]
      })

      parsed.push({
        _key,
        _index: -1,
      })
      continue
    }
  }

  return parsed
}

/**
 * @internal
 */
export function jsonPathToStudioPath(path: ContentSourceMapParsedPath): Path {
  return path.map((segment) => {
    if (typeof segment === 'string') {
      return segment
    }

    if (typeof segment === 'number') {
      return segment
    }

    if (segment._key !== '') {
      return {_key: segment._key}
    }

    if (segment._index !== -1) {
      return segment._index
    }

    throw new Error(`invalid segment:${JSON.stringify(segment)}`)
  })
}

/**
 * @internal
 */
export function studioPathToJsonPath(path: Path | string): ContentSourceMapParsedPath {
  const parsedPath = typeof path === 'string' ? studioPath.fromString(path) : path

  return parsedPath.map((segment) => {
    if (typeof segment === 'string') {
      return segment
    }

    if (typeof segment === 'number') {
      return segment
    }

    if (Array.isArray(segment)) {
      throw new Error(`IndexTuple segments aren't supported:${JSON.stringify(segment)}`)
    }

    if (isContentSourceMapParsedPathKeyedSegment(segment)) {
      return segment
    }

    if (segment._key) {
      return {_key: segment._key, _index: -1}
    }

    throw new Error(`invalid segment:${JSON.stringify(segment)}`)
  })
}

function isContentSourceMapParsedPathKeyedSegment(
  segment: studioPath.PathSegment | ContentSourceMapParsedPath[number],
): segment is ContentSourceMapParsedPathKeyedSegment {
  return typeof segment === 'object' && '_key' in segment && '_index' in segment
}

/**
 * @internal
 */
export function jsonPathToMappingPath(path: ContentSourceMapParsedPath): (string | number)[] {
  return path.map((segment) => {
    if (typeof segment === 'string') {
      return segment
    }

    if (typeof segment === 'number') {
      return segment
    }

    if (segment._index !== -1) {
      return segment._index
    }

    throw new Error(`invalid segment:${JSON.stringify(segment)}`)
  })
}
