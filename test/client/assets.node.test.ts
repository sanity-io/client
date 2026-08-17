import fs from 'node:fs'

import {lastValueFrom, toArray} from 'rxjs'
import {filter} from 'rxjs/operators'
import {describe, expect, test} from 'vitest'

import {bodyBytes, getActiveFetch, getActiveMock} from '../helpers/mockFetch'
import {getClient, projectHost} from './helpers'
import {fixture} from './helpers.node'

describe('ASSETS', () => {
  test('uploads images', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo', {body: isImage})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    const document = await getClient().assets.upload('image', fs.createReadStream(fixturePath))
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('uploads have no timeout by default, even with a client-level timeout', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo', {body: bodyBytes(fs.readFileSync(fixturePath))})
      .respond({
        status: 201,
        body: {document: {url: 'https://some.asset.url'}},
        delay: 150,
      })

    // Timing out an upload is opt-in (uploads can legitimately be slow):
    // neither the client-level timeout nor get-it's default timeout may
    // abort the upload request. The init's signal is the transport's
    // unsubscribe/caller-abort controller, so it must not fire mid-upload -
    // even once the upload has outlasted the client-level timeout - and the
    // upload must complete.
    const inits: Array<{signal?: AbortSignal}> = []
    const client = getClient({
      timeout: 50,
      resolveFetch: () => (url, init) => {
        if (typeof init === 'object' && init !== null) inits.push(init)
        return getActiveFetch()(url, init)
      },
    })

    const upload = client.assets.upload('image', fs.createReadStream(fixturePath))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(inits).toHaveLength(1)
    expect(inits[0].signal?.aborted, 'no timeout abort mid-upload').not.toBe(true)

    const document = await upload
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('uploads images with request tag if given', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo?tag=galaxy.images', {body: isImage})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    const document = await getClient().assets.upload('image', fs.createReadStream(fixturePath), {
      tag: 'galaxy.images',
    })
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('uploads images with prefixed request tag if given', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo?tag=galaxy.images', {body: isImage})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    const document = await getClient({requestTagPrefix: 'galaxy'}).assets.upload(
      'image',
      fs.createReadStream(fixturePath),
      {tag: 'images'},
    )
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('uploads images with given content type', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo', {
        body: isImage,
        headers: {'Content-Type': 'image/jpeg'},
      })
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    const document = await getClient().assets.upload('image', fs.createReadStream(fixturePath), {
      contentType: 'image/jpeg',
    })
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('uploads images with specified metadata to be extracted', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo?meta=palette&meta=location', {body: isImage})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    const options = {extract: ['palette' as const, 'location' as const]}
    const document = await getClient().assets.upload(
      'image',
      fs.createReadStream(fixturePath),
      options,
    )
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('empty extract array sends `none` as metadata', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo?meta=none', {body: isImage})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    const options = {extract: []}
    const document = await getClient().assets.upload(
      'image',
      fs.createReadStream(fixturePath),
      options,
    )
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('uploads images without progress events in Node', async () => {
    // get-it v9 / fetch has no per-chunk progress hook, so Node uploads
    // only ever emit the terminal `response` event. Browsers get progress
    // events via a separate XHR-based code path (see `browserUpload`).
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo', {body: isImage})
      .respond({status: 201, body: {url: 'https://some.asset.url'}})

    const uploadProgress = getClient()
      .observable.assets.upload('image', fs.createReadStream(fixturePath))
      .pipe(filter((event) => event.type === 'progress'))

    const events = await lastValueFrom(uploadProgress.pipe(toArray()))
    expect(events).toEqual([])
  })

  test('uploads images with custom label', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))
    const label = 'xy zzy'
    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/assets/images/foo?label=${encodeURIComponent(label)}`, {body: isImage})
      .respond({status: 201, body: {document: {label: label}}})

    const body = await getClient().assets.upload('image', fs.createReadStream(fixturePath), {
      label: label,
    })
    expect(body).toMatchObject({label})
  })

  test('uploads files', async () => {
    const fixturePath = fixture('pdf-sample.pdf')
    const isFile = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/files/foo', {body: isFile})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    const document = await getClient().assets.upload('file', fs.createReadStream(fixturePath))
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('uploads images and can cast to promise', async () => {
    const fixturePath = fixture('horsehead-nebula.jpg')
    const isImage = bodyBytes(fs.readFileSync(fixturePath))

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo', {body: isImage})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    const document = await getClient().assets.upload('image', fs.createReadStream(fixturePath))
    expect(document).toMatchObject({url: 'https://some.asset.url'})
  })

  test('delete assets', async () => {
    const expectedBody = {mutations: [{delete: {id: 'image-abc123_foobar-123x123-png'}}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({
        status: 200,
        body: {transactionId: 'abc123', results: [{id: 'abc123', operation: 'delete'}]},
      })

    await expect(getClient().delete('image-abc123_foobar-123x123-png')).resolves.not.toThrow()
  })
})
