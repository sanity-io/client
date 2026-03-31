import {createClient, type RequestHandler, type RequestOptions} from '@sanity/client'
import {firstValueFrom, map, of as observableOf} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

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

describe('requestHandler', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  let nock: typeof import('nock') = (() => {
    throw new Error('Not supported in EdgeRuntime')
  }) as any
  if (!isEdge) {
    const _nock = await import('nock')
    nock = _nock.default
  }

  test.skipIf(isEdge)('can add a custom header to every request', async () => {
    let receivedHeaders: Record<string, string> = {}

    nock(projectHost())
      .get('/v1/ping')
      .reply(function () {
        receivedHeaders = this.req.headers as any
        return [200, {pong: true}]
      })

    const handler: RequestHandler = (request, defaultRequester) => {
      return defaultRequester({
        ...request,
        headers: {...request.headers, 'x-custom-header': 'custom-value'},
      })
    }

    const client = createClient({...clientConfig, requestHandler: handler})
    const result = await client.request({uri: '/ping'})

    expect(result).toMatchObject({pong: true})
    expect(receivedHeaders['x-custom-header']).toBe('custom-value')
  })

  test.skipIf(isEdge)('can pass through as a no-op wrapper', async () => {
    nock(projectHost()).get('/v1/ping').reply(200, {pong: true})

    const onRequest = vi.fn()
    const handler: RequestHandler = (request, defaultRequester) => {
      onRequest(request)
      return defaultRequester(request)
    }

    const client = createClient({...clientConfig, requestHandler: handler})
    const result = await client.request({uri: '/ping'})

    expect(result).toMatchObject({pong: true})
    expect(onRequest).toHaveBeenCalledTimes(1)
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/v1/ping'),
      }),
    )
  })

  test.skipIf(isEdge)('can transform the response', async () => {
    nock(projectHost()).get('/v1/ping').reply(200, {value: 42})

    const handler: RequestHandler = (request, defaultRequester) => {
      return defaultRequester(request).pipe(
        map((event) => {
          if (event.type === 'response') {
            return {...event, body: {...(event.body as any), injected: true}}
          }
          return event
        }),
      )
    }

    const client = createClient({...clientConfig, requestHandler: handler})
    const result = await client.request({uri: '/ping'})

    expect(result).toMatchObject({value: 42, injected: true})
  })

  test.skipIf(isEdge)('can short-circuit and skip defaultRequester', async () => {
    // No nock setup — the default requester should never be called
    const handler: RequestHandler = () => {
      return observableOf({
        type: 'response' as const,
        body: {custom: true},
        url: 'https://example.com',
        method: 'GET',
        statusCode: 200,
        statusMessage: 'OK',
        headers: {},
      })
    }

    const client = createClient({...clientConfig, requestHandler: handler})
    const result = await client.request({uri: '/ping'})

    expect(result).toMatchObject({custom: true})
  })

  test.skipIf(isEdge)('withConfig() preserves the handler from the original client', async () => {
    let handlerCalled = false

    nock(projectHost()).get('/v1/ping').reply(200, {pong: true})

    const handler: RequestHandler = (request, defaultRequester) => {
      handlerCalled = true
      return defaultRequester(request)
    }

    const client = createClient({...clientConfig, requestHandler: handler})
    const newClient = client.withConfig({dataset: 'bar'})

    // The handler should still be called even though we used withConfig
    const result = await newClient.request({uri: '/ping'})

    expect(result).toMatchObject({pong: true})
    expect(handlerCalled).toBe(true)
  })

  test.skipIf(isEdge)('handler receives resolved request options with url', async () => {
    nock(projectHost()).get('/v1/ping').reply(200, {pong: true})

    let receivedOptions: (RequestOptions & {url: string}) | undefined
    const handler: RequestHandler = (request, defaultRequester) => {
      receivedOptions = request
      return defaultRequester(request)
    }

    const client = createClient({
      ...clientConfig,
      requestHandler: handler,
    })
    await client.request({uri: '/ping'})

    expect(receivedOptions).toMatchObject({
      url: expect.stringContaining('/v1/ping'),
    })
  })

  test.skipIf(isEdge)('withConfig() can override the handler', async () => {
    nock(projectHost()).get('/v1/ping').reply(200, {pong: true})
    nock(projectHost()).get('/v1/ping').reply(200, {pong: true})

    const originalHandler = vi.fn<RequestHandler>((request, defaultRequester) =>
      defaultRequester(request),
    )
    const overrideHandler = vi.fn<RequestHandler>((request, defaultRequester) =>
      defaultRequester(request),
    )

    const client = createClient({...clientConfig, requestHandler: originalHandler})
    await client.request({uri: '/ping'})
    expect(originalHandler).toHaveBeenCalledTimes(1)
    expect(overrideHandler).toHaveBeenCalledTimes(0)

    const newClient = client.withConfig({requestHandler: overrideHandler})
    await newClient.request({uri: '/ping'})
    expect(originalHandler).toHaveBeenCalledTimes(1) // not called again
    expect(overrideHandler).toHaveBeenCalledTimes(1)
  })

  test.skipIf(isEdge)('withConfig() can remove the handler', async () => {
    nock(projectHost()).get('/v1/ping').reply(200, {pong: true})

    const handler = vi.fn<RequestHandler>((request, defaultRequester) => defaultRequester(request))

    const client = createClient({...clientConfig, requestHandler: handler})
    const newClient = client.withConfig({requestHandler: undefined})
    await newClient.request({uri: '/ping'})

    expect(handler).not.toHaveBeenCalled()
  })

  test.skipIf(isEdge)('handler works with observable API', async () => {
    nock(projectHost()).get('/v1/ping').reply(200, {pong: true})

    const onRequest = vi.fn()
    const handler: RequestHandler = (request, defaultRequester) => {
      return defaultRequester(request)
    }

    const client = createClient({...clientConfig, requestHandler: handler})

    const result = await firstValueFrom(client.observable.request({uri: '/ping'}))

    expect(result).toMatchObject({pong: true})
    expect(onRequest).toHaveBeenCalledTimes(1)
  })
})
