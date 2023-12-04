import fs from 'node:fs'
import path from 'node:path'

import {
  type ClientConfig,
  ClientError,
  ContentSourceMap,
  createClient,
  type DatasetsResponse,
  Patch,
  type SanityProject,
  ServerError,
  Transaction,
} from '@sanity/client'
import {of as observableOf} from 'rxjs'
import {filter} from 'rxjs/operators'
import {describe, expect, test, vi} from 'vitest'

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

    test('throws if encodeSourceMap is provided', () => {
      // @ts-expect-error - we want to test that it throws an error
      expect(() => createClient({projectId: 'abc123', encodeSourceMap: true})).toThrow(
        /encodeSourceMap/,
      )
    })

    test('throws if studioUrl is provided', () => {
      // @ts-expect-error - we want to test that it throws an error
      expect(() => createClient({projectId: 'abc123', studioUrl: '/studio'})).toThrow(/studioUrl/)
    })

    test('throws if logger is provided', () => {
      // @ts-expect-error - we want to test that it throws an error
      expect(() => createClient({projectId: 'abc123', logger: console})).toThrow(/logger/)
    })

    test('throws if stega is provided', () => {
      // @ts-expect-error - we want to test that it throws an error
      expect(() => createClient({projectId: 'abc123', stega: {}})).toThrow(/stega/)
    })

    test('allows stega to be explicitly undefined', () => {
      // @ts-expect-error - we want to test that it throws an error
      expect(() => createClient({projectId: 'abc123', stega: undefined})).not.toThrow()
    })

    test('throws on invalid perspective', () => {
      expect(() => createClient({projectId: 'abc123', perspective: 'published'})).not.toThrow(
        /Invalid API perspective/,
      )
      expect(() => createClient({projectId: 'abc123', perspective: 'previewDrafts'})).not.toThrow(
        /Invalid API perspective/,
      )
      expect(() => createClient({projectId: 'abc123', perspective: 'raw'})).not.toThrow(
        /Invalid API perspective/,
      )
      // @ts-expect-error -- we want to test that it throws an error
      expect(() => createClient({projectId: 'abc123', perspective: 'preview drafts'})).toThrow(
        /Invalid API perspective/,
      )
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

    test.each([429, 502, 503])('can be configured to not retry %d', async (code) => {
      nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(code, {})
      const client = createClient({
        useProjectHostname: false,
        apiHost: `https://${apiHost}`,
        maxRetries: 0,
      })

      expect(client.projects.getById('n1f7y')).rejects.toBeDefined()
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
      expect(client.projects.getById('n1f7y')).rejects.toBeDefined()
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

      nock(projectHost()).get(`/v1/data/query/foo?query=${qs}`).reply(200, {
        ms: 123,
        query: query,
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
        query: query,
        result,
      })

      const res = await getClient().fetch(query, params, {filterResponse: false})
      expect(res.ms, 'should include timing info').toBe(123)
      expect(res.query, 'should include query').toBe(query)
      expect(res.result.length, 'length should match').toBe(1)
      expect(res.result[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)('can query for documents with request tag', async () => {
      nock(projectHost()).get(`/v1/data/query/foo?query=*&tag=mycompany.syncjob`).reply(200, {
        ms: 123,
        query: '*',
        result,
      })

      const res = await getClient().fetch('*', {}, {tag: 'mycompany.syncjob'})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    })

    test.skipIf(isEdge)(
      'can query for documents with resultSourceMap and perspective',
      async () => {
        nock(projectHost())
          .get(`/vX/data/query/foo?query=*&resultSourceMap=true&perspective=previewDrafts`)
          .reply(200, {
            ms: 123,
            query: '*',
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
            `/vX/data/query/foo?query=*&resultSourceMap=withKeyArraySelector&perspective=previewDrafts`,
          )
          .reply(200, {
            ms: 123,
            query: '*',
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
        .get(`/v1/data/query/foo?query=*&perspective=previewDrafts`)
        .reply(200, {
          ms: 123,
          query: '*',
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
          .get(`/vX/data/query/foo?query=*&resultSourceMap=true&perspective=previewDrafts`)
          .reply(200, {
            ms: 123,
            query: '*',
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
        nock(projectHost()).get(`/vX/data/query/foo?query=*&perspective=published`).reply(200, {
          ms: 123,
          query: '*',
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
          .get(`/v1/data/query/foo?query=*&perspective=previewDrafts`)
          .reply(200, {
            ms: 123,
            query: '*',
            result,
          })

        const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})
        const res = await client.fetch('*', {}, {perspective: 'previewDrafts'})
        expect(res.length, 'length should match').toBe(1)
        expect(res[0].rating, 'data should match').toBe(5)
      },
    )

    test.skipIf(isEdge)('throws on invalid request tag on request', () => {
      nock(projectHost()).get(`/v1/data/query/foo?query=*&tag=mycompany.syncjob`).reply(200, {
        ms: 123,
        query: '*',
        result,
      })

      expect(() => {
        getClient().fetch('*', {}, {tag: 'mycompany syncjob ok'})
      }).toThrow(/tag can only contain alphanumeric/i)
    })

    test.skipIf(isEdge)('can use a tag-prefixed client', async () => {
      nock(projectHost()).get(`/v1/data/query/foo?query=*&tag=mycompany.syncjob`).reply(200, {
        ms: 123,
        query: '*',
        result,
      })

      const res = await getClient({requestTagPrefix: 'mycompany'}).fetch('*', {}, {tag: 'syncjob'})
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

      nock(projectHost()).get('/v1/data/query/foo?query=area51').times(5).reply(403, response)

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
        .get('/v1/data/query/foo?query=foo.bar.baz%20%2012%23%5B%7B')
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

    test.skipIf(isEdge || typeof globalThis.AbortController === 'undefined')(
      'can cancel request with an abort controller signal',
      async () => {
        expect.assertions(2)

        nock(projectHost()).get(`/v1/data/query/foo?query=*`).delay(100).reply(200, {
          ms: 123,
          query: '*',
          result: [],
        })

        const abortController = new AbortController()
        const fetch = getClient().fetch('*', {}, {signal: abortController.signal})
        await new Promise((resolve) => setTimeout(resolve, 10))

        try {
          abortController.abort()
          await fetch
        } catch (err: any) {
          expect(err).toBeInstanceOf(Error)
          expect(err.name, 'should throw AbortError').toBe('AbortError')
        }
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
      const expectedBody = {mutations: [{delete: {query: query, params: params}}]}
      nock(projectHost())
        .post(
          '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync',
          expectedBody,
        )
        .reply(200, {transactionId: 'abc123'})

      await expect(getClient().delete({query: query, params: params})).resolves.not.toThrow()
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
        .query({query, ...qParams})
        .reply(200, {
          ms: 123,
          query: query,
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

      nock(projectHost())
        .filteringRequestBody(/.*/, '*')
        .post('/v1/data/query/foo', '*')
        .reply(200, {
          ms: 123,
          query: query,
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

      nock(projectHost())
        .filteringRequestBody(/.*/, '*')
        .post('/v1/data/query/foo', '*')
        .reply(code, {})

      nock(projectHost())
        .filteringRequestBody(/.*/, '*')
        .post('/v1/data/query/foo', '*')
        .reply(200, {
          ms: 123,
          query: query,
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

        nock(projectHost())
          .filteringRequestBody(/.*/, '*')
          .post('/v1/data/query/foo?tag=myapp.silly-query', '*')
          .reply(200, {
            ms: 123,
            query: query,
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

        nock(projectHost())
          .filteringRequestBody(/.*/, '*')
          .post('/vX/data/query/foo?resultSourceMap=true&perspective=previewDrafts', '*')
          .reply(200, {
            ms: 123,
            query: query,
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

      nock('https://abc123.apicdn.sanity.io')
        .filteringRequestBody(/.*/, '*')
        .post('/v1/data/query/foo', '*')
        .reply(200, {
          ms: 123,
          query: query,
          result,
        })

      const res = await client.fetch(query, params)
      expect(res.length, 'length should match').toEqual(1)
      expect(res[0].rating, 'data should match').toEqual(5)
    })
  })

  describe('PATCH OPS', () => {
    test('can build and serialize a patch of operations', () => {
      const patch = getClient().patch('abc123').inc({count: 1}).set({brownEyes: true}).serialize()

      expect(patch).toEqual({id: 'abc123', inc: {count: 1}, set: {brownEyes: true}})
    })

    test('patch() can take an array of IDs', () => {
      const patch = getClient().patch(['abc123', 'foo.456']).inc({count: 1}).serialize()
      expect(patch).toEqual({id: ['abc123', 'foo.456'], inc: {count: 1}})
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
        `data: ${JSON.stringify({document: doc})}`,
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

      await new Promise<void>((resolve, reject) => {
        const sub = getClient()
          .listen('foo.bar')
          .subscribe({
            next: (evt: any) => {
              expect(evt.document).toEqual(doc)
              sub.unsubscribe()
              resolve()
            },
            error: (err) => {
              sub.unsubscribe()
              reject(err)
            },
          })
      })
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
        `data: ${JSON.stringify({document: doc})}`,
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

      await new Promise<void>((resolve, reject) => {
        const sub = getClient()
          .listen('*[_type == "checkin"]', {}, {tag: 'sfcraft.checkins'})
          .subscribe({
            next: (evt: any) => {
              expect(evt.document).toEqual(doc)
              sub.unsubscribe()
              resolve()
            },
            error: (err) => {
              sub.unsubscribe()
              reject(err)
            },
          })
      })
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
        `data: ${JSON.stringify({document: doc})}`,
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

      await new Promise<void>((resolve, reject) => {
        const sub = getClient({requestTagPrefix: 'sf.craft.'})
          .listen('*[_type == "checkin"]', {}, {tag: 'checkins'})
          .subscribe({
            next: (evt: any) => {
              expect(evt.document).toEqual(doc)
              sub.unsubscribe()
              resolve()
            },
            error: (err) => {
              sub.unsubscribe()
              reject(err)
            },
          })
      })
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

      await new Promise<void>((resolve, reject) => {
        expect(didRequest).toBe(false)
        const sub = req.subscribe({
          next: () => {
            expect(didRequest).toBe(true)
            sub.unsubscribe()
            resolve()
          },
          error: (err) => {
            sub.unsubscribe()
            reject(err)
          },
        })
      })
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

      await new Promise<void>((resolve, reject) => {
        expect(requestCount).toBe(0)
        const firstSub = req.subscribe({
          next: () => {
            expect(requestCount).toBe(1)
            firstSub.unsubscribe()
            const secondSub = req.subscribe({
              next: () => {
                expect(requestCount).toBe(2)
                secondSub.unsubscribe()
                resolve()
              },
              error: (err) => {
                secondSub.unsubscribe()
                reject(err)
              },
            })
          },
          error: (err) => {
            firstSub.unsubscribe()
            reject(err)
          },
        })
      })
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

      await new Promise<void>((resolve, reject) => {
        getClient()
          .observable.assets.upload('image', fs.createReadStream(fixturePath))
          .pipe(filter((event) => event.type === 'progress'))
          .subscribe((event) => expect(event.type, 'progress').toEqual('progress'), reject, resolve)
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
      nock('https://abc123.apicdn.sanity.io').get('/v1/data/query/foo?query=*').reply(200, response)

      const docs = await client.fetch('*')
      expect(docs.length).toEqual(0)
    })

    test('will use live API if told to', async () => {
      const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: false})

      const response = {result: []}
      nock('https://abc123.api.sanity.io').get('/v1/data/query/foo?query=*').reply(200, response)

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
        .get('/v1/data/query/foo?query=*')
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
        .get('/v1/data/query/foo?query=*')
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
        .get('/v1/data/query/foo?query=*')
        .reply(200, {result: []})

      await expect(client.fetch('*')).resolves.not.toThrow()
    })
  })

  describe('HTTP REQUESTS', () => {
    test.skipIf(isEdge)('includes token if set', async () => {
      const qs = '?query=foo.bar'
      const token = 'abcdefghijklmnopqrstuvwxyz'
      const reqheaders = {Authorization: `Bearer ${token}`}
      nock(projectHost(), {reqheaders}).get(`/v1/data/query/foo${qs}`).reply(200, {result: []})

      const docs = await getClient({token}).fetch('foo.bar')
      expect(docs.length).toEqual(0)
    })

    test.skipIf(isEdge)('allows overriding token', async () => {
      const qs = '?query=foo.bar'
      const token = 'abcdefghijklmnopqrstuvwxyz'
      const override = '123456789'
      const reqheaders = {Authorization: `Bearer ${override}`}
      nock(projectHost(), {reqheaders}).get(`/v1/data/query/foo${qs}`).reply(200, {result: []})

      const docs = await getClient({token}).fetch('foo.bar', {}, {token: override})
      expect(docs.length).toEqual(0)
    })

    test.skipIf(isEdge)('allows overriding timeout', async () => {
      const qs = `?query=${encodeURIComponent('*[][0]')}`
      nock(projectHost()).get(`/v1/data/query/foo${qs}`).reply(200, {result: []})

      const docs = await getClient().fetch('*[][0]', {}, {timeout: 60 * 1000})
      expect(docs.length).toEqual(0)
    })

    test.runIf(isNode)('includes user agent in node', async () => {
      const pkg = await import('../package.json')
      const reqheaders = {'User-Agent': `${pkg.name} ${pkg.version}`}
      nock(projectHost(), {reqheaders}).get('/v1/data/doc/foo/bar').reply(200, {documents: []})

      await expect(getClient().getDocument('bar')).resolves.not.toThrow()
    })

    test.runIf(isNode)('includes user agent in node', async () => {
      const pkg = await import('../package.json')
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
})
