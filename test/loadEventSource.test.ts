import {firstValueFrom} from 'rxjs'
import {afterEach, describe, expect, test, vi} from 'vitest'

import {createClient} from '../src'
import {loadEventSource} from '../src/data/loadEventSource'

describe('loadEventSource()', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('loads the EventSource constructor when the environment has what it needs', async () => {
    const EventSource = await loadEventSource()
    expect(typeof EventSource).toBe('function')
  })

  test('names the missing globals instead of crashing inside the package', async () => {
    vi.stubGlobal('Event', undefined)
    vi.stubGlobal('EventTarget', undefined)

    const error = await loadEventSource().catch((err: unknown) => err)
    if (!(error instanceof Error)) throw new Error('Expected loadEventSource() to reject')
    expect(error.message).toContain('not supported in this environment')
    expect(error.message).toContain('`Event`, `EventTarget`')
  })

  test('.listen() errors with the readable message', async () => {
    vi.stubGlobal('EventTarget', undefined)
    const client = createClient({
      projectId: 'abc',
      dataset: 'x',
      useCdn: false,
      apiVersion: '2025-01-01',
    })

    const error = await firstValueFrom(client.listen('*[0]')).catch((err: unknown) => err)
    if (!(error instanceof Error)) throw new Error('Expected listen() to error')
    expect(error.message).toContain('missing global `EventTarget`')
  })
})
