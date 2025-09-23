import {describe, expect, test} from 'vitest'

import {
  type DecideField,
  isDecideField,
  processDecideFields,
  processObjectRecursively,
  resolveDecideField,
} from '../src/data/decideResponseProcessor'

describe('decideResponseProcessor', () => {
  describe('isDecideField', () => {
    test('should identify valid decide fields', () => {
      const validField = {
        default: 'default value',
        conditions: [{audience: 'aud-a', value: 'value a'}],
      }
      expect(isDecideField(validField)).toBe(true)
    })

    test('should reject invalid decide fields', () => {
      expect(isDecideField(null)).toBe(false)
      expect(isDecideField(undefined)).toBe(false)
      expect(isDecideField('string')).toBe(false)
      expect(isDecideField(123)).toBe(false)
      expect(isDecideField([])).toBe(false)
      expect(isDecideField({})).toBe(false)
      expect(isDecideField({default: 'test'})).toBe(false) // missing conditions
      expect(isDecideField({conditions: []})).toBe(false) // missing default
      expect(isDecideField({default: 'test', conditions: 'not array'})).toBe(false)
    })
  })

  describe('resolveDecideField', () => {
    const decideField: DecideField = {
      default: 'default name',
      conditions: [
        {audience: 'aud-a', value: 'name for audience a'},
        {audience: 'aud-b', value: 'name for audience b'},
      ],
    }

    test('should return matching condition value', () => {
      expect(resolveDecideField(decideField, {audience: 'aud-a'})).toBe('name for audience a')
      expect(resolveDecideField(decideField, {audience: 'aud-b'})).toBe('name for audience b')
    })

    test('should return default when no match found', () => {
      expect(resolveDecideField(decideField, {audience: 'non-existent'})).toBe('default name')
      expect(resolveDecideField(decideField, {audience: ''})).toBe('default name')
    })

    test('should return first matching condition when multiple matches exist', () => {
      const fieldWithDuplicates: DecideField = {
        default: 'default',
        conditions: [
          {audience: 'aud-a', value: 'first match'},
          {audience: 'aud-a', value: 'second match'},
        ],
      }
      expect(resolveDecideField(fieldWithDuplicates, {audience: 'aud-a'})).toBe('first match')
    })

    test('should support array audiences', () => {
      expect(resolveDecideField(decideField, {audience: ['aud-c', 'aud-a']})).toBe('name for audience a')
      expect(resolveDecideField(decideField, {audience: ['aud-b', 'aud-c']})).toBe('name for audience b')
    })

    test('should return default when no audience in array matches', () => {
      expect(resolveDecideField(decideField, {audience: ['aud-c', 'aud-d']})).toBe('default name')
      expect(resolveDecideField(decideField, {audience: []})).toBe('default name')
    })
  })

  describe('processObjectRecursively', () => {
    test('should process simple objects with decide fields', () => {
      const input = {
        regularField: 'unchanged',
        decideName: {
          default: 'default name',
          conditions: [{audience: 'aud-a', value: 'special name'}],
        },
      }

      const result = processObjectRecursively(input, {audience: 'aud-a'})
      expect(result).toEqual({
        regularField: 'unchanged',
        decideName: 'special name',
      })
    })

    test('should process arrays of objects', () => {
      const input = [
        {
          id: 1,
          decideName: {
            default: 'default 1',
            conditions: [{audience: 'aud-a', value: 'special 1'}],
          },
        },
        {
          id: 2,
          decideName: {
            default: 'default 2',
            conditions: [{audience: 'aud-a', value: 'special 2'}],
          },
        },
      ]

      const result = processObjectRecursively(input, {audience: 'aud-a'})
      expect(result).toEqual([
        {id: 1, decideName: 'special 1'},
        {id: 2, decideName: 'special 2'},
      ])
    })

    test('should process nested objects', () => {
      const input = {
        author: {
          name: 'John',
          decideName: {
            default: 'default author name',
            conditions: [{audience: 'aud-a', value: 'special author name'}],
          },
        },
        posts: [
          {
            title: 'Post 1',
            decideTitle: {
              default: 'default title',
              conditions: [{audience: 'aud-a', value: 'special title'}],
            },
          },
        ],
      }

      const result = processObjectRecursively(input, {audience: 'aud-a'})
      expect(result).toEqual({
        author: {
          name: 'John',
          decideName: 'special author name',
        },
        posts: [
          {
            title: 'Post 1',
            decideTitle: 'special title',
          },
        ],
      })
    })

    test('should handle primitive values and null/undefined', () => {
      expect(processObjectRecursively(null, {audience: 'aud-a'})).toBe(null)
      expect(processObjectRecursively(undefined, {audience: 'aud-a'})).toBe(undefined)
      expect(processObjectRecursively('string', {audience: 'aud-a'})).toBe('string')
      expect(processObjectRecursively(123, {audience: 'aud-a'})).toBe(123)
      expect(processObjectRecursively(true, {audience: 'aud-a'})).toBe(true)
    })
  })

  describe('processDecideFields', () => {
    test('should process valid audience parameter', () => {
      const input = {
        decideName: {
          default: 'default',
          conditions: [{audience: 'aud-a', value: 'special'}],
        },
      }

      const result = processDecideFields(input, {audience: 'aud-a'})
      expect(result).toEqual({decideName: 'special'})
    })

    test('should return original data when no audience provided', () => {
      const input = {decideName: {default: 'default', conditions: []}}

      expect(processDecideFields(input, {audience: ''})).toBe(input)
      expect(processDecideFields(input, null as any)).toBe(input)
      expect(processDecideFields(input, undefined as any)).toBe(input)
    })

    test('should handle processing errors gracefully', () => {
      // For now, just test that malformed decide fields don't break processing
      const input = {
        validField: 'normal value',
        malformedDecideField: {
          default: 'default value',
          conditions: 'this should be an array but is a string', // This will cause isDecideField to return false
        },
      }

      const result = processDecideFields(input, {audience: 'aud-a'})

      // Should return processed data with malformed field unchanged
      expect(result).toEqual({
        validField: 'normal value',
        malformedDecideField: {
          default: 'default value',
          conditions: 'this should be an array but is a string',
        },
      })
    })
  })

  test('should handle deeply nested decide fields in complex document structures', () => {
    const input = {
      _id: 'blog-post-123',
      _type: 'blogPost',
      decideTitle: {
        default: 'Default Blog Title',
        conditions: [
          {audience: 'premium', value: 'Premium: Advanced Blog Insights'},
          {audience: 'basic', value: 'Basic: Blog Tips'},
        ],
      },
      author: {
        name: 'John Doe',
        decideBio: {
          default: 'A writer',
          conditions: [
            {audience: 'premium', value: 'Senior Technology Writer with 10+ years experience'},
            {audience: 'basic', value: 'Tech Writer'},
          ],
        },
        profile: {
          decidePicture: {
            default: '/images/default-avatar.jpg',
            conditions: [
              {audience: 'premium', value: '/images/john-professional.jpg'},
              {audience: 'basic', value: '/images/john-casual.jpg'},
            ],
          },
          social: {
            twitter: '@johndoe',
            decideLinkedIn: {
              default: null,
              conditions: [{audience: 'premium', value: 'https://linkedin.com/in/johndoe'}],
            },
          },
        },
      },
      content: {
        decideIntro: {
          default: 'Welcome to this blog post.',
          conditions: [
            {audience: 'premium', value: 'Welcome to our premium content series.'},
            {audience: 'basic', value: 'Welcome! Here are some basic tips.'},
          ],
        },
        sections: [
          {
            title: 'Section 1',
            decideContent: {
              default: 'Basic content here.',
              conditions: [
                {audience: 'premium', value: 'Advanced insights and detailed analysis.'},
                {audience: 'basic', value: 'Simple overview and tips.'},
              ],
            },
            subsections: [
              {
                heading: 'Subsection A',
                decideText: {
                  default: 'Standard text',
                  conditions: [{audience: 'premium', value: 'Detailed technical explanation'}],
                },
              },
            ],
          },
          {
            title: 'Section 2',
            decideContent: {
              default: 'More basic content.',
              conditions: [{audience: 'premium', value: 'Expert-level strategies and methods.'}],
            },
          },
        ],
      },
      metadata: {
        tags: ['tech', 'blog'],
        decidePriority: {
          default: 'normal',
          conditions: [{audience: 'premium', value: 'high'}],
        },
      },
    }

    // Test with 'premium' audience
    const resultPremium = processDecideFields(input, {audience: 'premium'}) as any

    // Root level decide fields
    expect(resultPremium.decideTitle).toBe('Premium: Advanced Blog Insights')

    // Nested decide fields in author
    expect(resultPremium.author.decideBio).toBe(
      'Senior Technology Writer with 10+ years experience',
    )
    expect(resultPremium.author.profile.decidePicture).toBe('/images/john-professional.jpg')
    expect(resultPremium.author.profile.social.decideLinkedIn).toBe(
      'https://linkedin.com/in/johndoe',
    )

    // Nested decide fields in content
    expect(resultPremium.content.decideIntro).toBe('Welcome to our premium content series.')
    expect(resultPremium.content.sections[0].decideContent).toBe(
      'Advanced insights and detailed analysis.',
    )
    expect(resultPremium.content.sections[0].subsections[0].decideText).toBe(
      'Detailed technical explanation',
    )
    expect(resultPremium.content.sections[1].decideContent).toBe(
      'Expert-level strategies and methods.',
    )

    // Nested decide fields in metadata
    expect(resultPremium.metadata.decidePriority).toBe('high')

    // Test with 'basic' audience
    const resultBasic = processDecideFields(input, {audience: 'basic'}) as any

    // Should get basic values or defaults
    expect(resultBasic.decideTitle).toBe('Basic: Blog Tips')
    expect(resultBasic.author.decideBio).toBe('Tech Writer')
    expect(resultBasic.author.profile.decidePicture).toBe('/images/john-casual.jpg')
    expect(resultBasic.author.profile.social.decideLinkedIn).toBe(null) // Falls back to default
    expect(resultBasic.content.decideIntro).toBe('Welcome! Here are some basic tips.')
    expect(resultBasic.content.sections[0].decideContent).toBe('Simple overview and tips.')
    expect(resultBasic.content.sections[0].subsections[0].decideText).toBe('Standard text') // Falls back to default
    expect(resultBasic.content.sections[1].decideContent).toBe('More basic content.') // Falls back to default
    expect(resultBasic.metadata.decidePriority).toBe('normal') // Falls back to default

    // Regular fields should remain unchanged
    expect(resultPremium._id).toBe(input._id)
    expect(resultPremium.author.name).toBe(input.author.name)
    expect(resultPremium.author.profile.social.twitter).toBe(input.author.profile.social.twitter)
    expect(resultPremium.content.sections[0].title).toBe(input.content.sections[0].title)
    expect(resultPremium.metadata.tags).toEqual(input.metadata.tags)
  })
})
