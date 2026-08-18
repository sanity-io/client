import {type DatasetsResponse, type EmbeddingsSettings} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {getActiveMock} from '../helpers/mockFetch'
import {apiHost, defaultProjectId, getClient, projectHost} from './helpers'

describe('datasets', () => {
  const dsClient = getClient({requestTagPrefix: 'test'})

  test('throws when trying to create dataset with invalid name', () => {
    expect(() => dsClient.datasets.create('*foo*')).toThrow(/Datasets can only contain/i)
  })

  test('throws when trying to delete dataset with invalid name', () => {
    expect(() => dsClient.datasets.delete('*foo*')).toThrow(/Datasets can only contain/i)
  })

  test('can create dataset', async () => {
    getActiveMock().scope(projectHost()).on('PUT', '/v1/datasets/bar').respond({status: 200})
    await expect(dsClient.datasets.create('bar')).resolves.not.toThrow()
  })

  test('can delete dataset', async () => {
    getActiveMock().scope(projectHost()).on('DELETE', '/v1/datasets/bar').respond({status: 200})
    await expect(dsClient.datasets.delete('bar')).resolves.not.toThrow()
  })

  test('can list datasets', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/datasets')
      .respond({status: 200, body: [{name: 'foo'}, {name: 'bar'}] as DatasetsResponse})
    await expect(dsClient.datasets.list()).resolves.toEqual([{name: 'foo'}, {name: 'bar'}])
  })

  test('can list datasets with useProjectHostname=false', async () => {
    getActiveMock().clear()
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', `/v1/projects/${defaultProjectId}/datasets`)
      .respond({status: 200, body: [{name: 'foo'}, {name: 'bar'}] as DatasetsResponse})

    const client = getClient({useProjectHostname: false})
    await expect(client.datasets.list()).resolves.toEqual([{name: 'foo'}, {name: 'bar'}])

    expect(getActiveMock()).toHaveConsumedAllMocks() // all expectations satisfied
  })

  test('can create dataset with embeddings config', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('PUT', '/v1/datasets/bar', {body: {aclMode: 'public', embeddings: {enabled: true}}})
      .respond({status: 200, body: {datasetName: 'bar', aclMode: 'public'}})

    await expect(
      dsClient.datasets.create('bar', {
        aclMode: 'public',
        embeddings: {enabled: true},
      }),
    ).resolves.toEqual({datasetName: 'bar', aclMode: 'public'})

    expect(getActiveMock()).toHaveConsumedAllMocks()
  })

  test('can get embeddings settings', async () => {
    const settings: EmbeddingsSettings = {
      enabled: true,
      projection: 'myProjection',
      status: 'active',
    }
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/datasets/foo/settings/embeddings')
      .respond({status: 200, body: settings})

    await expect(dsClient.datasets.getEmbeddingsSettings('foo')).resolves.toEqual(settings)
    expect(getActiveMock()).toHaveConsumedAllMocks()
  })

  test('can get embeddings settings with useProjectHostname=false', async () => {
    getActiveMock().clear()
    const settings: EmbeddingsSettings = {
      enabled: false,
      status: 'inactive',
    }
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('GET', `/v1/projects/${defaultProjectId}/datasets/foo/settings/embeddings`)
      .respond({status: 200, body: settings})

    const client = getClient({useProjectHostname: false})
    await expect(client.datasets.getEmbeddingsSettings('foo')).resolves.toEqual(settings)
    expect(getActiveMock()).toHaveConsumedAllMocks()
  })

  test('can edit embeddings settings', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('PUT', '/v1/datasets/foo/settings/embeddings', {
        body: {
          enabled: true,
          projection: 'myProjection',
        },
      })
      .respond({status: 200})

    await expect(
      dsClient.datasets.editEmbeddingsSettings('foo', {
        enabled: true,
        projection: 'myProjection',
      }),
    ).resolves.not.toThrow()
    expect(getActiveMock()).toHaveConsumedAllMocks()
  })

  test('can edit embeddings settings with useProjectHostname=false', async () => {
    getActiveMock().clear()
    getActiveMock()
      .scope(`https://${apiHost}`)
      .on('PUT', `/v1/projects/${defaultProjectId}/datasets/foo/settings/embeddings`, {
        body: {
          enabled: false,
        },
      })
      .respond({status: 200})

    const client = getClient({useProjectHostname: false})
    await expect(
      client.datasets.editEmbeddingsSettings('foo', {enabled: false}),
    ).resolves.not.toThrow()
    expect(getActiveMock()).toHaveConsumedAllMocks()
  })

  test('throws when trying to get embeddings settings with invalid dataset name', () => {
    expect(() => dsClient.datasets.getEmbeddingsSettings('*foo*')).toThrow(
      /Datasets can only contain/i,
    )
  })

  test('throws when trying to edit embeddings settings with invalid dataset name', () => {
    expect(() => dsClient.datasets.editEmbeddingsSettings('*foo*', {enabled: true})).toThrow(
      /Datasets can only contain/i,
    )
  })
})
