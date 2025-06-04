import {expect, test} from 'vitest'

import {encodeQueryString} from '../src/data/encodeQueryString'

test('can encode basic query without parameters', () => {
  const query = 'gamedb.game[maxPlayers == 64]'
  expect(encodeQueryString({query})).toEqual('?query=gamedb.game%5BmaxPlayers+%3D%3D+64%5D')
})

test('can encode queries with basic numeric parameters', () => {
  const query = 'gamedb.game[maxPlayers == $maxPlayers && score == $score]'

  expect(encodeQueryString({query, params: {maxPlayers: 64, score: 3.45678}})).toEqual(
    '?query=gamedb.game%5BmaxPlayers+%3D%3D+%24maxPlayers+%26%26+score+%3D%3D+%24score%5D&%24maxPlayers=64&%24score=3.45678',
  )
})

test('can encode queries with basic string parameters', () => {
  const query = 'gamedb.game[name == $name]'
  expect(encodeQueryString({query, params: {name: 'foobar'}})).toEqual(
    '?query=gamedb.game%5Bname+%3D%3D+%24name%5D&%24name=%22foobar%22',
  )
})

test('can encode queries with booleans', () => {
  const query = 'gamedb.game[isReleased == $released]'
  expect(encodeQueryString({query, params: {released: true}})).toEqual(
    '?query=gamedb.game%5BisReleased+%3D%3D+%24released%5D&%24released=true',
  )
})

test('can encode null values', () => {
  const query = '*[defined(slug.current) && slug.current == $slug]'
  expect(encodeQueryString({query, params: {slug: null}})).toEqual(
    '?query=*%5Bdefined%28slug.current%29+%26%26+slug.current+%3D%3D+%24slug%5D&%24slug=null',
  )
})

test('can encode null nested values', () => {
  const query = '*[defined(slug.current) && slug.current == $slug.current]'
  expect(encodeQueryString({query, params: {slug: {current: null}}})).toEqual(
    '?query=*%5Bdefined%28slug.current%29+%26%26+slug.current+%3D%3D+%24slug.current%5D&%24slug=%7B%22current%22%3Anull%7D',
  )
})

test('skips encoding undefined params', () => {
  const query = '*[defined(slug.current) && slug.current == $slug]'
  expect(encodeQueryString({query, params: {slug: undefined}})).toEqual(
    '?query=*%5Bdefined%28slug.current%29+%26%26+slug.current+%3D%3D+%24slug%5D',
  )
})

test('skips encoding nested undefined params', () => {
  const query = '*[defined(slug.current) && slug.current == $slug.current]'
  expect(encodeQueryString({query, params: {slug: {current: undefined}}})).toEqual(
    '?query=*%5Bdefined%28slug.current%29+%26%26+slug.current+%3D%3D+%24slug.current%5D&%24slug=%7B%7D',
  )
})

test('handles options', () => {
  const query = 'gamedb.game[maxPlayers == 64]'
  expect(encodeQueryString({query, options: {includeResult: true}})).toEqual(
    '?query=gamedb.game%5BmaxPlayers+%3D%3D+64%5D&includeResult=true',
  )
})

test('skips falsy options unless they override server side defaults', () => {
  const query = 'gamedb.game[maxPlayers == 64]'
  expect(
    encodeQueryString({
      query,
      options: {
        extract: null,
        includeResult: false,
        includePreviousRevision: undefined,
        visibility: 0,
        tag: '',
        // these defaults to 'true' server side
        returnQuery: false,
        includeMutations: false,
      },
    }),
  ).toEqual('?query=gamedb.game%5BmaxPlayers+%3D%3D+64%5D&returnQuery=false&includeMutations=false')
})
