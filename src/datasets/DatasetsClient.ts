import {lastValueFrom, type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {DatasetAclMode, DatasetResponse, DatasetsResponse, HttpRequest} from '../types'
import * as validate from '../validators'

/** @internal */
export class ObservableDatasetsClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Create a new dataset with the given name
   *
   * @param name - Name of the dataset to create
   * @param options - Options for the dataset
   */
  create(name: string, options?: {aclMode?: DatasetAclMode}): Observable<DatasetResponse> {
    return _modify<DatasetResponse>(this.#client, this.#httpRequest, 'PUT', name, options)
  }

  /**
   * Edit a dataset with the given name
   *
   * @param name - Name of the dataset to edit
   * @param options - New options for the dataset
   */
  edit(name: string, options?: {aclMode?: DatasetAclMode}): Observable<DatasetResponse> {
    return _modify<DatasetResponse>(this.#client, this.#httpRequest, 'PATCH', name, options)
  }

  /**
   * Delete a dataset with the given name
   *
   * @param name - Name of the dataset to delete
   */
  delete(name: string): Observable<{deleted: true}> {
    return _modify<{deleted: true}>(this.#client, this.#httpRequest, 'DELETE', name)
  }

  /**
   * Fetch a list of datasets for the configured project
   */
  list(): Observable<DatasetsResponse> {
    validate.resourceGuard('dataset', this.#client.config())
    const config = this.#client.config()
    const projectId = config.projectId
    let uri = '/datasets'
    if (config.useProjectHostname === false) {
      uri = `/projects/${projectId}/datasets`
    }

    return _request<DatasetsResponse>(this.#client, this.#httpRequest, {
      uri,
      tag: null,
    })
  }
}

/** @internal */
export class DatasetsClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Create a new dataset with the given name
   *
   * @param name - Name of the dataset to create
   * @param options - Options for the dataset
   */
  create(name: string, options?: {aclMode?: DatasetAclMode}): Promise<DatasetResponse> {
    validate.resourceGuard('dataset', this.#client.config())
    return lastValueFrom(
      _modify<DatasetResponse>(this.#client, this.#httpRequest, 'PUT', name, options),
    )
  }

  /**
   * Edit a dataset with the given name
   *
   * @param name - Name of the dataset to edit
   * @param options - New options for the dataset
   */
  edit(name: string, options?: {aclMode?: DatasetAclMode}): Promise<DatasetResponse> {
    validate.resourceGuard('dataset', this.#client.config())
    return lastValueFrom(
      _modify<DatasetResponse>(this.#client, this.#httpRequest, 'PATCH', name, options),
    )
  }

  /**
   * Delete a dataset with the given name
   *
   * @param name - Name of the dataset to delete
   */
  delete(name: string): Promise<{deleted: true}> {
    validate.resourceGuard('dataset', this.#client.config())
    return lastValueFrom(_modify<{deleted: true}>(this.#client, this.#httpRequest, 'DELETE', name))
  }

  /**
   * Fetch a list of datasets for the configured project
   */
  list(): Promise<DatasetsResponse> {
    validate.resourceGuard('dataset', this.#client.config())
    const config = this.#client.config()
    const projectId = config.projectId
    let uri = '/datasets'
    if (config.useProjectHostname === false) {
      uri = `/projects/${projectId}/datasets`
    }

    return lastValueFrom(
      _request<DatasetsResponse>(this.#client, this.#httpRequest, {uri, tag: null}),
    )
  }
}

function _modify<R = unknown>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  method: 'DELETE' | 'PATCH' | 'PUT',
  name: string,
  options?: {aclMode?: DatasetAclMode},
) {
  validate.resourceGuard('dataset', client.config())
  validate.dataset(name)

  return _request<R>(client, httpRequest, {
    method,
    uri: `/datasets/${name}`,
    body: options,
    tag: null,
  })
}
