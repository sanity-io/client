// nominal/opaque type hack
type Opaque<T, K> = T & {__opaqueId__: K}

/** @internal */
export type DraftId = Opaque<string, 'draftId'>

/** @internal */
export type PublishedId = Opaque<string, 'publishedId'>

/** @internal */
export const DRAFTS_FOLDER = 'drafts'

/** @internal */
export const VERSION_FOLDER = 'versions'

const PATH_SEPARATOR = '.'
const DRAFTS_PREFIX = `${DRAFTS_FOLDER}${PATH_SEPARATOR}`
const VERSION_PREFIX = `${VERSION_FOLDER}${PATH_SEPARATOR}`

/** @internal */
export function isDraftId(id: string): id is DraftId {
  return id.startsWith(DRAFTS_PREFIX)
}

/** @internal */
export function isVersionId(id: string): boolean {
  return id.startsWith(VERSION_PREFIX)
}

/** @internal */
export function isPublishedId(id: string): id is PublishedId {
  return !isDraftId(id) && !isVersionId(id)
}

/** @internal */
export function getDraftId(id: string): DraftId {
  if (isVersionId(id)) {
    const publishedId = getPublishedId(id)
    return (DRAFTS_PREFIX + publishedId) as DraftId
  }

  return isDraftId(id) ? id : ((DRAFTS_PREFIX + id) as DraftId)
}

/**  @internal */
export function getVersionId(id: string, version: string): string {
  if (version === 'drafts' || version === 'published') {
    throw new Error('Version can not be "published" or "drafts"')
  }

  return `${VERSION_PREFIX}${version}${PATH_SEPARATOR}${getPublishedId(id)}`
}

/**
 *  @internal
 *  Given an id, returns the versionId if it exists.
 *  e.g. `versions.summer-drop.foo` = `summer-drop`
 *  e.g. `drafts.foo` = `undefined`
 *  e.g. `foo` = `undefined`
 */
export function getVersionFromId(id: string): string | undefined {
  if (!isVersionId(id)) return undefined
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_versionPrefix, versionId, ..._publishedId] = id.split(PATH_SEPARATOR)

  return versionId
}

/** @internal */
export function getPublishedId(id: string): PublishedId {
  if (isVersionId(id)) {
    // make sure to only remove the versions prefix and the bundle name
    return id.split(PATH_SEPARATOR).slice(2).join(PATH_SEPARATOR) as PublishedId as PublishedId
  }

  if (isDraftId(id)) {
    return id.slice(DRAFTS_PREFIX.length) as PublishedId
  }

  return id as PublishedId
}
