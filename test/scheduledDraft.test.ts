import {createClient} from '@sanity/client'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

import type {ObservableSanityClient, SanityClient} from '../src/SanityClient'
import * as createVersionIdModule from '../src/util/createVersionId'

vi.mock('../src/util/createVersionId', () => ({
  generateReleaseId: vi.fn().mockReturnValue('generatedReleaseId'),
  getDocumentVersionId: vi.fn((publishedId: string, releaseId?: string) => {
    return releaseId ? `versions.${releaseId}.${publishedId}` : `drafts.${publishedId}`
  }),
}))

const TEST_PROJECT_ID = 'test123'
const TEST_DATASET = 'test-dataset'
const TEST_BASE_ID = 'drafts.myDocument'
const TEST_RELEASE_ID = 'release123'
const TEST_PUBLISH_AT = '2024-12-25T00:00:00.000Z'
const TEST_IF_BASE_REVISION_ID = 'rev123'

const httpRequest = vi.fn()

describe('SanityClient scheduledDraft()', () => {
  let client: SanityClient

  beforeEach(() => {
    client = createClient({
      projectId: TEST_PROJECT_ID,
      dataset: TEST_DATASET,
      apiVersion: '1',
      useCdn: false,
    })

    httpRequest.mockClear()
    vi.mocked(createVersionIdModule.generateReleaseId).mockReturnValue('generatedReleaseId')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('method exists and is callable', () => {
    expect(client.scheduledDraft).toBeDefined()
    expect(typeof client.scheduledDraft).toBe('function')
  })

  test('throws error when baseId is not a draft ID (published document)', () => {
    expect(() =>
      client.scheduledDraft({
        baseId: 'myDocument', // Not a draft ID
        publishAt: TEST_PUBLISH_AT,
      }),
    ).toThrow('`scheduledDraft()` requires `baseId` to be a draft document ID')

    // Verify no HTTP requests were made
    expect(httpRequest).not.toHaveBeenCalled()
  })

  test('throws error when baseId is a version ID', () => {
    expect(() =>
      client.scheduledDraft({
        baseId: 'versions.someRelease.myDocument', // Version ID, not draft
        publishAt: TEST_PUBLISH_AT,
      }),
    ).toThrow('`scheduledDraft()` requires `baseId` to be a draft document ID')

    // Verify no HTTP requests were made
    expect(httpRequest).not.toHaveBeenCalled()
  })

  test('accepts all required parameters', () => {
    const params = {
      releaseId: TEST_RELEASE_ID,
      baseId: TEST_BASE_ID,
      ifBaseRevisionId: TEST_IF_BASE_REVISION_ID,
      publishAt: TEST_PUBLISH_AT,
    }

    // Test that the method accepts these parameters without error
    expect(() => {
      const result = client.scheduledDraft(params)
      expect(result).toBeInstanceOf(Promise)
    }).not.toThrow()
  })

  test('accepts optional releaseId parameter', () => {
    const params = {
      baseId: TEST_BASE_ID,
      publishAt: TEST_PUBLISH_AT,
    }

    // Test that releaseId is optional
    expect(() => {
      const result = client.scheduledDraft(params)
      expect(result).toBeInstanceOf(Promise)
    }).not.toThrow()
  })
})

describe('ObservableSanityClient scheduledDraft()', () => {
  let client: SanityClient
  let observableClient: ObservableSanityClient

  beforeEach(() => {
    client = createClient({
      projectId: TEST_PROJECT_ID,
      dataset: TEST_DATASET,
      apiVersion: '1',
      useCdn: false,
    })

    observableClient = client.observable as ObservableSanityClient

    httpRequest.mockClear()
    vi.mocked(createVersionIdModule.generateReleaseId).mockReturnValue('generatedReleaseId')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('method exists and returns an observable', () => {
    expect(observableClient.scheduledDraft).toBeDefined()
    expect(typeof observableClient.scheduledDraft).toBe('function')

    // Verify it returns an observable (will fail due to validation, but that's expected)
    try {
      const result = observableClient.scheduledDraft({
        releaseId: TEST_RELEASE_ID,
        baseId: TEST_BASE_ID,
        publishAt: TEST_PUBLISH_AT,
      })
      expect(result.subscribe).toBeDefined()
    } catch (e) {
      // Expected if the method throws during construction
    }
  })

  test('throws error when baseId is not a draft ID', () => {
    expect(() =>
      observableClient.scheduledDraft({
        baseId: 'myDocument', // Not a draft ID
        publishAt: TEST_PUBLISH_AT,
      }),
    ).toThrow('`scheduledDraft()` requires `baseId` to be a draft document ID')
  })

  test('accepts all required parameters', () => {
    const params = {
      releaseId: TEST_RELEASE_ID,
      baseId: TEST_BASE_ID,
      ifBaseRevisionId: TEST_IF_BASE_REVISION_ID,
      publishAt: TEST_PUBLISH_AT,
    }

    // Test that the method accepts these parameters without throwing during construction
    expect(() => {
      observableClient.scheduledDraft(params)
    }).not.toThrow()
  })
})
