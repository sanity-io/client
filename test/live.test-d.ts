import {createClient, type SyncTag} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.live.events', () => {
  const client = createClient({})
  test('lastLiveEventId & syncTags', async () => {
    const {searchParams} = new URL(location.href)
    const {result: initial, syncTags} = await client.fetch<number>(
      `count(*[_type == $type])`,
      {type: 'post'},
      {filterResponse: false, lastLiveEventId: searchParams.get('lastLiveEventId')},
    )
    expectTypeOf(initial).toMatchTypeOf<number>()
    expectTypeOf(syncTags!).toMatchTypeOf<SyncTag[]>()

    client.live.events().subscribe((event) => {
      if (
        event.type === 'message' &&
        Array.isArray(syncTags) &&
        event.tags.some((tag) => syncTags.includes(tag))
      ) {
        searchParams.set('lastLiveEventId', event.id)
      }
    })
  })
  test('event types', async () => {
    const subscription = client.live.events().subscribe((event) => {
      if (event.type === 'restart') {
        expectTypeOf(event).toMatchTypeOf<{type: 'restart'}>()
      }
      if (event.type === 'message') {
        expectTypeOf(event).toMatchTypeOf<{type: 'message'; id: string; tags: SyncTag[]}>()
      }
      if (event.type === 'goaway') {
        expectTypeOf(event).toMatchTypeOf<{type: 'goaway'; id: string; reason: string}>()
      }
    })
    expectTypeOf(subscription.unsubscribe).toMatchTypeOf<() => void>()
  })
})
