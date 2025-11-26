import {stegaClean} from '@sanity/client/stega'
import {expect, test} from 'vitest'

import {stegaCombine} from '../../src/stega/stega'

test('it removes everything', () => {
  const payload = {
    foo: ['bar', 'baz'],
    multistrings: 'multi stega embedded',
  }
  const encoded = JSON.parse(JSON.stringify(payload))
  const editInfo = JSON.stringify({origin: 'sanity.io', href: '/studio'})
  encoded.foo[0] = stegaCombine(encoded.foo[0], editInfo)
  encoded.foo[1] = stegaCombine(encoded.foo[1], editInfo)
  encoded.multistrings = [
    stegaCombine('multi', editInfo),
    stegaCombine('stega', editInfo),
    stegaCombine('embedded', editInfo),
  ].join(' ')
  expect(encoded).not.toEqual(payload)
  expect(stegaClean(encoded)).toEqual(payload)
})

test('it handles strings', () => {
  const payload = 'foo'
  const editInfo = JSON.stringify({origin: 'sanity.io', href: '/studio'})
  const encoded = stegaCombine(payload, editInfo)
  expect(encoded).not.toEqual(payload)
  expect(stegaClean(encoded)).toEqual(payload)
})

test('it handles values that are not supported by JSON', () => {
  expect(stegaClean(undefined)).toMatchInlineSnapshot(`undefined`)
  expect(stegaClean(null)).toMatchInlineSnapshot(`null`)
  expect(stegaClean(new Set([1, 2, 3]))).toMatchInlineSnapshot(`{}`)
  expect(
    stegaClean(
      new Map([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ),
  ).toMatchInlineSnapshot(`{}`)
  expect(stegaClean([{foo: undefined, bar: null, baz: new Date('1995-12-17T02:24:00.000Z')}]))
    .toMatchInlineSnapshot(`
    [
      {
        "bar": null,
        "baz": "1995-12-17T02:24:00.000Z",
      },
    ]
  `)
})
