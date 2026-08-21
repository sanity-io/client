import {createClient, type InvokeFunctionOptions} from '@sanity/client'
import type {Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

const client = createClient({
  projectId: 'test123',
  apiVersion: '2025-02-19',
  useCdn: false,
  stackId: 'ST-1234567890',
})

interface Payload {
  ok: boolean
}

describe('client.functions.invoke', () => {
  test('an async invoke never carries a return value', () => {
    expectTypeOf(client.functions.invoke('my-func')).toEqualTypeOf<Promise<undefined>>()
    expectTypeOf(client.functions.invoke('my-func', {event: {data: {}}})).toEqualTypeOf<
      Promise<undefined>
    >()
    expectTypeOf(client.functions.invoke('my-func', undefined, {sync: false})).toEqualTypeOf<
      Promise<undefined>
    >()
  })

  test('a sync invoke resolves with the function return value', () => {
    expectTypeOf(
      client.functions.invoke<Payload>('my-func', undefined, {sync: true}),
    ).toEqualTypeOf<Promise<Payload>>()
    expectTypeOf(client.functions.invoke('my-func', undefined, {sync: true})).toEqualTypeOf<
      Promise<unknown>
    >()
  })

  test('a statically unknown `sync` widens to the union', () => {
    const options: InvokeFunctionOptions = {sync: Math.random() > 0.5}

    expectTypeOf(client.functions.invoke<Payload>('my-func', undefined, options)).toEqualTypeOf<
      Promise<Payload | undefined>
    >()
  })

  test('an explicit type argument on an async invoke still allows a body', () => {
    // Callers who name a type opt into the pre-existing `R | undefined` shape.
    expectTypeOf(client.functions.invoke<Payload>('my-func')).toEqualTypeOf<
      Promise<Payload | undefined>
    >()
  })

  test('the observable client mirrors the promise overloads', () => {
    expectTypeOf(client.observable.functions.invoke('my-func')).toEqualTypeOf<
      Observable<undefined>
    >()
    expectTypeOf(
      client.observable.functions.invoke<Payload>('my-func', undefined, {sync: true}),
    ).toEqualTypeOf<Observable<Payload>>()
  })
})
