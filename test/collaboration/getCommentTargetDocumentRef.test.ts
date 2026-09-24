import type {ClientConfig} from '@sanity/client'
import {getCommentTargetDocumentRef} from '@sanity/client/collaboration'
import {describe, expect, test} from 'vitest'

type Resource = NonNullable<ClientConfig['resource']>

const dataset = {type: 'dataset', id: 'project-123.production'} satisfies Resource
const canvas = {type: 'canvas', id: 'canvas-123'} satisfies Resource

describe('getCommentTargetDocumentRef', () => {
  test.each([
    ['dataset', dataset, 'dataset:project-123.production:doc-1'],
    ['canvas', canvas, 'canvas:canvas-123:doc-1'],
  ])('builds the reference from a %s resource', (_, resource, expected) => {
    expect(getCommentTargetDocumentRef(resource, 'doc-1')).toBe(expected)
  })

  test.each([
    ['published id', 'doc-1', 'dataset:project-123.production:doc-1'],
    ['draft id', 'drafts.doc-1', 'dataset:project-123.production:doc-1'],
    ['version id', 'versions.summer-drop.doc-1', 'dataset:project-123.production:doc-1'],
    [
      'version id whose published part has dots',
      'versions.summer-drop.foo.doc-1',
      'dataset:project-123.production:foo.doc-1',
    ],
  ])('names the published document, given a %s', (_, documentId, expected) => {
    expect(getCommentTargetDocumentRef(dataset, documentId)).toBe(expected)
  })

  test('throws when the document ID is missing', () => {
    expect(() => getCommentTargetDocumentRef(dataset, '')).toThrow('Document ID must be provided')
  })
})
