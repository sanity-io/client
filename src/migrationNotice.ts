/**
 * @public
 * @deprecated Use the named export `createClient` instead of the `default` export
 */
export function migrationNotice() {
  throw new TypeError(
    'The default export of @sanity/client has been deprecated. Use the named export `createClient` instead'
  )
}
