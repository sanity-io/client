import {
  createClient,
  type MutationEvent,
  type OpenEvent,
  type ReconnectEvent,
  type WelcomeEvent,
} from '@sanity/client'
import type {Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.listen', () => {
  const client = createClient({})
  test('event types', async () => {
    // mutation event is default
    expectTypeOf(client.listen('*')).toEqualTypeOf<Observable<MutationEvent>>()

    // @ts-expect-error - WelcomeEvent should not be emitted
    expectTypeOf(client.listen('*')).toEqualTypeOf<Observable<WelcomeEvent>>()

    expectTypeOf(client.listen('*', {}, {events: ['welcome']})).toEqualTypeOf<
      Observable<WelcomeEvent>
    >()

    expectTypeOf(client.listen('*', {}, {events: ['welcome']})).toEqualTypeOf<
      // @ts-expect-error - Only WelcomeEvents should be emitted
      Observable<MutationEvent>
    >()

    expectTypeOf(
      client.listen('*', {}, {events: ['welcome', 'mutation', 'open', 'reconnect']}),
    ).toEqualTypeOf<Observable<WelcomeEvent | MutationEvent | ReconnectEvent | OpenEvent>>()
  })
})
