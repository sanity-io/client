export const DRAFTS_PREFIX = 'drafts.'

/** @internal */
export function getPublishedId(id: string): string {
  if (id.startsWith(DRAFTS_PREFIX)) {
    return id.slice(DRAFTS_PREFIX.length)
  }

  return id
}
