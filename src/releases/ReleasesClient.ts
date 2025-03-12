import {lastValueFrom, Observable} from 'rxjs'

import {_action} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  BaseActionOptions,
  CreateReleaseAction,
  EditableReleaseDocument,
  HttpRequest,
  SingleActionResult,
} from '../types'

/** @internal */
export class ObservableReleasesClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Creates a new release under the given id, with metadata.
   *
   * @param releaseId - The id of the release to create (with no prefix)
   * @param metadata - The metadata to associate with the release {@link EditableReleaseDocument}
   */
  create(
    releaseId: string,
    metadata: EditableReleaseDocument['metadata'],
    options?: BaseActionOptions,
  ): Observable<SingleActionResult> {
    const createAction: CreateReleaseAction = {
      actionType: 'sanity.action.release.create',
      releaseId,
      metadata,
    }

    return _action(this.#client, this.#httpRequest, createAction, options)
  }
}

/** @internal */
export class ReleasesClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Creates a new release under the given id, with metadata.
   *
   * @param releaseId - The id of the release to create (with no prefix)
   * @param metadata - The metadata to associate with the release {@link EditableReleaseDocument}
   */
  create(
    releaseId: string,
    metadata: EditableReleaseDocument['metadata'],
    options?: BaseActionOptions,
  ): Promise<SingleActionResult> {
    const createAction: CreateReleaseAction = {
      actionType: 'sanity.action.release.create',
      releaseId,
      metadata,
    }

    return lastValueFrom(_action(this.#client, this.#httpRequest, createAction, options))
  }
}
