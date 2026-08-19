import {getPublishedId} from '@sanity/client/csm'
import {type Observable, throwError} from 'rxjs'
import {map} from 'rxjs/operators'

import {_requestObservable, getQuerySizeLimit} from '../data/dataMethods'
import {encodeQueryString} from '../data/encodeQueryString'
import {
  _connectListenEventSource,
  defaultOptions as defaultListenOptions,
  type ListenEventFromOptions,
  MAX_URL_LENGTH,
  possibleOptions as possibleListenOptions,
} from '../data/listen'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  HttpRequest,
  MultipleMutationResult,
  MutationOperation,
  QueryParams,
  ResumableListenEventNames,
} from '../types'
import defaults from '../util/defaults'
import {pick} from '../util/pick'
import {
  type CollaborationCommentCreate,
  type CollaborationCommentDocument,
  type CollaborationCommentReactionShortName,
  type CollaborationCommentsListenOptions,
  type CollaborationCommentsRequestOptions,
  type CollaborationCommentsWriteOptions,
  type CollaborationCommentUpdate,
  possibleRequestOptions,
} from './types'

type Client = SanityClient | ObservableSanityClient

function commentUrl(id: string): string {
  if (!id) {
    throw new Error('Comment ID must be provided')
  }

  return `/collaboration/comments/${encodeURIComponent(id)}`
}

function resolveCommentResource(client: Client): {type: string; id: string} {
  const {resource, projectId, dataset} = client.config()

  if (resource) {
    return resource
  }

  if (projectId && dataset) {
    return {type: 'dataset', id: `${projectId}.${dataset}`}
  }

  throw new Error(
    '`resource` or `projectId` and `dataset` must be configured to use collaboration comments',
  )
}

function resourceQuery(client: Client): Record<string, string> {
  const {collaboration} = client.config()
  const organizationId = collaboration?.organizationId

  if (!organizationId) {
    throw new Error(
      '`collaboration.organizationId` must be configured to use collaboration comments',
    )
  }

  const resource = resolveCommentResource(client)

  return {
    organizationId,
    resourceId: resource.id,
    resourceType: resource.type,
  }
}

/** @internal */
export function _getTargetDocumentRef(
  client: Client,
  documentId: string,
): CollaborationCommentDocument['target']['document']['_ref'] {
  if (!documentId) {
    throw new Error('Document ID must be provided')
  }

  const resource = resolveCommentResource(client)

  return `${resource.type}:${resource.id}:${getPublishedId(documentId)}`
}

type WriteArgs = [
  client: Client,
  httpRequest: HttpRequest,
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body: unknown,
  options?: CollaborationCommentsWriteOptions,
]

/**
 * The write endpoints pass the mutation response through as-is, mirroring
 * `client.mutate`.
 */
interface CommentMutationResponse {
  transactionId: string
  results: {id: string; operation: MutationOperation}[]
}

/**
 * Writes that return a comment come back with the document, since the API
 * requests documents from the org store and 404s when nothing matched. A
 * status update carries one result per cascaded reply on top of the comment
 * itself.
 */
interface CommentDocumentMutationResponse extends CommentMutationResponse {
  results: {id: string; operation: MutationOperation; document: CollaborationCommentDocument}[]
}

function write<T>(
  client: Client,
  httpRequest: HttpRequest,
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body: unknown,
  options: CollaborationCommentsWriteOptions = {},
): Observable<T> {
  return _requestObservable<T>(client, httpRequest, {
    method,
    url,
    body,
    query: {
      ...resourceQuery(client),
      ...(options.transactionId ? {transactionId: options.transactionId} : {}),
    },
    ...pick(options, possibleRequestOptions),
  })
}

/**
 * `commentId` picks the written comment out of the results: a status update
 * cascades to the comment's replies, and the API leaves the results unordered.
 * Creates pass the requested `_id`, which is undefined when the API assigns
 * one, and always come back with a single result.
 */
function writeDocument(
  commentId: string | undefined,
  ...args: WriteArgs
): Observable<CollaborationCommentDocument> {
  return write<CommentDocumentMutationResponse>(...args).pipe(
    map(({results}) => {
      const result = commentId ? results.find(({id}) => id === commentId) : results[0]
      if (!result?.document) {
        throw new Error('Comment write did not return a comment document')
      }
      return result.document
    }),
  )
}

function writeMutationResult(...args: WriteArgs): Observable<MultipleMutationResult> {
  return write<CommentMutationResponse>(...args).pipe(
    map(({transactionId, results}) => ({
      transactionId,
      documentIds: results.map((result) => result.id),
      results,
    })),
  )
}

/** @internal */
export function _create(
  client: Client,
  httpRequest: HttpRequest,
  body: CollaborationCommentCreate,
  options?: CollaborationCommentsWriteOptions,
): Observable<CollaborationCommentDocument> {
  return writeDocument(
    body._id,
    client,
    httpRequest,
    'POST',
    '/collaboration/comments',
    body,
    options,
  )
}

/** @internal */
export function _update(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  body: CollaborationCommentUpdate,
  options?: CollaborationCommentsWriteOptions,
): Observable<CollaborationCommentDocument> {
  return writeDocument(id, client, httpRequest, 'PATCH', commentUrl(id), body, options)
}

/** @internal */
export function _delete(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  options?: CollaborationCommentsWriteOptions,
): Observable<MultipleMutationResult> {
  return writeMutationResult(client, httpRequest, 'DELETE', commentUrl(id), undefined, options)
}

/** @internal */
export function _addReaction(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  shortName: CollaborationCommentReactionShortName,
  options?: CollaborationCommentsWriteOptions,
): Observable<CollaborationCommentDocument> {
  return writeDocument(
    id,
    client,
    httpRequest,
    'POST',
    `${commentUrl(id)}/reactions`,
    {shortName},
    options,
  )
}

/** @internal */
export function _removeReaction(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  shortName: CollaborationCommentReactionShortName,
  options?: CollaborationCommentsWriteOptions,
): Observable<CollaborationCommentDocument> {
  return writeDocument(
    id,
    client,
    httpRequest,
    'DELETE',
    `${commentUrl(id)}/reactions/${encodeURIComponent(shortName)}`,
    undefined,
    options,
  )
}

/** @internal */
export function _fetch<R>(
  client: Client,
  httpRequest: HttpRequest,
  query: string,
  params?: QueryParams,
  options?: CollaborationCommentsRequestOptions,
): Observable<R> {
  const search = resourceQuery(client)

  // Mirrors `client.fetch`: GET while the query fits in the URL, POST beyond that.
  const useGet = encodeQueryString({query, params}).length < getQuerySizeLimit
  const request = useGet
    ? {
        method: 'GET',
        url: `/collaboration/comments/query${encodeQueryString({query, params, options: search})}`,
      }
    : {
        method: 'POST',
        url: '/collaboration/comments/query',
        query: search,
        body: {query, params: params ?? {}},
      }

  return _requestObservable<{result: R}>(client, httpRequest, {
    ...request,
    ...pick(options || {}, possibleRequestOptions),
  }).pipe(map((response) => response.result))
}

/** @internal */
export function _listen<
  Opts extends CollaborationCommentsListenOptions = CollaborationCommentsListenOptions,
>(
  client: Client,
  query: string,
  params?: QueryParams,
  options?: Opts,
): Observable<ListenEventFromOptions<CollaborationCommentDocument, Opts>> {
  const opts: CollaborationCommentsListenOptions = options ?? {}

  // Mirrors `_listen` in data/listen.ts, but against the comments listen endpoint
  const {requestTagPrefix} = client.config()
  const tag = opts.tag && requestTagPrefix ? [requestTagPrefix, opts.tag].join('.') : opts.tag
  const listenOpts = pick({...defaults(opts, defaultListenOptions), tag}, possibleListenOptions)
  const qs = encodeQueryString({
    query,
    params,
    options: {...listenOpts, ...resourceQuery(client)},
  })

  const uri = `${client.getUrl('/collaboration/comments/listen')}${qs}`
  if (uri.length > MAX_URL_LENGTH) {
    return throwError(() => new Error('Query too large for listener'))
  }

  const events: ResumableListenEventNames[] = opts.events ? opts.events : ['mutation']

  return _connectListenEventSource<ListenEventFromOptions<CollaborationCommentDocument, Opts>>(
    client,
    uri,
    events,
  )
}
