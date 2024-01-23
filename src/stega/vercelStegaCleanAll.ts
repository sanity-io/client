import {vercelStegaSplit} from '@vercel/stega'

/**
 * Can take a `result` JSON from a `const {result} = client.fetch(query, params, {filterResponse: false})`
 * and remove all stega-encoded data from it.
 * @alpha
 */
export function vercelStegaCleanAll<Result = unknown>(result: Result): Result {
  try {
    return JSON.parse(
      JSON.stringify(result, (key, value) => {
        if (typeof value !== 'string') return value
        return vercelStegaSplit(value).cleaned
      }),
    )
  } catch {
    return result
  }
}
