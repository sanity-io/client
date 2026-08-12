import {
  applySourceDocuments,
  type ContentSourceMap,
  type ContentSourceMapDocuments,
  getDraftId,
  getVersionId,
  type SanityDocument,
} from '@sanity/client/csm'
import {diffString} from 'json-diff'
import {describe, expect, test} from 'vitest'

describe('handling perspectives', () => {
  const ids = {
    george: '294709c3-710d-4dc6-8f6f-f36c4786611a',
    terry: 'd7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74',
    stephen: 'de2baea7-4df7-4eb0-841e-db20103279fc',
    goodOmens: '2c1de490-e7ed-413c-8d23-163d4432bb63',
    fireIce: '8826fb2c-6152-46c0-8d19-079fcd75b438',
    it: 'c8338be2-97b4-4782-bee7-09397c780478',
    windsWinter: '8b671177-113d-4249-ae23-6b50dc017e9e',
  } as const
  const releases = {
    one: 'rABC123',
    two: 'rDEF456',
    three: 'rGHI789',
  } as const

  const dataset = [
    {
      _createdAt: '2024-01-09T11:10:46Z',
      _rev: 'D3N5P3XyAZ16DNFKjiRI0q',
      _type: 'author',
      name: 'George Martin (published)',
      _id: ids.george,
      _updatedAt: '2024-01-09T15:58:47Z',
    },
    {
      _createdAt: '2024-01-09T11:10:46Z',
      _rev: 'D3N5P3XyAZ16DNFKjiRI0q',
      _type: 'author',
      name: `George Martin (${releases.one})`,
      _id: getVersionId(ids.george, releases.one),
      _updatedAt: '2024-01-09T15:58:47Z',
    },
    {
      author: {
        _ref: ids.terry,
        _type: 'reference',
      },
      _createdAt: '2024-01-09T13:46:42Z',
      _rev: '4CNIu3sfkQOfiJtCaJf66J',
      _type: 'book',
      _id: ids.goodOmens,
      title: 'Good Omens (published)',
      _updatedAt: '2024-01-09T16:00:04Z',
    },
    {
      author: {
        _ref: ids.terry,
        _type: 'reference',
      },
      _createdAt: '2024-01-09T13:46:42Z',
      _rev: '4CNIu3sfkQOfiJtCaJf66J',
      _type: 'book',
      _id: getVersionId(ids.goodOmens, releases.three),
      title: `Good Omens (${releases.three})`,
      _updatedAt: '2024-01-09T16:00:04Z',
    },
    {
      title: 'Fire & Ice (published)',
      _updatedAt: '2024-01-09T15:59:33Z',
      author: {
        _ref: ids.george,
        _type: 'reference',
      },
      _createdAt: '2024-01-09T10:58:07Z',
      _rev: '4CNIu3sfkQOfiJtCaJf4ix',
      _type: 'book',
      _id: ids.fireIce,
    },
    {
      title: `Fire & Ice (${releases.two})`,
      _updatedAt: '2024-01-09T15:59:33Z',
      author: {
        _ref: ids.george,
        _type: 'reference',
      },
      _createdAt: '2024-01-09T10:58:07Z',
      _rev: '4CNIu3sfkQOfiJtCaJf4ix',
      _type: 'book',
      _id: getVersionId(ids.fireIce, releases.two),
    },
    {
      _rev: '4CNIu3sfkQOfiJtCaJf0OF',
      _type: 'author',
      name: 'Terry Pratchett (published)',
      _id: ids.terry,
      _updatedAt: '2024-01-09T15:58:08Z',
      _createdAt: '2024-01-09T13:45:33Z',
    },
    {
      _rev: '4CNIu3sfkQOfiJtCaJf0OF',
      _type: 'author',
      name: `Terry Pratchett (${releases.three})`,
      _id: getVersionId(ids.terry, releases.three),
      _updatedAt: '2024-01-09T15:58:08Z',
      _createdAt: '2024-01-09T13:45:33Z',
    },
    {
      _type: 'author',
      name: 'George R.R. Martin (draft)',
      _id: getDraftId(ids.george),
      _updatedAt: '2024-01-09T15:58:54Z',
      _createdAt: '2024-01-09T11:10:46Z',
      _rev: '8b3babb0-2e94-4483-a975-e1c0530631ab',
    },
    {
      author: {
        _strengthenOnPublish: {
          type: 'author',
        },
        _weak: true,
        _ref: ids.stephen,
        _type: 'reference',
      },
      _createdAt: '2024-01-09T10:58:07Z',
      _rev: '3480a3e1-d8b4-49c9-8da8-70b85489dd05',
      _type: 'book',
      _id: getDraftId(ids.it),
      title: 'It (draft)',
      _updatedAt: '2024-01-09T15:59:48Z',
    },
    {
      author: {
        _strengthenOnPublish: {
          type: 'author',
        },
        _weak: true,
        _ref: ids.stephen,
        _type: 'reference',
      },
      _createdAt: '2024-01-09T10:58:07Z',
      _rev: '3480a3e1-d8b4-49c9-8da8-70b85489dd05',
      _type: 'book',
      _id: getVersionId(ids.it, releases.two),
      title: `It (${releases.two})`,
      _updatedAt: '2024-01-09T15:59:48Z',
    },
    {
      _updatedAt: '2024-01-09T16:00:13Z',
      author: {
        _ref: ids.george,
        _type: 'reference',
      },
      _createdAt: '2024-01-09T13:51:54Z',
      _rev: 'c891041e-12d9-45f1-b487-ba41283ed918',
      _type: 'book',
      _id: getDraftId(ids.windsWinter),
      title: 'The Winds of Winter (draft)',
    },
    {
      _updatedAt: '2024-01-09T15:58:16Z',
      _createdAt: '2024-01-09T11:17:15Z',
      _rev: 'bfa045fa-4936-4eb3-978a-bdd9316ba837',
      _type: 'author',
      name: 'Stephen King (draft)',
      _id: getDraftId(ids.stephen),
    },
    {
      _updatedAt: '2024-01-09T15:58:16Z',
      _createdAt: '2024-01-09T11:17:15Z',
      _rev: 'bfa045fa-4936-4eb3-978a-bdd9316ba837',
      _type: 'author',
      name: `Stephen King (${releases.one})`,
      _id: getVersionId(ids.stephen, releases.one),
    },
  ] as const satisfies SanityDocument[]
  const getCachedDocument: (
    sourceDocument: ContentSourceMapDocuments[number],
  ) => SanityDocument | undefined = (sourceDocument) => {
    return dataset.find((doc) => doc._id === sourceDocument._id)
  }
  test('perspective: published', () => {
    const mock = {
      query: '*[_type == "book"]{\n  _id,_originalId,title,author->{_id,_originalId,name}\n}',
      result: [
        {
          _id: ids.goodOmens,
          _originalId: null,
          title: 'Good Omens',
          author: {
            _id: ids.terry,
            _originalId: null,
            name: 'Terry Pratchett',
          },
        },
        {
          _id: ids.fireIce,
          _originalId: null,
          title: 'Fire & Ice',
          author: {
            _id: ids.george,
            _originalId: null,
            name: 'George Martin',
          },
        },
      ],
      resultSourceMap: {
        documents: [
          {
            _id: ids.goodOmens,
            _type: 'book',
          },
          {
            _id: ids.terry,
            _type: 'author',
          },
          {
            _id: ids.fireIce,
            _type: 'book',
          },
          {
            _id: ids.george,
            _type: 'author',
          },
        ],
        paths: ["$['_id']", "$['title']", "$['name']"],
        mappings: {
          "$[0]['_id']": {
            source: {
              document: 0,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['author']['_id']": {
            source: {
              document: 1,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['author']['name']": {
            source: {
              document: 1,
              path: 2,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['title']": {
            source: {
              document: 0,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['_id']": {
            source: {
              document: 2,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['author']['_id']": {
            source: {
              document: 3,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['author']['name']": {
            source: {
              document: 3,
              path: 2,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['title']": {
            source: {
              document: 2,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
        },
      },
      ms: 12,
    } as const satisfies {
      query: string
      result: unknown
      resultSourceMap: ContentSourceMap
      ms: number
    }

    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          'published',
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
           _originalId: null
      -    title: "Good Omens"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
             _originalId: null
      -      name: "Terry Pratchett"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "8826fb2c-6152-46c0-8d19-079fcd75b438"
           _originalId: null
      -    title: "Fire & Ice"
      +    title: "Fire & Ice (published)"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
             _originalId: null
      -      name: "George Martin"
      +      name: "George Martin (published)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          'previewDrafts',
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
           _originalId: null
      -    title: "Good Omens"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
             _originalId: null
      -      name: "Terry Pratchett"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "8826fb2c-6152-46c0-8d19-079fcd75b438"
           _originalId: null
      -    title: "Fire & Ice"
      +    title: "Fire & Ice (published)"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
             _originalId: null
      -      name: "George Martin"
      +      name: "George R.R. Martin (draft)"
           }
         }
       ]
      "
    `)
  })
  test('perspective: previewDrafts', () => {
    const mock = {
      query: '*[_type == "book"]{\n  _id,_originalId,title,author->{_id,_originalId,name}\n}',
      result: [
        {
          _id: ids.goodOmens,
          _originalId: ids.goodOmens,
          title: 'Good Omens',
          author: {
            _id: ids.terry,
            _originalId: ids.terry,
            name: 'Terry Pratchett',
          },
        },
        {
          _id: ids.it,
          _originalId: getDraftId(ids.it),
          title: 'It',
          author: {
            _id: ids.stephen,
            _originalId: getDraftId(ids.stephen),
            name: 'Stephen King',
          },
        },
        {
          _id: ids.windsWinter,
          _originalId: getDraftId(ids.windsWinter),
          title: 'The Winds of Winter',
          author: {
            _id: ids.george,
            _originalId: getDraftId(ids.george),
            name: 'George R.R. Martin',
          },
        },
      ],
      resultSourceMap: {
        documents: [
          {
            _id: ids.goodOmens,
            _type: 'book',
          },
          {
            _id: ids.terry,
            _type: 'author',
          },
          {
            _id: getDraftId(ids.it),
            _type: 'book',
          },
          {
            _id: getDraftId(ids.stephen),
            _type: 'author',
          },
          {
            _id: getDraftId(ids.windsWinter),
            _type: 'book',
          },
          {
            _id: getDraftId(ids.george),
            _type: 'author',
          },
        ],
        paths: ["$['_id']", "$['_originalId']", "$['title']", "$['name']"],
        mappings: {
          "$[0]['_id']": {
            source: {
              document: 0,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['_originalId']": {
            source: {
              document: 0,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['author']['_id']": {
            source: {
              document: 1,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['author']['_originalId']": {
            source: {
              document: 1,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['author']['name']": {
            source: {
              document: 1,
              path: 3,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['title']": {
            source: {
              document: 0,
              path: 2,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['_id']": {
            source: {
              document: 2,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['_originalId']": {
            source: {
              document: 2,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['author']['_id']": {
            source: {
              document: 3,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['author']['_originalId']": {
            source: {
              document: 3,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['author']['name']": {
            source: {
              document: 3,
              path: 3,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['title']": {
            source: {
              document: 2,
              path: 2,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['_id']": {
            source: {
              document: 4,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['_originalId']": {
            source: {
              document: 4,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['author']['_id']": {
            source: {
              document: 5,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['author']['_originalId']": {
            source: {
              document: 5,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['author']['name']": {
            source: {
              document: 5,
              path: 3,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['title']": {
            source: {
              document: 4,
              path: 2,
              type: 'documentValue',
            },
            type: 'value',
          },
        },
      },
      ms: 2881,
    } as const satisfies {
      query: string
      result: unknown
      resultSourceMap: ContentSourceMap
      ms: number
    }

    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          'published',
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
           _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
             _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
           _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
           title: "It"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
             _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
             name: "Stephen King"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
           title: "The Winds of Winter"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      +      _originalId: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George Martin (published)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          'previewDrafts',
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
           _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
             _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
           _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
      -    title: "It"
      +    title: "It (draft)"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
             _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
      -      name: "Stephen King"
      +      name: "Stephen King (draft)"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
      -    title: "The Winds of Winter"
      +    title: "The Winds of Winter (draft)"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
             _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George R.R. Martin (draft)"
           }
         }
       ]
      "
    `)
  })

  test('perspective: rABC123,rDFG456,drafts', () => {
    const mock = {
      query: '*[_type == "book"]{\n  _id,_originalId,title,author->{_id,_originalId,name}\n}',
      result: [
        {
          _id: ids.goodOmens,
          _originalId: getVersionId(ids.goodOmens, releases.three),
          title: `Good Omens (${releases.three})`,
          author: {
            _id: ids.terry,
            _originalId: getVersionId(ids.terry, releases.three),
            name: `Terry Pratchett (${releases.three})`,
          },
        },
        {
          _id: ids.it,
          _originalId: getDraftId(ids.it),
          title: 'It',
          author: {
            _id: ids.stephen,
            _originalId: getDraftId(ids.stephen),
            name: 'Stephen King',
          },
        },
        {
          _id: ids.windsWinter,
          _originalId: getDraftId(ids.windsWinter),
          title: 'The Winds of Winter',
          author: {
            _id: ids.george,
            _originalId: getDraftId(ids.george),
            name: 'George R.R. Martin',
          },
        },
      ],
      resultSourceMap: {
        documents: [
          {
            _id: getVersionId(ids.goodOmens, releases.three),
            _type: 'book',
          },
          {
            _id: getVersionId(ids.terry, releases.three),
            _type: 'author',
          },
          {
            _id: getDraftId(ids.it),
            _type: 'book',
          },
          {
            _id: getDraftId(ids.stephen),
            _type: 'author',
          },
          {
            _id: getDraftId(ids.windsWinter),
            _type: 'book',
          },
          {
            _id: getDraftId(ids.george),
            _type: 'author',
          },
        ],
        paths: ["$['_id']", "$['_originalId']", "$['title']", "$['name']"],
        mappings: {
          "$[0]['_id']": {
            source: {
              document: 0,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['_originalId']": {
            source: {
              document: 0,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['author']['_id']": {
            source: {
              document: 1,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['author']['_originalId']": {
            source: {
              document: 1,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['author']['name']": {
            source: {
              document: 1,
              path: 3,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[0]['title']": {
            source: {
              document: 0,
              path: 2,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['_id']": {
            source: {
              document: 2,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['_originalId']": {
            source: {
              document: 2,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['author']['_id']": {
            source: {
              document: 3,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['author']['_originalId']": {
            source: {
              document: 3,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['author']['name']": {
            source: {
              document: 3,
              path: 3,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[1]['title']": {
            source: {
              document: 2,
              path: 2,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['_id']": {
            source: {
              document: 4,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['_originalId']": {
            source: {
              document: 4,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['author']['_id']": {
            source: {
              document: 5,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['author']['_originalId']": {
            source: {
              document: 5,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['author']['name']": {
            source: {
              document: 5,
              path: 3,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$[2]['title']": {
            source: {
              document: 4,
              path: 2,
              type: 'documentValue',
            },
            type: 'value',
          },
        },
      },
      ms: 2881,
    } as const satisfies {
      query: string
      result: unknown
      resultSourceMap: ContentSourceMap
      ms: number
    }

    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          'published',
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    _originalId: "versions.rGHI789.2c1de490-e7ed-413c-8d23-163d4432bb63"
      +    _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens (rGHI789)"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      _originalId: "versions.rGHI789.d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      +      _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett (rGHI789)"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
           _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
           title: "It"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
             _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
             name: "Stephen King"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
           title: "The Winds of Winter"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      +      _originalId: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George Martin (published)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          ['drafts'],
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    _originalId: "versions.rGHI789.2c1de490-e7ed-413c-8d23-163d4432bb63"
      +    _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens (rGHI789)"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      _originalId: "versions.rGHI789.d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      +      _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett (rGHI789)"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
           _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
      -    title: "It"
      +    title: "It (draft)"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
             _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
      -      name: "Stephen King"
      +      name: "Stephen King (draft)"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
      -    title: "The Winds of Winter"
      +    title: "The Winds of Winter (draft)"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
             _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George R.R. Martin (draft)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          [releases.one],
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    _originalId: "versions.rGHI789.2c1de490-e7ed-413c-8d23-163d4432bb63"
      +    _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens (rGHI789)"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      _originalId: "versions.rGHI789.d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      +      _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett (rGHI789)"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
           _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
           title: "It"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
      -      _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
      +      _originalId: "versions.rABC123.de2baea7-4df7-4eb0-841e-db20103279fc"
      -      name: "Stephen King"
      +      name: "Stephen King (rABC123)"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
           title: "The Winds of Winter"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      +      _originalId: "versions.rABC123.294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George Martin (rABC123)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          [releases.two],
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    _originalId: "versions.rGHI789.2c1de490-e7ed-413c-8d23-163d4432bb63"
      +    _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens (rGHI789)"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      _originalId: "versions.rGHI789.d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      +      _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett (rGHI789)"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
      -    _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
      +    _originalId: "versions.rDEF456.c8338be2-97b4-4782-bee7-09397c780478"
      -    title: "It"
      +    title: "It (rDEF456)"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
             _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
             name: "Stephen King"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
           title: "The Winds of Winter"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      +      _originalId: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George Martin (published)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          [releases.one, 'drafts'],
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    _originalId: "versions.rGHI789.2c1de490-e7ed-413c-8d23-163d4432bb63"
      +    _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens (rGHI789)"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      _originalId: "versions.rGHI789.d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      +      _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett (rGHI789)"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
           _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
      -    title: "It"
      +    title: "It (draft)"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
      -      _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
      +      _originalId: "versions.rABC123.de2baea7-4df7-4eb0-841e-db20103279fc"
      -      name: "Stephen King"
      +      name: "Stephen King (rABC123)"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
      -    title: "The Winds of Winter"
      +    title: "The Winds of Winter (draft)"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      +      _originalId: "versions.rABC123.294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George Martin (rABC123)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          [releases.two, 'drafts'],
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    _originalId: "versions.rGHI789.2c1de490-e7ed-413c-8d23-163d4432bb63"
      +    _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens (rGHI789)"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      _originalId: "versions.rGHI789.d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      +      _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett (rGHI789)"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
      -    _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
      +    _originalId: "versions.rDEF456.c8338be2-97b4-4782-bee7-09397c780478"
      -    title: "It"
      +    title: "It (rDEF456)"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
             _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
      -      name: "Stephen King"
      +      name: "Stephen King (draft)"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
      -    title: "The Winds of Winter"
      +    title: "The Winds of Winter (draft)"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
             _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George R.R. Martin (draft)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          [releases.one, releases.two, 'drafts'],
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    _originalId: "versions.rGHI789.2c1de490-e7ed-413c-8d23-163d4432bb63"
      +    _originalId: "2c1de490-e7ed-413c-8d23-163d4432bb63"
      -    title: "Good Omens (rGHI789)"
      +    title: "Good Omens (published)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      _originalId: "versions.rGHI789.d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      +      _originalId: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
      -      name: "Terry Pratchett (rGHI789)"
      +      name: "Terry Pratchett (published)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
      -    _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
      +    _originalId: "versions.rDEF456.c8338be2-97b4-4782-bee7-09397c780478"
      -    title: "It"
      +    title: "It (rDEF456)"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
      -      _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
      +      _originalId: "versions.rABC123.de2baea7-4df7-4eb0-841e-db20103279fc"
      -      name: "Stephen King"
      +      name: "Stephen King (rABC123)"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
      -    title: "The Winds of Winter"
      +    title: "The Winds of Winter (draft)"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      +      _originalId: "versions.rABC123.294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George Martin (rABC123)"
           }
         }
       ]
      "
    `)
    expect(
      diffString(
        mock.result,
        applySourceDocuments(
          mock.result,
          mock.resultSourceMap,
          getCachedDocument,
          (changedValue) => changedValue,
          [releases.one, releases.two, releases.three, 'drafts'],
        ),
        {color: false, full: true},
      ),
    ).toMatchInlineSnapshot(`
      " [
         {
           _id: "2c1de490-e7ed-413c-8d23-163d4432bb63"
           _originalId: "versions.rGHI789.2c1de490-e7ed-413c-8d23-163d4432bb63"
           title: "Good Omens (rGHI789)"
           author: {
             _id: "d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
             _originalId: "versions.rGHI789.d7e0f612-ab9b-4fbb-ad1e-090f6e9d0a74"
             name: "Terry Pratchett (rGHI789)"
           }
         }
         {
           _id: "c8338be2-97b4-4782-bee7-09397c780478"
      -    _originalId: "drafts.c8338be2-97b4-4782-bee7-09397c780478"
      +    _originalId: "versions.rDEF456.c8338be2-97b4-4782-bee7-09397c780478"
      -    title: "It"
      +    title: "It (rDEF456)"
           author: {
             _id: "de2baea7-4df7-4eb0-841e-db20103279fc"
      -      _originalId: "drafts.de2baea7-4df7-4eb0-841e-db20103279fc"
      +      _originalId: "versions.rABC123.de2baea7-4df7-4eb0-841e-db20103279fc"
      -      name: "Stephen King"
      +      name: "Stephen King (rABC123)"
           }
         }
         {
           _id: "8b671177-113d-4249-ae23-6b50dc017e9e"
           _originalId: "drafts.8b671177-113d-4249-ae23-6b50dc017e9e"
      -    title: "The Winds of Winter"
      +    title: "The Winds of Winter (draft)"
           author: {
             _id: "294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      _originalId: "drafts.294709c3-710d-4dc6-8f6f-f36c4786611a"
      +      _originalId: "versions.rABC123.294709c3-710d-4dc6-8f6f-f36c4786611a"
      -      name: "George R.R. Martin"
      +      name: "George Martin (rABC123)"
           }
         }
       ]
      "
    `)
  })
})
