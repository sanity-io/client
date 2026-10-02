import {afterAll, beforeEach, describe, expect, test, vi} from 'vitest'

import {CDN_INCOMPATIBLE_PERSPECTIVE_ERROR} from '../../src/config'
import {getActiveMock} from '../helpers/mockFetch'
import {createClient} from './helpers'

const liveHost = 'https://abc123.api.sanity.io'
const cdnHost = 'https://abc123.apicdn.sanity.io'
const draftsQueryPath = '/v1/data/query/foo?query=*&returnQuery=false&perspective=drafts'
const publishedQueryPath = '/v1/data/query/foo?query=*&returnQuery=false&perspective=published'
const rawQueryPath = '/v1/data/query/foo?query=*&returnQuery=false&perspective=raw'
const stackedQueryPath =
  '/v1/data/query/foo?query=*&returnQuery=false&perspective=published%2Cdrafts'

describe('API-CDN and drafts perspective', () => {
  const result = [{_id: 'njgNkngskjg', rating: 5}]
  const warn = vi.spyOn(console, 'warn')
  beforeEach(() => {
    warn.mockReset()
  })
  afterAll(() => {
    warn.mockRestore()
  })

  describe('after: allowed combinations still query', () => {
    test('drafts with useCdn false uses the Live API', async () => {
      getActiveMock()
        .scope(liveHost)
        .on('GET', draftsQueryPath)
        .respond({status: 200, body: {ms: 123, result}})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: false,
        perspective: 'drafts',
      })
      expect(await client.fetch('*', {})).toEqual(result)
    })

    test('published with useCdn true uses the API-CDN', async () => {
      getActiveMock()
        .scope(cdnHost)
        .on('GET', publishedQueryPath)
        .respond({status: 200, body: {ms: 123, result}})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        perspective: 'published',
      })
      expect(await client.fetch('*', {})).toEqual(result)
    })

    test('raw with useCdn true uses the API-CDN', async () => {
      getActiveMock()
        .scope(cdnHost)
        .on('GET', rawQueryPath)
        .respond({status: 200, body: {ms: 123, result}})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        perspective: 'raw',
      })
      expect(await client.fetch('*', {})).toEqual(result)
    })

    test('drafts with useCdn true still queries when fetch overrides useCdn to false', async () => {
      getActiveMock()
        .scope(liveHost)
        .on('GET', draftsQueryPath)
        .respond({status: 200, body: {ms: 123, result}})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        perspective: 'drafts',
      })
      expect(await client.fetch('*', {}, {useCdn: false})).toEqual(result)
    })

    test('stacked perspectives without drafts still fall back to the Live API when useCdn is true', async () => {
      getActiveMock()
        .scope(liveHost)
        .on('GET', '/v1/data/query/foo?query=*&returnQuery=false&perspective=published%2Crrel123')
        .respond({status: 200, body: {ms: 123, result}})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        perspective: ['published', 'rrel123'],
      })
      expect(await client.fetch('*', {})).toEqual(result)
    })

    test('stacked perspectives with useCdn false use the Live API', async () => {
      getActiveMock()
        .scope(liveHost)
        .on('GET', stackedQueryPath)
        .respond({status: 200, body: {ms: 123, result}})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: false,
        perspective: ['published', 'drafts'],
      })
      expect(await client.fetch('*', {})).toEqual(result)
    })
  })

  describe('after: incompatible combinations throw instead of warning', () => {
    test('constructing the client with drafts and useCdn true does not throw', () => {
      expect(() =>
        createClient({
          projectId: 'abc123',
          dataset: 'foo',
          useCdn: true,
          perspective: 'drafts',
        }),
      ).not.toThrow()
    })

    test('fetch throws when config has drafts and useCdn true', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        perspective: 'drafts',
      })
      expect(() => client.fetch('*', {})).toThrow(CDN_INCOMPATIBLE_PERSPECTIVE_ERROR)
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining('The Live API will be used instead'),
      )
    })

    test('fetch throws when config has previewDrafts and useCdn true', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        perspective: 'previewDrafts',
      })
      expect(() => client.fetch('*', {})).toThrow(CDN_INCOMPATIBLE_PERSPECTIVE_ERROR)
    })

    test('fetch throws when drafts is combined with the default useCdn true', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        perspective: 'drafts',
      })
      expect(() => client.fetch('*', {})).toThrow(CDN_INCOMPATIBLE_PERSPECTIVE_ERROR)
    })

    test('fetch throws when a drafts perspective override is used on a CDN client', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
      })
      expect(() => client.fetch('*', {}, {perspective: 'drafts'})).toThrow(
        CDN_INCOMPATIBLE_PERSPECTIVE_ERROR,
      )
    })

    test('fetch throws when a previewDrafts perspective override is used on a CDN client', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
      })
      expect(() => client.fetch('*', {}, {perspective: 'previewDrafts'})).toThrow(
        CDN_INCOMPATIBLE_PERSPECTIVE_ERROR,
      )
    })

    test('fetch throws when a stack including drafts is used with useCdn true', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        perspective: ['published', 'drafts'],
      })
      expect(() => client.fetch('*', {})).toThrow(CDN_INCOMPATIBLE_PERSPECTIVE_ERROR)
    })

    test('fetch throws when useCdn is overridden to true on a drafts client', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: false,
        perspective: 'drafts',
      })
      expect(() => client.fetch('*', {}, {useCdn: true})).toThrow(
        CDN_INCOMPATIBLE_PERSPECTIVE_ERROR,
      )
    })
  })
})
