import {Transaction} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {getActiveMock} from '../helpers/mockFetch'
import {getClient, projectHost} from './helpers'

describe('transactions', () => {
  test('can build and serialize a transaction of operations', () => {
    const trans = getClient()
      .transaction()
      .create({_id: 'moofoo', _type: 'document', name: 'foobar'})
      .delete('nznjkAJnjgnk')
      .serialize()

    expect(trans).toEqual([
      {create: {_id: 'moofoo', _type: 'document', name: 'foobar'}},
      {delete: {id: 'nznjkAJnjgnk'}},
    ])
  })

  test('each transaction operation mutates transaction', () => {
    const trans = getClient().transaction()
    const create = trans.create({_type: 'document', count: 1})
    const combined = create.delete('foobar')

    expect(trans, 'should be mutated').toEqual(create)
    expect(create, 'should be mutated').toEqual(combined)

    expect(
      combined.serialize(),
      'combined transaction should have both create and delete ops',
    ).toEqual([{create: {_type: 'document', count: 1}}, {delete: {id: 'foobar'}}])
  })

  test('transaction methods are chainable', () => {
    const trans = getClient()
      .transaction()
      .create({_type: 'nostalgia', moo: 'tools'})
      .createIfNotExists({_id: 'someId', _type: 'nostalgia', j: 'query'})
      .createOrReplace({_id: 'someOtherId', _type: 'nostalgia', do: 'jo'})
      .delete('prototype')
      .patch('foobar', {inc: {sales: 1}})

    expect(trans.serialize()).toEqual([
      {
        create: {
          _type: 'nostalgia',
          moo: 'tools',
        },
      },
      {
        createIfNotExists: {
          _id: 'someId',
          _type: 'nostalgia',
          j: 'query',
        },
      },
      {
        createOrReplace: {
          _id: 'someOtherId',
          _type: 'nostalgia',
          do: 'jo',
        },
      },
      {
        delete: {
          id: 'prototype',
        },
      },
      {
        patch: {
          id: 'foobar',
          inc: {sales: 1},
        },
      },
    ])

    expect(trans.reset().serialize().length, 'resets to 0 operations').toEqual(0)
  })

  test('patches can be built with callback', () => {
    const trans = getClient()
      .transaction()
      .patch('moofoo', (p) => p.inc({sales: 1}).dec({stock: 1}))
      .serialize()

    expect(trans).toEqual([
      {
        patch: {
          id: 'moofoo',
          inc: {sales: 1},
          dec: {stock: 1},
        },
      },
    ])
  })

  test('throws if patch builder does not return patch', () => {
    expect(() =>
      getClient()
        .transaction()
        .patch('moofoo', (() => {
          /* intentional noop */
        }) as any),
    ).toThrow(/must return the patch/)
  })

  test('patch can take an existing patch', () => {
    const client = getClient()
    const incPatch = client.patch('bar').inc({sales: 1})
    const trans = getClient().transaction().patch(incPatch).serialize()

    expect(trans).toEqual([
      {
        patch: {
          id: 'bar',
          inc: {sales: 1},
        },
      },
    ])
  })

  test('patch can use a mutation selector', () => {
    const transaction = getClient()
      .transaction()
      .patch(
        {
          query: '*[_id in $ids]',
          params: {ids: ['abc123', 'foo.456']},
        },
        {inc: {count: 1}},
      )

    expect(transaction.serialize()).toEqual([
      {
        patch: {
          query: '*[_id in $ids]',
          params: {ids: ['abc123', 'foo.456']},
          inc: {count: 1},
        },
      },
    ])

    const transactionWithCallback = getClient()
      .transaction()
      .patch(
        {
          query: '*[_id in $ids]',
          params: {ids: ['abc123', 'foo.456']},
        },
        (p) => p.inc({count: 1}),
      )

    expect(transactionWithCallback.serialize()).toEqual([
      {
        patch: {
          query: '*[_id in $ids]',
          params: {ids: ['abc123', 'foo.456']},
          inc: {count: 1},
        },
      },
    ])
  })

  test('executes transaction when commit() is called', async () => {
    const mutations = [{create: {_type: 'foo', bar: true}}, {delete: {id: 'barfoo'}}]
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&visibility=sync', {body: {mutations}})
      .respond({status: 200, body: {transactionId: 'blatti'}})

    const res = await getClient()
      .transaction()
      .create({_type: 'foo', bar: true})
      .delete('barfoo')
      .commit()
    expect(res.transactionId, 'applies given transaction').toEqual('blatti')
  })

  test('executes transaction with request tag when commit() is called with tag', async () => {
    const mutations = [{create: {_type: 'bar', name: 'Toronado'}}]
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?tag=sfcraft.createbar&returnIds=true&visibility=sync', {
        body: {
          mutations,
        },
      })
      .respond({status: 200, body: {transactionId: 'blatti'}})

    const res = await getClient()
      .transaction()
      .create({_type: 'bar', name: 'Toronado'})
      .commit({tag: 'sfcraft.createbar'})
    expect(res.transactionId, 'applies given transaction').toEqual('blatti')
  })

  test('throws when passing incorrect input to transaction operations', () => {
    const trans = getClient().transaction()
    expect(() => trans.create('foo' as any), 'throws on create()').toThrow(/object of prop/)
    expect(() => trans.createIfNotExists('foo' as any), 'throws on createIfNotExists()').toThrow(
      /object of prop/,
    )
    expect(() => trans.createOrReplace('foo' as any), 'throws on createOrReplace()').toThrow(
      /object of prop/,
    )
    expect(() => trans.delete({id: 'moofoo'} as any), 'throws on delete()').toThrow(
      /not a valid document ID/,
    )
  })

  test('throws when not including document ID in createOrReplace/createIfNotExists in transaction', () => {
    const trans = getClient().transaction()
    expect(
      () => trans.createIfNotExists({_type: 'movie', a: 1} as any),
      'throws on createIfNotExists()',
    ).toThrow(/contains an ID/)
    expect(
      () => trans.createOrReplace({_type: 'movie', a: 1} as any),
      'throws on createOrReplace()',
    ).toThrow(/contains an ID/)
  })

  test('can manually call clone on transaction', () => {
    const trans1 = getClient().transaction().delete('foo.bar')
    const trans2 = trans1.clone()

    expect(trans1, 'actually cloned').not.toBe(trans2)
    expect(trans1.serialize(), 'serialized to the same').toEqual(trans2.serialize())
  })

  test('transaction has toJSON() which serializes patch', () => {
    const trans = getClient().transaction().create({_type: 'document', count: 1})
    expect(JSON.parse(JSON.stringify(trans))).toEqual(
      JSON.parse(JSON.stringify([{create: {_type: 'document', count: 1}}])),
    )
  })

  test('Transaction is available on client and can be used without instantiated client', () => {
    const trans = new Transaction()
    expect(trans.delete('barfoo').serialize(), 'transaction should work without context').toEqual([
      {delete: {id: 'barfoo'}},
    ])
  })

  test('transaction can be created without client and passed to mutate()', async () => {
    const trx = new Transaction()
    trx.delete('foo')

    const mutations = [{delete: {id: 'foo'}}]
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: {
          mutations,
        },
      })
      .respond({status: 200, body: {results: [{id: 'foo', operation: 'delete'}]}})

    await expect(getClient().mutate(trx)).resolves.not.toThrow()
  })

  test('transaction commit() throws if called without a client', () => {
    const trans = new Transaction()
    expect(() => trans.delete('foo.bar').commit()).toThrow(/client.*mutate/i)
  })

  test('transaction can be given an explicit transaction ID', async () => {
    const transactionId = 'moop'
    const mutations = [{create: {_type: 'foo', bar: true}}, {delete: {id: 'barfoo'}}]
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&visibility=sync', {
        body: {mutations, transactionId},
      })
      .respond({status: 200, body: {transactionId}})

    const res = await getClient()
      .transaction()
      .create({_type: 'foo', bar: true})
      .delete('barfoo')
      .transactionId(transactionId)
      .commit()
    expect(res.transactionId, 'applies given transaction').toEqual(transactionId)
  })
})
