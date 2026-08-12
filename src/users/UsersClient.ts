import {type Observable} from 'rxjs'

import {_request, _requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {CurrentSanityUser, HttpRequest, SanityUser} from '../types'

/** @public */
export class ObservableUsersClient {
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
   * Fetch a user by user ID
   *
   * @param id - User ID of the user to fetch. If `me` is provided, a minimal response including the users role is returned.
   */
  getById<T extends string>(id: T): Observable<T extends 'me' ? CurrentSanityUser : SanityUser> {
    return _requestObservable<T extends 'me' ? CurrentSanityUser : SanityUser>(
      this._client,
      this._httpRequest,
      {url: `/users/${id}`},
    )
  }
}

/** @public */
export class UsersClient {
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
   * Fetch a user by user ID
   *
   * @param id - User ID of the user to fetch. If `me` is provided, a minimal response including the users role is returned.
   */
  getById<T extends string>(id: T): Promise<T extends 'me' ? CurrentSanityUser : SanityUser> {
    return _request<T extends 'me' ? CurrentSanityUser : SanityUser>(
      this._client,
      this._httpRequest,
      {url: `/users/${id}`},
    )
  }
}
