import {lastValueFrom, Observable} from 'rxjs'

import {AssetsClient, ObservableAssetsClient} from './assets/AssetsClient'
import {defaultConfig, initConfig} from './config'
import * as dataMethods from './data/dataMethods'
import {_listen} from './data/listen'
import {LiveClient} from './data/live'
import {ObservablePatch, Patch} from './data/patch'
import {ObservableTransaction, Transaction} from './data/transaction'
import {DatasetsClient, ObservableDatasetsClient} from './datasets/DatasetsClient'
import {ObservableProjectsClient, ProjectsClient} from './projects/ProjectsClient'
import type {
  Action,
  AllDocumentIdsMutationOptions,
  AllDocumentsMutationOptions,
  Any,
  BaseActionOptions,
  BaseMutationOptions,
  ClientConfig,
  ClientReturn,
  FilteredResponseQueryOptions,
  FirstDocumentIdMutationOptions,
  FirstDocumentMutationOptions,
  HttpRequest,
  IdentifiedSanityDocumentStub,
  InitializedClientConfig,
  MultipleActionResult,
  MultipleMutationResult,
  Mutation,
  MutationSelection,
  PatchOperations,
  PatchSelection,
  QueryOptions,
  QueryParams,
  QueryWithoutParams,
  RawQuerylessQueryResponse,
  RawQueryResponse,
  RawRequestOptions,
  SanityDocument,
  SanityDocumentStub,
  SingleActionResult,
  SingleMutationResult,
  UnfilteredResponseQueryOptions,
  UnfilteredResponseWithoutQuery,
} from './types'
import {ObservableUsersClient, UsersClient} from './users/UsersClient'

export type {
  _listen,
  AssetsClient,
  DatasetsClient,
  LiveClient,
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
  live: LiveClient
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
    this.live = new LiveClient(this)
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
    const thisConfig = this.config()
    return new ObservableSanityClient(this.#httpRequest, {
      ...thisConfig,
      ...newConfig,
      stega: {
        ...(thisConfig.stega || {}),
        ...(typeof newConfig?.stega === 'boolean'
          ? {enabled: newConfig.stega}
          : newConfig?.stega || {}),
      },
    })
  }

  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams = QueryWithoutParams,
    const G extends string = string,
  >(query: G, params?: Q | QueryWithoutParams): Observable<ClientReturn<G, R>>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Optional request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options?: FilteredResponseQueryOptions,
  ): Observable<ClientReturn<G, R>>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    query: string,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options: UnfilteredResponseQueryOptions,
  ): Observable<RawQueryResponse<ClientReturn<G, R>>>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options: UnfilteredResponseWithoutQuery,
  ): Observable<RawQuerylessQueryResponse<ClientReturn<G, R>>>
  fetch<R, Q, const G extends string>(
    query: G,
    params?: Q,
    options?: QueryOptions,
  ): Observable<RawQueryResponse<R> | R> {
    return dataMethods._fetch<R, Q>(
      this,
      this.#httpRequest,
      this.#clientConfig.stega,
      query,
      params,
      options,
    )
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
   * @param documentId - Document ID to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   * @returns Patch instance - call `.commit()` to perform the operations defined
   */
  patch(documentId: string, operations?: PatchOperations): ObservablePatch

  /**
   * Create a new buildable patch of operations to perform
   *
   * @param documentIds - Array of document IDs to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   * @returns Patch instance - call `.commit()` to perform the operations defined
   */
  patch(documentIds: string[], operations?: PatchOperations): ObservablePatch

  /**
   * Create a new buildable patch of operations to perform
   *
   * @param selection - An object with `query` and optional `params`, defining which document(s) to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   * @returns Patch instance - call `.commit()` to perform the operations defined
   */
  patch(selection: MutationSelection, operations?: PatchOperations): ObservablePatch

  /**
   * Create a new buildable patch of operations to perform
   *
   * @param selection - Document ID, an array of document IDs, or an object with `query` and optional `params`, defining which document(s) to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   * @returns Patch instance - call `.commit()` to perform the operations defined
   */
  patch(selection: PatchSelection, operations?: PatchOperations): ObservablePatch {
    return new ObservablePatch(selection, operations, this)
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
   * Perform action operations against the configured dataset
   *
   * @param operations - Action operation(s) to execute
   * @param options - Action options
   */
  action(
    operations: Action | Action[],
    options?: BaseActionOptions,
  ): Observable<SingleActionResult | MultipleActionResult> {
    return dataMethods._action(this, this.#httpRequest, operations, options)
  }

  /**
   * Perform an HTTP request against the Sanity API
   *
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
  live: LiveClient
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
    this.live = new LiveClient(this)
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
    const thisConfig = this.config()
    return new SanityClient(this.#httpRequest, {
      ...thisConfig,
      ...newConfig,
      stega: {
        ...(thisConfig.stega || {}),
        ...(typeof newConfig?.stega === 'boolean'
          ? {enabled: newConfig.stega}
          : newConfig?.stega || {}),
      },
    })
  }

  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams = QueryWithoutParams,
    const G extends string = string,
  >(query: G, params?: Q | QueryWithoutParams): Promise<ClientReturn<G, R>>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Optional request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options?: FilteredResponseQueryOptions,
  ): Promise<ClientReturn<G, R>>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options: UnfilteredResponseQueryOptions,
  ): Promise<RawQueryResponse<ClientReturn<G, R>>>
  /**
   * Perform a GROQ-query against the configured dataset.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Request options
   */
  fetch<
    R = Any,
    Q extends QueryWithoutParams | QueryParams = QueryParams,
    const G extends string = string,
  >(
    query: G,
    params: Q extends QueryWithoutParams ? QueryWithoutParams : Q,
    options: UnfilteredResponseWithoutQuery,
  ): Promise<RawQuerylessQueryResponse<ClientReturn<G, R>>>
  fetch<R, Q, const G extends string>(
    query: G,
    params?: Q,
    options?: QueryOptions,
  ): Promise<RawQueryResponse<ClientReturn<G, R>> | ClientReturn<G, R>> {
    return lastValueFrom(
      dataMethods._fetch<ClientReturn<G, R>, Q>(
        this,
        this.#httpRequest,
        this.#clientConfig.stega,
        query,
        params,
        options,
      ),
    )
  }

  /**
   * Fetch a single document with the given ID.
   *
   * @param id - Document ID to fetch
   * @param options - Request options
   */
  getDocument<R extends Record<string, Any> = Record<string, Any>>(
    id: string,
    options?: {signal?: AbortSignal; tag?: string},
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
    options?: {signal?: AbortSignal; tag?: string},
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
   * @param documentId - Document ID to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   * @returns Patch instance - call `.commit()` to perform the operations defined
   */
  patch(documentId: string, operations?: PatchOperations): Patch

  /**
   * Create a new buildable patch of operations to perform
   *
   * @param documentIds - Array of document IDs to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   * @returns Patch instance - call `.commit()` to perform the operations defined
   */
  patch(documentIds: string[], operations?: PatchOperations): Patch

  /**
   * Create a new buildable patch of operations to perform
   *
   * @param selection - An object with `query` and optional `params`, defining which document(s) to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   * @returns Patch instance - call `.commit()` to perform the operations defined
   */
  patch(selection: MutationSelection, operations?: PatchOperations): Patch

  /**
   * Create a new buildable patch of operations to perform
   *
   * @param selection - Document ID, an array of document IDs, or an object with `query` and optional `params`, defining which document(s) to patch
   * @param operations - Optional object of patch operations to initialize the patch instance with
   * @returns Patch instance - call `.commit()` to perform the operations defined
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
   * Perform action operations against the configured dataset
   * Returns a promise that resolves to the transaction result
   *
   * @param operations - Action operation(s) to execute
   * @param options - Action options
   */
  action(
    operations: Action | Action[],
    options?: BaseActionOptions,
  ): Promise<SingleActionResult | MultipleActionResult> {
    return lastValueFrom(dataMethods._action(this, this.#httpRequest, operations, options))
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
