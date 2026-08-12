import {requester, type SanityProject} from '@sanity/client'
import type {FetchFunction} from 'get-it'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

import {getActiveFetch, getActiveMock} from '../helpers/mockFetch'
import {apiHost, createClient, getClient, isNode} from './helpers'

describe('PROJECTS', () => {
  test('can request list of projects', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects')
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})

    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
    const projects = await client.projects.list()
    expect(projects.length, 'should have two projects').toBe(2)
    expect(projects[0].id, 'should have project id').toBe('foo')
  })

  test('can request list of projects with members', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects')
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})

    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
    let projects = await client.projects.list({includeMembers: true})
    expect(projects.length, 'should have two projects').toBe(2)
    expect(projects[0].id, 'should have project id').toBe('foo')

    projects = await client.projects.list({includeMembers: undefined})
    expect(projects.length, 'should have two projects').toBe(2)
    expect(projects[0].id, 'should have project id').toBe('foo')
  })

  test('can request list of projects without members', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects?includeMembers=false')
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})

    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
    const projects = await client.projects.list({includeMembers: false})
    expect(projects.length, 'should have two projects').toBe(2)
    expect(projects[0].id, 'should have project id').toBe('foo')
    expect(projects[0]).not.toHaveProperty('members')

    // @ts-expect-error - `members` should not be part of type when using `includeMembers: false`
    expect(projects[0].members, 'should not have "members" prop').toBeUndefined()
  })

  test('can request list of projects for an organization', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects?organizationId=org_123')
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})

    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
    const projects = await client.projects.list({organizationId: 'org_123'})
    expect(projects.length, 'should have two projects').toBe(2)
    expect(projects[0].id, 'should have project id').toBe('foo')
  })

  test('can request list of projects with only explicit membership', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects?onlyExplicitMembership=true')
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})

    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
    const projects = await client.projects.list({onlyExplicitMembership: true})
    expect(projects.length, 'should have two projects').toBe(2)
    expect(projects[0].id, 'should have project id').toBe('foo')
  })

  test('does not include onlyExplicitMembership param when false', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects')
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})

    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
    const projects = await client.projects.list({onlyExplicitMembership: false})
    expect(projects.length, 'should have two projects').toBe(2)
    expect(projects[0].id, 'should have project id').toBe('foo')
  })

  test('can combine onlyExplicitMembership with other options', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects?organizationId=org_123&onlyExplicitMembership=true')
      .respond({status: 200, body: [{id: 'foo'}]})

    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
    const projects = await client.projects.list({
      organizationId: 'org_123',
      onlyExplicitMembership: true,
    })
    expect(projects.length, 'should have one project').toBe(1)
    expect(projects[0].id, 'should have project id').toBe('foo')
  })

  test('can request list of projects, ignoring non-false `includeMembers` option', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects')
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})

    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})

    // @ts-expect-error - `includeMembers` should be a boolean if specified
    const projects = await client.projects.list({includeMembers: 'nope'})

    expect(projects.length, 'should have two projects').toBe(2)
    expect(projects[0].id, 'should have project id').toBe('foo')
  })

  test('can request list of projects (custom api version)', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v2019-01-29/projects')
      .respond({status: 200, body: [{id: 'foo'}, {id: 'bar'}]})

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

    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects/n1f7y')
      .respond({status: 200, body: doc})

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
    // Chained responses are consumed in order: one failure, then success.
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects/n1f7y')
      .respond({status: code, body: {}})
      .respond({status: 200, body: doc})
    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})
    const project = await client.projects.getById('n1f7y')
    expect(project).toEqual(doc)
  })

  test('throws when trying to create dataset with resource configured client', () => {
    expect(() =>
      getClient({'~experimental_resource': {type: 'dataset', id: 'p.d'}}).datasets.create('*foo*'),
    ).toThrow(/`dataset` does not support resource-based operations/i)
  })

  test('throws when trying to create dataset with resource configured client', () => {
    expect(() =>
      getClient({'~experimental_resource': {type: 'dataset', id: 'p.d'}}).datasets.delete('*foo*'),
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
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects/n1f7y')
      .respond({status: code, body: {}})
    const client = createClient({
      useProjectHostname: false,
      apiHost: `https://${apiHost}`,
      maxRetries: 0,
    })

    await expect(client.projects.getById('n1f7y')).rejects.toBeDefined()
  })

  test('a per-request maxRetries of 0 disables retries', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects/n1f7y')
      .respondPersist({status: 503, body: {}})
    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})

    await expect(client.request({url: '/projects/n1f7y', maxRetries: 0})).rejects.toBeDefined()
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/projects/n1f7y', 1)
  })

  test('a per-request maxRetries caps retries below the client maximum', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects/n1f7y')
      .respondPersist({status: 503, body: {}})
    const client = createClient({useProjectHostname: false, apiHost: `https://${apiHost}`})

    await expect(client.request({url: '/projects/n1f7y', maxRetries: 2})).rejects.toBeDefined()
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/projects/n1f7y', 3)
  })

  test('the raw requester export honors a per-request maxRetries', async () => {
    // The named `requester` never sees client config, so the per-request
    // option is its only retry opt-out (it accepted this on get-it v8 too).
    // Same for the transport: with no config to resolve a fetch from, the
    // mock is injected as a per-request `fetch`.
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects/n1f7y')
      .respondPersist({status: 503, body: {}})

    await expect(
      firstValueFrom(
        requester({
          url: `https://${apiHost}/v1/projects/n1f7y`,
          maxRetries: 0,
          fetch: getActiveFetch(),
        }),
      ),
    ).rejects.toBeDefined()
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/projects/n1f7y', 1)
  })

  test('the raw requester export requires a `url` (the v8 `uri` alias is gone)', async () => {
    const error: unknown = await firstValueFrom(
      requester({uri: `https://${apiHost}/v1/projects/n1f7y`, fetch: getActiveFetch()}),
    ).then(
      () => undefined,
      (err) => err,
    )
    expect(error).toBeInstanceOf(TypeError)
    expect(error).toMatchObject({message: 'Request options must include a `url`'})
  })

  test.runIf(isNode)(
    'the raw requester export leaves no listeners on a reused caller signal',
    async () => {
      getActiveMock()
        .scope(`https://${apiHost}`)
        .on('GET', '/v1/ping')
        .respondPersist({status: 200, body: {pong: true}})

      const controller = new AbortController()
      for (let i = 0; i < 3; i++) {
        await firstValueFrom(
          requester({
            url: `https://${apiHost}/v1/ping`,
            signal: controller.signal,
            fetch: getActiveFetch(),
          }),
        )
      }

      const {default: nodeEvents} = await import('node:events')
      expect(nodeEvents.getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    },
  )

  test('the raw requester export is lazy and cold', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {pong: true}})
      .respond({status: 200, body: {pong: true}})

    const req = requester({url: `https://${apiHost}/v1/ping`, fetch: getActiveFetch()})
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/ping', 0)

    await firstValueFrom(req)
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/ping', 1)

    await firstValueFrom(req)
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/ping', 2)
  })

  test('the raw requester export aborts the request on unsubscribe', async () => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {pong: true}, delay: 100})

    const signals: AbortSignal[] = []
    const fetchWithSpy: FetchFunction = (url, init) => {
      if (init?.signal) signals.push(init.signal)
      return getActiveFetch()(url, init)
    }

    const subscription = requester({
      url: `https://${apiHost}/v1/ping`,
      fetch: fetchWithSpy,
    }).subscribe()
    await new Promise((resolve) => setTimeout(resolve, 10))
    subscription.unsubscribe()

    expect(signals).toHaveLength(1)
    await vi.waitFor(() => expect(signals[0].aborted).toBe(true))
  })

  test.each([429, 502, 503])('eventually gives up on retrying %d', async (code) => {
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v1/projects/n1f7y')
      .respondPersist({status: code, body: {}})

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

    // Chained responses are consumed in order: four failures, then success.
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', '/v2023-03-25/users/me')
      .respond({status: code, body: {}})
      .respond({status: code, body: {}})
      .respond({status: code, body: {}})
      .respond({status: code, body: {}})
      .respond({status: 200, body: userObj})

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
