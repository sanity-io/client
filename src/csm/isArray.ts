/** @internal */
export function isArray(value: unknown): value is Array<unknown> {
  return value !== null && Array.isArray(value)
}
