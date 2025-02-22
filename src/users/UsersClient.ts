import {lastValueFrom, type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {CurrentSanityUser, HttpRequest, SanityUser} from '../types'

/**
 * Client for managing users in a Sanity project.
 * Provides methods for fetching user information and managing user settings.
 *
 * @example
 * ```ts
 * // Get current user info
 * const me = await client.users.getById('me')
 *
 * // List all users in project
 * const users = await client.users.list()
 * ```
 *
 * @public
 */
export class UsersClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Get information about a specific user by ID.
   * Use 'me' to get the current authenticated user.
   *
   * @param id - User ID or 'me' for current user
   * @returns Promise resolving to user info
   */
  getById<T extends 'me' | string>(
    id: T,
  ): Promise<T extends 'me' ? CurrentSanityUser : SanityUser> {
    return lastValueFrom(
      _request<T extends 'me' ? CurrentSanityUser : SanityUser>(this.#client, this.#httpRequest, {
        uri: `/users/${id}`,
      }),
    )
  }

  /**
   * List all users in the project.
   * Returns array of user information.
   *
   * @returns Promise resolving to array of users
   */
  list(): Promise<SanityUser[]> {
    return lastValueFrom(
      _request<SanityUser[]>(this.#client, this.#httpRequest, {
        uri: '/users',
      }),
    )
  }
}

/**
 * Observable version of the UsersClient.
 * All methods return RxJS Observables instead of Promises.
 *
 * @example
 * ```ts
 * client.users.list().subscribe(users => {
 *   console.log('Project users:', users)
 * })
 * ```
 *
 * @public
 */
export class ObservableUsersClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Fetch a user by user ID
   *
   * @param id - User ID of the user to fetch. If `me` is provided, a minimal response including the users role is returned.
   */
  getById<T extends 'me' | string>(
    id: T,
  ): Observable<T extends 'me' ? CurrentSanityUser : SanityUser> {
    return _request<T extends 'me' ? CurrentSanityUser : SanityUser>(
      this.#client,
      this.#httpRequest,
      {uri: `/users/${id}`},
    )
  }
}
