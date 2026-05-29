import {type Observable} from 'rxjs'

import {_request, _requestPromise} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {CurrentSanityUser, HttpRequestPromise, SanityUser} from '../types'

/** @public */
export class ObservableUsersClient {
  #client: ObservableSanityClient
  #httpRequestPromise: HttpRequestPromise
  constructor(client: ObservableSanityClient, httpRequestPromise: HttpRequestPromise) {
    this.#client = client
    this.#httpRequestPromise = httpRequestPromise
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
      this.#httpRequestPromise,
      {uri: `/users/${id}`},
    )
  }
}

/** @public */
export class UsersClient {
  #client: SanityClient
  #httpRequestPromise: HttpRequestPromise
  constructor(client: SanityClient, httpRequestPromise: HttpRequestPromise) {
    this.#client = client
    this.#httpRequestPromise = httpRequestPromise
  }

  /**
   * Fetch a user by user ID
   *
   * @param id - User ID of the user to fetch. If `me` is provided, a minimal response including the users role is returned.
   */
  getById<T extends 'me' | string>(
    id: T,
  ): Promise<T extends 'me' ? CurrentSanityUser : SanityUser> {
    return _requestPromise<T extends 'me' ? CurrentSanityUser : SanityUser>(
      this.#client,
      this.#httpRequestPromise,
      {uri: `/users/${id}`},
    )
  }
}
