import {Observable} from 'rxjs'
import {filter, map} from 'rxjs/operators'

import getRequestOptions from '../http/requestOptions'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  AllDocumentIdsMutationOptions,
  AllDocumentsMutationOptions,
  BaseMutationOptions,
  FilteredResponseQueryOptions,
  FirstDocumentIdMutationOptions,
  FirstDocumentMutationOptions,
  FIXME,
  HttpRequest,
  HttpRequestEvent,
  IdentifiedSanityDocumentStub,
  MultipleMutationResult,
  Mutation,
  MutationSelection,
  QueryParams,
  RawQueryResponse,
  RequestObservableOptions,
  RequestOptions,
  SanityDocument,
  SingleMutationResult,
  UnfilteredResponseQueryOptions,
} from '../types'
import getSelection from '../util/getSelection'
import * as validate from '../validators'
import * as validators from '../validators'
import encodeQueryString from './encodeQueryString'
import {ObservablePatch, Patch} from './patch'
import {ObservableTransaction, Transaction} from './transaction'

const excludeFalsey = (param: FIXME, defValue: FIXME) => {
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

const isResponse = (event: FIXME) => event.type === 'response'
const getBody = (event: FIXME) => event.body

const indexBy = (docs: FIXME[], attr: FIXME) =>
  docs.reduce((indexed, doc) => {
    indexed[attr(doc)] = doc
    return indexed
  }, Object.create(null))

const getQuerySizeLimit = 11264

/** @internal */
export function _fetch<R, Q extends QueryParams>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  query: string,
  params?: Q,
  options: FilteredResponseQueryOptions | UnfilteredResponseQueryOptions = {}
): Observable<RawQueryResponse<R> | R> {
  const mapResponse =
    options.filterResponse === false ? (res: FIXME) => res : (res: FIXME) => res.result

  return _dataRequest(client, httpRequest, 'query', {query, params}, options).pipe(map(mapResponse))
}

/** @internal */
export function _getDocument<R extends Record<string, FIXME>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  id: string,
  opts: {tag?: string} = {}
): Observable<SanityDocument<R> | undefined> {
  const options = {uri: _getDataUrl(client, 'doc', id), json: true, tag: opts.tag}
  return _requestObservable<SanityDocument<R> | undefined>(client, httpRequest, options).pipe(
    filter(isResponse),
    map((event) => event.body.documents && event.body.documents[0])
  )
}

/** @internal */
export function _getDocuments<R extends Record<string, FIXME>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  ids: string[],
  opts: {tag?: string} = {}
): Observable<(SanityDocument<R> | null)[]> {
  const options = {uri: _getDataUrl(client, 'doc', ids.join(',')), json: true, tag: opts.tag}
  return _requestObservable<(SanityDocument<R> | null)[]>(client, httpRequest, options).pipe(
    filter(isResponse),
    map((event: FIXME) => {
      const indexed = indexBy(event.body.documents || [], (doc: FIXME) => doc._id)
      return ids.map((id) => indexed[id] || null)
    })
  )
}

/** @internal */
export function _createIfNotExists<R extends Record<string, FIXME>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  validators.requireDocumentId('createIfNotExists', doc)
  return _create<R>(client, httpRequest, doc, 'createIfNotExists', options)
}

/** @internal */
export function _createOrReplace<R extends Record<string, FIXME>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  doc: IdentifiedSanityDocumentStub<R>,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  validators.requireDocumentId('createOrReplace', doc)
  return _create<R>(client, httpRequest, doc, 'createOrReplace', options)
}

/** @internal */
export function _delete<R extends Record<string, FIXME>>(
  client: ObservableSanityClient | SanityClient,
  httpRequest: HttpRequest,
  selection: string | MutationSelection,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  return _dataRequest(
    client,
    httpRequest,
    'mutate',
    {mutations: [{delete: getSelection(selection)}]},
    options
  )
}

/** @internal */
export function _mutate<R extends Record<string, FIXME>>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  mutations: Mutation<R>[] | Patch | ObservablePatch | Transaction | ObservableTransaction,
  options?:
    | AllDocumentIdsMutationOptions
    | AllDocumentsMutationOptions
    | BaseMutationOptions
    | FirstDocumentIdMutationOptions
    | FirstDocumentMutationOptions
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  const mut =
    mutations instanceof Patch ||
    mutations instanceof ObservablePatch ||
    mutations instanceof Transaction ||
    mutations instanceof ObservableTransaction
      ? mutations.serialize()
      : mutations

  const muts = Array.isArray(mut) ? mut : [mut]
  const transactionId = options && (options as FIXME).transactionId
  return _dataRequest(client, httpRequest, 'mutate', {mutations: muts, transactionId}, options)
}

/**
 * @internal
 */
export function _dataRequest(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  endpoint: string,
  body: FIXME,
  options: FIXME = {}
): FIXME {
  const isMutation = endpoint === 'mutate'
  const isQuery = endpoint === 'query'

  // Check if the query string is within a configured threshold,
  // in which case we can use GET. Otherwise, use POST.
  const strQuery = isMutation ? '' : encodeQueryString(body)
  const useGet = !isMutation && strQuery.length < getQuerySizeLimit
  const stringQuery = useGet ? strQuery : ''
  const returnFirst = options.returnFirst
  const {timeout, token, tag, headers} = options

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
    canUseCdn: isQuery,
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
          : results.map((mut: FIXME) => mut.document)
      }

      // Return a reduced subset
      const key = returnFirst ? 'documentId' : 'documentIds'
      const ids = returnFirst ? results[0] && results[0].id : results.map((mut: FIXME) => mut.id)
      return {
        transactionId: res.transactionId,
        results: results,
        [key]: ids,
      }
    })
  )
}

/**
 * @internal
 */
export function _create<R extends Record<string, FIXME>>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  doc: FIXME,
  op: FIXME,
  options: FIXME = {}
): Observable<
  SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
> {
  const mutation = {[op]: doc}
  const opts = Object.assign({returnFirst: true, returnDocuments: true}, options)
  return _dataRequest(client, httpRequest, 'mutate', {mutations: [mutation]}, opts)
}

/**
 * @internal
 */
export function _requestObservable<R>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  options: RequestObservableOptions
): Observable<HttpRequestEvent<R>> {
  const uri = options.url || (options.uri as string)
  const config = client.config()

  // If the `canUseCdn`-option is not set we detect it automatically based on the method + URL.
  // Only the /data endpoint is currently available through API-CDN.
  const canUseCdn =
    typeof options.canUseCdn === 'undefined'
      ? ['GET', 'HEAD'].indexOf(options.method || 'GET') >= 0 && uri.indexOf('/data/') === 0
      : options.canUseCdn

  const useCdn = config.useCdn && canUseCdn

  const tag =
    options.tag && config.requestTagPrefix
      ? [config.requestTagPrefix, options.tag].join('.')
      : options.tag || config.requestTagPrefix

  if (tag) {
    options.query = {tag: validate.requestTag(tag), ...options.query}
  }

  const reqOptions = getRequestOptions(
    config,
    Object.assign({}, options, {
      url: _getUrl(client, uri, useCdn),
    })
  ) as RequestOptions

  return new Observable<HttpRequestEvent<R>>((subscriber) =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- the typings thinks it's optional because it's not required to specify it when calling createClient, but it's always defined in practice since SanityClient provides a default
    httpRequest(reqOptions, config.requester!).subscribe(subscriber)
  )
}

/**
 * @internal
 */
export function _request<R>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  options: FIXME
): Observable<R> {
  const observable = _requestObservable<R>(client, httpRequest, options).pipe(
    filter((event: FIXME) => event.type === 'response'),
    map((event: FIXME) => event.body)
  )

  return observable
}

/**
 * @internal
 */
export function _getDataUrl(
  client: SanityClient | ObservableSanityClient,
  operation: string,
  path?: string
): string {
  const config = client.config()
  const catalog = validators.hasDataset(config)
  const baseUri = `/${operation}/${catalog}`
  const uri = path ? `${baseUri}/${path}` : baseUri
  return `/data${uri}`.replace(/\/($|\?)/, '$1')
}

/**
 * @internal
 */
export function _getUrl(
  client: SanityClient | ObservableSanityClient,
  uri: string,
  canUseCdn = false
): string {
  const {url, cdnUrl} = client.config()
  const base = canUseCdn ? cdnUrl : url
  return `${base}/${uri.replace(/^\//, '')}`
}
