import type {BaseActionOptions, CreateReleaseAction, ReleaseDocument} from '@sanity/client'

import {generateReleaseId} from '../util/createVersionId'

interface ReleaseOrOptions extends BaseActionOptions {
  releaseId?: string
  metadata?: Partial<ReleaseDocument['metadata']>
}

interface CompleteCreateReleaseAction extends CreateReleaseAction {
  metadata: ReleaseDocument['metadata']
}

const getArgs = (
  releaseOrOptions?: ReleaseOrOptions,
  maybeOptions?: BaseActionOptions,
): [string, Partial<ReleaseDocument['metadata']>, BaseActionOptions | undefined] => {
  const isReleaseInput =
    typeof releaseOrOptions === 'object' &&
    releaseOrOptions !== null &&
    ('releaseId' in releaseOrOptions || 'metadata' in releaseOrOptions)

  if (isReleaseInput) {
    const {releaseId = generateReleaseId(), metadata = {}} = releaseOrOptions
    return [releaseId, metadata, maybeOptions]
  }

  return [generateReleaseId(), {}, releaseOrOptions as BaseActionOptions]
}

/** @internal */
export const createRelease = (
  releaseOrOptions?: ReleaseOrOptions,
  maybeOptions?: BaseActionOptions,
): {
  action: CompleteCreateReleaseAction
  options?: BaseActionOptions
} => {
  const [releaseId, metadata, options] = getArgs(releaseOrOptions, maybeOptions)

  const finalMetadata: ReleaseDocument['metadata'] = {
    ...metadata,
    releaseType: metadata.releaseType || 'undecided',
  }

  const createAction: CompleteCreateReleaseAction = {
    actionType: 'sanity.action.release.create',
    releaseId,
    metadata: finalMetadata,
  }

  return {action: createAction, options}
}
