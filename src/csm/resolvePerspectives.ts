import {validateApiPerspective} from '../config'
import type {ReleaseId} from '../types'
import type {ClientPerspective} from './types'

/**
 * This resolves the perspectives to how documents should be resolved when applying optimistic updates,
 * like in `applySourceDocuments`.
 * @internal
 */
export function resolvePerspectives(
  perspective: Exclude<ClientPerspective, 'raw'>,
): ('published' | 'drafts' | ReleaseId)[] {
  validateApiPerspective(perspective)

  if (Array.isArray(perspective)) {
    if (!perspective.includes('published')) {
      return [...perspective, 'published']
    }
    return perspective
  }
  switch (perspective) {
    case 'previewDrafts':
    case 'drafts':
      return ['drafts', 'published']
    case 'published':
    default:
      return ['published']
  }
}
