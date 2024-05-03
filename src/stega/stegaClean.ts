import {vercelStegaClean} from '@vercel/stega'

/**
 * Can take a `result` JSON from a `const {result} = client.fetch(query, params, {filterResponse: false})`
 * and remove all stega-encoded data from it.
 * @public
 */
export function stegaClean<Result = unknown>(result: Result): Result {
  return vercelStegaClean<Result>(result)
}

/**
 * Can take a `result` JSON from a `const {result} = client.fetch(query, params, {filterResponse: false})`
 * and remove all stega-encoded data from it.
 * @alpha
 * @deprecated Use `stegaClean` instead
 */
export const vercelStegaCleanAll = stegaClean
