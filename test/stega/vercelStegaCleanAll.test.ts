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
  expect(vercelStegaCleanAll(encoded)).toEqual(payload)
})
