import {lastValueFrom, type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  HttpRequest,
  MediaLibraryAssetInstanceIdentifier,
  MediaLibraryPlaybackInfoOptions,
  SanityReference,
  VideoPlaybackInfo,
} from '../types'

/** @internal */
export class ObservableMediaLibraryVideoClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Get video playback information for a media library asset
   *
   * @param assetIdentifier - Asset instance identifier (GDR, video-prefixed ID, or container ID)
   * @param options - Options for transformations and expiration
   */
  getPlaybackInfo(
    assetIdentifier: MediaLibraryAssetInstanceIdentifier,
    options: MediaLibraryPlaybackInfoOptions = {},
  ): Observable<VideoPlaybackInfo> {
    const config = this.#client.config()
    const resource = config.resource || config['~experimental_resource']
    const configMediaLibraryId = resource?.id

    const {instanceId, libraryId} = parseAssetInstanceId(assetIdentifier)
    const effectiveLibraryId = libraryId || configMediaLibraryId

    if (!effectiveLibraryId) {
      throw new Error(
        'Could not determine Media Library ID - you need to provide a valid Media Library ID in the client config or a Media Library GDR',
      )
    }

    const uri = buildVideoPlaybackInfoUrl(instanceId, effectiveLibraryId)
    const queryParams = buildQueryParams(options)

    return _request<VideoPlaybackInfo>(this.#client, this.#httpRequest, {
      method: 'GET',
      uri,
      query: queryParams,
    })
  }
}

/** @internal */
export class MediaLibraryVideoClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Get video playback information for a media library asset
   *
   * @param assetIdentifier - Asset instance identifier (GDR, video-prefixed ID, or container ID)
   * @param options - Options for transformations and expiration
   */
  getPlaybackInfo(
    assetIdentifier: MediaLibraryAssetInstanceIdentifier,
    options: MediaLibraryPlaybackInfoOptions = {},
  ): Promise<VideoPlaybackInfo> {
    return lastValueFrom(
      new ObservableMediaLibraryVideoClient(
        this.#client.observable,
        this.#httpRequest,
      ).getPlaybackInfo(assetIdentifier, options),
    )
  }
}

const ML_GDR_PATTERN = /^media-library:(ml[^:]+):([^:]+)$/

/** @internal */
function isSanityReference(
  assetIdentifier: MediaLibraryAssetInstanceIdentifier,
): assetIdentifier is SanityReference {
  return typeof assetIdentifier === 'object' && '_ref' in assetIdentifier
}

/**
 * Parse the asset instance id and library id from the asset identifier
 *
 * @param assetIdentifier - The asset identifier - either a asset instance id or a Media Library GDR
 * @returns The asset instance id and library id
 */
export function parseAssetInstanceId(assetIdentifier: MediaLibraryAssetInstanceIdentifier): {
  instanceId: string
  libraryId?: string
} {
  const ref = isSanityReference(assetIdentifier) ? assetIdentifier._ref : assetIdentifier

  const match = ML_GDR_PATTERN.exec(ref)
  if (match) {
    const [, libraryId, instanceId] = match
    return {libraryId, instanceId}
  }

  // Asumes valid asset instance id
  if (typeof assetIdentifier === 'string' && assetIdentifier.startsWith('video-')) {
    return {instanceId: assetIdentifier}
  }

  throw new Error(
    `Invalid video asset instance identifier "${ref}": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library`,
  )
}

function buildVideoPlaybackInfoUrl(instanceId: string, libraryId: string): string {
  return `/media-libraries/${libraryId}/video/${instanceId}/playback-info`
}

function buildQueryParams(options: MediaLibraryPlaybackInfoOptions): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  if (options.transformations) {
    const {thumbnail, animated, storyboard} = options.transformations

    if (thumbnail) {
      if (thumbnail.width) params.thumbnailWidth = thumbnail.width
      if (thumbnail.height) params.thumbnailHeight = thumbnail.height
      if (thumbnail.time !== undefined) params.thumbnailTime = thumbnail.time
      if (thumbnail.fit) params.thumbnailFit = thumbnail.fit
      if (thumbnail.format) params.thumbnailFormat = thumbnail.format
    }

    if (animated) {
      if (animated.width) params.animatedWidth = animated.width
      if (animated.height) params.animatedHeight = animated.height
      if (animated.start !== undefined) params.animatedStart = animated.start
      if (animated.end !== undefined) params.animatedEnd = animated.end
      if (animated.fps) params.animatedFps = animated.fps
      if (animated.format) params.animatedFormat = animated.format
    }

    if (storyboard) {
      if (storyboard.format) params.storyboardFormat = storyboard.format
    }
  }

  if (options.expiration) {
    params.expiration = options.expiration
  }

  return params
}
