import type {Any, ClientReturn} from '@sanity/client'

/**
 * A string that might contain stega-encoded data, and is unsafe to compare against string literals
 * until it's been cleaned with `stegaClean()`.
 *
 * The type intersects a template literal that has a human readable suffix, with a brand property
 * that holds the original string type:
 * - The suffix makes TypeScript report "This comparison appears to be unintentional" (TS2367) when
 *   the string is compared to a literal (`===`, `switch` cases), and makes it unassignable to
 *   literal unions like `'left' | 'right'`, while keeping it assignable to `string` so rendering,
 *   interpolation and string methods keep working. The suffix is a type-level fiction, the runtime
 *   value never ends with that text.
 * - The brand property preserves the original type so `stegaClean()` can recover it exactly. It's
 *   a string-keyed property rather than a `unique symbol` so that branded types stay structurally
 *   compatible across duplicated copies of `@sanity/client` in `node_modules`. It only exists in
 *   the type system and is never present at runtime.
 *
 * @beta
 */
export type StegaString<T extends string = string> =
  `${T} (may contain hidden stega characters)` & {
    readonly ' stegaBrand': T
  }

/**
 * Deeply brands the string properties of a query result as `StegaString`, marking them as
 * potentially containing stega-encoded data.
 *
 * String properties that the stega encoder is guaranteed to never encode keep their plain type:
 * - keys starting with `_` (`_id`, `_type`, `_createdAt`, `_updatedAt`, `_key`, `_ref`, `_rev` and
 *   so on), which also preserves discriminated union narrowing on `_type`
 * - `slug.current` patterns: a `current` key directly under a `slug` key, as well as string valued
 *   `slug` keys (covering `"slug": slug.current` projections)
 * - Portable Text internals: the encoder only visits `children` of `_type: 'block'` objects and
 *   `text` of `_type: 'span'` objects, so properties like `style`, `listItem` and `marks` stay
 *   plain
 *
 * Every other string is assumed to be "poisoned", even if the runtime `filter` happens to skip it
 * (URLs, dates, keys ending in `Id`, denylisted keys). Being conservative is safe: the worst case
 * is a redundant `stegaClean()` call, whereas under-branding would hide real bugs.
 *
 * The `Key` and `ParentKey` type parameters track the key the current value is found under, and
 * the key of the object containing it, they're only used internally during recursion.
 *
 * @beta
 */
export type StegaBranded<
  T,
  Key extends PropertyKey = number,
  ParentKey extends PropertyKey = number,
> = 0 extends 1 & T
  ? T
  : T extends string
    ? T extends {readonly ' stegaBrand': string}
      ? T
      : Key extends `_${string}` | 'slug'
        ? T
        : Key extends 'current'
          ? ParentKey extends 'slug'
            ? T
            : StegaString<T>
          : StegaString<T>
    : T extends number | bigint | boolean | null | undefined
      ? T
      : T extends Date | RegExp | ((...args: never[]) => unknown)
        ? T
        : T extends readonly unknown[]
          ? {[Index in keyof T]: StegaBranded<T[Index], number, number>}
          : T extends {_type: 'block'}
            ? {[K in keyof T]: K extends 'children' ? StegaBranded<T[K], K, Key> : T[K]}
            : T extends {_type: 'span'}
              ? {[K in keyof T]: K extends 'text' ? StegaBranded<T[K], K, Key> : T[K]}
              : T extends object
                ? {[K in keyof T]: StegaBranded<T[K], K, Key>}
                : T

/**
 * Drop-in replacement for `ClientReturn` that brands the result strings as `StegaString`, for use
 * as the first generic of `client.fetch` when stega is enabled:
 * ```ts
 * import {createClient} from '@sanity/client'
 * import type {ClientReturnStega} from '@sanity/client/stega'
 *
 * const query = '*[_type == "post"][0]'
 * const post = await client.fetch<ClientReturnStega<typeof query>>(query)
 * ```
 * When the query is registered in the `SanityQueries` interface (for example by `sanity typegen`),
 * the result type is looked up and deeply branded with `StegaBranded`. Otherwise it falls back to
 * `Fallback`, which defaults to `any`, just like `ClientReturn`.
 *
 * @beta
 */
export type ClientReturnStega<GroqString extends string, Fallback = Any> = StegaBranded<
  ClientReturn<GroqString, Fallback>
>

/**
 * Marks strings in an already fetched query result as potentially containing stega-encoded data,
 * by re-typing them as `StegaString`. Comparing branded strings to string literals is a type error
 * until they're cleaned with `stegaClean()`, which recovers the original type.
 *
 * This is an identity function, it only changes the type of the input, not its value.
 * Prefer passing `ClientReturnStega` as the first generic to `client.fetch` when possible, and use
 * this function for data that has already been fetched.
 *
 * @beta
 */
export function stegaBrand<Result>(result: Result): StegaBranded<Result> {
  return result as StegaBranded<Result>
}
