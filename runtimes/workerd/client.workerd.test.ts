import {createClient} from '@sanity/client'
import {expect, test} from 'vitest'

const projectId = '81pocpw8'
const dataset = 'production'
const apiVersion = 'v2021-03-25'
const query = /* groq */ `count(*[studioVersion == 3])`

// Ensure the runtime itself can run this query correctly
test('native fetch', async () => {
  const res = await fetch(
    `https://${projectId}.apicdn.sanity.io/${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(
      query,
    )}`,
  )
  const {result} = await res.json()
  expect(Number.isInteger(result)).toBe(true)
})

// Exercises the fetch build end-to-end under workerd. If get-it's Node (undici)
// build leaked in, importing the client would throw here.
test('@sanity/client fetch', async () => {
  const client = createClient({projectId, dataset, apiVersion, useCdn: true})
  const data = await client.fetch(query)
  expect(Number.isInteger(data)).toBe(true)
})
