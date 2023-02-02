import {assert} from 'https://deno.land/std@0.171.0/testing/asserts.ts'
import {createClient} from '../../dist/index.browser.js'

const projectId = '81pocpw8'
const dataset = 'production'
const apiVersion = 'v2021-03-25'
const query = /* groq */ `count(*[studioVersion == 3])`

// Ensure the runtime is supposed to be able to run this query correctly
Deno.test('native fetch', async () => {
  const res = await fetch(
    `https://${projectId}.apicdn.sanity.io/${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(
      query
    )}`
  )
  const {result: data} = await res.json()
  assert(Number.isInteger(data))
})

Deno.test('@sanity/client fetch', async () => {
  const client = createClient({
    // @ts-expect-error -- fix the TS typings
    projectId,
    dataset,
    apiVersion,
    useCdn: true,
  })
  // @ts-expect-error -- fix the TS typings
  const data = await client.fetch(query)
  assert(Number.isInteger(data))
})
