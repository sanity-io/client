import {createClient} from '@sanity/client'
import nock from 'nock'
import {firstValueFrom, Observable, Subscriber} from 'rxjs'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

import {ObservableReleasesClient, ReleasesClient} from '../src/releases/ReleasesClient'
import type {ObservableSanityClient, SanityClient} from '../src/SanityClient'
import type {
  ApiError,
  ArchiveReleaseAction,
  BaseActionOptions,
  CreateReleaseAction,
  DeleteReleaseAction,
  EditReleaseAction,
  HttpRequest,
  PatchOperations,
  PublishReleaseAction,
  ReleaseAction,
  ReleaseDocument,
  ReleaseType,
  RequestOptions,
  ResponseEvent,
  ScheduleReleaseAction,
  SingleActionResult,
  UnarchiveReleaseAction,
  UnscheduleReleaseAction,
} from '../src/types'
import * as createVersionIdModule from '../src/util/createVersionId'

type MockResponseEvent = Partial<ResponseEvent>

vi.mock('../src/util/createVersionId', () => ({
  generateReleaseId: vi.fn().mockReturnValue('generatedReleaseId'),
}))

const TEST_PROJECT_ID = 'test123'
const TEST_DATASET = 'test-dataset'
const TEST_PROJECT_HOST = `https://${TEST_PROJECT_ID}.api.sanity.io`
const TEST_RELEASE_ID = 'release123'
const TEST_METADATA = {
  releaseType: 'scheduled' as ReleaseType,
  title: 'Test Release',
}
const TEST_PUBLISH_AT = '2023-12-31T12:00:00.000Z'

const TEST_TXN_ID = 'txn123'

const mockHttpSuccess = (httpRequest: ReturnType<typeof vi.fn>, transactionId: string) => {
  httpRequest.mockImplementationOnce(() => ({
    subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
      subscriber.next?.({
        type: 'response',
        body: {transactionId},
      })
      subscriber.complete?.()
      return {unsubscribe: () => {}}
    },
  }))
}

const mockHttpError = (
  httpRequest: ReturnType<typeof vi.fn>,
  errorMessage: string,
  details?: ApiError,
) => {
  httpRequest.mockImplementationOnce(() => ({
    subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
      const error = new Error(errorMessage)
      Object.defineProperty(error, 'details', {value: details})
      subscriber.error?.(error)
      return {unsubscribe: () => {}}
    },
  }))
}

const mockHttpDocumentResponse = (
  httpRequest: ReturnType<typeof vi.fn>,
  document: Partial<ReleaseDocument>,
) => {
  httpRequest.mockImplementationOnce(() => ({
    subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
      subscriber.next?.({
        type: 'response',
        body: {documents: [document]},
      })
      subscriber.complete?.()
      return {unsubscribe: () => {}}
    },
  }))
}

const createTestActionMethod = (httpRequest: ReturnType<typeof vi.fn>) => {
  return <T extends ReleaseAction>(
    methodName: string,
    actionType: T['actionType'],
    executeMethod: (options?: BaseActionOptions) => Promise<SingleActionResult>,
    expectedAction: Omit<T, 'actionType'>,
  ) => {
    test(`${methodName} executes with correct action`, async () => {
      mockHttpSuccess(httpRequest, TEST_TXN_ID)

      const result = await executeMethod()

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual({
        actionType,
        ...expectedAction,
      })

      expect(result).toEqual({
        transactionId: TEST_TXN_ID,
      })
    })

    test(`${methodName} forwards options to action method`, async () => {
      const options = {
        transactionId: 'custom-txn',
        tag: `releases.${methodName}`,
      }

      mockHttpSuccess(httpRequest, 'custom-txn')

      await executeMethod(options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toEqual(options.tag)
      expect(requestArgs.body.transactionId).toEqual(options.transactionId)
    })
  }
}

const httpRequest = vi.fn().mockImplementation(() => ({
  subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
    subscriber.next?.({type: 'response', body: {}})
    subscriber.complete?.()
    return {unsubscribe: () => {}}
  },
}))

const testActionMethod = createTestActionMethod(httpRequest)

describe('ReleasesClient', () => {
  let client: SanityClient
  let releasesClient: ReleasesClient

  beforeEach(() => {
    client = createClient({
      projectId: TEST_PROJECT_ID,
      dataset: TEST_DATASET,
      apiVersion: '1',
      useCdn: false,
    })

    httpRequest.mockClear()

    releasesClient = new ReleasesClient(client, httpRequest)

    nock.disableNetConnect()
    vi.mocked(createVersionIdModule.generateReleaseId).mockReturnValue('generatedReleaseId')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.resetAllMocks()
  })

  describe('get()', () => {
    test('fetches a release document by ID', async () => {
      const releaseDocument: Partial<ReleaseDocument> = {
        _id: `_.releases.${TEST_RELEASE_ID}`,
        _type: 'system.release',
        metadata: TEST_METADATA,
        _rev: '123',
        _createdAt: '2023-01-01T00:00:00.000Z',
        _updatedAt: '2023-01-01T00:00:00.000Z',
      }

      nock(TEST_PROJECT_HOST)
        .get(`/v1/data/doc/${TEST_DATASET}/_.releases.${TEST_RELEASE_ID}`)
        .reply(200, {
          documents: [releaseDocument],
        })

      mockHttpDocumentResponse(httpRequest, releaseDocument as Partial<ReleaseDocument>)

      const result = await releasesClient.get({releaseId: TEST_RELEASE_ID})
      expect(result).toEqual(releaseDocument)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.uri).toEqual(`/data/doc/${TEST_DATASET}/_.releases.${TEST_RELEASE_ID}`)
    })

    test('returns undefined when release does not exist', async () => {
      const releaseId = 'nonexistent'

      nock(TEST_PROJECT_HOST)
        .get(`/v1/data/doc/${TEST_DATASET}/_.releases.${releaseId}`)
        .reply(200, {
          documents: [],
        })

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({type: 'response', body: {documents: []}})
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.get({releaseId})
      expect(result).toBeUndefined()

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.uri).toEqual(`/data/doc/${TEST_DATASET}/_.releases.${releaseId}`)
    })

    test('forwards signal and tag options', async () => {
      const abortController = new AbortController()
      const options = {
        signal: abortController.signal,
        tag: 'releases.get',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({type: 'response', body: {documents: []}})
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.get({releaseId: TEST_RELEASE_ID}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.signal).toEqual(options.signal)
      expect(requestArgs.tag).toEqual(options.tag)
    })
  })

  describe('create()', () => {
    test('creates a release with provided ID and metadata', async () => {
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        title: 'Custom Release',
      }

      const expectedAction = {
        actionType: 'sanity.action.release.create',
        releaseId: TEST_RELEASE_ID,
        metadata,
      }

      mockHttpSuccess(httpRequest, TEST_TXN_ID)

      const result = await releasesClient.create({releaseId: TEST_RELEASE_ID, metadata})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: TEST_RELEASE_ID,
        metadata,
      })
    })

    test('creates a release with undefined metadata', async () => {
      const expectedMetadata = {
        releaseType: 'undecided',
      }

      const expectedAction = {
        actionType: 'sanity.action.release.create',
        releaseId: TEST_RELEASE_ID,
        metadata: expectedMetadata,
      }

      mockHttpSuccess(httpRequest, TEST_TXN_ID)

      const result = await releasesClient.create({releaseId: TEST_RELEASE_ID})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: TEST_RELEASE_ID,
        metadata: expectedMetadata,
      })
    })

    test('creates a release with metadata missing releaseType', async () => {
      const metadata = {
        title: 'Release without type',
      }

      const expectedMetadata = {
        ...metadata,
        releaseType: 'undecided',
      }

      const expectedAction = {
        actionType: 'sanity.action.release.create',
        releaseId: TEST_RELEASE_ID,
        metadata: expectedMetadata,
      }

      mockHttpSuccess(httpRequest, TEST_TXN_ID)

      const result = await releasesClient.create({releaseId: TEST_RELEASE_ID, metadata})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: TEST_RELEASE_ID,
        metadata: expectedMetadata,
      })
    })

    test('generates release ID if not provided', async () => {
      const metadata = {
        releaseType: 'asap' as ReleaseType,
        name: 'Generated ID Release',
      }

      mockHttpSuccess(httpRequest, TEST_TXN_ID)

      const result = await releasesClient.create({metadata})

      expect(vi.mocked(createVersionIdModule.generateReleaseId)).toHaveBeenCalled()

      expect(httpRequest).toHaveBeenCalledTimes(1)

      expect(result).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: 'generatedReleaseId',
        metadata,
      })
    })

    test('forwards options to action method', async () => {
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        title: 'Test Release',
      }

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.create',
      }

      mockHttpSuccess(httpRequest, 'custom-txn')

      await releasesClient.create({releaseId: TEST_RELEASE_ID, metadata}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toEqual(options.tag)
      expect(requestArgs.body.transactionId).toEqual(options.transactionId)
    })

    test('auto-generates both releaseId and metadata.releaseType when neither is provided', async () => {
      mockHttpSuccess(httpRequest, TEST_TXN_ID)

      const result = await releasesClient.create({})

      expect(vi.mocked(createVersionIdModule.generateReleaseId)).toHaveBeenCalled()
      expect(httpRequest).toHaveBeenCalledTimes(1)

      const requestArgs = httpRequest.mock.calls[0][0]
      const action = requestArgs.body.actions[0]

      expect(action.releaseId).toEqual('generatedReleaseId')
      expect(action.metadata.releaseType).toEqual('undecided')

      expect(result).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: 'generatedReleaseId',
        metadata: {
          releaseType: 'undecided',
        },
      })
    })

    test('handles options as the first parameter and auto-generates release data', async () => {
      const options = {
        transactionId: 'options-txn',
        tag: 'releases.create.options',
      }

      mockHttpSuccess(httpRequest, options.transactionId)

      const result = await releasesClient.create(options)

      expect(vi.mocked(createVersionIdModule.generateReleaseId)).toHaveBeenCalled()
      expect(httpRequest).toHaveBeenCalledTimes(1)

      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toEqual(options.tag)
      expect(requestArgs.body.transactionId).toEqual(options.transactionId)

      const action = requestArgs.body.actions[0]
      expect(action.releaseId).toEqual('generatedReleaseId')
      expect(action.metadata.releaseType).toEqual('undecided')

      expect(result).toEqual({
        transactionId: options.transactionId,
        releaseId: 'generatedReleaseId',
        metadata: {
          releaseType: 'undecided',
        },
      })
    })
  })

  describe('edit()', () => {
    const patch: PatchOperations = {set: {title: 'New Title'}}

    testActionMethod<EditReleaseAction>(
      'edit',
      'sanity.action.release.edit',
      (options) => releasesClient.edit({releaseId: TEST_RELEASE_ID, patch}, options),
      {releaseId: TEST_RELEASE_ID, patch},
    )
  })

  describe('publish()', () => {
    testActionMethod<PublishReleaseAction>(
      'publish',
      'sanity.action.release.publish',
      (options) => releasesClient.publish({releaseId: TEST_RELEASE_ID}, options),
      {releaseId: TEST_RELEASE_ID},
    )
  })

  describe('archive()', () => {
    testActionMethod<ArchiveReleaseAction>(
      'archive',
      'sanity.action.release.archive',
      (options) => releasesClient.archive({releaseId: TEST_RELEASE_ID}, options),
      {releaseId: TEST_RELEASE_ID},
    )
  })

  describe('unarchive()', () => {
    testActionMethod<UnarchiveReleaseAction>(
      'unarchive',
      'sanity.action.release.unarchive',
      (options) => releasesClient.unarchive({releaseId: TEST_RELEASE_ID}, options),
      {releaseId: TEST_RELEASE_ID},
    )
  })

  describe('schedule()', () => {
    testActionMethod<ScheduleReleaseAction>(
      'schedule',
      'sanity.action.release.schedule',
      (options) =>
        releasesClient.schedule({releaseId: TEST_RELEASE_ID, publishAt: TEST_PUBLISH_AT}, options),
      {releaseId: TEST_RELEASE_ID, publishAt: TEST_PUBLISH_AT},
    )
  })

  describe('unschedule()', () => {
    testActionMethod<UnscheduleReleaseAction>(
      'unschedule',
      'sanity.action.release.unschedule',
      (options) => releasesClient.unschedule({releaseId: TEST_RELEASE_ID}, options),
      {releaseId: TEST_RELEASE_ID},
    )
  })

  describe('delete()', () => {
    testActionMethod<DeleteReleaseAction>(
      'delete',
      'sanity.action.release.delete',
      (options) => releasesClient.delete({releaseId: TEST_RELEASE_ID}, options),
      {releaseId: TEST_RELEASE_ID},
    )
  })

  describe('getDocuments()', () => {
    test('retrieves documents for a release by ID', async () => {
      const documents = [
        {_id: 'doc1', _type: 'post', title: 'Document 1'},
        {_id: 'doc2', _type: 'post', title: 'Document 2'},
      ]

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({type: 'response', body: {result: documents}})
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.getDocuments({releaseId: TEST_RELEASE_ID})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(decodeURIComponent(requestArgs.uri)).toEqual(
        '/data/query/test-dataset?query=*[sanity::partOfRelease($releaseId)]&$releaseId="release123"',
      )

      expect(result).toEqual({result: documents})
    })

    test('forwards options to underlying method', async () => {
      const options = {
        tag: 'releases.documents',
        signal: new AbortController().signal,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({type: 'response', body: {result: []}})
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.getDocuments({releaseId: TEST_RELEASE_ID}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toEqual(options.tag)
      expect(requestArgs.signal).toEqual(options.signal)
    })
  })

  describe('error handling', () => {
    test('propagates server errors when getting a release', async () => {
      mockHttpError(httpRequest, 'Server error')
      await expect(releasesClient.get({releaseId: TEST_RELEASE_ID})).rejects.toThrow('Server error')
    })

    test('propagates HTTP errors when creating a release', async () => {
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        title: 'Custom Release',
      }
      mockHttpError(httpRequest, 'Network error')
      await expect(releasesClient.create({releaseId: TEST_RELEASE_ID, metadata})).rejects.toThrow(
        'Network error',
      )
    })

    test('propagates error responses with error details', async () => {
      const patch = {
        set: {
          'metadata.title': 'Updated Release Name',
        },
      }
      const errorResponse: ApiError = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid patch operation',
      }
      mockHttpError(httpRequest, 'Invalid patch operation', errorResponse)
      await expect(releasesClient.edit({releaseId: TEST_RELEASE_ID, patch})).rejects.toMatchObject({
        message: expect.stringContaining('Invalid patch operation'),
        details: expect.objectContaining(errorResponse),
      })
    })

    test('propagates validation errors when publishing a release', async () => {
      const validationError = new Error('Release not found')
      validationError.name = 'ValidationError'

      httpRequest
        .mockImplementationOnce(() => ({
          subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
            if (subscriber.error) subscriber.error(validationError)
            return {unsubscribe: () => {}}
          },
        }))
        .mockImplementationOnce(() => ({
          subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
            if (subscriber.error) subscriber.error(validationError)
            return {unsubscribe: () => {}}
          },
        }))

      await expect(releasesClient.publish({releaseId: TEST_RELEASE_ID})).rejects.toThrow(
        'Release not found',
      )
      await expect(releasesClient.publish({releaseId: TEST_RELEASE_ID})).rejects.toHaveProperty(
        'name',
        'ValidationError',
      )
    })

    test('handles timeout errors', async () => {
      const timeoutError = new Error('Request timed out')
      timeoutError.name = 'TimeoutError'

      httpRequest
        .mockImplementationOnce(() => ({
          subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
            if (subscriber.error) subscriber.error(timeoutError)
            return {unsubscribe: () => {}}
          },
        }))
        .mockImplementationOnce(() => ({
          subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
            if (subscriber.error) subscriber.error(timeoutError)
            return {unsubscribe: () => {}}
          },
        }))

      await expect(releasesClient.archive({releaseId: TEST_RELEASE_ID})).rejects.toThrow(
        'Request timed out',
      )
      await expect(releasesClient.archive({releaseId: TEST_RELEASE_ID})).rejects.toHaveProperty(
        'name',
        'TimeoutError',
      )
    })

    test('handles aborted requests', async () => {
      const abortError = new Error('Request aborted')
      abortError.name = 'AbortError'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          if (subscriber.error) subscriber.error(abortError)
          return {unsubscribe: () => {}}
        },
      }))

      const abortController = new AbortController()
      const promise = releasesClient.unarchive(
        {releaseId: TEST_RELEASE_ID},
        {signal: abortController.signal},
      )

      await expect(promise).rejects.toThrow('Request aborted')
      await expect(promise).rejects.toHaveProperty('name', 'AbortError')
    })
  })
})

describe('ObservableReleasesClient', () => {
  let client: SanityClient
  let observableHttpRequest: ReturnType<typeof vi.fn>
  let observableReleasesClient: ObservableReleasesClient

  beforeEach(() => {
    client = createClient({
      projectId: TEST_PROJECT_ID,
      dataset: TEST_DATASET,
      apiVersion: '1',
      useCdn: false,
    })

    observableHttpRequest = vi.fn().mockImplementation(() => ({
      subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
        subscriber.next?.({type: 'response', body: {}})
        subscriber.complete?.()
        return {unsubscribe: () => {}}
      },
    }))

    observableReleasesClient = new ObservableReleasesClient(
      client.observable as ObservableSanityClient,
      observableHttpRequest as HttpRequest,
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const testObservableMethodForClient = (
    methodName: keyof ObservableReleasesClient,
    executeMethod: () => Observable<SingleActionResult>,
  ) => {
    test(`returns an observable for ${methodName} action`, async () => {
      mockHttpSuccess(observableHttpRequest, TEST_TXN_ID)

      const result = executeMethod()
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({transactionId: TEST_TXN_ID})
    })
  }

  describe('get()', () => {
    test('returns an observable for a release document', async () => {
      const releaseDocument: Partial<ReleaseDocument> = {
        _id: `_.releases.${TEST_RELEASE_ID}`,
        _type: 'system.release',
        metadata: {
          releaseType: 'scheduled' as ReleaseType,
          title: 'Test Release',
        },
      }

      observableHttpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({
            type: 'response',
            body: {documents: [releaseDocument]},
          })
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.get({releaseId: TEST_RELEASE_ID})

      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual(releaseDocument)
    })
  })

  describe('create()', () => {
    test('returns an observable for create action with provided ID', async () => {
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        title: 'Custom Release',
      }

      observableHttpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({
            type: 'response',
            body: {transactionId: TEST_TXN_ID},
          })
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create({releaseId: TEST_RELEASE_ID, metadata})

      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: TEST_RELEASE_ID,
        metadata,
      })
    })

    test('returns an observable for create action with undefined metadata', async () => {
      const expectedMetadata = {
        releaseType: 'undecided',
      }

      observableHttpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({
            type: 'response',
            body: {transactionId: TEST_TXN_ID},
          })
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create({releaseId: TEST_RELEASE_ID})

      expect(result).toBeDefined()
      const response = await firstValueFrom(result)
      expect(response).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: TEST_RELEASE_ID,
        metadata: expectedMetadata,
      })
    })

    test('returns an observable for create action with metadata missing releaseType', async () => {
      const metadata = {
        title: 'Release without type',
      }

      const expectedMetadata = {
        ...metadata,
        releaseType: 'undecided',
      }

      observableHttpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({
            type: 'response',
            body: {transactionId: TEST_TXN_ID},
          })
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create({releaseId: TEST_RELEASE_ID, metadata})

      expect(result).toBeDefined()
      const response = await firstValueFrom(result)
      expect(response).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: TEST_RELEASE_ID,
        metadata: expectedMetadata,
      })
    })

    test('generates release ID if not provided', async () => {
      const metadata = {
        releaseType: 'asap' as ReleaseType,
        name: 'Generated ID Release',
      }

      vi.mocked(createVersionIdModule.generateReleaseId).mockClear()
      vi.mocked(createVersionIdModule.generateReleaseId).mockReturnValue('generatedReleaseId')

      observableHttpRequest.mockImplementationOnce((options: RequestOptions) => {
        const action = (options.body as {actions: CreateReleaseAction[]}).actions[0]
        action.releaseId = 'generatedReleaseId'

        return {
          subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
            subscriber.next?.({
              type: 'response',
              body: {
                transactionId: TEST_TXN_ID,
                releaseId: 'generatedReleaseId',
                metadata,
              },
            })
            subscriber.complete?.()
            return {unsubscribe: () => {}}
          },
        }
      })

      const result = observableReleasesClient.create({metadata})

      expect(vi.mocked(createVersionIdModule.generateReleaseId)).toHaveBeenCalled()

      const response = await firstValueFrom(result)
      expect(response.transactionId).toEqual(TEST_TXN_ID)
      expect(response.releaseId).toEqual('generatedReleaseId')
      expect(response.metadata).toEqual(metadata)
    })

    test('auto-generates both releaseId and metadata.releaseType when neither is provided', async () => {
      vi.mocked(createVersionIdModule.generateReleaseId).mockClear()
      vi.mocked(createVersionIdModule.generateReleaseId).mockReturnValue('generatedReleaseId')

      observableHttpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({
            type: 'response',
            body: {transactionId: TEST_TXN_ID},
          })
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create({})
      const response = await firstValueFrom(result)

      expect(vi.mocked(createVersionIdModule.generateReleaseId)).toHaveBeenCalled()
      expect(observableHttpRequest).toHaveBeenCalledTimes(1)

      const requestArgs = observableHttpRequest.mock.calls[0][0]
      const action = requestArgs.body.actions[0]

      expect(action.releaseId).toEqual('generatedReleaseId')
      expect(action.metadata.releaseType).toEqual('undecided')

      expect(response).toEqual({
        transactionId: TEST_TXN_ID,
        releaseId: 'generatedReleaseId',
        metadata: {
          releaseType: 'undecided',
        },
      })
    })

    test('handles options as the first parameter and auto-generates release data', async () => {
      vi.mocked(createVersionIdModule.generateReleaseId).mockClear()
      vi.mocked(createVersionIdModule.generateReleaseId).mockReturnValue('generatedReleaseId')

      const options = {
        transactionId: 'options-txn',
        tag: 'releases.create.options',
      }

      observableHttpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({
            type: 'response',
            body: {transactionId: options.transactionId},
          })
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create(options)
      const response = await firstValueFrom(result)

      expect(vi.mocked(createVersionIdModule.generateReleaseId)).toHaveBeenCalled()
      expect(observableHttpRequest).toHaveBeenCalledTimes(1)

      const requestArgs = observableHttpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toEqual(options.tag)
      expect(requestArgs.body.transactionId).toEqual(options.transactionId)

      const action = requestArgs.body.actions[0]
      expect(action.releaseId).toEqual('generatedReleaseId')
      expect(action.metadata.releaseType).toEqual('undecided')

      expect(response).toEqual({
        transactionId: options.transactionId,
        releaseId: 'generatedReleaseId',
        metadata: {
          releaseType: 'undecided',
        },
      })
    })
  })

  describe('edit()', () => {
    const patch: PatchOperations = {set: {title: 'New Title'}}

    testObservableMethodForClient('edit', () =>
      observableReleasesClient.edit({releaseId: TEST_RELEASE_ID, patch}),
    )
  })

  describe('publish()', () => {
    testObservableMethodForClient('publish', () =>
      observableReleasesClient.publish({releaseId: TEST_RELEASE_ID}),
    )
  })

  describe('archive()', () => {
    testObservableMethodForClient('archive', () =>
      observableReleasesClient.archive({releaseId: TEST_RELEASE_ID}),
    )
  })

  describe('unarchive()', () => {
    testObservableMethodForClient('unarchive', () =>
      observableReleasesClient.unarchive({releaseId: TEST_RELEASE_ID}),
    )
  })

  describe('schedule()', () => {
    testObservableMethodForClient('schedule', () =>
      observableReleasesClient.schedule({releaseId: TEST_RELEASE_ID, publishAt: TEST_PUBLISH_AT}),
    )
  })

  describe('unschedule()', () => {
    testObservableMethodForClient('unschedule', () =>
      observableReleasesClient.unschedule({releaseId: TEST_RELEASE_ID}),
    )
  })

  describe('delete()', () => {
    testObservableMethodForClient('delete', () =>
      observableReleasesClient.delete({releaseId: TEST_RELEASE_ID}),
    )
  })

  describe('getDocuments()', () => {
    test('returns an observable for getDocuments action', async () => {
      const documents = [
        {_id: 'doc1', _type: 'post', title: 'Document 1'},
        {_id: 'doc2', _type: 'post', title: 'Document 2'},
      ]

      observableHttpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          subscriber.next?.({type: 'response', body: {result: documents}})
          subscriber.complete?.()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.getDocuments({releaseId: TEST_RELEASE_ID})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({result: documents})
    })
  })

  describe('error handling', () => {
    test('emits errors when getting a release', async () => {
      mockHttpError(observableHttpRequest, 'Server error')
      const result = observableReleasesClient.get({releaseId: TEST_RELEASE_ID})
      await expect(firstValueFrom(result)).rejects.toThrow('Server error')
    })

    test('emits errors when creating a release', async () => {
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        title: 'Custom Release',
      }
      mockHttpError(observableHttpRequest, 'Network error')
      const result = observableReleasesClient.create({releaseId: TEST_RELEASE_ID, metadata})
      await expect(firstValueFrom(result)).rejects.toThrow('Network error')
    })

    test('emits error responses with detailed error information', async () => {
      const patch = {
        set: {
          'metadata.title': 'Updated Release Name',
        },
      }
      const errorResponse: ApiError = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid patch operation',
      }
      mockHttpError(observableHttpRequest, 'Invalid patch operation', errorResponse)
      const result = observableReleasesClient.edit({releaseId: TEST_RELEASE_ID, patch})
      await expect(firstValueFrom(result)).rejects.toMatchObject({
        message: expect.stringContaining('Invalid patch operation'),
        details: expect.objectContaining(errorResponse),
      })
    })

    test('properly cleans up subscriptions when errors occur', async () => {
      const unsubscribeSpy = vi.fn()

      observableHttpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: Subscriber<MockResponseEvent>) => {
          if (subscriber.error) subscriber.error(new Error('Server error'))
          return {unsubscribe: unsubscribeSpy}
        },
      }))

      const result = observableReleasesClient.get({releaseId: TEST_RELEASE_ID})
      await expect(firstValueFrom(result)).rejects.toThrow('Server error')
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unsubscribeSpy).toHaveBeenCalled()
    })
  })
})
