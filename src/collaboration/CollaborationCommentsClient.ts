import {lastValueFrom, type Observable} from 'rxjs'

import type {ListenEventFromOptions} from '../data/listen'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, ListenEvent, MutationEvent, QueryParams} from '../types'
import {
  _addReaction,
  _create,
  _delete,
  _fetch,
  _fetchStructured,
  _listen,
  _listenStructured,
  _removeReaction,
  _update,
} from './comments'
import type {
  CollaborationCommentCreate,
  CollaborationCommentDocument,
  CollaborationCommentReactionShortName,
  CollaborationCommentsListenOptions,
  CollaborationCommentsRequestOptions,
  CollaborationCommentsStructuredFetchOptions,
  CollaborationCommentsStructuredListenOptions,
  CollaborationCommentsWriteOptions,
  CollaborationCommentUpdate,
} from './types'

type StructuredFetchArgs = [
  options?: CollaborationCommentsStructuredFetchOptions,
  requestOptions?: CollaborationCommentsRequestOptions,
]
type RawFetchArgs = [
  query: string,
  params?: QueryParams,
  options?: CollaborationCommentsRequestOptions,
]
type FetchArgs = StructuredFetchArgs | RawFetchArgs

type StructuredListenArgs = [
  options?: CollaborationCommentsStructuredListenOptions,
  listenOptions?: CollaborationCommentsListenOptions,
]
type RawListenArgs = [
  query: string,
  params?: QueryParams,
  options?: CollaborationCommentsListenOptions,
]
type ListenArgs = StructuredListenArgs | RawListenArgs

/**
 * The two call styles are distinguished by the first argument: raw GROQ calls
 * always pass a query string, structured calls pass an options object (or nothing).
 */
function isRawArgs(args: FetchArgs): args is RawFetchArgs
function isRawArgs(args: ListenArgs): args is RawListenArgs
function isRawArgs(args: FetchArgs | ListenArgs): boolean {
  return typeof args[0] === 'string'
}

/**
 * Comments on the configured `resource`.
 *
 * @alpha
 */
export class ObservableCollaborationCommentsClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Create a comment or reply on the configured resource.
   *
   * A top-level comment requires `target`; a reply requires `parentCommentId` (never both).
   * Replies inherit target, status and thread from the parent comment.
   *
   * @param body - Comment to create
   * @param options - Optional request options
   */
  create(
    body: CollaborationCommentCreate,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<void> {
    return _create(this.#client, this.#httpRequest, body, options)
  }

  /**
   * Update the message and/or status of an existing comment.
   *
   * @param id - Comment document ID
   * @param body - Fields to update
   * @param options - Optional request options
   */
  update(
    id: string,
    body: CollaborationCommentUpdate,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<void> {
    return _update(this.#client, this.#httpRequest, id, body, options)
  }

  /**
   * Delete a comment and its replies.
   *
   * @param id - Comment document ID
   * @param options - Optional request options
   */
  delete(id: string, options?: CollaborationCommentsWriteOptions): Observable<void> {
    return _delete(this.#client, this.#httpRequest, id, options)
  }

  /**
   * Add the current user's reaction to a comment.
   *
   * @param id - Comment document ID
   * @param shortName - Emoji short name, for example `:+1:`
   * @param options - Optional request options
   */
  addReaction(
    id: string,
    shortName: CollaborationCommentReactionShortName,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<void> {
    return _addReaction(this.#client, this.#httpRequest, id, shortName, options)
  }

  /**
   * Remove the current user's reaction from a comment.
   *
   * @param id - Comment document ID
   * @param shortName - Emoji short name, for example `:+1:`
   * @param options - Optional request options
   */
  removeReaction(
    id: string,
    shortName: CollaborationCommentReactionShortName,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<void> {
    return _removeReaction(this.#client, this.#httpRequest, id, shortName, options)
  }

  /**
   * Fetch comments on the configured resource.
   *
   * When called with structured options, this lists comment documents; the built-in
   * `_type == "sanity.comment"` filter is always applied. When called with a GROQ
   * query and params, it mirrors `client.fetch` and gives full control over the
   * query and the result shape. Both call styles accept trailing request options
   * such as `signal` and `tag`.
   *
   * @param options - Structured query options
   * @param requestOptions - Optional request options
   */
  fetch<R = CollaborationCommentDocument[]>(
    options?: CollaborationCommentsStructuredFetchOptions,
    requestOptions?: CollaborationCommentsRequestOptions,
  ): Observable<R>
  fetch<R = unknown>(
    query: string,
    params?: QueryParams,
    options?: CollaborationCommentsRequestOptions,
  ): Observable<R>
  fetch<R>(...args: FetchArgs): Observable<R> {
    return isRawArgs(args)
      ? _fetch<R>(this.#client, this.#httpRequest, ...args)
      : _fetchStructured<R>(this.#client, this.#httpRequest, ...args)
  }

  /**
   * Listen for changes to comments on the configured resource.
   *
   * Emits mutation events unless `events` is configured, like `client.listen`.
   * When called with structured options, it builds the query from `targetDocumentId`
   * and `filter`; the built-in `_type == "sanity.comment"` filter is always applied.
   * When called with a GROQ query and params, it mirrors
   * `client.listen(query, params, options)`. Both call styles accept trailing
   * listener options such as `events`, `includeResult` and `tag`.
   *
   * @param options - Structured listener options
   * @param listenOptions - Optional listener options
   */
  listen(
    options?: CollaborationCommentsStructuredListenOptions,
  ): Observable<MutationEvent<CollaborationCommentDocument>>
  listen<Opts extends CollaborationCommentsListenOptions>(
    options: CollaborationCommentsStructuredListenOptions | undefined,
    listenOptions: Opts,
  ): Observable<ListenEventFromOptions<CollaborationCommentDocument, Opts>>
  listen(
    query: string,
    params?: QueryParams,
  ): Observable<MutationEvent<CollaborationCommentDocument>>
  listen<Opts extends CollaborationCommentsListenOptions>(
    query: string,
    params: QueryParams | undefined,
    options: Opts,
  ): Observable<ListenEventFromOptions<CollaborationCommentDocument, Opts>>
  listen(...args: ListenArgs): Observable<ListenEvent<CollaborationCommentDocument>> {
    return isRawArgs(args)
      ? _listen(this.#client, ...args)
      : _listenStructured(this.#client, ...args)
  }
}

/**
 * Comments on the configured `resource`.
 *
 * @alpha
 */
export class CollaborationCommentsClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Create a comment or reply on the configured resource.
   *
   * A top-level comment requires `target`; a reply requires `parentCommentId` (never both).
   * Replies inherit target, status and thread from the parent comment.
   *
   * @param body - Comment to create
   * @param options - Optional request options
   */
  create(
    body: CollaborationCommentCreate,
    options?: CollaborationCommentsWriteOptions,
  ): Promise<void> {
    return lastValueFrom(_create(this.#client, this.#httpRequest, body, options))
  }

  /**
   * Update the message and/or status of an existing comment.
   *
   * @param id - Comment document ID
   * @param body - Fields to update
   * @param options - Optional request options
   */
  update(
    id: string,
    body: CollaborationCommentUpdate,
    options?: CollaborationCommentsWriteOptions,
  ): Promise<void> {
    return lastValueFrom(_update(this.#client, this.#httpRequest, id, body, options))
  }

  /**
   * Delete a comment and its replies.
   *
   * @param id - Comment document ID
   * @param options - Optional request options
   */
  delete(id: string, options?: CollaborationCommentsWriteOptions): Promise<void> {
    return lastValueFrom(_delete(this.#client, this.#httpRequest, id, options))
  }

  /**
   * Add the current user's reaction to a comment.
   *
   * @param id - Comment document ID
   * @param shortName - Emoji short name, for example `:+1:`
   * @param options - Optional request options
   */
  addReaction(
    id: string,
    shortName: CollaborationCommentReactionShortName,
    options?: CollaborationCommentsWriteOptions,
  ): Promise<void> {
    return lastValueFrom(_addReaction(this.#client, this.#httpRequest, id, shortName, options))
  }

  /**
   * Remove the current user's reaction from a comment.
   *
   * @param id - Comment document ID
   * @param shortName - Emoji short name, for example `:+1:`
   * @param options - Optional request options
   */
  removeReaction(
    id: string,
    shortName: CollaborationCommentReactionShortName,
    options?: CollaborationCommentsWriteOptions,
  ): Promise<void> {
    return lastValueFrom(_removeReaction(this.#client, this.#httpRequest, id, shortName, options))
  }

  /**
   * Fetch comments on the configured resource.
   *
   * When called with structured options, this lists comment documents; the built-in
   * `_type == "sanity.comment"` filter is always applied. When called with a GROQ
   * query and params, it mirrors `client.fetch` and gives full control over the
   * query and the result shape. Both call styles accept trailing request options
   * such as `signal` and `tag`.
   *
   * @param options - Structured query options
   * @param requestOptions - Optional request options
   */
  fetch<R = CollaborationCommentDocument[]>(
    options?: CollaborationCommentsStructuredFetchOptions,
    requestOptions?: CollaborationCommentsRequestOptions,
  ): Promise<R>
  fetch<R = unknown>(
    query: string,
    params?: QueryParams,
    options?: CollaborationCommentsRequestOptions,
  ): Promise<R>
  fetch<R>(...args: FetchArgs): Promise<R> {
    return lastValueFrom(
      isRawArgs(args)
        ? _fetch<R>(this.#client, this.#httpRequest, ...args)
        : _fetchStructured<R>(this.#client, this.#httpRequest, ...args),
    )
  }

  /**
   * Listen for changes to comments on the configured resource.
   *
   * Emits mutation events unless `events` is configured, like `client.listen`.
   * When called with structured options, it builds the query from `targetDocumentId`
   * and `filter`; the built-in `_type == "sanity.comment"` filter is always applied.
   * When called with a GROQ query and params, it mirrors
   * `client.listen(query, params, options)`. Both call styles accept trailing
   * listener options such as `events`, `includeResult` and `tag`.
   *
   * @param options - Structured listener options
   * @param listenOptions - Optional listener options
   */
  listen(
    options?: CollaborationCommentsStructuredListenOptions,
  ): Observable<MutationEvent<CollaborationCommentDocument>>
  listen<Opts extends CollaborationCommentsListenOptions>(
    options: CollaborationCommentsStructuredListenOptions | undefined,
    listenOptions: Opts,
  ): Observable<ListenEventFromOptions<CollaborationCommentDocument, Opts>>
  listen(
    query: string,
    params?: QueryParams,
  ): Observable<MutationEvent<CollaborationCommentDocument>>
  listen<Opts extends CollaborationCommentsListenOptions>(
    query: string,
    params: QueryParams | undefined,
    options: Opts,
  ): Observable<ListenEventFromOptions<CollaborationCommentDocument, Opts>>
  listen(...args: ListenArgs): Observable<ListenEvent<CollaborationCommentDocument>> {
    return isRawArgs(args)
      ? _listen(this.#client, ...args)
      : _listenStructured(this.#client, ...args)
  }
}
