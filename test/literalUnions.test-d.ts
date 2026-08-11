import type {StudioBaseUrl} from '../src/csm/types'
import type {StackablePerspective} from '../src/types'

/**
 * Guards the `string & {}` idiom that keeps literal members visible to editor autocomplete.
 *
 * Writing the intersection around the whole union instead of around the `string` member, as in
 * `('published' | 'drafts' | string) & {}`, collapses the type to plain `string` and silently
 * drops every completion. These assertions fail if that regresses.
 */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never

/** `false` for a plain `string`, `true` for a union whose literal members survived. */
type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true

type Assert<T extends true> = T

export type PerspectiveIsUnion = Assert<IsUnion<StackablePerspective>>
export type StudioBaseUrlIsUnion = Assert<IsUnion<StudioBaseUrl>>
