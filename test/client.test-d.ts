import {
  type ClientConfig,
  createClient,
  type QueryParams,
  type StrictUnknownQueryResponseResult,
} from '@sanity/client'
import {assertType, describe, test} from 'vitest'

const apiHost = 'api.sanity.url'
const clientConfig = {
  apiHost: `https://${apiHost}`,
  projectId: 'bf1942',
  apiVersion: '1',
  dataset: 'foo',
  useCdn: false,
} satisfies ClientConfig

describe('opt-in strict typings', () => {
  const client = createClient(clientConfig)
  test('query parameters can be typed', () => {
    interface TestParams extends QueryParams {
      foo: string
    }
    assertType(client.fetch<unknown, TestParams>('*', {foo: 'bar'}))
    // @ts-expect-error foo is a number
    assertType(client.fetch<unknown, TestParams>('*', {name: 42}))
    // @ts-expect-error params are required
    assertType(client.fetch<unknown, TestParams>('*'))
  })

  test('query responses can have strict types', async () => {
    // Ensure that the strict response type is as annoying as possible.
    // The more annoying the easier it is to spot that a type inference library is unable
    // to provided the expected runtime safety for a given query. This could happen if there's not enough information
    // in a Studio schema, or if the query itself is too dynamic to predict at compile time what the response will be.
    const response = await client.fetch<StrictUnknownQueryResponseResult>('*')

    // The top level response can be many different primitives
    if (typeof response === 'string') {
      assertType<string>(response)
    } else if (typeof response === 'number') {
      assertType<number>(response)
    } else if (typeof response === 'boolean') {
      assertType<boolean>(response)
    } else if (response === null) {
      assertType<null>(response)
    } else if (Array.isArray(response)) {
      assertType<Array<unknown>>(response)
    } else if (typeof response === 'object') {
      assertType<Record<string, unknown>>(response)
    } else {
      assertType<never>(response)
    }

    // if it's an object it can still be `null`
    if (typeof response === 'object') {
      assertType<null | Record<string, any>>(response)
    }
    if (!response) {
      // @ts-expect-error -- falsy doesn't necessarily mean it's `null`
      assertType<null>(response)
      if (typeof response === 'number') {
        // Could be a falsy number
        assertType<number>(response)
      } else if (typeof response === 'string') {
        // Or an empty string
        assertType<string>(response)
      } else if (response === false) {
        // Or false
        assertType<boolean>(response)
      } else if (typeof response === 'object') {
        assertType<null>(response)
      } else {
        assertType<never>(response)
      }
      // It's best to check for `null` explicitly instead of assuming
      if (response === null) {
        assertType<null>(response)
      }
    }

    // top level can't be `undefined`, GROQ returns `null` for cases where there are no results
    if (
      !response &&
      typeof response !== 'string' &&
      typeof response !== 'number' &&
      response !== false &&
      response !== null
    ) {
      assertType<never>(response)
    }
    // A document property on the other hand might be undefined, this is common if GROQ projections aren't used and documents are in a draft state
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const {field} = response
      if (
        !field &&
        typeof field !== 'string' &&
        typeof field !== 'number' &&
        field !== false &&
        field !== null
      ) {
        assertType<undefined>(field)
        // @ts-expect-error -- double check that the type is asserted as undefined
        assertType<never>(field)
      }
    }

    if (response) {
      if (typeof response === 'object' && response.length) {
        // @ts-expect-error -- if it's an object with a `length` property it doesn't mean it's an array
        assertType<Array<any>>(response)
      }
      if (Array.isArray(response)) {
        assertType<number>(response.length)
        // Arrays can recurse
        if (Array.isArray(response[0])) {
          assertType<StrictUnknownQueryResponseResult[]>(response[0])
        }
      } else if (typeof response === 'object') {
        if (response.length) {
          // @ts-expect-error -- if it's not an array we can't assume that if it has `length` it's a number
          assertType<number>(response.length)
          // Objects can contain nested objects
          assertType<StrictUnknownQueryResponseResult>(response.length)
          if (typeof response.length === 'object' && !Array.isArray(response.length)) {
            // @ts-expect-error -- it's an object, not an array
            assertType<StrictUnknownQueryResponseResult[]>(response.length)
            // The nesting can be thousands of levels deep
            assertType<Record<string, StrictUnknownQueryResponseResult | undefined>>(
              response.length,
            )
          }
        } else if (response.length === undefined) {
          // It might be `undefined`
          assertType<undefined>(response.length)
        } else if (typeof response.length === 'number') {
          // It has to be checked explicitly, not assumed
          assertType<number>(response.length)
        }
      }
    }
  })
})
