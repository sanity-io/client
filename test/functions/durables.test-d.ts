import {createClient, type DurableCallbackFailure} from '@sanity/client'
import type {Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

const client = createClient({useProjectHostname: false, apiVersion: '2025-02-19', useCdn: false})

describe('client.functions.durables', () => {
  test('callbacks resolve without a value', () => {
    expectTypeOf(client.functions.durables.callbackSuccess('id', {ok: true})).toEqualTypeOf<
      Promise<void>
    >()
    expectTypeOf(client.functions.durables.callbackFailure('id', new Error('boom'))).toEqualTypeOf<
      Promise<void>
    >()
    expectTypeOf(client.observable.functions.durables.callbackSuccess('id')).toEqualTypeOf<
      Observable<void>
    >()
    expectTypeOf(client.observable.functions.durables.callbackFailure('id')).toEqualTypeOf<
      Observable<void>
    >()
  })

  test('a failure is an Error or the wire fields', () => {
    expectTypeOf(client.functions.durables.callbackFailure)
      .parameter(1)
      .toEqualTypeOf<Error | DurableCallbackFailure | undefined>()
  })

  test('errorData must already be a string', () => {
    // @ts-expect-error -- errorData is a string on the wire; structured data must be serialized
    client.functions.durables.callbackFailure('id', {errorData: {reason: 'budget'}})
  })
})
