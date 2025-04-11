import {from, type MonoTypeOperatorFunction, Observable} from 'rxjs'
import {combineLatestWith, filter, map} from 'rxjs/operators'

import {validateApiPerspective} from '../config'
import {requestOptions} from '../http/requestOptions'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import {stegaClean} from '../stega/stegaClean'
import type {
  Action,
  AllDocumentIdsMutationOptions,
  AllDocumentsMutationOptions,
  Any,
  BaseActionOptions,
  BaseMutationOptions,
  FirstDocumentIdMutationOptions,
  FirstDocumentMutationOptions,
  HttpRequest,
  HttpRequestEvent,
  IdentifiedSanityDocumentStub,
  InitializedClientConfig,
  InitializedStegaConfig,
  MultipleActionResult,
  MultipleMutationResult,
  Mutation,
  MutationSelection,
  QueryOptions,
  RawQueryResponse,
  RequestObservableOptions,
  RequestOptions,
  SanityDocument,
  SingleActionResult,
  SingleMutationResult,
} from '../types'
import {getSelection} from '../util/getSelection'
import * as validate from '../validators'
import * as validators from '../validators'
import {printCdnPreviewDraftsWarning, printPreviewDraftsDeprecationWarning} from '../warnings'
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

const isResponse = (event: Any) => event.type === 'response'
const getBody = (event: Any) => event.body

const indexBy = (docs: Any[], attr: Any) =>
  docs.reduce((indexed, doc) => {
    indexed[attr(doc)] = doc
    return indexed
  }, Object.create(null))

const getQuerySizeLimit = 11264

/** @internal */
export function _fetch<R, Q>(
  client: Client,
  httpRequest: HttpRequest,
  _stega: InitializedStegaConfig,
  query: string,
  _params: Q = {} as Q,
  options: QueryOptions = {},
): Observable<RawQueryResponse<R> | R> {
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

  const $request = _dataRequest(client, httpRequest, 'query', {query, params}, reqOpts)
  return stega.enabled
    ? $request.pipe(
        combineLatestWith(
          from(
            import('../stega/stegaEncodeSourceMap').then(
              ({stegaEncodeSourceMap}) => stegaEncodeSourceMap,
            ),
          ),
        ),
        map(
          ([res, stegaEncodeSourceMap]: [
            Any,
            (typeof import('../stega/stegaEncodeSourceMap'))['stegaEncodeSourceMap'],
          ]) => {
            const result = stegaEncodeSourceMap(res.result, res.resultSourceMap, stega)
            return mapResponse({...res, result})
          },
        ),
      )
    : $request.pipe(map(mapResponse))
}

/** @internal */
export function _getDocument<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  id: string,
  opts: {signal?: AbortSignal; tag?: string} = {},
): Observable<SanityDocument<R> | undefined> {
  const options = {
    uri: _getDataUrl(client, 'doc', id),
    json: true,
    tag: opts.tag,
    signal: opts.signal,
  }
  return _requestObservable<SanityDocument<R> | undefined>(client, httpRequest, options).pipe(
    filter(isResponse),
    map((event) => event.body.documents && event.body.documents[0]),
  )
}

/** @internal */
export function _getDocuments<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  ids: string[],
  opts: {signal?: AbortSignal; tag?: string} = {},
): Observable<(SanityDocument<R> | null)[]> {
  const options = {
    uri: _getDataUrl(client, 'doc', ids.join(',')),
    json: true,
    tag: opts.tag,
    signal: opts.signal,
  }
  return _requestObservable<(SanityDocument<R> | null)[]>(client, httpRequest, options).pipe(
    filter(isResponse),
    map((event: Any) => {
      const indexed = indexBy(event.body.documents || [], (doc: Any) => doc._id)
      return ids.map((id) => indexed[id] || null)
    }),
  )
}

/** @internal */
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
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  validators.requireDocumentId('createIfNotExists', doc)
  return _create<R>(client, httpRequest, doc, 'createIfNotExists', options)
}

/** @internal */
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
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  validators.requireDocumentId('createOrReplace', doc)
  return _create<R>(client, httpRequest, doc, 'createOrReplace', options)
}

/** @internal */
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
): Observable<
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

/** @internal */
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
): Observable<
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
 * @internal
 */
export function _action(
  client: Client,
  httpRequest: HttpRequest,
  actions: Action | Action[],
  options?: BaseActionOptions,
): Observable<SingleActionResult | MultipleActionResult> {
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
 * @internal
 */
export function _dataRequest(
  client: Client,
  httpRequest: HttpRequest,
  endpoint: string,
  body: Any,
  options: Any = {},
): Any {
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
    json: true,
    body: useGet ? undefined : body,
    query: isMutation && getMutationQuery(options),
    timeout,
    headers,
    token,
    tag,
    returnQuery,
    perspective: options.perspective,
    resultSourceMap: options.resultSourceMap,
    lastLiveEventId: Array.isArray(lastLiveEventId) ? lastLiveEventId[0] : lastLiveEventId,
    cacheMode: cacheMode,
    canUseCdn: isQuery,
    signal: options.signal,
    fetch: options.fetch,
    useAbortSignal: options.useAbortSignal,
    useCdn: options.useCdn,
  }

  return _requestObservable(client, httpRequest, reqOptions).pipe(
    filter(isResponse),
    map(getBody),
    map((res) => {
      if (!isMutation) {
        return res
      }

      // Should we return documents?
      const results = res.results || []
      if (options.returnDocuments) {
        return returnFirst
          ? results[0] && results[0].document
          : results.map((mut: Any) => mut.document)
      }

      // Return a reduced subset
      const key = returnFirst ? 'documentId' : 'documentIds'
      const ids = returnFirst ? results[0] && results[0].id : results.map((mut: Any) => mut.id)
      return {
        transactionId: res.transactionId,
        results: results,
        [key]: ids,
      }
    }),
  )
}

/**
 * @internal
 */
export function _create<R extends Record<string, Any>>(
  client: Client,
  httpRequest: HttpRequest,
  doc: Any,
  op: Any,
  options: Any = {},
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  const mutation = {[op]: doc}
  const opts = Object.assign({returnFirst: true, returnDocuments: true}, options)
  return _dataRequest(client, httpRequest, 'mutate', {mutations: [mutation]}, opts)
}

const hasDataConfig = (client: Client) =>
  (client.config().dataset !== undefined && client.config().projectId !== undefined) ||
  client.config()['~experimental_resource'] !== undefined

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
 * @internal
 */
export function _requestObservable<R>(
  client: Client,
  httpRequest: HttpRequest,
  options: RequestObservableOptions,
): Observable<HttpRequestEvent<R>> {
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

  const reqOptions = requestOptions(
    config,
    Object.assign({}, options, {
      url: _getUrl(client, uri, useCdn),
    }),
  ) as RequestOptions

  const request = new Observable<HttpRequestEvent<R>>((subscriber) =>
    httpRequest(reqOptions, config.requester!).subscribe(subscriber),
  )

  return options.signal ? request.pipe(_withAbortSignal(options.signal)) : request
}

/**
 * @internal
 */
export function _request<R>(client: Client, httpRequest: HttpRequest, options: Any): Observable<R> {
  const observable = _requestObservable<R>(client, httpRequest, options).pipe(
    filter((event: Any) => event.type === 'response'),
    map((event: Any) => event.body),
  )

  return observable
}

/**
 * @internal
 */
export function _getDataUrl(client: Client, operation: string, path?: string): string {
  const config = client.config()
  if (config['~experimental_resource']) {
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
// DOMException is supported on most modern browsers and Node.js 18+.
// @see https://developer.mozilla.org/en-US/docs/Web/API/DOMException#browser_compatibility
const isDomExceptionSupported = Boolean(globalThis.DOMException)

/**
 * @internal
 * @param signal
 * Original source copied from https://github.com/sindresorhus/ky/blob/740732c78aad97e9aec199e9871bdbf0ae29b805/source/errors/DOMException.ts
 * TODO: When targeting Node.js 18, use `signal.throwIfAborted()` (https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted)
 */
function _createAbortError(signal?: AbortSignal) {
  /*
  NOTE: Use DomException with AbortError name as specified in MDN docs (https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort)
  > When abort() is called, the fetch() promise rejects with an Error of type DOMException, with name AbortError.
  */
  if (isDomExceptionSupported) {
    return new DOMException(signal?.reason ?? 'The operation was aborted.', 'AbortError')
  }

  // DOMException not supported. Fall back to use of error and override name.
  const error = new Error(signal?.reason ?? 'The operation was aborted.')
  error.name = 'AbortError'

  return error
}

const resourceDataBase = (config: InitializedClientConfig): string => {
  if (!config['~experimental_resource']) {
    throw new Error('`resource` must be provided to perform resource queries')
  }
  const {type, id} = config['~experimental_resource']

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
