import path from 'node:path'

import {type ClientConfig, createClient as createCoreClient} from '@sanity/client'

import {testResolveFetch} from '../helpers/mockFetch'

// Every client created in this suite talks to the per-test `get-it/mock`
// transport, injected through the public `resolveFetch` config option. Tests
// that need a different transport pass their own `resolveFetch` in the config.
export const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

export const apiHost = 'api.sanity.url'
export const defaultProjectId = 'bf1942'
export const projectHost = (projectId?: string) =>
  `https://${projectId || defaultProjectId}.${apiHost}`

export const globalApiHost = `https://${apiHost}`
export const clientConfig = {
  apiHost: globalApiHost,
  projectId: 'bf1942',
  apiVersion: '1',
  dataset: 'foo',
  useCdn: false,
}

export const fixture = (name: string) => path.join(__dirname, '..', 'fixtures', name)

export const getClient = (conf?: ClientConfig) => createClient({...clientConfig, ...conf})
