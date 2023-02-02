import {describe, expect, test} from 'vitest'

import * as validators from '../src/validators'

describe('validators', async () => {
  test('validateDocumentId', () => {
    expect(
      () => validators.validateDocumentId('op', 'barfoo'),

      'does not throw on valid ID'
    ).not.toThrow(/document ID in format/)
    expect(
      () => validators.validateDocumentId('op', 'bar.foo.baz'),

      'does not throw on valid ID'
    ).not.toThrow(/document ID in format/)
    expect(
      () => validators.validateDocumentId('op', 'blah#blah'),

      'throws on invalid ID'
    ).toThrow(/not a valid document ID/)
  })
})
