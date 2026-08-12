import fs from 'node:fs'

import {describe, expect, test} from 'vitest'

import {bodyBytes, getActiveMock, objectContaining} from '../helpers/mockFetch'
import {getClient, globalApiHost} from './helpers'
import {fixture} from './helpers.node'

describe('mediaLibrary (node)', () => {
  const mediaLibraryId = 'ml123abc'

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
})
