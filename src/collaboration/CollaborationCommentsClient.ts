import {lastValueFrom, type Observable} from 'rxjs'

import type {ListenEventFromOptions} from '../data/listen'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  HttpRequest,
  ListenEvent,
  MultipleMutationResult,
  MutationEvent,
  QueryParams,
} from '../types'
import {
  _addReaction,
  _create,
  _delete,
  _fetch,
  _getTargetDocumentRef,
  _listen,
  _removeReaction,
  _update,
} from './comments'
import type {
  CollaborationCommentCreate,
  CollaborationCommentDocument,
  CollaborationCommentReactionShortName,
  CollaborationCommentsListenOptions,
  CollaborationCommentsRequestOptions,
  CollaborationCommentsWriteOptions,
  CollaborationCommentUpdate,
} from './types'

/**
 * Comments on the configured organization resource.
 *
 * Requires `collaboration.organizationId`, plus either `resource` or `projectId` and `dataset`.
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
   * Replies inherit `target`, `status`, and `threadId` from the parent comment.
   *
   * @param body - Comment to create
   * @param options - Optional request options
   * @returns The created comment
   */
  create(
    body: CollaborationCommentCreate,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<CollaborationCommentDocument> {
    return _create(this.#client, this.#httpRequest, body, options)
  }

  /**
   * Update an existing comment.
   *
   * Updating `status` cascades to the comment's replies.
   *
   * @param id - Comment document ID
   * @param body - Fields to update
   * @param options - Optional request options
   * @returns The updated comment
   */
  update(
    id: string,
    body: CollaborationCommentUpdate,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<CollaborationCommentDocument> {
    return _update(this.#client, this.#httpRequest, id, body, options)
  }

  /**
   * Delete a comment and its replies.
   *
   * @param id - Comment document ID
   * @param options - Optional request options
   * @returns Mutation result, where `documentIds` covers the comment and every deleted reply
   */
  delete(
    id: string,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<MultipleMutationResult> {
    return _delete(this.#client, this.#httpRequest, id, options)
  }

  /**
   * Add the current user's reaction to a comment.
   *
   * @param id - Comment document ID
   * @param shortName - Emoji short name, for example `:+1:`
   * @param options - Optional request options
   * @returns The comment, with the reaction applied
   */
  addReaction(
    id: string,
    shortName: CollaborationCommentReactionShortName,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<CollaborationCommentDocument> {
    return _addReaction(this.#client, this.#httpRequest, id, shortName, options)
  }

  /**
   * Remove the current user's reaction from a comment.
   *
   * @param id - Comment document ID
   * @param shortName - Emoji short name, for example `:+1:`
   * @param options - Optional request options
   * @returns The comment, with the reaction removed
   */
  removeReaction(
    id: string,
    shortName: CollaborationCommentReactionShortName,
    options?: CollaborationCommentsWriteOptions,
  ): Observable<CollaborationCommentDocument> {
    return _removeReaction(this.#client, this.#httpRequest, id, shortName, options)
  }

  /**
   * Build the global document reference used by `target.document._ref`, for use in
   * queries and listeners.
   *
   * The reference is built from the configured `resource` and the published ID of
   * the given document ID, since comment references always use published IDs.
   *
   * @example
   * ```ts
   * client.collaboration.comments.listen(
   *   '*[_type == "sanity.comment" && target.document._ref == $ref]',
   *   {ref: client.collaboration.comments.getTargetDocumentRef('doc-1')},
   * )
   * ```
   *
   * @param documentId - Document ID, in published, draft or version form
   * @returns Global document reference, of the form `resourceType:resourceId:documentId`
   */
  getTargetDocumentRef(
    documentId: string,
  ): CollaborationCommentDocument['target']['document']['_ref'] {
    return _getTargetDocumentRef(this.#client, documentId)
  }

  /**
   * Fetch comments on the configured resource.
   *
   * Takes the same `query` and `params` as `client.fetch`, and switches from a
   * GET to a POST for queries too large for the request URL in the same way,
   * but queries the comments endpoint, which accepts none of the query options
   * `client.fetch` does (`perspective`, `useCdn`, `filterResponse`,
   * `resultSourceMap`, stega).
   *
   * The query runs against the organization store, which is not scoped to
   * comments, so filter on `_type == "sanity.comment"`.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Optional request options
   */
  fetch<R = unknown>(
    query: string,
    params?: QueryParams,
    options?: CollaborationCommentsRequestOptions,
  ): Observable<R> {
    return _fetch<R>(this.#client, this.#httpRequest, query, params, options)
  }

  /**
   * Listen for changes to comments on the configured resource.
   *
   * Mirrors `client.listen(query, params)`, and emits mutation events.
   *
   * @param query - GROQ-filter to listen to changes for
   * @param params - Optional query parameters
   */
  listen(
    query: string,
    params?: QueryParams,
  ): Observable<MutationEvent<CollaborationCommentDocument>>
  /**
   * Listen for changes to comments on the configured resource.
   *
   * Mirrors `client.listen(query, params, options)`.
   *
   * @param query - GROQ-filter to listen to changes for
   * @param params - Optional query parameters
   * @param options - The same listener options `client.listen` takes, forwarded
   *   to the organization store's listener
   */
  listen<Opts extends CollaborationCommentsListenOptions>(
    query: string,
    params: QueryParams | undefined,
    options: Opts,
  ): Observable<ListenEventFromOptions<CollaborationCommentDocument, Opts>>
  listen(
    query: string,
    params?: QueryParams,
    options?: CollaborationCommentsListenOptions,
  ): Observable<ListenEvent<CollaborationCommentDocument>> {
    return _listen(this.#client, query, params, options)
  }
}

/**
 * Comments on the configured organization resource.
 *
 * Requires `collaboration.organizationId`, plus either `resource` or `projectId` and `dataset`.
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
   * Replies inherit `target`, `status`, and `threadId` from the parent comment.
   *
   * @param body - Comment to create
   * @param options - Optional request options
   * @returns The created comment
   */
  create(
    body: CollaborationCommentCreate,
    options?: CollaborationCommentsWriteOptions,
  ): Promise<CollaborationCommentDocument> {
    return lastValueFrom(_create(this.#client, this.#httpRequest, body, options))
  }

  /**
   * Update an existing comment.
   *
   * Updating `status` cascades to the comment's replies.
   *
   * @param id - Comment document ID
   * @param body - Fields to update
   * @param options - Optional request options
   * @returns The updated comment
   */
  update(
    id: string,
    body: CollaborationCommentUpdate,
    options?: CollaborationCommentsWriteOptions,
  ): Promise<CollaborationCommentDocument> {
    return lastValueFrom(_update(this.#client, this.#httpRequest, id, body, options))
  }

  /**
   * Delete a comment and its replies.
   *
   * @param id - Comment document ID
   * @param options - Optional request options
   * @returns Mutation result, where `documentIds` covers the comment and every deleted reply
   */
  delete(id: string, options?: CollaborationCommentsWriteOptions): Promise<MultipleMutationResult> {
    return lastValueFrom(_delete(this.#client, this.#httpRequest, id, options))
  }

  /**
   * Add the current user's reaction to a comment.
   *
   * @param id - Comment document ID
   * @param shortName - Emoji short name, for example `:+1:`
   * @param options - Optional request options
   * @returns The comment, with the reaction applied
   */
  addReaction(
    id: string,
    shortName: CollaborationCommentReactionShortName,
    options?: CollaborationCommentsWriteOptions,
  ): Promise<CollaborationCommentDocument> {
    return lastValueFrom(_addReaction(this.#client, this.#httpRequest, id, shortName, options))
  }

  /**
   * Remove the current user's reaction from a comment.
   *
   * @param id - Comment document ID
   * @param shortName - Emoji short name, for example `:+1:`
   * @param options - Optional request options
   * @returns The comment, with the reaction removed
   */
  removeReaction(
    id: string,
    shortName: CollaborationCommentReactionShortName,
    options?: CollaborationCommentsWriteOptions,
  ): Promise<CollaborationCommentDocument> {
    return lastValueFrom(_removeReaction(this.#client, this.#httpRequest, id, shortName, options))
  }

  /**
   * Build the global document reference used by `target.document._ref`, for use in
   * queries and listeners.
   *
   * The reference is built from the configured `resource` and the published ID of
   * the given document ID, since comment references always use published IDs.
   *
   * @example
   * ```ts
   * const comments = await client.collaboration.comments.fetch(
   *   '*[_type == "sanity.comment" && target.document._ref == $ref]',
   *   {ref: client.collaboration.comments.getTargetDocumentRef('doc-1')},
   * )
   * ```
   *
   * @param documentId - Document ID, in published, draft or version form
   * @returns Global document reference, of the form `resourceType:resourceId:documentId`
   */
  getTargetDocumentRef(
    documentId: string,
  ): CollaborationCommentDocument['target']['document']['_ref'] {
    return _getTargetDocumentRef(this.#client, documentId)
  }

  /**
   * Fetch comments on the configured resource.
   *
   * Takes the same `query` and `params` as `client.fetch`, and switches from a
   * GET to a POST for queries too large for the request URL in the same way,
   * but queries the comments endpoint, which accepts none of the query options
   * `client.fetch` does (`perspective`, `useCdn`, `filterResponse`,
   * `resultSourceMap`, stega).
   *
   * The query runs against the organization store, which is not scoped to
   * comments, so filter on `_type == "sanity.comment"`.
   *
   * @param query - GROQ-query to perform
   * @param params - Optional query parameters
   * @param options - Optional request options
   */
  fetch<R = unknown>(
    query: string,
    params?: QueryParams,
    options?: CollaborationCommentsRequestOptions,
  ): Promise<R> {
    return lastValueFrom(_fetch<R>(this.#client, this.#httpRequest, query, params, options))
  }

  /**
   * Listen for changes to comments on the configured resource.
   *
   * Mirrors `client.listen(query, params)`, and emits mutation events.
   *
   * @param query - GROQ-filter to listen to changes for
   * @param params - Optional query parameters
   */
  listen(
    query: string,
    params?: QueryParams,
  ): Observable<MutationEvent<CollaborationCommentDocument>>
  /**
   * Listen for changes to comments on the configured resource.
   *
   * Mirrors `client.listen(query, params, options)`.
   *
   * @param query - GROQ-filter to listen to changes for
   * @param params - Optional query parameters
   * @param options - The same listener options `client.listen` takes, forwarded
   *   to the organization store's listener
   */
  listen<Opts extends CollaborationCommentsListenOptions>(
    query: string,
    params: QueryParams | undefined,
    options: Opts,
  ): Observable<ListenEventFromOptions<CollaborationCommentDocument, Opts>>
  listen(
    query: string,
    params?: QueryParams,
    options?: CollaborationCommentsListenOptions,
  ): Observable<ListenEvent<CollaborationCommentDocument>> {
    return _listen(this.#client, query, params, options)
  }
}
