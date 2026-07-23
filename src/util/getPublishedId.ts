const DRAFTS_PREFIX = 'drafts.'
const VERSION_PREFIX = 'versions.'

/** @internal */
export function getPublishedId(id: string): string {
  if (id.startsWith(VERSION_PREFIX)) {
    // make sure to only remove the versions prefix and the bundle name
    return id.split('.').slice(2).join('.')
  }

  if (id.startsWith(DRAFTS_PREFIX)) {
    return id.slice(DRAFTS_PREFIX.length)
  }

  return id
}
