import {
  type ClientPerspective,
  type ContentSourceMapDocuments,
  getDraftId,
  getPublishedId,
  getVersionId,
} from '@sanity/client/csm'
import {describe, expect, test} from 'vitest'

import {
  createSourceDocumentResolver,
  type ResolvedDocument,
} from '../../src/csm/createSourceDocumentResolver'

const ids = {
  published: '462efcc6-3c8b-47c6-8474-5544e1a4acde',
  draft: 'e1bf9f1f-efdb-4105-8c26-6b64f897e9c1',
  version: '807cc05c-8c4c-443a-a9c1-198fd3fd7b16',
  release: 'rABC123',
} as const

const mockContentSourceMapDocuments = {
  published: {
    _id: ids.published,
    _type: 'product',
  },
  draft: {
    _id: getDraftId(ids.draft),
    _type: 'product',
  },
  version: {
    _id: getVersionId(ids.version, ids.release),
    _type: 'product',
  },
} satisfies Record<string, ContentSourceMapDocuments[number]>

function expectingToPass(
  perspective: Exclude<ClientPerspective, 'raw'>,
  sourceDocument: ContentSourceMapDocuments[number],
  expectedDocument: ResolvedDocument,
) {
  const resolver = createSourceDocumentResolver(
    (_sourceDocument) => (_sourceDocument._id === expectedDocument._id ? expectedDocument : null),
    perspective,
  )
  const document = resolver(sourceDocument)!
  expect(document, 'Resolves to a document').not.toBeNull()
  expect(document._id, 'The returned ID needs to be the published ID').toEqual(
    getPublishedId(document._id),
  )
  expect(document._id, 'The returned _id needs to match the source document').toEqual(
    getPublishedId(sourceDocument._id),
  )
  expect(document._originalId, 'The _originalId needs to match the resolved document id').toEqual(
    expectedDocument._id,
  )
}
function expectingToMiss(
  perspective: Exclude<ClientPerspective, 'raw'>,
  sourceDocument: ContentSourceMapDocuments[number],
  expectedDocument: ResolvedDocument,
) {
  const resolver = createSourceDocumentResolver(
    (_sourceDocument) => (_sourceDocument._id === expectedDocument._id ? expectedDocument : null),
    perspective,
  )
  expect(resolver(sourceDocument), 'No document should be resolved').toBeNull()
}

describe('perspectives: ["published"]', () => {
  test.each([
    [
      'resolve a published document from a published document',
      mockContentSourceMapDocuments.published,
      {_id: ids.published, _type: 'product'},
    ],
    [
      'resolve a published document from a draft document',
      mockContentSourceMapDocuments.draft,
      {_id: ids.draft, _type: 'product'},
    ],
    [
      'resolve a published document from a versioned document',
      mockContentSourceMapDocuments.version,
      {_id: ids.version, _type: 'product'},
    ],
  ])('%s', (_, sourceDocument, expectedDocument) => {
    expectingToPass('published', sourceDocument, expectedDocument)
  })
  test.each([
    [
      'drafts are filtered out when published',
      mockContentSourceMapDocuments.published,
      {_id: getDraftId(ids.published), _type: 'product'},
    ],
    [
      'versioned documents are filtered out when published',
      mockContentSourceMapDocuments.published,
      {_id: getVersionId(ids.published, ids.release), _type: 'product'},
    ],
  ])('%s', (_, sourceDocument, expectedDocument) => {
    expectingToMiss('published', sourceDocument, expectedDocument)
  })
})

describe('perspectives: ["drafts", "published"]', () => {
  test.each([
    [
      'resolve a published document from a published document',
      mockContentSourceMapDocuments.published,
      {_id: ids.published, _type: 'product'},
    ],
    [
      'resolve a published document from a draft document',
      mockContentSourceMapDocuments.published,
      {_id: getDraftId(ids.published), _type: 'product'},
    ],
    [
      'resolve a draft document from a published document',
      mockContentSourceMapDocuments.draft,
      {_id: ids.draft, _type: 'product'},
    ],
    [
      'resolve a draft document from a draft document',
      mockContentSourceMapDocuments.draft,
      {_id: getDraftId(ids.draft), _type: 'product'},
    ],
    [
      'resolve a versioned document from a published document',
      mockContentSourceMapDocuments.version,
      {_id: ids.version, _type: 'product'},
    ],
    [
      'resolve a versioned document from a draft document',
      mockContentSourceMapDocuments.version,
      {_id: getDraftId(ids.version), _type: 'product'},
    ],
  ])('%s', (_, sourceDocument, expectedDocument) => {
    expectingToPass('drafts', sourceDocument, expectedDocument)
  })
  test.each([
    [
      'a release is filtered out when filtering only drafts',
      mockContentSourceMapDocuments.published,
      {_id: getVersionId(ids.published, ids.release), _type: 'product'},
    ],
  ])('%s', (_, sourceDocument, expectedDocument) => {
    expectingToMiss('drafts', sourceDocument, expectedDocument)
  })
  test('prefers drafts over published', () => {
    const mocks = [
      {_id: ids.published, _type: 'product'},
      {_id: getDraftId(ids.published), _type: 'product'},
    ]
    const resolver = createSourceDocumentResolver(
      (_sourceDocument) => mocks.find((mock) => mock._id === _sourceDocument._id),
      'drafts',
    )
    expect(resolver(mockContentSourceMapDocuments.published)!._originalId).toEqual(
      getDraftId(ids.published),
    )
  })
})

describe(`perspectives: ["${ids.release}", "published"]`, () => {
  test.each([
    [
      'resolve a published document from a versioned document',
      mockContentSourceMapDocuments.published,
      {_id: getVersionId(ids.published, ids.release), _type: 'product'},
    ],
  ])('%s', (_, sourceDocument, expectedDocument) => {
    expectingToPass([ids.release], sourceDocument, expectedDocument)
  })
  test.each([
    [
      'drafts are filtered out when filtering only a release',
      mockContentSourceMapDocuments.published,
      {_id: getDraftId(ids.published), _type: 'product'},
    ],
  ])('%s', (_, sourceDocument, expectedDocument) => {
    expectingToMiss([ids.release], sourceDocument, expectedDocument)
  })
})

describe(`perspectives: ["${ids.release}", "drafts", "published"]`, () => {
  test.each([
    [
      'resolve a published document from a versioned document',
      mockContentSourceMapDocuments.published,
      {_id: getVersionId(ids.published, ids.release), _type: 'product'},
    ],
  ])('%s', (_, sourceDocument, expectedDocument) => {
    expectingToPass([ids.release, 'drafts'], sourceDocument, expectedDocument)
  })
  test.each([
    [
      'a different release is filtered out',
      mockContentSourceMapDocuments.published,
      {_id: getVersionId(ids.published, 'rDFG456'), _type: 'product'},
    ],
  ])('%s', (_, sourceDocument, expectedDocument) => {
    expectingToMiss([ids.release, 'drafts'], sourceDocument, expectedDocument)
  })
})
