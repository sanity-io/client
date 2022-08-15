const {describe, expect, test} = require('@jest/globals')
const createClient = require('@sanity/client')

const projectId = '81pocpw8'
const dataset = 'production'
const query = /* groq */ `count(*[studioVersion == 3])`

describe('client.fetch', () => {
  // Ensure the runtime is supposed to be able to run this query correctly
  test('native fetch', async () => {
    expect.assertions(1)
    const res = await fetch(
      `https://${projectId}.apicdn.sanity.io/v1/data/query/${dataset}?query=${encodeURIComponent(
        query
      )}`
    )
    const data = await res.json()
    expect(data).toEqual({
      ms: expect.any(Number),
      query,
      result: expect.any(Number),
    })
  })
  test('@sanity/client', async () => {
    expect.assertions(1)
    const client = createClient({projectId, dataset, useCdn: true})
    const data = await client.fetch(query)
    expect(data).toEqual(expect.any(Number))
  })
})
