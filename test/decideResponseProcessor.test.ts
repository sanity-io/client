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

    test('should return default when no parameters provided', () => {
      expect(resolveDecideField(decideField, undefined)).toBe('default name')
      expect(resolveDecideField(decideField)).toBe('default name')
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
      expect(resolveDecideField(decideField, {audience: ['aud-c', 'aud-a']})).toBe(
        'name for audience a',
      )
      expect(resolveDecideField(decideField, {audience: ['aud-b', 'aud-c']})).toBe(
        'name for audience b',
      )
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

    test('should resolve defaults when no audience provided', () => {
      const input = {
        decideName: {default: 'default', conditions: [{audience: 'aud-a', value: 'special'}]},
      }

      expect(processDecideFields(input, {audience: ''})).toEqual({decideName: 'default'})
      expect(processDecideFields(input, {audience: []})).toEqual({decideName: 'default'})
      expect(processDecideFields(input, null as any)).toEqual({decideName: 'default'})
      expect(processDecideFields(input, undefined as any)).toEqual({decideName: 'default'})
      expect(processDecideFields(input)).toEqual({decideName: 'default'})
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

  test('should handle different response structures with decide fields', () => {
    // Test 1: Direct array response structure
    const arrayResponse = [
      {
        _id: 'doc1',
        price: {
          default: 100,
          conditions: [{audience: 'premium', value: 200}],
        },
      },
      {
        _id: 'doc2',
        price: {
          default: 150,
          conditions: [{audience: 'premium', value: 300}],
        },
      },
    ]

    const processedArray = processDecideFields(arrayResponse, {audience: 'premium'}) as any
    expect(processedArray[0].price).toBe(200)
    expect(processedArray[1].price).toBe(300)

    // Test 2: {documents: [...]} response structure (common for queries)
    const documentsResponse = {
      documents: [
        {
          _id: 'doc1',
          title: {
            default: 'Default Title',
            conditions: [{audience: 'premium', value: 'Premium Title'}],
          },
        },
      ],
      omitted: [],
    }

    const processedDocuments = processDecideFields(documentsResponse, {audience: 'premium'}) as any
    expect(processedDocuments.documents[0].title).toBe('Premium Title')

    // Test 3: {result: [...]} response structure (if filterResponse is false)
    const resultResponse = {
      result: [
        {
          _id: 'doc1',
          name: {
            default: 'Default Name',
            conditions: [{audience: 'premium', value: 'Premium Name'}],
          },
        },
      ],
      ms: 45,
      query: '*[_type == "document"]',
    }

    const processedResult = processDecideFields(resultResponse, {audience: 'premium'}) as any
    expect(processedResult.result[0].name).toBe('Premium Name')
    expect(processedResult.ms).toBe(45) // Non-decide fields should remain unchanged

    // Test 4: Single document response
    const singleDocResponse = {
      _id: 'doc1',
      price: {
        default: 100,
        conditions: [{audience: 'premium', value: 200}],
      },
    }

    const processedSingle = processDecideFields(singleDocResponse, {audience: 'premium'}) as any
    expect(processedSingle.price).toBe(200)

    // Test 5: No audience - should resolve to defaults in all structures
    const processedArrayDefault = processDecideFields(arrayResponse, undefined) as any
    expect(processedArrayDefault[0].price).toBe(100)
    expect(processedArrayDefault[1].price).toBe(150)

    const processedDocumentsDefault = processDecideFields(documentsResponse, undefined) as any
    expect(processedDocumentsDefault.documents[0].title).toBe('Default Title')
  })

  test('should handle the exact structure from user example', () => {
    // This is the exact structure the user provided - it should be processed
    const userResponse = {
      result: [
        {
          brand: {
            logo: {
              alt: 'a nike shoe is surrounded by colorful paint splashes on a black background .',
              asset: {
                _dataset: 'cross-dataset-references',
                _projectId: 'hiomol4a',
                _ref: 'image-03e9840b591f21ffcda034572b1ab80cd26b1e77-225x225-png',
                _type: 'reference',
              },
              crop: {
                _type: 'sanity.imageCrop',
                bottom: 0.19111111111111112,
                left: 0,
                right: 0,
                top: 0,
              },
              hotspot: {
                _type: 'sanity.imageHotspot',
                height: 0.6622222222222228,
                width: 0.9200000000000005,
                x: 0.508888888888889,
                y: 0.366666666666667,
              },
            },
            name: 'Nike',
            slug: {
              _type: 'slug',
              current: 'nike',
            },
          },
          media: {
            alt: 'a pair of red and white puma shoes on a white background',
            asset: {
              _ref: 'image-30b82c6709c0f21268b679126abea51953ee95e0-2000x2000-png',
              _type: 'reference',
            },
            crop: {
              _type: 'sanity.imageCrop',
              bottom: 0,
              left: 0,
              right: 0,
              top: 0,
            },
            hotspot: {
              _type: 'sanity.imageHotspot',
              height: 0.3284313725490209,
              width: 0.7009803921568629,
              x: 0.4950980392156863,
              y: 0.5514705882352939,
            },
          },
          price: {
            conditions: [
              {
                _key: 'c4bf584e7d70',
                _type: 'condition',
                audience: 'aud-b',
                value: 987,
              },
            ],
            default: 12,
          },
          slug: {
            _type: 'slug',
            current: 'lunar-glide-moon-walking-sneakers',
          },
          title: 'Lunar Glide: Moon [Draft] [decide]',
        },
      ],
    }

    // Test with matching audience - should resolve to conditional value
    const processedWithAudience = processDecideFields(userResponse, {audience: 'aud-b'}) as any
    expect(processedWithAudience.result[0].price).toBe(987)

    // Test with no audience - should resolve to default value
    const processedWithoutAudience = processDecideFields(userResponse) as any
    expect(processedWithoutAudience.result[0].price).toBe(12)

    // Test with non-matching audience - should resolve to default value
    const processedWithOtherAudience = processDecideFields(userResponse, {
      audience: 'some-other-audience',
    }) as any
    expect(processedWithOtherAudience.result[0].price).toBe(12)
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
