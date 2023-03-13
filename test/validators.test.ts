import {describe, expect, test} from 'vitest'

import * as validators from '../src/validators'

describe('validators', async () => {
  test('validateDocumentId', () => {
    expect(
      () => validators.validateDocumentId('op', 'barfoo'),
      'does not throw on valid ID (simple)'
    ).not.toThrow()

    expect(
      () => validators.validateDocumentId('op', 'bar.foo.baz'),
      'does not throw on valid ID (pathed)'
    ).not.toThrow()

    expect(
      () => validators.validateDocumentId('op', 'all.allowed-chars_used'),
      'does not throw on valid ID (all allowed characters)'
    ).not.toThrow()

    expect(
      () => validators.validateDocumentId('op', '_underscored'),
      'does not throw on valid ID (underscore-first)'
    ).not.toThrow()

    expect(
      () => validators.validateDocumentId('op', '3abcdef'),
      'does not throw on valid ID (digit-first)'
    ).not.toThrow()

    expect(
      () => validators.validateDocumentId('op', 'blah#blah'),
      'throws on invalid ID (disallowed character)'
    ).toThrow(/not a valid document ID/)

    expect(
      () => validators.validateDocumentId('op', '-not-allowed'),
      'throws on invalid ID (dash-first)'
    ).toThrow(/not a valid document ID/)

    expect(
      () => validators.validateDocumentId('op', 'some..path'),
      'throws on invalid ID (double-dot)'
    ).toThrow(/not a valid document ID/)

    expect(
      () => validators.validateDocumentId('op', 'a'.repeat(129)),
      'throws on invalid ID (too long)'
    ).toThrow(/not a valid document ID/)
  })
})
