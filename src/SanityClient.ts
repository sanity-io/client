import {lastValueFrom, Observable} from 'rxjs'

import {AssetsClient, ObservableAssetsClient} from './assets/AssetsClient'
import {defaultConfig, initConfig} from './config'
import * as dataMethods from './data/dataMethods'
import {_listen} from './data/listen'
import {ObservablePatch, Patch} from './data/patch'
import {ObservableTransaction, Transaction} from './data/transaction'
import {DatasetsClient, ObservableDatasetsClient} from './datasets/DatasetsClient'
import {ObservableProjectsClient, ProjectsClient} from './projects/ProjectsClient'
import type {
  AllDocumentIdsMutationOptions,
  AllDocumentsMutationOptions,
  Any,
  BaseMutationOptions,
  ClientConfig,
  FilteredResponseQueryOptions,
  FirstDocumentIdMutationOptions,
  FirstDocumentMutationOptions,
  HttpRequest,
  IdentifiedSanityDocumentStub,
  InitializedClientConfig,
  MultipleMutationResult,
  Mutation,
  MutationSelection,
  PatchOperations,
  PatchSelection,
  QueryParams,
  RawQueryResponse,
  RawRequestOptions,
  SanityDocument,
  SanityDocumentStub,
  SingleMutationResult,
  UnfilteredResponseQueryOptions,
} from './types'
import {ObservableUsersClient, UsersClient} from './users/UsersClient'

export type {
  _listen,
  AssetsClient,
  DatasetsClient,
  ObservableAssetsClient,
  ObservableDatasetsClient,
  ObservableProjectsClient,
  ObservableUsersClient,
  ProjectsClient,
  UsersClient,
}

/** @public */
export class ObservableSanityClient {
  assets: ObservableAssetsClient
  datasets: ObservableDatasetsClient
  projects: ObservableProjectsClient
  users: ObservableUsersClient

  /**
   * Private properties
   */
  #clientConfig: InitializedClientConfig
  #httpRequest: HttpRequest

  /**
   * Instance properties
   */
  listen = _listen

  constructor(httpRequest: HttpRequest, config: ClientConfig = defaultConfig) {
    this.config(config)

    this.#httpRequest = httpRequest

    this.assets = new ObservableAssetsClient(this, this.#httpRequest)
    this.datasets = new ObservableDatasetsClient(this, this.#httpRequest)
    this.projects = new ObservableProjectsClient(this, this.#httpRequest)
    this.users = new ObservableUsersClient(this, this.#httpRequest)
  }

  /**
   * Clone the client - returns a new instance
   */
  clone(): ObservableSanityClient {
    return new ObservableSanityClient(this.#httpRequest, this.config())
  }

  /**
   * Returns the current client configuration
   */
  config(): InitializedClientConfig
  /**
   * Reconfigure the client. Note that this _mutates_ the current client.
   */
  config(newConfig?: Partial<ClientConfig>): this
  config(newConfig?: Partial<ClientConfig>): ClientConfig | this {
    if (newConfig === undefined) {
      return {...this.#clientConfig}
    }

    if (this.#clientConfig && this.#clientConfig.allowReconfigure === false) {
      throw new Error(
        'Existing client instance cannot be reconfigured - use `withConfig(newConfig)` to return a new client',
      )
    }

    this.#clientConfig = initConfig(newConfig, this.#clientConfig || {})
    return this
  }

  /**
   * Clone the client with a new (partial) configuration.
   *
   * @param newConfig - New client configuration properties, shallowly merged with existing configuration
   */
  withConfig(newConfig?: Partial<ClientConfig>): ObservableSanityClient {
    return new ObservableSanityClient(this.#httpRequest, {...this.config(), ...newConfig})
  }

  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   */
  fetch<R = Any>(query: string): Observable<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Query parameters
   */
  fetch<R = Any, Q = QueryParams>(query: string, params: Q): Observable<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Query parameters
   * @param options - Request options
   */
  fetch<R = Any, Q = QueryParams>(
    query: string,
    params: Q | undefined,
    options: FilteredResponseQueryOptions,
  ): Observable<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Query parameters
   * @param options - Request options
   */
  fetch<R = Any, Q = QueryParams>(
    query: string,
    params: Q | undefined,
    options: UnfilteredResponseQueryOptions,
  ): Observable<RawQueryResponse<R>>
  fetch<R, Q extends QueryParams>(
    query: string,
    params?: Q,
    options: FilteredResponseQueryOptions | UnfilteredResponseQueryOptions = {},
  ): Observable<RawQueryResponse<R> | R> {
    return dataMethods._fetch<R, Q>(this, this.#httpRequest, query, params, options)
  }

  /**
   * Fetch a single document with the given ID.
   *
   * @param id - Document ID to fetch
   * @param options - Request options
   */
  getDocument<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options?: {tag?: string},
  ): Observable<SanityDocument<R> | undefined> {
    return dataMethods._getDocument<R>(this, this.#httpRequest, id, options)
  }

  /**
   * Fetch multiple documents in one request.
   * Should be used sparingly - performing a query is usually a better option.
   * The order/position of documents is preserved based on the original array of IDs.
   * If any of the documents are missing, they will be replaced by a `null` entry in the returned array
   *
   * @param ids - Document IDs to fetch
   * @param options - Request options
   */
  getDocuments<R extends Record<string, Any> = Record<string, Any>>(
    ids: string[],
    options?: {tag?: string},
  ): Observable<(SanityDocument<R> | null)[]> {
    return dataMethods._getDocuments<R>(this, this.#httpRequest, ids, options)
  }

  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns an observable that resolves to the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options: FirstDocumentMutationOptions,
  ): Observable<SanityDocument<R>>
  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns an observable that resolves to an array containing the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options: AllDocumentsMutationOptions,
  ): Observable<SanityDocument<R>[]>
  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns an observable that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options: FirstDocumentIdMutationOptions,
  ): Observable<SingleMutationResult>
  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns an observable that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options: AllDocumentIdsMutationOptions,
  ): Observable<MultipleMutationResult>
  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns an observable that resolves to the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options?: BaseMutationOptions,
  ): Observable<SanityDocument<R>>
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options?:
      | AllDocumentIdsMutationOptions
      | AllDocumentsMutationOptions
      | BaseMutationOptions
      | FirstDocumentIdMutationOptions
      | FirstDocumentMutationOptions,
  ): Observable<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return dataMethods._create<R>(this, this.#httpRequest, document, 'create', options)
  }

  /**
   * Create a document if no document with the same ID already exists.
   * Returns an observable that resolves to the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: FirstDocumentMutationOptions,
  ): Observable<SanityDocument<R>>
  /**
   * Create a document if no document with the same ID already exists.
   * Returns an observable that resolves to an array containing the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: AllDocumentsMutationOptions,
  ): Observable<SanityDocument<R>[]>
  /**
   * Create a document if no document with the same ID already exists.
   * Returns an observable that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: FirstDocumentIdMutationOptions,
  ): Observable<SingleMutationResult>
  /**
   * Create a document if no document with the same ID already exists.
   * Returns an observable that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: AllDocumentIdsMutationOptions,
  ): Observable<MultipleMutationResult>
  /**
   * Create a document if no document with the same ID already exists.
   * Returns an observable that resolves to the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options?: BaseMutationOptions,
  ): Observable<SanityDocument<R>>
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options?:
      | AllDocumentIdsMutationOptions
      | AllDocumentsMutationOptions
      | BaseMutationOptions
      | FirstDocumentIdMutationOptions
      | FirstDocumentMutationOptions,
  ): Observable<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return dataMethods._createIfNotExists<R>(this, this.#httpRequest, document, options)
  }

  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns an observable that resolves to the created document.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: FirstDocumentMutationOptions,
  ): Observable<SanityDocument<R>>
  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns an observable that resolves to an array containing the created document.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: AllDocumentsMutationOptions,
  ): Observable<SanityDocument<R>[]>
  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns an observable that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: FirstDocumentIdMutationOptions,
  ): Observable<SingleMutationResult>
  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns an observable that resolves to a mutation result object containing the created document ID.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: AllDocumentIdsMutationOptions,
  ): Observable<MultipleMutationResult>
  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns an observable that resolves to the created document.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options?: BaseMutationOptions,
  ): Observable<SanityDocument<R>>
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options?:
      | AllDocumentIdsMutationOptions
      | AllDocumentsMutationOptions
      | BaseMutationOptions
      | FirstDocumentIdMutationOptions
      | FirstDocumentMutationOptions,
  ): Observable<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return dataMethods._createOrReplace<R>(this, this.#httpRequest, document, options)
  }

  /**
   * Deletes a document with the given document ID.
   * Returns an observable that resolves to the deleted document.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options: FirstDocumentMutationOptions,
  ): Observable<SanityDocument<R>>
  /**
   * Deletes a document with the given document ID.
   * Returns an observable that resolves to an array containing the deleted document.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options: AllDocumentsMutationOptions,
  ): Observable<SanityDocument<R>[]>
  /**
   * Deletes a document with the given document ID.
   * Returns an observable that resolves to a mutation result object containing the deleted document ID.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete(id: string, options: FirstDocumentIdMutationOptions): Observable<SingleMutationResult>
  /**
   * Deletes a document with the given document ID.
   * Returns an observable that resolves to a mutation result object containing the deleted document ID.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete(id: string, options: AllDocumentIdsMutationOptions): Observable<MultipleMutationResult>
  /**
   * Deletes a document with the given document ID.
   * Returns an observable that resolves to the deleted document.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options?: BaseMutationOptions,
  ): Observable<SanityDocument<R>>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns an observable that resolves to first deleted document.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    selection: MutationSelection,
    options: FirstDocumentMutationOptions,
  ): Observable<SanityDocument<R>>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns an observable that resolves to an array containing the deleted documents.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    selection: MutationSelection,
    options: AllDocumentsMutationOptions,
  ): Observable<SanityDocument<R>[]>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns an observable that resolves to a mutation result object containing the ID of the first deleted document.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete(
    selection: MutationSelection,
    options: FirstDocumentIdMutationOptions,
  ): Observable<SingleMutationResult>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns an observable that resolves to a mutation result object containing the document IDs that were deleted.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete(
    selection: MutationSelection,
    options: AllDocumentIdsMutationOptions,
  ): Observable<MultipleMutationResult>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns an observable that resolves to first deleted document.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    selection: MutationSelection,
    options?: BaseMutationOptions,
  ): Observable<SanityDocument<R>>
  delete<R extends Record<string, Any> = Record<string, Any>>(
    selection: string | MutationSelection,
    options?:
      | AllDocumentIdsMutationOptions
      | AllDocumentsMutationOptions
      | BaseMutationOptions
      | FirstDocumentIdMutationOptions
      | FirstDocumentMutationOptions,
  ): Observable<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return dataMethods._delete<R>(this, this.#httpRequest, selection, options)
  }

  /**
   * Perform mutation operations against the configured dataset
   * Returns an observable that resolves to the first mutated document.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | ObservablePatch | ObservableTransaction,
    options: FirstDocumentMutationOptions,
  ): Observable<SanityDocument<R>>
  /**
   * Perform mutation operations against the configured dataset.
   * Returns an observable that resolves to an array of the mutated documents.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | ObservablePatch | ObservableTransaction,
    options: AllDocumentsMutationOptions,
  ): Observable<SanityDocument<R>[]>
  /**
   * Perform mutation operations against the configured dataset
   * Returns an observable that resolves to a mutation result object containing the document ID of the first mutated document.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | ObservablePatch | ObservableTransaction,
    options: FirstDocumentIdMutationOptions,
  ): Observable<SingleMutationResult>
  /**
   * Perform mutation operations against the configured dataset
   * Returns an observable that resolves to a mutation result object containing the mutated document IDs.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | ObservablePatch | ObservableTransaction,
    options: AllDocumentIdsMutationOptions,
  ): Observable<MultipleMutationResult>
  /**
   * Perform mutation operations against the configured dataset
   * Returns an observable that resolves to the first mutated document.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | ObservablePatch | ObservableTransaction,
    options?: BaseMutationOptions,
  ): Observable<SanityDocument<R>>
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | ObservablePatch | ObservableTransaction,
    options?:
      | FirstDocumentMutationOptions
      | AllDocumentsMutationOptions
      | FirstDocumentIdMutationOptions
      | AllDocumentIdsMutationOptions
      | BaseMutationOptions,
  ): Observable<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return dataMethods._mutate<R>(this, this.#httpRequest, operations, options)
  }

  /**
   * Create a new buildable patch of operations to perform
   *
   * @param documentId - Document ID(s) to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   */
  patch(documentId: PatchSelection, operations?: PatchOperations): ObservablePatch {
    return new ObservablePatch(documentId, operations, this)
  }

  /**
   * Create a new transaction of mutations
   *
   * @param operations - Optional array of mutation operations to initialize the transaction instance with
   */
  transaction<R extends Record<string, Any> = Record<string, Any>>(
    operations?: Mutation<R>[],
  ): ObservableTransaction {
    return new ObservableTransaction(operations, this)
  }

  /**
   * DEPRECATED: Perform an HTTP request against the Sanity API
   *
   * @deprecated Use your own request library!
   * @param options - Request options
   */
  request<R = Any>(options: RawRequestOptions): Observable<R> {
    return dataMethods._request(this, this.#httpRequest, options)
  }

  /**
   * Get a Sanity API URL for the URI provided
   *
   * @param uri - URI/path to build URL for
   * @param canUseCdn - Whether or not to allow using the API CDN for this route
   */
  getUrl(uri: string, canUseCdn?: boolean): string {
    return dataMethods._getUrl(this, uri, canUseCdn)
  }

  /**
   * Get a Sanity API URL for the data operation and path provided
   *
   * @param operation - Data operation (eg `query`, `mutate`, `listen` or similar)
   * @param path - Path to append after the operation
   */
  getDataUrl(operation: string, path?: string): string {
    return dataMethods._getDataUrl(this, operation, path)
  }
}

/** @public */
export class SanityClient {
  assets: AssetsClient
  datasets: DatasetsClient
  projects: ProjectsClient
  users: UsersClient

  /**
   * Observable version of the Sanity client, with the same configuration as the promise-based one
   */
  observable: ObservableSanityClient

  /**
   * Private properties
   */
  #clientConfig: InitializedClientConfig
  #httpRequest: HttpRequest

  /**
   * Instance properties
   */
  listen = _listen

  constructor(httpRequest: HttpRequest, config: ClientConfig = defaultConfig) {
    this.config(config)

    this.#httpRequest = httpRequest

    this.assets = new AssetsClient(this, this.#httpRequest)
    this.datasets = new DatasetsClient(this, this.#httpRequest)
    this.projects = new ProjectsClient(this, this.#httpRequest)
    this.users = new UsersClient(this, this.#httpRequest)

    this.observable = new ObservableSanityClient(httpRequest, config)
  }

  /**
   * Clone the client - returns a new instance
   */
  clone(): SanityClient {
    return new SanityClient(this.#httpRequest, this.config())
  }

  /**
   * Returns the current client configuration
   */
  config(): InitializedClientConfig
  /**
   * Reconfigure the client. Note that this _mutates_ the current client.
   */
  config(newConfig?: Partial<ClientConfig>): this
  config(newConfig?: Partial<ClientConfig>): ClientConfig | this {
    if (newConfig === undefined) {
      return {...this.#clientConfig}
    }

    if (this.#clientConfig && this.#clientConfig.allowReconfigure === false) {
      throw new Error(
        'Existing client instance cannot be reconfigured - use `withConfig(newConfig)` to return a new client',
      )
    }

    if (this.observable) {
      this.observable.config(newConfig)
    }

    this.#clientConfig = initConfig(newConfig, this.#clientConfig || {})
    return this
  }

  /**
   * Clone the client with a new (partial) configuration.
   *
   * @param newConfig - New client configuration properties, shallowly merged with existing configuration
   */
  withConfig(newConfig?: Partial<ClientConfig>): SanityClient {
    return new SanityClient(this.#httpRequest, {...this.config(), ...newConfig})
  }

  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   */
  fetch<R = Any>(query: string): Promise<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   */
  fetch<R = Any, Q = QueryParams>(query: string, params: Q): Promise<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<R = Any, Q = QueryParams>(
    query: string,
    params: Q | undefined,
    options: FilteredResponseQueryOptions,
  ): Promise<R>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<R = Any, Q = QueryParams>(
    query: string,
    params: Q | undefined,
    options: UnfilteredResponseQueryOptions,
  ): Promise<RawQueryResponse<R>>
  fetch<R, Q extends QueryParams>(
    query: string,
    params?: Q,
    options: FilteredResponseQueryOptions | UnfilteredResponseQueryOptions = {},
  ): Promise<RawQueryResponse<R> | R> {
    return lastValueFrom(dataMethods._fetch<R, Q>(this, this.#httpRequest, query, params, options))
  }

  /**
   * Fetch a single document with the given ID.
   *
   * @param id - Document ID to fetch
   * @param options - Request options
   */
  getDocument<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options?: {tag?: string},
  ): Promise<SanityDocument<R> | undefined> {
    return lastValueFrom(dataMethods._getDocument<R>(this, this.#httpRequest, id, options))
  }

  /**
   * Fetch multiple documents in one request.
   * Should be used sparingly - performing a query is usually a better option.
   * The order/position of documents is preserved based on the original array of IDs.
   * If any of the documents are missing, they will be replaced by a `null` entry in the returned array
   *
   * @param ids - Document IDs to fetch
   * @param options - Request options
   */
  getDocuments<R extends Record<string, Any> = Record<string, Any>>(
    ids: string[],
    options?: {tag?: string},
  ): Promise<(SanityDocument<R> | null)[]> {
    return lastValueFrom(dataMethods._getDocuments<R>(this, this.#httpRequest, ids, options))
  }

  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns a promise that resolves to the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options: FirstDocumentMutationOptions,
  ): Promise<SanityDocument<R>>
  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns a promise that resolves to an array containing the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options: AllDocumentsMutationOptions,
  ): Promise<SanityDocument<R>[]>
  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns a promise that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options: FirstDocumentIdMutationOptions,
  ): Promise<SingleMutationResult>
  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns a promise that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options: AllDocumentIdsMutationOptions,
  ): Promise<MultipleMutationResult>
  /**
   * Create a document. Requires a `_type` property. If no `_id` is provided, it will be generated by the database.
   * Returns a promise that resolves to the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options?: BaseMutationOptions,
  ): Promise<SanityDocument<R>>
  create<R extends Record<string, Any> = Record<string, Any>>(
    document: SanityDocumentStub<R>,
    options?:
      | AllDocumentIdsMutationOptions
      | AllDocumentsMutationOptions
      | BaseMutationOptions
      | FirstDocumentIdMutationOptions
      | FirstDocumentMutationOptions,
  ): Promise<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return lastValueFrom(
      dataMethods._create<R>(this, this.#httpRequest, document, 'create', options),
    )
  }

  /**
   * Create a document if no document with the same ID already exists.
   * Returns a promise that resolves to the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: FirstDocumentMutationOptions,
  ): Promise<SanityDocument<R>>
  /**
   * Create a document if no document with the same ID already exists.
   * Returns a promise that resolves to an array containing the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: AllDocumentsMutationOptions,
  ): Promise<SanityDocument<R>[]>
  /**
   * Create a document if no document with the same ID already exists.
   * Returns a promise that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: FirstDocumentIdMutationOptions,
  ): Promise<SingleMutationResult>
  /**
   * Create a document if no document with the same ID already exists.
   * Returns a promise that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: AllDocumentIdsMutationOptions,
  ): Promise<MultipleMutationResult>
  /**
   * Create a document if no document with the same ID already exists.
   * Returns a promise that resolves to the created document.
   *
   * @param document - Document to create
   * @param options - Mutation options
   */
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options?: BaseMutationOptions,
  ): Promise<SanityDocument<R>>
  createIfNotExists<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options?:
      | AllDocumentIdsMutationOptions
      | AllDocumentsMutationOptions
      | BaseMutationOptions
      | FirstDocumentIdMutationOptions
      | FirstDocumentMutationOptions,
  ): Promise<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return lastValueFrom(
      dataMethods._createIfNotExists<R>(this, this.#httpRequest, document, options),
    )
  }

  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns a promise that resolves to the created document.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: FirstDocumentMutationOptions,
  ): Promise<SanityDocument<R>>
  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns a promise that resolves to an array containing the created document.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: AllDocumentsMutationOptions,
  ): Promise<SanityDocument<R>[]>
  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns a promise that resolves to a mutation result object containing the ID of the created document.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: FirstDocumentIdMutationOptions,
  ): Promise<SingleMutationResult>
  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns a promise that resolves to a mutation result object containing the created document ID.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options: AllDocumentIdsMutationOptions,
  ): Promise<MultipleMutationResult>
  /**
   * Create a document if it does not exist, or replace a document with the same document ID
   * Returns a promise that resolves to the created document.
   *
   * @param document - Document to either create or replace
   * @param options - Mutation options
   */
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options?: BaseMutationOptions,
  ): Promise<SanityDocument<R>>
  createOrReplace<R extends Record<string, Any> = Record<string, Any>>(
    document: IdentifiedSanityDocumentStub<R>,
    options?:
      | AllDocumentIdsMutationOptions
      | AllDocumentsMutationOptions
      | BaseMutationOptions
      | FirstDocumentIdMutationOptions
      | FirstDocumentMutationOptions,
  ): Promise<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return lastValueFrom(
      dataMethods._createOrReplace<R>(this, this.#httpRequest, document, options),
    )
  }

  /**
   * Deletes a document with the given document ID.
   * Returns a promise that resolves to the deleted document.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options: FirstDocumentMutationOptions,
  ): Promise<SanityDocument<R>>
  /**
   * Deletes a document with the given document ID.
   * Returns a promise that resolves to an array containing the deleted document.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options: AllDocumentsMutationOptions,
  ): Promise<SanityDocument<R>[]>
  /**
   * Deletes a document with the given document ID.
   * Returns a promise that resolves to a mutation result object containing the deleted document ID.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete(id: string, options: FirstDocumentIdMutationOptions): Promise<SingleMutationResult>
  /**
   * Deletes a document with the given document ID.
   * Returns a promise that resolves to a mutation result object containing the deleted document ID.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete(id: string, options: AllDocumentIdsMutationOptions): Promise<MultipleMutationResult>
  /**
   * Deletes a document with the given document ID.
   * Returns a promise that resolves to the deleted document.
   *
   * @param id - Document ID to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options?: BaseMutationOptions,
  ): Promise<SanityDocument<R>>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns a promise that resolves to first deleted document.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    selection: MutationSelection,
    options: FirstDocumentMutationOptions,
  ): Promise<SanityDocument<R>>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns a promise that resolves to an array containing the deleted documents.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    selection: MutationSelection,
    options: AllDocumentsMutationOptions,
  ): Promise<SanityDocument<R>[]>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns a promise that resolves to a mutation result object containing the ID of the first deleted document.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete(
    selection: MutationSelection,
    options: FirstDocumentIdMutationOptions,
  ): Promise<SingleMutationResult>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns a promise that resolves to a mutation result object containing the document IDs that were deleted.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete(
    selection: MutationSelection,
    options: AllDocumentIdsMutationOptions,
  ): Promise<MultipleMutationResult>
  /**
   * Deletes one or more documents matching the given query or document ID.
   * Returns a promise that resolves to first deleted document.
   *
   * @param selection - An object with either an `id` or `query` key defining what to delete
   * @param options - Options for the mutation
   */
  delete<R extends Record<string, Any> = Record<string, Any>>(
    selection: MutationSelection,
    options?: BaseMutationOptions,
  ): Promise<SanityDocument<R>>
  delete<R extends Record<string, Any> = Record<string, Any>>(
    selection: string | MutationSelection,
    options?:
      | AllDocumentIdsMutationOptions
      | AllDocumentsMutationOptions
      | BaseMutationOptions
      | FirstDocumentIdMutationOptions
      | FirstDocumentMutationOptions,
  ): Promise<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return lastValueFrom(dataMethods._delete<R>(this, this.#httpRequest, selection, options))
  }

  /**
   * Perform mutation operations against the configured dataset
   * Returns a promise that resolves to the first mutated document.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | Patch | Transaction,
    options: FirstDocumentMutationOptions,
  ): Promise<SanityDocument<R>>
  /**
   * Perform mutation operations against the configured dataset.
   * Returns a promise that resolves to an array of the mutated documents.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | Patch | Transaction,
    options: AllDocumentsMutationOptions,
  ): Promise<SanityDocument<R>[]>
  /**
   * Perform mutation operations against the configured dataset
   * Returns a promise that resolves to a mutation result object containing the document ID of the first mutated document.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | Patch | Transaction,
    options: FirstDocumentIdMutationOptions,
  ): Promise<SingleMutationResult>
  /**
   * Perform mutation operations against the configured dataset
   * Returns a promise that resolves to a mutation result object containing the mutated document IDs.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any>>(
    operations: Mutation<R>[] | Patch | Transaction,
    options: AllDocumentIdsMutationOptions,
  ): Promise<MultipleMutationResult>
  /**
   * Perform mutation operations against the configured dataset
   * Returns a promise that resolves to the first mutated document.
   *
   * @param operations - Mutation operations to execute
   * @param options - Mutation options
   */
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | Patch | Transaction,
    options?: BaseMutationOptions,
  ): Promise<SanityDocument<R>>
  mutate<R extends Record<string, Any> = Record<string, Any>>(
    operations: Mutation<R>[] | Patch | Transaction,
    options?:
      | FirstDocumentMutationOptions
      | AllDocumentsMutationOptions
      | FirstDocumentIdMutationOptions
      | AllDocumentIdsMutationOptions
      | BaseMutationOptions,
  ): Promise<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    return lastValueFrom(dataMethods._mutate<R>(this, this.#httpRequest, operations, options))
  }

  /**
   * Create a new buildable patch of operations to perform
   *
   * @param documentId - Document ID(s)to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   */
  patch(documentId: PatchSelection, operations?: PatchOperations): Patch {
    return new Patch(documentId, operations, this)
  }

  /**
   * Create a new transaction of mutations
   *
   * @param operations - Optional array of mutation operations to initialize the transaction instance with
   */
  transaction<R extends Record<string, Any> = Record<string, Any>>(
    operations?: Mutation<R>[],
  ): Transaction {
    return new Transaction(operations, this)
  }

  /**
   * Perform a request against the Sanity API
   * NOTE: Only use this for Sanity API endpoints, not for your own APIs!
   *
   * @param options - Request options
   * @returns Promise resolving to the response body
   */
  request<R = Any>(options: RawRequestOptions): Promise<R> {
    return lastValueFrom(dataMethods._request<R>(this, this.#httpRequest, options))
  }

  /**
   * Perform an HTTP request a `/data` sub-endpoint
   * NOTE: Considered internal, thus marked as deprecated. Use `request` instead.
   *
   * @deprecated - Use `request()` or your own HTTP library instead
   * @param endpoint - Endpoint to hit (mutate, query etc)
   * @param body - Request body
   * @param options - Request options
   * @internal
   */
  dataRequest(endpoint: string, body: unknown, options?: BaseMutationOptions): Promise<Any> {
    return lastValueFrom(dataMethods._dataRequest(this, this.#httpRequest, endpoint, body, options))
  }

  /**
   * Get a Sanity API URL for the URI provided
   *
   * @param uri - URI/path to build URL for
   * @param canUseCdn - Whether or not to allow using the API CDN for this route
   */
  getUrl(uri: string, canUseCdn?: boolean): string {
    return dataMethods._getUrl(this, uri, canUseCdn)
  }

  /**
   * Get a Sanity API URL for the data operation and path provided
   *
   * @param operation - Data operation (eg `query`, `mutate`, `listen` or similar)
   * @param path - Path to append after the operation
   */
  getDataUrl(operation: string, path?: string): string {
    return dataMethods._getDataUrl(this, operation, path)
  }
}
