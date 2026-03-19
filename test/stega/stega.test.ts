import {vercelStegaCombine, vercelStegaDecode} from '@vercel/stega'
import {expect, test} from 'vitest'

test('it handles trailing zero-width space characters', () => {
  const payload = 'foo.\u200b'
  const editInfo = JSON.stringify({origin: 'sanity.io', href: '/studio'})
  const encoded = vercelStegaCombine(payload, editInfo)
  expect(encoded).not.toEqual(payload)
  const decoded = vercelStegaDecode(encoded) as {origin: string; href: string}
  expect(decoded.origin).toEqual('sanity.io')
  expect(decoded.href).toEqual('/studio')
})
