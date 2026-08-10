import {type Observable, throwError} from 'rxjs'
import {map} from 'rxjs/operators'

import {_request} from '../data/dataMethods'
import {encodeQueryString} from '../data/encodeQueryString'
import {
  _connectListenEventSource,
  defaultOptions as defaultListenOptions,
  type ListenEventFromOptions,
  MAX_URL_LENGTH,
  possibleOptions as possibleListenOptions,
} from '../data/listen'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, QueryParams, ResumableListenEventNames} from '../types'
import defaults from '../util/defaults'
import {getPublishedId} from '../util/getPublishedId'
import {pick} from '../util/pick'
import {
  type CollaborationCommentCreate,
  type CollaborationCommentDocument,
  type CollaborationCommentReactionShortName,
  type CollaborationCommentsListenOptions,
  type CollaborationCommentsRequestOptions,
  type CollaborationCommentsStructuredFetchOptions,
  type CollaborationCommentsStructuredListenOptions,
  type CollaborationCommentsWriteOptions,
  type CollaborationCommentUpdate,
  possibleRequestOptions,
} from './types'

type Client = SanityClient | ObservableSanityClient

function commentUrl(id: string): string {
  return `/collaboration/comments/${encodeURIComponent(id)}`
}

function resourceQuery(client: Client): Record<string, string> {
  const {organizationId, resource} = client.config()

  if (!organizationId) {
    throw new Error('`organizationId` must be configured to use collaboration comments')
  }

  if (!resource) {
    throw new Error('`resource` must be configured to use collaboration comments')
  }

  return {
    organizationId,
    resourceId: resource.id,
    resourceType: resource.type,
  }
}

function buildFilter(
  client: Client,
  options: {filter?: string; targetDocumentId?: string} = {},
): string {
  const conditions = ['_type == "sanity.comment"']

  if (options.targetDocumentId) {
    const {resourceType, resourceId} = resourceQuery(client)
    const ref = `${resourceType}:${resourceId}:${getPublishedId(options.targetDocumentId)}`
    conditions.push(`target.document._ref == ${JSON.stringify(ref)}`)
  }

  if (options.filter) {
    conditions.push(`(${options.filter})`)
  }

  return conditions.join(' && ')
}

function buildStructuredFetchQuery(
  client: Client,
  options: CollaborationCommentsStructuredFetchOptions = {},
): string {
  const {orderings, slice} = options
  let query = `*[${buildFilter(client, options)}]`

  if (orderings?.length) {
    const order = orderings.map((ordering) => `${ordering.field} ${ordering.direction}`)
    query += ` | order(${order.join(', ')})`
  }

  if (slice) {
    query += `[${slice[0]}...${slice[1]}]`
  }

  return query
}

function write(
  client: Client,
  httpRequest: HttpRequest,
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body: unknown,
  options: CollaborationCommentsWriteOptions = {},
): Observable<void> {
  return _request<void>(client, httpRequest, {
    method,
    uri: url,
    body,
    query: {
      ...resourceQuery(client),
      ...(options.transactionId ? {transactionId: options.transactionId} : {}),
    },
    ...pick(options, possibleRequestOptions),
  })
}

/** @internal */
export function _create(
  client: Client,
  httpRequest: HttpRequest,
  body: CollaborationCommentCreate,
  options?: CollaborationCommentsWriteOptions,
): Observable<void> {
  return write(client, httpRequest, 'POST', '/collaboration/comments', body, options)
}

/** @internal */
export function _update(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  body: CollaborationCommentUpdate,
  options?: CollaborationCommentsWriteOptions,
): Observable<void> {
  return write(client, httpRequest, 'PATCH', commentUrl(id), body, options)
}

/** @internal */
export function _delete(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  options?: CollaborationCommentsWriteOptions,
): Observable<void> {
  return write(client, httpRequest, 'DELETE', commentUrl(id), undefined, options)
}

/** @internal */
export function _addReaction(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  shortName: CollaborationCommentReactionShortName,
  options?: CollaborationCommentsWriteOptions,
): Observable<void> {
  return write(client, httpRequest, 'POST', `${commentUrl(id)}/reactions`, {shortName}, options)
}

/** @internal */
export function _removeReaction(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  shortName: CollaborationCommentReactionShortName,
  options?: CollaborationCommentsWriteOptions,
): Observable<void> {
  return write(
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
  const qs = encodeQueryString({
    query,
    params,
    options: resourceQuery(client),
  })

  const uri = `/collaboration/comments/query${qs}`
  if (client.getUrl(uri).length > MAX_URL_LENGTH) {
    return throwError(() => new Error('Query too large for request URL'))
  }

  return _request<{result: R}>(client, httpRequest, {
    method: 'GET',
    uri,
    ...pick(options || {}, possibleRequestOptions),
  }).pipe(map((response) => response.result))
}

/** @internal */
export function _fetchStructured<R>(
  client: Client,
  httpRequest: HttpRequest,
  options: CollaborationCommentsStructuredFetchOptions = {},
  requestOptions?: CollaborationCommentsRequestOptions,
): Observable<R> {
  return _fetch(
    client,
    httpRequest,
    buildStructuredFetchQuery(client, options),
    options.params,
    requestOptions,
  )
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
    options: {tag, ...listenOpts, ...resourceQuery(client)},
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

/** @internal */
export function _listenStructured<
  Opts extends CollaborationCommentsListenOptions = CollaborationCommentsListenOptions,
>(
  client: Client,
  options: CollaborationCommentsStructuredListenOptions = {},
  listenOptions?: Opts,
): Observable<ListenEventFromOptions<CollaborationCommentDocument, Opts>> {
  return _listen(client, `*[${buildFilter(client, options)}]`, options.params, listenOptions)
}
