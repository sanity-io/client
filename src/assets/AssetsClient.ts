import {defer, lastValueFrom, type Observable} from 'rxjs'
import {filter, map, mergeAll} from 'rxjs/operators'

import {_prepareRequest, _uploadObservable} from '../data/dataMethods'
import type {FetchRequest} from '../http/requestOptions'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  Any,
  HttpRequest,
  InitializedClientConfig,
  SanityAssetDocument,
  SanityImageAssetDocument,
  UploadBody,
  UploadClientConfig,
  UploadEvent,
  UploadResponseEvent,
} from '../types'
import * as validators from '../validators'

/** @internal */
export class ObservableAssetsClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Uploads a file asset to the configured dataset
   *
   * @param assetType - Asset type (file)
   * @param body - Asset content - can be a browser File instance, a Blob, a Node.js Buffer instance or a Node.js ReadableStream.
   * @param options - Options to use for the upload
   */
  upload(
    assetType: 'file',
    body: UploadBody,
    options?: UploadClientConfig,
  ): Observable<UploadEvent<{document: SanityAssetDocument}>>

  /**
   * Uploads an image asset to the configured dataset
   *
   * @param assetType - Asset type (image)
   * @param body - Asset content - can be a browser File instance, a Blob, a Node.js Buffer instance or a Node.js ReadableStream.
   * @param options - Options to use for the upload
   */
  upload(
    assetType: 'image',
    body: UploadBody,
    options?: UploadClientConfig,
  ): Observable<UploadEvent<{document: SanityImageAssetDocument}>>
  /**
   * Uploads a file or an image asset to the configured dataset
   *
   * @param assetType - Asset type (file/image)
   * @param body - Asset content - can be a browser File instance, a Blob, a Node.js Buffer instance or a Node.js ReadableStream.
   * @param options - Options to use for the upload
   */
  upload(
    assetType: 'file' | 'image',
    body: UploadBody,
    options?: UploadClientConfig,
  ): Observable<UploadEvent<{document: SanityAssetDocument | SanityImageAssetDocument}>>
  upload(
    assetType: 'file' | 'image',
    body: UploadBody,
    options?: UploadClientConfig,
  ): Observable<UploadEvent<{document: SanityAssetDocument | SanityImageAssetDocument}>> {
    return _upload(this.#client, this.#httpRequest, assetType, body, options)
  }
}

/** @internal */
export class AssetsClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Uploads a file asset to the configured dataset
   *
   * @param assetType - Asset type (file)
   * @param body - Asset content - can be a browser File instance, a Blob, a Node.js Buffer instance or a Node.js ReadableStream.
   * @param options - Options to use for the upload
   */
  upload(
    assetType: 'file',
    body: UploadBody,
    options?: UploadClientConfig,
  ): Promise<SanityAssetDocument>
  /**
   * Uploads an image asset to the configured dataset
   *
   * @param assetType - Asset type (image)
   * @param body - Asset content - can be a browser File instance, a Blob, a Node.js Buffer instance or a Node.js ReadableStream.
   * @param options - Options to use for the upload
   */
  upload(
    assetType: 'image',
    body: UploadBody,
    options?: UploadClientConfig,
  ): Promise<SanityImageAssetDocument>
  /**
   * Uploads a file or an image asset to the configured dataset
   *
   * @param assetType - Asset type (file/image)
   * @param body - Asset content - can be a browser File instance, a Blob, a Node.js Buffer instance or a Node.js ReadableStream.
   * @param options - Options to use for the upload
   */
  upload(
    assetType: 'file' | 'image',
    body: UploadBody,
    options?: UploadClientConfig,
  ): Promise<SanityAssetDocument | SanityImageAssetDocument>
  upload(
    assetType: 'file' | 'image',
    body: UploadBody,
    options?: UploadClientConfig,
  ): Promise<SanityAssetDocument | SanityImageAssetDocument> {
    type Doc = {document: SanityAssetDocument | SanityImageAssetDocument}
    const observable = _upload<Doc>(this.#client, this.#httpRequest, assetType, body, options)
    return lastValueFrom(
      observable.pipe(
        filter((event): event is UploadResponseEvent<Doc> => event.type === 'response'),
        map((event) => event.body.document),
      ),
    )
  }
}

function _upload<T = {document: SanityAssetDocument | SanityImageAssetDocument}>(
  client: SanityClient | ObservableSanityClient,
  _httpRequest: HttpRequest,
  assetType: 'image' | 'file',
  body: UploadBody,
  opts: UploadClientConfig = {},
): Observable<UploadEvent<T>> {
  validators.validateAssetType(assetType)

  // If an empty array is given, explicitly set `none` to override API defaults
  let meta = opts.extract || undefined
  if (meta && !meta.length) {
    meta = ['none']
  }

  const config = client.config()
  const options = optionsFromFile(opts, body)
  const {tag, label, title, description, creditLine, filename, source} = options
  const resource = config.resource
  const isMediaLibrary = resource?.type === 'media-library'

  // Media Library has a simpler upload API with fewer supported parameters
  const query: Any = isMediaLibrary
    ? {
        // Media Library only supports basic parameters
        title,
        filename,
      }
    : {
        // Content Lake supports full set of parameters
        label,
        title,
        description,
        filename,
        meta,
        creditLine,
      }

  // Source parameters are only for Content Lake
  if (source && !isMediaLibrary) {
    query.sourceId = source.id
    query.sourceName = source.name
    query.sourceUrl = source.url
  }

  const headers: Record<string, string> = options.contentType
    ? {'Content-Type': options.contentType}
    : {}
  const baseRequest = {
    tag,
    method: 'POST',
    // Uploads have NO timeout unless the caller opts in — uploads can
    // legitimately be slow. `0` translates to "disabled" at the request
    // boundary, which also shields uploads from get-it's default timeout.
    timeout: options.timeout || 0,
    uri: buildAssetUploadUrl(config, assetType),
    headers,
    query,
    body,
  }

  // In browsers, run uploads through `XMLHttpRequest` so we can surface
  // per-chunk upload progress events — fetch (and therefore get-it v9) has no
  // equivalent hook. Outside the browser (Node, edge runtimes), we fall back
  // to the regular fetch-based path which only emits the terminal `response`
  // event.
  if (typeof XMLHttpRequest !== 'undefined') {
    return defer(async () => {
      const {uploadWithProgress} = await import('../http/browserUpload')
      // Build the request the same way the fetch path does, so the request
      // tag (incl. `requestTagPrefix` and validation), auth/custom headers,
      // credentials and timeout are identical across both upload transports.
      // The XHR API needs the query baked into the URL, though.
      const req = _prepareRequest(client, {...baseRequest})
      return uploadWithProgress<T>({
        url: appendQuery(req.url, req.query),
        method: req.method ?? 'POST',
        headers: req.headers,
        body,
        withCredentials: req.credentials === 'include',
        // XHR only has a single total-deadline timer, so a structured
        // get-it timeout collapses to its `total` component here.
        timeout: typeof req.timeout === 'object' ? req.timeout.total : req.timeout,
        signal: req.signal,
      })
    }).pipe(mergeAll())
  }

  return _uploadObservable<T>(client, baseRequest)
}

function appendQuery(url: string, query: FetchRequest['query']): string {
  if (!query) return url
  const params =
    query instanceof URLSearchParams
      ? query
      : new URLSearchParams(
          Object.entries(query).flatMap(([key, value]) =>
            value === undefined || value === null ? [] : [[key, `${value}`]],
          ),
        )
  const qs = params.toString()
  if (!qs) return url
  return url + (url.includes('?') ? '&' : '?') + qs
}

function buildAssetUploadUrl(config: InitializedClientConfig, assetType: 'image' | 'file'): string {
  const assetTypeEndpoint = assetType === 'image' ? 'images' : 'files'
  const resource = config.resource

  if (resource) {
    const {type, id} = resource
    switch (type) {
      case 'dataset': {
        throw new Error(
          'Assets are not supported for dataset resources, yet. Configure the client with `{projectId: <projectId>, dataset: <datasetId>}` instead.',
        )
      }
      case 'canvas': {
        return `/canvases/${id}/assets/${assetTypeEndpoint}`
      }
      case 'media-library': {
        return `/media-libraries/${id}/upload`
      }
      case 'dashboard': {
        return `/dashboards/${id}/assets/${assetTypeEndpoint}`
      }
      default:
        // @ts-expect-error - handle all supported resource types
        throw new Error(`Unsupported resource type: ${type.toString()}`)
    }
  }

  const dataset = validators.hasDataset(config)
  return `assets/${assetTypeEndpoint}/${dataset}`
}

function optionsFromFile(opts: Record<string, Any>, file: Any) {
  if (typeof File === 'undefined' || !(file instanceof File)) {
    return opts
  }

  return Object.assign(
    {
      filename: opts.preserveFilename === false ? undefined : file.name,
      contentType: file.type,
    },
    opts,
  )
}
