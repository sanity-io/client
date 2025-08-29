import {lastValueFrom, type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  HttpRequest,
  MediaLibraryAssetInstanceIdentifier,
  MediaLibraryPlaybackInfoOptions,
  VideoPlaybackInfo,
  VideoPlaybackInfoItem,
  VideoPlaybackInfoItemSigned,
  VideoPlaybackInfoSigned,
  VideoPlaybackTokens,
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
    const {instanceId, libraryId} = parseAssetInstanceId(assetIdentifier)
    const uri = buildVideoPlaybackInfoUrl(instanceId, libraryId)
    const queryParams = buildQueryParams(options)

    return _request<VideoPlaybackInfo>(this.#client, this.#httpRequest, {
      method: 'GET',
      uri,
      query: queryParams,
    })
  }

  /**
   * Extract playback tokens from signed video playback info
   *
   * @param playbackInfo - The playback info response
   * @returns Object containing playback, thumbnail, and storyboard tokens if signed, undefined otherwise
   */
  getPlaybackTokens(playbackInfo: VideoPlaybackInfo): VideoPlaybackTokens | undefined {
    if (isSignedPlaybackInfo(playbackInfo)) {
      return {
        playback: playbackInfo.stream.token,
        thumbnail: playbackInfo.thumbnail.token,
        storyboard: playbackInfo.storyboard.token,
        animated: playbackInfo.animated.token,
      }
    }

    return undefined
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

  /**
   * Extract playback tokens from signed video playback info
   *
   * @param playbackInfo - The playback info response
   * @returns Object containing playback, thumbnail, and storyboard tokens if signed, undefined otherwise
   */
  getPlaybackTokens(playbackInfo: VideoPlaybackInfo): VideoPlaybackTokens | undefined {
    if (isSignedPlaybackInfo(playbackInfo)) {
      return {
        playback: playbackInfo.stream.token,
        thumbnail: playbackInfo.thumbnail.token,
        storyboard: playbackInfo.storyboard.token,
        animated: playbackInfo.animated.token,
      }
    }

    return undefined
  }
}

function parseAssetInstanceId(assetIdentifier: MediaLibraryAssetInstanceIdentifier): {
  instanceId: string
  libraryId?: string
} {
  if (typeof assetIdentifier === 'string') {
    // Handle video-prefixed asset instance ID
    if (assetIdentifier.startsWith('video-')) {
      return {instanceId: assetIdentifier}
    }
    // Assume it's a container ID or plain instance ID
    return {instanceId: assetIdentifier}
  }

  if (assetIdentifier && typeof assetIdentifier === 'object' && '_ref' in assetIdentifier) {
    const ref = assetIdentifier._ref
    if (typeof ref === 'string') {
      // Parse GDR to extract library ID and instance ID
      // Expected format: "media-library:libraryId:instanceId"
      const gdrParts = ref.split(':')

      // Valid GDR must have exactly 3 parts and start with 'media-library'
      if (gdrParts.length === 3 && gdrParts[0] === 'media-library') {
        const [, libraryId, instanceId] = gdrParts

        // Validate that libraryId and instanceId are not empty
        if (!libraryId || !instanceId) {
          throw new Error(
            `Invalid media library reference format: "${ref}". Expected format: "media-library:mlXXXX:instanceId"`,
          )
        }

        // Validate that libraryId starts with 'ml' prefix
        if (!libraryId.startsWith('ml')) {
          throw new Error(
            `Invalid library ID in reference: "${ref}". Library ID must start with "ml" prefix`,
          )
        }

        return {
          libraryId,
          instanceId,
        }
      }

      // Invalid GDR format
      throw new Error(
        `Invalid media library reference format: "${ref}". Expected format: "media-library:mlXXXX:instanceId"`,
      )
    }
  }

  throw new Error('Invalid asset identifier: must be a string or an object with a _ref property')
}

function buildVideoPlaybackInfoUrl(instanceId: string, libraryId?: string): string {
  const effectiveLibraryId = libraryId || 'default'
  return `/media-libraries/${effectiveLibraryId}/video/${instanceId}/playback-info`
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

/** @internal */
function isSignedPlayback(item: VideoPlaybackInfoItem): item is VideoPlaybackInfoItemSigned {
  return 'token' in item
}

/** @internal */
function isSignedPlaybackInfo(
  playbackInfo: VideoPlaybackInfo,
): playbackInfo is VideoPlaybackInfoSigned {
  return isSignedPlayback(playbackInfo.stream)
}
