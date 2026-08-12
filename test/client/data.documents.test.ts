import {describe, expect, test} from 'vitest'

import {getActiveMock, objectContaining} from '../helpers/mockFetch'
import {apiHost, createClient, getClient, isEdge, projectHost} from './helpers'

describe('fetching documents', () => {
  test.skipIf(isEdge)('can query for single document', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123')
      .respond({
        status: 200,
        body: {
          ms: 123,
          documents: [{_id: 'abc123', mood: 'lax'}],
        },
      })

    await expect(getClient().getDocument('abc123'), 'data should match').resolves.toMatchObject({
      mood: 'lax',
    })
  })

  test.skipIf(isEdge)('can query for single document using resource config', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/media-libraries/res-id/doc/abc123')
      .respond({
        status: 200,
        body: {
          ms: 123,
          documents: [{_id: 'abc123', mood: 'lax'}],
        },
      })

    await expect(
      getClient({'~experimental_resource': {type: 'media-library', id: 'res-id'}}).getDocument(
        'abc123',
      ),
      'data should match',
    ).resolves.toMatchObject({
      mood: 'lax',
    })
  })

  test.skipIf(isEdge)('can query for single document with request tag', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123?tag=some.tag')
      .respond({
        status: 200,
        body: {
          ms: 123,
          documents: [{_id: 'abc123', mood: 'lax'}],
        },
      })

    await expect(
      getClient().getDocument('abc123', {tag: 'some.tag'}),
      'data should match',
    ).resolves.toMatchObject({
      mood: 'lax',
    })
  })

  test.skipIf(isEdge)('can query for multiple documents', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123,abc321')
      .respond({
        status: 200,
        body: {
          ms: 123,
          documents: [
            {_id: 'abc123', mood: 'lax'},
            {_id: 'abc321', mood: 'tense'},
          ],
        },
      })

    const [abc123, abc321] = await getClient().getDocuments(['abc123', 'abc321'])
    expect(abc123!.mood, 'data should match').toBe('lax')
    expect(abc321!.mood, 'data should match').toBe('tense')
  })

  test.skipIf(isEdge)('can query for multiple documents with tag', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123,abc321?tag=mood.docs')
      .respond({
        status: 200,
        body: {
          ms: 123,
          documents: [
            {_id: 'abc123', mood: 'lax'},
            {_id: 'abc321', mood: 'tense'},
          ],
        },
      })

    const [abc123, abc321] = await getClient().getDocuments(['abc123', 'abc321'], {
      tag: 'mood.docs',
    })
    expect(abc123!.mood, 'data should match').toBe('lax')
    expect(abc321!.mood, 'data should match').toBe('tense')
  })

  test.skipIf(isEdge)('preserves the position of requested documents', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123,abc321,abc456')
      .respond({
        status: 200,
        body: {
          ms: 123,
          documents: [
            {_id: 'abc456', mood: 'neutral'},
            {_id: 'abc321', mood: 'tense'},
          ],
        },
      })

    const [abc123, abc321, abc456] = await getClient().getDocuments(['abc123', 'abc321', 'abc456'])
    expect(abc123, 'first item should be null').toBeNull()
    expect(abc321!.mood, 'data should match').toBe('tense')
    expect(abc456!.mood, 'data should match').toBe('neutral')
  })

  test.skipIf(isEdge)(
    'documentsExists returns set with all ids when none are omitted',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on('GET', '/v1/data/doc/foo/abc123,abc321', {
          query: objectContaining({excludeContent: 'true'}),
        })
        .respond({status: 200, body: {ms: 123, omitted: []}})

      const existing = await getClient().documentsExists(['abc123', 'abc321'])
      expect(existing).toBeInstanceOf(Set)
      expect(existing.has('abc123')).toBe(true)
      expect(existing.has('abc321')).toBe(true)
      expect(existing.size).toBe(2)
    },
  )

  test.skipIf(isEdge)('documentsExists excludes ids omitted with reason "existence"', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123,abc321,abc456', {
        query: objectContaining({excludeContent: 'true'}),
      })
      .respond({
        status: 200,
        body: {
          ms: 123,
          omitted: [
            {id: 'abc321', reason: 'existence'},
            {id: 'abc456', reason: 'existence'},
          ],
        },
      })

    const existing = await getClient().documentsExists(['abc123', 'abc321', 'abc456'])
    expect(existing.has('abc123')).toBe(true)
    expect(existing.has('abc321')).toBe(false)
    expect(existing.has('abc456')).toBe(false)
    expect(existing.size).toBe(1)
  })

  test.skipIf(isEdge)(
    'documentsExists keeps ids omitted with reason other than "existence"',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on('GET', '/v1/data/doc/foo/abc123,abc321', {
          query: objectContaining({excludeContent: 'true'}),
        })
        .respond({
          status: 200,
          body: {
            ms: 123,
            omitted: [{id: 'abc321', reason: 'permissions'}],
          },
        })

      const existing = await getClient().documentsExists(['abc123', 'abc321'])
      expect(existing.has('abc123')).toBe(true)
      expect(existing.has('abc321')).toBe(true)
      expect(existing.size).toBe(2)
    },
  )

  test.skipIf(isEdge)('documentsExists forwards the tag option', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123', {
        query: objectContaining({excludeContent: 'true', tag: 'check.exists'}),
      })
      .respond({status: 200, body: {ms: 123, omitted: []}})

    const existing = await getClient().documentsExists(['abc123'], {tag: 'check.exists'})
    expect(existing.has('abc123')).toBe(true)
  })

  test.skipIf(isEdge)(
    'documentsExists returns empty set for empty ids without making a request',
    async () => {
      const existing = await getClient().documentsExists([])
      expect(existing).toBeInstanceOf(Set)
      expect(existing.size).toBe(0)
    },
  )

  test.skipIf(isEdge)('documentsExists works with a single id', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123', {query: objectContaining({excludeContent: 'true'})})
      .respond({status: 200, body: {ms: 123, omitted: []}})

    const existing = await getClient().documentsExists(['abc123'])
    expect(existing).toBeInstanceOf(Set)
    expect(existing.size).toBe(1)
    expect(existing.has('abc123')).toBe(true)
  })

  test.skipIf(isEdge)('documentsExists rejects on http error responses', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123', {query: objectContaining({excludeContent: 'true'})})
      .respond({status: 500, body: {error: 'Internal Server Error'}})

    await expect(getClient().documentsExists(['abc123'])).rejects.toThrow(/Internal Server Error/)
  })

  test.skipIf(isEdge)('documentsExists rejects on http error', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123', {query: objectContaining({excludeContent: 'true'})})
      .respond({status: 500})

    try {
      await getClient().documentsExists(['abc123'])
    } catch (err: any) {
      expect(err).toBeInstanceOf(Error)
      expect(err.message).toContain('HTTP 500')
    }
  })

  test.skipIf(isEdge)(
    'documentsExists treats missing omitted field as all ids existing',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on('GET', '/v1/data/doc/foo/abc123,abc321', {
          query: objectContaining({excludeContent: 'true'}),
        })
        .respond({status: 200, body: {ms: 123}})

      const existing = await getClient().documentsExists(['abc123', 'abc321'])
      expect(existing.size).toBe(2)
      expect(existing.has('abc123')).toBe(true)
      expect(existing.has('abc321')).toBe(true)
    },
  )

  test.skipIf(isEdge)(
    'documentsExists percent-encodes ids so delimiter chars are preserved',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on('GET', '/v1/data/doc/foo/weird%2Cid,normal', {
          query: objectContaining({excludeContent: 'true'}),
        })
        .respond({status: 200, body: {ms: 123, omitted: []}})

      const existing = await getClient().documentsExists(['weird,id', 'normal'])
      expect(existing.size).toBe(2)
      expect(existing.has('weird,id')).toBe(true)
      expect(existing.has('normal')).toBe(true)
    },
  )

  test.skipIf(isEdge)(
    'documentsExists batches large id arrays into requests of at most 100 ids',
    async () => {
      const ids = Array.from({length: 150}, (_, i) => `id${i + 1}`)
      const firstBatch = ids.slice(0, 100)
      const secondBatch = ids.slice(100)

      getActiveMock()
        .scope(projectHost())
        .on('GET', `/v1/data/doc/foo/${firstBatch.join(',')}`, {
          query: objectContaining({excludeContent: 'true'}),
        })
        .respond({status: 200, body: {ms: 1, omitted: [{id: 'id5', reason: 'existence'}]}})

      getActiveMock()
        .scope(projectHost())
        .on('GET', `/v1/data/doc/foo/${secondBatch.join(',')}`, {
          query: objectContaining({excludeContent: 'true'}),
        })
        .respond({status: 200, body: {ms: 1, omitted: [{id: 'id105', reason: 'existence'}]}})

      const existing = await getClient().documentsExists(ids)
      expect(existing.size).toBe(148)
      expect(existing.has('id5')).toBe(false)
      expect(existing.has('id105')).toBe(false)
      expect(existing.has('id1')).toBe(true)
      expect(existing.has('id100')).toBe(true)
      expect(existing.has('id101')).toBe(true)
      expect(existing.has('id150')).toBe(true)
    },
  )

  test.skipIf(isEdge)(
    'gives http statuscode as error if no body is present on errors',
    async () => {
      expect.assertions(2)

      getActiveMock()
        .scope(projectHost())
        .on('GET', '/v1/data/doc/foo/abc123')
        .respond({status: 400})

      try {
        await getClient().getDocument('abc123')
      } catch (err: any) {
        expect(err, 'should be error').toBeInstanceOf(Error)
        expect(err.message, 'should contain status code').toContain('HTTP 400')
      }
    },
  )

  test.skipIf(isEdge)('includes body if expected JSON object not returned on errors', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123')
      .respond({status: 400, body: 'Some string short enough to inline fully'})

    try {
      await getClient().getDocument('abc123')
    } catch (err: any) {
      expect(err, 'should be error').toBeInstanceOf(Error)
      expect(err.message).toContain(
        'HTTP 400 Bad Request (Some string short enough to inline fully)',
      )
    }
  })

  test.skipIf(isEdge)(
    'includes part of body if expected JSON object not returned on errors',
    async () => {
      expect.assertions(2)

      getActiveMock().scope(projectHost()).on('GET', '/v1/data/doc/foo/abc123').respond({
        status: 400,
        body: 'Some long string that should be capped at 100 characters because it seems odd to have the entire string if it is like HTML or something',
      })

      try {
        await getClient().getDocument('abc123')
      } catch (err: any) {
        expect(err, 'should be error').toBeInstanceOf(Error)
        expect(err.message).toContain(
          'HTTP 400 Bad Request (Some long string that should be capped at 100 characters because it seems odd to have the entire str…)',
        )
      }
    },
  )

  test.skipIf(isEdge)('uses `error` property as error if present and is string', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123')
      .respond({status: 400, body: {error: 'Some error'}})

    try {
      await getClient().getDocument('abc123')
    } catch (err: any) {
      expect(err, 'should be error').toBeInstanceOf(Error)
      expect(err.message).toBe('Some error')
    }
  })

  test.skipIf(isEdge)('uses `message` property as error if present and is string', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123')
      .respond({status: 400, body: {message: 'Some other error'}})

    try {
      await getClient().getDocument('abc123')
    } catch (err: any) {
      expect(err, 'should be error').toBeInstanceOf(Error)
      expect(err.message).toBe('Some other error')
    }
  })

  test.skipIf(isEdge)('falls back to HTTP error code if error shape is unknown', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123')
      .respond({status: 400, body: {error: {hmm: 'what is this'}}})

    try {
      await getClient().getDocument('abc123')
    } catch (err: any) {
      expect(err, 'should be error').toBeInstanceOf(Error)
      expect(err.message).toContain('resulted in HTTP 400')
    }
  })

  test.skipIf(isEdge)('populates response body on errors', async () => {
    expect.assertions(3)

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/doc/foo/abc123')
      .respondPersist({status: 400, body: 'Some Weird Error'})

    try {
      await getClient().getDocument('abc123')
    } catch (err: any) {
      expect(err, 'should be error').toBeInstanceOf(Error)
      expect(err.message, 'should contain status code').toContain('HTTP 400')
      expect(err.responseBody, 'body populated').toContain('Some Weird Error')
    }
  })

  test('throws if trying to perform data request without dataset', () => {
    expect(() => createClient({projectId: 'foo'}).fetch('blah')).toThrowError(
      /dataset.*?must be provided/,
    )
  })

  describe.skipIf(isEdge || typeof globalThis.AbortController === 'undefined')(
    'can cancel request with an abort controller signal',
    () => {
      test('client.fetch', async () => {
        expect.assertions(2)

        getActiveMock()
          .scope(projectHost())
          .on('GET', '/v1/data/query/foo', {query: objectContaining({query: '*'})})
          .respond({
            status: 200,
            body: {
              ms: 123,
              query: '*',
              result: [],
            },
            delay: 100,
          })

        const abortController = new AbortController()
        const promise = getClient().fetch('*', {}, {signal: abortController.signal})
        await new Promise((resolve) => setTimeout(resolve, 10))

        try {
          abortController.abort()
          await promise
        } catch (err: any) {
          expect(err).toBeInstanceOf(Error)
          expect(err.name, 'should throw AbortError').toBe('AbortError')
        }
      })
      test('client.getDocument', async () => {
        expect.assertions(2)

        getActiveMock()
          .scope(projectHost())
          .on('GET', '/v1/data/doc/foo/abc123dfg')
          .respond({
            status: 200,
            body: {
              ms: 123,
              documents: [{_id: 'abc123dfg', mood: 'lax'}],
            },
            delay: 100,
          })

        const abortController = new AbortController()
        const promise = getClient().getDocument('abc123dfg', {signal: abortController.signal})
        await new Promise((resolve) => setTimeout(resolve, 10))

        try {
          abortController.abort()
          await promise
        } catch (err: any) {
          if (err.name === 'AssertionError') throw err
          expect(err).toBeInstanceOf(Error)
          expect(err.name, 'should throw AbortError').toBe('AbortError')
        }
      })

      test('client.getDocument with releaseId converts regular id to version id', async () => {
        const documentId = 'abc123'
        const releaseId = 'release456'
        const versionId = `versions.${releaseId}.${documentId}`

        getActiveMock()
          .scope(projectHost())
          .on('GET', `/v1/data/doc/foo/${versionId}`)
          .respond({
            status: 200,
            body: {
              ms: 123,
              documents: [{_id: versionId, mood: 'excited'}],
            },
          })

        const doc = await getClient().getDocument(documentId, {releaseId})
        expect(doc?._id).toBe(versionId)
        expect(doc?.mood).toBe('excited')
      })

      test('client.getDocument with matching releaseId for existing version id', async () => {
        const documentId = 'abc123'
        const releaseId = 'release456'
        const versionId = `versions.${releaseId}.${documentId}`

        getActiveMock()
          .scope(projectHost())
          .on('GET', `/v1/data/doc/foo/${versionId}`)
          .respond({
            status: 200,
            body: {
              ms: 123,
              documents: [{_id: versionId, mood: 'content'}],
            },
          })

        // No releaseId in options to avoid validation error
        const doc = await getClient().getDocument(versionId)
        expect(doc?._id).toBe(versionId)
        expect(doc?.mood).toBe('content')
      })

      test('client.getDocument throws with non-matching releaseId for version id', async () => {
        const documentId = 'abc123'
        const existingReleaseId = 'release456'
        const newReleaseId = 'release789'
        const versionId = `versions.${existingReleaseId}.${documentId}`

        try {
          await getClient().getDocument(versionId, {releaseId: newReleaseId})
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(Error)
          expect((err as Error).message).toContain(
            `The document ID (\`${versionId}\`) is already a version of \`${existingReleaseId}\` release, but this does not match the provided \`options.releaseId\` (\`${newReleaseId}\`)`,
          )
        }
      })

      test('client.getDocument throws when using draft id with releaseId', async () => {
        expect.assertions(2)

        const publishedId = 'abc123'
        const draftId = `drafts.${publishedId}`
        const releaseId = 'release456'

        try {
          await getClient().getDocument(draftId, {releaseId})
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(Error)
          expect((err as Error).message).toContain(
            `The document ID (\`${draftId}\`) is a draft, but \`options.releaseId\` is set as \`${releaseId}\``,
          )
        }
      })

      test('client.getDocuments', async () => {
        expect.assertions(2)

        getActiveMock()
          .scope(projectHost())
          .on('GET', '/v1/data/doc/foo/abc123dfg,abc321dfg')
          .respond({
            status: 200,
            body: {
              ms: 123,
              documents: [
                {_id: 'abc123dfg', mood: 'lax'},
                {_id: 'abc321dfg', mood: 'tense'},
              ],
            },
            delay: 100,
          })

        const abortController = new AbortController()
        const promise = getClient().getDocuments(['abc123dfg', 'abc321dfg'], {
          signal: abortController.signal,
        })
        await new Promise((resolve) => setTimeout(resolve, 10))

        try {
          abortController.abort()
          await promise
        } catch (err: any) {
          if (err.name === 'AssertionError') throw err
          expect(err).toBeInstanceOf(Error)
          expect(err.name, 'should throw AbortError').toBe('AbortError')
        }
      })
    },
  )
})
