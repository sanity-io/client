import {
  type ClientConfig,
  type ClientPerspective,
  type FilteredResponseQueryOptions,
} from '@sanity/client'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {perspectiveConflictsWithCdn} from '../../src/config'
import {getActiveMock} from '../helpers/mockFetch'
import {apiHost, createClient, getClient, projectHost} from './helpers'

describe('base client', () => {
  test('can create a client', () => {
    const client = createClient({projectId: 'abc123'})
    expect(client.config().projectId, 'constructor opts are set').toBe('abc123')
  })

  test('using the new keyword trows an error', () => {
    const SanityClient = createClient
    // @ts-expect-error - we want to test that it throws an error
    expect(() => new SanityClient({projectId: 'abc123'})).toThrowError(/is not a constructor/)
  })

  test('can get and set config', () => {
    const client = createClient({projectId: 'abc123'})
    expect(client.config().projectId, 'constructor opts are set').toEqual('abc123')
    expect(client.config({projectId: 'def456'}), 'returns client on set').toEqual(client)
    expect(client.config().projectId, 'new config is set').toEqual('def456')
  })

  test('config getter returns a cloned object', () => {
    const client = createClient({projectId: 'abc123'})
    expect(client.config().projectId, 'constructor opts are set').toEqual('abc123')
    const config = client.config()
    config.projectId = 'def456'
    expect(
      client.config().projectId,

      'returned object does not mutate client config',
    ).toEqual('abc123')
  })

  test('calling config() reconfigures observable API too', () => {
    const client = createClient({projectId: 'abc123'})

    client.config({projectId: 'def456'})
    expect(
      client.observable.config().projectId,

      'Observable API gets reconfigured',
    ).toEqual('def456')
  })

  test('can clone client', () => {
    const client = createClient({projectId: 'abc123'})
    expect(client.config().projectId, 'constructor opts are set').toEqual('abc123')

    const client2 = client.clone()
    client2.config({projectId: 'def456'})
    expect(client.config().projectId).toEqual('abc123')
    expect(client2.config().projectId).toEqual('def456')
  })

  test('can clone client with new config', () => {
    const client = createClient({projectId: 'abc123', apiVersion: 'v2021-03-25'})
    expect(client.config().projectId, 'constructor opts are set').toEqual('abc123')
    expect(client.config().apiVersion, 'constructor opts are set').toEqual('2021-03-25')

    const client2 = client.withConfig({projectId: 'def456', apiVersion: 'v1'})
    expect(client.config().projectId).toEqual('abc123')
    expect(client2.config().projectId).toEqual('def456')

    expect(client.config().apiVersion).toEqual('2021-03-25')
    expect(client2.config().apiVersion).toEqual('1')
  })

  test('can disallow reconfiguration of client', () => {
    const client = createClient({
      projectId: 'abc123',
      apiVersion: 'v2021-03-25',
      allowReconfigure: false,
    })
    expect(client.config().projectId, 'constructor opts are set').toEqual('abc123')
    expect(() => client.config({apiVersion: 'v2022-09-09'})).toThrow(/reconfigure/)
    expect(() => client.observable.config({apiVersion: 'v2022-09-09'})).toThrow(/reconfigure/)
  })

  test('can create new instance of configured client when `allowReconfigure` set to false', () => {
    const client = createClient({
      projectId: 'abc123',
      apiVersion: 'v2021-03-25',
      allowReconfigure: false,
    })
    const newClient = client.withConfig({dataset: 'abc321'})
    expect(
      newClient.config().projectId,

      'existing config cloned',
    ).toEqual(client.config().projectId)
    expect(newClient.config().dataset, 'modified properties are set').toEqual('abc321')
    expect(() => newClient.config({projectId: 'bar'})).toThrow(/reconfigure/)
  })

  test('throws if no projectId is set', () => {
    expect(() => createClient({})).toThrow(/projectId/)
  })

  test('throws if encodeSourceMapAtPath is provided', () => {
    // @ts-expect-error - we want to test that it throws an error
    expect(() => createClient({projectId: 'abc123', encodeSourceMapAtPath: () => true})).toThrow(
      /encodeSourceMapAtPath/,
    )
  })

  test('throws if resource type is dataset and id has no dots', () => {
    expect(() => createClient({'~experimental_resource': {type: 'dataset', id: 'abc123'}})).toThrow(
      /Dataset resource ID must be in the format "project.dataset"/,
    )
  })

  test('throws on invalid resource type', () => {
    expect(() =>
      // @ts-expect-error - we want to test that it throws an error
      createClient({'~experimental_resource': {type: 'bread-and-butter', id: 'abc123'}}),
    ).toThrow(/Unsupported resource type: bread-and-butter/)
  })

  test('throws if encodeSourceMap is provided', () => {
    // @ts-expect-error - we want to test that it throws an error
    expect(() => createClient({projectId: 'abc123', encodeSourceMap: true})).toThrow(
      /encodeSourceMap/,
    )
  })

  test('allows stega to be explicitly undefined', () => {
    expect(() => createClient({projectId: 'abc123', stega: undefined})).not.toThrow()
  })

  test('uses default apiHost when it is undefined', () => {
    const config = createClient({projectId: 'abc123', apiHost: undefined}).config()
    expect(config.apiHost).toBe('https://api.sanity.io')
    expect(config.url).toBe('https://abc123.api.sanity.io/v1')
    expect(config.cdnUrl).toBe('https://abc123.apicdn.sanity.io/v1')
  })

  test('uses default apiHost when it is null', () => {
    const config = createClient({
      projectId: 'abc123',
      // @ts-expect-error -- apiHost is string | undefined; null still arrives from unset env vars
      apiHost: null,
    }).config()
    expect(config.apiHost).toBe('https://api.sanity.io')
    expect(config.url).toBe('https://abc123.api.sanity.io/v1')
    expect(config.cdnUrl).toBe('https://abc123.apicdn.sanity.io/v1')
  })

  test('throws on invalid perspective', () => {
    expect(() => createClient({projectId: 'abc123', perspective: 'published'})).not.toThrow(
      /Invalid API perspective/,
    )
    expect(() => createClient({projectId: 'abc123', perspective: 'previewDrafts'})).not.toThrow(
      /Invalid API perspective/,
    )
    expect(() => createClient({projectId: 'abc123', perspective: 'drafts'})).not.toThrow(
      /Invalid API perspective/,
    )
    expect(() => createClient({projectId: 'abc123', perspective: 'raw'})).not.toThrow(
      /Invalid API perspective/,
    )
    expect(() => createClient({projectId: 'abc123', perspective: undefined})).not.toThrow(
      /Invalid API perspective/,
    )
    const validReleaseIdentifier = 'foobar'
    expect(() =>
      createClient({
        projectId: 'abc123',
        perspective: ['published', 'drafts', validReleaseIdentifier],
      }),
    ).not.toThrow(/Invalid API perspective/)

    // special case – 'raw' can not be combined with multiple perspectives and is explicitly
    // banned by the backend
    expect(() =>
      createClient({projectId: 'abc123', perspective: ['published', 'drafts', 'raw']}),
    ).toThrow(/Invalid API perspective/)
  })

  test('perspectiveConflictsWithCdn matches the perspectives Gradient rejects on the API-CDN', () => {
    expect(perspectiveConflictsWithCdn('drafts')).toBe(true)
    expect(perspectiveConflictsWithCdn('previewDrafts')).toBe(true)
    expect(perspectiveConflictsWithCdn('published')).toBe(false)
    expect(perspectiveConflictsWithCdn('raw')).toBe(false)
    expect(perspectiveConflictsWithCdn(['published'])).toBe(false)
    expect(perspectiveConflictsWithCdn(['drafts', 'published'])).toBe(true)
    expect(perspectiveConflictsWithCdn(['previewDrafts'])).toBe(true)
    expect(perspectiveConflictsWithCdn([])).toBe(false)
  })

  test('throws on invalid project ids', () => {
    expect(() => createClient({projectId: '*foo*'})).toThrow(/projectId.*?can only contain/i)
  })

  test('throws on invalid dataset names', () => {
    expect(() => createClient({projectId: 'abc123', dataset: '*foo*'})).toThrow(
      /Datasets can only contain/i,
    )
  })

  test('throws on invalid request tag prefix', () => {
    expect(() =>
      createClient({projectId: 'abc123', dataset: 'foo', requestTagPrefix: 'no#shot'}),
    ).toThrow(/tag can only contain alphanumeric/i)
  })

  test('accepts alias in dataset field', () => {
    expect(() => createClient({projectId: 'abc123', dataset: '~alias'})).not.toThrow(
      /Datasets can only contain/i,
    )
  })

  test('can use request() for API-relative requests', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {pong: true}})

    await expect(getClient().request({url: '/ping'})).resolves.toMatchObject({pong: true})
  })

  test('request() rejects options with neither `url` nor `uri`', () => {
    let error: unknown
    try {
      // @ts-expect-error -- `url` is required in the types; this simulates a JS caller omitting it
      void getClient().request({})
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(TypeError)
    expect(error).toMatchObject({message: 'Request options must include a `url`'})
  })

  test('can use the deprecated `uri` alias for `url`', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {pong: true}})

    await expect(getClient().request({uri: '/ping'})).resolves.toMatchObject({pong: true})
  })

  test('observable request() accepts the deprecated `uri` alias', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {pong: true}})

    await expect(
      firstValueFrom(getClient().observable.request({uri: '/ping'})),
    ).resolves.toMatchObject({pong: true})
  })

  test('`uri` wins over `url` when both are given, as in v8', async () => {
    // Only `/v1/ping` is mocked - if `url` took precedence the request would
    // go to `/v1/pong` and the mock would reject it.
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {pong: true}})

    await expect(
      // @ts-expect-error -- mutually exclusive in the types; this simulates a JS caller passing both
      getClient().request({url: '/pong', uri: '/ping'}),
    ).resolves.toMatchObject({pong: true})
  })

  test('can use request() for API-relative requests (custom api version)', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v2019-01-29/ping')
      .respond({status: 200, body: {pong: true}})

    await expect(
      getClient({apiVersion: '2019-01-29'}).request({url: '/ping'}),
    ).resolves.toMatchObject({pong: true})
  })

  test('observable requests are lazy', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {pong: true}})

    const req = getClient().observable.request({url: '/ping'})
    await new Promise((resolve) => setTimeout(resolve, 1))

    await new Promise<void>((resolve, reject) => {
      expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/ping', 0)
      req.subscribe({
        next: () => {
          expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/ping', 1)
        },
        error: reject,
        complete: resolve,
      })
    })
  })

  test('observable requests are cold', async () => {
    expect.assertions(3)

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {pong: true}})
      .respond({status: 200, body: {pong: true}})

    const req = getClient().observable.request({url: '/ping'})

    await new Promise<void>((resolve, reject) => {
      expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/ping', 0)
      req.subscribe({
        next: () => {
          expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/ping', 1)
          req.subscribe({
            next: () => {
              expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/ping', 2)
            },
            error: reject,
            complete: resolve,
          })
        },
        error: reject,
      })
    })
  })

  describe('resource client', async () => {
    const resourceVariants = [
      {
        type: 'media-library',
        id: 'theResourceId',
        baseUrl: `/media-libraries/theResourceId`,
      },
      {
        type: 'canvas',
        id: 'theResourceId',
        baseUrl: `/canvases/theResourceId`,
      },
      {
        type: 'dashboard',
        id: 'theResourceId',
        baseUrl: `/dashboards/theResourceId`,
      },
      {
        type: 'dataset',
        id: 'myProjectId.myDatasetName',
        baseUrl: `/projects/myProjectId/datasets/myDatasetName`,
      },
    ] as const
    const apiVersionsVariants = [undefined, '1', '2025-03-25', 'X']
    const perspectiveVariants: (undefined | ClientPerspective)[] = [
      undefined,
      'raw',
      ['foo', 'bar'],
    ]
    const doc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}

    describe('resource variants', () => {
      for (const resource of resourceVariants) {
        describe(`Resource: ${resource.type}:${resource.id}`, () => {
          for (const apiVersion of apiVersionsVariants) {
            describe(`API Version: ${String(apiVersion)}`, () => {
              for (const perspective of perspectiveVariants) {
                describe(`Perspective: ${String(perspective)}`, () => {
                  test('fetch', async () => {
                    const queryParams = new URLSearchParams()
                    queryParams.set('query', '*')
                    queryParams.set('returnQuery', 'false')
                    if (perspective) {
                      queryParams.set(
                        'perspective',
                        Array.isArray(perspective) ? perspective.join(',') : perspective,
                      )
                    }
                    getActiveMock()
                      .scope(`https://${apiHost}`)
                      .on(
                        'GET',
                        `/v${apiVersion || '1'}${resource.baseUrl}/query?${queryParams.toString()}`,
                      )
                      .respond({status: 200, body: {result: doc}})
                    const config: ClientConfig = {
                      useProjectHostname: false,
                      apiHost: `https://${apiHost}`,
                      '~experimental_resource': resource,
                    }
                    if (apiVersion) {
                      config.apiVersion = apiVersion
                    }
                    const client = createClient(config)
                    const fetchOpts: FilteredResponseQueryOptions = {}
                    if (perspective) {
                      fetchOpts.perspective = perspective
                    }
                    const data = await client.fetch('*', {}, fetchOpts)
                    expect(data._id, 'should have resource id').toBe('mooblah')
                  })
                })
              }

              test('mutate: create', async () => {
                const base = `/v${apiVersion || '1'}${resource.baseUrl}/mutate?returnIds=true&returnDocuments=true&visibility=sync`

                getActiveMock()
                  .scope(`https://${apiHost}`)
                  .on('POST', base, {
                    body: {
                      mutations: [{create: doc}],
                    },
                  })
                  .respond({
                    status: 200,
                    body: {
                      transactionId: 'abc123',
                      results: [
                        {
                          document: doc,
                          operation: 'create',
                        },
                      ],
                    },
                  })

                const config: ClientConfig = {
                  apiHost: `https://${apiHost}`,
                  '~experimental_resource': resource,
                }
                if (apiVersion) {
                  config.apiVersion = apiVersion
                }
                const client = createClient(config)
                const result = await client.create(doc)
                expect(result._id, 'should have resource id').toBe('mooblah')
              })
              test('mutate: patch', async () => {
                const base = `/v${apiVersion || '1'}${resource.baseUrl}/mutate?returnIds=true&returnDocuments=true&visibility=sync`

                getActiveMock()
                  .scope(`https://${apiHost}`)
                  .on('POST', base, {
                    body: {
                      mutations: [
                        {
                          patch: {
                            id: doc._id,
                            set: {
                              name: 'tada',
                            },
                          },
                        },
                      ],
                    },
                  })
                  .respond({
                    status: 200,
                    body: {
                      transactionId: 'abc123',
                      results: [
                        {
                          document: doc,
                          operation: 'update',
                        },
                      ],
                    },
                  })

                const config: ClientConfig = {
                  apiHost: `https://${apiHost}`,
                  '~experimental_resource': resource,
                }
                if (apiVersion) {
                  config.apiVersion = apiVersion
                }
                const client = createClient(config)
                const result = await client
                  .patch(doc._id, {
                    set: {
                      name: 'tada',
                    },
                  })
                  .commit()
                expect(result, 'should have result').toBeDefined()
              })

              test('mutate: transaction', async () => {
                const base = `/v${apiVersion || '1'}${resource.baseUrl}/mutate?returnIds=true&visibility=sync`

                getActiveMock()
                  .scope(`https://${apiHost}`)
                  .on('POST', base, {
                    body: {
                      mutations: [
                        {patch: {id: 'foo', set: {bar: 123}}},
                        {createIfNotExists: {_id: '123', _type: 'baz'}},
                      ],
                    },
                  })
                  .respond({
                    status: 200,
                    body: {
                      transactionId: 'abc123',
                      results: [
                        {
                          operation: 'update',
                        },
                      ],
                    },
                  })

                const config: ClientConfig = {
                  apiHost: `https://${apiHost}`,
                  '~experimental_resource': resource,
                }
                if (apiVersion) {
                  config.apiVersion = apiVersion
                }
                const client = createClient(config)
                const txn = client.transaction()
                txn.patch('foo', {set: {bar: 123}})
                txn.createIfNotExists({_id: '123', _type: 'baz'})
                const result = await txn.commit()
                expect(result, 'should have result').toBeDefined()
              })

              test('users: me', async () => {
                getActiveMock()
                  .scope(`https://${apiHost}`)
                  .on('GET', `/v${apiVersion || '1'}/users/me`)
                  .respond({status: 200, body: {id: 123}})

                const config: ClientConfig = {
                  apiHost: `https://${apiHost}`,
                  '~experimental_resource': resource,
                }
                if (apiVersion) {
                  config.apiVersion = apiVersion
                }
                const client = createClient(config)
                const response = await client.users.getById('me')
                expect(response.id, 'should have resource id').toBe(123)
              })

              test('users: by id', async () => {
                getActiveMock()
                  .scope(`https://${apiHost}`)
                  .on('GET', `/v${apiVersion || '1'}/users/12345`)
                  .respond({status: 200, body: {id: 123}})

                const config: ClientConfig = {
                  apiHost: `https://${apiHost}`,
                  '~experimental_resource': resource,
                }
                if (apiVersion) {
                  config.apiVersion = apiVersion
                }
                const client = createClient(config)
                const response = await client.users.getById('12345')
                expect(response.id, 'should have resource id').toBe(123)
              })
            })
          }
        })
      }
    })

    test('fetch: dataset', async () => {
      getActiveMock()
        .scope(`https://${apiHost}`)
        .on(
          'GET',
          '/v1/projects/myProjectid/datasets/myDatasetName/query?query=*&returnQuery=false',
        )
        .respond({status: 200, body: {result: doc}})

      const client = createClient({
        useProjectHostname: false,
        apiHost: `https://${apiHost}`,
        '~experimental_resource': {type: 'dataset', id: 'myProjectid.myDatasetName'},
      })
      const resource = await client.fetch('*')
      expect(resource._id, 'should have resource id').toBe('mooblah')
    })

    test('fetch: perspective', async () => {
      getActiveMock()
        .scope(`https://${apiHost}`)
        .on('GET', '/v1/canvases/theResourceId/query?query=*&returnQuery=false&perspective=raw')
        .respond({status: 200, body: {result: doc}})

      const client = createClient({
        useProjectHostname: false,
        apiHost: `https://${apiHost}`,
        '~experimental_resource': {type: 'canvas', id: 'theResourceId'},
      })
      const resource = await client.fetch('*', {}, {perspective: 'raw'})
      expect(resource._id, 'should have resource id').toBe('mooblah')
    })

    test('mutate: create', async () => {
      getActiveMock()
        .scope(`https://${apiHost}`)
        .on(
          'POST',
          '/v1/canvases/theResourceId/mutate?returnIds=true&returnDocuments=true&visibility=sync',
          {
            body: {
              mutations: [{create: doc}],
            },
          },
        )
        .respond({
          status: 200,
          body: {
            transactionId: 'abc123',
            results: [
              {
                document: doc,
                operation: 'create',
              },
            ],
          },
        })

      const client = createClient({
        useProjectHostname: false,
        apiHost: `https://${apiHost}`,
        '~experimental_resource': {type: 'canvas', id: 'theResourceId'},
      })
      const resource = await client.create(doc)
      expect(resource._id, 'should have resource id').toBe('mooblah')
    })
    test('executes transaction using resource path when commit() is called', async () => {
      const mutations = [{create: {_type: 'foo', bar: true}}, {delete: {id: 'barfoo'}}]
      getActiveMock()
        .scope(`https://${apiHost}`)
        .on('POST', '/v1/canvases/res-id/mutate?returnIds=true&visibility=sync', {
          body: {mutations},
        })
        .respond({status: 200, body: {transactionId: 'blatti'}})

      const res = await getClient({'~experimental_resource': {type: 'canvas', id: 'res-id'}})
        .transaction()
        .create({_type: 'foo', bar: true})
        .delete('barfoo')
        .commit()
      expect(res.transactionId, 'applies given transaction').toEqual('blatti')
    })
  })
})
