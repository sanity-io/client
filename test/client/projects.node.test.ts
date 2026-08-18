import {requester} from '@sanity/client'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveFetch, getActiveMock} from '../helpers/mockFetch'
import {apiHost} from './helpers'

describe('PROJECTS', () => {
  test('the raw requester export leaves no listeners on a reused caller signal', async () => {
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
  })
})
