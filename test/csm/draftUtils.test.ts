import {describe, expect, it, test} from 'vitest'

import {getPublishedId, getVersionFromId, getVersionId} from '../../src/csm/draftUtils'

test.each([
  ['From published id', 'agot', 'summer-drop', 'versions.summer-drop.agot'],
  ['From draft id', 'drafts.agot', 'summer-drop', 'versions.summer-drop.agot'],
  ['From same version id', 'versions.summer-drop.agot', 'summer-drop', 'versions.summer-drop.agot'],
  [
    'From other version id',
    'versions.winter-drop.agot',
    'summer-drop',
    'versions.summer-drop.agot',
  ],
])('getVersionId(): %s', (_, documentId, equalsDocumentId, shouldEqual) => {
  expect(getVersionId(documentId, equalsDocumentId)).toEqual(shouldEqual)
})

test.each([
  ['from published id', 'agot', 'agot'],
  ['from draft id', 'drafts.agot', 'agot'],
  ['from version id', 'versions.summer-drop.agot', 'agot'],
  ['from complex id with version', 'versions.summer-drop.foo.agot', 'foo.agot'],
])('getPublishedId(): %s', (_, documentId, shouldEqual) => {
  expect(getPublishedId(documentId)).toEqual(shouldEqual)
})

describe('getVersionFromId', () => {
  it('should return the bundle slug', () => {
    expect(getVersionFromId('versions.summer.my-document-id')).toBe('summer')
  })

  it('should return the undefined if no bundle slug is found and document is a draft', () => {
    expect(getVersionFromId('drafts.my-document-id')).toBe(undefined)
  })

  it('should return the undefined if no bundle slug is found and document is published', () => {
    expect(getVersionFromId('my-document-id')).toBe(undefined)
  })
})
