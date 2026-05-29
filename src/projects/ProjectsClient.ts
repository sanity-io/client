import {type Observable} from 'rxjs'

import {_request, _requestPromise} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequestPromise, SanityProject} from '../types'

type ListOptions = {
  includeMembers?: boolean
  includeFeatures?: boolean
  organizationId?: string
  onlyExplicitMembership?: boolean
}

type OmittedProjectFields<T extends ListOptions | undefined> =
  | (T extends {includeMembers: false} ? 'members' : never)
  | (T extends {includeFeatures: false} ? 'features' : never)

/** @internal */
export class ObservableProjectsClient {
  #client: ObservableSanityClient
  #httpRequestPromise: HttpRequestPromise
  constructor(client: ObservableSanityClient, httpRequestPromise: HttpRequestPromise) {
    this.#client = client
    this.#httpRequestPromise = httpRequestPromise
  }

  /**
   * Fetch a list of projects the authenticated user has access to.
   *
   * @param options - Options for the list request
   *   - `includeMembers` - Whether to include members in the response (default: true)
   *   - `includeFeatures` - Whether to include features in the response (default: true)
   *   - `organizationId` - ID of the organization to fetch projects for
   *   - `onlyExplicitMembership` - Whether to include only projects with explicit membership (default: false)
   */
  list<T extends ListOptions>(
    options?: T,
  ): Observable<Omit<SanityProject, OmittedProjectFields<T>>[]> {
    const query: Record<string, string> = {}
    const uri = '/projects'
    if (options?.includeMembers === false) {
      query.includeMembers = 'false'
    }
    if (options?.includeFeatures === false) {
      query.includeFeatures = 'false'
    }
    if (options?.organizationId) {
      query.organizationId = options.organizationId
    }
    if (options?.onlyExplicitMembership) {
      query.onlyExplicitMembership = 'true'
    }

    return _request<SanityProject[]>(this.#client, this.#httpRequestPromise, {
      uri,
      query,
    }) as Observable<Omit<SanityProject, OmittedProjectFields<T>>[]>
  }

  /**
   * Fetch a project by project ID
   *
   * @param projectId - ID of the project to fetch
   */
  getById(projectId: string): Observable<SanityProject> {
    return _request<SanityProject>(this.#client, this.#httpRequestPromise, {
      uri: `/projects/${projectId}`,
    })
  }
}

/** @internal */
export class ProjectsClient {
  #client: SanityClient
  #httpRequestPromise: HttpRequestPromise
  constructor(client: SanityClient, httpRequestPromise: HttpRequestPromise) {
    this.#client = client
    this.#httpRequestPromise = httpRequestPromise
  }

  /**
   * Fetch a list of projects the authenticated user has access to.
   *
   * @param options - Options for the list request
   *   - `includeMembers` - Whether to include members in the response (default: true)
   *   - `includeFeatures` - Whether to include features in the response (default: true)
   *   - `organizationId` - ID of the organization to fetch projects for
   *   - `onlyExplicitMembership` - Whether to include only projects with explicit membership (default: false)
   */
  list<T extends ListOptions>(
    options?: T,
  ): Promise<Omit<SanityProject, OmittedProjectFields<T>>[]> {
    const query: Record<string, string> = {}
    const uri = '/projects'
    if (options?.includeMembers === false) {
      query.includeMembers = 'false'
    }
    if (options?.includeFeatures === false) {
      query.includeFeatures = 'false'
    }
    if (options?.organizationId) {
      query.organizationId = options.organizationId
    }
    if (options?.onlyExplicitMembership) {
      query.onlyExplicitMembership = 'true'
    }
    return _requestPromise<SanityProject[]>(this.#client, this.#httpRequestPromise, {
      uri,
      query,
    }) as Promise<Omit<SanityProject, OmittedProjectFields<T>>[]>
  }

  /**
   * Fetch a project by project ID
   *
   * @param projectId - ID of the project to fetch
   */
  getById(projectId: string): Promise<SanityProject> {
    return _requestPromise<SanityProject>(this.#client, this.#httpRequestPromise, {
      uri: `/projects/${projectId}`,
    })
  }
}
