import {createClient} from '@sanity/client'
import {expect, test} from 'vitest'

// The public read-only dataset the previous `runtimes/*` smoke tests used.
// Project https://sanity.io/manage/project/81pocpw8, dataset `production`.
// This is the only test in the repo that talks to the real Sanity API, so it
// cannot be reproduced offline - run it only where network access is expected
// (a schedule, or a version PR), never in the ordinary hermetic PR suites.
const projectId = '81pocpw8'
const dataset = 'production'
const apiVersion = 'v2021-03-25'
const query = /* groq */ `count(*[studioVersion == 3])`

test('the published package resolves and queries the real API', async () => {
  const client = createClient({projectId, dataset, apiVersion, useCdn: true})
  const result = await client.fetch(query)
  expect(Number.isInteger(result)).toBe(true)
})
