import {createClient} from '@sanity/client'
import nock from 'nock'
import {firstValueFrom} from 'rxjs'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

import {ObservableReleasesClient, ReleasesClient} from '../src/releases/ReleasesClient'
import type {ReleaseType} from '../src/types'
import * as createVersionIdModule from '../src/util/createVersionId'

vi.mock('../src/util/createVersionId', () => ({
  generateReleaseId: vi.fn().mockReturnValue('generatedReleaseId'),
}))

describe('ReleasesClient', () => {
  const projectId = 'test123'
  const dataset = 'test-dataset'
  const projectHost = `https://${projectId}.api.sanity.io`

  let client: any
  let releasesClient: ReleasesClient
  let httpRequest: any

  beforeEach(() => {
    client = createClient({
      projectId,
      dataset,
      apiVersion: '1',
      useCdn: false,
    })

    httpRequest = vi.fn().mockImplementation(() => ({
      subscribe: (subscriber: any) => {
        subscriber.next({type: 'response', body: {}})
        subscriber.complete()
        return {unsubscribe: () => {}}
      },
    }))

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
      const releaseId = 'release123'
      const releaseDocument = {
        _id: `_.releases.${releaseId}`,
        _type: 'release',
        metadata: {
          releaseType: 'scheduled' as ReleaseType,
          name: 'Test Release',
        },
      }

      nock(projectHost)
        .get(`/v1/data/doc/${dataset}/_.releases.${releaseId}`)
        .reply(200, {
          documents: [releaseDocument],
        })

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {documents: [releaseDocument]}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.get({releaseId})
      expect(result).toEqual(releaseDocument)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.uri).toBe(`/data/doc/${dataset}/_.releases.${releaseId}`)
    })

    test('returns undefined when release does not exist', async () => {
      const releaseId = 'nonexistent'

      nock(projectHost).get(`/v1/data/doc/${dataset}/_.releases.${releaseId}`).reply(200, {
        documents: [],
      })

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {documents: []}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.get({releaseId})
      expect(result).toBeUndefined()

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.uri).toBe(`/data/doc/${dataset}/_.releases.${releaseId}`)
    })

    test('forwards signal and tag options', async () => {
      const releaseId = 'release123'
      const abortController = new AbortController()
      const options = {
        signal: abortController.signal,
        tag: 'releases.get',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {documents: []}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.get({releaseId}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.signal).toBe(options.signal)
      expect(requestArgs.tag).toBe(options.tag)
    })
  })

  describe('create()', () => {
    test('creates a release with provided ID and metadata', async () => {
      const releaseId = 'release456'
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        name: 'Custom Release',
      }

      const expectedAction = {
        actionType: 'sanity.action.release.create',
        releaseId,
        metadata,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.create({releaseId, metadata})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
        releaseId: 'release456',
        metadata,
      })
    })

    test('creates a release with undefined metadata', async () => {
      const releaseId = 'release789'
      const expectedMetadata = {
        releaseType: 'undecided',
      }

      const expectedAction = {
        actionType: 'sanity.action.release.create',
        releaseId,
        metadata: expectedMetadata,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.create({releaseId})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
        releaseId: 'release789',
        metadata: expectedMetadata,
      })
    })

    test('creates a release with metadata missing releaseType', async () => {
      const releaseId = 'release101'
      const metadata = {
        title: 'Release without type',
      }

      const expectedMetadata = {
        ...metadata,
        releaseType: 'undecided',
      }

      const expectedAction = {
        actionType: 'sanity.action.release.create',
        releaseId,
        metadata: expectedMetadata,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.create({releaseId, metadata})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
        releaseId: 'release101',
        metadata: expectedMetadata,
      })
    })

    test('generates release ID if not provided', async () => {
      const metadata = {
        releaseType: 'asap' as ReleaseType,
        name: 'Generated ID Release',
      }

      httpRequest.mockImplementationOnce((options: any) => {
        const action = options.body.actions[0]
        action.releaseId = 'generatedReleaseId'

        return {
          subscribe: (subscriber: any) => {
            subscriber.next({
              type: 'response',
              body: {transactionId: 'txn123'},
            })
            subscriber.complete()
            return {unsubscribe: () => {}}
          },
        }
      })

      const result = await releasesClient.create({metadata})

      expect(vi.mocked(createVersionIdModule.generateReleaseId)).toHaveBeenCalled()

      expect(httpRequest).toHaveBeenCalledTimes(1)

      expect(result).toEqual({
        transactionId: 'txn123',
        releaseId: 'generatedReleaseId',
        metadata,
      })
    })

    test('forwards options to action method', async () => {
      const releaseId = 'release123'
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        name: 'Test Release',
      }

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.create',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'custom-txn'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.create({releaseId, metadata}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.body.transactionId).toBe(options.transactionId)
    })
  })

  describe('edit()', () => {
    test('edits a release with patch operations', async () => {
      const releaseId = 'release123'
      const patch = {
        set: {
          'metadata.name': 'Updated Release Name',
        },
      }

      const expectedAction = {
        actionType: 'sanity.action.release.edit',
        releaseId,
        patch,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.edit({releaseId, patch})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({transactionId: 'txn123'})
    })

    test('forwards options to action method', async () => {
      const releaseId = 'release123'
      const patch = {
        set: {
          'metadata.name': 'Updated Release Name',
        },
      }

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.edit',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'custom-txn'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.edit({releaseId, patch}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.body.transactionId).toBe(options.transactionId)
    })
  })

  describe('publish()', () => {
    test('publishes a release by ID', async () => {
      const releaseId = 'release123'

      const expectedAction = {
        actionType: 'sanity.action.release.publish',
        releaseId,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.publish({releaseId})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
      })
    })

    test('forwards options to action method', async () => {
      const releaseId = 'release123'

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.publish',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'custom-txn'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.publish({releaseId}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.body.transactionId).toBe(options.transactionId)
    })
  })

  describe('archive()', () => {
    test('archives a release by ID', async () => {
      const releaseId = 'release123'

      const expectedAction = {
        actionType: 'sanity.action.release.archive',
        releaseId,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.archive({releaseId})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
      })
    })

    test('forwards options to action method', async () => {
      const releaseId = 'release123'

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.archive',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'custom-txn'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.archive({releaseId}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.body.transactionId).toBe(options.transactionId)
    })
  })

  describe('unarchive()', () => {
    test('unarchives a release by ID', async () => {
      const releaseId = 'release123'

      const expectedAction = {
        actionType: 'sanity.action.release.unarchive',
        releaseId,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.unarchive({releaseId})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
      })
    })

    test('forwards options to action method', async () => {
      const releaseId = 'release123'

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.unarchive',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'custom-txn'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.unarchive({releaseId}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.body.transactionId).toBe(options.transactionId)
    })
  })

  describe('schedule()', () => {
    test('schedules a release by ID and publishAt time', async () => {
      const releaseId = 'release123'
      const publishAt = '2023-12-31T12:00:00.000Z'

      const expectedAction = {
        actionType: 'sanity.action.release.schedule',
        releaseId,
        publishAt,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.schedule({releaseId, publishAt})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
      })
    })

    test('forwards options to action method', async () => {
      const releaseId = 'release123'
      const publishAt = '2023-12-31T12:00:00.000Z'

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.schedule',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'custom-txn'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.schedule({releaseId, publishAt}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.body.transactionId).toBe(options.transactionId)
    })
  })

  describe('unschedule()', () => {
    test('unschedules a release by ID', async () => {
      const releaseId = 'release123'

      const expectedAction = {
        actionType: 'sanity.action.release.unschedule',
        releaseId,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.unschedule({releaseId})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
      })
    })

    test('forwards options to action method', async () => {
      const releaseId = 'release123'

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.unschedule',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'custom-txn'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.unschedule({releaseId}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.body.transactionId).toBe(options.transactionId)
    })
  })

  describe('delete()', () => {
    test('deletes a release by ID', async () => {
      const releaseId = 'release123'

      const expectedAction = {
        actionType: 'sanity.action.release.delete',
        releaseId,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.delete({releaseId})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.body.actions).toContainEqual(expectedAction)

      expect(result).toEqual({
        transactionId: 'txn123',
      })
    })

    test('forwards options to action method', async () => {
      const releaseId = 'release123'

      const options = {
        transactionId: 'custom-txn',
        tag: 'releases.delete',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'custom-txn'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.delete({releaseId}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.body.transactionId).toBe(options.transactionId)
    })
  })

  describe('getDocuments()', () => {
    test('retrieves documents for a release by ID', async () => {
      const releaseId = 'release123'
      const documents = [
        {_id: 'doc1', _type: 'post', title: 'Document 1'},
        {_id: 'doc2', _type: 'post', title: 'Document 2'},
      ]

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {result: documents}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = await releasesClient.getDocuments({releaseId})

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.uri).toContain(`/data/query/${dataset}`)
      expect(requestArgs.uri).toContain(`versions.${releaseId}`)

      expect(result).toEqual({result: documents})
    })

    test('forwards options to underlying method', async () => {
      const releaseId = 'release123'
      const options = {
        tag: 'releases.documents',
        signal: new AbortController().signal,
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {result: []}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      await releasesClient.getDocuments({releaseId}, options)

      expect(httpRequest).toHaveBeenCalledTimes(1)
      const requestArgs = httpRequest.mock.calls[0][0]
      expect(requestArgs.tag).toBe(options.tag)
      expect(requestArgs.signal).toBe(options.signal)
    })
  })

  describe('error handling', () => {
    test('propagates server errors when getting a release', async () => {
      const releaseId = 'release123'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.error(new Error('Server error'))
          return {unsubscribe: () => {}}
        },
      }))

      await expect(releasesClient.get({releaseId})).rejects.toThrow('Server error')
    })

    test('propagates HTTP errors when creating a release', async () => {
      const releaseId = 'release456'
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        name: 'Custom Release',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.error(new Error('Network error'))
          return {unsubscribe: () => {}}
        },
      }))

      await expect(releasesClient.create({releaseId, metadata})).rejects.toThrow('Network error')
    })

    test('propagates error responses with error details', async () => {
      const releaseId = 'release123'
      const patch = {
        set: {
          'metadata.name': 'Updated Release Name',
        },
      }

      const errorResponse = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid patch operation',
      }

      const customError = new Error('Invalid patch operation') as any
      customError.details = errorResponse

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.error(customError)
          return {unsubscribe: () => {}}
        },
      }))

      await expect(releasesClient.edit({releaseId, patch})).rejects.toMatchObject({
        message: expect.stringContaining('Invalid patch operation'),
        details: expect.objectContaining(errorResponse),
      })
    })

    test('propagates validation errors when publishing a release', async () => {
      const releaseId = 'release123'

      const validationError = new Error('Release not found')
      validationError.name = 'ValidationError'

      httpRequest
        .mockImplementationOnce(() => ({
          subscribe: (subscriber: any) => {
            subscriber.error(validationError)
            return {unsubscribe: () => {}}
          },
        }))
        .mockImplementationOnce(() => ({
          subscribe: (subscriber: any) => {
            subscriber.error(validationError)
            return {unsubscribe: () => {}}
          },
        }))

      await expect(releasesClient.publish({releaseId})).rejects.toThrow('Release not found')
      await expect(releasesClient.publish({releaseId})).rejects.toHaveProperty(
        'name',
        'ValidationError',
      )
    })

    test('handles timeout errors', async () => {
      const releaseId = 'release123'

      const timeoutError = new Error('Request timed out')
      timeoutError.name = 'TimeoutError'

      // Create a separate mock for each call
      httpRequest
        .mockImplementationOnce(() => ({
          subscribe: (subscriber: any) => {
            subscriber.error(timeoutError)
            return {unsubscribe: () => {}}
          },
        }))
        .mockImplementationOnce(() => ({
          subscribe: (subscriber: any) => {
            subscriber.error(timeoutError)
            return {unsubscribe: () => {}}
          },
        }))

      await expect(releasesClient.archive({releaseId})).rejects.toThrow('Request timed out')
      await expect(releasesClient.archive({releaseId})).rejects.toHaveProperty(
        'name',
        'TimeoutError',
      )
    })

    test('handles aborted requests', async () => {
      const releaseId = 'release123'

      const abortError = new Error('Request aborted')
      abortError.name = 'AbortError'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.error(abortError)
          return {unsubscribe: () => {}}
        },
      }))

      const abortController = new AbortController()
      const promise = releasesClient.unarchive({releaseId}, {signal: abortController.signal})

      await expect(promise).rejects.toThrow('Request aborted')
      await expect(promise).rejects.toHaveProperty('name', 'AbortError')
    })
  })
})

describe('ObservableReleasesClient', () => {
  const projectId = 'test123'
  const dataset = 'test-dataset'

  let client: any
  let observableReleasesClient: ObservableReleasesClient
  let httpRequest: any

  beforeEach(() => {
    client = {
      config: () => ({
        projectId,
        dataset,
      }),
    }

    httpRequest = vi.fn().mockImplementation(() => ({
      subscribe: (subscriber: any) => {
        subscriber.next({type: 'response', body: {}})
        subscriber.complete()
        return {unsubscribe: () => {}}
      },
    }))

    observableReleasesClient = new ObservableReleasesClient(client, httpRequest)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('get()', () => {
    test('returns an observable for a release document', async () => {
      const releaseId = 'release123'
      const releaseDocument = {
        _id: `_.releases.${releaseId}`,
        _type: 'release',
        metadata: {
          releaseType: 'scheduled' as ReleaseType,
          name: 'Test Release',
        },
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {documents: [releaseDocument]}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.get({releaseId})

      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual(releaseDocument)
    })
  })

  describe('create()', () => {
    test('returns an observable for create action with provided ID', async () => {
      const releaseId = 'release456'
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        name: 'Custom Release',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({
            type: 'response',
            body: {transactionId: 'txn123'},
          })
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create({releaseId, metadata})

      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({
        transactionId: 'txn123',
        releaseId: 'release456',
        metadata,
      })
    })

    test('returns an observable for create action with undefined metadata', async () => {
      const releaseId = 'release789'
      const expectedMetadata = {
        releaseType: 'undecided',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({
            type: 'response',
            body: {transactionId: 'txn123'},
          })
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create({releaseId})

      expect(result).toBeDefined()
      const response = await firstValueFrom(result)
      expect(response).toEqual({
        transactionId: 'txn123',
        releaseId: 'release789',
        metadata: expectedMetadata,
      })
    })

    test('returns an observable for create action with metadata missing releaseType', async () => {
      const releaseId = 'release101'
      const metadata = {
        title: 'Release without type',
      }

      const expectedMetadata = {
        ...metadata,
        releaseType: 'undecided',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({
            type: 'response',
            body: {transactionId: 'txn123'},
          })
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create({releaseId, metadata})

      expect(result).toBeDefined()
      const response = await firstValueFrom(result)
      expect(response).toEqual({
        transactionId: 'txn123',
        releaseId: 'release101',
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

      httpRequest.mockImplementationOnce((options: any) => {
        const action = options.body.actions[0]
        action.releaseId = 'generatedReleaseId'

        return {
          subscribe: (subscriber: any) => {
            subscriber.next({
              type: 'response',
              body: {
                transactionId: 'txn123',
                releaseId: 'generatedReleaseId',
                metadata,
              },
            })
            subscriber.complete()
            return {unsubscribe: () => {}}
          },
        }
      })

      const result = observableReleasesClient.create({metadata})

      expect(vi.mocked(createVersionIdModule.generateReleaseId)).toHaveBeenCalled()

      const response = await firstValueFrom(result)
      expect(response.transactionId).toEqual('txn123')
      expect(response.releaseId).toEqual('generatedReleaseId')
      expect(response.metadata).toEqual(metadata)
    })
  })

  describe('edit()', () => {
    test('returns an observable for edit action', async () => {
      const releaseId = 'release123'
      const patch = {set: {name: 'Updated'}}

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.edit({releaseId, patch})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({transactionId: 'txn123'})
    })
  })

  describe('publish()', () => {
    test('returns an observable for publish action', async () => {
      const releaseId = 'release123'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.publish({releaseId})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({transactionId: 'txn123'})
    })
  })

  describe('archive()', () => {
    test('returns an observable for archive action', async () => {
      const releaseId = 'release123'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.archive({releaseId})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({transactionId: 'txn123'})
    })
  })

  describe('unarchive()', () => {
    test('returns an observable for unarchive action', async () => {
      const releaseId = 'release123'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.unarchive({releaseId})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({transactionId: 'txn123'})
    })
  })

  describe('schedule()', () => {
    test('returns an observable for schedule action', async () => {
      const releaseId = 'release123'
      const publishAt = '2023-12-31T12:00:00.000Z'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.schedule({releaseId, publishAt})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({transactionId: 'txn123'})
    })
  })

  describe('unschedule()', () => {
    test('returns an observable for unschedule action', async () => {
      const releaseId = 'release123'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.unschedule({releaseId})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({transactionId: 'txn123'})
    })
  })

  describe('delete()', () => {
    test('returns an observable for delete action', async () => {
      const releaseId = 'release123'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {transactionId: 'txn123'}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.delete({releaseId})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({transactionId: 'txn123'})
    })
  })

  describe('getDocuments()', () => {
    test('returns an observable for getDocuments action', async () => {
      const releaseId = 'release123'
      const documents = [
        {_id: 'doc1', _type: 'post', title: 'Document 1'},
        {_id: 'doc2', _type: 'post', title: 'Document 2'},
      ]

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.next({type: 'response', body: {result: documents}})
          subscriber.complete()
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.getDocuments({releaseId})
      expect(result).toBeDefined()
      expect(await firstValueFrom(result)).toEqual({result: documents})
    })
  })

  describe('error handling', () => {
    test('emits errors when getting a release', async () => {
      const releaseId = 'release123'

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.error(new Error('Server error'))
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.get({releaseId})

      await expect(firstValueFrom(result)).rejects.toThrow('Server error')
    })

    test('emits errors when creating a release', async () => {
      const releaseId = 'release456'
      const metadata = {
        releaseType: 'scheduled' as ReleaseType,
        name: 'Custom Release',
      }

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.error(new Error('Network error'))
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.create({releaseId, metadata})

      await expect(firstValueFrom(result)).rejects.toThrow('Network error')
    })

    test('emits error responses with detailed error information', async () => {
      const releaseId = 'release123'
      const patch = {
        set: {
          'metadata.name': 'Updated Release Name',
        },
      }

      const errorResponse = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid patch operation',
      }

      const customError = new Error('Invalid patch operation') as any
      customError.details = errorResponse

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.error(customError)
          return {unsubscribe: () => {}}
        },
      }))

      const result = observableReleasesClient.edit({releaseId, patch})

      await expect(firstValueFrom(result)).rejects.toMatchObject({
        message: expect.stringContaining('Invalid patch operation'),
        details: expect.objectContaining(errorResponse),
      })
    })

    test('properly cleans up subscriptions when errors occur', async () => {
      const releaseId = 'release123'
      const unsubscribeSpy = vi.fn()

      httpRequest.mockImplementationOnce(() => ({
        subscribe: (subscriber: any) => {
          subscriber.error(new Error('Server error'))
          return {unsubscribe: unsubscribeSpy}
        },
      }))

      const result = observableReleasesClient.get({releaseId})

      await expect(firstValueFrom(result)).rejects.toThrow('Server error')

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(unsubscribeSpy).toHaveBeenCalled()
    })
  })
})
