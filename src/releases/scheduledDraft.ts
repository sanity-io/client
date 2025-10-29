import {isDraftId} from '@sanity/client/csm'

import type {BaseActionOptions, ReleaseDocument} from '../types'
import {generateReleaseId} from '../util/createVersionId'

interface ScheduledDraftParams {
  releaseId?: string
  baseId: string
  ifBaseRevisionId?: string
  publishAt: string
}

interface ScheduledDraftResult {
  releaseId: string
  baseId: string
  publishAt: string
  ifBaseRevisionId?: string
  metadata: ReleaseDocument['metadata']
  options?: BaseActionOptions
}

export const prepareScheduledDraft = (
  params: ScheduledDraftParams,
  maybeOptions?: BaseActionOptions,
): ScheduledDraftResult => {
  const {releaseId: providedReleaseId, baseId, ifBaseRevisionId, publishAt} = params

  // Validate that baseId is a draft ID
  if (!isDraftId(baseId)) {
    throw new Error(
      `\`scheduledDraft()\` requires \`baseId\` to be a draft document ID. Received: ${baseId}`,
    )
  }

  // Generate releaseId if not provided
  const releaseId = providedReleaseId || generateReleaseId()

  // Prepare metadata with cardinality: 'one'
  const metadata: ReleaseDocument['metadata'] = {
    releaseType: 'scheduled',
    intendedPublishAt: publishAt,
    cardinality: 'one',
  }

  return {
    releaseId,
    baseId,
    publishAt,
    ifBaseRevisionId,
    metadata,
    options: maybeOptions,
  }
}
