import {Observable, of, Subscription} from 'rxjs'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import * as dataMethods from '../src/data/dataMethods'
import type {
  ClientConfig,
  HttpRequest,
  InitializedClientConfig,
  RawQueryResponse,
  SanityDocument,
} from '../src/types'

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

const isEdge = typeof EdgeRuntime === 'string'
const {createClient}: typeof import('../src') = await import(
  isEdge ? '../dist/index.browser.js' : '../src'
)

const getClient = (conf?: ClientConfig) => createClient({...clientConfig, ...(conf || {})})

const createMockResponse = (documents: SanityDocument[]) =>
  of({
    type: 'response',
    body: {documents},
  })

const createMockQueryResponse = <T>(result: T) =>
  of({
    type: 'response',
    body: {result},
  })

type ClientLike = {
  config(): InitializedClientConfig | ClientConfig
}

type MethodOptions = {
  tag?: string
  signal?: AbortSignal
  releaseId?: string
  perspective?: string | string[]
  [key: string]: unknown
}

type DataMethodFn<T = unknown, Args extends readonly unknown[] = readonly unknown[]> = (
  clientObj: ClientLike,
  httpRequest: HttpRequest,
  ...args: [...Args, MethodOptions?]
) => Observable<T>

const assertObservable = <T>(
  observable: Observable<T>,
  assertion: (value: T) => void,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    let hasRun = false
    let subscriptionObj: Subscription | null = null

    const observer = {
      next: (value: T) => {
        if (hasRun) return
        hasRun = true

        try {
          assertion(value)
          if (subscriptionObj) subscriptionObj.unsubscribe()
          resolve()
        } catch (err) {
          if (subscriptionObj) subscriptionObj.unsubscribe()
          reject(err)
        }
      },
      error: (err: Error) => {
        if (hasRun) return
        hasRun = true

        if (subscriptionObj) subscriptionObj.unsubscribe()
        reject(err)
      },
      complete: () => {
        if (hasRun) return
        if (subscriptionObj) subscriptionObj.unsubscribe()
      },
    }

    subscriptionObj = observable.subscribe(observer)
  })
}

const testTagOption = <T = unknown>(
  methodName: string,
  methodFn: (typeof dataMethods)[keyof typeof dataMethods],
  args: readonly unknown[] = [],
) => {
  test('passes tag option to request', () => {
    const mockHttpRequest = vi.fn()
    mockHttpRequest.mockReturnValueOnce(
      methodName.includes('Documents') ? createMockQueryResponse([]) : createMockResponse([]),
    )

    const client = getClient()
    const options = {tag: 'test-tag'}
    const typedMethodFn = methodFn as DataMethodFn<T>
    const observable = typedMethodFn(client, mockHttpRequest, ...args, options)

    return assertObservable(observable, () => {
      expect(mockHttpRequest).toHaveBeenCalledTimes(1)
      expect(mockHttpRequest.mock.calls[0][0].tag).toEqual('test-tag')
    })
  })
}

const testSignalOption = <T = unknown>(
  methodName: string,
  methodFn: (typeof dataMethods)[keyof typeof dataMethods],
  args: readonly unknown[] = [],
) => {
  test('passes signal option to request', () => {
    const mockHttpRequest = vi.fn()
    mockHttpRequest.mockReturnValueOnce(
      methodName.includes('Documents') ? createMockQueryResponse([]) : createMockResponse([]),
    )

    const client = getClient()
    const signal = new AbortController().signal
    const typedMethodFn = methodFn as DataMethodFn<T>
    const observable = typedMethodFn(client, mockHttpRequest, ...args, {signal})

    return assertObservable(observable, () => {
      expect(mockHttpRequest).toHaveBeenCalledTimes(1)
      expect(mockHttpRequest.mock.calls[0][0].signal).toBe(signal)
    })
  })
}

describe('dataMethods', async () => {
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
    const mockDoc = {
      _id: docId,
      _type: 'test',
      title: 'Test Document',
      _rev: '1',
      _createdAt: '2021-01-01',
      _updatedAt: '2021-01-02',
    }

    beforeEach(() => {
      mockHttpRequest.mockClear()
    })

    test('fetches a document by ID', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([mockDoc]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId)

      return assertObservable(observable, (document) => {
        expect(document).toEqual(mockDoc)
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)
        expect(mockHttpRequest.mock.calls[0][0].uri).toEqual(`/data/doc/foo/${docId}`)
      })
    })

    test('returns undefined when document is not found', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId)

      return assertObservable(observable, (document) => {
        expect(document).toBeUndefined()
      })
    })

    testTagOption('_getDocument', dataMethods._getDocument, [docId])
    testSignalOption('_getDocument', dataMethods._getDocument, [docId])

    test('uses version ID when releaseId is provided', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([{...mockDoc, _id: versionId}]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {
        releaseId,
      })

      return assertObservable(observable, () => {
        expect(mockHttpRequest.mock.calls[0][0].uri).toEqual(
          `/data/doc/foo/versions.${releaseId}.${docId}`,
        )
      })
    })

    test('throws error when releaseId is provided with a draft ID', () => {
      const client = getClient()

      expect(() => {
        dataMethods._getDocument(client, mockHttpRequest, draftId, {releaseId})
      }).toThrow(
        'The document ID (`drafts.someDocId`) is a draft, but `options.releaseId` is set as `someReleaseId`',
      )
    })

    test('keeps existing version ID if it matches releaseId', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([{...mockDoc, _id: versionId}]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, versionId, {
        releaseId,
      })

      return assertObservable(observable, () => {
        expect(mockHttpRequest.mock.calls[0][0].uri).toEqual(
          `/data/doc/foo/versions.${releaseId}.${docId}`,
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

    test('passes includeAllVersions option to request query and returns array', () => {
      const multipleVersions = [
        mockDoc,
        {
          ...mockDoc,
          _id: `drafts.${docId}`,
          title: 'Draft Document',
        },
        {
          ...mockDoc,
          _id: `versions.someRelease.${docId}`,
          title: 'Version Document',
        },
      ]
      mockHttpRequest.mockReturnValueOnce(createMockResponse(multipleVersions))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {
        includeAllVersions: true,
      })

      return assertObservable(observable, (documents) => {
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)
        expect(mockHttpRequest.mock.calls[0][0].query).toEqual({includeAllVersions: true})
        expect(Array.isArray(documents)).toBe(true)
        expect(documents).toEqual(multipleVersions)
        expect(documents).toHaveLength(3)
      })
    })

    test('does not add query when includeAllVersions is false and returns single document', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([mockDoc]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {
        includeAllVersions: false,
      })

      return assertObservable(observable, (document) => {
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)
        expect(mockHttpRequest.mock.calls[0][0].query).toEqual({includeAllVersions: false})
        expect(Array.isArray(document)).toBe(false)
        expect(document).toEqual(mockDoc)
      })
    })

    test('does not add query when includeAllVersions is undefined and returns single document', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([mockDoc]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {})

      return assertObservable(observable, (document) => {
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)
        expect(mockHttpRequest.mock.calls[0][0].query).toBeUndefined()
        expect(Array.isArray(document)).toBe(false)
        expect(document).toEqual(mockDoc)
      })
    })

    test('returns empty array when includeAllVersions is true but no documents found', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {
        includeAllVersions: true,
      })

      return assertObservable(observable, (documents) => {
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)
        expect(Array.isArray(documents)).toBe(true)
        expect(documents).toEqual([])
        expect(documents).toHaveLength(0)
      })
    })

    test('returns undefined when includeAllVersions is false and no documents found', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse([]))

      const client = getClient()
      const observable = dataMethods._getDocument(client, mockHttpRequest, docId, {
        includeAllVersions: false,
      })

      return assertObservable(observable, (document) => {
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)
        expect(Array.isArray(document)).toBe(false)
        expect(document).toBeUndefined()
      })
    })
  })

  describe('_getDocuments', () => {
    const mockHttpRequest = vi.fn()
    const docIds = ['doc1', 'doc2', 'doc3']
    const mockDocs = [
      {
        _id: 'doc1',
        _type: 'test',
        title: 'Document 1',
        _rev: '1',
        _createdAt: '2021-01-01',
        _updatedAt: '2021-01-02',
      },
      {
        _id: 'doc2',
        _type: 'test',
        title: 'Document 2',
        _rev: '1',
        _createdAt: '2021-01-01',
        _updatedAt: '2021-01-02',
      },
      {
        _id: 'doc3',
        _type: 'test',
        title: 'Document 3',
        _rev: '1',
        _createdAt: '2021-01-01',
        _updatedAt: '2021-01-02',
      },
    ]

    beforeEach(() => {
      mockHttpRequest.mockClear()
    })

    test('fetches multiple documents by ID', () => {
      mockHttpRequest.mockReturnValueOnce(createMockResponse(mockDocs))

      const client = getClient()
      const observable = dataMethods._getDocuments(client, mockHttpRequest, docIds)

      return assertObservable(observable, (documents) => {
        expect(documents).toEqual(mockDocs)
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)
        expect(mockHttpRequest.mock.calls[0][0].uri).toEqual('/data/doc/foo/doc1,doc2,doc3')
      })
    })

    test('handles missing documents with null values', () => {
      const availableDocs = [mockDocs[0], mockDocs[2]]
      mockHttpRequest.mockReturnValueOnce(createMockResponse(availableDocs))

      const client = getClient()
      const observable = dataMethods._getDocuments(client, mockHttpRequest, docIds)

      return assertObservable(observable, (documents) => {
        expect(documents).toEqual([mockDocs[0], null, mockDocs[2]])
      })
    })

    testTagOption('_getDocuments', dataMethods._getDocuments, [docIds])
    testSignalOption('_getDocuments', dataMethods._getDocuments, [docIds])

    test('fetches versioned documents', () => {
      const releaseId = 'someReleaseId'
      const versionIds = docIds.map((id) => `versions.${releaseId}.${id}`)
      const versionDocs = mockDocs.map((doc, i) => ({...doc, _id: versionIds[i]}))

      mockHttpRequest.mockReturnValueOnce(createMockResponse(versionDocs))

      const client = getClient()
      const observable = dataMethods._getDocuments(client, mockHttpRequest, versionIds)

      return assertObservable(observable, (documents) => {
        expect(documents).toEqual(versionDocs)
        expect(mockHttpRequest.mock.calls[0][0].uri).toEqual(
          `/data/doc/foo/versions.${releaseId}.doc1,versions.${releaseId}.doc2,versions.${releaseId}.doc3`,
        )
      })
    })
  })

  describe('_getReleaseDocuments', () => {
    const mockHttpRequest = vi.fn()
    const releaseId = 'summerRelease'
    const mockDocs = [
      {
        _id: 'versions.summerRelease.doc1',
        _type: 'test',
        title: 'Document 1',
        _rev: '1',
        _createdAt: '2021-01-01',
        _updatedAt: '2021-01-02',
      },
      {
        _id: 'versions.summerRelease.doc2',
        _type: 'test',
        title: 'Document 2',
        _rev: '1',
        _createdAt: '2021-01-01',
        _updatedAt: '2021-01-02',
      },
    ]

    beforeEach(() => {
      mockHttpRequest.mockClear()
    })

    test('fetches all documents in a release with correct query', () => {
      mockHttpRequest.mockReturnValueOnce(createMockQueryResponse(mockDocs))

      const client = getClient()
      const observable = dataMethods._getReleaseDocuments(client, mockHttpRequest, releaseId)

      return assertObservable<RawQueryResponse<SanityDocument[]>>(observable, (response) => {
        expect(response.result).toEqual(mockDocs)
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)

        const request = mockHttpRequest.mock.calls[0][0]
        const uri = decodeURIComponent(request.uri)

        expect(uri).toContain('/data/query/foo')
        expect(uri).toContain('query=*[sanity::partOfRelease($releaseId)]')
        expect(uri).toContain(`$releaseId="${releaseId}"`)
      })
    })

    testTagOption('_getReleaseDocuments', dataMethods._getReleaseDocuments, [releaseId])

    test('handles empty response', () => {
      mockHttpRequest.mockReturnValueOnce(createMockQueryResponse([]))

      const client = getClient()
      const observable = dataMethods._getReleaseDocuments(client, mockHttpRequest, releaseId)

      return assertObservable<RawQueryResponse<SanityDocument[]>>(observable, (response) => {
        expect(response.result).toEqual([])

        const request = mockHttpRequest.mock.calls[0][0]
        const uri = decodeURIComponent(request.uri)

        expect(uri).toContain('query=*[sanity::partOfRelease($releaseId)]')
        expect(uri).toContain(`$releaseId="${releaseId}"`)
      })
    })
  })

  describe('_createVersionFromBase', () => {
    const mockHttpRequest = vi.fn()
    const publishedId = 'pub123'
    const baseId = 'base456'
    const versionId = 'versions.release789.target123'

    beforeEach(() => {
      mockHttpRequest.mockClear()
    })

    test('creates version from base with correct action structure', () => {
      const releaseId = 'release789'

      const expectedAction = {
        actionType: 'sanity.action.document.version.create',
        publishedId,
        baseId,
        versionId: `versions.${releaseId}.${publishedId}`,
      }

      mockHttpRequest.mockReturnValueOnce(
        of({
          type: 'response',
          body: {transactionId: 'abc123'},
        }),
      )

      const client = getClient()
      const observable = dataMethods._createVersionFromBase(
        client,
        mockHttpRequest,
        publishedId,
        baseId,
        releaseId,
      )

      return assertObservable(observable, (result) => {
        expect(result.transactionId).toEqual('abc123')
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)

        const request = mockHttpRequest.mock.calls[0][0]
        expect(request.uri).toEqual('/data/actions/foo')
        expect(request.body).toEqual({
          actions: [expectedAction],
        })
      })
    })

    test('creates version from base with ifBaseRevisionId', () => {
      const ifBaseRevisionId = 'rev456'
      const releaseId = 'release789'

      const expectedAction = {
        actionType: 'sanity.action.document.version.create',
        publishedId,
        baseId,
        versionId: `versions.${releaseId}.${publishedId}`,
        ifBaseRevisionId,
      }

      mockHttpRequest.mockReturnValueOnce(
        of({
          type: 'response',
          body: {transactionId: 'abc123'},
        }),
      )

      const client = getClient()
      const observable = dataMethods._createVersionFromBase(
        client,
        mockHttpRequest,
        publishedId,
        baseId,
        releaseId,
        ifBaseRevisionId,
      )

      return assertObservable(observable, (result) => {
        expect(result.transactionId).toEqual('abc123')
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)

        const request = mockHttpRequest.mock.calls[0][0]
        expect(request.body).toEqual({
          actions: [expectedAction],
        })
      })
    })

    test('creates version from base with options', () => {
      const options = {
        skipCrossDatasetReferenceValidation: true,
        dryRun: true,
      }
      const releaseId = 'release789'

      mockHttpRequest.mockReturnValueOnce(
        of({
          type: 'response',
          body: {transactionId: 'abc123'},
        }),
      )

      const client = getClient()
      const observable = dataMethods._createVersionFromBase(
        client,
        mockHttpRequest,
        publishedId,
        baseId,
        releaseId,
        undefined,
        options,
      )

      return assertObservable(observable, (result) => {
        expect(result.transactionId).toEqual('abc123')
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)

        const request = mockHttpRequest.mock.calls[0][0]
        expect(request.body).toEqual({
          actions: [
            {
              actionType: 'sanity.action.document.version.create',
              publishedId,
              baseId,
              versionId: `versions.${releaseId}.${publishedId}`,
            },
          ],
          skipCrossDatasetReferenceValidation: true,
          dryRun: true,
        })
      })
    })

    test('throws when baseId is missing', () => {
      const client = getClient()

      expect(() => {
        dataMethods._createVersionFromBase(
          client,
          mockHttpRequest,
          publishedId,
          undefined,
          versionId,
        )
      }).toThrow('`createVersion()` requires `baseId` when no `document` is provided')
    })

    test('creates draft version when releaseId is missing', () => {
      const expectedAction = {
        actionType: 'sanity.action.document.version.create',
        publishedId,
        baseId,
        versionId: `drafts.${publishedId}`,
      }

      mockHttpRequest.mockReturnValueOnce(
        of({
          type: 'response',
          body: {transactionId: 'abc123'},
        }),
      )

      const client = getClient()
      const observable = dataMethods._createVersionFromBase(
        client,
        mockHttpRequest,
        publishedId,
        baseId,
        undefined,
      )

      return assertObservable(observable, (result) => {
        expect(result.transactionId).toEqual('abc123')
        expect(mockHttpRequest).toHaveBeenCalledTimes(1)

        const request = mockHttpRequest.mock.calls[0][0]
        expect(request.body).toEqual({
          actions: [expectedAction],
        })
      })
    })

    test('throws when publishedId is missing', () => {
      const client = getClient()

      expect(() => {
        dataMethods._createVersionFromBase(client, mockHttpRequest, undefined, baseId, versionId)
      }).toThrow('`createVersion()` requires `publishedId` when `baseId` is provided')
    })

    test('validates document IDs', () => {
      const client = getClient()

      expect(() => {
        dataMethods._createVersionFromBase(
          client,
          mockHttpRequest,
          'invalid*id',
          baseId,
          'release123',
        )
      }).toThrow(/is not a valid document ID/)

      expect(() => {
        dataMethods._createVersionFromBase(
          client,
          mockHttpRequest,
          publishedId,
          'invalid*id',
          'release123',
        )
      }).toThrow(/is not a valid document ID/)
    })
  })
})
