import {
  type Auth,
  type ClientConfig,
  ConnectionFailedError,
  CorsOriginError,
  createClient as createCoreClient,
} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {
  BehaviorSubject,
  catchError,
  EMPTY,
  firstValueFrom,
  lastValueFrom,
  Observable,
  of,
  ReplaySubject,
  Subject,
  take,
  tap,
  throwError,
  toArray,
} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock, streamBody, streamStall, testResolveFetch} from './helpers/mockFetch'

// Every client created in this suite talks to the per-test `get-it/mock`
// transport, injected through the public `resolveFetch` config option.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

const baseConfig = {
  projectId: 'abc123',
  dataset: 'prod',
  useCdn: false,
  apiVersion: '1',
} satisfies ClientConfig

const apiHost = 'https://abc123.api.sanity.io'
const queryPath = '/v1/data/query/prod?query=*&returnQuery=false'
const sseHeaders = {'Content-Type': 'text/event-stream'}

describe('auth: requests', () => {
  test('sends the token the source currently holds, and follows changes', async () => {
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'first'}))
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', queryPath, {headers: {Authorization: 'Bearer first'}})
      .respond({status: 200, body: {result: [1]}})
    scope
      .on('GET', queryPath, {headers: {Authorization: 'Bearer second'}})
      .respond({status: 200, body: {result: [2]}})

    const client = createClient({...baseConfig, auth})
    await expect(client.fetch('*')).resolves.toEqual([1])

    auth.next(Promise.resolve<Auth>({token: 'second'}))
    await expect(client.fetch('*')).resolves.toEqual([2])
  })

  test('cookie mode sends credentials instead of a token', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath)
      .respond({status: 200, body: {result: []}})

    const client = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({withCredentials: true})),
    })
    await client.fetch('*')

    const [request] = getActiveMock().getRequests()
    expect(request.init?.credentials).toBe('include')
    expect(request).not.toHaveHeader('authorization')
  })

  test('an anonymous emission sends neither', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath)
      .respond({status: 200, body: {result: []}})

    const client = createClient({...baseConfig, auth: of(Promise.resolve(undefined))})
    await client.fetch('*')

    const [request] = getActiveMock().getRequests()
    expect(request.init?.credentials).not.toBe('include')
    expect(request).not.toHaveHeader('authorization')
  })

  test('a request waits while the source withholds, and goes out with the value that arrives', async () => {
    const auth = new ReplaySubject<Promise<Auth>>(1)
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {headers: {Authorization: 'Bearer late'}})
      .respond({status: 200, body: {result: ['late']}})

    const client = createClient({...baseConfig, auth})
    const pending = client.fetch('*')
    // Nothing may reach the transport before the credential is known.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(getActiveMock().getRequests()).toHaveLength(0)

    auth.next(Promise.resolve<Auth>({token: 'late'}))
    await expect(pending).resolves.toEqual(['late'])
  })

  test('aborting a request that is waiting for the source rejects with AbortError', async () => {
    const auth = new Subject<Promise<Auth>>()
    const client = createClient({...baseConfig, auth})
    const controller = new AbortController()

    const pending = client.fetch('*', {}, {signal: controller.signal})
    controller.abort()

    await expect(pending).rejects.toMatchObject({name: 'AbortError'})
    expect(getActiveMock().getRequests()).toHaveLength(0)
  })

  test('a source that never emits fails with the request timeout, not a hang', async () => {
    const client = createClient({
      ...baseConfig,
      auth: new Subject<Promise<Auth>>(),
      timeout: 30,
    })
    await expect(client.fetch('*')).rejects.toMatchObject({
      name: 'TimeoutError',
      message: expect.stringMatching(
        /`auth` observable did not settle on a credential within 30ms/,
      ),
    })
    // A per-request timeout applies the same way.
    const slow = createClient({...baseConfig, auth: new Subject<Promise<Auth>>()})
    await expect(slow.fetch('*', {}, {timeout: 20})).rejects.toMatchObject({name: 'TimeoutError'})
    expect(getActiveMock().getRequests()).toHaveLength(0)
  })

  test('a pending renewal makes requests wait for it; a rejected one fails them with its error', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {headers: {Authorization: 'Bearer renewed'}})
      .respond({status: 200, body: {result: ['renewed']}})

    let renew: (state: Auth) => void = () => {}
    const auth = new BehaviorSubject<Promise<Auth>>(
      new Promise<Auth>((resolve) => {
        renew = resolve
      }),
    )
    const client = createClient({...baseConfig, auth})
    const pending = client.fetch('*')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(getActiveMock().getRequests(), 'nothing sent while renewing').toHaveLength(0)
    renew({token: 'renewed'})
    await expect(pending).resolves.toEqual(['renewed'])

    const refreshFailed = new Error('refresh failed')
    auth.next(Promise.reject(refreshFailed))
    await expect(client.fetch('*')).rejects.toBe(refreshFailed)
  })

  test('a source that completes without emitting is a clear configuration error', async () => {
    const client = createClient({...baseConfig, auth: EMPTY})
    await expect(client.fetch('*')).rejects.toThrow(
      /`auth` observable completed without emitting a credential/,
    )
  })

  test('an error from the source is the error the request rejects with', async () => {
    const sessionOver = new Error('session is over')
    const client = createClient({...baseConfig, auth: throwError(() => sessionOver)})
    await expect(client.fetch('*')).rejects.toBe(sessionOver)
  })

  test('a per-request token wins over the source', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {headers: {Authorization: 'Bearer override'}})
      .respond({status: 200, body: {result: []}})

    const client = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'from-source'})),
    })
    await client.fetch('*', {}, {token: 'override'})
  })

  test('a per-request withCredentials adds cookies alongside the token, or keeps them off', async () => {
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', queryPath, {headers: {Authorization: 'Bearer from-source'}})
      .respond({status: 200, body: {result: []}})
    scope.on('GET', queryPath).respond({status: 200, body: {result: []}})

    const query = {query: '*', returnQuery: 'false'}
    const tokenClient = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'from-source'})),
    })
    await tokenClient.request({url: '/data/query/prod', query, withCredentials: true})
    const cookieClient = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({withCredentials: true})),
    })
    await cookieClient.request({url: '/data/query/prod', query, withCredentials: false})

    const [withBoth, withNeither] = getActiveMock().getRequests()
    expect(withBoth.init?.credentials).toBe('include')
    expect(withNeither.init?.credentials).not.toBe('include')
    expect(withNeither).not.toHaveHeader('authorization')
  })

  test('a per-request Authorization header wins over the source', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {headers: {Authorization: 'Bearer explicit'}})
      .respond({status: 200, body: {result: []}})

    const client = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'from-source'})),
    })
    await client.request({
      url: '/data/query/prod',
      query: {query: '*', returnQuery: 'false'},
      headers: {Authorization: 'Bearer explicit'},
    })
  })

  test('a cookie-mode client keeps sending cookies alongside a request-level bearer', async () => {
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', queryPath, {headers: {Authorization: 'Bearer request'}})
      .respond({status: 200, body: {result: []}})
    scope
      .on('GET', queryPath, {headers: {Authorization: 'Bearer request'}})
      .respond({status: 200, body: {result: []}})

    const query = {query: '*', returnQuery: 'false'}
    const fixed = createClient({...baseConfig, withCredentials: true})
    await fixed.request({url: '/data/query/prod', query, token: 'request'})
    const reactive = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({withCredentials: true})),
    })
    await reactive.request({url: '/data/query/prod', query, token: 'request'})

    for (const request of getActiveMock().getRequests()) {
      expect(request.init?.credentials, 'cookies stay on').toBe('include')
    }
  })

  test('a requestHandler receives the authenticated request', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath)
      .respond({status: 200, body: {result: []}})
    let seenAuthorization: string | undefined

    const client = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'handled'})),
      requestHandler: (request, next) => {
        seenAuthorization = new Headers(request.headers).get('authorization') ?? undefined
        return next(request)
      },
    })
    await client.fetch('*')

    expect(seenAuthorization).toBe('Bearer handled')
  })

  test('a static credential reaches the transport synchronously; a reactive one waits', async () => {
    const scope = getActiveMock().scope(apiHost)
    scope.on('GET', queryPath).respond({status: 200, body: {result: []}})
    scope.on('GET', queryPath).respond({status: 200, body: {result: []}})
    let handled = 0
    const requestHandler: ClientConfig['requestHandler'] = (request, next) => {
      handled++
      return next(request)
    }

    const fixed = createClient({...baseConfig, token: 'static', requestHandler})
    const pendingStatic = fixed.fetch('*')
    expect(handled, 'static: handed to the pipeline before any await').toBe(1)
    await pendingStatic

    const reactive = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'reactive'})),
      requestHandler,
    })
    const pendingReactive = reactive.fetch('*')
    expect(handled, 'reactive: still waiting for the credential').toBe(1)
    await pendingReactive
    expect(handled).toBe(2)
  })

  test('a static token replaces an Authorization set through config headers, as before', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {headers: {Authorization: 'Bearer real'}})
      .respond({status: 200, body: {result: []}})

    const client = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'real'})),
      headers: {Authorization: 'Bearer from-headers'},
    })
    await client.fetch('*')
  })
})

describe('auth: getAuth()', () => {
  test('returns the static credential: token, cookie mode or anonymous', async () => {
    await expect(createClient({...baseConfig, token: 'static'}).getAuth()).resolves.toEqual({
      token: 'static',
    })
    await expect(createClient({...baseConfig, withCredentials: true}).getAuth()).resolves.toEqual({
      withCredentials: true,
    })
    await expect(createClient(baseConfig).getAuth()).resolves.toEqual({})
    // Always an object, so destructuring is safe for every state.
    const {token, withCredentials} = await createClient(baseConfig).getAuth()
    expect(token).toBeUndefined()
    expect(withCredentials).toBeUndefined()
  })

  test('follows a reactive source and waits while it withholds', async () => {
    const auth = new ReplaySubject<Promise<Auth>>(1)
    const client = createClient({...baseConfig, auth})

    const pending = client.getAuth()
    auth.next(Promise.resolve<Auth>({token: 'first'}))
    await expect(pending).resolves.toEqual({token: 'first'})

    auth.next(Promise.resolve<Auth>({token: 'second'}))
    await expect(client.getAuth()).resolves.toEqual({token: 'second'})
    auth.next(Promise.resolve(undefined))
    await expect(client.getAuth()).resolves.toEqual({})
  })

  test('is cancelled by its signal and bounded by the client timeout', async () => {
    const controller = new AbortController()
    const aborted = createClient({...baseConfig, auth: new Subject<Promise<Auth>>()}).getAuth({
      signal: controller.signal,
    })
    controller.abort()
    await expect(aborted).rejects.toMatchObject({name: 'AbortError'})

    const timedOut = createClient({
      ...baseConfig,
      auth: new Subject<Promise<Auth>>(),
      timeout: 20,
    })
    await expect(timedOut.getAuth()).rejects.toMatchObject({name: 'TimeoutError'})
  })

  test('the observable client emits the credential once and completes', async () => {
    const client = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'reactive'})),
    })
    await expect(lastValueFrom(client.observable.getAuth().pipe(toArray()))).resolves.toEqual([
      {token: 'reactive'},
    ])
  })
})

describe('auth: configuration', () => {
  test('`auth` cannot be combined with `token` or `withCredentials`', () => {
    expect(() =>
      createClient({...baseConfig, auth: of(Promise.resolve(undefined)), token: 'x'}),
    ).toThrow(/`auth` cannot be combined with `token` or `withCredentials`/)
    expect(() =>
      createClient({...baseConfig, auth: of(Promise.resolve(undefined)), withCredentials: true}),
    ).toThrow(/`auth` cannot be combined with `token` or `withCredentials`/)
  })

  test('withConfig rejects `auth` and `token` passed together in one call', () => {
    const client = createClient({...baseConfig, token: 'static'})
    expect(() => client.withConfig({auth: of(Promise.resolve(undefined)), token: 'x'})).toThrow(
      /`auth` cannot be combined with `token` or `withCredentials`/,
    )
  })

  test('the static options are normalised into `config().auth`', async () => {
    await expect(
      firstValueFrom(createClient({...baseConfig, token: 'static'}).config().auth),
    ).resolves.toEqual({token: 'static'})
    await expect(
      firstValueFrom(createClient({...baseConfig, withCredentials: true}).config().auth),
    ).resolves.toEqual({withCredentials: true})
    await expect(firstValueFrom(createClient(baseConfig).config().auth)).resolves.toBeUndefined()
  })

  test('a reactive source is exposed as-is and shared by reference through withConfig', () => {
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'shared'}))
    const client = createClient({...baseConfig, auth})

    expect(client.config().auth).toBe(auth)
    expect(client.withConfig({dataset: 'other'}).config().auth).toBe(auth)
    expect(client.clone().config().auth).toBe(auth)
    expect(client.observable.config().auth).toBe(auth)
  })

  test('withConfig with a static credential replaces the inherited source', async () => {
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'reactive'}))
    const client = createClient({...baseConfig, auth})

    const withToken = client.withConfig({token: 'static'})
    expect(withToken.config().auth).not.toBe(auth)
    expect(withToken.config().token).toBe('static')
    await expect(firstValueFrom(withToken.config().auth)).resolves.toEqual({token: 'static'})

    const withCookies = client.withConfig({withCredentials: true})
    await expect(firstValueFrom(withCookies.config().auth)).resolves.toEqual({
      withCredentials: true,
    })
  })

  test('withConfig with explicit undefined clears the inherited credential', async () => {
    const reactive = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'reactive'})),
    })
    const cleared = reactive.withConfig({token: undefined, withCredentials: false})
    await expect(firstValueFrom(cleared.config().auth)).resolves.toBeUndefined()

    const fixed = createClient({...baseConfig, token: 'static'})
    const clearedStatic = fixed.withConfig({token: undefined})
    await expect(firstValueFrom(clearedStatic.config().auth)).resolves.toBeUndefined()
    expect(clearedStatic.config().token).toBeUndefined()
  })

  test('withConfig({auth: undefined}) on a reactive client yields an anonymous client', async () => {
    const reactive = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'r'})),
    })
    const cleared = reactive.withConfig({auth: undefined})
    await expect(cleared.getAuth()).resolves.toEqual({})
    expect(Object.keys(cleared.config())).not.toContain('token')
  })

  test('withConfig with a reactive source replaces an inherited static token', () => {
    const auth = of(Promise.resolve<Auth>({token: 'reactive'}))
    const derived = createClient({...baseConfig, token: 'static'}).withConfig({auth})

    expect(derived.config().auth).toBe(auth)
    expect(Object.keys(derived.config())).not.toContain('token')
  })

  test('an unchanged static credential keeps the same normalised observable', () => {
    const client = createClient({...baseConfig, token: 'static'})
    const derived = client.withConfig({dataset: 'other'})
    expect(derived.config().auth).toBe(client.config().auth)
  })

  test('reconfiguring with config() switches between the two forms', async () => {
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'reactive'}))
    const client = createClient({...baseConfig, token: 'static'})

    client.config({auth})
    expect(client.config().auth).toBe(auth)

    client.config({token: 'static-again'})
    await expect(firstValueFrom(client.config().auth)).resolves.toEqual({token: 'static-again'})
  })

  test('internal bookkeeping stays out of config() keys and serialisations', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {headers: {Authorization: 'Bearer secret-token'}})
      .respond({status: 200, body: {result: []}})

    const reactive = createClient({
      ...baseConfig,
      auth: new BehaviorSubject<Promise<Auth>>(Promise.resolve({token: 'secret-token'})),
    })
    await reactive.fetch('*')
    const keys = Object.keys(reactive.config())
    expect(keys).not.toContain('staticAuth')
    expect(keys).not.toContain('resolvedAuth')
    expect(JSON.stringify(reactive.config())).not.toContain('secret-token')

    // A static config's `auth` is derived from `token`, so it is readable but
    // not enumerable: a spread reproduces the token, not the derivation.
    const fixed = createClient({...baseConfig, token: 'static'})
    expect(fixed.config().auth).toBeDefined()
    expect(Object.keys(fixed.config())).not.toContain('auth')
    const respread = createClient({...fixed.config()})
    await expect(respread.getAuth()).resolves.toEqual({token: 'static'})
  })

  test('spreading config() of a reactive client carries the source, not a snapshot', () => {
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'reactive'}))
    const client = createClient({...baseConfig, auth})
    const copy = createClient({...client.config()})
    expect(copy.config().auth).toBe(auth)
    expect(Object.keys(client.config())).not.toContain('token')
  })

  test('clone() keeps a static or reactive credential', async () => {
    const tokenClient = createClient({...baseConfig, token: 'static'}).clone()
    await expect(tokenClient.getAuth()).resolves.toEqual({token: 'static'})
    const cookieClient = createClient({...baseConfig, withCredentials: true}).clone()
    await expect(cookieClient.getAuth()).resolves.toEqual({withCredentials: true})

    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'reactive'}))
    const reactive = createClient({...baseConfig, auth})
    expect(reactive.clone().config().auth).toBe(auth)
    expect(reactive.observable.clone().config().auth).toBe(auth)
  })

  test('config() of a reactive client can be passed back in without spreading it', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {headers: {Authorization: 'Bearer reactive'}})
      .respond({status: 200, body: {result: []}})
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'reactive'}))
    const client = createClient({...baseConfig, auth})
    // Resolve a credential, so the deprecated `token` getter has a value to return.
    await client.fetch('*')

    // `client.config()` already carries `resolveFetch`, so no wrapper is needed.
    expect(createCoreClient(client.config()).config().auth).toBe(auth)
    const staticClient = createClient({...baseConfig, token: 'static'})
    expect(staticClient.withConfig(client.config()).config().auth).toBe(auth)
  })
})

describe('auth: listen()', () => {
  const listenPath = '/v1/data/listen/prod'

  test('reconnects with Last-Event-ID when the source emits a new credential', async () => {
    expect.assertions(1)
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'first'}))
    const scope = getActiveMock().scope(apiHost)
    scope.on('GET', listenPath, {headers: {Authorization: 'Bearer first'}}).respond({
      status: 200,
      headers: sseHeaders,
      body: streamBody(
        encode({id: 'ev1', event: 'mutation', data: JSON.stringify({documentId: 'a'})}),
        streamStall(),
      ),
    })
    scope
      .on('GET', listenPath, {
        headers: {Authorization: 'Bearer second', 'Last-Event-ID': 'ev1'},
      })
      .respond({
        status: 200,
        headers: sseHeaders,
        body: streamBody(
          encode({id: 'ev2', event: 'mutation', data: JSON.stringify({documentId: 'b'})}),
          streamStall(),
        ),
      })

    const client = createClient({...baseConfig, auth})
    const events = await lastValueFrom(
      client.listen('*').pipe(
        tap((event) => {
          if (event.documentId === 'a') {
            // Rotate the credential once the first connection is established.
            queueMicrotask(() => auth.next(Promise.resolve<Auth>({token: 'second'})))
          }
        }),
        take(2),
        toArray(),
      ),
    )
    expect(events.map((event) => event.documentId)).toEqual(['a', 'b'])
  })

  test("the eventsource package's own reconnect resolves the credential again", async () => {
    expect.assertions(2)
    // A source that answers each subscriber with whatever is current and
    // never emits again: nothing here can trigger a client-driven reconnect,
    // so the second connection can only come from the package's retry.
    let current = Promise.resolve<Auth>({token: 'first'})
    const auth = new Observable<Promise<Auth>>((subscriber) => {
      subscriber.next(current)
    })
    const scope = getActiveMock().scope(apiHost)
    // The first connection closes normally after asking for a quick retry.
    scope.on('GET', listenPath, {headers: {Authorization: 'Bearer first'}}).respond({
      status: 200,
      headers: sseHeaders,
      body: encode({retry: 20, event: 'welcome', data: '{}'}),
    })
    scope.on('GET', listenPath, {headers: {Authorization: 'Bearer second'}}).respond({
      status: 200,
      headers: sseHeaders,
      body: streamBody(encode({event: 'welcome', data: '{}'}), streamStall()),
    })

    const client = createClient({...baseConfig, auth})
    const events = await lastValueFrom(
      client.listen('*', {}, {events: ['welcome']}).pipe(
        tap(() => {
          current = Promise.resolve<Auth>({token: 'second'})
        }),
        take(2),
        toArray(),
      ),
    )
    expect(events).toHaveLength(2)
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', listenPath, 2)
  })

  test('a 401 in cookie mode is superseded by a re-login settling to a new credential', async () => {
    expect.assertions(2)
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve({withCredentials: true}))
    const scope = getActiveMock().scope(apiHost)
    scope.on('GET', listenPath).respond({status: 401, body: '', delay: 10})
    scope
      .on('GET', listenPath)
      .respond({status: 200, headers: sseHeaders, body: encode({event: 'welcome', data: '{}'})})

    const client = createClient({...baseConfig, auth})
    const welcome = firstValueFrom(client.listen('*', {}, {events: ['welcome']}))
    // The user logs in again while the first attempt is in flight: same
    // mode, new credential object.
    setTimeout(() => auth.next(Promise.resolve<Auth>({withCredentials: true})), 3)

    await expect(welcome).resolves.toMatchObject({type: 'welcome'})
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', listenPath, 2)
  })

  test('a 401 is final when the source still stands by the rejected credential', async () => {
    getActiveMock().scope(apiHost).on('GET', listenPath).respondPersist({status: 401, body: ''})

    const client = createClient({
      ...baseConfig,
      auth: new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'revoked'})),
    })
    const error = await firstValueFrom(client.listen('*').pipe(catchError((err) => of(err))))

    expect(error).toBeInstanceOf(ConnectionFailedError)
    expect(error.status).toBe(401)
  })

  test('a 401 during a pending renewal waits for it and reconnects with the new credential', async () => {
    expect.assertions(2)
    // The first attempt goes out with the token the server has stopped
    // accepting. By the time the 401 is handled the source holds a pending
    // renewal, so the stream waits for it instead of erroring.
    let renew: (state: Auth) => void = () => {}
    const renewal = new Promise<Auth>((resolve) => {
      renew = resolve
    })
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'expired'}))
    const scope = getActiveMock().scope(apiHost)
    scope.on('GET', listenPath, {headers: {Authorization: 'Bearer expired'}}).respond({
      status: 401,
      body: '',
      delay: 10,
    })
    scope.on('GET', listenPath, {headers: {Authorization: 'Bearer fresh'}}).respond({
      status: 200,
      headers: sseHeaders,
      body: encode({event: 'welcome', data: '{}'}),
    })

    const client = createClient({...baseConfig, auth})
    const welcome = firstValueFrom(client.listen('*', {}, {events: ['welcome']}))
    // Renewal starts while the first attempt is in flight, settles after the 401.
    setTimeout(() => auth.next(renewal), 3)
    setTimeout(() => renew({token: 'fresh'}), 30)

    await expect(welcome).resolves.toMatchObject({type: 'welcome'})
    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', listenPath, 2)
  })

  test('unsubscribing while a 401 waits on a pending renewal releases the source', async () => {
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'expired'}))
    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath, {headers: {Authorization: 'Bearer expired'}})
      .respond({status: 401, body: '', delay: 10})

    const client = createClient({...baseConfig, auth})
    const subscription = client.listen('*', {}, {events: ['welcome']}).subscribe()
    // A renewal that never settles: the 401 handler is left waiting on it.
    setTimeout(() => auth.next(new Promise<Auth>(() => {})), 3)
    await new Promise((resolve) => setTimeout(resolve, 30))

    subscription.unsubscribe()
    expect(auth.observed, 'no wait outlives the stream').toBe(false)
  })

  test('a pending renewal does not reconnect an open stream; its settling does', async () => {
    expect.assertions(1)
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'first'}))
    const scope = getActiveMock().scope(apiHost)
    scope.on('GET', listenPath, {headers: {Authorization: 'Bearer first'}}).respond({
      status: 200,
      headers: sseHeaders,
      body: streamBody(
        encode({id: 'ev1', event: 'mutation', data: JSON.stringify({documentId: 'a'})}),
        streamStall(),
      ),
    })
    scope
      .on('GET', listenPath, {headers: {Authorization: 'Bearer second', 'Last-Event-ID': 'ev1'}})
      .respond({
        status: 200,
        headers: sseHeaders,
        body: streamBody(
          encode({id: 'ev2', event: 'mutation', data: JSON.stringify({documentId: 'b'})}),
          streamStall(),
        ),
      })

    let renew: (state: Auth) => void = () => {}
    const client = createClient({...baseConfig, auth})
    const events = await lastValueFrom(
      client.listen('*').pipe(
        tap((event) => {
          if (event.documentId === 'a') {
            // A pending renewal: the connection stays up until it settles.
            auth.next(new Promise<Auth>((resolve) => (renew = resolve)))
            setTimeout(() => renew({token: 'second'}), 20)
          }
        }),
        take(2),
        toArray(),
      ),
    )
    expect(events.map((event) => event.documentId)).toEqual(['a', 'b'])
  })

  test('an error from the source ends the stream with that error', async () => {
    const sessionOver = new Error('session is over')
    const client = createClient({...baseConfig, auth: throwError(() => sessionOver)})
    const error = await firstValueFrom(client.listen('*').pipe(catchError((err) => of(err))))
    expect(error).toBe(sessionOver)
  })

  test('the client token replaces an Authorization set through config headers, as for requests', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath, {headers: {Authorization: 'Bearer real'}})
      .respond({status: 200, headers: sseHeaders, body: encode({event: 'welcome', data: '{}'})})

    const client = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({token: 'real'})),
      headers: {Authorization: 'Bearer from-headers', 'X-Custom': 'kept'},
    })
    await firstValueFrom(client.listen('*', {}, {events: ['welcome']}))

    const [request] = getActiveMock().getRequests()
    expect(request).toHaveHeader('x-custom', 'kept')
  })

  test('a rejected renewal ends an open stream with that error', async () => {
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve({token: 'first'}))
    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath, {headers: {Authorization: 'Bearer first'}})
      .respond({
        status: 200,
        headers: sseHeaders,
        body: streamBody(encode({event: 'welcome', data: '{}'}), streamStall()),
      })

    const refreshFailed = new Error('refresh failed')
    const client = createClient({...baseConfig, auth})
    const outcome = await firstValueFrom(
      client.listen('*', {}, {events: ['welcome']}).pipe(
        tap(() => {
          // The connection is healthy; the credential behind it is not.
          const renewal = Promise.reject<Auth>(refreshFailed)
          renewal.catch(() => {})
          auth.next(renewal)
        }),
        // Skip the welcome; the next notification is the stream's error.
        catchError((err) => of(err)),
        take(2),
        toArray(),
      ),
    )
    expect(outcome[1]).toBe(refreshFailed)
  })

  test('cookie mode connects with credentials', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath)
      .respond({status: 200, headers: sseHeaders, body: encode({event: 'welcome', data: '{}'})})

    const client = createClient({
      ...baseConfig,
      auth: of(Promise.resolve<Auth>({withCredentials: true})),
    })
    await firstValueFrom(client.listen('*', {}, {events: ['welcome']}))

    const [request] = getActiveMock().getRequests()
    expect(request.init?.credentials).toBe('include')
  })
})

describe('auth: live.events()', () => {
  const liveConfig = {...baseConfig, apiVersion: 'X'}
  const livePath = '/vX/data/live/events/prod'
  const liveHeaders = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'}

  test('includeDrafts sends the current credential and reconnects with Last-Event-ID on change', async () => {
    expect.assertions(1)
    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'first'}))
    const scope = getActiveMock().scope(apiHost)
    scope.on('GET', livePath, {headers: {Authorization: 'Bearer first'}}).respond({
      status: 200,
      headers: liveHeaders,
      body: streamBody(encode({id: 'w1', event: 'welcome', data: '{}'}), streamStall()),
    })
    scope
      .on('GET', livePath, {headers: {Authorization: 'Bearer second', 'Last-Event-ID': 'w1'}})
      .respond({
        status: 200,
        headers: liveHeaders,
        body: streamBody(encode({id: 'w2', event: 'welcome', data: '{}'}), streamStall()),
      })

    const client = createClient({...liveConfig, auth})
    const events = await lastValueFrom(
      client.live.events({includeDrafts: true}).pipe(
        tap((event) => {
          if ('id' in event && event.id === 'w1') {
            queueMicrotask(() => auth.next(Promise.resolve<Auth>({token: 'second'})))
          }
        }),
        take(2),
        toArray(),
      ),
    )
    expect(events.map((event) => ('id' in event ? event.id : undefined))).toEqual(['w1', 'w2'])
  })

  test('does not throw up front for includeDrafts when the credential is reactive', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', livePath)
      .respond({
        status: 200,
        headers: liveHeaders,
        body: encode({id: 'w1', event: 'welcome', data: '{}'}),
      })

    const client = createClient({...liveConfig, auth: of(Promise.resolve(undefined))})
    await expect(firstValueFrom(client.live.events({includeDrafts: true}))).resolves.toMatchObject({
      type: 'welcome',
    })
  })

  test('two clients sharing one source share one draft stream; different sources do not', async () => {
    const shared = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'shared'}))
    const other = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'shared'}))
    const scope = getActiveMock().scope(apiHost)
    const body = () => streamBody(encode({id: 'w1', event: 'welcome', data: '{}'}), streamStall())
    scope.on('GET', livePath).respond({status: 200, headers: liveHeaders, body: body()})
    scope.on('GET', livePath).respond({status: 200, headers: liveHeaders, body: body()})

    const a = createClient({...liveConfig, auth: shared})
    const b = createClient({...liveConfig, auth: shared})
    const c = createClient({...liveConfig, auth: other})

    await Promise.all([
      firstValueFrom(a.live.events({includeDrafts: true})),
      firstValueFrom(b.live.events({includeDrafts: true})),
      firstValueFrom(c.live.events({includeDrafts: true})),
    ])

    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', livePath, 2)
  })

  test('the CORS probe knows a reactive cookie-mode connection sent credentials', async () => {
    // An origin allow-listed without credentials answers `allowed: true,
    // withCredentials: false`. That is only a rejection when the connection
    // actually sent cookies, which under a reactive source is known from the
    // credential the connection resolved, not from the config.
    const scope = getActiveMock().scope(apiHost)
    scope.on('GET', livePath).respond({status: 403, body: ''})
    scope
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: false}}})

    const client = createClient({
      ...liveConfig,
      auth: of(Promise.resolve<Auth>({withCredentials: true})),
    })
    const error = await firstValueFrom(
      client.live.events({includeDrafts: true}).pipe(catchError((err) => of(err))),
    )
    expect(error).toBeInstanceOf(CorsOriginError)
  })

  test('published-only streams ignore the credential and its changes', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', livePath)
      .respond({
        status: 200,
        headers: liveHeaders,
        body: streamBody(encode({id: 'w1', event: 'welcome', data: '{}'}), streamStall()),
      })

    const auth = new BehaviorSubject<Promise<Auth>>(Promise.resolve<Auth>({token: 'first'}))
    const client = createClient({...liveConfig, auth})
    const welcome = await firstValueFrom(
      client.live.events().pipe(
        tap(() => {
          auth.next(Promise.resolve<Auth>({token: 'second'}))
        }),
      ),
    )
    expect(welcome.type).toBe('welcome')
    const [request] = getActiveMock().getRequests()
    expect(request).not.toHaveHeader('authorization')
  })
})
