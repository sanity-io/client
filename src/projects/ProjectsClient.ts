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
   * Fetch a list of projects the authenticated user has access to
   */
  list(): Observable<SanityProject[]> {
    return _request<SanityProject[]>(this.#client, this.#httpRequest, {uri: '/projects'})
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
   * Fetch a list of projects the authenticated user has access to
   */
  list(): Promise<SanityProject[]> {
    return lastValueFrom(
      _request<SanityProject[]>(this.#client, this.#httpRequest, {uri: '/projects'})
    )
  }

  /**
   * Fetch a project by project ID
   *
   * @param projectId - ID of the project to fetch
   */
  getById(projectId: string): Promise<SanityProject> {
    return lastValueFrom(
      _request<SanityProject>(this.#client, this.#httpRequest, {uri: `/projects/${projectId}`})
    )
  }
}
