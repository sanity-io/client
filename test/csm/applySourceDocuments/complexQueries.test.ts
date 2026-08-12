import {applySourceDocuments, type ContentSourceMap} from '@sanity/client/csm'
import {describe, expect, test} from 'vitest'

describe('complex queries', () => {
  test('Can apply an array keyed field update', () => {
    const result = {
      page: {
        _type: 'page',
        _id: 'drafts.home',
        title: 'Home',
        sections: [
          {
            symbol: null,
            products: null,
            _type: 'hero',
            tagline: 'ACME’s elegant construction is both minimal and inviting.',
            headline: 'Touch of Texture ',
            subline: 'You can follow us on Twitter, Twitch, LinkedIn, and GitHub.',
            style: {
              _type: 'sectionStyle',
              variant: 'default',
            },
            _key: '44540ccd70c3',
            product: null,
          },
        ],
      },
    }
    const resultSourceMap = {
      documents: [
        {
          _id: 'drafts.home',
          _type: 'page',
        },
        {
          _id: 'drafts.462efcc6-3c8b-47c6-8474-5544e1a4acde',
          _type: 'product',
        },
        {
          _id: 'drafts.e1bf9f1f-efdb-4105-8c26-6b64f897e9c1',
          _type: 'product',
        },
        {
          _id: 'drafts.807cc05c-8c4c-443a-a9c1-198fd3fd7b16',
          _type: 'product',
        },
        {
          _id: 'drafts.siteSettings',
          _type: 'siteSettings',
        },
      ],
      paths: [
        "$['_type']",
        "$['_id']",
        "$['title']",
        "$['sections'][?(@._key=='44540ccd70c3')]['style']",
        "$['sections'][?(@._key=='44540ccd70c3')]['_key']",
        "$['sections'][?(@._key=='44540ccd70c3')]['_type']",
        "$['sections'][?(@._key=='44540ccd70c3')]['tagline']",
        "$['sections'][?(@._key=='44540ccd70c3')]['headline']",
        "$['sections'][?(@._key=='44540ccd70c3')]['subline']",
      ],
      mappings: {
        "$['page']['_id']": {
          source: {
            document: 0,
            path: 1,
            type: 'documentValue',
          },
          type: 'value',
        },
        "$['page']['_type']": {
          source: {
            document: 0,
            path: 0,
            type: 'documentValue',
          },
          type: 'value',
        },
        "$['page']['sections'][0]['_key']": {
          source: {
            document: 0,
            path: 4,
            type: 'documentValue',
          },
          type: 'value',
        },
        "$['page']['sections'][0]['_type']": {
          source: {
            document: 0,
            path: 5,
            type: 'documentValue',
          },
          type: 'value',
        },
        "$['page']['sections'][0]['headline']": {
          source: {
            document: 0,
            path: 7,
            type: 'documentValue',
          },
          type: 'value',
        },
        "$['page']['sections'][0]['style']": {
          source: {
            document: 0,
            path: 3,
            type: 'documentValue',
          },
          type: 'value',
        },
        "$['page']['sections'][0]['subline']": {
          source: {
            document: 0,
            path: 8,
            type: 'documentValue',
          },
          type: 'value',
        },
        "$['page']['sections'][0]['tagline']": {
          source: {
            document: 0,
            path: 6,
            type: 'documentValue',
          },
          type: 'value',
        },
      },
    } satisfies ContentSourceMap
    // In this draft the headline "Touch of Texture 1" is changed
    const draft = {
      _createdAt: '2023-06-27T14:35:36Z',
      _id: 'drafts.home',
      _rev: '3b8d3273-43ec-471c-9629-1ab5e0e894fa',
      _type: 'page',
      _updatedAt: '2023-10-26T13:22:12.692Z',
      sections: [
        {
          _key: '44540ccd70c3',
          _type: 'hero',
          headline: 'Touch of Texture 1',
          style: {
            _type: 'sectionStyle',
            variant: 'default',
          },
          subline: 'You can follow us on Twitter, Twitch, LinkedIn, and GitHub.',
          tagline: 'ACME’s elegant construction is both minimal and inviting.',
        },
      ],
      title: 'Home',
    }

    const optimisticResult = applySourceDocuments(
      result,
      resultSourceMap,
      (sourceDocument) => (sourceDocument._id === draft._id ? draft : undefined),
      (changedValue) => changedValue,
      'previewDrafts',
    )
    expect(result.page.sections[0].headline).not.toBe(draft.sections[0].headline)
    expect(optimisticResult.page.sections[0].headline).toBe(draft.sections[0].headline)
  })
})
