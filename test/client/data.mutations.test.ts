import {
  type BaseActionOptions,
  type CreateAction,
  type DeleteAction,
  type DiscardAction,
  type EditAction,
  type PublishAction,
  type ReplaceDraftAction,
  type UnpublishAction,
} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {getActiveMock} from '../helpers/mockFetch'
import {getClient, projectHost} from './helpers'

describe('mutations', () => {
  test('can create documents', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: {
          mutations: [{create: doc}],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
          results: [
            {
              document: {_id: 'abc123', _createdAt: '2016-10-24T08:09:32.997Z', name: 'Raptor'},
              operation: 'create',
            },
          ],
        },
      })

    const res = await getClient().create(doc)
    expect(res._id, 'document id returned').toBe(doc._id)
    expect(res._createdAt, 'server-generated attributes are included').toBeTruthy()
  })

  test('can create documents without specifying ID', async () => {
    const doc = {_type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{create: {...doc}}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({
        status: 200,
        body: {
          transactionId: '123abc',
          results: [
            {
              id: 'abc456',
              document: {_id: 'abc456', name: 'Raptor'},
            },
          ],
        },
      })

    const res = await getClient().create(doc)
    expect(res._id, 'document id returned').toBe('abc456')
  })

  test('can create documents with request tag', async () => {
    const doc = {_type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{create: {...doc}}]}
    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?tag=dino.import&returnIds=true&returnDocuments=true&visibility=sync',
        {body: expectedBody},
      )
      .respond({
        status: 200,
        body: {
          transactionId: '123abc',
          results: [
            {
              id: 'abc456',
              document: {_id: 'abc456', name: 'Raptor'},
            },
          ],
        },
      })

    const res = await getClient().create(doc, {tag: 'dino.import'})
    expect(res._id, 'document id returned').toBe('abc456')
  })

  test('can tell create() not to return documents', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&visibility=sync', {
        body: {mutations: [{create: doc}]},
      })
      .respond({
        status: 200,
        body: {transactionId: 'abc123', results: [{id: 'abc123', operation: 'create'}]},
      })

    const res = await getClient().create(doc, {returnDocuments: false})
    expect(res.transactionId, 'returns transaction ID').toEqual('abc123')
    expect(res.documentId, 'returns document id').toEqual('abc123')
  })

  test('can tell create() to use non-default visibility mode', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=async', {
        body: {
          mutations: [{create: doc}],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
          results: [{id: 'abc123', document: doc, operation: 'create'}],
        },
      })

    const res = await getClient().create(doc, {visibility: 'async'})
    expect(res._id, 'document id returned').toEqual('abc123')
  })

  test('can tell create() to auto-generate array keys', async () => {
    const doc = {
      _id: 'abc123',
      _type: 'post',
      name: 'Dromaeosauridae',
      genus: [{_type: 'dino', name: 'Velociraptor'}],
    }
    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&autoGenerateArrayKeys=true&visibility=sync',
        {
          body: {
            mutations: [{create: doc}],
          },
        },
      )
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
          results: [
            {
              id: 'abc123',
              document: {...doc, genus: [{...doc.genus[0], _key: 'r4p70r'}]},
              operation: 'create',
            },
          ],
        },
      })

    const res = await getClient().create(doc, {autoGenerateArrayKeys: true})
    expect(res._id, 'document id returned').toEqual('abc123')
    // typings don't support the implicit `_key` on arrays, yet
    expect((res.genus[0] as any)._key, 'array keys generated returned').toEqual('r4p70r')
  })

  test('can tell create() to do a dry-run', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Dromaeosauridae'}
    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?dryRun=true&returnIds=true&returnDocuments=true&visibility=sync',
        {
          body: {
            mutations: [{create: doc}],
          },
        },
      )
      .respond({
        status: 200,
        body: {
          transactionId: 'abc123',
          results: [
            {
              id: 'abc123',
              document: doc,
              operation: 'create',
            },
          ],
        },
      })

    const res = await getClient().create(doc, {dryRun: true})
    expect(res._id, 'document id returned').toEqual('abc123')
  })

  test('createIfNotExists() sends correct mutation', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{createIfNotExists: doc}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({
        status: 200,
        body: {
          transactionId: '123abc',
          results: [{id: 'abc123', document: doc, operation: 'create'}],
        },
      })

    await expect(getClient().createIfNotExists(doc)).resolves.not.toThrow()
  })

  test('can tell createIfNotExists() not to return documents', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{createIfNotExists: doc}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&visibility=sync', {body: expectedBody})
      .respond({
        status: 200,
        body: {transactionId: 'abc123', results: [{id: 'abc123', operation: 'create'}]},
      })

    const res = await getClient().createIfNotExists(doc, {returnDocuments: false})
    expect(res.transactionId, 'returns transaction ID').toEqual('abc123')
    expect(res.documentId, 'returns document id').toEqual('abc123')
  })

  test('can use request tag with createIfNotExists()', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{createIfNotExists: doc}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?tag=mysync&returnIds=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({
        status: 200,
        body: {transactionId: 'abc123', results: [{id: 'abc123', operation: 'create'}]},
      })

    const res = await getClient().createIfNotExists(doc, {
      returnDocuments: false,
      tag: 'mysync',
    })
    expect(res.transactionId, 'returns transaction ID').toEqual('abc123')
    expect(res.documentId, 'returns document id').toEqual('abc123')
  })

  test('createOrReplace() sends correct mutation', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{createOrReplace: doc}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({
        status: 200,
        body: {transactionId: '123abc', results: [{id: 'abc123', operation: 'create'}]},
      })

    await expect(getClient().createOrReplace(doc)).resolves.not.toThrow()
  })

  test('can tell createOrReplace() not to return documents', async () => {
    const doc = {_id: 'abc123', _type: 'post', name: 'Raptor'}
    const expectedBody = {mutations: [{createOrReplace: doc}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&visibility=sync', {body: expectedBody})
      .respond({
        status: 200,
        body: {transactionId: 'abc123', results: [{id: 'abc123', operation: 'create'}]},
      })

    const res = await getClient().createOrReplace(doc, {returnDocuments: false})
    expect(res.transactionId, 'returns transaction ID').toEqual('abc123')
    expect(res.documentId, 'returns document id').toEqual('abc123')
  })

  test('delete() sends correct mutation', async () => {
    const expectedBody = {mutations: [{delete: {id: 'abc123'}}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({
        status: 200,
        body: {transactionId: 'abc123', results: [{id: 'abc123', operation: 'delete'}]},
      })

    await expect(getClient().delete('abc123')).resolves.not.toThrow()
  })

  test('delete() can use query', async () => {
    const expectedBody = {mutations: [{delete: {query: 'foo.sometype'}}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({status: 200, body: {transactionId: 'abc123'}})

    await expect(getClient().delete({query: 'foo.sometype'})).resolves.not.toThrow()
  })

  test('delete() can use request tag', async () => {
    const expectedBody = {mutations: [{delete: {id: 'abc123'}}]}
    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?tag=delete.abc&returnIds=true&returnDocuments=true&visibility=sync',
        {body: expectedBody},
      )
      .respond({
        status: 200,
        body: {transactionId: 'abc123', results: [{id: 'abc123', operation: 'delete'}]},
      })

    await expect(getClient().delete('abc123', {tag: 'delete.abc'})).resolves.not.toThrow()
  })

  test('delete() can use query with params', async () => {
    const query = '*[_type == "beer" && title == $beerName]'
    const params = {beerName: 'Headroom Double IPA'}
    const expectedBody = {mutations: [{delete: {query, params: params}}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({status: 200, body: {transactionId: 'abc123'}})

    await expect(getClient().delete({query, params: params})).resolves.not.toThrow()
  })

  test('delete() can be told not to return documents', async () => {
    const expectedBody = {mutations: [{delete: {id: 'abc123'}}]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&visibility=sync', {body: expectedBody})
      .respond({
        status: 200,
        body: {transactionId: 'abc123', results: [{id: 'abc123', operation: 'delete'}]},
      })

    await expect(getClient().delete('abc123', {returnDocuments: false})).resolves.not.toThrow()
  })

  test('mutate() accepts multiple mutations', async () => {
    const docs = [
      {
        _id: 'movies.raiders-of-the-lost-ark',
        _type: 'movie',
        title: 'Raiders of the Lost Ark',
        year: 1981,
      },
      {
        _id: 'movies.the-phantom-menace',
        _type: 'movie',
        title: 'Star Wars: Episode I - The Phantom Menace',
        year: 1999,
      },
    ]

    const mutations = [{create: docs[0]}, {delete: {id: 'movies.the-phantom-menace'}}]

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: {
          mutations,
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
          results: [
            {id: 'movies.raiders-of-the-lost-ark', operation: 'create', document: docs[0]},
            {id: 'movies.the-phantom-menace', operation: 'delete', document: docs[1]},
          ],
        },
      })

    await expect(getClient().mutate(mutations)).resolves.not.toThrow()
  })

  test('mutate() accepts request tag', async () => {
    const mutations = [{delete: {id: 'abc123'}}]

    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?tag=foobar&returnIds=true&returnDocuments=true&visibility=sync',
        {
          body: {
            mutations,
          },
        },
      )
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'delete', document: {_id: 'abc123'}}],
        },
      })

    await expect(getClient().mutate(mutations, {tag: 'foobar'})).resolves.not.toThrow()
  })

  test('mutate() accepts transaction id', async () => {
    const mutations = [{delete: {id: 'abc123'}}]

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: {
          mutations,
          transactionId: 'spec-ific',
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'spec-ific',
          results: [{id: 'abc123', operation: 'delete', document: {_id: 'abc123'}}],
        },
      })

    await expect(getClient().mutate(mutations, {transactionId: 'spec-ific'})).resolves.not.toThrow()
  })

  test('mutate() accepts `autoGenerateArrayKeys`', async () => {
    const mutations = [
      {
        create: {
          _id: 'abc123',
          _type: 'post',
          items: [{_type: 'block', children: [{_type: 'span', text: 'Hello there'}]}],
        },
      },
    ]

    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync&autoGenerateArrayKeys=true',
        {body: {mutations}},
      )
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'create', document: {_id: 'abc123'}}],
        },
      })

    await expect(
      getClient().mutate(mutations, {autoGenerateArrayKeys: true}),
    ).resolves.not.toThrow()
  })

  test('mutate() accepts `dryRun`', async () => {
    const mutations = [{create: {_id: 'abc123', _type: 'post'}}]

    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?dryRun=true&returnIds=true&returnDocuments=true&visibility=sync',
        {
          body: {
            mutations,
          },
        },
      )
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'create', document: {_id: 'abc123'}}],
        },
      })

    await expect(getClient().mutate(mutations, {dryRun: true})).resolves.not.toThrow()
  })

  test('mutate() accepts `skipCrossDatasetReferenceValidation`', async () => {
    const mutations = [{delete: {id: 'abc123'}}]

    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?tag=foobar&returnIds=true&returnDocuments=true&visibility=sync&skipCrossDatasetReferenceValidation=true',
        {body: {mutations}},
      )
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'delete', document: {_id: 'abc123'}}],
        },
      })

    await expect(
      getClient().mutate(mutations, {tag: 'foobar', skipCrossDatasetReferenceValidation: true}),
    ).resolves.not.toThrow()
  })

  test('mutate() skips/falls back to defaults on undefined but known properties', async () => {
    const mutations = [{delete: {id: 'abc123'}}]

    getActiveMock()
      .scope(projectHost())
      .on(
        'POST',
        '/v1/data/mutate/foo?tag=foobar&returnIds=true&returnDocuments=true&visibility=sync',
        {
          body: {
            mutations,
          },
        },
      )
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
          results: [{id: 'abc123', operation: 'delete', document: {_id: 'abc123'}}],
        },
      })

    await expect(
      getClient().mutate(mutations, {
        tag: 'foobar',
        skipCrossDatasetReferenceValidation: undefined,
        returnDocuments: undefined,
        autoGenerateArrayKeys: undefined,
      }),
    ).resolves.not.toThrow()
  })

  test('action() performs single operation', async () => {
    const action: CreateAction = {
      actionType: 'sanity.action.document.create',
      publishedId: 'post1',
      attributes: {_id: 'post1', _type: 'post'},
      ifExists: 'fail',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [action],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
        },
      })

    await expect(getClient().action(action)).resolves.not.toThrow()
  })

  test('action() performs multiple operations', async () => {
    const action1: CreateAction = {
      actionType: 'sanity.action.document.create',
      publishedId: 'post1',
      attributes: {_id: 'post1', _type: 'post'},
      ifExists: 'fail',
    }

    const action2: ReplaceDraftAction = {
      actionType: 'sanity.action.document.replaceDraft',
      publishedId: 'post2',
      attributes: {_id: 'post2', _type: 'post'},
    }

    const action3: EditAction = {
      actionType: 'sanity.action.document.edit',
      draftId: 'drafts.post3',
      publishedId: 'post3',
      patch: {
        set: {count: 1},
      },
    }

    const action4: DeleteAction = {
      actionType: 'sanity.action.document.delete',
      publishedId: 'post4',
      includeDrafts: ['drafts.post4'],
      purge: true,
    }

    const action5: DiscardAction = {
      actionType: 'sanity.action.document.discard',
      draftId: 'drafts.post5',
      purge: true,
    }

    const action6: PublishAction = {
      actionType: 'sanity.action.document.publish',
      draftId: 'drafts.post6',
      ifDraftRevisionId: 'rev7',
      publishedId: 'post6',
      ifPublishedRevisionId: 'rev6',
    }

    const action7: UnpublishAction = {
      actionType: 'sanity.action.document.unpublish',
      draftId: 'drafts.post7',
      publishedId: 'post7',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [action1, action2, action3, action4, action5, action6, action7],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
        },
      })

    await expect(
      getClient().action([action1, action2, action3, action4, action5, action6, action7]),
    ).resolves.not.toThrow()
  })

  test('action() accepts optional parameters', async () => {
    const action: CreateAction = {
      actionType: 'sanity.action.document.create',
      publishedId: 'post1',
      attributes: {_id: 'post1', _type: 'post'},
      ifExists: 'fail',
    }

    const options: BaseActionOptions = {
      transactionId: 'txn1',
      skipCrossDatasetReferenceValidation: true,
      dryRun: true,
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [action],
          transactionId: 'txn1',
          skipCrossDatasetReferenceValidation: true,
          dryRun: true,
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'txn1',
        },
      })

    await expect(getClient().action(action, options)).resolves.not.toThrow()
  })

  test('action() handles undefined optional parameters gracefully', async () => {
    const action: CreateAction = {
      actionType: 'sanity.action.document.create',
      publishedId: 'post1',
      attributes: {_id: 'post1', _type: 'post'},
      ifExists: 'fail',
    }

    const options: BaseActionOptions = {
      transactionId: undefined,
      skipCrossDatasetReferenceValidation: undefined,
      dryRun: undefined,
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/actions/foo', {
        body: {
          actions: [action],
        },
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'foo',
        },
      })

    await expect(getClient().action(action, options)).resolves.not.toThrow()
  })
})
