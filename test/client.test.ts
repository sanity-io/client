import fs from 'node:fs'
import path from 'node:path'

import {
  type BaseActionOptions,
  type ClientConfig,
  ClientError,
  type ClientPerspective,
  type ContentSourceMap,
  type CreateAction,
  createClient,
  type DatasetsResponse,
  type DeleteAction,
  type DiscardAction,
  type EditAction,
  type FilteredResponseQueryOptions,
  Patch,
  type PublishAction,
  type ReplaceDraftAction,
  type SanityProject,
  ServerError,
  Transaction,
  type UnpublishAction,
  type VideoPlaybackInfoSigned,
} from '@sanity/client'
import {firstValueFrom, lastValueFrom, of as observableOf, toArray} from 'rxjs'
import {filter} from 'rxjs/operators'
import {describe, expect, expectTypeOf, test, vi} from 'vitest'

const apiHost = 'api.sanity.url'
const defaultProjectId = 'bf1942'
const projectHost = (projectId?: string) => `https://${projectId || defaultProjectId}.${apiHost}`

const globalApiHost = `https://${apiHost}`
const clientConfig = {
  apiHost: globalApiHost,
  projectId: 'bf1942',
  apiVersion: '1',
  dataset: 'foo',
  useCdn: false,
}

const fixture = (name: string) => path.join(__dirname, 'fixtures', name)

describe('client', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  const isNode = !isEdge && typeof document === 'undefined'
  let nock: typeof import('nock') = (() => {
    throw new Error('Not supported in EdgeRuntime')
  }) as any
  if (!isEdge) {
    const _nock = await import('nock')
    nock = _nock.default
  }

  const getClient = (conf?: ClientConfig) => createClient({...clientConfig, ...(conf || {})})

  describe('BASE CLIENT', () => {
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
      expect(() =>
        createClient({'~experimental_resource': {type: 'dataset', id: 'abc123'}}),
      ).toThrow(/Dataset resource ID must be in the format "project.dataset"/)
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

    test.skipIf(isEdge)('can use request() for API-relative requests', async () => {
      nock(projectHost()).get('/v1/ping').reply(200, {pong: true})

      await expect(getClient().request({uri: '/ping'})).resolves.toMatchObject({pong: true})
    })

    test.skipIf(isEdge)(
      'can use request() for API-relative requests (custom api version)',
      async () => {
        nock(projectHost()).get('/v2019-01-29/ping').reply(200, {pong: true})

        await expect(
          getClient({apiVersion: '2019-01-29'}).request({uri: '/ping'}),
        ).resolves.toMatchObject({pong: true})
      },
    )

    test.skipIf(isEdge)('observable requests are lazy', async () => {
      expect.assertions(2)

      let didRequest = false
      nock(projectHost())
        .get('/v1/ping')
        .reply(() => {
          didRequest = true
          return [200, {pong: true}]
        })

      const req = getClient().observable.request({uri: '/ping'})
      await new Promise((resolve) => setTimeout(resolve, 1))

      await new Promise<void>((resolve, reject) => {
        expect(didRequest).toBe(false)
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
      expect.assertions(3)

      let requestCount = 0
      nock(projectHost())
        .get('/v1/ping')
        .twice()
        .reply(() => {
          requestCount++
          return [200, {pong: true}]
        })

      const req = getClient().observable.request({uri: '/ping'})

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

    describe.skipIf(isEdge)('resource client', async () => {
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
                      nock(`https://${apiHost}`)
                        .get(
                          `/v${apiVersion || '1'}${resource.baseUrl}/query?${queryParams.toString()}`,
                        )
                        .reply(200, {result: doc})
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

                  nock(`https://${apiHost}`)
                    .post(base, {
                      mutations: [{create: doc}],
                    })
                    .reply(200, {
                      transactionId: 'abc123',
                      results: [
                        {
                          document: doc,
                          operation: 'create',
                        },
                      ],
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

                  nock(`https://${apiHost}`)
                    .post(base, {
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
                    })
                    .reply(200, {
                      transactionId: 'abc123',
                      results: [
                        {
                          document: doc,
                          operation: 'update',
                        },
                      ],
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

                  nock(`https://${apiHost}`)
                    .post(base, {
                      mutations: [
                        {patch: {id: 'foo', set: {bar: 123}}},
                        {createIfNotExists: {_id: '123', _type: 'baz'}},
                      ],
                    })
                    .reply(200, {
                      transactionId: 'abc123',
                      results: [
                        {
                          operation: 'update',
                        },
                      ],
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

                test.skipIf(!isNode)('uploads images using resource config', async () => {
                  const fixturePath = fixture('horsehead-nebula.jpg')
                  const isImage = (body: any) =>
                    Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

                  if (resource.type === 'media-library') {
                    nock(`https://${apiHost}`)
                      .post(`/v${apiVersion || '1'}${resource.baseUrl}/upload`, isImage)
                      .reply(201, {document: {url: 'https://some.asset.url'}})
                  } else {
                    nock(`https://${apiHost}`)
                      .post(`/v${apiVersion || '1'}${resource.baseUrl}/assets/images`, isImage)
                      .reply(201, {document: {url: 'https://some.asset.url'}})
                  }

                  const config: ClientConfig = {
                    apiHost: `https://${apiHost}`,
                    '~experimental_resource': resource,
                  }
                  if (apiVersion) {
                    config.apiVersion = apiVersion
                  }
                  const assetsClient = getClient(config).assets
                  if (resource.type === 'dataset') {
                    expect(() =>
                      assetsClient.upload('image', fs.createReadStream(fixturePath)),
                    ).toThrow(/Assets are not supported for dataset/i)
                  } else {
                    const document = await assetsClient.upload(
                      'image',
                      fs.createReadStream(fixturePath),
                    )
                    expect(document.url).toEqual('https://some.asset.url')
                  }
                })

                test('users: me', async () => {
                  nock(`https://${apiHost}`)
                    .get(`/v${apiVersion || '1'}/users/me`)
                    .reply(200, {id: 123})

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
                  nock(`https://${apiHost}`)
                    .get(`/v${apiVersion || '1'}/users/12345`)
                    .reply(200, {id: 123})

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
        nock(`https://${apiHost}`)
          .get('/v1/projects/myProjectid/datasets/myDatasetName/query?query=*&returnQuery=false')
          .reply(200, {result: doc})

        const client = createClient({
          useProjectHostname: false,
          apiHost: `https://${apiHost}`,
          '~experimental_resource': {type: 'dataset', id: 'myProjectid.myDatasetName'},
        })
        const resource = await client.fetch('*')
        expect(resource._id, 'should have resource id').toBe('mooblah')
      })

      test('fetch: perspective', async () => {
        nock(`https://${apiHost}`)
          .get('/v1/canvases/theResourceId/query?query=*&returnQuery=false&perspective=raw')
          .reply(200, {result: doc})

        const client = createClient({
          useProjectHostname: false,
          apiHost: `https://${apiHost}`,
          '~experimental_resource': {type: 'canvas', id: 'theResourceId'},
        })
        const resource = await client.fetch('*', {}, {perspective: 'raw'})
        expect(resource._id, 'should have resource id').toBe('mooblah')
      })

      test('mutate: create', async () => {
        nock(`https://${apiHost}`)
          .post(
            '/v1/canvases/theResourceId/mutate?returnIds=true&returnDocuments=true&visibility=sync',
            {
              mutations: [{create: doc}],
            },
          )
          .reply(200, {
            transactionId: 'abc123',
            results: [
              {
                document: doc,
                operation: 'create',
              },
            ],
          })

        const client = createClient({
          useProjectHostname: false,
          apiHost: `https://${apiHost}`,
          '~experimental_resource': {type: 'canvas', id: 'theResourceId'},
        })
        const resource = await client.create(doc)
        expect(resource._id, 'should have resource id').toBe('mooblah')
      })
      test.skipIf(isEdge)(
        'executes transaction using resource path when commit() is called',
        async () => {
          const mutations = [{create: {_type: 'foo', bar: true}}, {delete: {id: 'barfoo'}}]
          nock(`https://${apiHost}`)
            .post('/v1/canvases/res-id/mutate?returnIds=true&visibility=sync', {mutations})
            .reply(200, {transactionId: 'blatti'})

          const res = await getClient({'~experimental_resource': {type: 'canvas', id: 'res-id'}})
            .transaction()
            .create({_type: 'foo', bar: true})
            .delete('barfoo')
            .commit()
          expect(res.transactionId, 'applies given transaction').toEqual('blatti')
        },
      )

      test.skipIf(isEdge || !isNode)(
        'listeners connect to listen resource configured endpoint, emits events',
        async () => {
          expect.assertions(1)

          const response = [
            ':',
            '',
            'event: welcome',
            'data: {"listenerName":"LGFXwOqrf1GHawAjZRnhd6"}',
            '',
            'event: mutation',
            `data: ${JSON.stringify({result: doc})}`,
            '',
            'event: disconnect',
            'data: {"reason":"forcefully closed"}',
          ].join('\n')

          nock(`https://${apiHost}`)
            .get('/v1/media-libraries/res-id/listen?query=foo.bar&includeResult=true')
            .reply(200, response, {
              'cache-control': 'no-cache',
              'content-type': 'text/event-stream; charset=utf-8',
              'transfer-encoding': 'chunked',
            })

          const evt = await firstValueFrom(
            getClient({'~experimental_resource': {type: 'media-library', id: 'res-id'}}).listen(
              'foo.bar',
            ),
          )
          expect(evt.result).toEqual(doc)
        },
      )
    })
  })

  describe.skipIf(isEdge)('PROJECTS', () => {
    test('can request list of projects', async () => {
      nock(`https://${apiHost}`)
        .get('/v1/projects')
        .reply(200, [{id: 'foo'}, {id: 'bar'}])

      const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
      const projects = await client.projects.list()
      expect(projects.length, 'should have two projects').toBe(2)
      expect(projects[0].id, 'should have project id').toBe('foo')
    })

    test('can request list of projects with members', async () => {
      nock(`https://${apiHost}`)
        .get('/v1/projects')
        .times(2)
        .reply(200, [{id: 'foo'}, {id: 'bar'}])

      const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
      let projects = await client.projects.list({includeMembers: true})
      expect(projects.length, 'should have two projects').toBe(2)
      expect(projects[0].id, 'should have project id').toBe('foo')

      projects = await client.projects.list({includeMembers: undefined})
      expect(projects.length, 'should have two projects').toBe(2)
      expect(projects[0].id, 'should have project id').toBe('foo')
    })

    test('can request list of projects without members', async () => {
      nock(`https://${apiHost}`)
        .get('/v1/projects?includeMembers=false')
        .reply(200, [{id: 'foo'}, {id: 'bar'}])

      const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
      const projects = await client.projects.list({includeMembers: false})
      expect(projects.length, 'should have two projects').toBe(2)
      expect(projects[0].id, 'should have project id').toBe('foo')
      expect(projects[0]).not.toHaveProperty('members')

      // @ts-expect-error - `members` should not be part of type when using `includeMembers: false`
      expect(projects[0].members, 'should not have "members" prop').toBeUndefined()
    })

    test('can request list of projects for an organization', async () => {
      nock(`https://${apiHost}`)
        .get('/v1/projects?organizationId=org_123')
        .reply(200, [{id: 'foo'}, {id: 'bar'}])

      const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
      const projects = await client.projects.list({organizationId: 'org_123'})
      expect(projects.length, 'should have two projects').toBe(2)
      expect(projects[0].id, 'should have project id').toBe('foo')
    })

    test('can request list of projects, ignoring non-false `includeMembers` option', async () => {
      nock(`https://${apiHost}`)
        .get('/v1/projects')
        .reply(200, [{id: 'foo'}, {id: 'bar'}])

      const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})

      // @ts-expect-error - `includeMembers` should be a boolean if specified
      const projects = await client.projects.list({includeMembers: 'nope'})

      expect(projects.length, 'should have two projects').toBe(2)
      expect(projects[0].id, 'should have project id').toBe('foo')
    })

    test('can request list of projects (custom api version)', async () => {
      nock(`https://${apiHost}`)
        .get('/v2019-01-29/projects')
        .reply(200, [{id: 'foo'}, {id: 'bar'}])

      const client = createClient({
        useProjectHostname: false,
        apiHost: `https://${apiHost}`,
        apiVersion: '2019-01-29',
      })
      const projects = await client.projects.list()

      expect(projects.length, 'should have two projects').toBe(2)
      expect(projects[0].id, 'should have project id').toBe('foo')
    })

    test('can request project by id', async () => {
      const doc: Partial<SanityProject> = {
        id: 'n1f7y',
        displayName: 'Movies Unlimited',
        studioHost: 'movies',
        members: [
          {
            id: 'someuserid',
            role: 'administrator',
            isCurrentUser: true,
            isRobot: false,
          },
        ],
      }

      nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(200, doc)

      const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
      const project = await client.projects.getById('n1f7y')
      expect(project).toEqual(doc)
    })

    test.each([429, 502, 503])('automatically retries %d', async (code) => {
      const doc: Partial<SanityProject> = {
        id: 'n1f7y',
        displayName: 'Movies Unlimited',
        studioHost: 'movies',
        members: [
          {
            id: 'someuserid',
            role: 'administrator',
            isCurrentUser: true,
            isRobot: false,
          },
        ],
      }
      nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(code, {})
      nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(200, doc)
      const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
      const project = await client.projects.getById('n1f7y')
      expect(project).toEqual(doc)
    })

    test('throws when trying to create dataset with resource configured client', () => {
      expect(() =>
        getClient({'~experimental_resource': {type: 'dataset', id: 'p.d'}}).datasets.create(
          '*foo*',
        ),
      ).toThrow(/`dataset` does not support resource-based operations/i)
    })

    test('throws when trying to create dataset with resource configured client', () => {
      expect(() =>
        getClient({'~experimental_resource': {type: 'dataset', id: 'p.d'}}).datasets.delete(
          '*foo*',
        ),
      ).toThrow(/`dataset` does not support resource-based operations/i)
    })

    test('throws when trying to create dataset with resource configured client', () => {
      expect(() =>
        getClient({'~experimental_resource': {type: 'dataset', id: 'p.d'}}).datasets.edit('*foo*'),
      ).toThrow(/`dataset` does not support resource-based operations/i)
    })

    test('throws when trying to create dataset with resource configured client', () => {
      expect(() =>
        getClient({
          '~experimental_resource': {type: 'media-library', id: 'res-id'},
        }).datasets.list(),
      ).toThrow(/`dataset` does not support resource-based operations/i)
    })

    test.each([429, 502, 503])('can be configured to not retry %d', async (code) => {
      nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(code, {})
      const client = createClient({
        useProjectHostname: false,
        apiHost: `https://${apiHost}`,
        maxRetries: 0,
      })

      await expect(client.projects.getById('n1f7y')).rejects.toBeDefined()
    })

    test.each([429, 502, 503])('eventually gives up on retrying %d', async (code) => {
      for (let i = 0; i < 5; i++) {
        nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(code, {})
        nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(code, {})
        nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(code, {})
        nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(code, {})
        nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(code, {})
      }

      const client = createClient({
        useProjectHostname: false,
        apiHost: `https://${apiHost}`,
        retryDelay() {
          return 100
        },
      })
      await expect(client.projects.getById('n1f7y')).rejects.toBeDefined()
    })

    test.each([429, 502, 503])('retries requests %d', async (code) => {
      const userObj = {
        role: null,
        id: 'pabc123',
        name: 'Mannen i Gata',
        email: 'some@email.com',
      }

      for (let i = 0; i < 5; i++) {
        nock(`https://${apiHost}`).get('/v2023-03-25/users/me').reply(code, {})
        nock(`https://${apiHost}`).get('/v2023-03-25/users/me').reply(code, {})
        nock(`https://${apiHost}`).get('/v2023-03-25/users/me').reply(code, {})
        nock(`https://${apiHost}`).get('/v2023-03-25/users/me').reply(code, {})
        nock(`https://${apiHost}`).get('/v2023-03-25/users/me').reply(200, userObj)
      }

      const fn = vi.fn().mockReturnValue(100)
      const client = createClient({
        apiVersion: '2023-03-25',
        useProjectHostname: false,
        apiHost: `https://${apiHost}`,
        retryDelay: fn,
      })
      await expect(client.request({url: '/users/me'})).resolves.toEqual(userObj)
      expect(fn).toHaveBeenCalledTimes(4)
    })
  })

  describe('DATASETS', () => {
    const dsClient = getClient({requestTagPrefix: 'test'})

    test('throws when trying to create dataset with invalid name', () => {
      expect(() => dsClient.datasets.create('*foo*')).toThrow(/Datasets can only contain/i)
    })

    test('throws when trying to delete dataset with invalid name', () => {
      expect(() => dsClient.datasets.delete('*foo*')).toThrow(/Datasets can only contain/i)
    })

    test.skipIf(isEdge)('can create dataset', async () => {
      nock(projectHost()).put('/v1/datasets/bar').reply(200)
      await expect(dsClient.datasets.create('bar')).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('can delete dataset', async () => {
      nock(projectHost()).delete('/v1/datasets/bar').reply(200)
      await expect(dsClient.datasets.delete('bar')).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('can list datasets', async () => {
      nock(projectHost())
        .get('/v1/datasets')
        .reply(200, [{name: 'foo'}, {name: 'bar'}] as DatasetsResponse)
      await expect(dsClient.datasets.list()).resolves.toEqual([{name: 'foo'}, {name: 'bar'}])
    })

    test.skipIf(isEdge)('can list datasets with useProjectHostname=false', async () => {
      nock.cleanAll()
      const scope = nock(`https://${apiHost}`)
        .get(`/v1/projects/${defaultProjectId}/datasets`)
        .times(1) // ensure it's called exactly once
        .reply(200, [{name: 'foo'}, {name: 'bar'}] as DatasetsResponse)

      const client = getClient({useProjectHostname: false})
      await expect(client.datasets.list()).resolves.toEqual([{name: 'foo'}, {name: 'bar'}])

      expect(scope.isDone()).toBe(true) // all expectations satisfied
    })
  })

  describe('DATA', () => {
    const result = [{_id: 'njgNkngskjg', rating: 5}]
    const resultSourceMap = {
      documents: [
        {
          _id: 'njgNkngskjg',
          _type: 'beer',
        },
      ],
      paths: ["$['_id']", "$['rating']"],
      mappings: {
        "$[0]['_id']": {
          source: {
            document: 0,
            path: 0,
            type: 'documentValue',
          },
          type: 'value',
        },
        "$[0]['rating']": {
          source: {
            document: 0,
            path: 1,
            type: 'documentValue',
          },
          type: 'value',
        },
      },
    } satisfies ContentSourceMap
    test.skipIf(isEdge)('can query for documents', async () => {
      const query = 'beerfiesta.beer[.title == $beerName]'
      const params = {beerName: 'Headroom Double IPA'}
      const qs =
        'beerfiesta.beer%5B.title%20%3D%3D%20%24beerName%5D&%24beerName=%22Headroom%20Double%20IPA%22'

      nock(projectHost()).get(`/v1/data/query/foo?query=${qs}&returnQuery=false`).reply(200, {
        ms: 123,
        result,
      })

      const res = await getClient().fetch(query, params)
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('can query for documents and return full response', async () => {
      const query = 'beerfiesta.beer[.title == $beerName]'
      const params = {beerName: 'Headroom Double IPA'}
      const qs =
        'beerfiesta.beer%5B.title%20%3D%3D%20%24beerName%5D&%24beerName=%22Headroom%20Double%20IPA%22'

      nock(projectHost()).get(`/v1/data/query/foo?query=${qs}`).reply(200, {
        ms: 123,
        query,
        result,
      })

      const res = await getClient().fetch(query, params, {filterResponse: false})
      expect(res.ms, 'should include timing info').toBe(123)
      expect(res.query, 'should include query').toBe(query)
      expect(res.result.length, 'length should match').toBe(1)
      expect(res.result[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('can explicitly ask to include query in response', async () => {
      const query = 'beerfiesta.beer[.title == $beerName]'
      const params = {beerName: 'Headroom Double IPA'}
      const qs =
        'beerfiesta.beer%5B.title%20%3D%3D%20%24beerName%5D&%24beerName=%22Headroom%20Double%20IPA%22'

      nock(projectHost()).get(`/v1/data/query/foo?query=${qs}`).reply(200, {
        ms: 123,
        query,
        result,
      })

      const res = await getClient().fetch(query, params, {filterResponse: false, returnQuery: true})
      expect(res.ms, 'should include timing info').toBe(123)
      expect(res.query, 'should include query').toBe(query)
      expect(res.result.length, 'length should match').toBe(1)
      expect(res.result[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('gets helpful error messages on query errors (no tag)', async () => {
      const query = '*[_type == "event]'
      nock(projectHost())
        .get(`/v1/data/query/foo?query=${encodeURIComponent(query)}&returnQuery=false`)
        .reply(400, {
          error: {
            description: 'unexpected token "\\"event]", expected expression',
            end: 18,
            query: '*[_type == "event]',
            start: 11,
            type: 'queryParseError',
          },
        })

      await expect(getClient().fetch(query)).rejects.toThrowErrorMatchingInlineSnapshot(`
        [Error: GROQ query parse error:
        > 1 | *[_type == "event]
            |           ^^^^^^^ unexpected token "\\"event]", expected expression]
      `)
    })

    test.skipIf(isEdge)('gets helpful error messages on query errors (with tag)', async () => {
      const query = '*[_type == "event]'
      nock(projectHost())
        .get(
          `/v1/data/query/foo?query=${encodeURIComponent(query)}&returnQuery=false&tag=get-events`,
        )
        .reply(400, {
          error: {
            description: 'unexpected token "\\"event]", expected expression',
            end: 18,
            query: '*[_type == "event]',
            start: 11,
            type: 'queryParseError',
          },
        })

      await expect(getClient().fetch(query, {}, {tag: 'get-events'})).rejects
        .toThrowErrorMatchingInlineSnapshot(`
        [Error: GROQ query parse error:
        > 1 | *[_type == "event]
            |           ^^^^^^^ unexpected token "\\"event]", expected expression

        Tag: get-events]
      `)
    })

    test.skipIf(isEdge)('can query for documents with request tag', async () => {
      nock(projectHost())
        .get(`/v1/data/query/foo?query=*&tag=mycompany.syncjob&returnQuery=false`)
        .reply(200, {
          ms: 123,
          result,
        })

      const res = await getClient().fetch('*', {}, {tag: 'mycompany.syncjob'})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('can query for documents with last live event ID', async () => {
      nock(projectHost())
        .get(
          `/vX/data/query/foo?query=*&returnQuery=false&lastLiveEventId=MTA0MDM1Nnx2a2lQY200bnRHQQ`,
        )
        .reply(200, {
          ms: 123,
          result,
        })

      const res = await getClient({apiVersion: 'X'}).fetch(
        '*',
        {},
        {lastLiveEventId: 'MTA0MDM1Nnx2a2lQY200bnRHQQ'},
      )
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)(
      'allows passing last live event ID from Next.js style searchParams',
      async () => {
        nock(projectHost())
          .get(
            `/vX/data/query/foo?query=*&returnQuery=false&lastLiveEventId=MTA0MDM1Nnx2a2lQY200bnRHQQ`,
          )
          .reply(200, {
            ms: 123,
            result,
          })

        const res = await getClient({apiVersion: 'X'}).fetch(
          '*',
          {},
          // searchParams in Next.js will return an arry of strings in some cases,
          // as an convenience we allow it, and behave the same way as URLSearchParams.get() when that happens:
          // we pick the first value in the array
          {lastLiveEventId: ['MTA0MDM1Nnx2a2lQY200bnRHQQ', 'some-other-value']},
        )
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)(
      'allows passing last live event ID from URLSearchParams that might be null',
      async () => {
        nock(projectHost()).get(`/vX/data/query/foo?query=*&returnQuery=false`).reply(200, {
          ms: 123,
          result,
        })
        const searchParams = new URLSearchParams('')

        const res = await getClient({apiVersion: 'X'}).fetch(
          '*',
          {},
          // URLSearchParams.get() will return null if the key is not found, we should handle that
          {lastLiveEventId: searchParams.get('lastLiveEventId')},
        )
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)(
      'allows passing last live event ID from URLSearchParams that might be an empty string',
      async () => {
        nock(projectHost()).get(`/vX/data/query/foo?query=*&returnQuery=false`).reply(200, {
          ms: 123,
          result,
        })
        const searchParams = new URLSearchParams('lastLiveEventId=')

        const res = await getClient({apiVersion: 'X'}).fetch(
          '*',
          {},
          // URLSearchParams.get() will return null if the key is not found, we should handle that
          {lastLiveEventId: searchParams.get('lastLiveEventId')},
        )
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)(
      'can query for documents with resultSourceMap and perspective',
      async () => {
        nock(projectHost())
          .get(
            `/vX/data/query/foo?query=*&returnQuery=false&resultSourceMap=true&perspective=previewDrafts`,
          )
          .reply(200, {
            ms: 123,
            result,
            resultSourceMap,
          })

        const client = getClient({
          apiVersion: 'X',
          resultSourceMap: true,
          perspective: 'previewDrafts',
        })
        const res = await client.fetch('*', {})
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)(
      'can query for documents with resultSourceMap=withKeyArraySelector and perspective',
      async () => {
        nock(projectHost())
          .get(
            `/vX/data/query/foo?query=*&returnQuery=false&resultSourceMap=withKeyArraySelector&perspective=previewDrafts`,
          )
          .reply(200, {
            ms: 123,
            result,
            resultSourceMap,
          })

        const client = getClient({
          apiVersion: 'X',
          resultSourceMap: 'withKeyArraySelector',
          perspective: 'previewDrafts',
        })
        const res = await client.fetch('*', {})
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)('automatically useCdn false if perspective is previewDrafts', async () => {
      nock('https://abc123.api.sanity.io')
        .get(`/v1/data/query/foo?query=*&returnQuery=false&perspective=previewDrafts`)
        .reply(200, {
          ms: 123,
          result,
        })

      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        perspective: 'previewDrafts',
      })
      const res = await client.fetch('*', {})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)(
      'can query for documents with resultSourceMap and perspective using the third client.fetch parameter',
      async () => {
        nock(projectHost())
          .get(
            `/vX/data/query/foo?query=*&returnQuery=false&resultSourceMap=true&perspective=previewDrafts`,
          )
          .reply(200, {
            ms: 123,
            result,
            resultSourceMap,
          })

        const client = getClient({apiVersion: 'X'})
        const res = await client.fetch(
          '*',
          {},
          {resultSourceMap: true, perspective: 'previewDrafts'},
        )
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)(
      'setting resultSourceMap and perspective on client.fetch overrides the config',
      async () => {
        nock(projectHost())
          .get(`/vX/data/query/foo?query=*&returnQuery=false&perspective=published`)
          .reply(200, {
            ms: 123,
            result,
            resultSourceMap,
          })

        const client = getClient({
          apiVersion: 'X',
          resultSourceMap: true,
          perspective: 'previewDrafts',
        })
        const res = await client.fetch('*', {}, {resultSourceMap: false, perspective: 'published'})
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)(
      'setting a perspective previewDrafts override on client.fetch sets useCdn to false',
      async () => {
        nock('https://abc123.api.sanity.io')
          .get(`/v1/data/query/foo?query=*&returnQuery=false&perspective=previewDrafts`)
          .reply(200, {
            ms: 123,
            result,
          })

        const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})
        const res = await client.fetch('*', {}, {perspective: 'previewDrafts'})
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)('allow overriding useCdn to false on client.fetch', async () => {
      nock('https://abc123.api.sanity.io')
        .get(`/v1/data/query/foo?query=*&returnQuery=false`)
        .reply(200, {
          ms: 123,
          result,
        })

      const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})
      const res = await client.fetch('*', {}, {useCdn: false})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('allow overriding useCdn to true on client.fetch', async () => {
      nock('https://abc123.apicdn.sanity.io')
        .get(`/v1/data/query/foo?query=*&returnQuery=false`)
        .reply(200, {
          ms: 123,
          result,
        })

      const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: false})
      const res = await client.fetch('*', {}, {useCdn: true})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('throws on invalid request tag on request', () => {
      expect(() => {
        getClient().fetch('*', {}, {tag: 'mycompany syncjob ok'})
      }).toThrow(/tag can only contain alphanumeric/i)
    })

    test.skipIf(isEdge)('can use a tag-prefixed client', async () => {
      nock(projectHost())
        .get(`/v1/data/query/foo?query=*&returnQuery=false&tag=mycompany.syncjob`)
        .reply(200, {
          ms: 123,
          query: '*',
          result,
        })

      const res = await getClient({requestTagPrefix: 'mycompany'}).fetch('*', {}, {tag: 'syncjob'})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('can query using cacheMode=noStale using APICDN', async () => {
      nock('https://abc123.apicdn.sanity.io')
        .get(`/v1/data/query/foo?query=*&returnQuery=false&cacheMode=noStale`)
        .reply(200, {
          ms: 123,
          result,
        })

      const client = createClient({projectId: 'abc123', dataset: 'foo'})
      const res = await client.fetch('*', {}, {cacheMode: 'noStale'})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('cacheMode is ignored when useCdn:false', async () => {
      nock('https://abc123.api.sanity.io')
        .get(`/v1/data/query/foo?query=*&returnQuery=false`)
        .reply(200, {
          ms: 123,
          result,
        })

      const client = createClient({projectId: 'abc123', dataset: 'foo'})
      const res = await client.fetch('*', {}, {cacheMode: 'noStale', useCdn: false})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('handles api errors gracefully', async () => {
      expect.assertions(4)

      const response = {
        statusCode: 403,
        error: 'Forbidden',
        message: 'You are not allowed to access this resource',
      }

      nock(projectHost())
        .get('/v1/data/query/foo?query=area51&returnQuery=false')
        .times(5)
        .reply(403, response)

      try {
        await getClient().fetch('area51')
      } catch (err: any) {
        expect(err, 'should be error').toBeInstanceOf(Error)
        expect(err.message, 'should contain error code').toContain(response.error)
        expect(err.message, 'should contain error message').toContain(response.message)
        expect(err.responseBody, 'responseBody should be populated').toContain(response.message)
      }
    })

    test.skipIf(isEdge)('handles db errors gracefully', async () => {
      expect.assertions(4)

      const response = {
        error: {
          column: 13,
          line: 'foo.bar.baz  12#[{',
          lineNumber: 1,
          description: 'Unable to parse entire expression',
          query: 'foo.bar.baz  12#[{',
          type: 'gqlParseError',
        },
      }

      nock(projectHost())
        .get('/v1/data/query/foo?query=foo.bar.baz%20%2012%23%5B%7B&returnQuery=false')
        .reply(400, response)

      try {
        await getClient().fetch('foo.bar.baz  12#[{')
      } catch (err: any) {
        expect(err, 'should be error').toBeInstanceOf(Error)
        expect(err.message, 'should contain error description').toContain(
          response.error.description,
        )
        expect(err.details.column, 'error should have details object').toBe(response.error.column)
        expect(err.details.line, 'error should have details object').toBe(response.error.line)
      }
    })

    describe.skipIf(isEdge || typeof globalThis.AbortController === 'undefined')(
      'can cancel request with an abort controller signal',
      () => {
        test('client.fetch', async () => {
          expect.assertions(2)

          nock(projectHost()).get(`/v1/data/query/foo?query=*`).delay(100).reply(200, {
            ms: 123,
            query: '*',
            result: [],
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

          nock(projectHost())
            .get('/v1/data/doc/foo/abc123dfg')
            .delay(100)
            .reply(200, {
              ms: 123,
              documents: [{_id: 'abc123dfg', mood: 'lax'}],
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

          nock(projectHost())
            .get(`/v1/data/doc/foo/${versionId}`)
            .reply(200, {
              ms: 123,
              documents: [{_id: versionId, mood: 'excited'}],
            })

          const doc = await getClient().getDocument(documentId, {releaseId})
          expect(doc?._id).toBe(versionId)
          expect(doc?.mood).toBe('excited')
        })

        test('client.getDocument with matching releaseId for existing version id', async () => {
          const documentId = 'abc123'
          const releaseId = 'release456'
          const versionId = `versions.${releaseId}.${documentId}`

          nock(projectHost())
            .get(`/v1/data/doc/foo/${versionId}`)
            .reply(200, {
              ms: 123,
              documents: [{_id: versionId, mood: 'content'}],
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

          nock(projectHost())
            .get('/v1/data/doc/foo/abc123dfg,abc321dfg')
            .delay(100)
            .reply(200, {
              ms: 123,
              documents: [
                {_id: 'abc123dfg', mood: 'lax'},
                {_id: 'abc321dfg', mood: 'tense'},
              ],
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

    test.skipIf(isEdge)('can query for single document', async () => {
      nock(projectHost())
        .get('/v1/data/doc/foo/abc123')
        .reply(200, {
          ms: 123,
          documents: [{_id: 'abc123', mood: 'lax'}],
        })

      await expect(getClient().getDocument('abc123'), 'data should match').resolves.toMatchObject({
        mood: 'lax',
      })
    })

    test.skipIf(isEdge)('can query for single document using resource config', async () => {
      nock(`https://${apiHost}`)
        .get('/v1/media-libraries/res-id/doc/abc123')
        .reply(200, {
          ms: 123,
          documents: [{_id: 'abc123', mood: 'lax'}],
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
      nock(projectHost())
        .get('/v1/data/doc/foo/abc123?tag=some.tag')
        .reply(200, {
          ms: 123,
          documents: [{_id: 'abc123', mood: 'lax'}],
        })

      await expect(
        getClient().getDocument('abc123', {tag: 'some.tag'}),
        'data should match',
      ).resolves.toMatchObject({
        mood: 'lax',
      })
    })

    test.skipIf(isEdge)('can query for multiple documents', async () => {
      nock(projectHost())
        .get('/v1/data/doc/foo/abc123,abc321')
        .reply(200, {
          ms: 123,
          documents: [
            {_id: 'abc123', mood: 'lax'},
            {_id: 'abc321', mood: 'tense'},
          ],
        })

      const [abc123, abc321] = await getClient().getDocuments(['abc123', 'abc321'])
      expect(abc123!.mood, 'data should match').toBe('lax')
      expect(abc321!.mood, 'data should match').toBe('tense')
    })

    test.skipIf(isEdge)('can query for multiple documents with tag', async () => {
      nock(projectHost())
        .get('/v1/data/doc/foo/abc123,abc321?tag=mood.docs')
        .reply(200, {
          ms: 123,
          documents: [
            {_id: 'abc123', mood: 'lax'},
            {_id: 'abc321', mood: 'tense'},
          ],
        })

      const [abc123, abc321] = await getClient().getDocuments(['abc123', 'abc321'], {
        tag: 'mood.docs',
      })
      expect(abc123!.mood, 'data should match').toBe('lax')
      expect(abc321!.mood, 'data should match').toBe('tense')
    })

    test.skipIf(isEdge)('preserves the position of requested documents', async () => {
      nock(projectHost())
        .get('/v1/data/doc/foo/abc123,abc321,abc456')
        .reply(200, {
          ms: 123,
          documents: [
            {_id: 'abc456', mood: 'neutral'},
            {_id: 'abc321', mood: 'tense'},
          ],
        })

      const [abc123, abc321, abc456] = await getClient().getDocuments([
        'abc123',
        'abc321',
        'abc456',
      ])
      expect(abc123, 'first item should be null').toBeNull()
      expect(abc321!.mood, 'data should match').toBe('tense')
      expect(abc456!.mood, 'data should match').toBe('neutral')
    })

    test.skipIf(isEdge)(
      'gives http statuscode as error if no body is present on errors',
      async () => {
        expect.assertions(2)

        nock(projectHost()).get('/v1/data/doc/foo/abc123').reply(400)

        try {
          await getClient().getDocument('abc123')
        } catch (err: any) {
          expect(err, 'should be error').toBeInstanceOf(Error)
          expect(err.message, 'should contain status code').toContain('HTTP 400')
        }
      },
    )

    test.skipIf(isEdge)(
      'includes body if expected JSON object not returned on errors',
      async () => {
        expect.assertions(2)

        nock(projectHost())
          .get('/v1/data/doc/foo/abc123')
          .reply(400, 'Some string short enough to inline fully')

        try {
          await getClient().getDocument('abc123')
        } catch (err: any) {
          expect(err, 'should be error').toBeInstanceOf(Error)
          expect(err.message).toContain('HTTP 400 (Some string short enough to inline fully)')
        }
      },
    )

    test.skipIf(isEdge)(
      'includes part of body if expected JSON object not returned on errors',
      async () => {
        expect.assertions(2)

        nock(projectHost())
          .get('/v1/data/doc/foo/abc123')
          .reply(
            400,
            'Some long string that should be capped at 100 characters because it seems odd to have the entire string if it is like HTML or something',
          )

        try {
          await getClient().getDocument('abc123')
        } catch (err: any) {
          expect(err, 'should be error').toBeInstanceOf(Error)
          expect(err.message).toContain(
            'HTTP 400 (Some long string that should be capped at 100 characters because it seems odd to have the entire str…)',
          )
        }
      },
    )

    test.skipIf(isEdge)('uses `error` property as error if present and is string', async () => {
      expect.assertions(2)

      nock(projectHost()).get('/v1/data/doc/foo/abc123').reply(400, {error: 'Some error'})

      try {
        await getClient().getDocument('abc123')
      } catch (err: any) {
        expect(err, 'should be error').toBeInstanceOf(Error)
        expect(err.message).toBe('Some error')
      }
    })

    test.skipIf(isEdge)('uses `message` property as error if present and is string', async () => {
      expect.assertions(2)

      nock(projectHost()).get('/v1/data/doc/foo/abc123').reply(400, {message: 'Some other error'})

      try {
        await getClient().getDocument('abc123')
      } catch (err: any) {
        expect(err, 'should be error').toBeInstanceOf(Error)
        expect(err.message).toBe('Some other error')
      }
    })

    test.skipIf(isEdge)('falls back to HTTP error code if error shape is unknown', async () => {
      expect.assertions(2)

      nock(projectHost())
        .get('/v1/data/doc/foo/abc123')
        .reply(400, {error: {hmm: 'what is this'}})

      try {
        await getClient().getDocument('abc123')
      } catch (err: any) {
        expect(err, 'should be error').toBeInstanceOf(Error)
        expect(err.message).toContain('resulted in HTTP 400')
      }
    })

    test.skipIf(isEdge)('populates response body on errors', async () => {
      expect.assertions(3)

      nock(projectHost()).get('/v1/data/doc/foo/abc123').times(5).reply(400, 'Some Weird Error')

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

    test.skipIf(isEdge)('can create documents', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}

      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
          mutations: [{create: doc}],
        })
        .reply(200, {
          transactionId: 'abc123',
          results: [
            {
              document: {_id: 'abc123', _createdAt: '2016-10-24T08:09:32.997Z', name: 'Raptor'},
              operation: 'create',
            },
          ],
        })

      const res = await getClient().create(doc)
      expect(res._id, 'document id returned').toBe(doc._id)
      expect(res._createdAt, 'server-generated attributes are included').toBeTruthy()
    })

    test.skipIf(isEdge)('can create documents without specifying ID', async () => {
      const doc = {_type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{create: {...doc}}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {
          transactionId: '123abc',
          results: [
            {
              id: 'abc456',
              document: {_id: 'abc456', name: 'Raptor'},
            },
          ],
        })

      const res = await getClient().create(doc)
      expect(res._id, 'document id returned').toBe('abc456')
    })

    test.skipIf(isEdge)('can create documents with request tag', async () => {
      const doc = {_type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{create: {...doc}}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?tag=dino.import&returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {
          transactionId: '123abc',
          results: [
            {
              id: 'abc456',
              document: {_id: 'abc456', name: 'Raptor'},
            },
          ],
        })

      const res = await getClient().create(doc, {tag: 'dino.import'})
      expect(res._id, 'document id returned').toBe('abc456')
    })

    test.skipIf(isEdge)('can tell create() not to return documents', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&visibility=sync', {mutations: [{create: doc}]})
        .reply(200, {transactionId: 'abc123', results: [{id: 'abc123', operation: 'create'}]})

      const res = await getClient().create(doc, {returnDocuments: false})
      expect(res.transactionId, 'returns transaction ID').toEqual('abc123')
      expect(res.documentId, 'returns document id').toEqual('abc123')
    })

    test.skipIf(isEdge)('can tell create() to use non-default visibility mode', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=async', {
          mutations: [{create: doc}],
        })
        .reply(200, {
          transactionId: 'abc123',
          results: [{id: 'abc123', document: doc, operation: 'create'}],
        })

      const res = await getClient().create(doc, {visibility: 'async'})
      expect(res._id, 'document id returned').toEqual('abc123')
    })

    test.skipIf(isEdge)('can tell create() to auto-generate array keys', async () => {
      const doc = {
        _id: 'abc123',
        _type: 'post',
        name: 'Dromaeosauridae',
        genus: [{_type: 'dino', name: 'Velociraptor'}],
      }
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&autoGenerateArrayKeys=true&visibility=sync',
          {
            mutations: [{create: doc}],
          },
        )
        .reply(200, {
          transactionId: 'abc123',
          results: [
            {
              id: 'abc123',
              document: {...doc, genus: [{...doc.genus[0], _key: 'r4p70r'}]},
              operation: 'create',
            },
          ],
        })

      const res = await getClient().create(doc, {autoGenerateArrayKeys: true})
      expect(res._id, 'document id returned').toEqual('abc123')
      // typings don't support the implicit `_key` on arrays, yet
      expect((res.genus[0] as any)._key, 'array keys generated returned').toEqual('r4p70r')
    })

    test.skipIf(isEdge)('can tell create() to do a dry-run', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Dromaeosauridae'}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?dryRun=true&returnIds=true&returnDocuments=true&visibility=sync',
          {
            mutations: [{create: doc}],
          },
        )
        .reply(200, {
          transactionId: 'abc123',
          results: [
            {
              id: 'abc123',
              document: doc,
              operation: 'create',
            },
          ],
        })

      const res = await getClient().create(doc, {dryRun: true})
      expect(res._id, 'document id returned').toEqual('abc123')
    })

    test.skipIf(isEdge)('createIfNotExists() sends correct mutation', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{createIfNotExists: doc}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {
          transactionId: '123abc',
          results: [{id: 'abc123', document: doc, operation: 'create'}],
        })

      await expect(getClient().createIfNotExists(doc)).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('can tell createIfNotExists() not to return documents', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{createIfNotExists: doc}]}
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&visibility=sync', expectedBody)
        .reply(200, {transactionId: 'abc123', results: [{id: 'abc123', operation: 'create'}]})

      const res = await getClient().createIfNotExists(doc, {returnDocuments: false})
      expect(res.transactionId, 'returns transaction ID').toEqual('abc123')
      expect(res.documentId, 'returns document id').toEqual('abc123')
    })

    test.skipIf(isEdge)('can use request tag with createIfNotExists()', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{createIfNotExists: doc}]}
      nock(projectHost())
        .post('/v1/data/mutate/foo?tag=mysync&returnIds=true&visibility=sync', expectedBody)
        .reply(200, {transactionId: 'abc123', results: [{id: 'abc123', operation: 'create'}]})

      const res = await getClient().createIfNotExists(doc, {
        returnDocuments: false,
        tag: 'mysync',
      })
      expect(res.transactionId, 'returns transaction ID').toEqual('abc123')
      expect(res.documentId, 'returns document id').toEqual('abc123')
    })

    test.skipIf(isEdge)('createOrReplace() sends correct mutation', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{createOrReplace: doc}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: '123abc', results: [{id: 'abc123', operation: 'create'}]})

      await expect(getClient().createOrReplace(doc)).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('can tell createOrReplace() not to return documents', async () => {
      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{createOrReplace: doc}]}
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&visibility=sync', expectedBody)
        .reply(200, {transactionId: 'abc123', results: [{id: 'abc123', operation: 'create'}]})

      const res = await getClient().createOrReplace(doc, {returnDocuments: false})
      expect(res.transactionId, 'returns transaction ID').toEqual('abc123')
      expect(res.documentId, 'returns document id').toEqual('abc123')
    })

    test.skipIf(isEdge)('delete() sends correct mutation', async () => {
      const expectedBody = {mutations: [{delete: {id: 'abc123'}}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: 'abc123', results: [{id: 'abc123', operation: 'delete'}]})

      await expect(getClient().delete('abc123')).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('delete() can use query', async () => {
      const expectedBody = {mutations: [{delete: {query: 'foo.sometype'}}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: 'abc123'})

      await expect(getClient().delete({query: 'foo.sometype'})).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('delete() can use request tag', async () => {
      const expectedBody = {mutations: [{delete: {id: 'abc123'}}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?tag=delete.abc&returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: 'abc123', results: [{id: 'abc123', operation: 'delete'}]})

      await expect(getClient().delete('abc123', {tag: 'delete.abc'})).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('delete() can use query with params', async () => {
      const query = '*[_type == "beer" && title == $beerName]'
      const params = {beerName: 'Headroom Double IPA'}
      const expectedBody = {mutations: [{delete: {query, params: params}}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: 'abc123'})

      await expect(getClient().delete({query, params: params})).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('delete() can be told not to return documents', async () => {
      const expectedBody = {mutations: [{delete: {id: 'abc123'}}]}
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&visibility=sync', expectedBody)
        .reply(200, {transactionId: 'abc123', results: [{id: 'abc123', operation: 'delete'}]})

      await expect(getClient().delete('abc123', {returnDocuments: false})).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('mutate() accepts multiple mutations', async () => {
      const docs = [
        {
          _id: 'movies.raiders-of-the-lost-ark',
          _type: 'movie',
          title: 'Raiders of the Lost Ark',
          year: 1981,
        },
        {
          _id: 'movies.the-phantom-menace',
          _type: 'movie',
          title: 'Star Wars: Episode I - The Phantom Menace',
          year: 1999,
        },
      ]

      const mutations = [{create: docs[0]}, {delete: {id: 'movies.the-phantom-menace'}}]

      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
          mutations,
        })
        .reply(200, {
          transactionId: 'foo',
          results: [
            {id: 'movies.raiders-of-the-lost-ark', operation: 'create', document: docs[0]},
            {id: 'movies.the-phantom-menace', operation: 'delete', document: docs[1]},
          ],
        })

      await expect(getClient().mutate(mutations)).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('mutate() accepts request tag', async () => {
      const mutations = [{delete: {id: 'abc123'}}]

      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?tag=foobar&returnIds=true&returnDocuments=true&visibility=sync',
          {
            mutations,
          },
        )
        .reply(200, {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'delete', document: {_id: 'abc123'}}],
        })

      await expect(getClient().mutate(mutations, {tag: 'foobar'})).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('mutate() accepts transaction id', async () => {
      const mutations = [{delete: {id: 'abc123'}}]

      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
          mutations,
          transactionId: 'spec-ific',
        })
        .reply(200, {
          transactionId: 'spec-ific',
          results: [{id: 'abc123', operation: 'delete', document: {_id: 'abc123'}}],
        })

      await expect(
        getClient().mutate(mutations, {transactionId: 'spec-ific'}),
      ).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('mutate() accepts `autoGenerateArrayKeys`', async () => {
      const mutations = [
        {
          create: {
            _id: 'abc123',
            _type: 'post',
            items: [{_type: 'block', children: [{_type: 'span', text: 'Hello there'}]}],
          },
        },
      ]

      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync&autoGenerateArrayKeys=true',
          {mutations},
        )
        .reply(200, {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'create', document: {_id: 'abc123'}}],
        })

      await expect(
        getClient().mutate(mutations, {autoGenerateArrayKeys: true}),
      ).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('mutate() accepts `dryRun`', async () => {
      const mutations = [{create: {_id: 'abc123', _type: 'post'}}]

      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?dryRun=true&returnIds=true&returnDocuments=true&visibility=sync',
          {
            mutations,
          },
        )
        .reply(200, {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'create', document: {_id: 'abc123'}}],
        })

      await expect(getClient().mutate(mutations, {dryRun: true})).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('mutate() accepts `skipCrossDatasetReferenceValidation`', async () => {
      const mutations = [{delete: {id: 'abc123'}}]

      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?tag=foobar&returnIds=true&returnDocuments=true&visibility=sync&skipCrossDatasetReferenceValidation=true',
          {mutations},
        )
        .reply(200, {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'delete', document: {_id: 'abc123'}}],
        })

      await expect(
        getClient().mutate(mutations, {tag: 'foobar', skipCrossDatasetReferenceValidation: true}),
      ).resolves.not.toThrow()
    })

    test.skipIf(isEdge)(
      'mutate() skips/falls back to defaults on undefined but known properties',
      async () => {
        const mutations = [{delete: {id: 'abc123'}}]

        nock(projectHost())
          .post(
            '/v1/data/mutate/foo?tag=foobar&returnIds=true&returnDocuments=true&visibility=sync',
            {
              mutations,
            },
          )
          .reply(200, {
            transactionId: 'foo',
            results: [{id: 'abc123', operation: 'delete', document: {_id: 'abc123'}}],
          })

        await expect(
          getClient().mutate(mutations, {
            tag: 'foobar',
            skipCrossDatasetReferenceValidation: undefined,
            returnDocuments: undefined,
            autoGenerateArrayKeys: undefined,
          }),
        ).resolves.not.toThrow()
      },
    )

    test.skipIf(isEdge)('action() performs single operation', async () => {
      const action: CreateAction = {
        actionType: 'sanity.action.document.create',
        publishedId: 'post1',
        attributes: {_id: 'post1', _type: 'post'},
        ifExists: 'fail',
      }

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [action],
        })
        .reply(200, {
          transactionId: 'foo',
        })

      await expect(getClient().action(action)).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('action() performs multiple operations', async () => {
      const action1: CreateAction = {
        actionType: 'sanity.action.document.create',
        publishedId: 'post1',
        attributes: {_id: 'post1', _type: 'post'},
        ifExists: 'fail',
      }

      const action2: ReplaceDraftAction = {
        actionType: 'sanity.action.document.replaceDraft',
        publishedId: 'post2',
        attributes: {_id: 'post2', _type: 'post'},
      }

      const action3: EditAction = {
        actionType: 'sanity.action.document.edit',
        draftId: 'drafts.post3',
        publishedId: 'post3',
        patch: {
          set: {count: 1},
        },
      }

      const action4: DeleteAction = {
        actionType: 'sanity.action.document.delete',
        publishedId: 'post4',
        includeDrafts: ['drafts.post4'],
        purge: true,
      }

      const action5: DiscardAction = {
        actionType: 'sanity.action.document.discard',
        draftId: 'drafts.post5',
        purge: true,
      }

      const action6: PublishAction = {
        actionType: 'sanity.action.document.publish',
        draftId: 'drafts.post6',
        ifDraftRevisionId: 'rev7',
        publishedId: 'post6',
        ifPublishedRevisionId: 'rev6',
      }

      const action7: UnpublishAction = {
        actionType: 'sanity.action.document.unpublish',
        draftId: 'drafts.post7',
        publishedId: 'post7',
      }

      nock(projectHost())
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: TS is wrong here, it is not able to infer the correct type for
        // edit action patch interface.
        .post('/v1/data/actions/foo', {
          actions: [action1, action2, action3, action4, action5, action6, action7],
        })
        .reply(200, {
          transactionId: 'foo',
        })

      await expect(
        getClient().action([action1, action2, action3, action4, action5, action6, action7]),
      ).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('action() accepts optional parameters', async () => {
      const action: CreateAction = {
        actionType: 'sanity.action.document.create',
        publishedId: 'post1',
        attributes: {_id: 'post1', _type: 'post'},
        ifExists: 'fail',
      }

      const options: BaseActionOptions = {
        transactionId: 'txn1',
        skipCrossDatasetReferenceValidation: true,
        dryRun: true,
      }

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [action],
          transactionId: 'txn1',
          skipCrossDatasetReferenceValidation: true,
          dryRun: true,
        })
        .reply(200, {
          transactionId: 'txn1',
        })

      await expect(getClient().action(action, options)).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('action() handles undefined optional parameters gracefully', async () => {
      const action: CreateAction = {
        actionType: 'sanity.action.document.create',
        publishedId: 'post1',
        attributes: {_id: 'post1', _type: 'post'},
        ifExists: 'fail',
      }

      const options: BaseActionOptions = {
        transactionId: undefined,
        skipCrossDatasetReferenceValidation: undefined,
        dryRun: undefined,
      }

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [action],
        })
        .reply(200, {
          transactionId: 'foo',
        })

      await expect(getClient().action(action, options)).resolves.not.toThrow()
    })

    test.skipIf(isEdge)('uses GET for queries below limit', async () => {
      // Please dont ever do this. Just... don't.
      const clause: string[] = []
      const qParams: Record<string, string> = {}
      const params: Record<string, string> = {}
      for (let i = 1950; i <= 2016; i++) {
        clause.push(`title == $beerName${i}`)
        params[`beerName${i}`] = `some beer ${i}`
        qParams[`$beerName${i}`] = JSON.stringify(`some beer ${i}`)
      }

      // Again, just... don't do this.
      const query = `*[_type == "beer" && (${clause.join(' || ')})]`

      nock(projectHost())
        .get('/v1/data/query/foo')
        .query({query, ...qParams, returnQuery: 'false'})
        .reply(200, {
          ms: 123,
          result,
        })

      const res = await getClient().fetch(query, params)
      expect(res.length, 'length should match').toEqual(1)
      expect(res[0].rating, 'data should match').toEqual(5)
    })

    test.skipIf(isEdge)('uses POST for long queries', async () => {
      // Please dont ever do this. Just... don't.
      const clause: string[] = []
      const params: Record<string, string> = {}
      for (let i = 1766; i <= 2016; i++) {
        clause.push(`title == $beerName${i}`)
        params[`beerName${i}`] = `some beer ${i}`
      }

      // Again, just... don't do this.
      const query = `*[_type == "beer" && (${clause.join(' || ')})]`

      const expectedBody = JSON.stringify({query, params})
      nock(projectHost()).post('/v1/data/query/foo?returnQuery=false', expectedBody).reply(200, {
        ms: 123,
        query,
        result,
      })

      const res = await getClient().fetch(query, params)
      expect(res.length, 'length should match').toEqual(1)
      expect(res[0].rating, 'data should match').toEqual(5)
    })

    test.skipIf(isEdge).each([429, 502, 503])('retries %d even if they are POST', async (code) => {
      // Please dont ever do this. Just... don't.
      const clause: string[] = []
      const params: Record<string, string> = {}
      for (let i = 1766; i <= 2016; i++) {
        clause.push(`title == $beerName${i}`)
        params[`beerName${i}`] = `some beer ${i}`
      }

      // Again, just... don't do this.
      const query = `*[_type == "beer" && (${clause.join(' || ')})]`
      const expectedBody = JSON.stringify({query, params})

      nock(projectHost()).post('/v1/data/query/foo?returnQuery=false', expectedBody).reply(code, {})

      nock(projectHost()).post('/v1/data/query/foo?returnQuery=false', expectedBody).reply(200, {
        ms: 123,
        result,
      })

      const res = await getClient().fetch(query, params)
      expect(res.length, 'length should match').toEqual(1)
      expect(res[0].rating, 'data should match').toEqual(5)
    })

    test.skipIf(isEdge)(
      'uses POST for long queries, but puts request tag as query param',
      async () => {
        const clause: string[] = []
        const params: Record<string, string> = {}
        for (let i = 1766; i <= 2016; i++) {
          clause.push(`title == $beerName${i}`)
          params[`beerName${i}`] = `some beer ${i}`
        }

        // Again, just... don't do this.
        const query = `*[_type == "beer" && (${clause.join(' || ')})]`
        const expectedBody = JSON.stringify({query, params})

        nock(projectHost())
          .post('/v1/data/query/foo?tag=myapp.silly-query&returnQuery=false', expectedBody)
          .reply(200, {
            ms: 123,
            query,
            result,
          })

        const res = await getClient().fetch(query, params, {tag: 'myapp.silly-query'})
        expect(res.length, 'length should match').toEqual(1)
        expect(res[0].rating, 'data should match').toEqual(5)
      },
    )

    test.skipIf(isEdge)(
      'uses POST for long queries, but puts resultSourceMap and perspective as query params',
      async () => {
        const clause: string[] = []
        const params: Record<string, string> = {}
        for (let i = 1766; i <= 2016; i++) {
          clause.push(`title == $beerName${i}`)
          params[`beerName${i}`] = `some beer ${i}`
        }

        // Again, just... don't do this.
        const query = `*[_type == "beer" && (${clause.join(' || ')})]`
        const expectedBody = JSON.stringify({query, params})

        nock(projectHost())
          .post(
            '/vX/data/query/foo?resultSourceMap=true&perspective=previewDrafts&returnQuery=false',
            expectedBody,
          )
          .reply(200, {
            ms: 123,
            query,
            result,
            resultSourceMap,
          })

        const client = getClient({
          apiVersion: 'X',
          perspective: 'previewDrafts',
          resultSourceMap: true,
        })
        const res = await client.fetch(query, params)
        expect(res.length, 'length should match').toEqual(1)
        expect(res[0].rating, 'data should match').toEqual(5)
      },
    )

    test.skipIf(isEdge)('uses POST for long queries also towards CDN', async () => {
      const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})

      const clause: string[] = []
      const params: Record<string, string> = {}
      for (let i = 1766; i <= 2016; i++) {
        clause.push(`title == $beerName${i}`)
        params[`beerName${i}`] = `some beer ${i}`
      }

      const query = `*[_type == "beer" && (${clause.join(' || ')})]`
      //const expectedBody = JSON.stringify({query, params})

      nock('https://abc123.apicdn.sanity.io')
        .filteringRequestBody(/.*/, '*')
        .post('/v1/data/query/foo?returnQuery=false', '*')
        .reply(200, {
          ms: 123,
          query,
          result,
        })

      const res = await client.fetch(query, params)
      expect(res.length, 'length should match').toEqual(1)
      expect(res[0].rating, 'data should match').toEqual(5)
    })

    describe.skipIf(isEdge)('createVersion()', () => {
      test('can create version of a document with publishedId', async () => {
        const document = {_type: 'post', title: 'Draft version'}
        const publishedId = 'pub123'
        const expectedVersionId = `drafts.${publishedId}`

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId,
                document: {...document, _id: expectedVersionId},
              },
            ],
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({document, publishedId})
        expect(res.transactionId).toEqual('abc123')
      })

      test('can create version of a document with releaseId', async () => {
        const document = {_type: 'post', title: 'Release version'}
        const publishedId = 'pub123'
        const releaseId = 'release456'
        const expectedVersionId = `versions.${releaseId}.${publishedId}`

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId,
                document: {...document, _id: expectedVersionId},
              },
            ],
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({document, publishedId, releaseId})
        expect(res.transactionId).toEqual('abc123')
      })

      test('can create version with additional options', async () => {
        const document = {_type: 'post', title: 'With options'}
        const publishedId = 'pub123'
        const expectedVersionId = `drafts.${publishedId}`
        const options = {
          skipCrossDatasetReferenceValidation: true,
          dryRun: true,
        }

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId,
                document: {...document, _id: expectedVersionId},
              },
            ],
            skipCrossDatasetReferenceValidation: true,
            dryRun: true,
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({document, publishedId}, options)
        expect(res.transactionId).toEqual('abc123')
      })

      test('handles errors when creating versions', async () => {
        const document = {_type: 'post', title: 'Error test'}
        const publishedId = 'pub123'

        nock(projectHost()).post('/v1/data/actions/foo').replyWithError('Network error occurred')

        await expect(getClient().createVersion({document, publishedId})).rejects.toThrowError()
      })

      test('throws when creating version of a document that is missing _type', async () => {
        const document = {title: 'Missing type'} as any
        const publishedId = 'pub123'

        let error: Error | null = null
        try {
          await getClient().createVersion({document, publishedId})
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          '`createVersion()` requires that the document contains a type',
        )
      })

      test('throws when draft document ID does not match generated version ID', async () => {
        const document = {_id: 'drafts.wrongId123', _type: 'post', title: 'Mismatch draft'}
        const publishedId = 'pub123'
        // This will generate drafts.pub123 which doesn't match document._id

        let error: Error | null = null
        try {
          await getClient().createVersion({document, publishedId})
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          'The provided document ID (`drafts.wrongId123`) does not match the generated version ID (`drafts.pub123`)',
        )
      })

      test('throws when version document ID does not match generated version ID', async () => {
        const document = {
          _id: 'versions.wrongRelease.wrongId123',
          _type: 'post',
          title: 'Mismatch draft',
        }
        const publishedId = 'pub123'
        const releaseId = 'release456'
        // This will generate versions.release456.pub123 which doesn't match document._id

        let error: Error | null = null
        try {
          await getClient().createVersion({document, publishedId, releaseId})
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          'The provided document ID (`versions.wrongRelease.wrongId123`) does not match the generated version ID (`versions.release456.pub123`)',
        )
      })

      test('throws when neither publishedId nor document._id are provided', async () => {
        // no _id passed in document
        const document = {_type: 'post', title: 'No ID'}

        let error: Error | null = null
        try {
          await getClient().createVersion({document, publishedId: undefined as any})
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          '`createVersion()` requires either a publishedId or a document with an `_id`',
        )
      })

      test('throws when a releaseId is provided without a publishedId', async () => {
        const document = {_type: 'post', title: 'Release without published'}
        // Providing releaseId but no publishedId
        const releaseId = 'release456'

        let error: Error | null = null
        try {
          await getClient().createVersion({document, releaseId, publishedId: undefined as any})
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          '`createVersion()` requires either a publishedId or a document with an `_id`',
        )
      })

      test('can create version using only document._id', async () => {
        const documentId = 'drafts.existing123'
        const document = {_id: documentId, _type: 'post', title: 'Only document ID'}

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId: 'existing123',
                document: {...document, _id: documentId},
              },
            ],
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({document})
        expect(res.transactionId).toEqual('abc123')
      })

      test('can derive publishedId from a draft document ID', async () => {
        const documentId = 'drafts.post123'
        const expectedPublishedId = 'post123'
        const document = {_id: documentId, _type: 'post', title: 'Draft document'}

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId: expectedPublishedId,
                document: {...document, _id: documentId},
              },
            ],
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({document})
        expect(res.transactionId).toEqual('abc123')
      })

      test('throws when document._id is provided but is not a version ID or draft ID', async () => {
        const document = {
          _id: 'regularId123',
          _type: 'post',
          title: 'Regular ID',
        }

        let error: Error | null = null
        try {
          await getClient().createVersion({document})
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          '`createVersion()` requires a document with an `_id` that is a version or draft ID',
        )
      })

      test('throws when document._id is a draft ID and releaseId is provided', async () => {
        const publishedId = 'doc123'
        const releaseId = 'release456'
        const documentId = `drafts.${publishedId}`
        const document = {
          _id: documentId,
          _type: 'post',
          title: 'Draft ID',
        }

        let error: Error | null = null
        try {
          await getClient().createVersion({document, releaseId})
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          `\`createVersion()\` was called with a document ID (\`${documentId}\`) that is a draft ID, but a release ID (\`${releaseId}\`) was also provided.`,
        )
      })

      test('throws when document._id is a version ID but version does not match provided releaseId', async () => {
        const publishedId = 'doc123'
        const wrongReleaseId = 'oldRelease789'
        const releaseId = 'newRelease456'
        const versionId = `versions.${wrongReleaseId}.${publishedId}`
        const document = {
          _id: versionId,
          _type: 'post',
          title: 'Version ID mismatch',
        }

        let error: Error | null = null
        try {
          await getClient().createVersion({document, releaseId})
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          `\`createVersion()\` was called with a document ID (\`${versionId}\`) that is a version ID, but the release ID (\`${releaseId}\`) does not match the document's version ID (\`${wrongReleaseId}\`).`,
        )
      })

      test('can create version using baseId and releaseId', async () => {
        const baseId = 'baseDoc123'
        const releaseId = 'release456'
        const publishedId = 'targetDoc123'
        const expectedVersionId = 'versions.release456.targetDoc123'

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId,
                baseId,
                versionId: expectedVersionId,
              },
            ],
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({baseId, releaseId, publishedId})
        expect(res.transactionId).toEqual('abc123')
      })

      test('can create version using baseId and releaseId with ifBaseRevisionId', async () => {
        const baseId = 'baseDoc123'
        const releaseId = 'release456'
        const publishedId = 'targetDoc123'
        const ifBaseRevisionId = 'rev456'
        const expectedVersionId = 'versions.release456.targetDoc123'

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId,
                baseId,
                versionId: expectedVersionId,
                ifBaseRevisionId,
              },
            ],
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({
          baseId,
          releaseId,
          publishedId,
          ifBaseRevisionId,
        })
        expect(res.transactionId).toEqual('abc123')
      })

      test('can create version using baseId with additional options', async () => {
        const baseId = 'baseDoc123'
        const releaseId = 'release456'
        const publishedId = 'targetDoc123'
        const expectedVersionId = 'versions.release456.targetDoc123'
        const options = {
          skipCrossDatasetReferenceValidation: true,
          dryRun: true,
        }

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId,
                baseId,
                versionId: expectedVersionId,
              },
            ],
            skipCrossDatasetReferenceValidation: true,
            dryRun: true,
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({baseId, releaseId, publishedId}, options)
        expect(res.transactionId).toEqual('abc123')
      })

      test('throws when neither document nor baseId are provided', async () => {
        let error: Error | null = null
        try {
          await getClient().createVersion({} as any)
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          '`createVersion()` requires `baseId` when no `document` is provided',
        )
      })

      test('creates draft version when baseId is provided but releaseId is missing', async () => {
        const baseId = 'baseDoc123'
        const publishedId = 'targetDoc123'
        const expectedVersionId = 'drafts.targetDoc123'

        nock(projectHost())
          .post('/v1/data/actions/foo', {
            actions: [
              {
                actionType: 'sanity.action.document.version.create',
                publishedId,
                baseId,
                versionId: expectedVersionId,
              },
            ],
          })
          .reply(200, {
            transactionId: 'abc123',
          })

        const res = await getClient().createVersion({baseId, publishedId})
        expect(res.transactionId).toEqual('abc123')
      })

      test('throws when baseId is provided but publishedId is missing', async () => {
        const baseId = 'baseDoc123'
        const releaseId = 'release456'

        let error: Error | null = null
        try {
          await getClient().createVersion({baseId, releaseId} as any)
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          '`createVersion()` requires `publishedId` when `baseId` is provided',
        )
      })

      test('throws when releaseId is provided but baseId is missing', async () => {
        const releaseId = 'release456'
        const publishedId = 'targetDoc123'

        let error: Error | null = null
        try {
          await getClient().createVersion({releaseId, publishedId} as any)
        } catch (err) {
          error = err as Error
        }

        expect(error).not.toBeNull()
        expect(error?.message).toMatch(
          '`createVersion()` requires `baseId` when no `document` is provided',
        )
      })

      test('handles errors when creating versions using baseId', async () => {
        const baseId = 'baseDoc123'
        const releaseId = 'release456'
        const publishedId = 'targetDoc123'

        nock(projectHost()).post('/v1/data/actions/foo').replyWithError('Network error occurred')

        await expect(
          getClient().createVersion({baseId, releaseId, publishedId}),
        ).rejects.toThrowError()
      })
    })
  })

  describe('PATCH OPS', () => {
    test('can build and serialize a patch of operations', () => {
      const patch = getClient().patch('abc123').inc({count: 1}).set({brownEyes: true}).serialize()

      expect(patch).toEqual({id: 'abc123', inc: {count: 1}, set: {brownEyes: true}})
    })

    test('patch() can take an array of IDs', () => {
      const patch = getClient().patch(['abc123', 'foo.456']).inc({count: 1}).serialize()
      expect(patch).toEqual({
        query: '*[_id in $ids]',
        params: {ids: ['abc123', 'foo.456']},
        inc: {count: 1},
      })
    })

    test('patch() can take a query', () => {
      const patch = getClient().patch({query: '*[_type == "beer]'}).inc({count: 1}).serialize()
      expect(patch).toEqual({query: '*[_type == "beer]', inc: {count: 1}})
    })

    test('patch() can take a query and params', () => {
      const patch = getClient()
        .patch({query: '*[_type == $type]', params: {type: 'beer'}})
        .inc({count: 1})
        .serialize()

      expect(patch).toEqual({query: '*[_type == $type]', params: {type: 'beer'}, inc: {count: 1}})
    })

    test('setIfMissing() patch can be applied multiple times', () => {
      const patch = getClient()
        .patch('abc123')
        .setIfMissing({count: 1, foo: 'bar'})
        .setIfMissing({count: 2, bar: 'foo'})
        .serialize()

      expect(patch).toEqual({id: 'abc123', setIfMissing: {count: 2, foo: 'bar', bar: 'foo'}})
    })

    test('can apply inc() and dec()', () => {
      const patch = getClient()
        .patch('abc123')
        .inc({count: 1}) // One step forward
        .dec({count: 2}) // Two steps back
        .serialize()

      expect(patch).toEqual({id: 'abc123', inc: {count: 1}, dec: {count: 2}})
    })

    test('can apply unset()', () => {
      const patch = getClient()
        .patch('abc123')
        .inc({count: 1})
        .unset(['bitter', 'enchilada'])
        .serialize()

      expect(patch).toEqual({id: 'abc123', inc: {count: 1}, unset: ['bitter', 'enchilada']})
    })

    test('throws if non-array is passed to unset()', () => {
      expect(() =>
        getClient()
          .patch('abc123')
          .unset('bitter' as any)
          .serialize(),
      ).toThrow(/non-array given/)
    })

    test('can apply insert()', () => {
      const patch = getClient()
        .patch('abc123')
        .inc({count: 1})
        .insert('after', 'tags[-1]', ['hotsauce'])
        .serialize()

      expect(patch).toEqual({
        id: 'abc123',
        inc: {count: 1},
        insert: {after: 'tags[-1]', items: ['hotsauce']},
      })
    })

    test('throws on invalid insert()', () => {
      expect(() =>
        getClient()
          .patch('abc123')
          .insert('bitter' as any, 'sel', ['raf']),
      ).toThrow(/one of: "before", "after", "replace"/)

      expect(() =>
        getClient()
          .patch('abc123')
          .insert('before', 123 as any, ['raf']),
      ).toThrow(/must be a string/)

      expect(() =>
        getClient()
          .patch('abc123')
          .insert('before', 'prop', 'blah' as any),
      ).toThrow(/must be an array/)
    })

    test('can apply append()', () => {
      const patch = getClient()
        .patch('abc123')
        .inc({count: 1})
        .append('tags', ['sriracha'])
        .serialize()

      expect(patch).toEqual({
        id: 'abc123',
        inc: {count: 1},
        insert: {after: 'tags[-1]', items: ['sriracha']},
      })
    })

    test('can apply prepend()', () => {
      const patch = getClient()
        .patch('abc123')
        .inc({count: 1})
        .prepend('tags', ['sriracha', 'hotsauce'])
        .serialize()

      expect(patch).toEqual({
        id: 'abc123',
        inc: {count: 1},
        insert: {before: 'tags[0]', items: ['sriracha', 'hotsauce']},
      })
    })

    test('can apply splice()', () => {
      const patch = () => getClient().patch('abc123')
      const replaceFirst = patch().splice('tags', 0, 1, ['foo']).serialize()
      const insertInMiddle = patch().splice('tags', 5, 0, ['foo']).serialize()
      const deleteLast = patch().splice('tags', -1, 1).serialize()
      const deleteAllFromIndex = patch().splice('tags', 3, -1).serialize()
      const allFromIndexDefault = patch().splice('tags', 3).serialize()
      const negativeDelete = patch().splice('tags', -2, -2, ['foo']).serialize()

      expect(replaceFirst.insert).toEqual({replace: 'tags[0:1]', items: ['foo']})
      expect(insertInMiddle.insert).toEqual({replace: 'tags[5:5]', items: ['foo']})
      expect(deleteLast.insert).toEqual({replace: 'tags[-2:]', items: []})
      expect(deleteAllFromIndex.insert).toEqual({replace: 'tags[3:-1]', items: []})
      expect(allFromIndexDefault.insert).toEqual({replace: 'tags[3:-1]', items: []})
      expect(negativeDelete).toEqual(patch().splice('tags', -2, 0, ['foo']).serialize())
    })

    test('serializing invalid selectors throws', () => {
      expect(() =>
        getClient()
          .patch(123 as any)
          .serialize(),
      ).toThrow(/unknown selection/i)
    })

    test('can apply diffMatchPatch()', () => {
      const patch = getClient()
        .patch('abc123')
        .inc({count: 1})
        .diffMatchPatch({description: '@@ -1,13 +1,12 @@\n The \n-rabid\n+nice\n  dog\n'})
        .serialize()

      expect(patch).toEqual({
        id: 'abc123',
        inc: {count: 1},
        diffMatchPatch: {description: '@@ -1,13 +1,12 @@\n The \n-rabid\n+nice\n  dog\n'},
      })
    })

    test('all patch methods throw on non-objects being passed as argument', () => {
      const patch = getClient().patch('abc123')
      expect(() => patch.set(null as any), 'set throws').toThrow(
        /set\(\) takes an object of properties/,
      )
      expect(() => patch.setIfMissing('foo' as any), 'setIfMissing throws').toThrow(
        /setIfMissing\(\) takes an object of properties/,
      )
      expect(() => patch.inc('foo' as any), 'inc throws').toThrow(
        /inc\(\) takes an object of properties/,
      )
      expect(() => patch.dec('foo' as any), 'dec throws').toThrow(
        /dec\(\) takes an object of properties/,
      )
      expect(() => patch.diffMatchPatch('foo' as any), 'diffMatchPatch throws').toThrow(
        /diffMatchPatch\(\) takes an object of properties/,
      )
    })

    test.skipIf(isEdge)('executes patch when commit() is called', async () => {
      const expectedPatch = {patch: {id: 'abc123', inc: {count: 1}, set: {visited: true}}}
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&visibility=sync', {mutations: [expectedPatch]})
        .reply(200, {transactionId: 'blatti'})

      const res = await getClient()
        .patch('abc123')
        .inc({count: 1})
        .set({visited: true})
        .commit({returnDocuments: false})
      expect(res.transactionId, 'applies given patch').toEqual('blatti')
    })

    test.skipIf(isEdge)(
      'executes patch with request tag when commit() is called with tag',
      async () => {
        const expectedPatch = {patch: {id: 'abc123', set: {visited: true}}}
        nock(projectHost())
          .post('/v1/data/mutate/foo?tag=company.setvisited&returnIds=true&visibility=sync', {
            mutations: [expectedPatch],
          })
          .reply(200, {transactionId: 'blatti'})

        const res = await getClient()
          .patch('abc123')
          .set({visited: true})
          .commit({returnDocuments: false, tag: 'company.setvisited'})
        expect(res.transactionId, 'applies given patch').toEqual('blatti')
      },
    )

    test.skipIf(isEdge)(
      'executes patch with auto generate key option if specified commit()',
      async () => {
        const expectedPatch = {patch: {id: 'abc123', set: {visited: true}}}
        nock(projectHost())
          .post('/v1/data/mutate/foo?returnIds=true&autoGenerateArrayKeys=true&visibility=sync', {
            mutations: [expectedPatch],
          })
          .reply(200, {transactionId: 'blatti'})

        const res = await getClient()
          .patch('abc123')
          .set({visited: true})
          .commit({returnDocuments: false, autoGenerateArrayKeys: true})
        expect(res.transactionId, 'applies given patch').toEqual('blatti')
      },
    )

    test.skipIf(isEdge)('executes patch with given token override commit() is called', async () => {
      const expectedPatch = {patch: {id: 'abc123', inc: {count: 1}, set: {visited: true}}}
      nock(projectHost(), {reqheaders: {Authorization: 'Bearer abc123'}})
        .post('/v1/data/mutate/foo?returnIds=true&visibility=sync', {mutations: [expectedPatch]})
        .reply(200, {transactionId: 'blatti'})

      const res = await getClient()
        .patch('abc123')
        .inc({count: 1})
        .set({visited: true})
        .commit({returnDocuments: false, token: 'abc123'})
      expect(res.transactionId, 'applies given patch').toEqual('blatti')
    })

    test.skipIf(isEdge)('returns patched document by default', async () => {
      const expectedPatch = {patch: {id: 'abc123', inc: {count: 1}, set: {visited: true}}}
      const expectedBody = {mutations: [expectedPatch]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {
          transactionId: 'blatti',
          results: [
            {
              id: 'abc123',
              operation: 'update',
              document: {
                _id: 'abc123',
                _createdAt: '2016-10-24T08:09:32.997Z',
                count: 2,
                visited: true,
              },
            },
          ],
        })

      const res = await getClient().patch('abc123').inc({count: 1}).set({visited: true}).commit()
      expect(res._id, 'returns patched document').toEqual('abc123')
    })

    test.skipIf(isEdge)('commit() returns promise', async () => {
      expect.assertions(1)

      const expectedPatch = {patch: {id: 'abc123', inc: {count: 1}, set: {visited: true}}}
      const expectedBody = {mutations: [expectedPatch]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(400)

      try {
        await getClient().patch('abc123').inc({count: 1}).set({visited: true}).commit()
      } catch (err) {
        expect(err, 'should call applied error handler').toBeInstanceOf(Error)
      }
    })

    test('each patch operation returns same patch', () => {
      const patch = getClient().patch('abc123')
      const inc = patch.inc({count: 1})
      const dec = patch.dec({count: 1})
      const combined = inc.dec({count: 1})

      expect(patch, 'should return same patch').toEqual(inc)
      expect(inc, 'should return same patch').toEqual(dec)
      expect(inc, 'should return same patch').toEqual(combined)

      expect(combined.serialize(), 'combined patch should have both inc and dec ops').toEqual({
        id: 'abc123',
        inc: {count: 1},
        dec: {count: 1},
      })
    })

    test('can reset patches to no operations, keeping document ID', () => {
      const patch = getClient().patch('abc123').inc({count: 1}).dec({visits: 1})
      const reset = patch.reset()

      expect(patch.serialize(), 'correct patch').toEqual({id: 'abc123'})
      expect(reset.serialize(), 'reset patch should be empty').toEqual({id: 'abc123'})
      expect(patch, 'reset mutates, does not clone').toEqual(reset)
    })

    test('patch has toJSON() which serializes patch', () => {
      const patch = getClient().patch('abc123').inc({count: 1})
      expect(JSON.parse(JSON.stringify(patch))).toEqual(
        JSON.parse(JSON.stringify({id: 'abc123', inc: {count: 1}})),
      )
    })

    test('Patch is available as a named export and can be used without instantiated client', () => {
      const patch = new Patch('foo.bar')
      expect(
        patch.inc({foo: 1}).dec({bar: 2}).serialize(),
        'patch should work without context',
      ).toEqual({id: 'foo.bar', inc: {foo: 1}, dec: {bar: 2}})
    })

    test('patch commit() throws if called without a client', () => {
      const patch = new Patch('foo.bar')
      expect(() => patch.dec({bar: 2}).commit()).toThrow(/client.*mutate/i)
    })

    test.skipIf(isEdge)('patch can be created without client and passed to mutate()', async () => {
      const patch = new Patch('foo').dec({count: 1})

      const mutations = [{patch: {id: 'foo', dec: {count: 1}}}]
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
          mutations,
        })
        .reply(200, {results: [{id: 'foo', operation: 'update'}]})

      await expect(getClient().mutate(patch)).resolves.not.toThrow()
    })

    // eslint-disable-next-line no-warning-comments
    // @TODO investigate why this fails on Edge Runtime
    test.skipIf(isEdge)('can manually call clone on patch', () => {
      const patch1 = getClient().patch('abc123').inc({count: 1})
      const patch2 = patch1.clone()

      expect(patch1, 'actually cloned').not.toBe(patch2)
      expect(patch1.serialize(), 'serialized to the same').toEqual(patch2.serialize())
    })

    test('can apply ifRevisionId constraint', () => {
      expect(
        getClient().patch('abc123').inc({count: 1}).ifRevisionId('someRev').serialize(),
        'patch should be able to apply ifRevisionId constraint',
      ).toEqual({id: 'abc123', inc: {count: 1}, ifRevisionID: 'someRev'})
    })
  })

  describe('TRANSACTIONS', () => {
    test('can build and serialize a transaction of operations', () => {
      const trans = getClient()
        .transaction()
        .create({_id: 'moofoo', _type: 'document', name: 'foobar'})
        .delete('nznjkAJnjgnk')
        .serialize()

      expect(trans).toEqual([
        {create: {_id: 'moofoo', _type: 'document', name: 'foobar'}},
        {delete: {id: 'nznjkAJnjgnk'}},
      ])
    })

    test('each transaction operation mutates transaction', () => {
      const trans = getClient().transaction()
      const create = trans.create({_type: 'document', count: 1})
      const combined = create.delete('foobar')

      expect(trans, 'should be mutated').toEqual(create)
      expect(create, 'should be mutated').toEqual(combined)

      expect(
        combined.serialize(),
        'combined transaction should have both create and delete ops',
      ).toEqual([{create: {_type: 'document', count: 1}}, {delete: {id: 'foobar'}}])
    })

    test('transaction methods are chainable', () => {
      const trans = getClient()
        .transaction()
        .create({_type: 'nostalgia', moo: 'tools'})
        .createIfNotExists({_id: 'someId', _type: 'nostalgia', j: 'query'})
        .createOrReplace({_id: 'someOtherId', _type: 'nostalgia', do: 'jo'})
        .delete('prototype')
        .patch('foobar', {inc: {sales: 1}})

      expect(trans.serialize()).toEqual([
        {
          create: {
            _type: 'nostalgia',
            moo: 'tools',
          },
        },
        {
          createIfNotExists: {
            _id: 'someId',
            _type: 'nostalgia',
            j: 'query',
          },
        },
        {
          createOrReplace: {
            _id: 'someOtherId',
            _type: 'nostalgia',
            do: 'jo',
          },
        },
        {
          delete: {
            id: 'prototype',
          },
        },
        {
          patch: {
            id: 'foobar',
            inc: {sales: 1},
          },
        },
      ])

      expect(trans.reset().serialize().length, 'resets to 0 operations').toEqual(0)
    })

    test('patches can be built with callback', () => {
      const trans = getClient()
        .transaction()
        .patch('moofoo', (p) => p.inc({sales: 1}).dec({stock: 1}))
        .serialize()

      expect(trans).toEqual([
        {
          patch: {
            id: 'moofoo',
            inc: {sales: 1},
            dec: {stock: 1},
          },
        },
      ])
    })

    test('throws if patch builder does not return patch', () => {
      expect(() =>
        getClient()
          .transaction()
          .patch('moofoo', (() => {
            /* intentional noop */
          }) as any),
      ).toThrow(/must return the patch/)
    })

    test('patch can take an existing patch', () => {
      const client = getClient()
      const incPatch = client.patch('bar').inc({sales: 1})
      const trans = getClient().transaction().patch(incPatch).serialize()

      expect(trans).toEqual([
        {
          patch: {
            id: 'bar',
            inc: {sales: 1},
          },
        },
      ])
    })

    test('patch can use a mutation selector', () => {
      const transaction = getClient()
        .transaction()
        .patch(
          {
            query: '*[_id in $ids]',
            params: {ids: ['abc123', 'foo.456']},
          },
          {inc: {count: 1}},
        )

      expect(transaction.serialize()).toEqual([
        {
          patch: {
            query: '*[_id in $ids]',
            params: {ids: ['abc123', 'foo.456']},
            inc: {count: 1},
          },
        },
      ])

      const transactionWithCallback = getClient()
        .transaction()
        .patch(
          {
            query: '*[_id in $ids]',
            params: {ids: ['abc123', 'foo.456']},
          },
          (p) => p.inc({count: 1}),
        )

      expect(transactionWithCallback.serialize()).toEqual([
        {
          patch: {
            query: '*[_id in $ids]',
            params: {ids: ['abc123', 'foo.456']},
            inc: {count: 1},
          },
        },
      ])
    })

    test.skipIf(isEdge)('executes transaction when commit() is called', async () => {
      const mutations = [{create: {_type: 'foo', bar: true}}, {delete: {id: 'barfoo'}}]
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&visibility=sync', {mutations})
        .reply(200, {transactionId: 'blatti'})

      const res = await getClient()
        .transaction()
        .create({_type: 'foo', bar: true})
        .delete('barfoo')
        .commit()
      expect(res.transactionId, 'applies given transaction').toEqual('blatti')
    })

    test.skipIf(isEdge)(
      'executes transaction with request tag when commit() is called with tag',
      async () => {
        const mutations = [{create: {_type: 'bar', name: 'Toronado'}}]
        nock(projectHost())
          .post('/v1/data/mutate/foo?tag=sfcraft.createbar&returnIds=true&visibility=sync', {
            mutations,
          })
          .reply(200, {transactionId: 'blatti'})

        const res = await getClient()
          .transaction()
          .create({_type: 'bar', name: 'Toronado'})
          .commit({tag: 'sfcraft.createbar'})
        expect(res.transactionId, 'applies given transaction').toEqual('blatti')
      },
    )

    test('throws when passing incorrect input to transaction operations', () => {
      const trans = getClient().transaction()
      expect(() => trans.create('foo' as any), 'throws on create()').toThrow(/object of prop/)
      expect(() => trans.createIfNotExists('foo' as any), 'throws on createIfNotExists()').toThrow(
        /object of prop/,
      )
      expect(() => trans.createOrReplace('foo' as any), 'throws on createOrReplace()').toThrow(
        /object of prop/,
      )
      expect(() => trans.delete({id: 'moofoo'} as any), 'throws on delete()').toThrow(
        /not a valid document ID/,
      )
    })

    test('throws when not including document ID in createOrReplace/createIfNotExists in transaction', () => {
      const trans = getClient().transaction()
      expect(
        () => trans.createIfNotExists({_type: 'movie', a: 1} as any),
        'throws on createIfNotExists()',
      ).toThrow(/contains an ID/)
      expect(
        () => trans.createOrReplace({_type: 'movie', a: 1} as any),
        'throws on createOrReplace()',
      ).toThrow(/contains an ID/)
    })

    // eslint-disable-next-line no-warning-comments
    // @TODO investigate why this fails on Edge Runtime
    test.skipIf(isEdge)('can manually call clone on transaction', () => {
      const trans1 = getClient().transaction().delete('foo.bar')
      const trans2 = trans1.clone()

      expect(trans1, 'actually cloned').not.toBe(trans2)
      expect(trans1.serialize(), 'serialized to the same').toEqual(trans2.serialize())
    })

    test('transaction has toJSON() which serializes patch', () => {
      const trans = getClient().transaction().create({_type: 'document', count: 1})
      expect(JSON.parse(JSON.stringify(trans))).toEqual(
        JSON.parse(JSON.stringify([{create: {_type: 'document', count: 1}}])),
      )
    })

    test('Transaction is available on client and can be used without instantiated client', () => {
      const trans = new Transaction()
      expect(trans.delete('barfoo').serialize(), 'transaction should work without context').toEqual(
        [{delete: {id: 'barfoo'}}],
      )
    })

    test.skipIf(isEdge)(
      'transaction can be created without client and passed to mutate()',
      async () => {
        const trx = new Transaction()
        trx.delete('foo')

        const mutations = [{delete: {id: 'foo'}}]
        nock(projectHost())
          .post('/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
            mutations,
          })
          .reply(200, {results: [{id: 'foo', operation: 'delete'}]})

        await expect(getClient().mutate(trx)).resolves.not.toThrow()
      },
    )

    test('transaction commit() throws if called without a client', () => {
      const trans = new Transaction()
      expect(() => trans.delete('foo.bar').commit()).toThrow(/client.*mutate/i)
    })

    test.skipIf(isEdge)('transaction can be given an explicit transaction ID', async () => {
      const transactionId = 'moop'
      const mutations = [{create: {_type: 'foo', bar: true}}, {delete: {id: 'barfoo'}}]
      nock(projectHost())
        .post('/v1/data/mutate/foo?returnIds=true&visibility=sync', {mutations, transactionId})
        .reply(200, {transactionId})

      const res = await getClient()
        .transaction()
        .create({_type: 'foo', bar: true})
        .delete('barfoo')
        .transactionId(transactionId)
        .commit()
      expect(res.transactionId, 'applies given transaction').toEqual(transactionId)
    })
  })

  // nock doesn't support mocking `fetch` yet, which is used by event-source-polyfill, and thus we have to skip for now when `isNode` is false
  // https://github.com/nock/nock/issues/2183
  describe.skipIf(isEdge || !isNode)('LISTENERS', () => {
    test('listeners connect to listen endpoint, emits events', async () => {
      expect.assertions(1)

      const doc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}
      const response = [
        ':',
        '',
        'event: welcome',
        'data: {"listenerName":"LGFXwOqrf1GHawAjZRnhd6"}',
        '',
        'event: mutation',
        `data: ${JSON.stringify({result: doc})}`,
        '',
        'event: disconnect',
        'data: {"reason":"forcefully closed"}',
      ].join('\n')

      nock(projectHost())
        .get('/v1/data/listen/foo?query=foo.bar&includeResult=true')
        .reply(200, response, {
          'cache-control': 'no-cache',
          'content-type': 'text/event-stream; charset=utf-8',
          'transfer-encoding': 'chunked',
        })

      const evt = await firstValueFrom(getClient().listen('foo.bar'))
      expect(evt.result).toEqual(doc)
    })

    test('listeners connect to listen endpoint with request tag, emits events', async () => {
      expect.assertions(1)

      const doc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}
      const response = [
        ':',
        '',
        'event: welcome',
        'data: {"listenerName":"LGFXwOqrf1GHawAjZRnhd6"}',
        '',
        'event: mutation',
        `data: ${JSON.stringify({result: doc})}`,
        '',
        'event: disconnect',
        'data: {"reason":"forcefully closed"}',
      ].join('\n')

      nock(projectHost())
        .get(
          '/v1/data/listen/foo?tag=sfcraft.checkins&query=*%5B_type%20%3D%3D%20%22checkin%22%5D&includeResult=true',
        )
        .reply(200, response, {
          'cache-control': 'no-cache',
          'content-type': 'text/event-stream; charset=utf-8',
          'transfer-encoding': 'chunked',
        })

      const evt = await firstValueFrom(
        getClient().listen('*[_type == "checkin"]', {}, {tag: 'sfcraft.checkins'}),
      )
      expect(evt.type == 'mutation' && evt.result).toEqual(doc)
    })

    test('listeners connect to listen endpoint with prefixed request tag, emits events', async () => {
      expect.assertions(1)

      const doc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}
      const response = [
        ':',
        '',
        'event: welcome',
        'data: {"listenerName":"LGFXwOqrf1GHawAjZRnhd6"}',
        '',
        'event: mutation',
        `data: ${JSON.stringify({result: doc})}`,
        '',
        'event: disconnect',
        'data: {"reason":"forcefully closed"}',
      ].join('\n')

      nock(projectHost())
        .get(
          '/v1/data/listen/foo?tag=sf.craft.checkins&query=*%5B_type%20%3D%3D%20%22checkin%22%5D&includeResult=true',
        )
        .reply(200, response, {
          'cache-control': 'no-cache',
          'content-type': 'text/event-stream; charset=utf-8',
          'transfer-encoding': 'chunked',
        })

      const evt = await firstValueFrom(
        getClient({requestTagPrefix: 'sf.craft.'}).listen(
          '*[_type == "checkin"]',
          {},
          {tag: 'checkins'},
        ),
      )

      expect(evt.type === 'mutation' && evt.result).toEqual(doc)
    })

    test('listeners requests are lazy', async () => {
      expect.assertions(2)

      const response = [
        ':',
        '',
        'event: welcome',
        'data: {"listenerName":"LGFXwOqrf1GHawAjZRnhd6"}',
        '',
        'event: mutation',
        `data: ${JSON.stringify({})}`,
      ].join('\n')

      let didRequest = false
      nock(projectHost())
        .get('/v1/data/listen/foo?query=foo.bar&includeResult=true')
        .reply(() => {
          didRequest = true
          return [200, response]
        })
      const req = getClient().listen('foo.bar', {}, {events: ['welcome']})
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(didRequest).toBe(false)
      await firstValueFrom(req)
      expect(didRequest).toBe(true)
    })

    test('listener requests are cold', async () => {
      expect.assertions(3)

      const response = [
        ':',
        '',
        'event: welcome',
        'data: {"listenerName":"LGFXwOqrf1GHawAjZRnhd6"}',
        '',
        ':',
      ].join('\n')

      let requestCount = 0
      nock(projectHost())
        .get('/v1/data/listen/foo?query=foo.bar&includeResult=true')
        .twice()
        .reply(() => {
          requestCount++
          return [200, response]
        })

      const req = getClient().listen('foo.bar', {}, {events: ['welcome']})

      expect(requestCount).toBe(0)
      await firstValueFrom(req)
      expect(requestCount).toBe(1)
      await firstValueFrom(req)
      expect(requestCount).toBe(2)
    })
  })

  describe.runIf(isNode)('ASSETS', () => {
    test('uploads images', async () => {
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost())
        .post('/v1/assets/images/foo', isImage)
        .reply(201, {document: {url: 'https://some.asset.url'}})

      const document = await getClient().assets.upload('image', fs.createReadStream(fixturePath))
      expect(document.url).toEqual('https://some.asset.url')
    })

    test('uploads images with request tag if given', async () => {
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost())
        .post('/v1/assets/images/foo?tag=galaxy.images', isImage)
        .reply(201, {document: {url: 'https://some.asset.url'}})

      const document = await getClient().assets.upload('image', fs.createReadStream(fixturePath), {
        tag: 'galaxy.images',
      })
      expect(document.url).toEqual('https://some.asset.url')
    })

    test('uploads images with prefixed request tag if given', async () => {
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost())
        .post('/v1/assets/images/foo?tag=galaxy.images', isImage)
        .reply(201, {document: {url: 'https://some.asset.url'}})

      const document = await getClient({requestTagPrefix: 'galaxy'}).assets.upload(
        'image',
        fs.createReadStream(fixturePath),
        {tag: 'images'},
      )
      expect(document.url).toEqual('https://some.asset.url')
    })

    test('uploads images with given content type', async () => {
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost(), {reqheaders: {'Content-Type': 'image/jpeg'}})
        .post('/v1/assets/images/foo', isImage)
        .reply(201, {document: {url: 'https://some.asset.url'}})

      const document = await getClient().assets.upload('image', fs.createReadStream(fixturePath), {
        contentType: 'image/jpeg',
      })
      expect(document.url).toEqual('https://some.asset.url')
    })

    test('uploads images with specified metadata to be extracted', async () => {
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost())
        .post('/v1/assets/images/foo?meta=palette&meta=location', isImage)
        .reply(201, {document: {url: 'https://some.asset.url'}})

      const options = {extract: ['palette' as const, 'location' as const]}
      const document = await getClient().assets.upload(
        'image',
        fs.createReadStream(fixturePath),
        options,
      )
      expect(document.url).toEqual('https://some.asset.url')
    })

    test('empty extract array sends `none` as metadata', async () => {
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost())
        .post('/v1/assets/images/foo?meta=none', isImage)
        .reply(201, {document: {url: 'https://some.asset.url'}})

      const options = {extract: []}
      const document = await getClient().assets.upload(
        'image',
        fs.createReadStream(fixturePath),
        options,
      )
      expect(document.url).toEqual('https://some.asset.url')
    })

    test('uploads images with progress events', async () => {
      // The amount of assertions can vary depending on the OS and CI
      expect.hasAssertions()
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost())
        .post('/v1/assets/images/foo', isImage)
        .reply(201, {url: 'https://some.asset.url'})

      const uploadProgress = getClient()
        .observable.assets.upload('image', fs.createReadStream(fixturePath))
        .pipe(filter((event) => event.type === 'progress'))

      // note: the number of events emitted and their properties depends on
      // the size of the file being uploaded and how the runtime will chunk them
      const events = await lastValueFrom(uploadProgress.pipe(toArray()))
      events.forEach((event) => {
        expect(event.type, 'progress').toEqual('progress')
      })
    })

    test('uploads images with custom label', async () => {
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0
      const label = 'xy zzy'
      nock(projectHost())
        .post(`/v1/assets/images/foo?label=${encodeURIComponent(label)}`, isImage)
        .reply(201, {document: {label: label}})

      const body = await getClient().assets.upload('image', fs.createReadStream(fixturePath), {
        label: label,
      })
      expect(body.label).toEqual(label)
    })

    test('uploads files', async () => {
      const fixturePath = fixture('pdf-sample.pdf')
      const isFile = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost())
        .post('/v1/assets/files/foo', isFile)
        .reply(201, {document: {url: 'https://some.asset.url'}})

      const document = await getClient().assets.upload('file', fs.createReadStream(fixturePath))
      expect(document.url).toEqual('https://some.asset.url')
    })

    test('uploads images and can cast to promise', async () => {
      const fixturePath = fixture('horsehead-nebula.jpg')
      const isImage = (body: any) =>
        Buffer.from(body, 'hex').compare(fs.readFileSync(fixturePath)) === 0

      nock(projectHost())
        .post('/v1/assets/images/foo', isImage)
        .reply(201, {document: {url: 'https://some.asset.url'}})

      const document = await getClient().assets.upload('image', fs.createReadStream(fixturePath))
      expect(document.url).toEqual('https://some.asset.url')
    })

    test('delete assets', async () => {
      const expectedBody = {mutations: [{delete: {id: 'image-abc123_foobar-123x123-png'}}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: 'abc123', results: [{id: 'abc123', operation: 'delete'}]})

      await expect(getClient().delete('image-abc123_foobar-123x123-png')).resolves.not.toThrow()
    })
  })

  describe.skipIf(isEdge)('AGENT ACTION: PROMPT', () => {
    test('can use instruction', async () => {
      const response = 'i did the thing'

      nock(projectHost())
        .post(`/v1/agent/action/prompt/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.prompt({
        instruction: 'say you did the thing',
      })
      expect(body).toEqual(response)
    })

    test('can ask for json', async () => {
      const response = {json: true}

      nock(projectHost())
        .post(`/v1/agent/action/prompt/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.prompt<{json: true}>({
        instruction: 'return the exact json: {json: true}',
        format: 'json',
      })
      expect(body).toEqual(response)
    })

    test('requires documentId for field and document params', async () => {
      const response = {json: true}

      nock(projectHost())
        .post(`/v1/agent/action/prompt/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.prompt({
        instruction: '$a $b',
        instructionParams: {
          //@ts-expect-error documentId is required
          a: {
            type: 'field',
            path: ['title'],
          },
          //@ts-expect-error documentId is required
          b: {
            type: 'document',
          },
        },
      })
      expect(body).toEqual(response)
    })

    test('all the params', async () => {
      const response = 'whatever'

      nock(projectHost())
        .post(`/v1/agent/action/prompt/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.prompt<{title?: string}>({
        instruction: '$a $b $d',
        instructionParams: {
          a: 'constant',
          b: {
            type: 'field',
            path: ['title'],
            documentId: 'somewhere',
          },
          c: {
            type: 'groq',
            query: '*[id=$id].title',
            params: {id: 'abc'},
          },
          d: {
            type: 'document',
            documentId: 'somewhere',
          },
        },
        temperature: 0.6,
        format: 'string',
      })
      expect(body).toEqual('whatever')
    })
  })

  describe.skipIf(isEdge)('AGENT ACTION: PATCH', () => {
    test('can create new document', async () => {
      const response = {
        _id: 'generated',
      }

      nock(projectHost())
        .post(`/v1/agent/action/patch/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.patch({
        schemaId: 'some-schema-id',
        targetDocument: {
          operation: 'create',
          _type: 'some-type',
        },
        target: {path: 'title', operation: 'unset'},
      })
      expect(body).toEqual(response)
    })

    test('can create new document with id', async () => {
      const response = {
        _id: 'generated',
        title: 'new title',
      }

      nock(projectHost())
        .post(`/v1/agent/action/patch/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.patch({
        schemaId: 'some-schema-id',
        targetDocument: {operation: 'createIfNotExists', _id: 'new', _type: 'some-type'},
        target: {path: 'title', operation: 'set', value: 'new title'},
      })
      expect(body).toEqual(response)
    })

    test('can patch existing document', async () => {
      const response = {
        _id: 'generated',
      }

      nock(projectHost())
        .post(`/v1/agent/action/patch/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.patch({
        documentId: 'some-id',
        target: {path: 'title', operation: 'unset'},
        schemaId: 'some-schema-id',
      })
      expect(body).toEqual(response)
    })

    test('can apply generics to type returned document value', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/patch/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.patch<{title?: string}>({
        documentId: 'some-id',
        target: {path: 'title', operation: 'set', value: 'override'},
        schemaId: 'some-schema-id',
      })
      expect(body.title).toEqual(response.title)
    })

    test('providing both documentId & targetDocument should not compile', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/patch/${clientConfig.dataset}`)
        .reply(200, response)

      await getClient().agent.action.patch<{title?: string}>({
        documentId: 'some-id',
        //@ts-expect-error not allowed
        targetDocument: {operation: 'create', _type: 'yolo'},
        target: {path: 'title', operation: 'set', value: 'override'},
        schemaId: 'some-schema-id',
      })
    })

    test('can cannot apply generics to async request since it returns _id only', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/patch/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.patch({
        documentId: 'some-id',
        target: {path: 'title', operation: 'set', value: 'override'},
        schemaId: 'some-schema-id',
        async: true,
      })
      expect(body._id).toEqual(response._id)
    })

    test('async cannot noWrite', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/patch/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.patch({
        documentId: 'some-id',
        target: {path: 'title', operation: 'set', value: 'override'},
        schemaId: 'some-schema-id',
        async: true,
        //@ts-expect-error not allowed
        noWrite: true,
      })
      expect(body._id).toEqual(response._id)
    })

    test('all the params', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/patch/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.patch<{title?: string}>({
        targetDocument: {_id: 'some-id', operation: 'edit'},
        async: false,
        forcePublishedWrite: true,
        target: [
          {path: ['title'], operation: 'append', value: 'title'},
          {path: 'description', operation: 'set', value: 'desc'},
          {path: 'body', operation: 'mixed', value: 'mixed'},
          {path: 'body', operation: 'unset'},
        ],
        noWrite: true,
        conditionalPaths: {
          defaultHidden: true,
          defaultReadOnly: false,
          paths: [{path: ['title'], readOnly: false, hidden: false}],
        },
        schemaId: 'some-schema-id',
      })
      expect(body.title).toEqual(response.title)
    })
  })

  describe.skipIf(isEdge)('AGENT ACTION: GENERATE', () => {
    test('can create new document', async () => {
      const response = {
        _id: 'generated',
      }

      nock(projectHost())
        .post(`/v1/agent/action/generate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.generate({
        targetDocument: {
          operation: 'create',
          _type: 'some-type',
        },
        instruction: 'set title to override',
        schemaId: 'some-schema-id',
      })
      expect(body).toEqual(response)
    })

    test('can create new document with id', async () => {
      const response = {
        _id: 'generated',
      }

      nock(projectHost())
        .post(`/v1/agent/action/generate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.generate({
        targetDocument: {operation: 'createIfNotExists', _id: 'new', _type: 'some-type'},
        instruction: 'set title to override',
        schemaId: 'some-schema-id',
      })
      expect(body).toEqual(response)
    })

    test('can instruct existing document', async () => {
      const response = {
        _id: 'generated',
      }

      nock(projectHost())
        .post(`/v1/agent/action/generate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.generate({
        documentId: 'some-id',
        instruction: 'set title to override',
        schemaId: 'some-schema-id',
      })
      expect(body).toEqual(response)
    })

    test('can apply generics to type returned document value', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/generate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.generate<{title?: string}>({
        documentId: 'some-id',
        instruction: 'set title to override',
        schemaId: 'some-schema-id',
      })
      expect(body.title).toEqual(response.title)
      expect(body.title).toEqual(response.title)
    })

    test('providing both documentId & targetDocument should not compile', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/generate/${clientConfig.dataset}`)
        .reply(200, response)

      await getClient().agent.action.generate<{title?: string}>({
        documentId: 'some-id',
        //@ts-expect-error not allowed
        targetDocument: {operation: 'create', _type: 'yolo'},
        instruction: 'set title to override',
        schemaId: 'some-schema-id',
      })
    })

    test('can cannot apply generics to async request since it returns _id only', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/generate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.generate({
        documentId: 'some-id',
        instruction: 'set title to override',
        schemaId: 'some-schema-id',
        async: true,
      })
      expect(body._id).toEqual(response._id)
    })

    test('async cannot noWrite', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/generate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.generate({
        documentId: 'some-id',
        instruction: 'set title to override',
        schemaId: 'some-schema-id',
        async: true,
        //@ts-expect-error not allowed
        noWrite: true,
      })
      expect(body._id).toEqual(response._id)
    })

    test('all the params', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/generate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.generate<{title?: string}>({
        targetDocument: {_id: 'some-id', operation: 'edit'},
        instruction: '$a $b $d',
        forcePublishedWrite: true,
        instructionParams: {
          a: 'constant',
          b: {
            type: 'field',
            path: ['title'],
          },
          c: {
            type: 'groq',
            query: '*[id=$id].title',
            params: {id: 'abc'},
            perspective: 'drafts',
          },
          d: {
            type: 'document',
            documentId: 'somewhere',
          },
        },
        temperature: 0.6,
        async: false,
        target: [
          {path: ['title']},
          {
            operation: 'set',
            include: [
              'object',
              {
                path: 'array',
                include: [{_key: '123'}],
                operation: 'append',
                types: {
                  include: ['string'],
                },
              },
            ],
            types: {
              exclude: ['number'],
            },
          },
        ],
        noWrite: true,
        conditionalPaths: {
          defaultHidden: true,
          defaultReadOnly: false,
          paths: [{path: ['title'], readOnly: false, hidden: false}],
        },
        schemaId: 'some-schema-id',
      })
      expect(body.title).toEqual(response.title)
    })
  })

  describe.skipIf(isEdge)('AGENT ACTION: TRANSFORM', () => {
    test('can create new document', async () => {
      const response = {_id: 'created'}

      nock(projectHost())
        .post(`/v1/agent/action/transform/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.transform({
        schemaId: 'some-schema-id',
        documentId: 'source-id',
        targetDocument: {operation: 'create'},
        instruction: 'make everything CAPITALS ONLY',
      })
      expect(body).toEqual(response)
    })

    test('can transform existing document', async () => {
      const response = {
        _id: 'generated',
      }

      nock(projectHost())
        .post(`/v1/agent/action/transform/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.transform({
        schemaId: 'some-schema-id',
        documentId: 'some-id',
        instruction: 'fix spelling errors',
      })
      expect(body).toEqual(response)
    })

    test('can apply generics to type returned document value', async () => {
      const response = {
        _id: 'generated',
        title: 'OVERRIDE',
      }

      nock(projectHost())
        .post(`/v1/agent/action/transform/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.transform<{title?: string}>({
        schemaId: 'some-schema-id',
        documentId: 'some-id',
        instruction: 'ALL CAPS',
      })
      expect(body.title).toEqual(response.title)
    })

    test('can cannot apply generics to async request since it returns _id only', async () => {
      const response = {
        _id: 'generated',
        title: 'OVERRIDE',
      }

      nock(projectHost())
        .post(`/v1/agent/action/transform/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.transform({
        documentId: 'some-id',
        instruction: 'ALL CAPS',
        schemaId: 'some-schema-id',
        async: true,
      })
      expect(body._id).toEqual(response._id)
    })

    test('async cannot noWrite', async () => {
      const response = {
        _id: 'generated',
        title: 'OVERRIDE',
      }

      nock(projectHost())
        .post(`/v1/agent/action/transform/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.transform({
        documentId: 'some-id',
        schemaId: 'some-schema-id',
        async: true,
        //@ts-expect-error not allowed
        noWrite: true,
      })
      expect(body._id).toEqual(response._id)
    })

    test('all the params', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/transform/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.transform<{title?: string}>({
        documentId: 'some-id',
        instruction: '$a $b $d',
        forcePublishedWrite: true,
        instructionParams: {
          a: 'constant',
          b: {
            type: 'field',
            path: ['title'],
          },
          c: {
            type: 'groq',
            query: '*[id=$id].title',
            params: {id: 'abc'},
            perspective: 'published',
          },
          d: {
            type: 'document',
            documentId: 'somewhere',
          },
        },
        temperature: 0.6,
        async: false,
        target: [
          {path: ['title'], operation: 'set'},
          {path: ['description'], operation: {type: 'image-description', sourcePath: ['image']}},
          {
            path: ['remoteImageDescription'],
            operation: {type: 'image-description', imageUrl: 'https://www.santiy.io/logo.png'},
          },
          {
            path: ['errorDesc'],
            operation: {
              type: 'image-description',
              imageUrl: 'https://www.santiy.io/logo.png',
              //@ts-expect-error imageUrl and sourcePath are mutually exclusive
              sourcePath: ['image'],
            },
          },
          {
            instruction: 'based on $c – replace this field',
            include: [
              'object',
              {
                path: 'array',
                operation: 'set',
                include: [{_key: '123'}],
                instruction: 'based on $b – replace this field',
                types: {
                  include: ['string'],
                },
              },
            ],
            types: {
              exclude: ['number'],
            },
          },
        ],
        noWrite: true,
        conditionalPaths: {
          defaultHidden: true,
          defaultReadOnly: false,
          paths: [{path: ['title'], readOnly: false, hidden: false}],
        },
        schemaId: 'some-schema-id',
      })
      expect(body.title).toEqual(response.title)
    })
  })

  describe.skipIf(isEdge)('AGENT ACTION: TRANSLATE', () => {
    test('can create new document', async () => {
      const response = {_id: 'created'}

      nock(projectHost())
        .post(`/v1/agent/action/translate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.translate({
        schemaId: 'some-schema-id',
        documentId: 'source-id',
        targetDocument: {operation: 'create'},
        toLanguage: {
          id: 'no-NB',
          title: 'Norsk Bokmål',
        },
      })
      expect(body).toEqual(response)
    })

    test('can tanslate existing document', async () => {
      const response = {
        _id: 'generated',
      }

      nock(projectHost())
        .post(`/v1/agent/action/translate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.translate({
        schemaId: 'some-schema-id',
        documentId: 'some-id',
        toLanguage: {
          id: 'no-NB',
          title: 'Norsk Bokmål',
        },
      })
      expect(body).toEqual(response)
    })

    test('can apply generics to type returned document value', async () => {
      const response = {
        _id: 'generated',
        title: 'oversatt',
      }

      nock(projectHost())
        .post(`/v1/agent/action/translate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.translate<{title?: string}>({
        schemaId: 'some-schema-id',
        documentId: 'some-id',
        toLanguage: {
          id: 'no-NB',
          title: 'Norsk Bokmål',
        },
      })
      expect(body.title).toEqual(response.title)
    })

    test('can cannot apply generics to async request since it returns _id only', async () => {
      const response = {
        _id: 'generated',
        title: 'OVERRIDE',
      }

      nock(projectHost())
        .post(`/v1/agent/action/translate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.translate({
        documentId: 'some-id',
        schemaId: 'some-schema-id',
        async: true,
        toLanguage: {
          id: 'no-NB',
          title: 'Norsk Bokmål',
        },
      })
      expect(body._id).toEqual(response._id)
    })

    test('async cannot noWrite', async () => {
      const response = {
        _id: 'generated',
        title: 'OVERRIDE',
      }

      nock(projectHost())
        .post(`/v1/agent/action/translate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.translate({
        documentId: 'some-id',
        toLanguage: {
          id: 'no-NB',
          title: 'Norsk Bokmål',
        },
        schemaId: 'some-schema-id',
        async: true,
        //@ts-expect-error not allowed
        noWrite: true,
      })
      expect(body._id).toEqual(response._id)
    })

    test('all the params', async () => {
      const response = {
        _id: 'generated',
        title: 'override',
      }

      nock(projectHost())
        .post(`/v1/agent/action/translate/${clientConfig.dataset}`)
        .reply(200, response)

      const body = await getClient().agent.action.translate<{title?: string}>({
        documentId: 'some-id',
        styleGuide: '$a $b $d',
        forcePublishedWrite: true,
        targetDocument: {
          operation: 'createIfNotExists',
          _id: 'target',
        },
        languageFieldPath: ['lang'],
        protectedPhrases: ['Sanity', 'headless'],
        fromLanguage: {
          id: 'en-US',
          title: 'American English',
        },
        toLanguage: {
          id: 'no-NB',
          title: 'Norsk Bokmål',
        },
        styleGuideParams: {
          a: 'constant',
          b: {
            type: 'field',
            path: ['title'],
          },
          c: {
            type: 'groq',
            query: '*[id=$id].title',
            params: {id: 'abc'},
          },
          d: {
            type: 'document',
            documentId: 'somewhere',
          },
        },
        temperature: 0.6,
        async: false,
        target: [
          {path: ['title']},
          {
            styleGuide: 'based on $c',
            include: [
              'object',
              {
                path: 'array',
                include: [{_key: '123'}],
                styleGuide: 'based on $b',
                types: {
                  include: ['string'],
                },
              },
            ],
            types: {
              exclude: ['number'],
            },
          },
        ],
        noWrite: true,
        conditionalPaths: {
          defaultHidden: true,
          defaultReadOnly: false,
          paths: [{path: ['title'], readOnly: false, hidden: false}],
        },
        schemaId: 'some-schema-id',
      })
      expect(body.title).toEqual(response.title)
    })
  })

  describe.skipIf(isEdge)('USERS', () => {
    test('can retrieve user by id', async () => {
      const response = {
        role: null,
        id: 'Z29vZA2MTc2MDY5MDI1MDA3MzA5MTAwOjozMjM',
        name: 'Mannen i Gata',
        email: 'some@email.com',
      }

      nock(projectHost()).get('/v1/users/me').reply(200, response)

      const body = await getClient().users.getById('me')
      expect(body).toEqual(response)
    })
  })

  describe.skipIf(isEdge)('CDN API USAGE', () => {
    test('will use CDN API by default', async () => {
      const client = createClient({projectId: 'abc123', dataset: 'foo'})

      const response = {result: []}
      nock('https://abc123.apicdn.sanity.io')
        .get('/v1/data/query/foo?query=*&returnQuery=false')
        .reply(200, response)

      const docs = await client.fetch('*')
      expect(docs.length).toEqual(0)
    })

    test('will use live API if told to', async () => {
      const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: false})

      const response = {result: []}
      nock('https://abc123.api.sanity.io')
        .get('/v1/data/query/foo?query=*&returnQuery=false')
        .reply(200, response)

      const docs = await client.fetch('*')
      expect(docs.length).toEqual(0)
    })

    test('will use live API for mutations', async () => {
      const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})

      nock('https://abc123.api.sanity.io')
        .post('/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync')
        .reply(200, {})

      await expect(client.create({_type: 'foo', title: 'yep'})).resolves.not.toThrow()
    })

    test('will use cdn for queries even when with token specified', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
        token: 'foo',
      })

      const reqheaders = {Authorization: 'Bearer foo'}
      nock('https://abc123.apicdn.sanity.io', {reqheaders})
        .get('/v1/data/query/foo?query=*&returnQuery=false')
        .reply(200, {result: []})

      await expect(client.fetch('*')).resolves.not.toThrow()
    })

    test('allows overriding headers', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'foo',
        token: 'foo',
        useCdn: false,
      })

      const reqheaders = {foo: 'bar'}
      nock('https://abc123.api.sanity.io', {reqheaders})
        .get('/v1/data/query/foo?query=*&returnQuery=false')
        .reply(200, {result: []})

      await expect(client.fetch('*', {}, {headers: {foo: 'bar'}})).resolves.not.toThrow()
    })

    test('will use live API if withCredentials is set to true', async () => {
      const client = createClient({
        withCredentials: true,
        projectId: 'abc123',
        dataset: 'foo',
        useCdn: true,
      })

      nock('https://abc123.api.sanity.io')
        .get('/v1/data/query/foo?query=*&returnQuery=false')
        .reply(200, {result: []})

      await expect(client.fetch('*')).resolves.not.toThrow()
    })
  })

  describe('HTTP REQUESTS', () => {
    test.skipIf(isEdge)('includes token if set', async () => {
      const qs = '?query=foo.bar&returnQuery=false'
      const token = 'abcdefghijklmnopqrstuvwxyz'
      const reqheaders = {Authorization: `Bearer ${token}`}
      nock(projectHost(), {reqheaders}).get(`/v1/data/query/foo${qs}`).reply(200, {result: []})

      const docs = await getClient({token}).fetch('foo.bar')
      expect(docs.length).toEqual(0)
    })

    test.skipIf(isEdge)('allows overriding token', async () => {
      const qs = '?query=foo.bar&returnQuery=false'
      const token = 'abcdefghijklmnopqrstuvwxyz'
      const override = '123456789'
      const reqheaders = {Authorization: `Bearer ${override}`}
      nock(projectHost(), {reqheaders}).get(`/v1/data/query/foo${qs}`).reply(200, {result: []})

      const docs = await getClient({token}).fetch('foo.bar', {}, {token: override})
      expect(docs.length).toEqual(0)
    })

    test.skipIf(isEdge)('allows overriding timeout', async () => {
      const qs = `?query=${encodeURIComponent('*[][0]')}&returnQuery=false`
      nock(projectHost()).get(`/v1/data/query/foo${qs}`).reply(200, {result: []})

      const docs = await getClient().fetch('*[][0]', {}, {timeout: 60 * 1000})
      expect(docs.length).toEqual(0)
    })

    test.runIf(isNode)('includes user agent in node', async () => {
      const {default: pkg} = await import('../package.json')
      const reqheaders = {'User-Agent': `${pkg.name} ${pkg.version}`}
      nock(projectHost(), {reqheaders}).get('/v1/data/doc/foo/bar').reply(200, {documents: []})

      await expect(getClient().getDocument('bar')).resolves.not.toThrow()
    })

    test.runIf(isNode)('includes user agent in node', async () => {
      const {default: pkg} = await import('../package.json')
      const reqheaders = {'User-Agent': `${pkg.name} ${pkg.version}`}
      nock(projectHost(), {reqheaders}).get('/v1/data/doc/foo/bar').reply(200, {documents: []})

      await expect(getClient().getDocument('bar')).resolves.not.toThrow()
    })

    // Don't rely on this unless you're working at Sanity Inc ;)
    test('can use alternative http requester', async () => {
      const requester = () =>
        observableOf({
          type: 'response',
          body: {documents: [{foo: 'bar'}]},
        })

      const res = await getClient({requester} as any).getDocument('foo.bar')
      expect(res!.foo).toEqual('bar')
    })

    test('ClientError includes message in stack', () => {
      const body = {error: {description: 'Invalid query'}}
      const error = new ClientError({statusCode: 400, headers: {}, body})
      expect(error.stack!.includes(body.error.description)).toBeTruthy()
    })

    test('ServerError includes message in stack', () => {
      const body = {
        error: 'Gateway Time-Out',
        message: 'The upstream service did not respond in time',
      }
      const error = new ServerError({statusCode: 504, headers: {}, body})
      expect(error.stack!.includes(body.error)).toBeTruthy()
      expect(error.stack!.includes(body.message)).toBeTruthy()
    })

    test('mutation error includes items in message', () => {
      const body = {
        error: {
          type: 'mutationError',
          description: 'Mutation(s) failed with 1 error(s)',
          items: [
            {
              error: {
                description: 'Malformed document ID: "#some_invalid-id!"',
                type: 'validationError',
                value: {Kind: {string_value: '#some_invalid-id!'}},
              },
            },
          ],
        },
      }
      const error = new ClientError({statusCode: 400, headers: {}, body})
      expect(error.message).toMatchInlineSnapshot(`
        "Mutation(s) failed with 1 error(s):
        - Malformed document ID: "#some_invalid-id!""
      `)
    })

    test('mutation errors handles items not being present', () => {
      const body = {
        error: {
          type: 'mutationError',
          description: 'Mutation(s) failed with 1 error(s)',
        },
      }
      const error = new ClientError({statusCode: 400, headers: {}, body})
      expect(error.message).toMatchInlineSnapshot(`
        "Mutation(s) failed with 1 error(s)"
      `)
    })

    test('mutation error includes at most 5 items in message', () => {
      const body = {
        error: {
          type: 'mutationError',
          description: 'Mutation(s) failed with 6 error(s)',
          items: [
            {error: {description: 'Malformed document ID: "#some_invalid-id!"'}},
            {error: {description: 'Malformed document ID: "@ruby_bird@"'}},
            {error: {description: 'Malformed document ID: "!cant_contain_that"'}},
            {error: {description: 'Malformed document ID: "what$about!this?"'}},
            {error: {description: 'Malformed document ID: "%so_many_percent%"'}},
            {error: {description: 'Malformed document ID: "{last_and_least}"'}},
          ],
        },
      }
      const error = new ClientError({statusCode: 400, headers: {}, body})
      expect(error.message).toMatchInlineSnapshot(`
        "Mutation(s) failed with 6 error(s):
        - Malformed document ID: "#some_invalid-id!"
        - Malformed document ID: "@ruby_bird@"
        - Malformed document ID: "!cant_contain_that"
        - Malformed document ID: "what$about!this?"
        - Malformed document ID: "%so_many_percent%"
        ...and 1 more"
      `)
    })

    test('mutation error gracefully drops invalid items', () => {
      const body = {
        error: {
          type: 'mutationError',
          description: 'Mutation(s) failed with 2 error(s)',
          items: [
            {not: {the: {expected: 'type'}}},
            {error: {description: 'Malformed document ID: "#some_invalid-id!"'}},
          ],
        },
      }
      const error = new ClientError({statusCode: 400, headers: {}, body})
      expect(error.message).toMatchInlineSnapshot(`
        "Mutation(s) failed with 2 error(s):
        - Malformed document ID: "#some_invalid-id!""
      `)
    })

    test('exposes ClientError', () => {
      expect(typeof ClientError).toEqual('function')
      const error = new ClientError({statusCode: 400, headers: {}, body: {}})
      expect(error instanceof Error).toBeTruthy()
      expect(error instanceof ClientError).toBeTruthy()
    })

    test('exposes ServerError', () => {
      expect(typeof ServerError).toEqual('function')
      const error = new ServerError({statusCode: 500, headers: {}, body: {}})
      expect(error instanceof Error).toBeTruthy()
      expect(error instanceof ServerError).toBeTruthy()
    })

    // Don't rely on this unless you're working at Sanity Inc ;)
    test('exposes default requester', async () => {
      const {requester} = await import('../src')
      expect(typeof requester).toEqual('function')
    })

    test.runIf(isNode)('handles HTTP errors gracefully', async () => {
      expect.assertions(2)

      const doc = {_id: 'barfoo', _type: 'document', visits: 5}
      const expectedBody = {mutations: [{create: doc}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .times(6)
        .replyWithError(new Error('Something went wrong'))

      try {
        await getClient().create(doc)
      } catch (err: any) {
        expect(err, 'should error').toBeInstanceOf(Error)
        expect(err.message, 'has message').toEqual('Something went wrong')
      }
    })
  })

  describe('getUrl', () => {
    test('can use getUrl() to get API-relative paths', () => {
      expect(getClient().getUrl('/bar/baz')).toEqual(`${projectHost()}/v1/bar/baz`)
    })

    test('can use getUrl() to get API-relative paths (custom api version)', () => {
      expect(getClient({apiVersion: '2019-01-29'}).getUrl('/bar/baz')).toEqual(
        `${projectHost()}/v2019-01-29/bar/baz`,
      )
    })
  })

  describe('getDataUrl', () => {
    test('can use getDataUrl() to get API paths to a dataset', () => {
      expect(getClient({dataset: 'bikeshop'}).getDataUrl('doc')).toBe('/data/doc/bikeshop')
      expect(getClient({dataset: 'bikeshop'}).getDataUrl('doc', 'bike-123')).toBe(
        '/data/doc/bikeshop/bike-123',
      )
    })
  })

  test('can use getDataUrl() to get API paths for a resource', () => {
    expect(
      getClient({'~experimental_resource': {type: 'media-library', id: 'res-id'}}).getDataUrl(
        'doc',
      ),
    ).toBe('/media-libraries/res-id/doc')
    expect(
      getClient({'~experimental_resource': {type: 'media-library', id: 'res-id'}}).getDataUrl(
        'doc',
        'bike-123',
      ),
    ).toBe('/media-libraries/res-id/doc/bike-123')
  })

  describe.skipIf(isEdge)('discardVersion()', () => {
    test('can discard draft version of a document with publishedId', async () => {
      const publishedId = 'doc123'

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.discard',
              versionId: 'drafts.doc123',
              purge: false,
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().discardVersion({publishedId})
      expect(res.transactionId).toEqual('abc123')
    })

    test('can discard a release version of a document', async () => {
      const publishedId = 'doc123'
      const releaseId = 'release456'

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.discard',
              versionId: 'versions.release456.doc123',
              purge: false,
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().discardVersion({publishedId, releaseId})
      expect(res.transactionId).toEqual('abc123')
    })

    test('can discard version with purge option set to true', async () => {
      const publishedId = 'doc123'

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.discard',
              versionId: 'drafts.doc123',
              purge: true,
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().discardVersion({publishedId}, true)
      expect(res.transactionId).toEqual('abc123')
    })

    test('handles errors when discarding versions', async () => {
      const publishedId = 'doc123'

      nock(projectHost()).post('/v1/data/actions/foo').replyWithError('Network error occurred')

      await expect(getClient().discardVersion({publishedId})).rejects.toThrowError()
    })

    test('throws when publishedId is missing', async () => {
      const args = {} as Partial<{publishedId: string; releaseId?: string}>

      let error: Error | null = null
      try {
        await getClient().discardVersion(args as any)
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
    })
  })

  describe.skipIf(isEdge)('unpublishVersion()', () => {
    test('can unpublish a release version of a document', async () => {
      const publishedId = 'doc123'
      const releaseId = 'release456'

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.unpublish',
              versionId: 'versions.release456.doc123',
              publishedId,
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().unpublishVersion({publishedId, releaseId})
      expect(res.transactionId).toEqual('abc123')
    })

    test('can unpublish a version with additional options', async () => {
      const publishedId = 'doc123'
      const releaseId = 'release456'
      const options = {
        skipCrossDatasetReferenceValidation: true,
        dryRun: true,
      }

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.unpublish',
              versionId: 'versions.release456.doc123',
              publishedId,
            },
          ],
          skipCrossDatasetReferenceValidation: true,
          dryRun: true,
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().unpublishVersion({publishedId, releaseId}, options)
      expect(res.transactionId).toEqual('abc123')
    })

    test('throws when releaseId is drafts', async () => {
      const args = {releaseId: 'drafts'} as any

      let error: Error | null = null
      try {
        await getClient().unpublishVersion(args)
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch('Version can not be "published" or "drafts"')
    })

    test('throws when data request fails', async () => {
      const args = {publishedId: 'doc123', releaseId: 'release456'} as any

      nock(projectHost()).post('/v1/data/actions/foo').reply(400, {
        error: 'Invalid document ID',
        message: 'Document ID must be a string',
      })

      let error: Error | null = null
      try {
        await getClient().unpublishVersion(args)
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch('Invalid document ID - Document ID must be a string')
    })
  })

  describe.skipIf(isEdge)('replaceVersion()', () => {
    test('can replace version using only document with _id', async () => {
      nock.cleanAll()
      const documentId = 'drafts.doc123'
      const document = {_id: documentId, _type: 'post', title: 'Only document ID'}

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _id: documentId,
                _type: 'post',
                title: 'Only document ID',
              },
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().replaceVersion({document})
      expect(res.transactionId).toEqual('abc123')
    })

    test('can replace version using document with _id and publishedId', async () => {
      nock.cleanAll()
      const documentId = 'drafts.doc123'
      const publishedId = 'doc123'
      const document = {_id: documentId, _type: 'post', title: 'Only document ID'}

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _id: documentId,
                _type: 'post',
                title: 'Only document ID',
              },
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().replaceVersion({document, publishedId})
      expect(res.transactionId).toEqual('abc123')
    })

    test('can replace version with draft document and publishedId', async () => {
      const publishedId = 'doc123'
      const document = {_type: 'post', title: 'Replace Version Test'}

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {...document, _id: 'drafts.doc123'},
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().replaceVersion({document, publishedId})
      expect(res.transactionId).toEqual('abc123')
    })

    test('can replace version with matching document, publishedId and releaseId', async () => {
      const publishedId = 'doc123'
      const releaseId = 'release456'
      const document = {_type: 'post', title: 'Replace Version Test'}

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {...document, _id: 'versions.release456.doc123'},
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().replaceVersion({document, publishedId, releaseId})
      expect(res.transactionId).toEqual('abc123')
    })

    test('throws when document id does not match generated version id', async () => {
      const document = {_type: 'post', _id: 'doc123'}
      const publishedId = 'doc123'
      const releaseId = 'release456'

      let error: Error | null = null
      try {
        await getClient().replaceVersion({document, publishedId, releaseId})
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch(
        'The provided document ID (`doc123`) does not match the generated version ID (`versions.release456.doc123`)',
      )
    })

    test('throws when draft document id does not match generated version id', async () => {
      const document = {_type: 'post', _id: 'drafts.doc123'}
      const publishedId = 'doc123'
      const releaseId = 'release456'

      let error: Error | null = null
      try {
        await getClient().replaceVersion({document, publishedId, releaseId})
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch(
        'The provided document ID (`drafts.doc123`) does not match the generated version ID (`versions.release456.doc123`)',
      )
    })

    test('throws when releaseId is drafts', async () => {
      const document = {_type: 'post', _id: 'doc123'}
      const publishedId = 'doc123'
      const releaseId = 'drafts'

      let error: Error | null = null
      try {
        await getClient().replaceVersion({document, publishedId, releaseId})
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch('Version can not be "published" or "drafts"')
    })

    test('throws when neither publishedId nor document._id are provided', async () => {
      const document = {_type: 'post', title: 'No ID'}

      let error: Error | null = null
      try {
        await getClient().replaceVersion({document} as any)
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch(
        '`replaceVersion()` requires either a publishedId or a document with an `_id`',
      )
    })

    test('handles network errors gracefully', async () => {
      nock.cleanAll()
      const publishedId = 'error123'
      const document = {_type: 'post', title: 'Error Test', _id: 'drafts.error123'}

      nock(projectHost())
        .filteringRequestBody(() => '*')
        .post('/v1/data/actions/foo', '*')
        .replyWithError('Network error occurred')

      await expect(getClient().replaceVersion({document, publishedId})).rejects.toThrowError()
    })

    test('throws when document is missing _type property', async () => {
      nock.cleanAll()
      const publishedId = 'typeless123'
      const document = {title: 'Missing Type'} as any

      let error: Error | null = null
      try {
        await getClient().replaceVersion({document, publishedId})
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch(
        '`replaceVersion()` requires that the document contains a type (`_type` property)',
      )
    })

    test('throws when document._id is provided but is not a version ID or draft ID', async () => {
      const document = {
        _id: 'regularId123',
        _type: 'post',
        title: 'Regular ID',
      }

      let error: Error | null = null
      try {
        await getClient().replaceVersion({document})
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch(
        '`replaceVersion()` requires a document with an `_id` that is a version or draft ID',
      )
    })

    test('throws when document._id is a draft ID and releaseId is provided', async () => {
      const publishedId = 'doc123'
      const releaseId = 'release456'
      const documentId = `drafts.${publishedId}`
      const document = {
        _id: documentId,
        _type: 'post',
        title: 'Draft ID',
      }

      let error: Error | null = null
      try {
        await getClient().replaceVersion({document, releaseId})
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch(
        `\`replaceVersion()\` was called with a document ID (\`${documentId}\`) that is a draft ID, but a release ID (\`${releaseId}\`) was also provided.`,
      )
    })

    test('throws when document._id is a version ID but version does not match provided releaseId', async () => {
      const publishedId = 'doc123'
      const wrongReleaseId = 'oldRelease789'
      const releaseId = 'newRelease456'
      const versionId = `versions.${wrongReleaseId}.${publishedId}`
      const document = {
        _id: versionId,
        _type: 'post',
        title: 'Version ID mismatch',
      }

      let error: Error | null = null
      try {
        await getClient().replaceVersion({document, releaseId})
      } catch (err) {
        error = err as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toMatch(
        `\`replaceVersion()\` was called with a document ID (\`${versionId}\`) that is a version ID, but the release ID (\`${releaseId}\`) does not match the document's version ID (\`${wrongReleaseId}\`).`,
      )
    })

    test('can use document with existing _id', async () => {
      nock.cleanAll()
      const documentId = 'drafts.existing123'
      const document = {_id: documentId, _type: 'post', title: 'Only document ID'}

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _id: documentId,
                _type: 'post',
                title: 'Only document ID',
              },
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().replaceVersion({document})
      expect(res.transactionId).toEqual('abc123')
    })

    test('can use publishedId to generate draft ID with no document._id', async () => {
      nock.cleanAll()
      const publishedId = 'doc123'
      const document = {_type: 'post', title: 'Replace Version Test'}

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _type: 'post',
                title: 'Replace Version Test',
                _id: `drafts.${publishedId}`,
              },
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().replaceVersion({document, publishedId})
      expect(res.transactionId).toEqual('abc123')
    })

    test('combines publishedId and releaseId to create version ID', async () => {
      nock.cleanAll()
      const publishedId = 'rel123'
      const releaseId = 'release789'
      const document = {_type: 'post', title: 'Replace with Release Test'}

      nock(projectHost())
        .post('/v1/data/actions/foo', {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _type: 'post',
                title: 'Replace with Release Test',
                _id: `versions.${releaseId}.${publishedId}`,
              },
            },
          ],
        })
        .reply(200, {
          transactionId: 'abc123',
        })

      const res = await getClient().replaceVersion({document, publishedId, releaseId})
      expect(res.transactionId).toEqual('abc123')
    })
  })

  test.skipIf(isEdge)('allows overriding headers', async () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      token: 'foo',
      useCdn: false,
    })

    const reqheaders = {foo: 'bar'}
    nock('https://abc123.api.sanity.io', {reqheaders})
      .get('/v1/data/query/foo?query=*&returnQuery=false')
      .reply(200, {result: []})

    await expect(client.fetch('*', {}, {headers: {foo: 'bar'}})).resolves.not.toThrow()
  })

  test.skipIf(isEdge)('applies headers from client configuration', async () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      useCdn: false,
      headers: {
        'X-Custom-Header': 'custom-value',
        'X-Another-Header': 'another-value',
      },
    })

    const reqheaders = {
      'X-Custom-Header': 'custom-value',
      'X-Another-Header': 'another-value',
    }
    nock('https://abc123.api.sanity.io', {reqheaders})
      .get('/v1/data/query/foo?query=*&returnQuery=false')
      .reply(200, {result: []})

    await expect(client.fetch('*')).resolves.not.toThrow()
  })

  test.skipIf(isEdge)('critical headers are not overridden by config headers', async () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      token: 'auth-token',
      useCdn: false,
      headers: {
        'X-Custom-Header': 'config-value',
        Authorization: 'Bearer fake-token',
      },
    })

    const reqheaders = {
      Authorization: 'Bearer auth-token',
      'X-Custom-Header': 'config-value',
    }
    nock('https://abc123.api.sanity.io', {reqheaders})
      .get('/v1/data/query/foo?query=auth-test&returnQuery=false')
      .reply(200, {result: []})

    const reqheaders2 = {
      Authorization: 'Bearer request-token',
      'X-Custom-Header': 'request-value',
    }
    nock('https://abc123.api.sanity.io', {reqheaders: reqheaders2})
      .get('/v1/data/query/foo?query=request-test&returnQuery=false')
      .reply(200, {result: []})

    await expect(client.fetch('auth-test')).resolves.not.toThrow()
    await expect(
      client.fetch(
        'request-test',
        {},
        {
          headers: {
            Authorization: 'Bearer request-token',
            'X-Custom-Header': 'request-value',
          },
        },
      ),
    ).resolves.not.toThrow()
  })

  test.skipIf(isEdge)('headers can be reconfigured', async () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      useCdn: false,
      headers: {
        'X-Custom-Header': 'mutation-test',
      },
    })

    const reqheaders = {'X-Custom-Header': 'mutation-test'}
    nock('https://abc123.api.sanity.io', {reqheaders})
      .post('/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync')
      .reply(200, {transactionId: 'abc123', results: [{id: 'doc123', operation: 'create'}]})

    await expect(client.create({_type: 'test', title: 'Test Document'})).resolves.not.toThrow()

    client.config({
      headers: {
        'X-Custom-Header': 'new-value',
      },
    })

    const reqheaders2 = {'X-Custom-Header': 'new-value'}
    nock('https://abc123.api.sanity.io', {reqheaders: reqheaders2})
      .get('/v1/data/query/foo?query=*&returnQuery=false')
      .reply(200, {result: []})

    await expect(client.fetch('*')).resolves.not.toThrow()

    client.config({
      headers: {},
    })

    nock('https://abc123.api.sanity.io')
      .get('/v1/data/query/foo?query=empty-test&returnQuery=false')
      .reply(200, {result: []})

    await expect(client.fetch('empty-test')).resolves.not.toThrow()
  })

  test.skipIf(isEdge)('will use live API if withCredentials is set to true', async () => {
    const client = createClient({
      withCredentials: true,
      projectId: 'abc123',
      dataset: 'foo',
      useCdn: true,
    })

    nock('https://abc123.api.sanity.io')
      .get('/v1/data/query/foo?query=*&returnQuery=false')
      .reply(200, {result: []})

    await expect(client.fetch('*')).resolves.not.toThrow()
  })

  describe('mediaLibrary', () => {
    const mediaLibraryId = 'ml123abc'
    const mediaLibraryClientConfig: ClientConfig = {
      '~experimental_resource': {type: 'media-library', id: mediaLibraryId},
    }
    test.skipIf(isEdge)('video.getPlaybackInfo with string asset identifier', async () => {
      const client = getClient(mediaLibraryClientConfig)
      const assetId = 'video-abc123def'
      const mockResponse = {
        id: assetId,
        thumbnail: {url: 'https://example.com/thumb.jpg'},
        animated: {url: 'https://example.com/animated.gif'},
        storyboard: {url: 'https://example.com/storyboard.vtt'},
        stream: {url: 'https://example.com/stream.m3u8'},
        duration: 120,
        aspectRatio: 1.77,
      }

      nock(globalApiHost)
        .get(`/v1/media-libraries/${mediaLibraryId}/video/video-abc123def/playback-info`)
        .reply(200, mockResponse)

      const result = await client.mediaLibrary.video.getPlaybackInfo(assetId)
      expect(result).toEqual(mockResponse)
    })

    test.skipIf(isEdge)('video.getPlaybackInfo with GDR asset identifier', async () => {
      const client = getClient(mediaLibraryClientConfig)
      const assetRef = {_ref: `media-library:${mediaLibraryId}:instance456`}
      const mockResponse = {
        id: 'instance456',
        thumbnail: {url: 'https://example.com/thumb.jpg'},
        animated: {url: 'https://example.com/animated.gif'},
        storyboard: {url: 'https://example.com/storyboard.vtt'},
        stream: {url: 'https://example.com/stream.m3u8'},
        duration: 120,
        aspectRatio: 1.77,
      }

      nock(globalApiHost)
        .get(`/v1/media-libraries/${mediaLibraryId}/video/instance456/playback-info`)
        .reply(200, mockResponse)

      const result = await client.mediaLibrary.video.getPlaybackInfo(assetRef)
      expect(result).toEqual(mockResponse)
    })

    test.skipIf(isEdge)('video.getPlaybackInfo with transformation options', async () => {
      const client = getClient(mediaLibraryClientConfig)
      const assetId = 'video-test123'
      const options = {
        transformations: {
          thumbnail: {
            width: 640,
            height: 360,
            time: 30,
            fit: 'crop' as const,
            format: 'jpg' as const,
          },
          animated: {width: 320, height: 180, start: 10, end: 20, fps: 15, format: 'gif' as const},
          storyboard: {format: 'jpg' as const},
        },
        expiration: 3600,
      }
      const mockResponse = {
        id: assetId,
        thumbnail: {url: 'https://example.com/thumb-640x360.jpg'},
        animated: {url: 'https://example.com/animated-320x180.gif'},
        storyboard: {url: 'https://example.com/storyboard.vtt'},
        stream: {url: 'https://example.com/stream.m3u8'},
        duration: 120,
        aspectRatio: 1.77,
      }

      nock(globalApiHost)
        .get(`/v1/media-libraries/${mediaLibraryId}/video/video-test123/playback-info`)
        .query({
          thumbnailWidth: 640,
          thumbnailHeight: 360,
          thumbnailTime: 30,
          thumbnailFit: 'crop',
          thumbnailFormat: 'jpg',
          animatedWidth: 320,
          animatedHeight: 180,
          animatedStart: 10,
          animatedEnd: 20,
          animatedFps: 15,
          animatedFormat: 'gif',
          storyboardFormat: 'jpg',
          expiration: 3600,
        })
        .reply(200, mockResponse)

      const result = await client.mediaLibrary.video.getPlaybackInfo(assetId, options)
      expect(result).toEqual(mockResponse)
    })

    test.skipIf(isEdge)('video.getPlaybackInfo throws error for invalid GDR format', async () => {
      const client = getClient(mediaLibraryClientConfig)

      // Test various invalid GDR formats
      const invalidRefs = [
        {
          _ref: 'invalid:format',
          expectedError:
            'Invalid video asset instance identifier "invalid:format": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
        },
        {
          _ref: 'media-library:',
          expectedError:
            'Invalid video asset instance identifier "media-library:": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
        },
        {
          _ref: 'media-library:ml123:',
          expectedError:
            'Invalid video asset instance identifier "media-library:ml123:": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
        },
        {
          _ref: 'media-library::instanceId',
          expectedError:
            'Invalid video asset instance identifier "media-library::instanceId": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
        },
        {
          _ref: 'wrongPrefix:ml123:instance',
          expectedError:
            'Invalid video asset instance identifier "wrongPrefix:ml123:instance": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
        },
        {
          _ref: 'media-library:ml123:instance:extra',
          expectedError:
            'Invalid video asset instance identifier "media-library:ml123:instance:extra": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
        },
        {
          _ref: 'media-library:library123:instance456', // Missing 'ml' prefix
          expectedError:
            'Invalid video asset instance identifier "media-library:library123:instance456": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
        },
      ]

      for (const {_ref, expectedError} of invalidRefs) {
        try {
          await client.mediaLibrary.video.getPlaybackInfo({_ref})
          // Should not reach here
          expect.fail(`Expected error for ref: ${_ref}`)
        } catch (err) {
          expect((err as Error).message).toContain(expectedError)
        }
      }
    })

    test.skipIf(isEdge)(
      'video.getPlaybackInfo throws error for invalid asset instance id',
      async () => {
        const client = getClient(mediaLibraryClientConfig)

        expect.assertions(2)

        try {
          await client.mediaLibrary.video.getPlaybackInfo({} as any)
        } catch (err) {
          expect((err as Error).message).toBe(
            'Invalid video asset instance identifier "[object Object]": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
          )
        }

        try {
          await client.mediaLibrary.video.getPlaybackInfo({_ref: 123} as any)
        } catch (err) {
          expect((err as Error).message).toBe(
            'Invalid video asset instance identifier "123": must be a valid video instance id or a Global Dataset Reference (GDR) to the video asset in the Media Library',
          )
        }
      },
    )

    test.skipIf(isEdge)('video.getPlaybackInfo handles API errors', async () => {
      const client = getClient(mediaLibraryClientConfig)
      const assetId = 'video-error123'

      nock(globalApiHost)
        .get(`/v1/media-libraries/${mediaLibraryId}/video/video-error123/playback-info`)
        .reply(404, {error: 'Asset not found'})

      await expect(client.mediaLibrary.video.getPlaybackInfo(assetId)).rejects.toThrow()
    })

    test.skipIf(isEdge)('video.getPlaybackInfo with partial transformation options', async () => {
      const client = getClient(mediaLibraryClientConfig)
      const assetId = 'video-partial123'
      const options = {
        transformations: {
          thumbnail: {width: 800},
          animated: {format: 'webp' as const},
        },
      }
      const mockResponse = {
        id: assetId,
        thumbnail: {url: 'https://example.com/thumb-800.jpg'},
        animated: {url: 'https://example.com/animated.webp'},
        storyboard: {url: 'https://example.com/storyboard.vtt'},
        stream: {url: 'https://example.com/stream.m3u8'},
        duration: 120,
        aspectRatio: 1.77,
      }

      nock(globalApiHost)
        .get(`/v1/media-libraries/${mediaLibraryId}/video/video-partial123/playback-info`)
        .query({
          thumbnailWidth: 800,
          animatedFormat: 'webp',
        })
        .reply(200, mockResponse)

      const result = await client.mediaLibrary.video.getPlaybackInfo(assetId, options)
      expect(result).toEqual(mockResponse)
    })

    test.skipIf(isEdge)('video.getPlaybackInfo with signed/secured response', async () => {
      const client = getClient(mediaLibraryClientConfig)
      const assetId = 'video-secured123'
      const mockResponse = {
        id: assetId,
        thumbnail: {url: 'https://example.com/thumb.jpg', token: 'thumb-token-123'},
        animated: {url: 'https://example.com/animated.gif', token: 'anim-token-456'},
        storyboard: {url: 'https://example.com/storyboard.vtt', token: 'story-token-789'},
        stream: {url: 'https://example.com/stream.m3u8', token: 'stream-token-abc'},
        duration: 90,
        aspectRatio: 1.77,
      }

      nock(globalApiHost)
        .get(`/v1/media-libraries/${mediaLibraryId}/video/video-secured123/playback-info`)
        .reply(200, mockResponse)

      const {getPlaybackTokens, isSignedPlaybackInfo} = await import('../src/media-library')

      const result = await client.mediaLibrary.video.getPlaybackInfo(assetId)
      expect(result).toEqual(mockResponse)

      // Test that we can detect it's a signed response
      expect('token' in result.stream).toBe(true)
      expect('token' in result.thumbnail).toBe(true)

      // Test helper functions
      expect(isSignedPlaybackInfo(result)).toBe(true)

      // Test token extraction using the helper function
      const tokens = getPlaybackTokens(result)
      expect(tokens).toEqual({
        stream: 'stream-token-abc',
        thumbnail: 'thumb-token-123',
        storyboard: 'story-token-789',
        animated: 'anim-token-456',
      })

      // Type assertions - check that tokens are present
      if (tokens && 'token' in result.stream) {
        // Result is a signed response, cast it for type checking
        const signedResult = result as VideoPlaybackInfoSigned
        expectTypeOf(signedResult.stream.token).toBeString()
        expectTypeOf(signedResult.thumbnail.token).toBeString()
        expectTypeOf(signedResult.storyboard.token).toBeString()
        expectTypeOf(signedResult.animated.token).toBeString()
      }
    })
  })

  describe.skipIf(!isNode)('lineage', () => {
    test('adds lineage header through client constructor', async () => {
      const client = getClient({lineage: 'my-lineage-id'})
      nock(projectHost(), {
        reqheaders: {
          'x-sanity-lineage': 'my-lineage-id',
        },
      })
        .get('/v1/data/query/foo?query=*&returnQuery=false')
        .reply(200, {result: []})

      await expect(client.fetch('*')).resolves.not.toThrow()
    })

    test('adds lineage header through environment variable', async () => {
      vi.stubEnv('X_SANITY_LINEAGE', 'env-lineage-id')

      const client = getClient()

      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{createOrReplace: doc}]}
      nock(projectHost(), {
        reqheaders: {
          'x-sanity-lineage': 'env-lineage-id',
        },
      })
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: '123abc', results: [{id: 'abc123', operation: 'create'}]})

      await expect(client.createOrReplace(doc)).resolves.not.toThrow()
    })

    test('environment variable overrides client constructor option', async () => {
      vi.stubEnv('X_SANITY_LINEAGE', 'env-lineage-id')

      const client = getClient({lineage: 'client-lineage-id'})

      const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
      const expectedBody = {mutations: [{createOrReplace: doc}]}
      nock(projectHost(), {
        reqheaders: {
          'x-sanity-lineage': 'env-lineage-id',
        },
      })
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: '123abc', results: [{id: 'abc123', operation: 'create'}]})

      await expect(client.createOrReplace(doc)).resolves.not.toThrow()
    })
  })
})
