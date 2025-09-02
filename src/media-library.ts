import type {
  VideoPlaybackInfo,
  VideoPlaybackInfoItem,
  VideoPlaybackInfoItemSigned,
  VideoPlaybackInfoSigned,
  VideoPlaybackTokens,
} from './types'

/**
 * Check if a playback info item (stream/thumbnail/etc) has a signed token
 * @internal
 */
function isSignedPlayback(item: VideoPlaybackInfoItem): item is VideoPlaybackInfoItemSigned {
  return 'token' in item
}

/**
 * Check if the entire playback info response requires signed URLs
 * @public
 */
export function isSignedPlaybackInfo(
  playbackInfo: VideoPlaybackInfo,
): playbackInfo is VideoPlaybackInfoSigned {
  return isSignedPlayback(playbackInfo.stream)
}

/**
 * Extract playback tokens from signed video playback info
 * @param playbackInfo - The video playback info
 * @returns The playback tokens or undefined if the response is not signed
 * @public
 * @example
 * const tokens = getPlaybackTokens(playbackInfo)
 * console.log(tokens)
 * ```json
 * {
 *    stream: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
 *    thumbnail: "eyJ0a2VuIjoiVGh1bWJuYWlsVG9rZW4tMTIz...",
 *    animated: "eyJ0a2VuIjoiQW5pbWF0ZWRUb2tlbi1kZWY...",
 *    storyboard: "eyJ0a2VuIjoiU3Rvcnlib2FyZFRva2VuLTc4..."
 * }
 * ```
 */
export function getPlaybackTokens(
  playbackInfo: VideoPlaybackInfo,
): VideoPlaybackTokens | undefined {
  if (isSignedPlaybackInfo(playbackInfo)) {
    return {
      stream: playbackInfo.stream.token,
      thumbnail: playbackInfo.thumbnail.token,
      storyboard: playbackInfo.storyboard.token,
      animated: playbackInfo.animated.token,
    }
  }

  return undefined
}
