import {describe, expect, it} from 'vitest'

import {type SanityDocumentStub} from '../../src/types'
import {
  deriveDocumentVersionId,
  generateReleaseId,
  getDocumentVersionId,
} from '../../src/util/createVersionId'

describe('createVersionId', () => {
  describe('generateReleaseId', () => {
    it('generates a string with 8 characters', () => {
      const releaseId = generateReleaseId()
      expect(typeof releaseId).toBe('string')
      expect(releaseId.length).toBe(8)
    })

    it('generates unique values on multiple calls', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateReleaseId())
      }
      expect(ids.size).toBe(100)
    })

    it('only uses characters from the defined alphabet', () => {
      const releaseId = generateReleaseId()
      const validChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      releaseId.split('').forEach((char) => {
        expect(validChars.includes(char)).toBe(true)
      })
    })
  })

  describe('getDocumentVersionId', () => {
    it('returns a draft ID when no releaseId is provided', () => {
      const publishedId = 'document123'
      const versionId = getDocumentVersionId(publishedId)
      expect(versionId).toBe('drafts.document123')
    })

    it('returns a version ID when releaseId is provided', () => {
      const publishedId = 'document123'
      const releaseId = 'release456'
      const versionId = getDocumentVersionId(publishedId, releaseId)
      expect(versionId).toBe('versions.release456.document123')
    })

    it('handles IDs with special characters correctly', () => {
      const publishedId = 'complex-doc_with.chars'
      const releaseId = 'release456'
      const versionId = getDocumentVersionId(publishedId, releaseId)
      expect(versionId).toBe('versions.release456.complex-doc_with.chars')
    })
  })

  describe('deriveDocumentVersionId', () => {
    it('returns document ID when only document with _id is provided', () => {
      const document = {
        _id: 'doc123',
        _type: 'post',
        title: 'Test document',
      }

      const result = deriveDocumentVersionId({document}, 'test')
      expect(result).toBe('doc123')
    })

    it('returns draft ID when only publishedId is provided', () => {
      const document = {title: 'Test without ID', _type: 'post'}
      const publishedId = 'pub123'

      const result = deriveDocumentVersionId({publishedId, document}, 'test')
      expect(result).toBe('drafts.pub123')
    })

    it('returns version ID when publishedId and releaseId are provided', () => {
      const document = {title: 'Test without ID', _type: 'post'}
      const publishedId = 'pub123'
      const releaseId = 'release456'
      const result = deriveDocumentVersionId({publishedId, releaseId, document}, 'test')
      expect(result).toBe('versions.release456.pub123')
    })

    it('validates and returns version ID when both document._id and publishedId are provided', () => {
      const publishedId = 'pub123'
      const documentWithDraftId = {
        _id: 'drafts.pub123',
        title: 'Test with draft ID',
        _type: 'post',
      }

      const result = deriveDocumentVersionId({publishedId, document: documentWithDraftId}, 'test')
      expect(result).toBe('drafts.pub123')
    })

    it('validates and returns version ID when document._id, publishedId, and releaseId are provided', () => {
      const publishedId = 'pub123'
      const releaseId = 'release456'
      const versionId = `versions.${releaseId}.${publishedId}`
      const documentWithVersionId = {
        _id: versionId,
        title: 'Test with version ID',
        _type: 'post',
      }

      const result = deriveDocumentVersionId(
        {publishedId, releaseId, document: documentWithVersionId},
        'test',
      )
      expect(result).toBe(versionId)
    })

    it('throws error when document ID does not match generated version ID', () => {
      const publishedId = 'pub123'
      const document = {
        _id: 'drafts.different123',
        title: 'Test with mismatched ID',
        _type: 'post',
      }

      expect(() => {
        deriveDocumentVersionId({publishedId, document}, 'test')
      }).toThrow(/does not match/)
    })

    it('throws error when neither publishedId nor document._id is provided', () => {
      const document = {title: 'Test without ID'} as unknown as SanityDocumentStub

      expect(() => {
        deriveDocumentVersionId({document}, 'test')
      }).toThrow(/test\(\) requires either a publishedId or a document with an _id/)
    })

    it('throws error when validating version ID with mismatched releaseId', () => {
      const publishedId = 'pub123'
      const releaseId = 'release456'
      const wrongReleaseId = 'wrong789'
      const document = {
        _id: `versions.${wrongReleaseId}.${publishedId}`,
        title: 'Test with wrong release ID',
        _type: 'post',
      }

      expect(() => {
        deriveDocumentVersionId({publishedId, releaseId, document}, 'test')
      }).toThrow(/does not match/)
    })

    it('handles correctly when document._id is a draft ID and publishedId matches', () => {
      const publishedId = 'pub123'
      const document = {
        _id: 'drafts.pub123',
        title: 'Test with draft ID',
        _type: 'post',
      }

      const result = deriveDocumentVersionId({publishedId, document}, 'test')
      expect(result).toBe('drafts.pub123')
    })
  })
})
