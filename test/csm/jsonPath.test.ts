import {expect, test} from 'vitest'

import {jsonPath, jsonPathToStudioPath, parseJsonPath} from '../../src/csm/jsonPath'

test('formats normalised JSON Paths', () => {
  expect(jsonPath(['foo', 'bar', 0, 'baz'])).toBe("$['foo']['bar'][0]['baz']")
})

test('formats normalised JSON Paths with escaped characters', () => {
  expect(jsonPath(['foo', 'bar', 0, 'baz', "it's a 'test'"])).toBe(
    "$['foo']['bar'][0]['baz']['it\\'s a \\'test\\'']",
  )
})

test('parses normalised JSON Paths', () => {
  expect(parseJsonPath("$['foo']['bar'][0]['baz']")).toEqual(['foo', 'bar', 0, 'baz'])
})

test('parses normalised JSON Paths with escaped characters', () => {
  expect(parseJsonPath("$['foo']['bar'][0]['baz']['it\\'s a \\'test\\'']")).toEqual([
    'foo',
    'bar',
    0,
    'baz',
    "it's a 'test'",
  ])
})

test('parses normalised JSON Paths with key array filter selectors', () => {
  expect(
    parseJsonPath("$['foo'][?(@._key=='section-1')][0]['baz'][?(@._key=='section-2')]"),
  ).toEqual(['foo', {_key: 'section-1', _index: -1}, 0, 'baz', {_key: 'section-2', _index: -1}])
})

test('translates a json path to a studio path', () => {
  expect(
    jsonPathToStudioPath(['foo', {_key: 'section-1', _index: -1}, 0, 'baz', {_key: '', _index: 2}]),
  ).toEqual(['foo', {_key: 'section-1'}, 0, 'baz', 2])
})
