const {expect, test} = require('@jest/globals')
const createClient = require('@sanity/client')

const projectId = '81pocpw8'
const dataset = 'production'
const apiVersion = 'v2021-03-25'
const query = /* groq */ `count(*[studioVersion == 3])`

// Ensure the runtime is supposed to be able to run this query correctly
test('native fetch', async () => {
  expect.assertions(1)
  const res = await fetch(
    `https://${projectId}.apicdn.sanity.io/${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(
      query
    )}`
  )
  const {result: data} = await res.json()
  expect(data).toEqual(expect.any(Number))
})
test('@sanity/client', async () => {
  expect.assertions(1)
  const client = createClient({projectId, dataset, apiVersion, useCdn: true})
  const data = await client.fetch(query)
  expect(data).toEqual(expect.any(Number))
})
