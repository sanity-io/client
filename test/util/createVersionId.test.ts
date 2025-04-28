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
        _id: 'drafts.doc123',
        _type: 'post',
        title: 'Test document',
      }

      const result = deriveDocumentVersionId('test', {document})
      expect(result).toBe('drafts.doc123')
    })

    it('returns draft ID when only publishedId is provided', () => {
      const document = {title: 'Test without ID', _type: 'post'}
      const publishedId = 'pub123'

      const result = deriveDocumentVersionId('test', {publishedId, document})
      expect(result).toBe('drafts.pub123')
    })

    it('returns version ID when publishedId and releaseId are provided', () => {
      const document = {title: 'Test without ID', _type: 'post'}
      const publishedId = 'pub123'
      const releaseId = 'release456'
      const result = deriveDocumentVersionId('test', {publishedId, releaseId, document})
      expect(result).toBe('versions.release456.pub123')
    })

    it('throws error when document._id is provided but is not a version ID or draft ID', () => {
      const document = {
        _id: 'regularId123',
        _type: 'post',
        title: 'Test with regular ID',
      }

      expect(() => {
        deriveDocumentVersionId('test', {document})
      }).toThrow('test() requires a document with an _id that is a version or draft ID')
    })

    it('throws error when document._id is a draft ID and releaseId is provided', () => {
      const publishedId = 'pub123'
      const releaseId = 'release456'
      const document = {
        _id: `drafts.${publishedId}`,
        _type: 'post',
        title: 'Test with draft ID',
      }

      expect(() => {
        deriveDocumentVersionId('test', {document, releaseId})
      }).toThrow(
        `test() was called with a document ID (${document._id}) that is a draft ID, but a release ID (${releaseId}) was also provided.`,
      )
    })

    it('throws error when document._id is a version ID but version does not match provided releaseId', () => {
      const publishedId = 'pub123'
      const wrongReleaseId = 'oldRelease789'
      const releaseId = 'newRelease456'
      const versionId = `versions.${wrongReleaseId}.${publishedId}`
      const document = {
        _id: versionId,
        _type: 'post',
        title: 'Test with version ID',
      }

      expect(() => {
        deriveDocumentVersionId('test', {document, releaseId})
      }).toThrow(
        `test() was called with a document ID (${versionId}) that is a version ID, but the release ID (${releaseId}) does not match the document's version ID (${wrongReleaseId}).`,
      )
    })

    it('validates and returns version ID when both document._id and publishedId are provided', () => {
      const publishedId = 'pub123'
      const documentWithDraftId = {
        _id: 'drafts.pub123',
        title: 'Test with draft ID',
        _type: 'post',
      }

      const result = deriveDocumentVersionId('test', {publishedId, document: documentWithDraftId})
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

      const result = deriveDocumentVersionId('test', {
        publishedId,
        releaseId,
        document: documentWithVersionId,
      })
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
        deriveDocumentVersionId('test', {publishedId, document})
      }).toThrow(
        'The provided document ID (drafts.different123) does not match the generated version ID (drafts.pub123)',
      )
    })

    it('throws error when neither publishedId nor document._id is provided', () => {
      const document = {title: 'Test without ID', _type: 'post'} as SanityDocumentStub

      expect(() => {
        deriveDocumentVersionId('test', {document})
      }).toThrow('test() requires either a publishedId or a document with an _id')
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
        deriveDocumentVersionId('test', {publishedId, releaseId, document})
      }).toThrow(
        `The provided document ID (versions.${wrongReleaseId}.${publishedId}) does not match the generated version ID (versions.${releaseId}.${publishedId})`,
      )
    })

    it('handles correctly when document._id is a draft ID and publishedId matches', () => {
      const publishedId = 'pub123'
      const document = {
        _id: 'drafts.pub123',
        title: 'Test with draft ID',
        _type: 'post',
      }

      const result = deriveDocumentVersionId('test', {publishedId, document})
      expect(result).toBe('drafts.pub123')
    })
  })
})
