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
    test('should identify valid decide raw field', () => {
      const validField = {_type: 'sanity.decideField', default: 'default name'}
      expect(isDecideField(validField)).toBe(true)
    })
    test('should identify more complex decide raw field', () => {
      const validField = {
        _type: 'sanity.decideField',
        variants: [
          {
            _key: 'e9321da8ef37',
            _type: 'variant',
            anyOf: [
              {
                _key: '5e2778824236',
                _type: 'rule',
                operator: 'equals',
                property: 'gender',
                targetValue: 'male',
              },
            ],
            value: 'hello male',
          },
        ],
        default: 'default name',
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
      expect(isDecideField({default: 'test'})).toBe(false) // missing variants
      expect(isDecideField({variants: []})).toBe(false) // missing default
      expect(isDecideField({default: 'test', variants: 'not array'})).toBe(false)
    })
  })

  describe('resolveDecideField', () => {
    const decideField: DecideField = {
      _type: 'sanity.decideField',
      default: 'default name',
      variants: [
        {
          _key: 'c826626167fa',
          _type: 'variant',
          value: 'name for audience a',
          anyOf: [
            {
              _key: '5e2778824236',
              _type: 'rule',
              operator: 'equals',
              property: 'audience',
              targetValue: 'aud-a',
            },
          ],
        },
        {
          _key: 'c826626167fa',
          _type: 'variant',
          value: 'name for audience b',
          anyOf: [
            {
              _key: '5e2778824236',
              _type: 'rule',
              operator: 'equals',
              property: 'audience',
              targetValue: 'aud-b',
            },
          ],
        },
      ],
    }

    test('should return matching condition value', () => {
      expect(resolveDecideField(decideField, {audience: 'aud-a'})).toBe('name for audience a')
      expect(resolveDecideField(decideField, {audience: 'aud-b'})).toBe('name for audience b')
      expect(resolveDecideField(decideField, {audience: 'aud-c'})).toBe('default name')
    })

    test('should return default when no match found', () => {
      expect(resolveDecideField(decideField, {audience: 'non-existent'})).toBe('default name')
      expect(resolveDecideField(decideField, {audience: ''})).toBe('default name')
      expect(resolveDecideField(decideField)).toBe('default name')
    })

    test('should return default when no parameters provided', () => {
      expect(resolveDecideField(decideField, undefined)).toBe('default name')
      expect(resolveDecideField(decideField)).toBe('default name')
    })

    test('should return first matching condition when multiple matches exist', () => {
      const fieldWithDuplicates: DecideField = {
        _type: 'sanity.decideField',
        default: 'default',
        variants: [
          {
            _key: 'c826626167fa',
            _type: 'variant',
            value: 'first match',
            anyOf: [
              {
                _key: '5e2778824236',
                _type: 'rule',
                operator: 'equals',
                property: 'audience',
                targetValue: 'aud-a',
              },
            ],
          },
          {
            _key: 'c826626167fa',
            _type: 'variant',
            value: 'second match',
            anyOf: [
              {
                _key: '5e2778824236',
                _type: 'rule',
                operator: 'equals',
                property: 'audience',
                targetValue: 'aud-a',
              },
            ],
          },
        ],
      }
      expect(resolveDecideField(fieldWithDuplicates, {audience: 'aud-a'})).toBe('first match')
    })

    test('should return undefined default value when condition is not met and default is undefined', () => {
      const fieldWithDuplicates: DecideField = {
        _type: 'sanity.decideField',
        // default: undefined,
        variants: [
          {
            _key: 'c826626167fa',
            _type: 'variant',
            value: 'first match',
            anyOf: [
              {
                _key: '5e2778824236',
                _type: 'rule',
                operator: 'equals',
                property: 'audience',
                targetValue: 'aud-a',
              },
            ],
          },
        ],
      }
      expect(resolveDecideField(fieldWithDuplicates, {audience: 'aud-c'})).toBe(undefined)
    })
    test('should return undefined value when variant has undefined value and condition is met', () => {
      const fieldWithDuplicates: DecideField = {
        _type: 'sanity.decideField',
        default: 'default',
        variants: [
          {
            _key: 'c826626167fa',
            _type: 'variant',
            value: undefined,
            anyOf: [
              {
                _key: '5e2778824236',
                _type: 'rule',
                operator: 'equals',
                property: 'audience',
                targetValue: 'aud-a',
              },
            ],
          },
        ],
      }
      expect(resolveDecideField(fieldWithDuplicates, {audience: 'aud-a'})).toBe(undefined)
    })

    // test('should support array audiences', () => {
    //   expect(resolveDecideField(decideField, {audience: ['aud-c', 'aud-a']})).toBe(
    //     'name for audience a',
    //   )
    //   expect(resolveDecideField(decideField, {audience: ['aud-b', 'aud-c']})).toBe(
    //     'name for audience b',
    //   )
    // })

    // test('should return default when no audience in array matches', () => {
    //   expect(resolveDecideField(decideField, {audience: ['aud-c', 'aud-d']})).toBe('default name')
    //   expect(resolveDecideField(decideField, {audience: []})).toBe('default name')
    // })
  })

  describe('processObjectRecursively', () => {
    test('should process simple objects with decide fields', () => {
      const input = {
        regularField: 'unchanged',
        decideName: {
          _type: 'sanity.decideField',
          default: 'default name',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'special name',
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'aud-a',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
            },
          ],
        } satisfies DecideField,
      }

      const result = processObjectRecursively(input, {audience: 'aud-a'})
      expect(result).toEqual({regularField: 'unchanged', decideName: 'special name'})
    })

    test('should process arrays of objects', () => {
      const input = [
        {
          id: 1,
          decideName: {
            _type: 'sanity.decideField',
            default: 'default 1',
            variants: [
              {
                _type: 'variant',
                _key: 'c826626167fa',
                value: 'special 1',
                anyOf: [
                  {
                    property: 'audience',
                    operator: 'equals',
                    targetValue: 'aud-a',
                    _key: 'c826626167fa',
                    _type: 'rule',
                  },
                ],
              },
            ],
          } satisfies DecideField,
        },
        {
          id: 2,
          decideName: {
            _type: 'sanity.decideField',
            default: 'default 1',
            variants: [
              {
                _type: 'variant',
                _key: 'c826626167fa',
                value: 'special 2',
                anyOf: [
                  {
                    property: 'audience',
                    operator: 'equals',
                    targetValue: 'aud-a',
                    _key: 'c826626167fa',
                    _type: 'rule',
                  },
                ],
              },
            ],
          } satisfies DecideField,
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
            _type: 'sanity.decideField',
            default: 'default author name',
            variants: [
              {
                _type: 'variant',
                _key: 'c826626167fa',
                value: 'special author name',
                anyOf: [
                  {
                    property: 'audience',
                    operator: 'equals',
                    targetValue: 'aud-a',
                    _key: 'c826626167fa',
                    _type: 'rule',
                  },
                ],
              },
            ],
          } satisfies DecideField,
        },
        posts: [
          {
            title: 'Post 1',
            decideTitle: {
              _type: 'sanity.decideField',
              default: 'default title',
              variants: [
                {
                  _type: 'variant',
                  _key: 'c826626167fa',
                  value: 'special title',
                  anyOf: [
                    {
                      property: 'audience',
                      operator: 'equals',
                      targetValue: 'aud-a',
                      _key: 'c826626167fa',
                      _type: 'rule',
                    },
                  ],
                },
              ],
            } satisfies DecideField,
          },
        ],
      }

      const result = processObjectRecursively(input, {audience: 'aud-a'})
      expect(result).toEqual({
        author: {name: 'John', decideName: 'special author name'},
        posts: [{title: 'Post 1', decideTitle: 'special title'}],
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
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'special',
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'aud-a',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
            },
          ],
        } satisfies DecideField,
      }

      const result = processDecideFields(input, {audience: 'aud-a'})
      expect(result).toEqual({decideName: 'special'})
    })

    test('should resolve defaults when no audience provided', () => {
      const input = {
        decideName: {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'special',
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'aud-a',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
            },
          ],
        },
      }

      expect(processDecideFields(input, {audience: ''})).toEqual({decideName: 'default'})
      // @ts-expect-error - we want to test that the function handles this case
      expect(processDecideFields(input, {audience: []})).toEqual({decideName: 'default'})
      // @ts-expect-error - we want to test that the function handles this case
      expect(processDecideFields(input, {audience: null})).toEqual({decideName: 'default'})
      // @ts-expect-error - we want to test that the function handles this case
      expect(processDecideFields(input, {audience: true})).toEqual({decideName: 'default'})
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
          variants: 'this should be an array but is a string', // This will cause isDecideField to return false
        },
      }

      const result = processDecideFields(input, {audience: 'aud-a'})

      // Should return processed data with malformed field unchanged
      expect(result).toEqual({
        validField: 'normal value',
        malformedDecideField: {
          default: 'default value',
          variants: 'this should be an array but is a string',
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
          _type: 'sanity.decideField',
          default: 100,
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 200,
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'premium',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
            },
          ],
        } satisfies DecideField,
      },
      {
        _id: 'doc2',
        price: {
          _type: 'sanity.decideField',
          default: 150,
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 300,
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'premium',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
            },
          ],
        } satisfies DecideField,
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
            _type: 'sanity.decideField',
            default: 'Default Title',
            variants: [
              {
                _key: 'c826626167fa',
                _type: 'variant',
                value: 'Premium Title',
                anyOf: [
                  {
                    property: 'audience',
                    operator: 'equals',
                    targetValue: 'premium',
                    _key: 'c826626167fa',
                    _type: 'rule',
                  },
                ],
              },
            ],
          } satisfies DecideField,
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
            _type: 'sanity.decideField',
            default: 'Default Name',
            variants: [
              {
                _key: 'c826626167fa',
                _type: 'variant',
                value: 'Premium Name',
                anyOf: [
                  {
                    property: 'audience',
                    operator: 'equals',
                    targetValue: 'premium',
                    _key: 'c826626167fa',
                    _type: 'rule',
                  },
                ],
              },
            ],
          } satisfies DecideField,
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
        _type: 'sanity.decideField',
        default: 100,
        variants: [
          {
            _key: 'c826626167fa',
            _type: 'variant',
            value: 200,
            anyOf: [
              {
                property: 'audience',
                operator: 'equals',
                targetValue: 'premium',
                _key: 'c826626167fa',
                _type: 'rule',
              },
            ],
          },
        ],
      } satisfies DecideField,
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
            slug: {_type: 'slug', current: 'nike'},
          },
          media: {
            alt: 'a pair of red and white puma shoes on a white background',
            asset: {
              _ref: 'image-30b82c6709c0f21268b679126abea51953ee95e0-2000x2000-png',
              _type: 'reference',
            },
            crop: {_type: 'sanity.imageCrop', bottom: 0, left: 0, right: 0, top: 0},
            hotspot: {
              _type: 'sanity.imageHotspot',
              height: 0.3284313725490209,
              width: 0.7009803921568629,
              x: 0.4950980392156863,
              y: 0.5514705882352939,
            },
          },
          price: {
            _type: 'sanity.decideField',
            variants: [
              {
                _key: 'c4bf584e7d70',
                _type: 'variant',
                anyOf: [
                  {
                    property: 'audience',
                    operator: 'equals',
                    targetValue: 'aud-b',
                    _key: 'c4bf584e7d70',
                    _type: 'rule',
                  },
                ],
                value: 987,
              },
            ],
            default: 12,
          } satisfies DecideField,
          slug: {_type: 'slug', current: 'lunar-glide-moon-walking-sneakers'},
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
        _type: 'sanity.decideField',
        default: 'Default Blog Title',
        variants: [
          {
            _key: 'c826626167fa',
            _type: 'variant',
            anyOf: [
              {
                property: 'audience',
                operator: 'equals',
                targetValue: 'premium',
                _key: 'c826626167fa',
                _type: 'rule',
              },
            ],
            value: 'Premium: Advanced Blog Insights',
          },
          {
            _key: 'c826626167fa',
            _type: 'variant',
            anyOf: [
              {
                property: 'audience',
                operator: 'equals',
                targetValue: 'basic',
                _key: 'c826626167fa',
                _type: 'rule',
              },
            ],
            value: 'Basic: Blog Tips',
          },
        ],
      } satisfies DecideField,
      author: {
        name: 'John Doe',
        decideBio: {
          _type: 'sanity.decideField',
          default: 'A writer',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'premium',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
              value: 'Senior Technology Writer with 10+ years experience',
            },
            {
              _key: 'c826626167fa',
              _type: 'variant',
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'basic',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
              value: 'Tech Writer',
            },
          ],
        } satisfies DecideField,
        profile: {
          decidePicture: {
            _type: 'sanity.decideField',
            default: '/images/default-avatar.jpg',
            variants: [
              {
                _key: 'c826626167fa',
                _type: 'variant',
                anyOf: [
                  {
                    property: 'audience',
                    operator: 'equals',
                    targetValue: 'premium',
                    _key: 'c826626167fa',
                    _type: 'rule',
                  },
                ],
                value: '/images/john-professional.jpg',
              },
              {
                _key: 'c826626167fa',
                _type: 'variant',
                anyOf: [
                  {
                    property: 'audience',
                    operator: 'equals',
                    targetValue: 'basic',
                    _key: 'c826626167fa',
                    _type: 'rule',
                  },
                ],
                value: '/images/john-casual.jpg',
              },
            ],
          } satisfies DecideField,
          social: {
            twitter: '@johndoe',
            decideLinkedIn: {
              _type: 'sanity.decideField',
              default: null,
              variants: [
                {
                  _key: 'c826626167fa',
                  _type: 'variant',
                  anyOf: [
                    {
                      property: 'audience',
                      operator: 'equals',
                      targetValue: 'premium',
                      _key: 'c826626167fa',
                      _type: 'rule',
                    },
                  ],
                  value: 'https://linkedin.com/in/johndoe',
                },
              ],
            } satisfies DecideField,
          },
        },
      },
      content: {
        decideIntro: {
          _type: 'sanity.decideField',
          default: 'Welcome to this blog post.',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'premium',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
              value: 'Welcome to our premium content series.',
            },
            {
              _key: 'c826626167fa',
              _type: 'variant',
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'basic',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
              value: 'Welcome! Here are some basic tips.',
            },
          ],
        } satisfies DecideField,
        sections: [
          {
            title: 'Section 1',
            decideContent: {
              _type: 'sanity.decideField',
              default: 'Basic content here.',
              variants: [
                {
                  _key: 'c826626167fa',
                  _type: 'variant',
                  anyOf: [
                    {
                      property: 'audience',
                      operator: 'equals',
                      targetValue: 'premium',
                      _key: 'c826626167fa',
                      _type: 'rule',
                    },
                  ],
                  value: 'Advanced insights and detailed analysis.',
                },
                {
                  _key: 'c826626167fa',
                  _type: 'variant',
                  anyOf: [
                    {
                      property: 'audience',
                      operator: 'equals',
                      targetValue: 'basic',
                      _key: 'c826626167fa',
                      _type: 'rule',
                    },
                  ],
                  value: 'Simple overview and tips.',
                },
              ],
            } satisfies DecideField,
            subsections: [
              {
                heading: 'Subsection A',
                decideText: {
                  _type: 'sanity.decideField',
                  default: 'Standard text',
                  variants: [
                    {
                      _key: 'c826626167fa',
                      _type: 'variant',
                      anyOf: [
                        {
                          property: 'audience',
                          operator: 'equals',
                          targetValue: 'premium',
                          _key: 'c826626167fa',
                          _type: 'rule',
                        },
                      ],
                      value: 'Detailed technical explanation',
                    },
                  ],
                } satisfies DecideField,
              },
            ],
          },
          {
            title: 'Section 2',
            decideContent: {
              _type: 'sanity.decideField',
              default: 'More basic content.',
              variants: [
                {
                  _key: 'c826626167fa',
                  _type: 'variant',
                  anyOf: [
                    {
                      property: 'audience',
                      operator: 'equals',
                      targetValue: 'premium',
                      _key: 'c826626167fa',
                      _type: 'rule',
                    },
                  ],
                  value: 'Expert-level strategies and methods.',
                },
              ],
            } satisfies DecideField,
          },
        ],
      },
      metadata: {
        tags: ['tech', 'blog'],
        decidePriority: {
          _type: 'sanity.decideField',
          default: 'normal',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              anyOf: [
                {
                  property: 'audience',
                  operator: 'equals',
                  targetValue: 'premium',
                  _key: 'c826626167fa',
                  _type: 'rule',
                },
              ],
              value: 'high',
            },
          ],
        } satisfies DecideField,
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
  describe('should resolve with multiple required variants', () => {
    test('should resolve with multiple required variants', () => {
      const field: DecideField = {
        _type: 'sanity.decideField',
        default: 'default',
        variants: [
          {
            _key: 'c826626167fa',
            _type: 'variant',
            value: 'audience a male',
            anyOf: [
              {
                _key: '5e2778824236',
                _type: 'rule',
                operator: 'equals',
                property: 'audience',
                targetValue: 'aud-a',
                and: [
                  {
                    _key: '5e2778824236',
                    _type: 'rule',
                    operator: 'equals',
                    property: 'gender',
                    targetValue: 'male',
                  },
                ],
              },
            ],
          },
          {
            _key: 'c826626167fa',
            _type: 'variant',
            value: 'audience a female',
            anyOf: [
              {
                _key: '5e2778824236',
                _type: 'rule',
                operator: 'equals',
                property: 'audience',
                targetValue: 'aud-a',
                and: [
                  {
                    _key: '5e2778824236',
                    _type: 'rule',
                    operator: 'equals',
                    property: 'gender',
                    targetValue: 'female',
                  },
                ],
              },
            ],
          },
        ],
      }
      expect(resolveDecideField(field, {audience: 'aud-a'})).toBe('default')
      expect(resolveDecideField(field, {audience: 'aud-a', gender: 'female'})).toBe(
        'audience a female',
      )
      expect(resolveDecideField(field, {audience: 'aud-a', gender: 'male'})).toBe('audience a male')
      expect(resolveDecideField(field, {audience: 'aud-a', gender: 'male', age: 30})).toBe(
        'audience a male',
      )
      expect(resolveDecideField(field, {audience: 'aud-a', gender: 'female', age: 30})).toBe(
        'audience a female',
      )
      expect(resolveDecideField(field, {audience: 'aud-a', age: 30})).toBe('default')
    })
  })

  describe('should resolve every condition type and value', () => {
    describe('string variants', () => {
      test('should resolve "equals" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'equals',
                  property: 'audience',
                  targetValue: 'aud-a',
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {audience: ''})).toBe('default')
        expect(resolveDecideField(field, {audience: 'aud-a'})).toBe('match')
        expect(resolveDecideField(field, {audience: 'aud-b'})).toBe('default')
      })

      test('should resolve "not-equals" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'not-equals',
                  property: 'audience',
                  targetValue: 'aud-a',
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {audience: 'aud-a'})).toBe('default')
        expect(resolveDecideField(field, {audience: 'aud-b'})).toBe('match')
        expect(resolveDecideField(field, {audience: 'aud-c'})).toBe('match')
      })

      test('should resolve "contains" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'contains',
                  property: 'category',
                  targetValue: 'tech',
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {category: ''})).toBe('default')
        expect(resolveDecideField(field, {category: 'technology'})).toBe('match')
        expect(resolveDecideField(field, {category: 'tech'})).toBe('match')
        expect(resolveDecideField(field, {category: 'fintech'})).toBe('match')
        expect(resolveDecideField(field, {category: 'finance'})).toBe('default')
      })

      test('should resolve "not-contains" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'not-contains',
                  property: 'category',
                  targetValue: 'tech',
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {category: 'technology'})).toBe('default')
        expect(resolveDecideField(field, {category: 'tech'})).toBe('default')
        expect(resolveDecideField(field, {category: 'fintech'})).toBe('default')
        expect(resolveDecideField(field, {category: 'finance'})).toBe('match')
        expect(resolveDecideField(field, {category: 'sports'})).toBe('match')
      })

      test('should resolve "is-empty" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'is-empty',
                  property: 'name',
                  targetValue: '',
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {name: ''})).toBe('match')
        expect(resolveDecideField(field, {name: 'John'})).toBe('default')
        expect(resolveDecideField(field, {name: ' '})).toBe('default')
      })

      test('should resolve "is-not-empty" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'is-not-empty',
                  property: 'name',
                  targetValue: '',
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {name: ''})).toBe('default')
        expect(resolveDecideField(field, {name: 'John'})).toBe('match')
        expect(resolveDecideField(field, {name: ' '})).toBe('match')
      })
    })

    describe('number variants', () => {
      test('should resolve "equals" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'equals',
                  property: 'age',
                  targetValue: 25,
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {age: 0})).toBe('default')
        expect(resolveDecideField(field, {age: 25})).toBe('match')
        expect(resolveDecideField(field, {age: 30})).toBe('default')
      })

      test('should resolve "not-equals" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'not-equals',
                  property: 'age',
                  targetValue: 25,
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {age: 25})).toBe('default')
        expect(resolveDecideField(field, {age: 24})).toBe('match')
        expect(resolveDecideField(field, {age: 26})).toBe('match')
        expect(resolveDecideField(field, {age: 0})).toBe('match')
      })

      test('should resolve ">" (greater than) operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: '>',
                  property: 'age',
                  targetValue: 18,
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {age: 18})).toBe('default')
        expect(resolveDecideField(field, {age: 17})).toBe('default')
        expect(resolveDecideField(field, {age: 19})).toBe('match')
        expect(resolveDecideField(field, {age: 25})).toBe('match')
      })

      test('should resolve "<" (less than) operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: '<',
                  property: 'age',
                  targetValue: 18,
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {age: 18})).toBe('default')
        expect(resolveDecideField(field, {age: 19})).toBe('default')
        expect(resolveDecideField(field, {age: 17})).toBe('match')
        expect(resolveDecideField(field, {age: 10})).toBe('match')
      })

      test('should resolve ">=" (greater than or equal) operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: '>=',
                  property: 'age',
                  targetValue: 18,
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {age: 17})).toBe('default')
        expect(resolveDecideField(field, {age: 18})).toBe('match')
        expect(resolveDecideField(field, {age: 19})).toBe('match')
        expect(resolveDecideField(field, {age: 25})).toBe('match')
      })

      test('should resolve "<=" (less than or equal) operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: '<=',
                  property: 'age',
                  targetValue: 18,
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {age: 19})).toBe('default')
        expect(resolveDecideField(field, {age: 18})).toBe('match')
        expect(resolveDecideField(field, {age: 17})).toBe('match')
        expect(resolveDecideField(field, {age: 10})).toBe('match')
      })

      test('should resolve "is-empty" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'is-empty',
                  property: 'count',
                  targetValue: 0,
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {count: 0})).toBe('match')
        expect(resolveDecideField(field, {count: 1})).toBe('default')
        expect(resolveDecideField(field, {count: 10})).toBe('default')
      })

      test('should resolve "is-not-empty" operator', () => {
        const field: DecideField = {
          _type: 'sanity.decideField',
          default: 'default',
          variants: [
            {
              _key: 'c826626167fa',
              _type: 'variant',
              value: 'match',
              anyOf: [
                {
                  _key: '5e2778824236',
                  _type: 'rule',
                  operator: 'is-not-empty',
                  property: 'count',
                  targetValue: 0,
                },
              ],
            },
          ],
        }
        expect(resolveDecideField(field, undefined)).toBe('default')
        expect(resolveDecideField(field, {})).toBe('default')
        expect(resolveDecideField(field, {count: 0})).toBe('default')
        expect(resolveDecideField(field, {count: 1})).toBe('match')
        expect(resolveDecideField(field, {count: 10})).toBe('match')
        expect(resolveDecideField(field, {count: -5})).toBe('match')
      })
    })
  })
})
