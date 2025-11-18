import {
  createClient,
  type ListenEvent,
  type MutationEvent,
  type OpenEvent,
  type ReconnectEvent,
  type ResetEvent,
  type WelcomeBackEvent,
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

    type MyDoc = {foo: 'bar'}
    // Note – due to typescript's lack of support for partial type argument inference, TypeScript will see options
    // here as `ListenOptions`, meaning the literal event names can no longer be inferred.
    // see https://github.com/microsoft/TypeScript/pull/26349
    expectTypeOf(client.listen<MyDoc>('*', {}, {events: ['welcome', 'mutation']})).toEqualTypeOf<
      Observable<ListenEvent<MyDoc>>
    >()

    expectTypeOf(client.listen('*', {}, {events: []})).toEqualTypeOf<Observable<never>>()

    //@ts-expect-error – welcomeback and reset requires `enableResume`
    expectTypeOf(client.listen('*', {}, {events: ['welcomeback', 'reset']})).toEqualTypeOf<
      Observable<ListenEvent>
    >()

    expectTypeOf(
      client.listen('*', {}, {enableResume: true, events: ['welcome', 'mutation']}),
    ).toEqualTypeOf<Observable<WelcomeEvent | MutationEvent>>()

    const observable = client.listen(
      '*',
      {},
      {enableResume: true, events: ['welcomeback', 'reset']},
    )
    expectTypeOf(observable).toEqualTypeOf<Observable<WelcomeBackEvent | ResetEvent>>()

    expectTypeOf(client.listen('*', {}, {events: ['welcome']})).toEqualTypeOf<
      // @ts-expect-error - Only WelcomeEvents should be emitted
      Observable<MutationEvent>
    >()

    expectTypeOf(
      client.listen('*', {}, {events: ['welcome', 'mutation', 'open', 'reconnect']}),
    ).toEqualTypeOf<Observable<WelcomeEvent | MutationEvent | ReconnectEvent | OpenEvent>>()
  })
})
