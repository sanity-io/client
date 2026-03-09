import {lastValueFrom, type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, SanityProject} from '../types'

/** @internal */
export class ObservableProjectsClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Fetch a list of projects the authenticated user has access to.
   *
   * @param options - Options for the list request
   *   - `includeMembers` - Whether to include members in the response (default: true)
   *   - `organizationId` - ID of the organization to fetch projects for
   *   - `onlyExplicitMembership` - Only include projects where the user has explicit membership (default: false)
   */
  list(options?: {
    includeMembers?: true
    organizationId?: string
    onlyExplicitMembership?: boolean
  }): Observable<SanityProject[]>
  list(options?: {
    includeMembers?: false
    organizationId?: string
    onlyExplicitMembership?: boolean
  }): Observable<Omit<SanityProject, 'members'>[]>
  list(options?: {
    includeMembers?: boolean
    organizationId?: string
    onlyExplicitMembership?: boolean
  }): Observable<SanityProject[] | Omit<SanityProject, 'members'>[]> {
    const query: Record<string, string> = {}
    const uri = '/projects'
    if (options?.includeMembers === false) {
      query.includeMembers = 'false'
    }
    if (options?.organizationId) {
      query.organizationId = options.organizationId
    }
    if (options?.onlyExplicitMembership === true) {
      query.onlyExplicitMembership = 'true'
    }

    return _request<SanityProject[]>(this.#client, this.#httpRequest, {uri, query})
  }

  /**
   * Fetch a project by project ID
   *
   * @param projectId - ID of the project to fetch
   */
  getById(projectId: string): Observable<SanityProject> {
    return _request<SanityProject>(this.#client, this.#httpRequest, {uri: `/projects/${projectId}`})
  }
}

/** @internal */
export class ProjectsClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Fetch a list of projects the authenticated user has access to.
   *
   * @param options - Options for the list request
   *   - `includeMembers` - Whether to include members in the response (default: true)
   *   - `organizationId` - ID of the organization to fetch projects for
   *   - `onlyExplicitMembership` - Only include projects where the user has explicit membership (default: false)
   */
  list(options?: {
    includeMembers?: true
    organizationId?: string
    onlyExplicitMembership?: boolean
  }): Promise<SanityProject[]>
  list(options?: {
    includeMembers?: false
    organizationId?: string
    onlyExplicitMembership?: boolean
  }): Promise<Omit<SanityProject, 'members'>[]>
  list(options?: {
    includeMembers?: boolean
    organizationId?: string
    onlyExplicitMembership?: boolean
  }): Promise<SanityProject[] | Omit<SanityProject, 'members'>[]> {
    const query: Record<string, string> = {}
    const uri = '/projects'
    if (options?.includeMembers === false) {
      query.includeMembers = 'false'
    }
    if (options?.organizationId) {
      query.organizationId = options.organizationId
    }
    if (options?.onlyExplicitMembership === true) {
      query.onlyExplicitMembership = 'true'
    }
    return lastValueFrom(_request<SanityProject[]>(this.#client, this.#httpRequest, {uri, query}))
  }

  /**
   * Fetch a project by project ID
   *
   * @param projectId - ID of the project to fetch
   */
  getById(projectId: string): Promise<SanityProject> {
    return lastValueFrom(
      _request<SanityProject>(this.#client, this.#httpRequest, {uri: `/projects/${projectId}`}),
    )
  }
}
