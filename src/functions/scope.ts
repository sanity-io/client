import type {InitializedClientConfig} from '../types'

/**
 * The headers that scope a functions request to an organization or a project.
 * An organization, from the request or the client config, takes precedence over
 * the project.
 *
 * @internal
 */
export function _scopeHeaders(
  config: InitializedClientConfig,
  organizationId: string | undefined,
): Record<string, string> {
  const scopeOrganizationId = organizationId || config.organizationId
  if (scopeOrganizationId) {
    return {
      'X-Sanity-Scope-Type': 'organization',
      'X-Sanity-Scope-Id': scopeOrganizationId,
    }
  }

  const {projectId} = config
  if (!projectId) {
    throw new Error(
      'A functions call requires a `projectId` to be set in the client config, or an ' +
        '`organizationId` for a stack deployed at organization scope',
    )
  }

  return {
    'X-Sanity-Scope-Type': 'project',
    'X-Sanity-Scope-Id': projectId,
  }
}
