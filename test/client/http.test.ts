import {ClientError, type RequestHandler, ServerError} from '@sanity/client'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock} from '../helpers/mockFetch'
import {createClient, getClient, projectHost} from './helpers'

describe('USERS', () => {
  test('can retrieve user by id', async () => {
    const response = {
      role: null,
      id: 'Z29vZA2MTc2MDY5MDI1MDA3MzA5MTAwOjozMjM',
      name: 'Mannen i Gata',
      email: 'some@email.com',
    }

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/users/me')
      .respond({status: 200, body: response})

    const body = await getClient().users.getById('me')
    expect(body).toEqual(response)
  })
})
describe('CDN API USAGE', () => {
  test('will use CDN API by default', async () => {
    const client = createClient({projectId: 'abc123', dataset: 'foo'})

    const response = {result: []}
    getActiveMock()
      .scope('https://abc123.apicdn.sanity.io')
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
      .respond({status: 200, body: response})

    const docs = await client.fetch('*')
    expect(docs.length).toEqual(0)
  })

  test('will use live API if told to', async () => {
    const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: false})

    const response = {result: []}
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
      .respond({status: 200, body: response})

    const docs = await client.fetch('*')
    expect(docs.length).toEqual(0)
  })

  test('will use live API for mutations', async () => {
    const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync')
      .respond({status: 200, body: {}})

    await expect(client.create({_type: 'foo', title: 'yep'})).resolves.not.toThrow()
  })

  test('will use cdn for queries even when with token specified', async () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      useCdn: true,
      token: 'foo',
    })

    getActiveMock()
      .scope('https://abc123.apicdn.sanity.io')
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false', {
        headers: {Authorization: 'Bearer foo'},
      })
      .respond({status: 200, body: {result: []}})

    await expect(client.fetch('*')).resolves.not.toThrow()
  })

  test('allows overriding headers', async () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      token: 'foo',
      useCdn: false,
    })

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false', {
        headers: {foo: 'bar'},
      })
      .respond({status: 200, body: {result: []}})

    await expect(client.fetch('*', {}, {headers: {foo: 'bar'}})).resolves.not.toThrow()
  })

  test('will use live API if withCredentials is set to true', async () => {
    const client = createClient({
      withCredentials: true,
      projectId: 'abc123',
      dataset: 'foo',
      useCdn: true,
    })

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
      .respond({status: 200, body: {result: []}})

    await expect(client.fetch('*')).resolves.not.toThrow()
  })
})
describe('http requests', () => {
  test('allows a request handler to inspect client errors and retry the request', async () => {
    const path = '/v1/users/me'
    getActiveMock()
      .scope(projectHost())
      .on('GET', path)
      .respond({status: 503, body: {error: {description: 'Temporarily unavailable'}}})
      .respond({status: 200, body: {id: 'me'}})

    const errors: Error[] = []
    const requestHandler: RequestHandler = async (request, next) => {
      try {
        return await next(request)
      } catch (error) {
        if (!(error instanceof ServerError)) throw error
        errors.push(error)
        return next(request)
      }
    }

    const user = await getClient({maxRetries: 0, requestHandler}).users.getById('me')

    expect(user).toEqual({id: 'me'})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toHaveProperty('statusCode', 503)
  })

  test('allows a request handler to return a synthetic body to promise and observable clients', async () => {
    const requests: string[] = []
    const requestHandler: RequestHandler = async (request) => {
      requests.push(request.url)
      return {id: 'synthetic'}
    }

    const client = getClient({requestHandler})
    const user = await client.users.getById('me')
    const observableUser = await firstValueFrom(client.observable.users.getById('me'))

    expect(user).toEqual({id: 'synthetic'})
    expect(observableUser).toEqual({id: 'synthetic'})
    expect(requests).toEqual([`${projectHost()}/v1/users/me`, `${projectHost()}/v1/users/me`])
    expect(getActiveMock().getRequests()).toHaveLength(0)
  })

  test('reads the request handler from derived client config', async () => {
    const order: string[] = []
    const parentHandler: RequestHandler = async (request) => {
      order.push('parent')
      return {id: request.url}
    }
    const parent = getClient({requestHandler: parentHandler})
    const currentHandler = parent.config().requestHandler
    if (!currentHandler) throw new Error('Expected the parent request handler')

    const childHandler: RequestHandler = async (request, next) => {
      order.push('child')
      return currentHandler(request, next)
    }
    const user = await parent.withConfig({requestHandler: childHandler}).users.getById('me')

    expect(user).toEqual({id: `${projectHost()}/v1/users/me`})
    expect(order).toEqual(['child', 'parent'])
  })

  test('includes token if set', async () => {
    const qs = '?query=foo.bar&returnQuery=false'
    const token = 'abcdefghijklmnopqrstuvwxyz'
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo${qs}`, {
        headers: {Authorization: `Bearer ${token}`},
      })
      .respond({status: 200, body: {result: []}})

    const docs = await getClient({token}).fetch('foo.bar')
    expect(docs.length).toEqual(0)
  })

  test('allows overriding token', async () => {
    const qs = '?query=foo.bar&returnQuery=false'
    const token = 'abcdefghijklmnopqrstuvwxyz'
    const override = '123456789'
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo${qs}`, {
        headers: {Authorization: `Bearer ${override}`},
      })
      .respond({status: 200, body: {result: []}})

    const docs = await getClient({token}).fetch('foo.bar', {}, {token: override})
    expect(docs.length).toEqual(0)
  })

  test('allows overriding timeout', async () => {
    const qs = `?query=${encodeURIComponent('*[][0]')}&returnQuery=false`
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo${qs}`)
      .respond({status: 200, body: {result: []}})

    const docs = await getClient().fetch('*[][0]', {}, {timeout: 60 * 1000})
    expect(docs.length).toEqual(0)
  })

  test('forwards Next.js `cache` and `next` options to the fetch init', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
      .respond({status: 200, body: {result: []}})

    // `cache`/`next` are consumed by framework-patched fetch implementations
    // (Next.js App Router), so they must survive all the way to the actual
    // fetch call - asserted via the raw init the mock records verbatim.
    const client = getClient()

    // `cache`/`next` only type-check with Next.js' `RequestInit`
    // augmentation (see test/next/); runtime support must work regardless.
    // @ts-expect-error -- see above
    await client.fetch('*', {}, {cache: 'no-store', next: {revalidate: 60, tags: ['sanity']}})

    const requests = getActiveMock().getRequests()
    expect(requests).toHaveLength(1)
    expect(requests[0].init).toMatchObject({
      cache: 'no-store',
      next: {revalidate: 60, tags: ['sanity']},
    })
  })

  test('forwards fetch init from the deprecated `fetch` client config', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
      .respond({status: 200, body: {result: []}})

    const client = getClient({
      // @ts-expect-error -- `cache`/`next` only type-check with Next.js'
      // `RequestInit` augmentation (see test/next/); runtime support must
      // work regardless.
      fetch: {cache: 'no-store', next: {revalidate: 60}},
    })
    await client.fetch('*')

    const requests = getActiveMock().getRequests()
    expect(requests).toHaveLength(1)
    expect(requests[0].init).toMatchObject({cache: 'no-store', next: {revalidate: 60}})
  })

  test('attaches no abort signal to query fetches without a caller signal', async () => {
    // Next.js' patched fetch opts a request out of React Request
    // Memoization whenever `init.signal` is present, and get-it v9
    // attaches an `AbortSignal.timeout()` signal by default. Queries made
    // without a caller-provided signal must reach fetch signal-free.
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
      .respond({status: 200, body: {result: []}})
      .respond({status: 200, body: {result: []}})

    await getClient().fetch('*')
    // A caller-provided signal is the documented opt-out: it must still
    // reach the fetch init untouched.
    await getClient().fetch('*', {}, {signal: new AbortController().signal})

    const requests = getActiveMock().getRequests()
    expect(requests).toHaveLength(2)
    expect(requests[0].init?.signal, 'no signal without caller signal').toBeUndefined()
    expect(requests[1].init?.signal, 'caller signal must be forwarded').toBeInstanceOf(AbortSignal)
  })

  test('signal-less queries still honor the timeout via soft rejection', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
      .respond({status: 200, body: {result: []}, delay: 250})

    const request = getClient().fetch('*', {}, {timeout: 25})
    const error = await request.then(
      () => null,
      (err) => err,
    )
    // get-it's rejection-only timeout mode ({signal: false}) rejects with
    // the same TimeoutError DOMException as its signal-attached timeouts.
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TimeoutError')
  })

  test('handles HTTP errors gracefully', async () => {
    expect.assertions(2)

    const doc = {_id: 'barfoo', _type: 'document', visits: 5}
    const expectedBody = {mutations: [{create: doc}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respondWithError(new Error('Something went wrong'))

    try {
      await getClient().create(doc)
    } catch (err: any) {
      expect(err, 'should error').toBeInstanceOf(Error)
      expect(err.message, 'has message').toEqual('Something went wrong')
    }
  })

  // `.stack` is non-standard and its format is engine-defined: V8 (Node,
  // Chromium) prepends `${name}: ${message}` before the frames, so the
  // message incidentally shows up there too, but SpiderMonkey (Firefox) and
  // JavaScriptCore (WebKit) don't include it. `.message` is the portable,
  // spec-guaranteed place to assert this.
  test('ClientError includes description in message', () => {
    const body = {error: {description: 'Invalid query'}}
    const error = new ClientError({statusCode: 400, headers: {}, body})
    expect(error.message.includes(body.error.description)).toBeTruthy()
  })

  test('ServerError includes error and message in message', () => {
    const body = {
      error: 'Gateway Time-Out',
      message: 'The upstream service did not respond in time',
    }
    const error = new ServerError({statusCode: 504, headers: {}, body})
    expect(error.message.includes(body.error)).toBeTruthy()
    expect(error.message.includes(body.message)).toBeTruthy()
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
    const {requester: exportedRequester} = await import('../../src')
    expect(typeof exportedRequester).toEqual('function')
  })
})
