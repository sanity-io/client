import {ViewResourceType} from '@sanity/client'
import {afterEach, describe, expect, test} from 'vitest'

import {createViewClient, ObservableViewClient, type ViewClientConfig} from '../../src/views'

const apiHost = 'api.sanity.url'
const apicdnHost = 'apicdn.sanity.url'

describe('view client', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  let nock: typeof import('nock') = (() => {
    throw new Error('Not supported in EdgeRuntime')
  }) as any
  if (!isEdge) {
    const _nock = await import('nock')
    nock = _nock.default
  }

  afterEach(() => {
    if (!isEdge) {
      nock.cleanAll()
    }
  })

  const defaultConfig: ViewClientConfig = {
    apiHost: `https://${apiHost}`,
    apiCdnHost: `https://${apicdnHost}`,
    apiVersion: '2025-01-01',
  }

  describe('createViewClient', () => {
    test('can create a view client', () => {
      const client = createViewClient(defaultConfig)
      expect(client).toBeDefined()
      expect(client.observable).toBeInstanceOf(ObservableViewClient)
    })

    test('can create a view client with additional config options', () => {
      const config: ViewClientConfig = {
        ...defaultConfig,
        maxRetries: 5,
        retryDelay: () => 1000, // retryDelay should be a function
        timeout: 30000,
      }
      const client = createViewClient(config)
      expect(client).toBeDefined()
      expect(client.observable).toBeInstanceOf(ObservableViewClient)
    })
  })

  describe('promise client', () => {
    test.skipIf(isEdge)('uses the correct url for a view resource', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'njgNkngskjg'}]

      // Mock both hosts to see which one gets called
      const apiMock = nock(`https://${apiHost}`).get(/.*/).reply(200, {ms: 123, result})

      const apicdnMock = nock(`https://${apicdnHost}`)
        .get(
          `/v2025-01-01/views/vw123/query?query=*%5B_id+%3D%3D+%22view%22%5D%7B_id%7D&returnQuery=false`,
        )
        .reply(200, {
          ms: 123,
          result,
        })

      const res = await client.fetch('vw123', '*[_id == "view"]{_id}', {}, {})
      expect(res).toEqual(result)

      expect(apiMock.isDone()).toBe(false)
      expect(apicdnMock.isDone()).toBe(true)
    })

    test.skipIf(isEdge)('can fetch without params', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'doc1', title: 'Test Document'}]

      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 150, result})

      const res = await client.fetch('vw456', '*[_type == "document"]')
      expect(res).toEqual(result)
    })

    test.skipIf(isEdge)('can fetch with params', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'doc1', title: 'Specific Document'}]
      const params = {docType: 'article'}

      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 200, result})

      const res = await client.fetch('vw789', '*[_type == $docType]', params)
      expect(res).toEqual(result)
    })

    test.skipIf(isEdge)('can fetch with ViewQueryOptions', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'doc1', title: 'Published Document'}]

      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 180, result})

      const res = await client.fetch('vw101', '*[_type == "page"]', {}, {perspective: 'published'})
      expect(res).toEqual(result)
    })

    test.skipIf(isEdge)('can fetch with resultSourceMap option', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'doc1', title: 'Document with source map'}]
      const resultSourceMap = {
        documents: [
          {
            _id: 'doc1',
            _type: 'document',
          },
        ],
        paths: ['$[0]'],
        mappings: {
          '$[0]': {
            source: {
              document: 0,
              path: '',
              type: 'documentValue',
            },
          },
        },
      }

      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 220, result, resultSourceMap})

      const res = await client.fetch('vw202', '*[_type == "page"]', {}, {resultSourceMap: true})
      // By default, the client returns just the result, even with resultSourceMap: true
      // To get the full response including resultSourceMap, use filterResponse: false
      expect(res).toEqual(result)
    })

    test.skipIf(isEdge)('can fetch with filterResponse: false to get full response', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'doc1', title: 'Document with full response'}]
      const resultSourceMap = {
        documents: [
          {
            _id: 'doc1',
            _type: 'document',
          },
        ],
        paths: ['$[0]'],
        mappings: {
          '$[0]': {
            source: {
              document: 0,
              path: '',
              type: 'documentValue',
            },
          },
        },
      }

      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 250, result, resultSourceMap})

      const res = await client.fetch(
        'vw203',
        '*[_type == "page"]',
        {},
        {resultSourceMap: true, filterResponse: false},
      )
      // With filterResponse: false, the client returns the full response object
      expect(res).toEqual({result, resultSourceMap, ms: 250})
    })

    test('can clone client with withConfig', () => {
      const client = createViewClient(defaultConfig)
      const newClient = client.withConfig({apiVersion: '2024-12-01'})

      expect(client).not.toBe(newClient)
      expect(newClient).toBeDefined()
      expect(newClient.observable).toBeInstanceOf(ObservableViewClient)
    })

    test.skipIf(isEdge)('withConfig preserves existing configuration', async () => {
      const client = createViewClient({
        ...defaultConfig,
        timeout: 5000,
      })
      const newClient = client.withConfig({apiVersion: '2024-12-01'})
      const result = [{_id: 'test'}]

      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 100, result})

      const res = await newClient.fetch('vw303', '*')
      expect(res).toEqual(result)
    })

    test.skipIf(isEdge)('always uses CDN for view queries', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'cdn-test'}]

      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 50, result})

      const res = await client.fetch('vw404', '*')
      expect(res).toEqual(result)
    })

    test.skipIf(isEdge)('uses emulate endpoint when dataset connections are detected', async () => {
      const configWithOverrides: ViewClientConfig = {
        ...defaultConfig,
        viewOverrides: [
          {
            id: 'vw-dataset-test',
            connections: [
              {
                query: '*[_type == "document"]',
                resourceType: ViewResourceType.Dataset,
                resourceId: 'project123.dataset456',
              },
            ],
          },
        ],
      }
      const client = createViewClient(configWithOverrides)
      const result = [{_id: 'dataset-doc', title: 'Dataset Document'}]

      // Mock the emulate endpoint (POST request) - uses API host, not CDN
      nock(`https://${apiHost}`)
        .post('/v2025-01-01/views/vw-dataset-test/emulate?returnQuery=false', {
          query: '*[_type == "test"]',
          params: {},
          connections: [
            {
              query: '*[_type == "document"]',
              resourceType: ViewResourceType.Dataset,
              resourceId: 'project123.dataset456',
            },
          ],
        })
        .reply(200, {ms: 100, result})

      const res = await client.fetch('vw-dataset-test', '*[_type == "test"]')
      expect(res).toEqual(result)
    })

    test.skipIf(isEdge)('falls back to view endpoint when no override matches', async () => {
      const configWithOverrides: ViewClientConfig = {
        ...defaultConfig,
        viewOverrides: [
          {
            id: 'vw-other',
            connections: [
              {
                query: '*[_type == "document"]',
                resourceType: ViewResourceType.Dataset,
                resourceId: 'project123.dataset456',
              },
            ],
          },
        ],
      }
      const client = createViewClient(configWithOverrides)
      const result = [{_id: 'view-doc', title: 'View Document'}]

      // Mock the view endpoint (default behavior)
      nock(`https://${apicdnHost}`)
        .get(
          '/v2025-01-01/views/vw-no-override/query?query=*%5B_type+%3D%3D+%22test%22%5D&returnQuery=false',
        )
        .reply(200, {ms: 100, result})

      const res = await client.fetch('vw-no-override', '*[_type == "test"]')
      expect(res).toEqual(result)
    })
  })

  describe('observable client', () => {
    test('client returns an observable client', async () => {
      const client = createViewClient(defaultConfig)
      expect(client.observable).toBeInstanceOf(ObservableViewClient)
    })

    test.skipIf(isEdge)('uses the correct url for a view resource', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'njgNkngskjg'}]

      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 123, result})

      const req = client.observable.fetch('vw123', '*[_id == "view"]{_id}', {}, {})
      await new Promise((resolve) => setTimeout(resolve, 1))

      await new Promise<void>((resolve, reject) => {
        req.subscribe({
          next: (res) => {
            expect(res).toEqual(result)
          },
          error: reject,
          complete: resolve,
        })
      })
    })

    test.skipIf(isEdge)('observable requests are lazy', async () => {
      const client = createViewClient(defaultConfig)
      let didRequest = false

      nock(`https://${apicdnHost}`)
        .get(/.*/)
        .reply(() => {
          didRequest = true
          return [200, {ms: 100, result: []}]
        })

      const req = client.observable.fetch('vw505', '*')
      await new Promise((resolve) => setTimeout(resolve, 1))

      expect(didRequest).toBe(false)

      await new Promise<void>((resolve, reject) => {
        req.subscribe({
          next: () => {
            expect(didRequest).toBe(true)
          },
          error: reject,
          complete: resolve,
        })
      })
    })

    test.skipIf(isEdge)('observable requests are cold', async () => {
      const client = createViewClient(defaultConfig)
      let requestCount = 0

      // Mock CDN host
      nock(`https://${apicdnHost}`)
        .get(/.*/)
        .twice()
        .reply(() => {
          requestCount++
          return [200, {ms: 100, result: [{_id: `doc${requestCount}`}]}]
        })

      const req = client.observable.fetch('vw606', '*')

      await new Promise<void>((resolve, reject) => {
        expect(requestCount).toBe(0)
        req.subscribe({
          next: () => {
            expect(requestCount).toBe(1)
            req.subscribe({
              next: () => {
                expect(requestCount).toBe(2)
              },
              error: reject,
              complete: resolve,
            })
          },
          error: reject,
        })
      })
    })

    test.skipIf(isEdge)('can fetch without params', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'obs-doc1', title: 'Observable Document'}]

      // Mock CDN host
      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 160, result})

      await new Promise<void>((resolve, reject) => {
        client.observable.fetch('vw707', '*[_type == "post"]').subscribe({
          next: (res) => {
            expect(res).toEqual(result)
          },
          error: reject,
          complete: resolve,
        })
      })
    })

    test.skipIf(isEdge)('can fetch with params', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'obs-doc2', category: 'tech'}]
      const params = {cat: 'tech'}

      // Mock CDN host
      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 140, result})

      await new Promise<void>((resolve, reject) => {
        client.observable.fetch('vw808', '*[category == $cat]', params).subscribe({
          next: (res) => {
            expect(res).toEqual(result)
          },
          error: reject,
          complete: resolve,
        })
      })
    })

    test.skipIf(isEdge)('can fetch with ViewQueryOptions', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'obs-doc3', status: 'draft'}]

      // Mock API host (not CDN) because previewDrafts perspective disables CDN
      nock(`https://${apiHost}`).get(/.*/).reply(200, {ms: 190, result})

      await new Promise<void>((resolve, reject) => {
        client.observable
          .fetch('vw909', '*[_type == "article"]', {}, {perspective: 'previewDrafts'})
          .subscribe({
            next: (res) => {
              expect(res).toEqual(result)
            },
            error: reject,
            complete: resolve,
          })
      })
    })

    test('can clone observable client with withConfig', () => {
      const client = createViewClient(defaultConfig)
      const newObservableClient = client.observable.withConfig({apiVersion: '2024-11-01'})

      expect(client.observable).not.toBe(newObservableClient)
      expect(newObservableClient).toBeInstanceOf(ObservableViewClient)
    })

    test.skipIf(isEdge)(
      'withConfig on observable client preserves existing configuration',
      async () => {
        const client = createViewClient({
          ...defaultConfig,
          timeout: 8000,
        })
        const newObservableClient = client.observable.withConfig({apiVersion: '2024-11-01'})
        const result = [{_id: 'config-test'}]

        // Mock CDN host
        nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 80, result})

        await new Promise<void>((resolve, reject) => {
          newObservableClient.fetch('vw1010', '*').subscribe({
            next: (res) => {
              expect(res).toEqual(result)
            },
            error: reject,
            complete: resolve,
          })
        })
      },
    )

    test.skipIf(isEdge)('always uses CDN for observable view queries', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'obs-cdn-test'}]

      // Mock CDN host
      nock(`https://${apicdnHost}`).get(/.*/).reply(200, {ms: 60, result})

      await new Promise<void>((resolve, reject) => {
        client.observable.fetch('vw1111', '*').subscribe({
          next: (res) => {
            expect(res).toEqual(result)
          },
          error: reject,
          complete: resolve,
        })
      })
    })

    test.skipIf(isEdge)(
      'observable client uses emulate endpoint when dataset connections are detected',
      async () => {
        const configWithOverrides: ViewClientConfig = {
          ...defaultConfig,
          viewOverrides: [
            {
              id: 'vw-obs-dataset',
              connections: [
                {
                  query: '*[_type == "document"]',
                  resourceType: ViewResourceType.Dataset,
                  resourceId: 'project789.dataset101',
                },
              ],
            },
          ],
        }
        const client = createViewClient(configWithOverrides)
        const result = [{_id: 'obs-dataset-doc', title: 'Observable Dataset Document'}]

        // Mock the emulate endpoint (POST request) - uses API host, not CDN
        nock(`https://${apiHost}`)
          .post('/v2025-01-01/views/vw-obs-dataset/emulate?returnQuery=false', {
            query: '*[_type == "obs-test"]',
            params: {},
            connections: [
              {
                query: '*[_type == "document"]',
                resourceType: ViewResourceType.Dataset,
                resourceId: 'project789.dataset101',
              },
            ],
          })
          .reply(200, {ms: 120, result})

        await new Promise<void>((resolve, reject) => {
          client.observable.fetch('vw-obs-dataset', '*[_type == "obs-test"]').subscribe({
            next: (res) => {
              expect(res).toEqual(result)
            },
            error: reject,
            complete: resolve,
          })
        })
      },
    )
  })
})
