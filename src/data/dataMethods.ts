import {getDraftId, getVersionFromId, getVersionId, isDraftId} from '@sanity/client/csm'
import {type MonoTypeOperatorFunction, Observable} from 'rxjs'
import {filter, map} from 'rxjs/operators'

import {validateApiPerspective} from '../config'
import {type FetchRequest, requestOptions} from '../http/requestOptions'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import {stegaClean} from '../stega/stegaClean'
import type {
  Action,
  AllDocumentIdsMutationOptions,
  AllDocumentsMutationOptions,
  Any,
  BaseActionOptions,
  BaseMutationOptions,
  CreateVersionAction,
  DiscardVersionAction,
  FirstDocumentIdMutationOptions,
  FirstDocumentMutationOptions,
  HttpRequest,
  IdentifiedSanityDocumentStub,
  InitializedClientConfig,
  InitializedStegaConfig,
  MultipleActionResult,
  MultipleMutationResult,
  Mutation,
  MutationSelection,
  QueryOptions,
  RawQueryResponse,
  ReplaceVersionAction,
  RequestObservableOptions,
  SanityDocument,
  SingleActionResult,
  SingleMutationResult,
  UnpublishVersionAction,
  UploadEvent,
} from '../types'
import {getSelection} from '../util/getSelection'
import * as validate from '../validators'
import * as validators from '../validators'
import {
  printCdnPreviewDraftsWarning,
  printCreateVersionWithBaseIdWarning,
  printPreviewDraftsDeprecationWarning,
} from '../warnings'
import {encodeQueryString} from './encodeQueryString'
import {ObservablePatch, Patch} from './patch'
import {ObservableTransaction, Transaction} from './transaction'

type Client = SanityClient | ObservableSanityClient

const excludeFalsey = (param: Any, defValue: Any) => {
  const value = typeof param === 'undefined' ? defValue : param
  return param === false ? undefined : value
}

const getMutationQuery = (options: BaseMutationOptions = {}) => {
  return {
    dryRun: options.dryRun,
    returnIds: true,
    returnDocuments: excludeFalsey(options.returnDocuments, true),
    visibility: options.visibility || 'sync',
    autoGenerateArrayKeys: options.autoGenerateArrayKeys,
    skipCrossDatasetReferenceValidation: options.skipCrossDatasetReferenceValidation,
  }
}

const indexBy = (docs: Any[], attr: Any) =>
  docs.reduce((indexed, doc) => {
    indexed[attr(doc)] = doc
    return indexed
  }, Object.create(null))

const getQuerySizeLimit = 11264

/**
 * Resolve the effective stega config, cleaned params, response mapper and
 * transport request options for a `fetch()` call. Shared by the observable and
 * promise paths.
 *
 * @internal
 */
function _fetchRequest<Q>(
  _stega: InitializedStegaConfig,
  _params: Q,
  options: QueryOptions,
): {stega: InitializedStegaConfig; params: Q; mapResponse: (res: Any) => Any; reqOpts: Any} {
  const stega =
    'stega' in options
      ? {
          ...(_stega || {}),
          ...(typeof options.stega === 'boolean' ? {enabled: options.stega} : options.stega || {}),
        }
      : _stega
  const params = stega.enabled ? stegaClean(_params) : _params
  const mapResponse =
    options.filterResponse === false ? (res: Any) => res : (res: Any) => res.result

  const {cache, next, ...opts} = {
    // Opt out of setting a `signal` on an internal `fetch` if one isn't provided.
    // This is necessary in React Server Components to avoid opting out of Request Memoization.
    useAbortSignal: typeof options.signal !== 'undefined',
    // Set `resultSourceMap' when stega is enabled, as it's required for encoding.
    resultSourceMap: stega.enabled ? 'withKeyArraySelector' : options.resultSourceMap,
    ...options,
    // Default to not returning the query, unless `filterResponse` is `false`,
    // or `returnQuery` is explicitly set. `true` is the default in Content Lake, so skip if truthy
    returnQuery: options.filterResponse === false && options.returnQuery !== false,
  }
  const reqOpts =
    typeof cache !== 'undefined' || typeof next !== 'undefined'
      ? {...opts, fetch: {cache, next}}
      : opts

  return {stega, params, mapResponse, reqOpts}
}

/** @internal */
export function _fetchObservable<R, Q>(
  client: Client,
  httpRequest: HttpRequest,
  _stega: InitializedStegaConfig,
  query: string,
  _params: Q = {} as Q,
  options: QueryOptions = {},
): Observable<RawQueryResponse<R> | R> {
  return _observe(options.signal, (signal) =>
    _fetch<R, Q>(client, httpRequest, _stega, query, _params, {...options, signal}),
  )
}

/**
 * Promise-based sibling of {@link _fetchObservable}.
 *
 * @internal
 */
export function _fetch<R, Q>(
  client: Client,
  httpRequest: HttpRequest,
  _stega: InitializedStegaConfig,
  query: string,
  _params: Q = {} as Q,
  options: QueryOptions = {},
): Promise<RawQueryResponse<R> | R> {
  const {stega, params, mapResponse, reqOpts} = _fetchRequest(_stega, _params, options)

  // Kick off the request synchronously (not in an `async` body) so option
  // validation - e.g. an invalid request tag or a missing dataset - throws
  // synchronously at call time, matching the rest of the promise surface.
  const request = _dataRequest(client, httpRequest, 'query', {query, params}, reqOpts)
  if (!stega.enabled) {
    return request.then(mapResponse)
  }
  return Promise.all([request, import('../stega/stegaEncodeSourceMap')]).then(
    ([res, {stegaEncodeSourceMap}]) => {
      const result = stegaEncodeSourceMap(res.result, res.resultSourceMap, stega)
      return mapResponse({...res, result})
    },
  )
}

/** @internal */
export function _getDocumentObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  opts: {signal?: AbortSignal; tag?: string; releaseId?: string; includeAllVersions: true},
): Observable<SanityDocument<R>[]>
/** @internal */
export function _getDocumentObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  opts?: {signal?: AbortSignal; tag?: string; releaseId?: string; includeAllVersions?: false},
): Observable<SanityDocument<R> | undefined>
/** @internal */
export function _getDocumentObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  opts: {signal?: AbortSignal; tag?: string; releaseId?: string; includeAllVersions?: boolean} = {},
): Observable<SanityDocument<R> | undefined | SanityDocument<R>[]> {
  return _observe(opts.signal, (signal) =>
    _request<{documents?: SanityDocument<R>[]}>(
      client,
      httpRequest,
      _getDocumentOptions(client, id, {...opts, signal}),
    ).then((body) => _mapGetDocument<R>(body, opts.includeAllVersions)),
  )
}

/**
 * Promise-based sibling of {@link _getDocumentObservable}.
 *
 * @internal
 */
export function _getDocument<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  opts: {signal?: AbortSignal; tag?: string; releaseId?: string; includeAllVersions: true},
): Promise<SanityDocument<R>[]>
/** @internal */
export function _getDocument<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  opts?: {signal?: AbortSignal; tag?: string; releaseId?: string; includeAllVersions?: false},
): Promise<SanityDocument<R> | undefined>
/** @internal */
export function _getDocument<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  opts: {signal?: AbortSignal; tag?: string; releaseId?: string; includeAllVersions?: boolean} = {},
): Promise<SanityDocument<R> | undefined | SanityDocument<R>[]> {
  const options = _getDocumentOptions(client, id, opts)
  return _request<{documents?: SanityDocument<R>[]}>(client, httpRequest, options).then((body) =>
    _mapGetDocument<R>(body, opts.includeAllVersions),
  )
}

/**
 * Resolve the document id (honoring `releaseId`) and build the transport
 * request options for {@link _getDocumentObservable}. Shared by the observable and
 * promise paths.
 *
 * @internal
 */
function _getDocumentOptions(
  client: Client,
  id: string,
  opts: {signal?: AbortSignal; tag?: string; releaseId?: string; includeAllVersions?: boolean},
): Any {
  let docId = id
  if (opts.releaseId) {
    const versionId = getVersionFromId(id)
    if (!versionId) {
      if (isDraftId(id)) {
        throw new Error(
          `The document ID (\`${id}\`) is a draft, but \`options.releaseId\` is set as \`${opts.releaseId}\``,
        )
      }
      docId = getVersionId(id, opts.releaseId)
    } else if (versionId !== opts.releaseId) {
      throw new Error(
        `The document ID (\`${id}\`) is already a version of \`${versionId}\` release, but this does not match the provided \`options.releaseId\` (\`${opts.releaseId}\`)`,
      )
    }
  }

  return {
    uri: _getDataUrl(client, 'doc', docId),
    tag: opts.tag,
    signal: opts.signal,
    query:
      opts.includeAllVersions !== undefined
        ? {includeAllVersions: opts.includeAllVersions}
        : undefined,
  }
}

function _mapGetDocument<R extends Record<string, Any>>(
  body: {documents?: SanityDocument<R>[]},
  includeAllVersions?: boolean,
): SanityDocument<R> | undefined | SanityDocument<R>[] {
  const documents = body.documents
  if (!documents) {
    return includeAllVersions ? [] : undefined
  }
  return includeAllVersions ? documents : documents[0]
}

/** @internal */
export function _getDocumentsObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  ids: string[],
  opts: {signal?: AbortSignal; tag?: string} = {},
): Observable<(SanityDocument<R> | null)[]> {
  return _observe(opts.signal, (signal) =>
    _getDocuments<R>(client, httpRequest, ids, {...opts, signal}),
  )
}

/**
 * Promise-based sibling of {@link _getDocumentsObservable}.
 *
 * @internal
 */
export function _getDocuments<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  ids: string[],
  opts: {signal?: AbortSignal; tag?: string} = {},
): Promise<(SanityDocument<R> | null)[]> {
  const options = _getDocumentsOptions(client, ids, opts)
  return _request<{documents?: SanityDocument<R>[]}>(client, httpRequest, options).then((body) =>
    _mapGetDocuments<R>(body, ids),
  )
}

function _getDocumentsOptions(
  client: Client,
  ids: string[],
  opts: {signal?: AbortSignal; tag?: string},
): Any {
  return {
    uri: _getDataUrl(client, 'doc', ids.join(',')),
    tag: opts.tag,
    signal: opts.signal,
  }
}

function _mapGetDocuments<R extends Record<string, Any>>(
  body: {documents?: SanityDocument<R>[]},
  ids: string[],
): (SanityDocument<R> | null)[] {
  const indexed = indexBy(body.documents || [], (doc: Any) => doc._id)
  return ids.map((id) => indexed[id] || null)
}

const DOCUMENTS_EXISTS_BATCH_SIZE = 100

/** @internal */
export function _documentsExistsObservable(
  client: Client,
  httpRequest: HttpRequest,
  ids: string[],
  opts: {signal?: AbortSignal; tag?: string} = {},
): Observable<Set<string>> {
  return _observe(opts.signal, (signal) =>
    _documentsExists(client, httpRequest, ids, {...opts, signal}),
  )
}

/**
 * Promise-based sibling of {@link _documentsExistsObservable}. Checks document
 * existence in batches, resolving to the set of IDs that exist.
 *
 * @internal
 */
export async function _documentsExists(
  client: Client,
  httpRequest: HttpRequest,
  ids: string[],
  opts: {signal?: AbortSignal; tag?: string} = {},
): Promise<Set<string>> {
  const existing = new Set<string>()
  if (ids.length === 0) {
    return existing
  }

  for (let i = 0; i < ids.length; i += DOCUMENTS_EXISTS_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + DOCUMENTS_EXISTS_BATCH_SIZE)
    const body = await _request<{omitted?: {id: string; reason: string}[]}>(client, httpRequest, {
      uri: _getDataUrl(client, 'doc', batchIds.map(encodeURIComponent).join(',')),
      tag: opts.tag,
      signal: opts.signal,
      query: {excludeContent: true},
    })

    const missing = new Set<string>()
    for (const omitted of body.omitted || []) {
      if (omitted.reason !== 'existence') continue
      missing.add(omitted.id)
    }
    for (const id of batchIds) {
      if (!missing.has(id)) existing.add(id)
    }
  }

  return existing
}

/** @internal */
export function _getReleaseDocumentsObservable<R extends Record<string, Any>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  releaseId: string,
  opts: BaseMutationOptions = {},
): Observable<RawQueryResponse<SanityDocument<R>[]>> {
  return _observe(opts.signal, (signal) =>
    _getReleaseDocuments<R>(client, httpRequest, releaseId, {...opts, signal}),
  )
}

/**
 * Promise-based sibling of {@link _getReleaseDocumentsObservable}.
 *
 * @internal
 */
export function _getReleaseDocuments<R extends Record<string, Any>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  releaseId: string,
  opts: BaseMutationOptions = {},
): Promise<RawQueryResponse<SanityDocument<R>[]>> {
  return _dataRequest(
    client,
    httpRequest,
    'query',
    {
      query: '*[sanity::partOfRelease($releaseId)]',
      params: {
        releaseId,
      },
    },
    opts,
  )
}

/** @internal */
export function _createIfNotExistsObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions,
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  return _observe(options?.signal, (signal) =>
    _createIfNotExists<R>(client, httpRequest, doc, {...options, signal}),
  )
}

/** @internal */
export function _createOrReplaceObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions,
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  return _observe(options?.signal, (signal) =>
    _createOrReplace<R>(client, httpRequest, doc, {...options, signal}),
  )
}

/** @internal */
export function _createVersionObservable<R extends Record<string, Any>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  publishedId: string,
  options?: BaseActionOptions,
): Observable<SingleActionResult> {
  return _observe(options?.signal, (signal) =>
    _createVersion<R>(client, httpRequest, doc, publishedId, {...options, signal}),
  )
}

/** @internal */
export function _createVersionFromBaseObservable(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  publishedId?: string,
  baseId?: string,
  releaseId?: string,
  ifBaseRevisionId?: string,
  options?: BaseActionOptions,
): Observable<SingleActionResult> {
  return _observe(options?.signal, (signal) =>
    _createVersionFromBase(client, httpRequest, publishedId, baseId, releaseId, ifBaseRevisionId, {
      ...options,
      signal,
    }),
  )
}

/** @internal */
export function _deleteObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
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
  return _observe(options?.signal, (signal) =>
    _delete<R>(client, httpRequest, selection, {...options, signal}),
  )
}

/** @internal */
export function _discardVersionObservable(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  versionId: string,
  purge: boolean = false,
  options?: BaseActionOptions,
): Observable<SingleActionResult> {
  return _observe(options?.signal, (signal) =>
    _discardVersion(client, httpRequest, versionId, purge, {...options, signal}),
  )
}

/** @internal */
export function _replaceVersionObservable<R extends Record<string, Any>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  options?: BaseActionOptions,
): Observable<SingleActionResult> {
  return _observe(options?.signal, (signal) =>
    _replaceVersion<R>(client, httpRequest, doc, {...options, signal}),
  )
}

/** @internal */
export function _unpublishVersionObservable(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  versionId: string,
  publishedId: string,
  options?: BaseActionOptions,
): Observable<SingleActionResult> {
  return _observe(options?.signal, (signal) =>
    _unpublishVersion(client, httpRequest, versionId, publishedId, {
      ...options,
      signal,
    }),
  )
}

/** @internal */
export function _mutateObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  mutations: Mutation<R>[] | Patch | ObservablePatch | Transaction | ObservableTransaction,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions,
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  return _observe(options?.signal, (signal) =>
    _mutate<R>(client, httpRequest, mutations, {...options, signal}),
  )
}

/**
 * @internal
 */
export function _actionObservable(
  client: Client,
  httpRequest: HttpRequest,
  actions: Action | Action[],
  options?: BaseActionOptions,
): Observable<SingleActionResult | MultipleActionResult> {
  return _observe(options?.signal, (signal) =>
    _action(client, httpRequest, actions, {...options, signal}),
  )
}

/**
 * Build the transport request options for a data endpoint (`query` / `mutate`
 * / `actions`). Shared by the observable and promise request paths.
 *
 * @internal
 */
function _dataRequestOptions(
  client: Client,
  endpoint: string,
  body: Any,
  options: Any = {},
): {reqOptions: Any; isMutation: boolean; returnFirst: boolean} {
  const isMutation = endpoint === 'mutate'
  const isAction = endpoint === 'actions'
  const isQuery = endpoint === 'query'

  // Check if the query string is within a configured threshold,
  // in which case we can use GET. Otherwise, use POST.
  const strQuery = isMutation || isAction ? '' : encodeQueryString(body)
  const useGet = !isMutation && !isAction && strQuery.length < getQuerySizeLimit
  const stringQuery = useGet ? strQuery : ''
  const returnFirst = options.returnFirst
  const {timeout, token, tag, headers, returnQuery, lastLiveEventId, cacheMode} = options

  const uri = _getDataUrl(client, endpoint, stringQuery)

  const reqOptions = {
    method: useGet ? 'GET' : 'POST',
    uri: uri,
    body: useGet ? undefined : body,
    query: isMutation && getMutationQuery(options),
    timeout,
    headers,
    token,
    tag,
    returnQuery,
    perspective: options.perspective,
    variant: options.variant,
    resultSourceMap: options.resultSourceMap,
    lastLiveEventId: Array.isArray(lastLiveEventId) ? lastLiveEventId[0] : lastLiveEventId,
    cacheMode: cacheMode,
    canUseCdn: isQuery,
    signal: options.signal,
    fetch: options.fetch,
    useAbortSignal: options.useAbortSignal,
    useCdn: options.useCdn,
  }

  return {reqOptions, isMutation, returnFirst}
}

/**
 * Shape the raw response body of a data request. For mutations this reduces
 * the API response to documents or ids; everything else passes through. Pure
 * function shared by the observable and promise request paths.
 *
 * @internal
 */
function _mapDataResponse(
  res: Any,
  isMutation: boolean,
  returnFirst: boolean,
  returnDocuments: boolean,
): Any {
  if (!isMutation) {
    return res
  }

  // Should we return documents?
  const results = res.results || []
  if (returnDocuments) {
    return returnFirst ? results[0] && results[0].document : results.map((mut: Any) => mut.document)
  }

  // Return a reduced subset
  const key = returnFirst ? 'documentId' : 'documentIds'
  const ids = returnFirst ? results[0] && results[0].id : results.map((mut: Any) => mut.id)
  return {
    transactionId: res.transactionId,
    results: results,
    [key]: ids,
  }
}

/**
 * @internal
 */
export function _dataRequestObservable(
  client: Client,
  httpRequest: HttpRequest,
  endpoint: string,
  body: Any,
  options: Any = {},
): Observable<Any> {
  return _observe(options.signal, (signal) =>
    _dataRequest(client, httpRequest, endpoint, body, {...options, signal}),
  )
}

/**
 * Promise-based sibling of {@link _dataRequestObservable}.
 *
 * @internal
 */
export function _dataRequest(
  client: Client,
  httpRequest: HttpRequest,
  endpoint: string,
  body: Any,
  options: Any = {},
): Promise<Any> {
  const {reqOptions, isMutation, returnFirst} = _dataRequestOptions(client, endpoint, body, options)
  return _request(client, httpRequest, reqOptions).then((res: Any) =>
    _mapDataResponse(res, isMutation, returnFirst, options.returnDocuments),
  )
}

/**
 * @internal
 */
export function _createObservable<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  doc: Any,
  op: Any,
  options: Any = {},
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  return _observe(options.signal, (signal) =>
    _create<R>(client, httpRequest, doc, op, {...options, signal}),
  )
}

/**
 * Promise-based sibling of {@link _createObservable}.
 *
 * @internal
 */
export function _create<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  doc: Any,
  op: Any,
  options: Any = {},
): Promise<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  const mutation = {[op]: doc}
  const opts = Object.assign({returnFirst: true, returnDocuments: true}, options)
  return _dataRequest(client, httpRequest, 'mutate', {mutations: [mutation]}, opts)
}

/**
 * Promise-based sibling of {@link _actionObservable}.
 *
 * @internal
 */
export function _action(
  client: Client,
  httpRequest: HttpRequest,
  actions: Action | Action[],
  options?: BaseActionOptions,
): Promise<SingleActionResult | MultipleActionResult> {
  const acts = Array.isArray(actions) ? actions : [actions]
  const transactionId = (options && options.transactionId) || undefined
  const skipCrossDatasetReferenceValidation =
    (options && options.skipCrossDatasetReferenceValidation) || undefined
  const dryRun = (options && options.dryRun) || undefined

  return _dataRequest(
    client,
    httpRequest,
    'actions',
    {actions: acts, transactionId, skipCrossDatasetReferenceValidation, dryRun},
    options,
  )
}

/**
 * Promise-based sibling of {@link _mutateObservable}.
 *
 * @internal
 */
export function _mutate<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  mutations: Mutation<R>[] | Patch | ObservablePatch | Transaction | ObservableTransaction,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions,
): Promise<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  let mut: Mutation | Mutation[]
  if (mutations instanceof Patch || mutations instanceof ObservablePatch) {
    mut = {patch: mutations.serialize()}
  } else if (mutations instanceof Transaction || mutations instanceof ObservableTransaction) {
    mut = mutations.serialize()
  } else {
    mut = mutations
  }

  const muts = Array.isArray(mut) ? mut : [mut]
  const transactionId = (options && options.transactionId) || undefined
  return _dataRequest(client, httpRequest, 'mutate', {mutations: muts, transactionId}, options)
}

/**
 * Promise-based sibling of {@link _deleteObservable}.
 *
 * @internal
 */
export function _delete<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
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
  return _dataRequest(
    client,
    httpRequest,
    'mutate',
    {mutations: [{delete: getSelection(selection)}]},
    options,
  )
}

/**
 * Promise-based sibling of {@link _createIfNotExistsObservable}.
 *
 * @internal
 */
export function _createIfNotExists<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions,
): Promise<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  validators.requireDocumentId('createIfNotExists', doc)
  return _create<R>(client, httpRequest, doc, 'createIfNotExists', options)
}

/**
 * Promise-based sibling of {@link _createOrReplaceObservable}.
 *
 * @internal
 */
export function _createOrReplace<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions,
): Promise<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  validators.requireDocumentId('createOrReplace', doc)
  return _create<R>(client, httpRequest, doc, 'createOrReplace', options)
}

/**
 * Promise-based sibling of {@link _createVersionObservable}.
 *
 * @internal
 */
export function _createVersion<R extends Record<string, Any>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  publishedId: string,
  options?: BaseActionOptions,
): Promise<SingleActionResult> {
  validators.requireDocumentId('createVersion', doc)
  validators.requireDocumentType('createVersion', doc)
  printCreateVersionWithBaseIdWarning()

  const createVersionAction: CreateVersionAction = {
    actionType: 'sanity.action.document.version.create',
    publishedId,
    document: doc,
  }

  return _action(client, httpRequest, createVersionAction, options)
}

/**
 * Promise-based sibling of {@link _createVersionFromBaseObservable}.
 *
 * @internal
 */
export function _createVersionFromBase(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  publishedId?: string,
  baseId?: string,
  releaseId?: string,
  ifBaseRevisionId?: string,
  options?: BaseActionOptions,
): Promise<SingleActionResult> {
  if (!baseId) {
    throw new Error('`createVersion()` requires `baseId` when no `document` is provided')
  }

  if (!publishedId) {
    throw new Error('`createVersion()` requires `publishedId` when `baseId` is provided')
  }

  validators.validateDocumentId('createVersion', baseId)
  validators.validateDocumentId('createVersion', publishedId)

  const createVersionAction: CreateVersionAction = {
    actionType: 'sanity.action.document.version.create',
    publishedId,
    baseId,
    versionId: releaseId ? getVersionId(publishedId, releaseId) : getDraftId(publishedId),
    ifBaseRevisionId,
  }

  return _action(client, httpRequest, createVersionAction, options)
}

/**
 * Promise-based sibling of {@link _discardVersionObservable}.
 *
 * @internal
 */
export function _discardVersion(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  versionId: string,
  purge: boolean = false,
  options?: BaseActionOptions,
): Promise<SingleActionResult> {
  const discardVersionAction: DiscardVersionAction = {
    actionType: 'sanity.action.document.version.discard',
    versionId,
    purge,
  }

  return _action(client, httpRequest, discardVersionAction, options)
}

/**
 * Promise-based sibling of {@link _replaceVersionObservable}.
 *
 * @internal
 */
export function _replaceVersion<R extends Record<string, Any>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  options?: BaseActionOptions,
): Promise<SingleActionResult> {
  validators.requireDocumentId('replaceVersion', doc)
  validators.requireDocumentType('replaceVersion', doc)

  const replaceVersionAction: ReplaceVersionAction = {
    actionType: 'sanity.action.document.version.replace',
    document: doc,
  }

  return _action(client, httpRequest, replaceVersionAction, options)
}

/**
 * Promise-based sibling of {@link _unpublishVersionObservable}.
 *
 * @internal
 */
export function _unpublishVersion(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  versionId: string,
  publishedId: string,
  options?: BaseActionOptions,
): Promise<SingleActionResult> {
  const unpublishVersionAction: UnpublishVersionAction = {
    actionType: 'sanity.action.document.version.unpublish',
    versionId,
    publishedId,
  }

  return _action(client, httpRequest, unpublishVersionAction, options)
}

const hasDataConfig = (client: Client) => {
  const config = client.config()
  return (
    (config.dataset !== undefined && config.projectId !== undefined) ||
    config.resource !== undefined
  )
}

const isQuery = (client: Client, uri: string) =>
  hasDataConfig(client) && uri.startsWith(_getDataUrl(client, 'query'))

const isMutate = (client: Client, uri: string) =>
  hasDataConfig(client) && uri.startsWith(_getDataUrl(client, 'mutate'))

const isDoc = (client: Client, uri: string) =>
  hasDataConfig(client) && uri.startsWith(_getDataUrl(client, 'doc', ''))

const isListener = (client: Client, uri: string) =>
  hasDataConfig(client) && uri.startsWith(_getDataUrl(client, 'listen'))

const isHistory = (client: Client, uri: string) =>
  hasDataConfig(client) && uri.startsWith(_getDataUrl(client, 'history', ''))

const isData = (client: Client, uri: string) =>
  uri.startsWith('/data/') ||
  isQuery(client, uri) ||
  isMutate(client, uri) ||
  isDoc(client, uri) ||
  isListener(client, uri) ||
  isHistory(client, uri)

/**
 * Build the final request options (URL, headers, query params, etc.) used by
 * both the regular request pipeline and the asset upload path.
 *
 * @internal
 */
export function _prepareRequest(client: Client, options: RequestObservableOptions): FetchRequest {
  const uri = options.url || (options.uri as string)
  const config = client.config()

  // If the `canUseCdn`-option is not set we detect it automatically based on the method + URL.
  // Only the /data endpoint is currently available through API-CDN.
  const canUseCdn =
    typeof options.canUseCdn === 'undefined'
      ? ['GET', 'HEAD'].indexOf(options.method || 'GET') >= 0 && isData(client, uri)
      : options.canUseCdn

  let useCdn = (options.useCdn ?? config.useCdn) && canUseCdn

  const tag =
    options.tag && config.requestTagPrefix
      ? [config.requestTagPrefix, options.tag].join('.')
      : options.tag || config.requestTagPrefix

  if (tag && options.tag !== null) {
    options.query = {tag: validate.requestTag(tag), ...options.query}
  }

  // GROQ query-only parameters
  if (['GET', 'HEAD', 'POST'].indexOf(options.method || 'GET') >= 0 && isQuery(client, uri)) {
    const resultSourceMap = options.resultSourceMap ?? config.resultSourceMap
    if (resultSourceMap !== undefined && resultSourceMap !== false) {
      options.query = {resultSourceMap, ...options.query}
    }
    const perspectiveOption = options.perspective || config.perspective
    if (typeof perspectiveOption !== 'undefined') {
      if (perspectiveOption === 'previewDrafts') {
        printPreviewDraftsDeprecationWarning()
      }
      validateApiPerspective(perspectiveOption)
      options.query = {
        perspective: Array.isArray(perspectiveOption)
          ? perspectiveOption.join(',')
          : perspectiveOption,
        ...options.query,
      }
      // If the perspective is set to `drafts` or multiple perspectives we can't use the CDN, the API will throw
      if (
        ((Array.isArray(perspectiveOption) && perspectiveOption.length > 0) ||
          // previewDrafts was renamed to drafts, but keep for backwards compat
          perspectiveOption === 'previewDrafts' ||
          perspectiveOption === 'drafts') &&
        useCdn
      ) {
        useCdn = false
        printCdnPreviewDraftsWarning()
      }
    }

    const variantOption = options.variant || config.variant

    if (typeof variantOption !== 'undefined') {
      if (typeof variantOption === 'string') {
        options.query = {
          variant: variantOption,
          ...options.query,
        }
      }

      if (typeof variantOption === 'object') {
        const variantConditions = Object.entries(variantOption)
        const searchParams = variantConditionPairsToSearchParams(variantConditions).slice(0, 1)

        if (variantConditions.length > 1) {
          const formatter = new Intl.ListFormat('en')

          // eslint-disable-next-line no-console -- will be removed in an upcoming version; it's better this behaviour is noisy and obvious
          console.warn(
            `The Sanity client's beta \`variant\` option currently only supports one condition. Dropped: ${formatter.format(variantConditions.slice(1).map(([subject]) => JSON.stringify(subject)))}.`,
          )
        }

        options.query = {
          ...Object.fromEntries(searchParams),
          ...options.query,
        }
      }
    }

    if (options.lastLiveEventId) {
      options.query = {...options.query, lastLiveEventId: options.lastLiveEventId}
    }

    if (options.returnQuery === false) {
      options.query = {returnQuery: 'false', ...options.query}
    }

    if (useCdn && options.cacheMode == 'noStale') {
      options.query = {cacheMode: 'noStale', ...options.query}
    }
  }

  return requestOptions(
    config,
    Object.assign({}, options, {
      url: _getUrl(client, uri, useCdn),
    }),
  )
}

/**
 * Wrap a promise-returning request in a cold, single-value Observable.
 *
 * Each subscription invokes `run` with a fresh `AbortSignal` that is aborted
 * when the subscriber unsubscribes — so unsubscribing cancels the in-flight
 * `fetch`. A caller-supplied `userSignal` is chained in too, so the request
 * still aborts when the caller's own signal fires. The single resolved value
 * (or rejection) is forwarded to the subscriber.
 *
 * This is the bridge that lets the observable client surface reuse the exact
 * same promise implementations as the promise client surface, with no
 * duplicated request logic.
 *
 * @internal
 */
export function _observe<R>(
  userSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<R>,
): Observable<R> {
  return new Observable<R>((subscriber) => {
    const controller = new AbortController()
    if (userSignal) {
      if (userSignal.aborted) {
        controller.abort()
      } else {
        userSignal.addEventListener('abort', () => controller.abort(), {once: true})
      }
    }
    run(controller.signal).then(
      (value) => {
        subscriber.next(value)
        subscriber.complete()
      },
      (err) => subscriber.error(err),
    )
    return () => controller.abort()
  })
}

/**
 * Promise-based sibling of {@link _requestObservable}. Resolves directly to
 * the parsed response body without ever constructing an Observable. The abort
 * signal is honored by the underlying `fetch` (it is threaded onto the request
 * options), so no RxJS-level teardown is required.
 *
 * @internal
 */
export function _request<R>(client: Client, httpRequest: HttpRequest, options: Any): Promise<R> {
  const reqOptions = _prepareRequest(client, options)
  return httpRequest(reqOptions).then((body) => body as R)
}

/**
 * Execute an HTTP request through the regular pipeline and resolve to the
 * parsed response body. Observable wrapper over {@link _request}.
 *
 * @internal
 */
export function _requestObservable<R>(
  client: Client,
  httpRequest: HttpRequest,
  options: Any,
): Observable<R> {
  return _observe(options.signal, (signal) =>
    _request<R>(client, httpRequest, {...options, signal}),
  )
}

/**
 * Execute an asset upload through the underlying requester directly,
 * exposing the full upload event stream (progress + response).
 *
 * Bypasses the body-only `HttpRequest` boundary so progress events from the
 * transport layer can surface to consumers, reading the resolved requester
 * straight off the initialized config.
 *
 * @internal
 */
export function _uploadObservable<T>(
  client: Client,
  options: RequestObservableOptions,
): Observable<UploadEvent<T>> {
  const reqOptions = _prepareRequest(client, options)
  const requester = client.config().requester
  const request = new Observable<Any>((subscriber) =>
    requester(reqOptions).subscribe(subscriber),
  ).pipe(
    filter((event: Any) => event?.type === 'progress' || event?.type === 'response'),
    map(
      (event: Any): UploadEvent<T> =>
        event.type === 'progress'
          ? {
              type: 'progress',
              stage: event.stage,
              percent: event.percent,
              total: event.total,
              loaded: event.loaded,
              lengthComputable: event.lengthComputable,
            }
          : {type: 'response', body: event.body as T},
    ),
  )
  return options.signal ? request.pipe(_withAbortSignal(options.signal)) : request
}

/**
 * @internal
 */
export function _getDataUrl(client: Client, operation: string, path?: string): string {
  const config = client.config()
  const resource = config.resource
  if (resource) {
    validators.resourceConfig(config)
    const resourceBase = resourceDataBase(config)
    const uri = path !== undefined ? `${operation}/${path}` : operation
    return `${resourceBase}/${uri}`.replace(/\/($|\?)/, '$1')
  }
  const catalog = validators.hasDataset(config)
  const baseUri = `/${operation}/${catalog}`
  const uri = path !== undefined ? `${baseUri}/${path}` : baseUri
  return `/data${uri}`.replace(/\/($|\?)/, '$1')
}

/**
 * @internal
 */
export function _getUrl(client: Client, uri: string, canUseCdn = false): string {
  const {url, cdnUrl} = client.config()
  const base = canUseCdn ? cdnUrl : url
  return `${base}/${uri.replace(/^\//, '')}`
}

/**
 * @internal
 */
function _withAbortSignal<T>(signal: AbortSignal): MonoTypeOperatorFunction<T> {
  return (input) => {
    return new Observable((observer) => {
      const abort = () => observer.error(_createAbortError(signal))

      if (signal && signal.aborted) {
        abort()
        return
      }
      const subscription = input.subscribe(observer)
      signal.addEventListener('abort', abort)
      return () => {
        signal.removeEventListener('abort', abort)
        subscription.unsubscribe()
      }
    })
  }
}
/**
 * `DOMException` is globally available in every supported runtime
 * (Node 22.12+ and all modern browsers), so we can construct one directly.
 *
 * @internal
 */
function _createAbortError(signal?: AbortSignal): DOMException {
  return new DOMException(signal?.reason ?? 'The operation was aborted.', 'AbortError')
}

const resourceDataBase = (config: InitializedClientConfig): string => {
  const resource = config.resource
  if (!resource) {
    throw new Error('`resource` must be provided to perform resource queries')
  }
  const {type, id} = resource

  switch (type) {
    case 'dataset': {
      const segments = id.split('.')
      if (segments.length !== 2) {
        throw new Error('Dataset ID must be in the format "project.dataset"')
      }
      return `/projects/${segments[0]}/datasets/${segments[1]}`
    }
    case 'canvas': {
      return `/canvases/${id}`
    }
    case 'media-library': {
      return `/media-libraries/${id}`
    }
    case 'dashboard': {
      return `/dashboards/${id}`
    }
    default:
      // @ts-expect-error - handle all supported resource types
      throw new Error(`Unsupported resource type: ${type.toString()}`)
  }
}

function variantConditionPairsToSearchParams(
  variantConditionPairs: string[][],
): ['variantCondition', `${string}:${string}`][] {
  return variantConditionPairs.map(([condition, value]) => [
    'variantCondition',
    `${condition}:${value}`,
  ])
}
