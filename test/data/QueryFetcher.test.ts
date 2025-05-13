import { describe, expect, test, vi } from 'vitest'
import { QueryFetcher } from '../../src/data/QueryFetcher'
import nock from 'nock'

const apiHost = 'api.sanity.url'
const defaultProjectId = 'bf1942'
const projectHost = (projectId?: string) => `https://${projectId || defaultProjectId}.${apiHost}`

describe('QueryFetcher', () => {
  const defaultConfig = {
    apiHost: `https://${apiHost}`,
    projectId: defaultProjectId,
    apiVersion: '1',
    dataset: 'foo',
    useCdn: false,
  }

  test('executes a query with the correct parameters', async () => {
    const httpRequest = vi.fn().mockImplementation((options) => {
      return { pipe: () => ({ pipe: () => ({ subscribe: (observer: any) => observer.next({ result: [] }) }) }) }
    })

    const fetcher = new QueryFetcher(httpRequest)
    const result = await fetcher.executeFetch(
      defaultConfig,
      '*[_type == "test"]',
      {},
      { returnQuery: false },
      { enabled: false }
    ).toPromise()

    expect(httpRequest).toHaveBeenCalled()
    expect(result).toEqual([])
  })

  test('applies config overrides correctly', async () => {
    const httpRequest = vi.fn().mockImplementation((options) => {
      return { pipe: () => ({ pipe: () => ({ subscribe: (observer: any) => observer.next({ result: [] }) }) }) }
    })

    const fetcher = new QueryFetcher(httpRequest)
    const configOverrides = {
      '~experimental_resource': {
        id: 'test-id',
        type: 'test-type',
      },
    }

    await fetcher.executeFetch(
      defaultConfig,
      '*[_type == "test"]',
      {},
      { returnQuery: false },
      { enabled: false },
      configOverrides
    ).toPromise()

    expect(httpRequest).toHaveBeenCalled()
    // Check that the config overrides were applied
    const callOptions = httpRequest.mock.calls[0][0]
    expect(callOptions.url).toContain('test-type/test-id')
  })
})
