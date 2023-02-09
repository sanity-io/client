import {lastValueFrom, type Observable} from 'rxjs'
import {filter, map} from 'rxjs/operators'

import {_requestObservable} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  Any,
  HttpRequest,
  HttpRequestEvent,
  ResponseEvent,
  SanityAssetDocument,
  SanityImageAssetDocument,
  UploadClientConfig,
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
    body: File | Blob | Buffer | NodeJS.ReadableStream,
    options?: UploadClientConfig
  ): Observable<HttpRequestEvent<{document: SanityAssetDocument}>>

  /**
   * Uploads an image asset to the configured dataset
   *
   * @param assetType - Asset type (image)
   * @param body - Asset content - can be a browser File instance, a Blob, a Node.js Buffer instance or a Node.js ReadableStream.
   * @param options - Options to use for the upload
   */
  upload(
    assetType: 'image',
    body: File | Blob | Buffer | NodeJS.ReadableStream,
    options?: UploadClientConfig
  ): Observable<HttpRequestEvent<{document: SanityImageAssetDocument}>>
  /**
   * Uploads a file or an image asset to the configured dataset
   *
   * @param assetType - Asset type (file/image)
   * @param body - Asset content - can be a browser File instance, a Blob, a Node.js Buffer instance or a Node.js ReadableStream.
   * @param options - Options to use for the upload
   */
  upload(
    assetType: 'file' | 'image',
    body: File | Blob | Buffer | NodeJS.ReadableStream,
    options?: UploadClientConfig
  ): Observable<HttpRequestEvent<{document: SanityAssetDocument | SanityImageAssetDocument}>>
  upload(
    assetType: 'file' | 'image',
    body: File | Blob | Buffer | NodeJS.ReadableStream,
    options?: UploadClientConfig
  ): Observable<HttpRequestEvent<{document: SanityAssetDocument | SanityImageAssetDocument}>> {
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
    body: File | Blob | Buffer | NodeJS.ReadableStream,
    options?: UploadClientConfig
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
    body: File | Blob | Buffer | NodeJS.ReadableStream,
    options?: UploadClientConfig
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
    body: File | Blob | Buffer | NodeJS.ReadableStream,
    options?: UploadClientConfig
  ): Promise<SanityAssetDocument | SanityImageAssetDocument>
  upload(
    assetType: 'file' | 'image',
    body: File | Blob | Buffer | NodeJS.ReadableStream,
    options?: UploadClientConfig
  ): Promise<SanityAssetDocument | SanityImageAssetDocument> {
    const observable = _upload(this.#client, this.#httpRequest, assetType, body, options)
    return lastValueFrom(
      observable.pipe(
        filter((event: Any) => event.type === 'response'),
        map(
          (event) =>
            (event as ResponseEvent<{document: SanityAssetDocument | SanityImageAssetDocument}>)
              .body.document
        )
      )
    )
  }
}

function _upload(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  assetType: 'image' | 'file',
  body: File | Blob | Buffer | NodeJS.ReadableStream,
  opts: UploadClientConfig = {}
): Observable<HttpRequestEvent<{document: SanityAssetDocument | SanityImageAssetDocument}>> {
  validators.validateAssetType(assetType)

  // If an empty array is given, explicitly set `none` to override API defaults
  let meta = opts.extract || undefined
  if (meta && !meta.length) {
    meta = ['none']
  }

  const dataset = validators.hasDataset(client.config())
  const assetEndpoint = assetType === 'image' ? 'images' : 'files'
  const options = optionsFromFile(opts, body)
  const {tag, label, title, description, creditLine, filename, source} = options
  const query: Any = {
    label,
    title,
    description,
    filename,
    meta,
    creditLine,
  }
  if (source) {
    query.sourceId = source.id
    query.sourceName = source.name
    query.sourceUrl = source.url
  }
  return _requestObservable(client, httpRequest, {
    tag,
    method: 'POST',
    timeout: options.timeout || 0,
    uri: `/assets/${assetEndpoint}/${dataset}`,
    headers: options.contentType ? {'Content-Type': options.contentType} : {},
    query,
    body,
  })
}

function optionsFromFile(opts: Record<string, Any>, file: Any) {
  if (typeof window === 'undefined' || !(file instanceof window.File)) {
    return opts
  }

  return Object.assign(
    {
      filename: opts.preserveFilename === false ? undefined : file.name,
      contentType: file.type,
    },
    opts
  )
}
