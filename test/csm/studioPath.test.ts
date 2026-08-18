import {describe, expect, test} from 'vitest'

import {jsonPathToStudioPath} from '../../src/csm/jsonPath'
import {fromString, get, toString} from '../../src/csm/studioPath'
import {type ContentSourceMapParsedPath} from '../../src/csm/types'

const srcObject = {
  title: 'Hei',
  nested: {'0': 'Zero-Key'},
  nullVal: null,
  body: [
    {_key: 'foo', title: 'Foo'},
    {_key: 'bar', children: [{_key: 'child1', text: 'Heisann'}]},
  ],
  multiDimensional: [
    [[{_key: 'abc', title: 'hai'}], [{_key: 'def', title: 'def'}]],
    [
      [13, 14],
      [15, 16],
    ],
  ],
}

describe('fromString', () => {
  test('throws if not a string', () => {
    // @ts-expect-error -- fromString() requires a string argument
    expect(() => fromString()).toThrow('Path is not a string')
    // @ts-expect-error -- fromString() requires a string, not a number
    expect(() => fromString(13)).toThrow('Path is not a string')

    expect(
      // @ts-expect-error -- fromString() requires a string, not null
      () => fromString(null),
    ).toThrow('Path is not a string')
    // @ts-expect-error -- fromString() requires a string, not a boolean
    expect(() => fromString(false)).toThrow('Path is not a string')
  })

  test('handles plain property segments', () => {
    expect(fromString('foo')).toEqual(['foo'])
  })

  test('handles index segments', () => {
    expect(fromString('[0]')).toEqual([0])
    expect(fromString('[1337]')).toEqual([1337])
  })

  test('handles key segments', () => {
    expect(fromString('[_key == "foo"]')).toEqual([{_key: 'foo'}])
    expect(fromString("[ _key== 'B4z']")).toEqual([{_key: 'B4z'}])
    expect(fromString('[_key=="bar"]')).toEqual([{_key: 'bar'}])
  })

  test('handles deep prop segments', () => {
    expect(fromString('foo.bar')).toEqual(['foo', 'bar'])
    expect(fromString('bar.foo')).toEqual(['bar', 'foo'])
    expect(fromString('bar.foo.baz')).toEqual(['bar', 'foo', 'baz'])
  })

  test('handles deep array index segments', () => {
    expect(fromString('foo[13]')).toEqual(['foo', 13])
    expect(fromString('bar.foo[3]')).toEqual(['bar', 'foo', 3])
    expect(fromString('[3][18]')).toEqual([3, 18])
  })

  test('handles deep key segments', () => {
    expect(fromString('foo[_key=="bar"].body[_key=="13ch"')).toEqual([
      'foo',
      {_key: 'bar'},
      'body',
      {_key: '13ch'},
    ])
    expect(fromString('bar.foo[3][_key == "seg"]')).toEqual(['bar', 'foo', 3, {_key: 'seg'}])
    expect(fromString('[_key=="foo"][_key== "bar"][_key =="baz"][  _key   == "seg"  ')).toEqual([
      {_key: 'foo'},
      {_key: 'bar'},
      {_key: 'baz'},
      {_key: 'seg'},
    ])
  })
})

describe('toString', () => {
  test('throws if not an array', () => {
    // @ts-expect-error -- toString() requires an array argument
    expect(() => toString()).toThrow('Path is not an array')

    expect(
      // @ts-expect-error -- toString() requires an array, not a number
      () => toString(13),
    ).toThrow('Path is not an array')

    expect(
      // @ts-expect-error -- toString() requires an array, not null
      () => toString(null),
    ).toThrow('Path is not an array')
    expect(
      // @ts-expect-error -- toString() requires an array, not a boolean
      () => toString(false),
    ).toThrow('Path is not an array')
  })

  test('handles plain property segments', () => {
    expect(toString(['foo'])).toEqual('foo')
  })

  test('handles index segments', () => {
    expect(toString([0])).toEqual('[0]')
    expect(toString([1337])).toEqual('[1337]')
  })

  test('handles key segments', () => {
    expect(toString([{_key: 'foo'}])).toEqual('[_key=="foo"]')
    expect(toString([{_key: 'B4z'}])).toEqual('[_key=="B4z"]')
    expect(toString([{_key: 'bar'}])).toEqual('[_key=="bar"]')
  })

  test('handles deep prop segments', () => {
    expect(toString(['foo', 'bar'])).toEqual('foo.bar')
    expect(toString(['bar', 'foo'])).toEqual('bar.foo')
    expect(toString(['bar', 'foo', 'baz'])).toEqual('bar.foo.baz')
  })

  test('handles deep array index segments', () => {
    expect(toString(['foo', 13])).toEqual('foo[13]')
    expect(toString(['bar', 'foo', 3])).toEqual('bar.foo[3]')
    expect(toString([3, 18])).toEqual('[3][18]')
  })

  test('handles deep key segments', () => {
    expect(toString(['foo', {_key: 'bar'}, 'body', {_key: '13ch'}])).toEqual(
      'foo[_key=="bar"].body[_key=="13ch"]',
    )
    expect(toString(['bar', 'foo', 3, {_key: 'seg'}])).toEqual('bar.foo[3][_key=="seg"]')
    expect(toString([{_key: 'foo'}, {_key: 'bar'}, {_key: 'baz'}, {_key: 'seg'}])).toEqual(
      '[_key=="foo"][_key=="bar"][_key=="baz"][_key=="seg"]',
    )
  })

  test('throws on unrecognized segment types', () => {
    expect(() =>
      toString([
        // @ts-expect-error -- {foo: 'bar'} is not a valid path segment
        {foo: 'bar'},
      ]),
    ).toThrow('Unsupported path segment `{"foo":"bar"}`')
  })
})

describe('get', () => {
  test('throws on non-array/non-string path', () => {
    expect(
      // @ts-expect-error -- get() requires an array or string path, not null
      () => get(srcObject, null),
    ).toThrow('Path must be an array or a string')
    expect(
      // @ts-expect-error -- get() requires an array or string path, not a number
      () => get(srcObject, 13),
    ).toThrow('Path must be an array or a string')
    expect(
      // @ts-expect-error -- get() requires an array or string path, not a boolean
      () => get(srcObject, false),
    ).toThrow('Path must be an array or a string')
    expect(
      // @ts-expect-error -- get() requires an array or string path, not a boolean
      () => get(srcObject, true),
    ).toThrow('Path must be an array or a string')
  })

  test('can get simple props', () => {
    expect(get(srcObject, 'title')).toEqual(srcObject.title)
    expect(get(srcObject, ['title'])).toEqual(srcObject.title)
  })

  test('can pass default value', () => {
    const defaultVal = Math.random()
    expect(get(srcObject, 'notSet', defaultVal)).toEqual(defaultVal)
    expect(get(srcObject, ['notSet'], defaultVal)).toEqual(defaultVal)
  })

  test('can use array indexes', () => {
    expect(get(srcObject, ['body', 0])).toEqual(srcObject.body[0])
    expect(get(srcObject, ['body', 1, 'children', 0])).toEqual(srcObject.body[1].children![0])
    expect(get(srcObject, ['multiDimensional', 1, 1])).toEqual(srcObject.multiDimensional[1][1])
  })

  test('can use key lookup', () => {
    expect(get(srcObject, ['body', {_key: 'bar'}])).toEqual(srcObject.body[1])
    expect(get(srcObject, ['body', {_key: 'bar'}, 'children', {_key: 'child1'}])).toEqual(
      srcObject.body[1].children![0],
    )
  })

  test('falls back to default value on array index at non-array', () => {
    const defaultVal = {}
    expect(get(srcObject, ['title', 1], defaultVal)).toEqual(defaultVal)
  })

  test('falls back to default value on property lookup at non-object', () => {
    const defaultVal = {}
    expect(get(srcObject, ['title', 'bar'], defaultVal)).toEqual(defaultVal)
    expect(get(srcObject, ['multiDimensional', 'bar'], defaultVal)).toEqual(defaultVal)
    expect(get(srcObject, ['nullVal', 'bar'], defaultVal)).toEqual(defaultVal)
  })

  test('falls back to default value on key lookup at non-array', () => {
    const defaultVal = {}
    expect(get(srcObject, ['nullVal', {_key: 'abc'}], defaultVal)).toEqual(defaultVal)
  })

  test('can get numbered key from object', () => {
    expect(get(srcObject, 'nested.0')).toEqual('Zero-Key')
    expect(get(srcObject, ['nested', '0'])).toEqual('Zero-Key')
  })
})

describe('get + jsonpath', () => {
  const tget = (obj: unknown, path: ContentSourceMapParsedPath, defaultValue?: unknown) =>
    get(obj, jsonPathToStudioPath(path), defaultValue)
  test('can pass default value', () => {
    const defaultVal = Math.random()
    expect(tget(srcObject, ['notSet'], defaultVal)).toEqual(defaultVal)
  })

  test('can use array indexes', () => {
    expect(tget(srcObject, ['body', 0])).toEqual(srcObject.body[0])
    expect(tget(srcObject, ['body', 1, 'children', 0])).toEqual(srcObject.body[1].children![0])
    expect(tget(srcObject, ['multiDimensional', 1, 1])).toEqual(srcObject.multiDimensional[1][1])
  })

  test('can use key lookup', () => {
    expect(tget(srcObject, ['body', {_key: 'bar', _index: -1}])).toEqual(srcObject.body[1])
    expect(
      tget(srcObject, [
        'body',
        {_key: 'bar', _index: -1},
        'children',
        {_key: 'child1', _index: -1},
      ]),
    ).toEqual(srcObject.body[1].children![0])
  })

  test('falls back to default value on array index at non-array', () => {
    const defaultVal = {}
    expect(tget(srcObject, ['title', 1], defaultVal)).toEqual(defaultVal)
  })

  test('falls back to default value on property lookup at non-object', () => {
    const defaultVal = {}
    expect(tget(srcObject, ['title', 'bar'], defaultVal)).toEqual(defaultVal)
    expect(tget(srcObject, ['multiDimensional', 'bar'], defaultVal)).toEqual(defaultVal)
    expect(tget(srcObject, ['nullVal', 'bar'], defaultVal)).toEqual(defaultVal)
  })

  test('falls back to default value on key lookup at non-array', () => {
    const defaultVal = {}
    expect(tget(srcObject, ['nullVal', {_key: 'abc', _index: -1}], defaultVal)).toEqual(defaultVal)
  })

  test('can get numbered key from object', () => {
    expect(tget(srcObject, ['nested', '0'])).toEqual('Zero-Key')
  })
})
