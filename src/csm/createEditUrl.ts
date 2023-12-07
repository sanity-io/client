import {getPublishedId} from './getPublishedId'
import {jsonPathToStudioPath} from './jsonPath'
import * as studioPath from './studioPath'
import type {CreateEditUrlOptions, EditIntentUrl, StudioBaseUrl} from './types'

/** @internal */
export function createEditUrl(options: CreateEditUrlOptions): `${StudioBaseUrl}${EditIntentUrl}` {
  const {
    baseUrl,
    workspace: _workspace = 'default',
    tool: _tool = 'default',
    id: _id,
    type,
    path,
  } = options

  if (!baseUrl) {
    throw new Error('baseUrl is required')
  }
  if (!path) {
    throw new Error('path is required')
  }
  if (!_id) {
    throw new Error('id is required')
  }
  if (baseUrl !== '/' && baseUrl.endsWith('/')) {
    throw new Error('baseUrl must not end with a slash')
  }

  const workspace = _workspace === 'default' ? undefined : _workspace
  const tool = _tool === 'default' ? undefined : _tool
  // eslint-disable-next-line no-warning-comments
  // @TODO allow passing draft prefixed IDs, to better open the right perspective mode
  const id = getPublishedId(_id)
  const stringifiedPath = Array.isArray(path)
    ? studioPath.toString(jsonPathToStudioPath(path))
    : path

  // eslint-disable-next-line no-warning-comments
  // @TODO Using searchParams as a temporary workaround until `@sanity/overlays` can decode state from the path reliably
  const searchParams = new URLSearchParams({
    baseUrl,
    id,
    type,
    path: stringifiedPath,
  })
  if (workspace) {
    searchParams.set('workspace', workspace)
  }
  if (tool) {
    searchParams.set('tool', tool)
  }

  const segments = [baseUrl === '/' ? '' : baseUrl]
  if (workspace) {
    segments.push(workspace)
  }
  const routerParams = [
    'mode=presentation',
    `id=${id}`,
    `type=${type}`,
    `path=${encodeURIComponent(stringifiedPath)}`,
  ]
  if (tool) {
    routerParams.push(`tool=${tool}`)
  }
  segments.push('intent', 'edit', `${routerParams.join(';')}?${searchParams}`)
  return segments.join('/') as unknown as `${StudioBaseUrl}${EditIntentUrl}`
}
