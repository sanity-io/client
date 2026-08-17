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

/**
 * A phantom brand like `DraftId` has no runtime representation, so it can never be produced
 * by narrowing a string - there's nothing to check. These two functions are the only places
 * allowed to assert a plain string into a branded id.
 */
function asDraftId(value: string): DraftId {
  return value as DraftId
}

function asPublishedId(value: string): PublishedId {
  return value as PublishedId
}

/** @internal */
export function getDraftId(id: string): DraftId {
  if (isVersionId(id)) {
    const publishedId = getPublishedId(id)
    return asDraftId(DRAFTS_PREFIX + publishedId)
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
  const [_versionPrefix, versionId, ..._publishedId] = id.split(PATH_SEPARATOR)

  return versionId
}

/** @internal */
export function getPublishedId(id: string): PublishedId {
  if (isVersionId(id)) {
    // make sure to only remove the versions prefix and the bundle name
    return asPublishedId(id.split(PATH_SEPARATOR).slice(2).join(PATH_SEPARATOR))
  }

  if (isDraftId(id)) {
    return asPublishedId(id.slice(DRAFTS_PREFIX.length))
  }

  if (isPublishedId(id)) {
    return id
  }

  // Unreachable: `isPublishedId` is defined as `!isDraftId(id) && !isVersionId(id)`, both of
  // which were already checked (and found false) above, so this can never execute.
  throw new Error(`Unable to resolve a published id from "${id}"`)
}
