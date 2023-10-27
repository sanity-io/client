/** @alpha */
export type KeyedSegment = {_key: string}

/** @alpha */
export type IndexTuple = [number | '', number | '']

/** @alpha */
export type PathSegment = string | number | KeyedSegment | IndexTuple

/** @alpha */
export type Path = PathSegment[]

const rePropName =
  /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g
/** @internal */
export const reKeySegment = /_key\s*==\s*['"](.*)['"]/
const reIndexTuple = /^\d*:\d*$/

/** @internal */
export function isIndexSegment(segment: PathSegment): segment is number {
  return typeof segment === 'number' || (typeof segment === 'string' && /^\[\d+\]$/.test(segment))
}

/** @internal */
export function isKeySegment(segment: PathSegment): segment is KeyedSegment {
  if (typeof segment === 'string') {
    return reKeySegment.test(segment.trim())
  }

  return typeof segment === 'object' && '_key' in segment
}

/** @internal */
export function isIndexTuple(segment: PathSegment): segment is IndexTuple {
  if (typeof segment === 'string' && reIndexTuple.test(segment)) {
    return true
  }

  if (!Array.isArray(segment) || segment.length !== 2) {
    return false
  }

  const [from, to] = segment
  return (typeof from === 'number' || from === '') && (typeof to === 'number' || to === '')
}

/** @internal */
export function get<Result = unknown, Fallback = unknown>(
  obj: unknown,
  path: Path | string,
  defaultVal?: Fallback,
): Result | typeof defaultVal {
  const select = typeof path === 'string' ? fromString(path) : path
  if (!Array.isArray(select)) {
    throw new Error('Path must be an array or a string')
  }

  let acc: unknown | undefined = obj
  for (let i = 0; i < select.length; i++) {
    const segment = select[i]
    if (isIndexSegment(segment)) {
      if (!Array.isArray(acc)) {
        return defaultVal
      }

      acc = acc[segment]
    }

    if (isKeySegment(segment)) {
      if (!Array.isArray(acc)) {
        return defaultVal
      }

      acc = acc.find((item) => item._key === segment._key)
    }

    if (typeof segment === 'string') {
      acc =
        typeof acc === 'object' && acc !== null
          ? ((acc as Record<string, unknown>)[segment] as Result)
          : undefined
    }

    if (typeof acc === 'undefined') {
      return defaultVal
    }
  }

  return acc as Result
}

/** @alpha */
export function toString(path: Path): string {
  if (!Array.isArray(path)) {
    throw new Error('Path is not an array')
  }

  return path.reduce<string>((target, segment, i) => {
    const segmentType = typeof segment
    if (segmentType === 'number') {
      return `${target}[${segment}]`
    }

    if (segmentType === 'string') {
      const separator = i === 0 ? '' : '.'
      return `${target}${separator}${segment}`
    }

    if (isKeySegment(segment) && segment._key) {
      return `${target}[_key=="${segment._key}"]`
    }

    if (Array.isArray(segment)) {
      const [from, to] = segment
      return `${target}[${from}:${to}]`
    }

    throw new Error(`Unsupported path segment \`${JSON.stringify(segment)}\``)
  }, '')
}

/** @alpha */
export function fromString(path: string): Path {
  if (typeof path !== 'string') {
    throw new Error('Path is not a string')
  }

  const segments = path.match(rePropName)
  if (!segments) {
    throw new Error('Invalid path string')
  }

  return segments.map(parsePathSegment)
}

function parsePathSegment(segment: string): PathSegment {
  if (isIndexSegment(segment)) {
    return parseIndexSegment(segment)
  }

  if (isKeySegment(segment)) {
    return parseKeySegment(segment)
  }

  if (isIndexTuple(segment)) {
    return parseIndexTupleSegment(segment)
  }

  return segment
}

function parseIndexSegment(segment: string): PathSegment {
  return Number(segment.replace(/[^\d]/g, ''))
}

function parseKeySegment(segment: string): KeyedSegment {
  const segments = segment.match(reKeySegment)
  return {_key: segments![1]}
}

function parseIndexTupleSegment(segment: string): IndexTuple {
  const [from, to] = segment.split(':').map((seg) => (seg === '' ? seg : Number(seg)))
  return [from, to]
}
