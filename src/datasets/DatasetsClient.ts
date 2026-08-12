import {type Observable} from 'rxjs'

import {_request, _requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  DatasetCreateOptions,
  DatasetEditOptions,
  DatasetResponse,
  DatasetsResponse,
  EmbeddingsSettings,
  EmbeddingsSettingsBody,
  HttpRequest,
} from '../types'
import * as validate from '../validators'

/** @internal */
export class ObservableDatasetsClient {
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
   * Create a new dataset with the given name
   *
   * @param name - Name of the dataset to create
   * @param options - Options for the dataset, including optional embeddings configuration
   */
  create(name: string, options?: DatasetCreateOptions): Observable<DatasetResponse> {
    return _modifyObservable<DatasetResponse>(this._client, this._httpRequest, 'PUT', name, options)
  }

  /**
   * Edit a dataset with the given name
   *
   * @param name - Name of the dataset to edit
   * @param options - New options for the dataset
   */
  edit(name: string, options?: DatasetEditOptions): Observable<DatasetResponse> {
    return _modifyObservable<DatasetResponse>(
      this._client,
      this._httpRequest,
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
  delete(name: string): Observable<{deleted: true}> {
    return _modifyObservable<{deleted: true}>(this._client, this._httpRequest, 'DELETE', name)
  }

  /**
   * Fetch a list of datasets for the configured project
   */
  list(): Observable<DatasetsResponse> {
    validate.resourceGuard('dataset', this._client.config())
    const config = this._client.config()
    const projectId = config.projectId
    let url = '/datasets'
    if (config.useProjectHostname === false) {
      url = `/projects/${projectId}/datasets`
    }

    return _requestObservable<DatasetsResponse>(this._client, this._httpRequest, {
      url,
      tag: null,
    })
  }

  /**
   * Get embeddings settings for a dataset
   *
   * @param name - Name of the dataset
   */
  getEmbeddingsSettings(name: string): Observable<EmbeddingsSettings> {
    validate.resourceGuard('dataset', this._client.config())
    validate.dataset(name)
    return _requestObservable<EmbeddingsSettings>(this._client, this._httpRequest, {
      url: _embeddingsSettingsUri(this._client, name),
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
    validate.resourceGuard('dataset', this._client.config())
    validate.dataset(name)
    return _requestObservable<void>(this._client, this._httpRequest, {
      method: 'PUT',
      url: _embeddingsSettingsUri(this._client, name),
      body: settings,
      tag: null,
    })
  }
}

/** @internal */
export class DatasetsClient {
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
   * Create a new dataset with the given name
   *
   * @param name - Name of the dataset to create
   * @param options - Options for the dataset, including optional embeddings configuration
   */
  create(name: string, options?: DatasetCreateOptions): Promise<DatasetResponse> {
    validate.resourceGuard('dataset', this._client.config())
    return _modify<DatasetResponse>(this._client, this._httpRequest, 'PUT', name, options)
  }

  /**
   * Edit a dataset with the given name
   *
   * @param name - Name of the dataset to edit
   * @param options - New options for the dataset
   */
  edit(name: string, options?: DatasetEditOptions): Promise<DatasetResponse> {
    validate.resourceGuard('dataset', this._client.config())
    return _modify<DatasetResponse>(this._client, this._httpRequest, 'PATCH', name, options)
  }

  /**
   * Delete a dataset with the given name
   *
   * @param name - Name of the dataset to delete
   */
  delete(name: string): Promise<{deleted: true}> {
    validate.resourceGuard('dataset', this._client.config())
    return _modify<{deleted: true}>(this._client, this._httpRequest, 'DELETE', name)
  }

  /**
   * Fetch a list of datasets for the configured project
   */
  list(): Promise<DatasetsResponse> {
    validate.resourceGuard('dataset', this._client.config())
    const config = this._client.config()
    const projectId = config.projectId
    let url = '/datasets'
    if (config.useProjectHostname === false) {
      url = `/projects/${projectId}/datasets`
    }

    return _request<DatasetsResponse>(this._client, this._httpRequest, {
      url,
      tag: null,
    })
  }

  /**
   * Get embeddings settings for a dataset
   *
   * @param name - Name of the dataset
   */
  getEmbeddingsSettings(name: string): Promise<EmbeddingsSettings> {
    validate.resourceGuard('dataset', this._client.config())
    validate.dataset(name)
    return _request<EmbeddingsSettings>(this._client, this._httpRequest, {
      url: _embeddingsSettingsUri(this._client, name),
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
    validate.resourceGuard('dataset', this._client.config())
    validate.dataset(name)
    return _request<void>(this._client, this._httpRequest, {
      method: 'PUT',
      url: _embeddingsSettingsUri(this._client, name),
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

function _modifyObservable<R = unknown>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  method: 'DELETE' | 'PATCH' | 'PUT',
  name: string,
  options?: DatasetCreateOptions | DatasetEditOptions,
) {
  validate.resourceGuard('dataset', client.config())
  validate.dataset(name)

  return _requestObservable<R>(client, httpRequest, {
    method,
    url: `/datasets/${name}`,
    body: options,
    tag: null,
  })
}

function _modify<R = unknown>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  method: 'DELETE' | 'PATCH' | 'PUT',
  name: string,
  options?: DatasetCreateOptions | DatasetEditOptions,
): Promise<R> {
  validate.resourceGuard('dataset', client.config())
  validate.dataset(name)

  return _request<R>(client, httpRequest, {
    method,
    url: `/datasets/${name}`,
    body: options,
    tag: null,
  })
}
