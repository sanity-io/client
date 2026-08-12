import {encode} from 'eventsource-encoder'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

import {
  getActiveFetch,
  getActiveMock,
  streamBody,
  streamError,
  streamStall,
} from '../helpers/mockFetch'
import {getClient, isEdge, isNode, projectHost} from './helpers'

describe.skipIf(isEdge || !isNode)('LISTENERS', () => {
  test('listeners connect to listen endpoint, emits events', async () => {
    expect.assertions(1)

    const doc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}
    // `streamStall()` keeps the SSE body open like a real listener
    // connection - no need to end the stream with a synthetic `disconnect`
    // event to stop the EventSource from reconnecting into a spent mock.
    const response = streamBody(
      encode({event: 'welcome', data: JSON.stringify({listenerName: 'LGFXwOqrf1GHawAjZRnhd6'})}),
      encode({event: 'mutation', data: JSON.stringify({result: doc})}),
      streamStall(),
    )

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/listen/foo?query=foo.bar&includeResult=true')
      .respond({
        status: 200,
        body: response,
        headers: {
          'cache-control': 'no-cache',
          'content-type': 'text/event-stream; charset=utf-8',
          'transfer-encoding': 'chunked',
        },
      })

    const evt = await firstValueFrom(getClient().listen('foo.bar'))
    expect(evt.result).toEqual(doc)
  })

  test('listeners connect to listen endpoint with request tag, emits events', async () => {
    expect.assertions(1)

    const doc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}
    const response = streamBody(
      encode({event: 'welcome', data: JSON.stringify({listenerName: 'LGFXwOqrf1GHawAjZRnhd6'})}),
      encode({event: 'mutation', data: JSON.stringify({result: doc})}),
      streamStall(),
    )

    getActiveMock()
      .scope(projectHost())
      .on(
        'GET',
        '/v1/data/listen/foo?tag=sfcraft.checkins&query=*%5B_type%20%3D%3D%20%22checkin%22%5D&includeResult=true',
      )
      .respond({
        status: 200,
        body: response,
        headers: {
          'cache-control': 'no-cache',
          'content-type': 'text/event-stream; charset=utf-8',
          'transfer-encoding': 'chunked',
        },
      })

    const evt = await firstValueFrom(
      getClient().listen('*[_type == "checkin"]', {}, {tag: 'sfcraft.checkins'}),
    )
    expect(evt.type == 'mutation' && evt.result).toEqual(doc)
  })

  test('listeners connect to listen endpoint with prefixed request tag, emits events', async () => {
    expect.assertions(1)

    const doc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}
    const response = streamBody(
      encode({event: 'welcome', data: JSON.stringify({listenerName: 'LGFXwOqrf1GHawAjZRnhd6'})}),
      encode({event: 'mutation', data: JSON.stringify({result: doc})}),
      streamStall(),
    )

    getActiveMock()
      .scope(projectHost())
      .on(
        'GET',
        '/v1/data/listen/foo?tag=sf.craft.checkins&query=*%5B_type%20%3D%3D%20%22checkin%22%5D&includeResult=true',
      )
      .respond({
        status: 200,
        body: response,
        headers: {
          'cache-control': 'no-cache',
          'content-type': 'text/event-stream; charset=utf-8',
          'transfer-encoding': 'chunked',
        },
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

    const response =
      encode({event: 'welcome', data: JSON.stringify({listenerName: 'LGFXwOqrf1GHawAjZRnhd6'})}) +
      encode({event: 'mutation', data: '{}'})

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/listen/foo?query=foo.bar&includeResult=true')
      .respond({
        status: 200,
        body: response,
        headers: {'content-type': 'text/event-stream; charset=utf-8'},
      })
    const req = getClient().listen('foo.bar', {}, {events: ['welcome']})
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/data/listen/foo', 0)
    await firstValueFrom(req)
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/data/listen/foo', 1)
  })

  test('listener requests are cold', async () => {
    expect.assertions(3)

    const response = encode({
      event: 'welcome',
      data: JSON.stringify({listenerName: 'LGFXwOqrf1GHawAjZRnhd6'}),
    })

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/listen/foo?query=foo.bar&includeResult=true')
      .respond({
        status: 200,
        body: response,
        headers: {'content-type': 'text/event-stream; charset=utf-8'},
      })
      .respond({
        status: 200,
        body: response,
        headers: {'content-type': 'text/event-stream; charset=utf-8'},
      })

    const req = getClient().listen('foo.bar', {}, {events: ['welcome']})

    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/data/listen/foo', 0)
    await firstValueFrom(req)
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/data/listen/foo', 1)
    await firstValueFrom(req)
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/data/listen/foo', 2)
  })

  test('unsubscribing aborts the underlying SSE connection', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/listen/foo?query=foo.bar&includeResult=true')
      .respond({
        status: 200,
        // The body stalls open like a real listener connection; only an
        // abort from the client side can end it.
        body: streamBody(
          encode({
            event: 'welcome',
            data: JSON.stringify({listenerName: 'LGFXwOqrf1GHawAjZRnhd6'}),
          }),
          streamStall(),
        ),
        headers: {'content-type': 'text/event-stream; charset=utf-8'},
      })

    const signals: AbortSignal[] = []
    const client = getClient({
      resolveFetch: () => (url, init) => {
        if (init?.signal) signals.push(init.signal)
        return getActiveFetch()(url, init)
      },
    })

    await firstValueFrom(client.listen('foo.bar', {}, {events: ['welcome']}))

    // `firstValueFrom` unsubscribes after the first event; the EventSource
    // must be closed with it, aborting the still-stalled connection rather
    // than leaking it.
    expect(signals).toHaveLength(1)
    await vi.waitFor(() => expect(signals[0].aborted).toBe(true))
  })

  test('reconnects when the connection drops mid-stream', async () => {
    const doc = {_id: 'mooblah', _type: 'foo.bar', prop: 'value'}
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/listen/foo?query=foo.bar&includeResult=true')
      .respond({
        status: 200,
        // The `retry` field makes the EventSource attempt its reconnect
        // quickly; the stream then dies mid-connection - a scenario only
        // the real-SSE-server tests could model before `streamError()`.
        body: streamBody(
          encode({retry: 25}),
          encode({
            event: 'welcome',
            data: JSON.stringify({listenerName: 'LGFXwOqrf1GHawAjZRnhd6'}),
          }),
          streamError(new Error('connection reset')),
        ),
        headers: {'content-type': 'text/event-stream; charset=utf-8'},
      })
      .respond({
        status: 200,
        body: streamBody(
          encode({event: 'mutation', data: JSON.stringify({result: doc})}),
          streamStall(),
        ),
        headers: {'content-type': 'text/event-stream; charset=utf-8'},
      })

    const evt = await firstValueFrom(getClient().listen('foo.bar'))
    expect(evt.result).toEqual(doc)
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/v1/data/listen/foo', 2)
  })
})
