import {vercelStegaCombine} from '@vercel/stega'
import {expect, test} from 'vitest'

import {vercelStegaCleanAll} from '../../src/stega/vercelStegaCleanAll'

test('it removes everything', () => {
  const payload = {
    foo: ['bar', 'baz'],
    multistrings: 'multi stega embedded',
  }
  const encoded = JSON.parse(JSON.stringify(payload))
  const editInfo = JSON.stringify({origin: 'sanity.io', href: '/studio'})
  encoded.foo[0] = vercelStegaCombine(encoded.foo[0], editInfo)
  encoded.foo[1] = vercelStegaCombine(encoded.foo[1], editInfo)
  encoded.multistrings = [
    vercelStegaCombine('multi', editInfo),
    vercelStegaCombine('stega', editInfo),
    vercelStegaCombine('embedded', editInfo),
  ].join(' ')
  expect(encoded).not.toEqual(payload)
  expect(vercelStegaCleanAll(encoded)).toEqual(payload)
})

test('it handles strings', () => {
  const payload = 'foo'
  const editInfo = JSON.stringify({origin: 'sanity.io', href: '/studio'})
  const encoded = vercelStegaCombine(payload, editInfo)
  expect(encoded).not.toEqual(payload)
  expect(vercelStegaCleanAll(encoded)).toEqual(payload)
})

test('it handles values that are not supported by JSON', () => {
  expect(vercelStegaCleanAll(undefined)).toMatchInlineSnapshot(`undefined`)
  expect(vercelStegaCleanAll(null)).toMatchInlineSnapshot(`null`)
  expect(vercelStegaCleanAll(Symbol('foo'))).toMatchInlineSnapshot(`Symbol(foo)`)
  expect(vercelStegaCleanAll(new Set([1, 2, 3]))).toMatchInlineSnapshot(`{}`)
  expect(
    vercelStegaCleanAll(
      new Map([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ),
  ).toMatchInlineSnapshot(`{}`)
  expect(
    vercelStegaCleanAll([{foo: undefined, bar: null, baz: new Date('1995-12-17T02:24:00.000Z')}]),
  ).toMatchInlineSnapshot(`
    [
      {
        "bar": null,
        "baz": "1995-12-17T02:24:00.000Z",
      },
    ]
  `)
})
