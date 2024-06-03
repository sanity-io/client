import {parseJsonPath} from './jsonPath'
import {resolveMapping} from './resolveMapping'
import type {
  CreateEditUrlOptions,
  ResolveEditInfoOptions,
  StudioBaseRoute,
  StudioBaseUrl,
  StudioUrl,
} from './types'

/** @internal */
export function resolveEditInfo(options: ResolveEditInfoOptions): CreateEditUrlOptions | undefined {
  const {resultSourceMap: csm, resultPath} = options
  const {mapping, pathSuffix} = resolveMapping(resultPath, csm) || {}

  if (!mapping) {
    // console.warn('no mapping for path', { path: resultPath, sourceMap: csm })
    return undefined
  }

  if (mapping.source.type === 'literal') {
    return undefined
  }

  if (mapping.source.type === 'unknown') {
    return undefined
  }

  const sourceDoc = csm.documents[mapping.source.document]
  const sourcePath = csm.paths[mapping.source.path]

  if (sourceDoc && sourcePath) {
    const {baseUrl, workspace, tool} = resolveStudioBaseRoute(
      typeof options.studioUrl === 'function' ? options.studioUrl(sourceDoc) : options.studioUrl,
    )
    if (!baseUrl) return undefined
    const {_id, _type, _projectId, _dataset} = sourceDoc
    return {
      baseUrl,
      workspace,
      tool,
      id: _id,
      type: _type,
      path: parseJsonPath(sourcePath + pathSuffix),
      projectId: _projectId,
      dataset: _dataset,
    } satisfies CreateEditUrlOptions
  }

  return undefined
}

/** @internal */
export function resolveStudioBaseRoute(studioUrl: StudioUrl): StudioBaseRoute {
  let baseUrl: StudioBaseUrl = typeof studioUrl === 'string' ? studioUrl : studioUrl.baseUrl
  if (baseUrl !== '/') {
    baseUrl = baseUrl.replace(/\/$/, '')
  }
  if (typeof studioUrl === 'string') {
    return {baseUrl}
  }
  return {...studioUrl, baseUrl}
}
