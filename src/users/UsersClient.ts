import {lastValueFrom, type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {CurrentSanityUser, HttpRequest, SanityUser} from '../types'

/** @public */
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
    id: T
  ): Observable<T extends 'me' ? CurrentSanityUser : SanityUser> {
    return _request<T extends 'me' ? CurrentSanityUser : SanityUser>(
      this.#client,
      this.#httpRequest,
      {uri: `/users/${id}`}
    )
  }
}

/** @public */
export class UsersClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Fetch a user by user ID
   *
   * @param id - User ID of the user to fetch. If `me` is provided, a minimal response including the users role is returned.
   */
  getById<T extends 'me' | string>(
    id: T
  ): Promise<T extends 'me' ? CurrentSanityUser : SanityUser> {
    return lastValueFrom(
      _request<T extends 'me' ? CurrentSanityUser : SanityUser>(this.#client, this.#httpRequest, {
        uri: `/users/${id}`,
      })
    )
  }
}
