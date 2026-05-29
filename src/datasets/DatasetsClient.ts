import {type Observable} from 'rxjs'

import {_request, _requestPromise} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  DatasetCreateOptions,
  DatasetEditOptions,
  DatasetResponse,
  DatasetsResponse,
  EmbeddingsSettings,
  EmbeddingsSettingsBody,
  HttpRequestPromise,
} from '../types'
import * as validate from '../validators'

/** @internal */
export class ObservableDatasetsClient {
  #client: ObservableSanityClient
  #httpRequestPromise: HttpRequestPromise
  constructor(client: ObservableSanityClient, httpRequestPromise: HttpRequestPromise) {
    this.#client = client
    this.#httpRequestPromise = httpRequestPromise
  }

  /**
   * Create a new dataset with the given name
   *
   * @param name - Name of the dataset to create
   * @param options - Options for the dataset, including optional embeddings configuration
   */
  create(name: string, options?: DatasetCreateOptions): Observable<DatasetResponse> {
    return _modify<DatasetResponse>(this.#client, this.#httpRequestPromise, 'PUT', name, options)
  }

  /**
   * Edit a dataset with the given name
   *
   * @param name - Name of the dataset to edit
   * @param options - New options for the dataset
   */
  edit(name: string, options?: DatasetEditOptions): Observable<DatasetResponse> {
    return _modify<DatasetResponse>(this.#client, this.#httpRequestPromise, 'PATCH', name, options)
  }

  /**
   * Delete a dataset with the given name
   *
   * @param name - Name of the dataset to delete
   */
  delete(name: string): Observable<{deleted: true}> {
    return _modify<{deleted: true}>(this.#client, this.#httpRequestPromise, 'DELETE', name)
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

    return _request<DatasetsResponse>(this.#client, this.#httpRequestPromise, {
      uri,
      tag: null,
    })
  }

  /**
   * Get embeddings settings for a dataset
   *
   * @param name - Name of the dataset
   */
  getEmbeddingsSettings(name: string): Observable<EmbeddingsSettings> {
    validate.resourceGuard('dataset', this.#client.config())
    validate.dataset(name)
    return _request<EmbeddingsSettings>(this.#client, this.#httpRequestPromise, {
      uri: _embeddingsSettingsUri(this.#client, name),
      tag: null,
    })
  }

  /**
   * Edit embeddings settings for a dataset
   *
   * @param name - Name of the dataset
   * @param settings - Embeddings settings to apply
   */
  editEmbeddingsSettings(name: string, settings: EmbeddingsSettingsBody): Observable<void> {
    validate.resourceGuard('dataset', this.#client.config())
    validate.dataset(name)
    return _request<void>(this.#client, this.#httpRequestPromise, {
      method: 'PUT',
      uri: _embeddingsSettingsUri(this.#client, name),
      body: settings,
      tag: null,
    })
  }
}

/** @internal */
export class DatasetsClient {
  #client: SanityClient
  #httpRequestPromise: HttpRequestPromise
  constructor(client: SanityClient, httpRequestPromise: HttpRequestPromise) {
    this.#client = client
    this.#httpRequestPromise = httpRequestPromise
  }

  /**
   * Create a new dataset with the given name
   *
   * @param name - Name of the dataset to create
   * @param options - Options for the dataset, including optional embeddings configuration
   */
  create(name: string, options?: DatasetCreateOptions): Promise<DatasetResponse> {
    validate.resourceGuard('dataset', this.#client.config())
    return _modifyPromise<DatasetResponse>(
      this.#client,
      this.#httpRequestPromise,
      'PUT',
      name,
      options,
    )
  }

  /**
   * Edit a dataset with the given name
   *
   * @param name - Name of the dataset to edit
   * @param options - New options for the dataset
   */
  edit(name: string, options?: DatasetEditOptions): Promise<DatasetResponse> {
    validate.resourceGuard('dataset', this.#client.config())
    return _modifyPromise<DatasetResponse>(
      this.#client,
      this.#httpRequestPromise,
      'PATCH',
      name,
      options,
    )
  }

  /**
   * Delete a dataset with the given name
   *
   * @param name - Name of the dataset to delete
   */
  delete(name: string): Promise<{deleted: true}> {
    validate.resourceGuard('dataset', this.#client.config())
    return _modifyPromise<{deleted: true}>(this.#client, this.#httpRequestPromise, 'DELETE', name)
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

    return _requestPromise<DatasetsResponse>(this.#client, this.#httpRequestPromise, {
      uri,
      tag: null,
    })
  }

  /**
   * Get embeddings settings for a dataset
   *
   * @param name - Name of the dataset
   */
  getEmbeddingsSettings(name: string): Promise<EmbeddingsSettings> {
    validate.resourceGuard('dataset', this.#client.config())
    validate.dataset(name)
    return _requestPromise<EmbeddingsSettings>(this.#client, this.#httpRequestPromise, {
      uri: _embeddingsSettingsUri(this.#client, name),
      tag: null,
    })
  }

  /**
   * Edit embeddings settings for a dataset
   *
   * @param name - Name of the dataset
   * @param settings - Embeddings settings to apply
   */
  editEmbeddingsSettings(name: string, settings: EmbeddingsSettingsBody): Promise<void> {
    validate.resourceGuard('dataset', this.#client.config())
    validate.dataset(name)
    return _requestPromise<void>(this.#client, this.#httpRequestPromise, {
      method: 'PUT',
      uri: _embeddingsSettingsUri(this.#client, name),
      body: settings,
      tag: null,
    })
  }
}

function _embeddingsSettingsUri(
  client: SanityClient | ObservableSanityClient,
  name: string,
): string {
  const config = client.config()
  if (config.useProjectHostname === false) {
    return `/projects/${config.projectId}/datasets/${name}/settings/embeddings`
  }
  return `/datasets/${name}/settings/embeddings`
}

function _modify<R = unknown>(
  client: SanityClient | ObservableSanityClient,
  httpRequestPromise: HttpRequestPromise,
  method: 'DELETE' | 'PATCH' | 'PUT',
  name: string,
  options?: DatasetCreateOptions | DatasetEditOptions,
) {
  validate.resourceGuard('dataset', client.config())
  validate.dataset(name)

  return _request<R>(client, httpRequestPromise, {
    method,
    uri: `/datasets/${name}`,
    body: options,
    tag: null,
  })
}

function _modifyPromise<R = unknown>(
  client: SanityClient | ObservableSanityClient,
  httpRequestPromise: HttpRequestPromise,
  method: 'DELETE' | 'PATCH' | 'PUT',
  name: string,
  options?: DatasetCreateOptions | DatasetEditOptions,
): Promise<R> {
  validate.resourceGuard('dataset', client.config())
  validate.dataset(name)

  return _requestPromise<R>(client, httpRequestPromise, {
    method,
    uri: `/datasets/${name}`,
    body: options,
    tag: null,
  })
}
