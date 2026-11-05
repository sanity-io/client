import {type FetchFunction} from 'get-it'
import {defer, lastValueFrom, type Observable} from 'rxjs'

import {_request, _requestObservable} from '../data/dataMethods'
import type {ListenEventFromOptions} from '../data/listen'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, QueryParams, SanityDocument} from '../types'
import {_fetch as _fetchStore, _listen as _listenStore} from './store'
import type {
  ContextListenOptions,
  ContextRequestOptions,
  CreateFileSourceParams,
  FileUpload,
  RequestArgs,
  Response,
  ResponseFormat,
  Route,
  Source,
  SyncAccepted,
  UploadFileParams,
} from './types'

type Client = SanityClient | ObservableSanityClient

type ContextRequest = {
  params?: Record<string, unknown>
  query?: Record<string, unknown>
  headers?: Record<string, unknown>
  body?: unknown
  signal?: AbortSignal
  tag?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isContextRequest(value: unknown): value is ContextRequest {
  return isRecord(value)
}

function _stringValues(entries: Record<string, unknown> | undefined): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(entries ?? {})) {
    if (value !== undefined && value !== null) values[key] = String(value)
  }
  return values
}

function _pathParam(client: Client, name: string, params: Record<string, unknown>): string {
  const value = params[name]
  if (typeof value === 'string' && value !== '') return value
  if (value !== undefined) {
    throw new Error(`\`params.${name}\` must be a non-empty string`)
  }

  const config = client.config()
  if (name === 'knowledgeBaseId' && config.resource?.type === 'knowledge-base') {
    return config.resource.id
  }
  if (name === 'organizationId' && config.context?.organizationId) {
    return config.context.organizationId
  }

  if (name === 'knowledgeBaseId') {
    throw new Error(
      '`params.knowledgeBaseId` is required unless a `knowledge-base` resource is configured',
    )
  }
  if (name === 'organizationId') {
    throw new Error(
      '`params.organizationId` is required unless `context.organizationId` is configured',
    )
  }
  throw new Error(`\`params.${name}\` is required`)
}

/**
 * The request options for a `METHOD /path` route: path parameters filled in
 * and encoded, query and headers stringified, `undefined` values left out.
 */
function _contextRequestOptions(client: Client, route: string, init: unknown) {
  const request = isContextRequest(init) ? init : {}
  const separator = route.indexOf(' ')
  const method = route.slice(0, separator)
  const params = request.params ?? {}
  const path = route
    .slice(separator + 1)
    .replace(/\{([^}]+)\}/g, (_match, name: string) =>
      encodeURIComponent(_pathParam(client, name, params)),
    )

  return {
    url: `/context${path}`,
    method,
    query: _stringValues(request.query),
    headers: _stringValues(request.headers),
    ...(request.body !== undefined && {body: request.body}),
    signal: request.signal,
    tag: request.tag,
  }
}

function _fetchBody(file: FileUpload['file']) {
  if (!ArrayBuffer.isView(file)) return file
  return file.buffer instanceof ArrayBuffer
    ? new Uint8Array(file.buffer, file.byteOffset, file.byteLength)
    : Uint8Array.from(file)
}

/**
 * `client.context`: the Context API, typed from its OpenAPI spec.
 *
 * {@link ContextClient.request} calls any operation by its `METHOD /path`,
 * with path parameters, query, headers and body typed from the spec.
 * `knowledgeBaseId` defaults to the client's `knowledge-base` resource and
 * `organizationId` to `context.organizationId`. GROQ reads of the
 * organization's Context documents go through {@link ContextClient.fetch}
 * and {@link ContextClient.listen}.
 *
 * @example
 * ```ts
 * const kb = await client.context.request('POST /knowledge-bases', {
 *   body: {organizationId: 'org123', title: 'Support docs', description: 'Product docs'},
 * })
 * const source = await client.context.request('POST /knowledge-bases/{knowledgeBaseId}/sources', {
 *   params: {knowledgeBaseId: kb.publicId},
 *   body: {type: 'web', url: 'https://example.com/docs'},
 * })
 * ```
 *
 * @beta
 */
export class ContextClient {
  #client: SanityClient
  #httpRequest: HttpRequest

  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Call a Context API operation. Resolves with the success response body,
   * or `undefined` for `204 No Content`; rejects with the API's error.
   */
  async request<R extends Route, const F extends ResponseFormat<R> = never>(
    route: R,
    ...[init]: RequestArgs<R, F>
  ): Promise<Response<R, F>> {
    return _request<Response<R, F>>(
      this.#client,
      this.#httpRequest,
      _contextRequestOptions(this.#client, route, init),
    )
  }

  /**
   * {@link ContextClient.request}, resolving with the response bytes instead
   * of parsed JSON: for a document's content with `format: 'raw'`, the bytes
   * its source gave.
   */
  async requestBytes<R extends Route>(
    route: R,
    ...[init]: RequestArgs<R, unknown>
  ): Promise<Uint8Array> {
    return _request<Uint8Array>(this.#client, this.#httpRequest, {
      ..._contextRequestOptions(this.#client, route, init),
      rawBody: true,
    })
  }

  /**
   * Upload a file to a `files` source and sync it, replacing the file it
   * holds: stages an upload, PUTs the bytes to the signed storage URL, and
   * starts the sync with it. The bytes never pass through the Context API.
   */
  async uploadFile(
    params: UploadFileParams,
    options?: {signal?: AbortSignal; tag?: string},
  ): Promise<SyncAccepted> {
    const {knowledgeBaseId, sourceId, file, filename, contentType} = params
    const target = {params: {knowledgeBaseId, sourceId}, ...options}
    const staged = await this.request(
      'POST /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}/uploads',
      {...target, body: {filename, ...(contentType && {contentType})}},
    )

    // The signed URL PUT goes straight to storage, outside the API pipeline:
    // no auth header, and the body is raw bytes rather than JSON. It still
    // uses the client's fetch resolution so proxy config applies in Node.
    const config = this.#client.config()
    const doFetch: FetchFunction = config.resolveFetch?.(config.proxy) ?? globalThis.fetch
    const putResponse = await doFetch(staged.uploadUrl, {
      method: 'PUT',
      body: _fetchBody(file),
      ...(contentType && {headers: {'content-type': contentType}}),
      signal: options?.signal,
    })
    if (!putResponse.ok) {
      throw new Error(`File upload failed: ${putResponse.status} ${putResponse.statusText}`)
    }

    return this.request('POST /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}/syncs', {
      ...target,
      body: {uploadId: staged.uploadId},
    })
  }

  /**
   * Add a `files` source holding a file: adds the source, uploads the file
   * with {@link ContextClient.uploadFile}, and resolves with the source read
   * again, so its `latestSync` is that sync.
   */
  async createFileSource(
    params: CreateFileSourceParams,
    options?: {signal?: AbortSignal; tag?: string},
  ): Promise<Source> {
    const {knowledgeBaseId, file, filename, contentType, ...body} = params
    const created = await this.request('POST /knowledge-bases/{knowledgeBaseId}/sources', {
      params: {knowledgeBaseId},
      body,
      ...options,
    })
    if (!('id' in created)) {
      throw new Error('The Context API answered a source create with a crawl preview')
    }
    const target = {knowledgeBaseId, sourceId: created.id}
    await this.uploadFile({...target, file, filename, contentType}, options)
    return this.request('GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}', {
      params: target,
      ...options,
    })
  }

  /**
   * GROQ over the organization's Context documents. The store holds every
   * Context document family and the caller's access decides what a query
   * returns, so filter on `_type`.
   *
   * Requires `context.organizationId` in the client configuration.
   */
  fetch<R = unknown>(
    query: string,
    params?: QueryParams,
    options?: ContextRequestOptions,
  ): Promise<R> {
    return lastValueFrom(_fetchStore<R>(this.#client, this.#httpRequest, query, params, options))
  }

  /**
   * Listen for changes to the organization's Context documents. Mirrors
   * `client.listen(query, params, options)` and emits mutation events by
   * default.
   */
  listen<Opts extends ContextListenOptions | undefined = undefined>(
    query: string,
    params?: QueryParams,
    options?: Opts,
  ): Observable<ListenEventFromOptions<SanityDocument, Opts>> {
    return _listenStore(this.#client, query, params, options)
  }
}

/**
 * Observable counterpart of {@link ContextClient}.
 *
 * @beta
 */
export class ObservableContextClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest

  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /** Call a Context API operation. See {@link ContextClient.request}. */
  request<R extends Route, const F extends ResponseFormat<R> = never>(
    route: R,
    ...[init]: RequestArgs<R, F>
  ): Observable<Response<R, F>> {
    return defer(() =>
      _requestObservable<Response<R, F>>(
        this.#client,
        this.#httpRequest,
        _contextRequestOptions(this.#client, route, init),
      ),
    )
  }

  /** GROQ over the organization's Context documents. See {@link ContextClient.fetch}. */
  fetch<R = unknown>(
    query: string,
    params?: QueryParams,
    options?: ContextRequestOptions,
  ): Observable<R> {
    return _fetchStore<R>(this.#client, this.#httpRequest, query, params, options)
  }

  /** Listen for changes to the organization's Context documents. See {@link ContextClient.listen}. */
  listen<Opts extends ContextListenOptions | undefined = undefined>(
    query: string,
    params?: QueryParams,
    options?: Opts,
  ): Observable<ListenEventFromOptions<SanityDocument, Opts>> {
    return _listenStore(this.#client, query, params, options)
  }
}
