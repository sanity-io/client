import {vercelStegaClean} from '@vercel/stega'

/**
 * The result of removing stega-encoded data from a value with `stegaClean()`: strings that were
 * branded as `StegaString` are returned to their original type, everything else is left as-is.
 * @beta
 */
export type StegaCleaned<T> = 0 extends 1 & T
  ? T
  : T extends {readonly ' stegaBrand': infer Original extends string}
    ? Original
    : T extends string | number | bigint | boolean | null | undefined
      ? T
      : T extends Date | RegExp | ((...args: never[]) => unknown)
        ? T
        : T extends readonly unknown[]
          ? {[Index in keyof T]: StegaCleaned<T[Index]>}
          : T extends object
            ? {[K in keyof T]: StegaCleaned<T[K]>}
            : T

/**
 * Can take a `result` JSON from a `const {result} = client.fetch(query, params, {filterResponse: false})`
 * and remove all stega-encoded data from it.
 * If the result type has strings branded as `StegaString` (by `ClientReturnStega` or `stegaBrand()`),
 * the brand is stripped and the original string type is restored.
 * @public
 */
export function stegaClean<Result = unknown>(result: Result): StegaCleaned<Result> {
  return vercelStegaClean(result) as StegaCleaned<Result>
}

/**
 * Can take a `result` JSON from a `const {result} = client.fetch(query, params, {filterResponse: false})`
 * and remove all stega-encoded data from it.
 * @alpha
 * @deprecated Use `stegaClean` instead
 */
export const vercelStegaCleanAll = stegaClean
