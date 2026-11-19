import {
  createClient,
  type DurableCallbackFailure,
  type DurableExecution,
  type DurableStopExecutionOptions,
} from '@sanity/client'
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

  test('stopExecution resolves with the stopped execution', () => {
    expectTypeOf(
      client.functions.durables.stopExecution('functionId', 'executionId'),
    ).toEqualTypeOf<Promise<DurableExecution>>()
    expectTypeOf(
      client.observable.functions.durables.stopExecution('functionId', 'executionId'),
    ).toEqualTypeOf<Observable<DurableExecution>>()
    expectTypeOf(client.functions.durables.stopExecution)
      .parameter(2)
      .toEqualTypeOf<DurableStopExecutionOptions | undefined>()
  })

  test('a failure is an Error or the wire fields', () => {
    expectTypeOf(client.functions.durables.callbackFailure)
      .parameter(1)
      .toEqualTypeOf<Error | DurableCallbackFailure | undefined>()
  })

  test('errorData must already be a string', () => {
    // @ts-expect-error -- errorData is a string on the wire; structured data must be serialized
    void client.functions.durables.callbackFailure('id', {errorData: {reason: 'budget'}})
  })
})
