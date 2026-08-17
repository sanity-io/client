import {createClient} from '@sanity/client'
import {afterEach, describe, expect, test, vi} from 'vitest'

import {pickBaseFetch, resolveEventSourceFetch} from '../src/data/resolveEventSourceFetch'

const spyFetch = () =>
  vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(''))

describe('resolveEventSourceFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const getConfig = () =>
    createClient({projectId: 'abc123', dataset: 'foo', useCdn: false, apiVersion: '1'}).config()

  test('uses the environment fetch, not globalThis.fetch', async () => {
    // EventSource must use the same fetch implementation as regular
    // requests, so custom fetch variants, undici configuration, and
    // env-proxy support all apply to `listen()`/`live.events()` too.
    // (Node's global fetch, for one, does not read
    // `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`.)
    const envFetch = spyFetch()
    const resolveFetch = vi.fn(() => envFetch)
    const config = {...getConfig(), resolveFetch}

    // `pickBaseFetch` is the seam this whole module resolves through, so
    // asserting identity against it directly is a stronger check than
    // stubbing `globalThis.fetch` and asserting it was left untouched: it
    // cannot pass by accident, and needs no global stubbing at all.
    expect(pickBaseFetch(config)).toBe(envFetch)

    await resolveEventSourceFetch(config)('https://example.com/sse')

    expect(resolveFetch).toHaveBeenCalledWith(undefined)
    expect(envFetch).toHaveBeenCalledTimes(1)
  })

  test('an explicit proxy config is passed to the environment fetch resolver', async () => {
    const envFetch = spyFetch()
    const resolveFetch = vi.fn(() => envFetch)
    const config = {...getConfig(), proxy: 'http://proxy.local:8080', resolveFetch}

    await resolveEventSourceFetch(config)('https://example.com/sse')

    expect(resolveFetch).toHaveBeenCalledWith('http://proxy.local:8080')
    expect(envFetch).toHaveBeenCalledTimes(1)
  })

  test('falls back to globalThis.fetch when the environment has no resolver', async () => {
    // Legitimate use of `vi.stubGlobal`, not a module-boundary mock: the
    // unit under test is *defined* as reading `globalThis.fetch` when no
    // resolver is configured, so controlling the global here is testing
    // the documented fallback contract, not substituting a collaborator.
    // An identity assertion against `pickBaseFetch` (as used above) does
    // not work for this branch: the implementation returns
    // `globalThis.fetch.bind(globalThis)`, and `.bind()` produces a new
    // function object on every call, so `toBe` would always fail.
    const globalFetch = spyFetch()
    vi.stubGlobal('fetch', globalFetch)
    const config = {...getConfig(), resolveFetch: undefined}

    await resolveEventSourceFetch(config)('https://example.com/sse')

    expect(globalFetch).toHaveBeenCalledTimes(1)
  })

  test('the Node entry supplies an environment fetch resolver on the config', () => {
    // Guards the wiring end to end: nodeMiddleware -> defineCreateClient ->
    // client.config(). Without it, EventSource falls back to global fetch
    // and diverges from the transport regular requests use.
    const {resolveFetch} = getConfig()
    if (!resolveFetch) {
      throw new Error('the Node entry must supply resolveFetch on the config')
    }
    expect(typeof resolveFetch()).toBe('function')
    expect(typeof resolveFetch('http://proxy.local:8080')).toBe('function')
  })
})
