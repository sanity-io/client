import {createEditUrl} from './createEditUrl'
import {studioPathToJsonPath} from './jsonPath'
import {resolveEditInfo} from './resolveEditInfo'
import type {ResolveEditUrlOptions} from './types'

/** @alpha */
export function resolveEditUrl(
  options: ResolveEditUrlOptions,
): ReturnType<typeof createEditUrl> | undefined {
  const {projectId, dataset, resultSourceMap, studioUrl} = options
  const resultPath = studioPathToJsonPath(options.resultPath)

  const editInfo = resolveEditInfo({
    projectId,
    dataset,
    resultPath,
    resultSourceMap,
    studioUrl,
  })
  if (!editInfo) {
    return undefined
  }

  return createEditUrl(editInfo)
}
