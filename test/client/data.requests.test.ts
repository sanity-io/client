import {type ContentSourceMap} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {anyValue, getActiveMock, objectContaining} from '../helpers/mockFetch'
import {createClient, getClient, isEdge, projectHost} from './helpers'

describe('query construction', () => {
  const result = [{_id: 'njgNkngskjg', rating: 5}]
  const resultSourceMap = {
    documents: [
      {
        _id: 'njgNkngskjg',
        _type: 'beer',
      },
    ],
    paths: ["$['_id']", "$['rating']"],
    mappings: {
      "$[0]['_id']": {
        source: {
          document: 0,
          path: 0,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$[0]['rating']": {
        source: {
          document: 0,
          path: 1,
          type: 'documentValue',
        },
        type: 'value',
      },
    },
  } satisfies ContentSourceMap

  test.skipIf(isEdge)('uses GET for queries below limit', async () => {
    // Please dont ever do this. Just... don't.
    const clause: string[] = []
    const qParams: Record<string, string> = {}
    const params: Record<string, string> = {}
    for (let i = 1950; i <= 2016; i++) {
      clause.push(`title == $beerName${i}`)
      params[`beerName${i}`] = `some beer ${i}`
      qParams[`$beerName${i}`] = JSON.stringify(`some beer ${i}`)
    }

    // Again, just... don't do this.
    const query = `*[_type == "beer" && (${clause.join(' || ')})]`

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo', {
        query: objectContaining({query, ...qParams, returnQuery: 'false'}),
      })
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const res = await getClient().fetch(query, params)
    expect(res.length, 'length should match').toEqual(1)
    expect(res[0].rating, 'data should match').toEqual(5)
  })

  test.skipIf(isEdge)('uses POST for long queries', async () => {
    // Please dont ever do this. Just... don't.
    const clause: string[] = []
    const params: Record<string, string> = {}
    for (let i = 1766; i <= 2016; i++) {
      clause.push(`title == $beerName${i}`)
      params[`beerName${i}`] = `some beer ${i}`
    }

    // Again, just... don't do this.
    const query = `*[_type == "beer" && (${clause.join(' || ')})]`

    const expectedBody = {query, params}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/query/foo?returnQuery=false', {body: expectedBody})
      .respond({
        status: 200,
        body: {
          ms: 123,
          query,
          result,
        },
      })

    const res = await getClient().fetch(query, params)
    expect(res.length, 'length should match').toEqual(1)
    expect(res[0].rating, 'data should match').toEqual(5)
  })

  test.skipIf(isEdge).each([429, 502, 503])('retries %d even if they are POST', async (code) => {
    // Please dont ever do this. Just... don't.
    const clause: string[] = []
    const params: Record<string, string> = {}
    for (let i = 1766; i <= 2016; i++) {
      clause.push(`title == $beerName${i}`)
      params[`beerName${i}`] = `some beer ${i}`
    }

    // Again, just... don't do this.
    const query = `*[_type == "beer" && (${clause.join(' || ')})]`
    const expectedBody = {query, params}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/query/foo?returnQuery=false', {body: expectedBody})
      .respond({status: code, body: {}})
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const res = await getClient().fetch(query, params)
    expect(res.length, 'length should match').toEqual(1)
    expect(res[0].rating, 'data should match').toEqual(5)
  })

  test.skipIf(isEdge)(
    'uses POST for long queries, but puts request tag as query param',
    async () => {
      const clause: string[] = []
      const params: Record<string, string> = {}
      for (let i = 1766; i <= 2016; i++) {
        clause.push(`title == $beerName${i}`)
        params[`beerName${i}`] = `some beer ${i}`
      }

      // Again, just... don't do this.
      const query = `*[_type == "beer" && (${clause.join(' || ')})]`
      const expectedBody = {query, params}

      getActiveMock()
        .scope(projectHost())
        .on('POST', '/v1/data/query/foo?tag=myapp.silly-query&returnQuery=false', {
          body: expectedBody,
        })
        .respond({
          status: 200,
          body: {
            ms: 123,
            query,
            result,
          },
        })

      const res = await getClient().fetch(query, params, {tag: 'myapp.silly-query'})
      expect(res.length, 'length should match').toEqual(1)
      expect(res[0].rating, 'data should match').toEqual(5)
    },
  )

  test.skipIf(isEdge)(
    'uses POST for long queries, but puts resultSourceMap and perspective as query params',
    async () => {
      const clause: string[] = []
      const params: Record<string, string> = {}
      for (let i = 1766; i <= 2016; i++) {
        clause.push(`title == $beerName${i}`)
        params[`beerName${i}`] = `some beer ${i}`
      }

      // Again, just... don't do this.
      const query = `*[_type == "beer" && (${clause.join(' || ')})]`
      const expectedBody = {query, params}

      getActiveMock()
        .scope(projectHost())
        .on(
          'POST',
          '/vX/data/query/foo?resultSourceMap=true&perspective=previewDrafts&returnQuery=false',
          {body: expectedBody},
        )
        .respond({
          status: 200,
          body: {
            ms: 123,
            query,
            result,
            resultSourceMap,
          },
        })

      const client = getClient({
        apiVersion: 'X',
        perspective: 'previewDrafts',
        resultSourceMap: true,
      })
      const res = await client.fetch(query, params)
      expect(res.length, 'length should match').toEqual(1)
      expect(res[0].rating, 'data should match').toEqual(5)
    },
  )

  test.skipIf(isEdge)('uses POST for long queries also towards CDN', async () => {
    const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})

    const clause: string[] = []
    const params: Record<string, string> = {}
    for (let i = 1766; i <= 2016; i++) {
      clause.push(`title == $beerName${i}`)
      params[`beerName${i}`] = `some beer ${i}`
    }

    const query = `*[_type == "beer" && (${clause.join(' || ')})]`
    //const expectedBody = {query, params}

    getActiveMock()
      .scope('https://abc123.apicdn.sanity.io')
      .on('POST', '/v1/data/query/foo?returnQuery=false', {body: anyValue()})
      .respond({
        status: 200,
        body: {
          ms: 123,
          query,
          result,
        },
      })

    const res = await client.fetch(query, params)
    expect(res.length, 'length should match').toEqual(1)
    expect(res[0].rating, 'data should match').toEqual(5)
  })
})
describe.skipIf(isEdge)('createVersion()', () => {
  test('can create version of a document with publishedId', async () => {
    const document = {_type: 'post', title: 'Draft version'}
    const publishedId = 'pub123'
    const expectedVersionId = `drafts.${publishedId}`

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.create',
              publishedId,
              document: {...document, _id: expectedVersionId},
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

    const res = await getClient().createVersion({document, publishedId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can create version of a document with releaseId', async () => {
    const document = {_type: 'post', title: 'Release version'}
    const publishedId = 'pub123'
    const releaseId = 'release456'
    const expectedVersionId = `versions.${releaseId}.${publishedId}`

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.create',
              publishedId,
              document: {...document, _id: expectedVersionId},
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

    const res = await getClient().createVersion({document, publishedId, releaseId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can create version with additional options', async () => {
    const document = {_type: 'post', title: 'With options'}
    const publishedId = 'pub123'
    const expectedVersionId = `drafts.${publishedId}`
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
              actionType: 'sanity.action.document.version.create',
              publishedId,
              document: {...document, _id: expectedVersionId},
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

    const res = await getClient().createVersion({document, publishedId}, options)
    expect(res.transactionId).toEqual('abc123')
  })

  test('handles errors when creating versions', async () => {
    const document = {_type: 'post', title: 'Error test'}
    const publishedId = 'pub123'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo')
      .respondWithError(new Error('Network error occurred'))

    await expect(getClient().createVersion({document, publishedId})).rejects.toThrowError()
  })

  test('throws when creating version of a document that is missing _type', async () => {
    const document = {title: 'Missing type'} as any
    const publishedId = 'pub123'

    let error: Error | null = null
    try {
      await getClient().createVersion({document, publishedId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch('`createVersion()` requires that the document contains a type')
  })

  test('throws when draft document ID does not match generated version ID', async () => {
    const document = {_id: 'drafts.wrongId123', _type: 'post', title: 'Mismatch draft'}
    const publishedId = 'pub123'
    // This will generate drafts.pub123 which doesn't match document._id

    let error: Error | null = null
    try {
      await getClient().createVersion({document, publishedId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      'The provided document ID (`drafts.wrongId123`) does not match the generated version ID (`drafts.pub123`)',
    )
  })

  test('throws when version document ID does not match generated version ID', async () => {
    const document = {
      _id: 'versions.wrongRelease.wrongId123',
      _type: 'post',
      title: 'Mismatch draft',
    }
    const publishedId = 'pub123'
    const releaseId = 'release456'
    // This will generate versions.release456.pub123 which doesn't match document._id

    let error: Error | null = null
    try {
      await getClient().createVersion({document, publishedId, releaseId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      'The provided document ID (`versions.wrongRelease.wrongId123`) does not match the generated version ID (`versions.release456.pub123`)',
    )
  })

  test('throws when neither publishedId nor document._id are provided', async () => {
    // no _id passed in document
    const document = {_type: 'post', title: 'No ID'}

    let error: Error | null = null
    try {
      await getClient().createVersion({document, publishedId: undefined as any})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`createVersion()` requires either a publishedId or a document with an `_id`',
    )
  })

  test('throws when a releaseId is provided without a publishedId', async () => {
    const document = {_type: 'post', title: 'Release without published'}
    // Providing releaseId but no publishedId
    const releaseId = 'release456'

    let error: Error | null = null
    try {
      await getClient().createVersion({document, releaseId, publishedId: undefined as any})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`createVersion()` requires either a publishedId or a document with an `_id`',
    )
  })

  test('can create version using only document._id', async () => {
    const documentId = 'drafts.existing123'
    const document = {_id: documentId, _type: 'post', title: 'Only document ID'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.create',
              publishedId: 'existing123',
              document: {...document, _id: documentId},
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

    const res = await getClient().createVersion({document})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can derive publishedId from a draft document ID', async () => {
    const documentId = 'drafts.post123'
    const expectedPublishedId = 'post123'
    const document = {_id: documentId, _type: 'post', title: 'Draft document'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.create',
              publishedId: expectedPublishedId,
              document: {...document, _id: documentId},
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

    const res = await getClient().createVersion({document})
    expect(res.transactionId).toEqual('abc123')
  })

  test('throws when document._id is provided but is not a version ID or draft ID', async () => {
    const document = {
      _id: 'regularId123',
      _type: 'post',
      title: 'Regular ID',
    }

    let error: Error | null = null
    try {
      await getClient().createVersion({document})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`createVersion()` requires a document with an `_id` that is a version or draft ID',
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
      await getClient().createVersion({document, releaseId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      `\`createVersion()\` was called with a document ID (\`${documentId}\`) that is a draft ID, but a release ID (\`${releaseId}\`) was also provided.`,
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
      await getClient().createVersion({document, releaseId})
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      `\`createVersion()\` was called with a document ID (\`${versionId}\`) that is a version ID, but the release ID (\`${releaseId}\`) does not match the document's version ID (\`${wrongReleaseId}\`).`,
    )
  })

  test('can create version using baseId and releaseId', async () => {
    const baseId = 'baseDoc123'
    const releaseId = 'release456'
    const publishedId = 'targetDoc123'
    const expectedVersionId = 'versions.release456.targetDoc123'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.create',
              publishedId,
              baseId,
              versionId: expectedVersionId,
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

    const res = await getClient().createVersion({baseId, releaseId, publishedId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('can create version using baseId and releaseId with ifBaseRevisionId', async () => {
    const baseId = 'baseDoc123'
    const releaseId = 'release456'
    const publishedId = 'targetDoc123'
    const ifBaseRevisionId = 'rev456'
    const expectedVersionId = 'versions.release456.targetDoc123'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.create',
              publishedId,
              baseId,
              versionId: expectedVersionId,
              ifBaseRevisionId,
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

    const res = await getClient().createVersion({
      baseId,
      releaseId,
      publishedId,
      ifBaseRevisionId,
    })
    expect(res.transactionId).toEqual('abc123')
  })

  test('can create version using baseId with additional options', async () => {
    const baseId = 'baseDoc123'
    const releaseId = 'release456'
    const publishedId = 'targetDoc123'
    const expectedVersionId = 'versions.release456.targetDoc123'
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
              actionType: 'sanity.action.document.version.create',
              publishedId,
              baseId,
              versionId: expectedVersionId,
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

    const res = await getClient().createVersion({baseId, releaseId, publishedId}, options)
    expect(res.transactionId).toEqual('abc123')
  })

  test('throws when neither document nor baseId are provided', async () => {
    let error: Error | null = null
    try {
      await getClient().createVersion({} as any)
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`createVersion()` requires `baseId` when no `document` is provided',
    )
  })

  test('creates draft version when baseId is provided but releaseId is missing', async () => {
    const baseId = 'baseDoc123'
    const publishedId = 'targetDoc123'
    const expectedVersionId = 'drafts.targetDoc123'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [
            {
              actionType: 'sanity.action.document.version.create',
              publishedId,
              baseId,
              versionId: expectedVersionId,
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

    const res = await getClient().createVersion({baseId, publishedId})
    expect(res.transactionId).toEqual('abc123')
  })

  test('throws when baseId is provided but publishedId is missing', async () => {
    const baseId = 'baseDoc123'
    const releaseId = 'release456'

    let error: Error | null = null
    try {
      await getClient().createVersion({baseId, releaseId} as any)
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`createVersion()` requires `publishedId` when `baseId` is provided',
    )
  })

  test('throws when releaseId is provided but baseId is missing', async () => {
    const releaseId = 'release456'
    const publishedId = 'targetDoc123'

    let error: Error | null = null
    try {
      await getClient().createVersion({releaseId, publishedId} as any)
    } catch (err) {
      error = err as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      '`createVersion()` requires `baseId` when no `document` is provided',
    )
  })

  test('handles errors when creating versions using baseId', async () => {
    const baseId = 'baseDoc123'
    const releaseId = 'release456'
    const publishedId = 'targetDoc123'

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo')
      .respondWithError(new Error('Network error occurred'))

    await expect(getClient().createVersion({baseId, releaseId, publishedId})).rejects.toThrowError()
  })
})
