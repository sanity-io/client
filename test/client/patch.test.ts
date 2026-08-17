import {Patch} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {getActiveMock} from '../helpers/mockFetch'
import {getClient, projectHost} from './helpers'

describe('patch ops', () => {
  test('can build and serialize a patch of operations', () => {
    const patch = getClient().patch('abc123').inc({count: 1}).set({brownEyes: true}).serialize()

    expect(patch).toEqual({id: 'abc123', inc: {count: 1}, set: {brownEyes: true}})
  })

  test('patch() can take an array of IDs', () => {
    const patch = getClient().patch(['abc123', 'foo.456']).inc({count: 1}).serialize()
    expect(patch).toEqual({
      query: '*[_id in $ids]',
      params: {ids: ['abc123', 'foo.456']},
      inc: {count: 1},
    })
  })

  test('patch() can take a query', () => {
    const patch = getClient().patch({query: '*[_type == "beer]'}).inc({count: 1}).serialize()
    expect(patch).toEqual({query: '*[_type == "beer]', inc: {count: 1}})
  })

  test('patch() can take a query and params', () => {
    const patch = getClient()
      .patch({query: '*[_type == $type]', params: {type: 'beer'}})
      .inc({count: 1})
      .serialize()

    expect(patch).toEqual({query: '*[_type == $type]', params: {type: 'beer'}, inc: {count: 1}})
  })

  test('setIfMissing() patch can be applied multiple times', () => {
    const patch = getClient()
      .patch('abc123')
      .setIfMissing({count: 1, foo: 'bar'})
      .setIfMissing({count: 2, bar: 'foo'})
      .serialize()

    expect(patch).toEqual({id: 'abc123', setIfMissing: {count: 2, foo: 'bar', bar: 'foo'}})
  })

  test('can apply inc() and dec()', () => {
    const patch = getClient()
      .patch('abc123')
      .inc({count: 1}) // One step forward
      .dec({count: 2}) // Two steps back
      .serialize()

    expect(patch).toEqual({id: 'abc123', inc: {count: 1}, dec: {count: 2}})
  })

  test('can apply unset()', () => {
    const patch = getClient()
      .patch('abc123')
      .inc({count: 1})
      .unset(['bitter', 'enchilada'])
      .serialize()

    expect(patch).toEqual({id: 'abc123', inc: {count: 1}, unset: ['bitter', 'enchilada']})
  })

  test('throws if non-array is passed to unset()', () => {
    expect(() =>
      getClient()
        .patch('abc123')
        // @ts-expect-error -- unset() requires an array of attribute paths, not a string
        .unset('bitter')
        .serialize(),
    ).toThrow(/non-array given/)
  })

  test('can apply insert()', () => {
    const patch = getClient()
      .patch('abc123')
      .inc({count: 1})
      .insert('after', 'tags[-1]', ['hotsauce'])
      .serialize()

    expect(patch).toEqual({
      id: 'abc123',
      inc: {count: 1},
      insert: {after: 'tags[-1]', items: ['hotsauce']},
    })
  })

  test('throws on invalid insert()', () => {
    expect(() =>
      getClient()
        .patch('abc123')
        // @ts-expect-error -- insert() requires one of 'before' | 'after' | 'replace', not 'bitter'
        .insert('bitter', 'sel', ['raf']),
    ).toThrow(/one of: "before", "after", "replace"/)

    expect(() =>
      getClient()
        .patch('abc123')
        // @ts-expect-error -- insert() selector must be a string, not a number
        .insert('before', 123, ['raf']),
    ).toThrow(/must be a string/)

    expect(() =>
      getClient()
        .patch('abc123')
        // @ts-expect-error -- insert() items must be an array, not a string
        .insert('before', 'prop', 'blah'),
    ).toThrow(/must be an array/)
  })

  test('can apply append()', () => {
    const patch = getClient()
      .patch('abc123')
      .inc({count: 1})
      .append('tags', ['sriracha'])
      .serialize()

    expect(patch).toEqual({
      id: 'abc123',
      inc: {count: 1},
      insert: {after: 'tags[-1]', items: ['sriracha']},
    })
  })

  test('can apply prepend()', () => {
    const patch = getClient()
      .patch('abc123')
      .inc({count: 1})
      .prepend('tags', ['sriracha', 'hotsauce'])
      .serialize()

    expect(patch).toEqual({
      id: 'abc123',
      inc: {count: 1},
      insert: {before: 'tags[0]', items: ['sriracha', 'hotsauce']},
    })
  })

  test('can apply splice()', () => {
    const patch = () => getClient().patch('abc123')
    const replaceFirst = patch().splice('tags', 0, 1, ['foo']).serialize()
    const insertInMiddle = patch().splice('tags', 5, 0, ['foo']).serialize()
    const deleteLast = patch().splice('tags', -1, 1).serialize()
    const deleteAllFromIndex = patch().splice('tags', 3, -1).serialize()
    const allFromIndexDefault = patch().splice('tags', 3).serialize()
    const negativeDelete = patch().splice('tags', -2, -2, ['foo']).serialize()

    expect(replaceFirst.insert).toEqual({replace: 'tags[0:1]', items: ['foo']})
    expect(insertInMiddle.insert).toEqual({replace: 'tags[5:5]', items: ['foo']})
    expect(deleteLast.insert).toEqual({replace: 'tags[-2:]', items: []})
    expect(deleteAllFromIndex.insert).toEqual({replace: 'tags[3:-1]', items: []})
    expect(allFromIndexDefault.insert).toEqual({replace: 'tags[3:-1]', items: []})
    expect(negativeDelete).toEqual(patch().splice('tags', -2, 0, ['foo']).serialize())
  })

  test('serializing invalid selectors throws', () => {
    expect(() =>
      getClient()
        // @ts-expect-error -- patch() selection must be a string, array of strings, or a mutation selector, not a number
        .patch(123)
        .serialize(),
    ).toThrow(/unknown selection/i)
  })

  test('can apply diffMatchPatch()', () => {
    const patch = getClient()
      .patch('abc123')
      .inc({count: 1})
      .diffMatchPatch({description: '@@ -1,13 +1,12 @@\n The \n-rabid\n+nice\n  dog\n'})
      .serialize()

    expect(patch).toEqual({
      id: 'abc123',
      inc: {count: 1},
      diffMatchPatch: {description: '@@ -1,13 +1,12 @@\n The \n-rabid\n+nice\n  dog\n'},
    })
  })

  test('all patch methods throw on non-objects being passed as argument', () => {
    const patch = getClient().patch('abc123')
    expect(
      // @ts-expect-error -- set() requires an object of properties, not null
      () => patch.set(null),
      'set throws',
    ).toThrow(/set\(\) takes an object of properties/)
    expect(
      // @ts-expect-error -- setIfMissing() requires an object of properties, not a string
      () => patch.setIfMissing('foo'),
      'setIfMissing throws',
    ).toThrow(/setIfMissing\(\) takes an object of properties/)
    expect(
      // @ts-expect-error -- inc() requires an object of properties, not a string
      () => patch.inc('foo'),
      'inc throws',
    ).toThrow(/inc\(\) takes an object of properties/)
    expect(
      // @ts-expect-error -- dec() requires an object of properties, not a string
      () => patch.dec('foo'),
      'dec throws',
    ).toThrow(/dec\(\) takes an object of properties/)
    expect(
      // @ts-expect-error -- diffMatchPatch() requires an object of properties, not a string
      () => patch.diffMatchPatch('foo'),
      'diffMatchPatch throws',
    ).toThrow(/diffMatchPatch\(\) takes an object of properties/)
  })

  test('executes patch when commit() is called', async () => {
    const expectedPatch = {patch: {id: 'abc123', inc: {count: 1}, set: {visited: true}}}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&visibility=sync', {
        body: {mutations: [expectedPatch]},
      })
      .respond({status: 200, body: {transactionId: 'blatti'}})

    const res = await getClient()
      .patch('abc123')
      .inc({count: 1})
      .set({visited: true})
      .commit({returnDocuments: false})
    expect(res.transactionId, 'applies given patch').toEqual('blatti')
  })

  test('executes patch with request tag when commit() is called with tag', async () => {
    const expectedPatch = {patch: {id: 'abc123', set: {visited: true}}}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?tag=company.setvisited&returnIds=true&visibility=sync', {
        body: {
          mutations: [expectedPatch],
        },
      })
      .respond({status: 200, body: {transactionId: 'blatti'}})

    const res = await getClient()
      .patch('abc123')
      .set({visited: true})
      .commit({returnDocuments: false, tag: 'company.setvisited'})
    expect(res.transactionId, 'applies given patch').toEqual('blatti')
  })

  test('executes patch with auto generate key option if specified commit()', async () => {
    const expectedPatch = {patch: {id: 'abc123', set: {visited: true}}}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&autoGenerateArrayKeys=true&visibility=sync', {
        body: {
          mutations: [expectedPatch],
        },
      })
      .respond({status: 200, body: {transactionId: 'blatti'}})

    const res = await getClient()
      .patch('abc123')
      .set({visited: true})
      .commit({returnDocuments: false, autoGenerateArrayKeys: true})
    expect(res.transactionId, 'applies given patch').toEqual('blatti')
  })

  test('executes patch with given token override commit() is called', async () => {
    const expectedPatch = {patch: {id: 'abc123', inc: {count: 1}, set: {visited: true}}}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&visibility=sync', {
        body: {mutations: [expectedPatch]},
        headers: {Authorization: 'Bearer abc123'},
      })
      .respond({status: 200, body: {transactionId: 'blatti'}})

    const res = await getClient()
      .patch('abc123')
      .inc({count: 1})
      .set({visited: true})
      .commit({returnDocuments: false, token: 'abc123'})
    expect(res.transactionId, 'applies given patch').toEqual('blatti')
  })

  test('returns patched document by default', async () => {
    const expectedPatch = {patch: {id: 'abc123', inc: {count: 1}, set: {visited: true}}}
    const expectedBody = {mutations: [expectedPatch]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({
        status: 200,
        body: {
          transactionId: 'blatti',
          results: [
            {
              id: 'abc123',
              operation: 'update',
              document: {
                _id: 'abc123',
                _createdAt: '2016-10-24T08:09:32.997Z',
                count: 2,
                visited: true,
              },
            },
          ],
        },
      })

    const res = await getClient().patch('abc123').inc({count: 1}).set({visited: true}).commit()
    expect(res._id, 'returns patched document').toEqual('abc123')
  })

  test('commit() returns promise', async () => {
    expect.assertions(1)

    const expectedPatch = {patch: {id: 'abc123', inc: {count: 1}, set: {visited: true}}}
    const expectedBody = {mutations: [expectedPatch]}
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: expectedBody,
      })
      .respond({status: 400})

    try {
      await getClient().patch('abc123').inc({count: 1}).set({visited: true}).commit()
    } catch (err) {
      expect(err, 'should call applied error handler').toBeInstanceOf(Error)
    }
  })

  test('each patch operation returns same patch', () => {
    const patch = getClient().patch('abc123')
    const inc = patch.inc({count: 1})
    const dec = patch.dec({count: 1})
    const combined = inc.dec({count: 1})

    expect(patch, 'should return same patch').toEqual(inc)
    expect(inc, 'should return same patch').toEqual(dec)
    expect(inc, 'should return same patch').toEqual(combined)

    expect(combined.serialize(), 'combined patch should have both inc and dec ops').toEqual({
      id: 'abc123',
      inc: {count: 1},
      dec: {count: 1},
    })
  })

  test('can reset patches to no operations, keeping document ID', () => {
    const patch = getClient().patch('abc123').inc({count: 1}).dec({visits: 1})
    const reset = patch.reset()

    expect(patch.serialize(), 'correct patch').toEqual({id: 'abc123'})
    expect(reset.serialize(), 'reset patch should be empty').toEqual({id: 'abc123'})
    expect(patch, 'reset mutates, does not clone').toEqual(reset)
  })

  test('patch has toJSON() which serializes patch', () => {
    const patch = getClient().patch('abc123').inc({count: 1})
    expect(JSON.parse(JSON.stringify(patch))).toEqual(
      JSON.parse(JSON.stringify({id: 'abc123', inc: {count: 1}})),
    )
  })

  test('Patch is available as a named export and can be used without instantiated client', () => {
    const patch = new Patch('foo.bar')
    expect(
      patch.inc({foo: 1}).dec({bar: 2}).serialize(),
      'patch should work without context',
    ).toEqual({id: 'foo.bar', inc: {foo: 1}, dec: {bar: 2}})
  })

  test('patch commit() throws if called without a client', () => {
    const patch = new Patch('foo.bar')
    expect(() => patch.dec({bar: 2}).commit()).toThrow(/client.*mutate/i)
  })

  test('patch can be created without client and passed to mutate()', async () => {
    const patch = new Patch('foo').dec({count: 1})

    const mutations = [{patch: {id: 'foo', dec: {count: 1}}}]
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/data/mutate/foo?returnIds=true&returnDocuments=true&visibility=sync', {
        body: {
          mutations,
        },
      })
      .respond({status: 200, body: {results: [{id: 'foo', operation: 'update'}]}})

    await expect(getClient().mutate(patch)).resolves.not.toThrow()
  })

  // oxlint-disable-next-line no-warning-comments
  // @TODO investigate why this fails on Edge Runtime
  test('can manually call clone on patch', () => {
    const patch1 = getClient().patch('abc123').inc({count: 1})
    const patch2 = patch1.clone()

    expect(patch1, 'actually cloned').not.toBe(patch2)
    expect(patch1.serialize(), 'serialized to the same').toEqual(patch2.serialize())
  })

  test('can apply ifRevisionId constraint', () => {
    expect(
      getClient().patch('abc123').inc({count: 1}).ifRevisionId('someRev').serialize(),
      'patch should be able to apply ifRevisionId constraint',
    ).toEqual({id: 'abc123', inc: {count: 1}, ifRevisionID: 'someRev'})
  })
})
