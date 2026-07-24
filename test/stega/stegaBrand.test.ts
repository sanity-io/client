import {stegaBrand, stegaClean, stegaEncodeSourceMap} from '@sanity/client/stega'
import {expect, test} from 'vitest'

import type {ContentSourceMap} from '../../src/types'

test('stegaBrand is an identity function', () => {
  const result = {title: 'foo', tags: ['bar']}
  expect(stegaBrand(result)).toBe(result)
  expect(stegaBrand(null)).toBe(null)
})

test('stegaClean round-trips a branded and encoded result', () => {
  const result = {_id: 'njgNkngskjg', title: 'IPA', country: 'Norway'}
  const resultSourceMap: ContentSourceMap = {
    documents: [{_id: 'njgNkngskjg', _type: 'beer'}],
    paths: ["$['_id']", "$['title']", "$['country']"],
    mappings: {
      "$['_id']": {source: {document: 0, path: 0, type: 'documentValue'}, type: 'value'},
      "$['title']": {source: {document: 0, path: 1, type: 'documentValue'}, type: 'value'},
      "$['country']": {source: {document: 0, path: 2, type: 'documentValue'}, type: 'value'},
    },
  }
  const encoded = stegaBrand(
    stegaEncodeSourceMap(result, resultSourceMap, {
      enabled: true,
      studioUrl: '/studio',
    }),
  )

  expect(encoded).not.toEqual(result)
  expect(encoded.title).not.toBe('IPA')
  // Underscore prefixed keys are never encoded, matching their unbranded types
  expect(encoded._id).toBe('njgNkngskjg')

  expect(stegaClean(encoded)).toEqual(result)
  expect(stegaClean(encoded.title)).toBe('IPA')
})
