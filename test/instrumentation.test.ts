import {
  ClientError,
  createClient as createCoreClient,
  type RequestInstrumentation,
} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {filter, firstValueFrom} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

import {
  getActiveMock,
  streamBody,
  streamError,
  streamStall,
  testResolveFetch,
} from './helpers/mockFetch'

const createClient: typeof createCoreClient = (config) =>
  createCoreClient({
    resolveFetch: testResolveFetch,
    projectId: 'abc123',
    dataset: 'prod',
    apiVersion: '2025-02-19',
    useCdn: false,
    ...config,
  })

const api = () => getActiveMock().scope('https://abc123.api.sanity.io')

type LogEntry =
  | {event: 'request'; method: string; url: string}
  | {event: 'headers'; status: number; traceparent: string | null}
  | {event: 'end'; error?: unknown}

/** An instrumentation that logs every callback, in the order the client makes them. */
function recordInstrumentation(log: LogEntry[] = []) {
  const instrumentation: RequestInstrumentation = {
    onRequest: ({method, url}) => {
      log.push({event: 'request', method, url})
      return {
        onHeaders: ({status, headers}) => {
          log.push({event: 'headers', status, traceparent: headers.get('traceparent')})
        },
        onEnd: (result) => {
          log.push('error' in result ? {event: 'end', error: result.error} : {event: 'end'})
        },
      }
    },
  }
  return {log, instrumentation}
}

const traceparents = (log: LogEntry[]) =>
  log.flatMap((entry) => (entry.event === 'headers' ? [entry.traceparent] : []))

describe('instrumentation', () => {
  test('follows a request from start to the end of its body', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: []}, headers: {traceparent: 'trace-a'}})

    const {log, instrumentation} = recordInstrumentation()
    const result = await createClient({instrumentation}).fetch('*')

    expect(result).toEqual([])
    expect(log).toEqual([
      {
        event: 'request',
        method: 'GET',
        url: expect.stringContaining('https://abc123.api.sanity.io/v2025-02-19/data/query/prod'),
      },
      {event: 'headers', status: 200, traceparent: 'trace-a'},
      {event: 'end'},
    ])
  })

  test('follows commits from actions and mutations', async () => {
    api()
      .on('POST', '/v2025-02-19/data/actions/prod')
      .respond({status: 200, body: {transactionId: 'tx1'}, headers: {traceparent: 'trace-actions'}})
    api()
      .on('POST', '/v2025-02-19/data/mutate/prod')
      .respond({
        status: 200,
        body: {transactionId: 'tx2', results: []},
        headers: {traceparent: 'trace-mutate'},
      })

    const {log, instrumentation} = recordInstrumentation()
    const client = createClient({instrumentation})
    await client.action({
      actionType: 'sanity.action.document.edit',
      draftId: 'drafts.foo',
      publishedId: 'foo',
      patch: {set: {title: 'Foo'}},
    })
    await client.mutate([{createOrReplace: {_id: 'foo', _type: 'bar'}}])

    expect(log.map((entry) => entry.event)).toEqual([
      'request',
      'headers',
      'end',
      'request',
      'headers',
      'end',
    ])
    expect(traceparents(log)).toEqual(['trace-actions', 'trace-mutate'])
  })

  test('follows a listen() connection until it closes', async () => {
    api()
      .on('GET', '/v2025-02-19/data/listen/prod')
      .respond({
        status: 200,
        body: streamBody(encode({event: 'welcome', data: '{}'}), streamStall()),
        headers: {'Content-Type': 'text/event-stream', traceparent: 'trace-listen'},
      })

    const {log, instrumentation} = recordInstrumentation()
    const listener = createClient({instrumentation}).listen('*', {}, {events: ['welcome']})
    await firstValueFrom(listener)

    expect(log.slice(0, 2)).toEqual([
      {
        event: 'request',
        method: 'GET',
        url: expect.stringContaining('https://abc123.api.sanity.io/v2025-02-19/data/listen/prod'),
      },
      {event: 'headers', status: 200, traceparent: 'trace-listen'},
    ])
    // `firstValueFrom` unsubscribes after the first event, which closes the
    // connection while its stream is still open: the attempt ends as aborted.
    await vi.waitFor(() => expect(log).toHaveLength(3))
    expect(log[2]).toEqual({event: 'end', error: expect.anything()})
  })

  test('a timeout while the body is read ends the attempt with the timeout error', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({
        status: 200,
        body: streamBody('{"res', streamStall()),
        headers: {traceparent: 'trace-a'},
      })

    const {log, instrumentation} = recordInstrumentation()
    // Without a `signal`, a query times out without aborting the fetch, so
    // only the transport knows the attempt is over.
    const client = createClient({instrumentation, timeout: 20, maxRetries: 0})

    const error = await client.fetch('1').catch((err: unknown) => err)

    expect(error).toMatchObject({name: 'TimeoutError'})
    expect(log).toEqual([
      expect.objectContaining({event: 'request'}),
      {event: 'headers', status: 200, traceparent: 'trace-a'},
      {event: 'end', error},
    ])
  })

  test('with a signal, a timeout while the body is read ends the attempt with the timeout error', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: streamBody('{"res', streamStall())})

    const {log, instrumentation} = recordInstrumentation()
    // With a `signal`, get-it aborts the fetch itself when the timeout fires.
    const client = createClient({instrumentation, timeout: 20, maxRetries: 0})

    const error = await client
      .fetch('1', {}, {signal: new AbortController().signal})
      .catch((err: unknown) => err)

    expect(error).toMatchObject({name: 'TimeoutError'})
    expect(log.map((entry) => entry.event)).toEqual(['request', 'headers', 'end'])
    expect(log[2]).toEqual({event: 'end', error})
  })

  test('a timeout before the headers arrive ends the attempt without headers', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: 1}, delay: 200})

    const {log, instrumentation} = recordInstrumentation()
    const client = createClient({instrumentation, timeout: 20, maxRetries: 0})

    const error = await client.fetch('1').catch((err: unknown) => err)

    expect(error).toMatchObject({name: 'TimeoutError'})
    expect(log).toEqual([expect.objectContaining({event: 'request'}), {event: 'end', error}])
  })

  test('a stream that errors partway through the body ends the attempt with the error', async () => {
    const failure = new Error('connection reset')
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: streamBody('{"res', streamError(failure))})

    const {log, instrumentation} = recordInstrumentation()
    const client = createClient({instrumentation, maxRetries: 0})

    await expect(client.fetch('1')).rejects.toThrow()
    expect(log.map((entry) => entry.event)).toEqual(['request', 'headers', 'end'])
    expect(log[2]).toEqual({event: 'end', error: expect.anything()})
  })

  test('aborting while the body is read ends the attempt with the abort error', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: streamBody('{"res', streamStall())})

    const controller = new AbortController()
    const {log} = recordInstrumentation()
    const instrumentation: RequestInstrumentation = {
      onRequest: (request) => {
        const observer = recordInstrumentation(log).instrumentation.onRequest?.(request)
        return {
          ...observer,
          onHeaders: (response) => {
            observer?.onHeaders?.(response)
            controller.abort()
          },
        }
      },
    }
    const client = createClient({instrumentation, maxRetries: 0})

    const error = await client.fetch('1', {}, {signal: controller.signal}).catch((err) => err)

    expect(error).toMatchObject({name: 'AbortError'})
    expect(log.map((entry) => entry.event)).toEqual(['request', 'headers', 'end'])
    expect(log[2]).toEqual({event: 'end', error: expect.anything()})
  })

  test('a listen() stream the server closes ends the attempt without an error', async () => {
    api()
      .on('GET', '/v2025-02-19/data/listen/prod')
      .respond({
        status: 200,
        body: encode({event: 'welcome', data: '{}'}),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const {log, instrumentation} = recordInstrumentation()
    const subscription = createClient({instrumentation})
      .listen('*', {}, {events: ['welcome']})
      .subscribe({error: () => {}})

    try {
      await vi.waitFor(() => expect(log.map((entry) => entry.event)).toContain('end'))
      expect(log.slice(1)).toEqual([
        {event: 'headers', status: 200, traceparent: null},
        {event: 'end'},
      ])
    } finally {
      // Stop the EventSource before it reconnects.
      subscription.unsubscribe()
    }
  })

  test('a listen() stream that errors partway ends the attempt with the error', async () => {
    const failure = new Error('connection reset')
    api()
      .on('GET', '/v2025-02-19/data/listen/prod')
      .respond({
        status: 200,
        body: streamBody(encode({event: 'welcome', data: '{}'}), streamError(failure)),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const {log, instrumentation} = recordInstrumentation()
    const subscription = createClient({instrumentation})
      .listen('*', {}, {events: ['welcome']})
      .subscribe({error: () => {}})

    try {
      await vi.waitFor(() => expect(log.map((entry) => entry.event)).toContain('end'))
      expect(log[2]).toEqual({event: 'end', error: failure})
    } finally {
      subscription.unsubscribe()
    }
  })

  test('a listen() connection that is not an event stream ends as a completed attempt', async () => {
    api()
      .on('GET', '/v2025-02-19/data/listen/prod')
      .respond({status: 200, body: '<html></html>', headers: {'Content-Type': 'text/html'}})

    const {log, instrumentation} = recordInstrumentation()
    // The client retries this failure, so stop listening once the first attempt has ended.
    const subscription = createClient({instrumentation})
      .listen('*', {}, {events: ['welcome']})
      .subscribe({error: () => {}})

    try {
      await vi.waitFor(() => expect(log.map((entry) => entry.event)).toContain('end'))
      expect(log.slice(1, 3)).toEqual([
        {event: 'headers', status: 200, traceparent: null},
        {event: 'end'},
      ])
    } finally {
      subscription.unsubscribe()
    }
  })

  test('each listen() reconnect is a new attempt', async () => {
    api()
      .on('GET', '/v2025-02-19/data/listen/prod')
      .respond({
        status: 200,
        // `retry` makes the EventSource reconnect quickly once the server closes the stream.
        body: encode({event: 'welcome', data: '{}', retry: 10}),
        headers: {'Content-Type': 'text/event-stream', traceparent: 'trace-1'},
      })
    api()
      .on('GET', '/v2025-02-19/data/listen/prod')
      .respond({
        status: 200,
        body: streamBody(encode({event: 'welcome', data: '{}'}), streamStall()),
        headers: {'Content-Type': 'text/event-stream', traceparent: 'trace-2'},
      })

    const {log, instrumentation} = recordInstrumentation()
    const subscription = createClient({instrumentation})
      .listen('*', {}, {events: ['welcome']})
      .subscribe({error: () => {}})

    try {
      await vi.waitFor(() => expect(traceparents(log)).toEqual(['trace-1', 'trace-2']))
      expect(log.map((entry) => entry.event)).toEqual([
        'request',
        'headers',
        'end',
        'request',
        'headers',
      ])
      expect(log[2]).toEqual({event: 'end'})
    } finally {
      subscription.unsubscribe()
    }
  })

  test('a listen() connection the server rejects ends as a completed attempt', async () => {
    api()
      .on('GET', '/v2025-02-19/data/listen/prod')
      .respond({status: 401, body: {error: 'Unauthorized'}, headers: {traceparent: 'trace-401'}})

    const {log, instrumentation} = recordInstrumentation()
    const listener = createClient({instrumentation}).listen('*', {}, {events: ['welcome']})

    await expect(firstValueFrom(listener)).rejects.toThrow()
    // Like any HTTP error status, a rejected connection is a completed
    // attempt, not an aborted one.
    expect(log.slice(1)).toEqual([
      {event: 'headers', status: 401, traceparent: 'trace-401'},
      {event: 'end'},
    ])
  })

  test('follows every attempt of a retried request', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 503, body: {}, headers: {traceparent: 'trace-down'}})
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: 1}, headers: {traceparent: 'trace-up'}})

    const {log, instrumentation} = recordInstrumentation()
    await createClient({instrumentation, retryDelay: () => 0}).fetch('1')

    expect(log.filter((entry) => entry.event !== 'request')).toEqual([
      {event: 'headers', status: 503, traceparent: 'trace-down'},
      {event: 'end'},
      {event: 'headers', status: 200, traceparent: 'trace-up'},
      {event: 'end'},
    ])
  })

  test('an HTTP error status ends the attempt without an error', async () => {
    api()
      .on('POST', '/v2025-02-19/data/mutate/prod')
      .respond({
        status: 409,
        body: {error: {description: 'Document already exists'}},
        headers: {traceparent: 'trace-a'},
      })

    const {log, instrumentation} = recordInstrumentation()
    const client = createClient({instrumentation})

    await expect(client.create({_id: 'foo', _type: 'bar'})).rejects.toBeInstanceOf(ClientError)
    expect(log.slice(1)).toEqual([
      {event: 'headers', status: 409, traceparent: 'trace-a'},
      {event: 'end'},
    ])
  })

  test('an attempt that fails before a response ends with the error, and no headers', async () => {
    const failure = new Error('Network error occurred')
    api().on('GET', '/v2025-02-19/data/query/prod').respondWithError(failure)

    const {log, instrumentation} = recordInstrumentation()
    const client = createClient({instrumentation, maxRetries: 0})

    await expect(client.fetch('1')).rejects.toThrow()
    expect(log.map((entry) => entry.event)).toEqual(['request', 'end'])
    expect(log[1]).toEqual({event: 'end', error: failure})
  })

  test('onRequest may return nothing', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: 'ok'}})

    const onRequest = vi.fn()
    await expect(createClient({instrumentation: {onRequest}}).fetch('"ok"')).resolves.toBe('ok')
    expect(onRequest).toHaveBeenCalledOnce()
  })

  test('is kept by clients derived with withConfig(), and replaced by a new instrumentation', async () => {
    for (const traceparent of ['trace-1', 'trace-2', 'trace-3']) {
      api()
        .on('GET', '/v2025-02-19/data/query/prod')
        .respond({status: 200, body: {result: 1}, headers: {traceparent}})
    }

    const base = recordInstrumentation()
    const replacement = recordInstrumentation()
    const client = createClient({instrumentation: base.instrumentation})

    // A derived client shares the base client's transport, so the
    // instrumentation must be read from the derived client's own config.
    await client.withConfig({perspective: 'raw'}).fetch('1')
    await client.withConfig({dataset: 'prod'}).withConfig({useCdn: false}).fetch('1')
    await client.withConfig({instrumentation: replacement.instrumentation}).fetch('1')

    expect(traceparents(base.log)).toEqual(['trace-1', 'trace-2'])
    expect(traceparents(replacement.log)).toEqual(['trace-3'])
  })

  test('follows a listen() connection on a withConfig() client', async () => {
    api()
      .on('GET', '/v2025-02-19/data/listen/prod')
      .respond({
        status: 200,
        body: streamBody(encode({event: 'welcome', data: '{}'}), streamStall()),
        headers: {'Content-Type': 'text/event-stream', traceparent: 'trace-listen'},
      })

    const {log, instrumentation} = recordInstrumentation()
    const client = createClient({instrumentation}).withConfig({perspective: 'raw'})
    await firstValueFrom(client.listen('*', {}, {events: ['welcome']}))

    expect(traceparents(log)).toEqual(['trace-listen'])
  })

  test('is not used for live.events() connections', async () => {
    api()
      .on('GET', '/vX/data/live/events/prod')
      .respond({
        status: 200,
        body: streamBody(encode({event: 'welcome', data: '{}'}), streamStall()),
        headers: {'Content-Type': 'text/event-stream', traceparent: 'trace-a'},
      })

    const onRequest = vi.fn()
    const events = createClient({apiVersion: 'X', instrumentation: {onRequest}}).live.events()
    await firstValueFrom(events.pipe(filter((event) => event.type === 'welcome')))

    expect(onRequest).not.toHaveBeenCalled()
  })

  test('a per-call instrumentation follows only that call', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: 1}, headers: {traceparent: 'trace-fetch'}})
    api()
      .on('POST', '/v2025-02-19/data/mutate/prod')
      .respond({status: 200, body: {results: []}, headers: {traceparent: 'trace-mutate'}})
    api()
      .on('POST', '/v2025-02-19/data/actions/prod')
      .respond({status: 200, body: {transactionId: 'tx'}, headers: {traceparent: 'trace-action'}})
    api()
      .on('GET', '/v2025-02-19/users/me')
      .respond({status: 200, body: {}, headers: {traceparent: 'trace-request'}})
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: 2}, headers: {traceparent: 'trace-unobserved'}})

    const client = createClient({})
    const fetchCall = recordInstrumentation()
    const mutateCall = recordInstrumentation()
    const actionCall = recordInstrumentation()
    const requestCall = recordInstrumentation()

    await client.fetch('1', {}, {instrumentation: fetchCall.instrumentation})
    await client.mutate([{createOrReplace: {_id: 'foo', _type: 'bar'}}], {
      instrumentation: mutateCall.instrumentation,
    })
    await client.action(
      {
        actionType: 'sanity.action.document.edit',
        draftId: 'drafts.foo',
        publishedId: 'foo',
        patch: {set: {title: 'Foo'}},
      },
      {instrumentation: actionCall.instrumentation},
    )
    await client.request({url: '/users/me', instrumentation: requestCall.instrumentation})
    await client.fetch('2')

    expect(traceparents(fetchCall.log)).toEqual(['trace-fetch'])
    expect(traceparents(mutateCall.log)).toEqual(['trace-mutate'])
    expect(traceparents(actionCall.log)).toEqual(['trace-action'])
    expect(traceparents(requestCall.log)).toEqual(['trace-request'])
  })

  test('the client instrumentation runs before the per-call one, for every handler', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: 1}})

    const order: string[] = []
    const tracing = (name: string): RequestInstrumentation => ({
      onRequest: () => {
        order.push(`${name}:request`)
        return {
          onHeaders: () => order.push(`${name}:headers`),
          onEnd: () => order.push(`${name}:end`),
        }
      },
    })
    const client = createClient({instrumentation: tracing('client')})
    await client.fetch('1', {}, {instrumentation: tracing('call')})

    expect(order).toEqual([
      'client:request',
      'call:request',
      'client:headers',
      'call:headers',
      'client:end',
      'call:end',
    ])
  })

  test('a throwing instrumentation does not stop the other one', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: 1}})

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const order: string[] = []
    const client = createClient({
      instrumentation: {
        onRequest: () => {
          order.push('client')
          throw new Error('client instrumentation failed')
        },
      },
    })

    try {
      await client.fetch(
        '1',
        {},
        {
          instrumentation: {
            onRequest: () => {
              order.push('call')
              throw new Error('call instrumentation failed')
            },
          },
        },
      )
      expect(order).toEqual(['client', 'call'])
      expect(consoleError).toHaveBeenCalledTimes(2)
    } finally {
      consoleError.mockRestore()
    }
  })

  test('a handler that throws is logged, and the request and later handlers carry on', async () => {
    api()
      .on('GET', '/v2025-02-19/data/query/prod')
      .respond({status: 200, body: {result: 'ok'}})

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = new Error('onHeaders failed')
    const onEnd = vi.fn()
    const client = createClient({
      instrumentation: {
        onRequest: () => ({
          onHeaders: () => {
            throw failure
          },
          onEnd,
        }),
      },
    })

    try {
      await expect(client.fetch('"ok"')).resolves.toBe('ok')
      expect(onEnd).toHaveBeenCalledWith({})
      expect(consoleError).toHaveBeenCalledOnce()
      expect(consoleError.mock.calls[0][0]).toMatchObject({cause: failure})
    } finally {
      consoleError.mockRestore()
    }
  })

  test('is not called for a body a requestHandler returns without calling next', async () => {
    const onRequest = vi.fn()
    const client = createClient({
      instrumentation: {onRequest},
      requestHandler: async () => ({result: 'synthetic'}),
    })

    await expect(client.fetch('*')).resolves.toBe('synthetic')
    expect(onRequest).not.toHaveBeenCalled()
  })
})
