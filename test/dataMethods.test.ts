import {describe, expect, test} from 'vitest'

import * as dataMethods from '../src/data/dataMethods'
import type {ClientConfig} from '../src/types'

const apiHost = 'api.sanity.url'
const defaultProjectId = 'bf1942'
const projectHost = (projectId?: string) => `https://${projectId || defaultProjectId}.${apiHost}`
const clientConfig = {
  apiHost: `https://${apiHost}`,
  projectId: 'bf1942',
  apiVersion: '1',
  dataset: 'foo',
  useCdn: false,
}

describe('dataMethods', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  const {createClient}: typeof import('../src') = await import(
    isEdge ? '../dist/index.browser.js' : '../src'
  )
  const getClient = (conf?: ClientConfig) => createClient({...clientConfig, ...(conf || {})})

  describe('getUrl', () => {
    test('can use getUrl() to get API-relative paths', () => {
      expect(dataMethods._getUrl(getClient(), '/bar/baz')).toEqual(`${projectHost()}/v1/bar/baz`)
    })

    test('can use getUrl() to get API-relative paths (custom api version)', () => {
      expect(dataMethods._getUrl(getClient({apiVersion: '2019-01-29'}), '/bar/baz')).toEqual(
        `${projectHost()}/v2019-01-29/bar/baz`,
      )
    })
  })
})
