import {lastValueFrom, type Observable} from 'rxjs'

import {_getDataUrl, _request} from '../data/dataMethods'
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
    const config = this.#client.config()
    const projectId = config.projectId
    let uri = '/datasets'
    if (config['~experimental_resource']) {
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
    const config = this.#client.config()
    const projectId = config.projectId
    let uri = '/datasets'
    if (config['~experimental_resource']) {
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

  const config = client.config()
  const resource = config['~experimental_resource']

  // For individual dataset operations, only "dataset" resource type makes sense
  if (resource) {
    if (resource.type === 'dataset') {
      // Validate the resource ID format and ensure the name matches
      const segments = resource.id.split('.')
      if (segments.length !== 2) {
        throw new Error('Dataset resource ID must be in the format "project.dataset"')
      }
      const datasetName = segments[1]
      if (name !== datasetName) {
        throw new Error(`Dataset name "${name}" does not match resource dataset "${datasetName}"`)
      }
    } else {
      throw new Error('Dataset create/edit/delete operations require a resource type of "dataset"')
    }
  }

  const uri = _getDataUrl(client, '', `datasets/${name}`)
  return _request<R>(client, httpRequest, {
    method,
    uri,
    body: options,
    tag: null,
  })
}
