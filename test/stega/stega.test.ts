import {expect, test} from 'vitest'

import {stegaCombine, stegaDecode} from '../../src/stega/stega'

test('it handles trailing zero-width space characters', () => {
  const payload = 'foo.\u200b'
  const editInfo = JSON.stringify({origin: 'sanity.io', href: '/studio'})
  const encoded = stegaCombine(payload, editInfo)
  expect(encoded).not.toEqual(payload)
  const decoded = stegaDecode(encoded)
  expect(decoded.origin).toEqual('sanity.io')
  expect(decoded.href).toEqual('/studio')
})
