import {isArray} from './isArray'
import {isRecord} from './isRecord'
import type {ContentSourceMapParsedPath, WalkMapFn} from './types'

/**
 * generic way to walk a nested object or array and apply a mapping function to each value
 * @internal
 */
export function walkMap(
  value: unknown,
  mappingFn: WalkMapFn,
  path: ContentSourceMapParsedPath = [],
): unknown {
  if (isArray(value)) {
    return value.map((v, idx) => {
      if (isRecord(v)) {
        const _key = v['_key']
        if (typeof _key === 'string') {
          return walkMap(v, mappingFn, path.concat({_key, _index: idx}))
        }
      }

      return walkMap(v, mappingFn, path.concat(idx))
    })
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, walkMap(v, mappingFn, path.concat(k))]),
    )
  }

  return mappingFn(value, path)
}
