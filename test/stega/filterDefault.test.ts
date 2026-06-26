import {describe, expect, test} from 'vitest'

import {filterDefault} from '../../src/stega/filterDefault'

describe('filterDefault', () => {
  const mockDocument = {
    _id: 'test-doc',
    _type: 'article',
    _rev: 'abc123',
    _createdAt: '2023-01-01T00:00:00Z',
    _updatedAt: '2023-01-01T00:00:00Z',
  }

  const mockFilterDefault = () => true

  describe('URL validation', () => {
    test.each([
      ['https://example.com'],
      ['http://localhost:3000'],
      ['mailto:test@example.com'],
      ['tel:+1234567890'],
      ['sms:+1234567890'],
      ['ftp://files.example.com'],
      ['file:///path/to/file.txt'],
      ['app://open-app'],
      ['geo:37.7749,-122.4194'],
      ['maps:q=San+Francisco'],
      ['data:text/plain;base64,SGVsbG8gV29ybGQ='],
      ['javascript:void(0)'],
      ['slack://channel/general'],
      ['discord://invite/abc123'],
      ['ftps://secure.example.com'],
      ['magnet:?xt=urn:btih:example'],
      ['ms-excel://open?file=test.xlsx'],
      ['ms-powerpoint://open?file=test.pptx'],
      ['ms-word://open?file=test.docx'],
      ['spotify:track:4iV5W9uYEdYUVa79Axb7Rh'],
      ['steam://run/12345'],
      ['teams://meet.teams.microsoft.com/join'],
      ['vscode://file/path/to/file.js'],
      ['zoom://zoom.us/j/123456789'],
      ['web+coffee://americano'],
    ])('should skip encoding %s', (url) => {
      const result = filterDefault({
        sourcePath: ['title'],
        resultPath: ['title'],
        value: url,
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(false)
    })

    test.each([
      ['draft:hello'],
      ['title:foo bar'],
      ['not-a-url-at-all'],
      ['just-text-content'],
      ['note: important thoughts'],
      ['slug: today'],
    ])('should encode %s', (url) => {
      const result = filterDefault({
        sourcePath: ['title'],
        resultPath: ['title'],
        value: url,
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(true)
    })
  })

  describe('Date validation', () => {
    test.each([
      ['2023-01-01'],
      ['2023-12-31'],
      ['2023-01-01T00:00:00Z'],
      ['2023-01-01T12:34:56.789Z'],
      ['2023-06-15T14:30:00+02:00'],
    ])('should skip encoding valid date string "%s"', (date) => {
      const result = filterDefault({
        sourcePath: ['publishedAt'],
        resultPath: ['publishedAt'],
        value: date,
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(false)
    })

    test.each([
      ['2023-13-01', 'Invalid month'],
      ['2023-01-32', 'Invalid day'],
      ['23-01-01', 'Wrong format'],
      ['not-a-date', 'Not a date'],
      ['2023/01/01', 'Wrong separator'],
      ['2023', 'Too short'],
    ])('should encode invalid date string "%s" (%s)', (date) => {
      const result = filterDefault({
        sourcePath: ['publishedAt'],
        resultPath: ['publishedAt'],
        value: date,
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(true)
    })
  })

  describe('Slug handling', () => {
    test('should skip encoding slug.current values', () => {
      const result = filterDefault({
        sourcePath: ['slug', 'current'],
        resultPath: ['slug'],
        value: 'my-article-slug',
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(false)
    })

    test.each([
      [
        ['slug', 'current'],
        ['slug', 'current'],
      ],
      [['slug', 'current'], ['slug']],
      [
        ['meta', 'slug', 'current'],
        ['meta', 'slug'],
      ],
    ])('should skip encoding slugs: sourcePath=%j, resultPath="%j"', (sourcePath, resultPath) => {
      const result = filterDefault({
        sourcePath,
        resultPath,
        value: 'foo-bar',
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(false)
    })

    test.each([
      [['slug', 'title'], ['title']],
      [
        ['aside', 'slug', 'title'],
        ['aside', 'url', 'title'],
      ],
    ])(
      'can encode slugs if it is not a slug type: sourcePath=%j, resultPath="%j"',
      (sourcePath, resultPath) => {
        const result = filterDefault({
          sourcePath,
          resultPath,
          value: 'foo-bar',
          sourceDocument: mockDocument,
          filterDefault: mockFilterDefault,
        })
        expect(result).toBe(true)
      },
    )
  })

  describe('Underscore and ID patterns', () => {
    test.each([['_id'], ['_type'], ['_rev'], ['_createdAt'], ['_updatedAt'], ['_custom']])(
      'should skip encoding underscore-prefixed key "%s"',
      (key) => {
        const result = filterDefault({
          sourcePath: [key],
          resultPath: [key],
          value: 'some-value',
          sourceDocument: mockDocument,
          filterDefault: mockFilterDefault,
        })
        expect(result).toBe(false) // Should skip encoding
      },
    )

    test.each([['userId'], ['productId'], ['categoryId'], ['parentId'], ['customId']])(
      'should skip encoding key ending with "Id": "%s"',
      (key) => {
        const result = filterDefault({
          sourcePath: [key],
          resultPath: [key],
          value: 'some-id-value',
          sourceDocument: mockDocument,
          filterDefault: mockFilterDefault,
        })
        expect(result).toBe(false) // Should skip encoding
      },
    )

    test.each([['title'], ['content'], ['description'], ['name']])(
      'should encode normal key "%s"',
      (key) => {
        const result = filterDefault({
          sourcePath: [key],
          resultPath: [key],
          value: 'some-content',
          sourceDocument: mockDocument,
          filterDefault: mockFilterDefault,
        })
        expect(result).toBe(true) // Should encode
      },
    )
  })

  describe('Meta tag handling', () => {
    test.each([
      [['meta', 'title']],
      [['metadata', 'description']],
      [['openGraph', 'title']],
      [['seo', 'description']],
      [['article', 'meta', 'title']],
      [['page', 'metadata', 'keywords']],
    ])('should skip encoding in meta-related path %j', (path) => {
      const result = filterDefault({
        sourcePath: path,
        resultPath: path,
        value: 'Meta content',
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(false) // Should skip encoding
    })

    test.each([[['title']], [['content']], [['article', 'title']], [['page', 'content']]])(
      'should encode in non-meta path %j',
      (path) => {
        const result = filterDefault({
          sourcePath: path,
          resultPath: path,
          value: 'Regular content',
          sourceDocument: mockDocument,
          filterDefault: mockFilterDefault,
        })
        expect(result).toBe(true) // Should encode
      },
    )
  })

  describe('Type-like path handling', () => {
    test.each([
      [['iconType']],
      [['contentType']],
      [['blockType']],
      [['componentType']],
      [['element', 'type']],
      [['settings', 'layoutType']],
    ])('should skip encoding path containing "type": %j', (path) => {
      const result = filterDefault({
        sourcePath: path,
        resultPath: path,
        value: 'type-value',
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(false) // Should skip encoding
    })

    test.each([[['title']], [['content']], [['description']], [['category']]])(
      'should encode path not containing "type": %j',
      (path) => {
        const result = filterDefault({
          sourcePath: path,
          resultPath: path,
          value: 'content-value',
          sourceDocument: mockDocument,
          filterDefault: mockFilterDefault,
        })
        expect(result).toBe(true) // Should encode
      },
    )
  })

  describe('Denylist handling', () => {
    test.each([
      ['aspect_ratio'],
      ['aspectRatio'],
      ['blurHash'],
      ['color'],
      ['colour'],
      ['currency'],
      ['email'],
      ['encoding_tier'],
      ['format'],
      ['gid'],
      ['hex'],
      ['href'],
      ['hsl'],
      ['hsla'],
      ['icon'],
      ['id'],
      ['index'],
      ['key'],
      ['language'],
      ['layout'],
      ['link'],
      ['linkAction'],
      ['locale'],
      ['lqip'],
      ['master_access'],
      ['max_resolution_tier'],
      ['max_stored_resolution'],
      ['mp4_support'],
      ['page'],
      ['path'],
      ['ref'],
      ['resolution_tier'],
      ['rgb'],
      ['rgba'],
      ['route'],
      ['secret'],
      ['slug'],
      ['status'],
      ['tag'],
      ['template'],
      ['textTheme'],
      ['theme'],
      ['thumbHash'],
      ['type'],
      ['unit'],
      ['upload_id'],
      ['url'],
      ['username'],
      ['variant'],
      ['video_quality'],
      ['video_resolution'],
      ['website'],
    ])('should skip encoding denylisted key "%s"', (key) => {
      const result = filterDefault({
        sourcePath: [key],
        resultPath: [key],
        value: 'some-value',
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(false) // Should skip encoding
    })

    test.each([['title'], ['content'], ['description'], ['heading'], ['subtitle'], ['body']])(
      'should encode non-denylisted key "%s"',
      (key) => {
        const result = filterDefault({
          sourcePath: [key],
          resultPath: [key],
          value: 'some-content',
          sourceDocument: mockDocument,
          filterDefault: mockFilterDefault,
        })
        expect(result).toBe(true) // Should encode
      },
    )
  })

  describe('Complex scenarios', () => {
    test.each([
      [
        'URL in a denylisted key should still be skipped',
        ['href'],
        ['href'],
        'https://example.com',
        false,
      ],
      [
        'Date in a meta path should still be skipped',
        ['meta', 'publishedAt'],
        ['meta', 'publishedAt'],
        '2023-01-01',
        false,
      ],
      [
        'Normal content that passes all filters should be encoded',
        ['title'],
        ['title'],
        'My Article Title',
        true,
      ],
    ])('%s', (description, sourcePath, resultPath, value, expected) => {
      const result = filterDefault({
        sourcePath,
        resultPath,
        value,
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(expected)
    })

    test.each([
      [
        'Deep nested normal content should be encoded',
        ['article', 'content', 'blocks', 0, 'text'],
        ['article', 'content', 'blocks', 0, 'text'],
        'Block content',
        true,
      ],
      [
        'Deep nested with type should be skipped',
        ['article', 'content', 'blocks', 0, 'blockType'],
        ['article', 'content', 'blocks', 0, 'blockType'],
        'paragraph',
        false,
      ],
    ])('should handle nested paths: %s', (description, sourcePath, resultPath, value, expected) => {
      const result = filterDefault({
        sourcePath,
        resultPath,
        value,
        sourceDocument: mockDocument,
        filterDefault: mockFilterDefault,
      })
      expect(result).toBe(expected)
    })
  })
})
