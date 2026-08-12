import fs from 'node:fs'

import {type ClientConfig} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {bodyBytes, getActiveMock, objectContaining} from '../helpers/mockFetch'
import {fixture, getClient, globalApiHost} from './helpers'

describe('mediaLibrary', () => {
  const mediaLibraryId = 'ml123abc'
  const mediaLibraryClientConfig: ClientConfig = {
    '~experimental_resource': {type: 'media-library', id: mediaLibraryId},
  }
  test('video.getPlaybackInfo with string asset identifier', async () => {
    const client = getClient(mediaLibraryClientConfig)
    const assetId = 'video-abc123def'
    const mockResponse = {
      id: assetId,
      thumbnail: {url: 'https://example.com/thumb.jpg'},
      animated: {url: 'https://example.com/animated.gif'},
      storyboard: {url: 'https://example.com/storyboard.vtt'},
      stream: {url: 'https://example.com/stream.m3u8'},
      duration: 120,
      aspectRatio: 1.77,
    }

    getActiveMock()
      .scope(globalApiHost)
      .on('GET', `/v1/media-libraries/${mediaLibraryId}/video/video-abc123def/playback-info`)
      .respond({status: 200, body: mockResponse})

    const result = await client.mediaLibrary.video.getPlaybackInfo(assetId)
    expect(result).toEqual(mockResponse)
  })

  test('video.getPlaybackInfo with GDR asset identifier', async () => {
    const client = getClient(mediaLibraryClientConfig)
    const assetRef = {_ref: `media-library:${mediaLibraryId}:instance456`}
    const mockResponse = {
      id: 'instance456',
      thumbnail: {url: 'https://example.com/thumb.jpg'},
      animated: {url: 'https://example.com/animated.gif'},
      storyboard: {url: 'https://example.com/storyboard.vtt'},
      stream: {url: 'https://example.com/stream.m3u8'},
      duration: 120,
      aspectRatio: 1.77,
    }

    getActiveMock()
      .scope(globalApiHost)
      .on('GET', `/v1/media-libraries/${mediaLibraryId}/video/instance456/playback-info`)
      .respond({status: 200, body: mockResponse})

    const result = await client.mediaLibrary.video.getPlaybackInfo(assetRef)
    expect(result).toEqual(mockResponse)
  })

  test('video.getPlaybackInfo with transformation options', async () => {
    const client = getClient(mediaLibraryClientConfig)
    const assetId = 'video-test123'
    const options = {
      transformations: {
        thumbnail: {
          width: 640,
          height: 360,
          time: 30,
          fit: 'crop' as const,
          format: 'jpg' as const,
        },
        animated: {width: 320, height: 180, start: 10, end: 20, fps: 15, format: 'gif' as const},
        storyboard: {format: 'jpg' as const},
      },
      expiration: 3600,
    }
    const mockResponse = {
      id: assetId,
      thumbnail: {url: 'https://example.com/thumb-640x360.jpg'},
      animated: {url: 'https://example.com/animated-320x180.gif'},
      storyboard: {url: 'https://example.com/storyboard.vtt'},
      stream: {url: 'https://example.com/stream.m3u8'},
      duration: 120,
      aspectRatio: 1.77,
    }

    getActiveMock()
      .scope(globalApiHost)
      .on('GET', `/v1/media-libraries/${mediaLibraryId}/video/video-test123/playback-info`, {
        query: {
          thumbnailWidth: 640,
          thumbnailHeight: 360,
          thumbnailTime: 30,
          thumbnailFit: 'crop',
          thumbnailFormat: 'jpg',
          animatedWidth: 320,
          animatedHeight: 180,
          animatedStart: 10,
          animatedEnd: 20,
          animatedFps: 15,
          animatedFormat: 'gif',
          storyboardFormat: 'jpg',
          expiration: 3600,
        },
      })
      .respond({status: 200, body: mockResponse})

    const result = await client.mediaLibrary.video.getPlaybackInfo(assetId, options)
    expect(result).toEqual(mockResponse)
  })

  test('video.getPlaybackInfo throws error for invalid GDR format', async () => {
    const client = getClient(mediaLibraryClientConfig)

    // Test various invalid GDR formats
    const invalidRefs = [
      {
        _ref: 'invalid:format',
        expectedError:
          'Invalid video asset instance identifier "invalid:format": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      },
      {
        _ref: 'media-library:',
        expectedError:
          'Invalid video asset instance identifier "media-library:": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      },
      {
        _ref: 'media-library:ml123:',
        expectedError:
          'Invalid video asset instance identifier "media-library:ml123:": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      },
      {
        _ref: 'media-library::instanceId',
        expectedError:
          'Invalid video asset instance identifier "media-library::instanceId": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      },
      {
        _ref: 'wrongPrefix:ml123:instance',
        expectedError:
          'Invalid video asset instance identifier "wrongPrefix:ml123:instance": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      },
      {
        _ref: 'media-library:ml123:instance:extra',
        expectedError:
          'Invalid video asset instance identifier "media-library:ml123:instance:extra": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      },
      {
        _ref: 'media-library:library123:instance456', // Missing 'ml' prefix
        expectedError:
          'Invalid video asset instance identifier "media-library:library123:instance456": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      },
    ]

    for (const {_ref, expectedError} of invalidRefs) {
      try {
        await client.mediaLibrary.video.getPlaybackInfo({_ref})
        // Should not reach here
        expect.fail(`Expected error for ref: ${_ref}`)
      } catch (err) {
        expect((err as Error).message).toContain(expectedError)
      }
    }
  })

  test('video.getPlaybackInfo throws error for invalid asset instance id', async () => {
    const client = getClient(mediaLibraryClientConfig)

    expect.assertions(2)

    try {
      await client.mediaLibrary.video.getPlaybackInfo({} as any)
    } catch (err) {
      expect((err as Error).message).toBe(
        'Invalid video asset instance identifier "[object Object]": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      )
    }

    try {
      await client.mediaLibrary.video.getPlaybackInfo({_ref: 123} as any)
    } catch (err) {
      expect((err as Error).message).toBe(
        'Invalid video asset instance identifier "123": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
      )
    }
  })

  test('video.getPlaybackInfo handles API errors', async () => {
    const client = getClient(mediaLibraryClientConfig)
    const assetId = 'video-error123'

    getActiveMock()
      .scope(globalApiHost)
      .on('GET', `/v1/media-libraries/${mediaLibraryId}/video/video-error123/playback-info`)
      .respond({status: 404, body: {error: 'Asset not found'}})

    await expect(client.mediaLibrary.video.getPlaybackInfo(assetId)).rejects.toThrow()
  })

  test('video.getPlaybackInfo with partial transformation options', async () => {
    const client = getClient(mediaLibraryClientConfig)
    const assetId = 'video-partial123'
    const options = {
      transformations: {
        thumbnail: {width: 800},
        animated: {format: 'webp' as const},
      },
    }
    const mockResponse = {
      id: assetId,
      thumbnail: {url: 'https://example.com/thumb-800.jpg'},
      animated: {url: 'https://example.com/animated.webp'},
      storyboard: {url: 'https://example.com/storyboard.vtt'},
      stream: {url: 'https://example.com/stream.m3u8'},
      duration: 120,
      aspectRatio: 1.77,
    }

    getActiveMock()
      .scope(globalApiHost)
      .on('GET', `/v1/media-libraries/${mediaLibraryId}/video/video-partial123/playback-info`, {
        query: {
          thumbnailWidth: 800,
          animatedFormat: 'webp',
        },
      })
      .respond({status: 200, body: mockResponse})

    const result = await client.mediaLibrary.video.getPlaybackInfo(assetId, options)
    expect(result).toEqual(mockResponse)
  })

  test('video.getPlaybackInfo with signed/secured response', async () => {
    const client = getClient(mediaLibraryClientConfig)
    const assetId = 'video-secured123'
    const mockResponse = {
      id: assetId,
      thumbnail: {url: 'https://example.com/thumb.jpg', token: 'thumb-token-123'},
      animated: {url: 'https://example.com/animated.gif', token: 'anim-token-456'},
      storyboard: {url: 'https://example.com/storyboard.vtt', token: 'story-token-789'},
      stream: {url: 'https://example.com/stream.m3u8', token: 'stream-token-abc'},
      duration: 90,
      aspectRatio: 1.77,
    }

    getActiveMock()
      .scope(globalApiHost)
      .on('GET', `/v1/media-libraries/${mediaLibraryId}/video/video-secured123/playback-info`)
      .respond({status: 200, body: mockResponse})

    const {getPlaybackTokens, isSignedPlaybackInfo} = await import('../../src/media-library')

    const result = await client.mediaLibrary.video.getPlaybackInfo(assetId)
    expect(result).toEqual(mockResponse)

    // Test that we can detect it's a signed response
    expect('token' in result.stream).toBe(true)
    expect('token' in result.thumbnail).toBe(true)

    // Test helper functions
    expect(isSignedPlaybackInfo(result)).toBe(true)

    // Test token extraction using the helper function
    const tokens = getPlaybackTokens(result)
    expect(tokens).toEqual({
      stream: 'stream-token-abc',
      thumbnail: 'thumb-token-123',
      storyboard: 'story-token-789',
      animated: 'anim-token-456',
    })
  })

  test('supports new `resource` configuration property', () => {
    const clientWithNewConfig = getClient({
      resource: {type: 'media-library', id: mediaLibraryId},
    })
    expect(clientWithNewConfig.getDataUrl('query')).toBe(`/media-libraries/${mediaLibraryId}/query`)
  })

  test('maintains backwards compatibility with `~experimental_resource`', () => {
    const clientWithOldConfig = getClient({
      '~experimental_resource': {type: 'media-library', id: mediaLibraryId},
    })
    expect(clientWithOldConfig.getDataUrl('query')).toBe(`/media-libraries/${mediaLibraryId}/query`)
  })

  test('prefers `resource` over `~experimental_resource` when both are set', () => {
    const preferredId = 'ml-preferred'
    const deprecatedId = 'ml-deprecated'
    const clientWithBoth = getClient({
      resource: {type: 'media-library', id: preferredId},
      '~experimental_resource': {type: 'media-library', id: deprecatedId},
    })
    expect(clientWithBoth.getDataUrl('query')).toBe(`/media-libraries/${preferredId}/query`)
  })

  test('can delete media library assets using mutations', async () => {
    const client = getClient({resource: {type: 'media-library', id: mediaLibraryId}})
    const assetId = '36fOGtOJOadpl4F9xpksb9uKjYp'
    const expectedBody = {mutations: [{delete: {id: assetId}}]}

    getActiveMock()
      .scope(globalApiHost)
      .on(
        'POST',
        `/v1/media-libraries/${mediaLibraryId}/mutate?returnIds=true&returnDocuments=true&visibility=sync`,
        {body: expectedBody},
      )
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
          results: [{id: assetId, operation: 'delete'}],
        },
      })

    // The correct way to delete Media Library assets is using mutations
    await expect(client.delete(assetId)).resolves.not.toThrow()
  })

  test('assets.upload() works with new resource config', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(globalApiHost)
      .on('POST', `/v1/media-libraries/${mediaLibraryId}/upload`, {body: isImage})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url', _id: 'image-123'}}})

    const client = getClient({resource: {type: 'media-library', id: mediaLibraryId}})
    const body = fs.readFileSync(fixturePath)
    await expect(client.assets.upload('image', body)).resolves.toMatchObject({
      url: 'https://some.asset.url',
    })
  })

  test('assets.upload() with metadata options', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const uploadOptions = {
      filename: 'custom-filename.jpg',
      title: 'Custom Title',
      contentType: 'image/jpeg',
    }

    getActiveMock()
      .scope(globalApiHost)
      .on('POST', `/v1/media-libraries/${mediaLibraryId}/upload`, {
        query: objectContaining({
          filename: 'custom-filename.jpg',
          title: 'Custom Title',
          // Note: Media Library only supports title and filename, not description/label/etc
        }),
      })
      .respond({
        status: 201,
        body: {
          document: {
            url: 'https://some.asset.url',
            _id: 'image-123',
            title: 'Custom Title',
            originalFilename: 'custom-filename.jpg',
          },
        },
      })

    const client = getClient({resource: {type: 'media-library', id: mediaLibraryId}})
    const body = fs.readFileSync(fixturePath)
    await expect(client.assets.upload('image', body, uploadOptions)).resolves.toMatchObject({
      title: 'Custom Title',
      originalFilename: 'custom-filename.jpg',
    })
  })

  test('normalizes ~experimental_resource to resource config', () => {
    // When using the deprecated config, it should be normalized to the new one
    const clientWithDeprecated = getClient({
      '~experimental_resource': {type: 'media-library', id: 'test-id'},
    })

    // The config should have the resource property set
    const config = clientWithDeprecated.config()
    expect(config.resource).toEqual({type: 'media-library', id: 'test-id'})

    // Both should work for backwards compatibility
    expect(config['~experimental_resource']).toEqual({type: 'media-library', id: 'test-id'})
  })

  test('throws error when Media Library ID is invalid in fetch', async () => {
    const clientWithInvalidId = getClient({
      resource: {type: 'media-library', id: 'invalid-id'},
    })

    getActiveMock()
      .scope(globalApiHost)
      .on('GET', '/v1/media-libraries/invalid-id/query?query=%2A&returnQuery=false')
      .respond({
        status: 404,
        body: {
          error: {message: 'Media Library not found'},
          statusCode: 404,
        },
      })

    await expect(clientWithInvalidId.fetch('*')).rejects.toThrow()
  })

  test('throws error when Media Library ID is invalid in upload', async () => {
    const clientWithInvalidId = getClient({
      resource: {type: 'media-library', id: 'invalid-id'},
    })

    getActiveMock()
      .scope(globalApiHost)
      .on('POST', '/v1/media-libraries/invalid-id/upload')
      .respond({
        status: 404,
        body: {
          error: {message: 'Media Library not found'},
          statusCode: 404,
        },
      })

    const fixturePath = fixture('horsehead-nebula.jpg')
    const body = fs.readFileSync(fixturePath)
    await expect(clientWithInvalidId.assets.upload('image', body)).rejects.toThrow()
  })

  test('fetch() works with resource config', async () => {
    const client = getClient({resource: {type: 'media-library', id: mediaLibraryId}})

    getActiveMock()
      .scope(globalApiHost)
      .on('GET', `/v1/media-libraries/${mediaLibraryId}/query?query=%2A&returnQuery=false`)
      .respond({
        status: 200,
        body: {
          result: [{_id: 'asset-123', _type: 'sanity.asset'}],
          ms: 100,
        },
      })

    const result = await client.fetch('*')
    expect(result).toEqual([{_id: 'asset-123', _type: 'sanity.asset'}])
  })
})
