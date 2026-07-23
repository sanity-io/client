import {createClient} from '@sanity/client'
import {afterEach, describe, expect, test, vi} from 'vitest'

import {resolveEventSourceFetch} from '../src/data/resolveEventSourceFetch'

const spyFetch = () =>
  vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(''))

describe.skipIf(typeof EdgeRuntime === 'string' || typeof document !== 'undefined')(
  'resolveEventSourceFetch',
  () => {
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
      const globalFetch = spyFetch()
      vi.stubGlobal('fetch', globalFetch)
      const resolveFetch = vi.fn(() => envFetch)
      const config = {...getConfig(), resolveFetch}

      await resolveEventSourceFetch(config)('https://example.com/sse')

      expect(resolveFetch).toHaveBeenCalledWith(undefined)
      expect(envFetch).toHaveBeenCalledTimes(1)
      expect(globalFetch).not.toHaveBeenCalled()
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
  },
)
