import {of} from 'rxjs'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import * as dataMethods from '../src/data/dataMethods'
import type {ClientConfig, RawQueryResponse, SanityDocument} from '../src/types'

const apiHost = 'api.sanity.url'
const defaultProjectId = 'bf1942'
const projectHost = (projectId?: string) => `https://${projectId || defaultProjectId}.${apiHost}`
const clientConfig = {
  apiHost: `https://${apiHost}`,
  projectId: 'bf1942',
  apiVersion: '1',
  dataset: 'foo',
  useCdn: false,
}

describe('dataMethods', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  const {createClient}: typeof import('../src') = await import(
    isEdge ? '../dist/index.browser.js' : '../src'
  )
  const getClient = (conf?: ClientConfig) => createClient({...clientConfig, ...(conf || {})})

  const createMockResponse = (documents: any[]) =>
    of({
      type: 'response',
      body: {documents},
    })

  const createMockQueryResponse = (result: any) =>
    of({
      type: 'response',
      body: {result},
    })

  const assertObservable = <T>(
    observable: any,
    assertion: (value: T) => void,
    done: (value?: any) => void,
  ) => {
    observable.subscribe({
      next: (value: T) => {
        try {
          assertion(value)
          done()
        } catch (err) {
          done(err)
        }
      },
      error: (err: Error) => done(err),
    })
  }

  describe('getUrl', () => {
    test('can use getUrl() to get API-relative paths', () => {
      expect(dataMethods._getUrl(getClient(), '/bar/baz')).toEqual(`${projectHost()}/v1/bar/baz`)
    })

    test('can use getUrl() to get API-relative paths (custom api version)', () => {
      expect(dataMethods._getUrl(getClient({apiVersion: '2019-01-29'}), '/bar/baz')).toEqual(
        `${projectHost()}/v2019-01-29/bar/baz`,
      )
    })
  })

  describe('_getDocument', () => {
    const mockHttpRequest = vi.fn()
    const docId = 'someDocId'
    const draftId = 'drafts.someDocId'
    const releaseId = 'someReleaseId'
    const versionId = `versions.${releaseId}.${docId}`
    const mockDoc = {_id: docId, _type: 'test', title: 'Test Document'}

    beforeEach(() => {
      mockHttpRequest.mockClear()
    })

    test('fetches a document by ID', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([mockDoc]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId)

      return new Promise<void>((resolve) => {
        assertObservable<SanityDocument<any> | undefined>(
          observable,
          (document) => {
            expect(document).toEqual(mockDoc)
            expect(mockHttpRequest).toHaveBeenCalledTimes(1)
            expect(mockHttpRequest.mock.calls[0][0].uri).toEqual(`/data/doc/foo/${docId}`)
          },
          resolve,
        )
      })
    })

    test('returns undefined when document is not found', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId)

      return new Promise<void>((resolve) => {
        assertObservable<SanityDocument<any> | undefined>(
          observable,
          (document) => {
            expect(document).toBeUndefined()
          },
          resolve,
        )
      })
    })

    test('passes tag option to request', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([mockDoc]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {tag: 'test-tag'})

      return new Promise<void>((resolve) => {
        assertObservable(
          observable,
          () => {
            expect(mockHttpRequest.mock.calls[0][0].tag).toEqual('test-tag')
          },
          resolve,
        )
      })
    })

    test('passes signal option to request', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([mockDoc]))

      const client = getClient()
      const signal = new AbortController().signal
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {signal})

      return new Promise<void>((resolve) => {
        assertObservable(
          observable,
          () => {
            expect(mockHttpRequest.mock.calls[0][0].signal).toBe(signal)
          },
          resolve,
        )
      })
    })

    test('uses version ID when releaseId is provided', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([{...mockDoc, _id: versionId}]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {
        releaseId,
      })

      return new Promise<void>((resolve) => {
        assertObservable(
          observable,
          () => {
            expect(mockHttpRequest.mock.calls[0][0].uri).toEqual(
              `/data/doc/foo/versions.${releaseId}.${docId}`,
            )
          },
          resolve,
        )
      })
    })

    test('throws error when releaseId is provided with a draft ID', () => {
      const client = getClient()

      expect(() => {
        dataMethods._getDocument(client, mockHttpRequest, draftId, {releaseId})
      }).toThrow(/The document ID \(drafts.someDocId\) is a draft, but `options.releaseId` is set/)
    })

    test('keeps existing version ID if it matches releaseId', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([{...mockDoc, _id: versionId}]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, versionId, {
        releaseId,
      })

      return new Promise<void>((resolve) => {
        assertObservable(
          observable,
          () => {
            expect(mockHttpRequest.mock.calls[0][0].uri).toEqual(
              `/data/doc/foo/versions.${releaseId}.${docId}`,
            )
          },
          resolve,
        )
      })
    })

    test('throws error when document version ID does not match provided releaseId', () => {
      const client = getClient()
      const differentReleaseId = 'differentReleaseId'
      const differentVersionId = `versions.${differentReleaseId}.${docId}`

      expect(() => {
        dataMethods._getDocument(client, mockHttpRequest, differentVersionId, {
          releaseId,
        })
      }).toThrow(/The document ID .* is already a version .* but this does not match the provided/)
    })
  })

  describe('_getDocuments', () => {
    const mockHttpRequest = vi.fn()
    const docIds = ['doc1', 'doc2', 'doc3']
    const mockDocs = [
      {_id: 'doc1', _type: 'test', title: 'Document 1'},
      {_id: 'doc2', _type: 'test', title: 'Document 2'},
      {_id: 'doc3', _type: 'test', title: 'Document 3'},
    ]

    beforeEach(() => {
      mockHttpRequest.mockClear()
    })

    test('fetches multiple documents by ID', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse(mockDocs))

      const client = getClient()
      const observable = dataMethods._getDocuments(client, mockHttpRequest, docIds)

      return new Promise<void>((resolve) => {
        assertObservable<(SanityDocument<any> | null)[]>(
          observable,
          (documents) => {
            expect(documents).toEqual(mockDocs)
            expect(mockHttpRequest).toHaveBeenCalledTimes(1)
            expect(mockHttpRequest.mock.calls[0][0].uri).toEqual('/data/doc/foo/doc1,doc2,doc3')
          },
          resolve,
        )
      })
    })

    test('handles missing documents with null values', () => {
      const availableDocs = [mockDocs[0], mockDocs[2]]
      mockHttpRequest.mockReturnValueOnce(createMockResponse(availableDocs))

      const client = getClient()
      const observable = dataMethods._getDocuments(client, mockHttpRequest, docIds)

      return new Promise<void>((resolve) => {
        assertObservable<(SanityDocument<any> | null)[]>(
          observable,
          (documents) => {
            expect(documents).toEqual([mockDocs[0], null, mockDocs[2]])
          },
          resolve,
        )
      })
    })

    test('passes tag option to request', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse(mockDocs))

      const client = getClient()
      const observable = dataMethods._getDocuments(client, mockHttpRequest, docIds, {
        tag: 'test-tag',
      })

      return new Promise<void>((resolve) => {
        assertObservable(
          observable,
          () => {
            expect(mockHttpRequest.mock.calls[0][0].tag).toEqual('test-tag')
          },
          resolve,
        )
      })
    })

    test('passes signal option to request', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse(mockDocs))

      const client = getClient()
      const signal = new AbortController().signal
      const observable = dataMethods._getDocuments(client, mockHttpRequest, docIds, {signal})

      return new Promise<void>((resolve) => {
        assertObservable(
          observable,
          () => {
            expect(mockHttpRequest.mock.calls[0][0].signal).toBe(signal)
          },
          resolve,
        )
      })
    })

    test('fetches versioned documents', () => {
      const releaseId = 'someReleaseId'
      const versionIds = docIds.map((id) => `versions.${releaseId}.${id}`)
      const versionDocs = mockDocs.map((doc, i) => ({...doc, _id: versionIds[i]}))

      mockHttpRequest.mockReturnValueOnce(createMockResponse(versionDocs))

      const client = getClient()
      const observable = dataMethods._getDocuments(client, mockHttpRequest, versionIds)

      return new Promise<void>((resolve) => {
        assertObservable<(SanityDocument<any> | null)[]>(
          observable,
          (documents) => {
            expect(documents).toEqual(versionDocs)
            expect(mockHttpRequest.mock.calls[0][0].uri).toEqual(
              `/data/doc/foo/versions.${releaseId}.doc1,versions.${releaseId}.doc2,versions.${releaseId}.doc3`,
            )
          },
          resolve,
        )
      })
    })
  })

  describe('_getReleaseDocuments', () => {
    const mockHttpRequest = vi.fn()
    const releaseId = 'summerRelease'
    const mockDocs = [
      {_id: 'versions.summerRelease.doc1', _type: 'test', title: 'Document 1'},
      {_id: 'versions.summerRelease.doc2', _type: 'test', title: 'Document 2'},
    ]

    beforeEach(() => {
      mockHttpRequest.mockClear()
    })

    test('fetches all documents in a release with correct query', () => {
      mockHttpRequest.mockReturnValueOnce(createMockQueryResponse(mockDocs))

      const client = getClient()
      const observable = dataMethods._getReleaseDocuments(client, mockHttpRequest, releaseId)

      return new Promise<void>((resolve) => {
        assertObservable<RawQueryResponse<SanityDocument<any>[]>>(
          observable,
          (response) => {
            expect(response.result).toEqual(mockDocs)
            expect(mockHttpRequest).toHaveBeenCalledTimes(1)
            expect(mockHttpRequest.mock.calls[0][0].uri).toEqual('/data/query/foo')
            expect(mockHttpRequest.mock.calls[0][0].body).toEqual({
              query: `*[sanity::partOfRelease("${releaseId}")]`,
            })
          },
          resolve,
        )
      })
    })

    test('passes options through to request', () => {
      mockHttpRequest.mockReturnValueOnce(createMockQueryResponse(mockDocs))

      const client = getClient()
      const options = {
        tag: 'release-tag',
        dryRun: true,
        returnDocuments: true,
      }
      const observable = dataMethods._getReleaseDocuments(
        client,
        mockHttpRequest,
        releaseId,
        options,
      )

      return new Promise<void>((resolve) => {
        assertObservable<RawQueryResponse<SanityDocument<any>[]>>(
          observable,
          () => {
            expect(mockHttpRequest).toHaveBeenCalledTimes(1)
            expect(mockHttpRequest.mock.calls[0][0].tag).toEqual('release-tag')
            // Verify the options were passed to the underlying _dataRequest
            expect(mockHttpRequest.mock.calls[0][0].query).toHaveProperty('dryRun', true)
            expect(mockHttpRequest.mock.calls[0][0].query).toHaveProperty('returnDocuments', true)
          },
          resolve,
        )
      })
    })

    test('handles empty response', () => {
      mockHttpRequest.mockReturnValueOnce(createMockQueryResponse([]))

      const client = getClient()
      const observable = dataMethods._getReleaseDocuments(client, mockHttpRequest, releaseId)

      return new Promise<void>((resolve) => {
        assertObservable<RawQueryResponse<SanityDocument<any>[]>>(
          observable,
          (response) => {
            expect(response.result).toEqual([])
          },
          resolve,
        )
      })
    })
  })
})
