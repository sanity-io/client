import {describe, expect, test} from 'vitest'

import {anyValue, getActiveMock} from '../helpers/mockFetch'
import {createClient, getClient, projectHost} from './helpers'

describe('getUrl', () => {
  test('can use getUrl() to get API-relative paths', () => {
    expect(getClient().getUrl('/bar/baz')).toEqual(`${projectHost()}/v1/bar/baz`)
  })

  test('can use getUrl() to get API-relative paths (custom api version)', () => {
    expect(getClient({apiVersion: '2019-01-29'}).getUrl('/bar/baz')).toEqual(
      `${projectHost()}/v2019-01-29/bar/baz`,
    )
  })
})
describe('getDataUrl', () => {
  test('can use getDataUrl() to get API paths to a dataset', () => {
    expect(getClient({dataset: 'bikeshop'}).getDataUrl('doc')).toBe('/data/doc/bikeshop')
    expect(getClient({dataset: 'bikeshop'}).getDataUrl('doc', 'bike-123')).toBe(
      '/data/doc/bikeshop/bike-123',
    )
  })
})

test('can use getDataUrl() to get API paths for a resource', () => {
  expect(
    getClient({'~experimental_resource': {type: 'media-library', id: 'res-id'}}).getDataUrl('doc'),
  ).toBe('/media-libraries/res-id/doc')
  expect(
    getClient({'~experimental_resource': {type: 'media-library', id: 'res-id'}}).getDataUrl(
      'doc',
      'bike-123',
    ),
  ).toBe('/media-libraries/res-id/doc/bike-123')
})
describe('discardVersion()', () => {
  test('can discard draft version of a document with publishedId', async () => {
    const publishedId = 'doc123'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.discard',
              versionId: 'drafts.doc123',
              purge: false,
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().discardVersion({publishedId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can discard a release version of a document', async () => {
    const publishedId = 'doc123'
    const releaseId = 'release456'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.discard',
              versionId: 'versions.release456.doc123',
              purge: false,
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().discardVersion({publishedId, releaseId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can discard version with purge option set to true', async () => {
    const publishedId = 'doc123'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.discard',
              versionId: 'drafts.doc123',
              purge: true,
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().discardVersion({publishedId}, true)
    expect(res.transactionId).toEqual('abc123')
  })

  test('handles errors when discarding versions', async () => {
    const publishedId = 'doc123'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo')
      .respondWithError(new Error('Network error occurred'))

    await expect(getClient().discardVersion({publishedId})).rejects.toThrowError()
  })

  test('throws when publishedId is missing', async () => {
    const args = {} as Partial<{publishedId: string; releaseId?: string}>

    let error: Error | null = null
    try {
      await getClient().discardVersion(args as any)
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
  })
})
describe('unpublishVersion()', () => {
  test('can unpublish a release version of a document', async () => {
    const publishedId = 'doc123'
    const releaseId = 'release456'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.unpublish',
              versionId: 'versions.release456.doc123',
              publishedId,
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().unpublishVersion({publishedId, releaseId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can unpublish a version with additional options', async () => {
    const publishedId = 'doc123'
    const releaseId = 'release456'
    const options = {
      skipCrossDatasetReferenceValidation: true,
      dryRun: true,
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.unpublish',
              versionId: 'versions.release456.doc123',
              publishedId,
            },
          ],
          skipCrossDatasetReferenceValidation: true,
          dryRun: true,
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().unpublishVersion({publishedId, releaseId}, options)
    expect(res.transactionId).toEqual('abc123')
  })

  test('throws when releaseId is drafts', async () => {
    const args = {releaseId: 'drafts'} as any

    let error: Error | null = null
    try {
      await getClient().unpublishVersion(args)
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch('Version can not be "published" or "drafts"')
  })

  test('throws when data request fails', async () => {
    const args = {publishedId: 'doc123', releaseId: 'release456'} as any

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo')
      .respond({
        status: 400,
        body: {
          error: 'Invalid document ID',
          message: 'Document ID must be a string',
        },
      })

    let error: Error | null = null
    try {
      await getClient().unpublishVersion(args)
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch('Invalid document ID - Document ID must be a string')
  })
})
describe('replaceVersion()', () => {
  test('can replace version using only document with _id', async () => {
    getActiveMock().clear()
    const documentId = 'drafts.doc123'
    const document = {_id: documentId, _type: 'post', title: 'Only document ID'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _id: documentId,
                _type: 'post',
                title: 'Only document ID',
              },
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().replaceVersion({document})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can replace version using document with _id and publishedId', async () => {
    getActiveMock().clear()
    const documentId = 'drafts.doc123'
    const publishedId = 'doc123'
    const document = {_id: documentId, _type: 'post', title: 'Only document ID'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _id: documentId,
                _type: 'post',
                title: 'Only document ID',
              },
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().replaceVersion({document, publishedId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can replace version with draft document and publishedId', async () => {
    const publishedId = 'doc123'
    const document = {_type: 'post', title: 'Replace Version Test'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {...document, _id: 'drafts.doc123'},
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().replaceVersion({document, publishedId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can replace version with matching document, publishedId and releaseId', async () => {
    const publishedId = 'doc123'
    const releaseId = 'release456'
    const document = {_type: 'post', title: 'Replace Version Test'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {...document, _id: 'versions.release456.doc123'},
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().replaceVersion({document, publishedId, releaseId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('throws when document id does not match generated version id', async () => {
    const document = {_type: 'post', _id: 'doc123'}
    const publishedId = 'doc123'
    const releaseId = 'release456'

    let error: Error | null = null
    try {
      await getClient().replaceVersion({document, publishedId, releaseId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      'The provided document ID (`doc123`) does not match the generated version ID (`versions.release456.doc123`)',
    )
  })

  test('throws when draft document id does not match generated version id', async () => {
    const document = {_type: 'post', _id: 'drafts.doc123'}
    const publishedId = 'doc123'
    const releaseId = 'release456'

    let error: Error | null = null
    try {
      await getClient().replaceVersion({document, publishedId, releaseId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      'The provided document ID (`drafts.doc123`) does not match the generated version ID (`versions.release456.doc123`)',
    )
  })

  test('throws when releaseId is drafts', async () => {
    const document = {_type: 'post', _id: 'doc123'}
    const publishedId = 'doc123'
    const releaseId = 'drafts'

    let error: Error | null = null
    try {
      await getClient().replaceVersion({document, publishedId, releaseId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch('Version can not be "published" or "drafts"')
  })

  test('throws when neither publishedId nor document._id are provided', async () => {
    const document = {_type: 'post', title: 'No ID'}

    let error: Error | null = null
    try {
      await getClient().replaceVersion({document} as any)
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`replaceVersion()` requires either a publishedId or a document with an `_id`',
    )
  })

  test('handles network errors gracefully', async () => {
    getActiveMock().clear()
    const publishedId = 'error123'
    const document = {_type: 'post', title: 'Error Test', _id: 'drafts.error123'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {body: anyValue()})
      .respondWithError(new Error('Network error occurred'))

    await expect(getClient().replaceVersion({document, publishedId})).rejects.toThrowError()
  })

  test('throws when document is missing _type property', async () => {
    getActiveMock().clear()
    const publishedId = 'typeless123'
    const document = {title: 'Missing Type'} as any

    let error: Error | null = null
    try {
      await getClient().replaceVersion({document, publishedId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`replaceVersion()` requires that the document contains a type (`_type` property)',
    )
  })

  test('throws when document._id is provided but is not a version ID or draft ID', async () => {
    const document = {
      _id: 'regularId123',
      _type: 'post',
      title: 'Regular ID',
    }

    let error: Error | null = null
    try {
      await getClient().replaceVersion({document})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`replaceVersion()` requires a document with an `_id` that is a version or draft ID',
    )
  })

  test('throws when document._id is a draft ID and releaseId is provided', async () => {
    const publishedId = 'doc123'
    const releaseId = 'release456'
    const documentId = `drafts.${publishedId}`
    const document = {
      _id: documentId,
      _type: 'post',
      title: 'Draft ID',
    }

    let error: Error | null = null
    try {
      await getClient().replaceVersion({document, releaseId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      `\`replaceVersion()\` was called with a document ID (\`${documentId}\`) that is a draft ID, but a release ID (\`${releaseId}\`) was also provided.`,
    )
  })

  test('throws when document._id is a version ID but version does not match provided releaseId', async () => {
    const publishedId = 'doc123'
    const wrongReleaseId = 'oldRelease789'
    const releaseId = 'newRelease456'
    const versionId = `versions.${wrongReleaseId}.${publishedId}`
    const document = {
      _id: versionId,
      _type: 'post',
      title: 'Version ID mismatch',
    }

    let error: Error | null = null
    try {
      await getClient().replaceVersion({document, releaseId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      `\`replaceVersion()\` was called with a document ID (\`${versionId}\`) that is a version ID, but the release ID (\`${releaseId}\`) does not match the document's version ID (\`${wrongReleaseId}\`).`,
    )
  })

  test('can use document with existing _id', async () => {
    getActiveMock().clear()
    const documentId = 'drafts.existing123'
    const document = {_id: documentId, _type: 'post', title: 'Only document ID'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _id: documentId,
                _type: 'post',
                title: 'Only document ID',
              },
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().replaceVersion({document})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can use publishedId to generate draft ID with no document._id', async () => {
    getActiveMock().clear()
    const publishedId = 'doc123'
    const document = {_type: 'post', title: 'Replace Version Test'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _type: 'post',
                title: 'Replace Version Test',
                _id: `drafts.${publishedId}`,
              },
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().replaceVersion({document, publishedId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('combines publishedId and releaseId to create version ID', async () => {
    getActiveMock().clear()
    const publishedId = 'rel123'
    const releaseId = 'release789'
    const document = {_type: 'post', title: 'Replace with Release Test'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.replace',
              document: {
                _type: 'post',
                title: 'Replace with Release Test',
                _id: `versions.${releaseId}.${publishedId}`,
              },
            },
          ],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
        },
      })

    const res = await getClient().replaceVersion({document, publishedId, releaseId})
    expect(res.transactionId).toEqual('abc123')
  })
})

test('allows overriding headers', async () => {
  const client = createClient({
    projectId: 'abc123',
    dataset: 'foo',
    token: 'foo',
    useCdn: false,
  })

  getActiveMock()
    .scope('https://abc123.api.sanity.io')
    .on('GET', '/v1/data/query/foo?query=*&returnQuery=false', {
      headers: {foo: 'bar'},
    })
    .respond({status: 200, body: {result: []}})

  await expect(client.fetch('*', {}, {headers: {foo: 'bar'}})).resolves.not.toThrow()
})

test('applies headers from client configuration', async () => {
  const client = createClient({
    projectId: 'abc123',
    dataset: 'foo',
    useCdn: false,
    headers: {
      'X-Custom-Header': 'custom-value',
      'X-Another-Header': 'another-value',
    },
  })

  getActiveMock()
    .scope('https://abc123.api.sanity.io')
    .on('GET', '/v1/data/query/foo?query=*&returnQuery=false', {
      headers: {
        'X-Custom-Header': 'custom-value',
        'X-Another-Header': 'another-value',
      },
    })
    .respond({status: 200, body: {result: []}})

  await expect(client.fetch('*')).resolves.not.toThrow()
})

test('critical headers are not overridden by config headers', async () => {
  const client = createClient({
    projectId: 'abc123',
    dataset: 'foo',
    token: 'auth-token',
    useCdn: false,
    headers: {
      'X-Custom-Header': 'config-value',
      Authorization: 'Bearer fake-token',
    },
  })

  // The token from config is not overridden by the `Authorization` config header.
  getActiveMock()
    .scope('https://abc123.api.sanity.io')
    .on('GET', '/v1/data/query/foo?query=auth-test&returnQuery=false', {
      headers: {
        Authorization: 'Bearer auth-token',
        'X-Custom-Header': 'config-value',
      },
    })
    .respond({status: 200, body: {result: []}})

  // Per-request headers do take effect.
  getActiveMock()
    .scope('https://abc123.api.sanity.io')
    .on('GET', '/v1/data/query/foo?query=request-test&returnQuery=false', {
      headers: {
        Authorization: 'Bearer request-token',
        'X-Custom-Header': 'request-value',
      },
    })
    .respond({status: 200, body: {result: []}})

  await expect(client.fetch('auth-test')).resolves.not.toThrow()
  await expect(
    client.fetch(
      'request-test',
      {},
      {
        headers: {
          Authorization: 'Bearer request-token',
          'X-Custom-Header': 'request-value',
        },
      },
    ),
  ).resolves.not.toThrow()
})

test('headers can be reconfigured', async () => {
  const client = createClient({
    projectId: 'abc123',
    dataset: 'foo',
    useCdn: false,
    headers: {
      'X-Custom-Header': 'mutation-test',
    },
  })

  getActiveMock()
    .scope('https://abc123.api.sanity.io')
    .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync')
    .respond({
      status: 200,
      body: {transactionId: 'abc123', results: [{id: 'doc123', operation: 'create'}]},
    })

  await expect(client.create({_type: 'test', title: 'Test Document'})).resolves.not.toThrow()

  client.config({
    headers: {
      'X-Custom-Header': 'new-value',
    },
  })

  getActiveMock()
    .scope('https://abc123.api.sanity.io')
    .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
    .respond({status: 200, body: {result: []}})

  await expect(client.fetch('*')).resolves.not.toThrow()

  client.config({
    headers: {},
  })

  getActiveMock()
    .scope('https://abc123.api.sanity.io')
    .on('GET', '/v1/data/query/foo?query=empty-test&returnQuery=false')
    .respond({status: 200, body: {result: []}})

  await expect(client.fetch('empty-test')).resolves.not.toThrow()

  const [mutateReq, fetchReq, emptyReq] = getActiveMock().getRequests()
  expect(mutateReq).toHaveHeader('X-Custom-Header', 'mutation-test')
  expect(fetchReq).toHaveHeader('X-Custom-Header', 'new-value')
  expect(emptyReq.headers.get('X-Custom-Header'), 'header must be dropped').toBeNull()
})

test('will use live API if withCredentials is set to true', async () => {
  const client = createClient({
    withCredentials: true,
    projectId: 'abc123',
    dataset: 'foo',
    useCdn: true,
  })

  getActiveMock()
    .scope('https://abc123.api.sanity.io')
    .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
    .respond({status: 200, body: {result: []}})

  await expect(client.fetch('*')).resolves.not.toThrow()
})
