import {describe, expect, test} from 'vitest'
import {createViewClient, ObservableViewClient, type ViewClientConfig} from '../../src/views'
import nock from 'nock'

const apiHost = 'api.sanity.url'
const apicdnHost = 'apicdn.sanity.url'

describe('view client', async () => {
  const defaultConfig: ViewClientConfig = {
      apiHost: `https://${apiHost}`,
      apiCdnHost: `https://${apicdnHost}`,
      apiVersion: '2025-01-01',
  }

  describe('promise client', () => {
    test('uses the correct url for a view resource', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'njgNkngskjg'}]

      nock(`https://${apicdnHost}`)
        .get(
          `/v2025-01-01/views/vw123/query?query=*%5B_id+%3D%3D+%22view%22%5D%7B_id%7D&returnQuery=false`,
        )
        .reply(200, {
          ms: 123,
          result,
        })

      const res = await client.fetch('vw123', '*[_id == "view"]{_id}', {}, {})
      expect(res).toEqual(result)
    })
  })

  describe('observable client', () => {
    test('client returns an observable client', async () => {
      const client = createViewClient(defaultConfig)
      expect(client.observable).toBeInstanceOf(ObservableViewClient)
    })

    test('uses the correct url for a view resource', async () => {
      const client = createViewClient(defaultConfig)
      const result = [{_id: 'njgNkngskjg'}]

      nock(`https://${apicdnHost}`)
        .get(
          `/v2025-01-01/views/vw123/query?query=*%5B_id+%3D%3D+%22view%22%5D%7B_id%7D&returnQuery=false`,
        )
        .reply(200, {
          ms: 123,
          result,
        })

      const req = client.observable.fetch('vw123', '*[_id == "view"]{_id}', {}, {})
      await new Promise((resolve) => setTimeout(resolve, 1))

      await new Promise<void>((resolve, reject) => {
        req.subscribe({
          next: (res) => {
            expect(res).toEqual(result)
          },
          error: reject,
          complete: resolve,
        })
      })
    })
  })
})
