import {type Observable} from 'rxjs'

import {_request, _requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, SanityProject} from '../types'

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
  /**
   * Private properties. These do not use `#` (JS private) because TS collapses them to a
   * to a single `#private` in the emitted declaration, and that brands nominally, which
   * creates all sorts of type issues when there's multiple versions of `@sanity/client`
   * in the dependency tree. Instead, we rely on `@internal` to remove them from definitions,
   * the underscore prefix as a runtime "do not use" signal to external users.
   */

  /** @internal */
  _client: ObservableSanityClient

  /** @internal */
  _httpRequest: HttpRequest

  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this._client = client
    this._httpRequest = httpRequest
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
    const url = '/projects'
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

    return _requestObservable<SanityProject[]>(this._client, this._httpRequest, {
      url,
      query,
    }) as Observable<Omit<SanityProject, OmittedProjectFields<T>>[]>
  }

  /**
   * Fetch a project by project ID
   *
   * @param projectId - ID of the project to fetch
   */
  getById(projectId: string): Observable<SanityProject> {
    return _requestObservable<SanityProject>(this._client, this._httpRequest, {
      url: `/projects/${projectId}`,
    })
  }
}

/** @internal */
export class ProjectsClient {
  /**
   * Private properties. These do not use `#` (JS private) because TS collapses them to a
   * to a single `#private` in the emitted declaration, and that brands nominally, which
   * creates all sorts of type issues when there's multiple versions of `@sanity/client`
   * in the dependency tree. Instead, we rely on `@internal` to remove them from definitions,
   * the underscore prefix as a runtime "do not use" signal to external users.
   */

  /** @internal */
  _client: SanityClient

  /** @internal */
  _httpRequest: HttpRequest

  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this._client = client
    this._httpRequest = httpRequest
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
    const url = '/projects'
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
    return _request<SanityProject[]>(this._client, this._httpRequest, {
      url,
      query,
    }) as Promise<Omit<SanityProject, OmittedProjectFields<T>>[]>
  }

  /**
   * Fetch a project by project ID
   *
   * @param projectId - ID of the project to fetch
   */
  getById(projectId: string): Promise<SanityProject> {
    return _request<SanityProject>(this._client, this._httpRequest, {
      url: `/projects/${projectId}`,
    })
  }
}
