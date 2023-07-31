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
   * @param options.includeMembers - Whether to include members in the response (default: true)
   */
  list(options?: {includeMembers?: true}): Observable<SanityProject[]>
  list(options?: {includeMembers?: false}): Observable<Omit<SanityProject, 'members'>[]>
  list(options?: {
    includeMembers?: boolean
  }): Observable<SanityProject[] | Omit<SanityProject, 'members'>[]> {
    const uri = options?.includeMembers === false ? '/projects?includeMembers=false' : '/projects'
    return _request<SanityProject[]>(this.#client, this.#httpRequest, {uri})
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
   * @param options.includeMembers - Whether to include members in the response (default: true)
   */
  list(options?: {includeMembers?: true}): Promise<SanityProject[]>
  list(options?: {includeMembers?: false}): Promise<Omit<SanityProject, 'members'>[]>
  list(options?: {includeMembers?: boolean}): Promise<SanityProject[]> {
    const uri = options?.includeMembers === false ? '/projects?includeMembers=false' : '/projects'
    return lastValueFrom(_request<SanityProject[]>(this.#client, this.#httpRequest, {uri}))
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
