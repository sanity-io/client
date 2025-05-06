import {describe, expect, test} from 'vitest'

import {formatQueryParseError} from '../src/http/errors'

const singleLineQuery = `*[_type == "event]`
const multiLineQuery = `*[
  _type == "event" &&
  defined(startDate) &&
  eventDate > now())
] {
  "title": eventTitle,
  "coverPhoto": photo.asset->url
}`

describe('groq errors', () => {
  test('formats single-line errors correctly', () => {
    expect(
      formatQueryParseError({
        type: 'queryParseError',
        query: singleLineQuery,
        description: 'unexpected token "\\"event]", expected expression',
        start: 11,
        end: 18,
      }),
    ).toMatchInlineSnapshot(`
      "GROQ query parse error:
      > 1 | *[_type == "event]
          |           ^^^^^^^ unexpected token "\\"event]", expected expression"
    `)
  })

  test('formats unknown function errors correctly', () => {
    expect(
      formatQueryParseError({
        description: 'unknown function "eventDate"',
        type: 'queryParseError',
      }),
    ).toMatchInlineSnapshot(`"GROQ query parse error: unknown function "eventDate""`)
  })

  test('formats multi-line errors correctly', () => {
    expect(
      formatQueryParseError({
        type: 'queryParseError',
        query: multiLineQuery,
        description: "expected ']' following expression",
        start: 1,
        end: 69,
      }),
    ).toMatchInlineSnapshot(`
      "GROQ query parse error:
      > 1 | *[
          | ^^
      > 2 |   _type == "event" &&
          | ^^^^^^^^^^^^^^^^^^^^^
      > 3 |   defined(startDate) &&
          | ^^^^^^^^^^^^^^^^^^^^^
      > 4 |   eventDate > now())
          | ^^^^^^^^^^^^^^^^^^^^ expected ']' following expression
        5 | ] {
        6 |   "title": eventTitle,
        7 |   "coverPhoto": photo.asset->url"
    `)
  })

  test('out of bounds column error (start)', () => {
    expect(
      formatQueryParseError({
        type: 'queryParseError',
        query: singleLineQuery,
        description: 'unexpected token "\\"event]", expected expression',
        start: 3000,
        end: 3000 + singleLineQuery.length,
      }),
    ).toMatchInlineSnapshot(`
      "GROQ query parse error:
      > 1 | *[_type == "event]
          |                  ^ unexpected token "\\"event]", expected expression"
    `)
  })

  test('out of bounds column error (end)', () => {
    expect(
      formatQueryParseError({
        type: 'queryParseError',
        query: singleLineQuery,
        description: 'unexpected token "\\"event]", expected expression',
        start: 5,
        end: 3000,
      }),
    ).toMatchInlineSnapshot(`
      "GROQ query parse error:
      > 1 | *[_type == "event]
          |     ^^^^^^^^^^^^^ unexpected token "\\"event]", expected expression"
    `)
  })
})
