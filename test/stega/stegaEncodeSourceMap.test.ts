import {vercelStegaDecodeAll} from '@vercel/stega'
import {expect, test, vi} from 'vitest'

import {stegaEncodeSourceMap} from '../../src/stega/stegaEncodeSourceMap'
import type {ContentSourceMap, Logger} from '../../src/stega/types'
import stegaSnapshotContentReleases from './stegaSnapshotContentReleases.json' with {type: 'json'}

const mock = {
  query:
    '{\n  "products": *[_type == "product" && defined(slug.current)]{\n    _id,\n    title,\n    description,\n    slug,\n    "media": media[0]\n  },\n  "siteSettings": *[_id == "siteSettings"][0]{\n    title,\n    copyrightText\n  }\n}',
  result: {
    products: [
      {
        description: [
          {
            markDefs: [],
            children: [
              {
                _key: '6a057cf2fb310',
                _type: 'span',
                marks: [],
                text: 'After revisiting one of its best-selling pendants, ACME presents the new and improved Akoya. The original hand-blown, opal glass bulb now boasts increased technical capabilities, as well as more refined perforations to its sheer, spun-aluminum shade. With Akoya’s shades now fabricated in North America, we’ve also cut down our carbon footprint by manufacturing closer to home.',
              },
            ],
            _type: 'block',
            style: 'normal',
            _key: 'd8fa6d59e49b',
          },
        ],
        slug: {
          current: 'akoya',
          _type: 'slug',
        },
        media: {
          _type: 'image',
          alt: 'A Scandi minimal lamp with round bulb',
          _key: 'cee5fbb69da2',
          asset: {
            _ref: 'image-a75b03fdd5b5fa36947bf2b776a542e0c940f682-1000x1500-jpg',
            _type: 'reference',
          },
        },
        _id: '462efcc6-3c8b-47c6-8474-5544e1a4acde',
        title: 'Akoyas - the greatest lamp ever',
      },
      {
        _id: '807cc05c-8c4c-443a-a9c1-198fd3fd7b16',
        title: 'All sew',
        description: [
          {
            _type: 'block',
            style: 'normal',
            _key: '60b5ed16f4cc',
            markDefs: [],
            children: [
              {
                _type: 'span',
                marks: [],
                text: 'All sew, our modular, scalable pendant inspired by the luminosity of lanterns, and the lightweight, collapsible efficiency of kites.',
                _key: '0ebc1c5b37350',
              },
            ],
          },
          {
            children: [
              {
                text: '',
                _key: 'ad7206c98f29',
                _type: 'span',
                marks: [],
              },
            ],
            _type: 'block',
            style: 'normal',
            _key: '5d457324f980',
            markDefs: [],
          },
          {
            _key: '782db3651957',
            markDefs: [],
            children: [
              {
                marks: [],
                text: 'Another row.',
                _key: 'cbd1965e0d78',
                _type: 'span',
              },
            ],
            _type: 'block',
            style: 'normal',
          },
        ],
        slug: {
          _type: 'slug',
          current: 'all-sew',
        },
        media: {
          _type: 'image',
          alt: 'A glorious lamp pendant thingy',
          _key: '55659c72ec46',
          asset: {
            _ref: 'image-c46098d15d7e75080ba279c09f2ea88f24736eb0-1000x1500-jpg',
            _type: 'reference',
          },
        },
      },
      {
        _id: 'a643da0c-2cc6-439e-92b7-9f31c822ee05',
        title: 'Test',
        description: [
          {
            markDefs: [],
            children: [
              {
                _type: 'span',
                marks: [],
                text: 'asldkmsa ldkmasdlka msdlkamdskam ldamsdlk amsdlkamslkdmas lkamsld kamsdlkasm dlkasm lkamsdlka smakld mlamsdlk amlsdkam sldkmslk mdaslkdm alkdmk',
                _key: 'd53c7c4c3314',
              },
            ],
            _type: 'block',
            style: 'normal',
            _key: '94e937616df1',
          },
          {
            style: 'normal',
            _key: '65f554bf0220',
            markDefs: [],
            children: [
              {
                _type: 'span',
                marks: [],
                text: '',
                _key: '633d1506e24f',
              },
            ],
            _type: 'block',
          },
          {
            _key: '7c6bbc4dc6c9',
            markDefs: [],
            children: [
              {
                _type: 'span',
                marks: [],
                text: 'okokok',
                _key: '4f27de6e55d8',
              },
            ],
            _type: 'block',
            style: 'normal',
          },
        ],
        slug: {
          current: 'test',
          _type: 'slug',
        },
        media: {
          _type: 'image',
          _key: 'f304342d5bb0',
          asset: {
            _ref: 'image-9d18bc376926c8e0b27a71adf95002d64ef65684-2200x2500-jpg',
            _type: 'reference',
          },
        },
      },
      {
        media: {
          _key: '3239041c90c8',
          asset: {
            _ref: 'image-c5f75081a501ac31a648253fc9533348602fe628-1000x1500-jpg',
            _type: 'reference',
          },
          _type: 'image',
        },
        _id: 'c9de5527-ebd9-4f90-8c30-a26e3439ca2d',
        title: 'AllSew Reclaimed',
        description: [
          {
            style: 'normal',
            _key: '85cce8f03c3c',
            markDefs: [],
            children: [
              {
                _type: 'span',
                marks: [],
                text: 'Allsew, our modular, scalable pendant inspired by the luminosity of lanterns, and the lightweight, collapsible efficiency of kites.',
                _key: '1689e57dff090',
              },
            ],
            _type: 'block',
          },
        ],
        slug: {
          current: 'all-sew-reclaimed',
          _type: 'slug',
        },
      },
      {
        description: [
          {
            _key: 'b61f8576b42b',
            markDefs: [],
            children: [
              {
                _type: 'span',
                marks: [],
                text: 'Meet Ripple, a new sconce and flush mount collection distinguished by its substantial solid glass shade. A unique texture of raised, concentric rings brings to mind ripples coursing along the surface of water.',
                _key: '625afd80ca530',
              },
            ],
            _type: 'block',
            style: 'normal',
          },
        ],
        slug: {
          current: 'ripple-sconce',
          _type: 'slug',
        },
        media: {
          _type: 'image',
          _key: 'c3c15f50cc9b',
          asset: {
            _ref: 'image-bd59994447e4618b1075c24b8fd519eaf69b4fd5-1200x1800-jpg',
            _type: 'reference',
          },
        },
        _id: 'e1bf9f1f-efdb-4105-8c26-6b64f897e9c1',
        title: 'Ripple 1996-12-20T00:39:57Z Sconce',
      },
    ],
    siteSettings: {
      title: 'acme',
      copyrightText: 'acme © 2023 — all rights reserved',
      lastModified: '2024-01-01',
    },
  },
  resultSourceMap: {
    documents: [
      {
        _id: 'drafts.462efcc6-3c8b-47c6-8474-5544e1a4acde',
        _type: 'product',
      },
      {
        _id: 'drafts.807cc05c-8c4c-443a-a9c1-198fd3fd7b16',
        _type: 'product',
      },
      {
        _id: 'drafts.a643da0c-2cc6-439e-92b7-9f31c822ee05',
        _type: 'product',
      },
      {
        _id: 'drafts.c9de5527-ebd9-4f90-8c30-a26e3439ca2d',
        _type: 'product',
      },
      {
        _id: 'drafts.e1bf9f1f-efdb-4105-8c26-6b64f897e9c1',
        _type: 'product',
      },
      {
        _id: 'siteSettings',
        _type: 'siteSettings',
      },
    ],
    paths: [
      "$['description']",
      "$['slug']",
      "$['media'][?(@._key=='cee5fbb69da2')]",
      "$['_id']",
      "$['title']",
      "$['media'][?(@._key=='55659c72ec46')]",
      "$['media'][?(@._key=='f304342d5bb0')]",
      "$['media'][?(@._key=='3239041c90c8')]",
      "$['media'][?(@._key=='c3c15f50cc9b')]",
      "$['copyrightText']",
      "$['lastModified']",
    ],
    mappings: {
      "$['products'][0]['_id']": {
        source: {
          document: 0,
          path: 3,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][0]['description']": {
        source: {
          document: 0,
          path: 0,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][0]['media']": {
        source: {
          document: 0,
          path: 2,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][0]['slug']": {
        source: {
          document: 0,
          path: 1,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][0]['title']": {
        source: {
          document: 0,
          path: 4,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][1]['_id']": {
        source: {
          document: 1,
          path: 3,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][1]['description']": {
        source: {
          document: 1,
          path: 0,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][1]['media']": {
        source: {
          document: 1,
          path: 5,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][1]['slug']": {
        source: {
          document: 1,
          path: 1,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][1]['title']": {
        source: {
          document: 1,
          path: 4,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][2]['_id']": {
        source: {
          document: 2,
          path: 3,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][2]['description']": {
        source: {
          document: 2,
          path: 0,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][2]['media']": {
        source: {
          document: 2,
          path: 6,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][2]['slug']": {
        source: {
          document: 2,
          path: 1,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][2]['title']": {
        source: {
          document: 2,
          path: 4,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][3]['_id']": {
        source: {
          document: 3,
          path: 3,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][3]['description']": {
        source: {
          document: 3,
          path: 0,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][3]['media']": {
        source: {
          document: 3,
          path: 7,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][3]['slug']": {
        source: {
          document: 3,
          path: 1,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][3]['title']": {
        source: {
          document: 3,
          path: 4,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][4]['_id']": {
        source: {
          document: 4,
          path: 3,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][4]['description']": {
        source: {
          document: 4,
          path: 0,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][4]['media']": {
        source: {
          document: 4,
          path: 8,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][4]['slug']": {
        source: {
          document: 4,
          path: 1,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['products'][4]['title']": {
        source: {
          document: 4,
          path: 4,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['siteSettings']['copyrightText']": {
        source: {
          document: 5,
          path: 9,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['siteSettings']['title']": {
        source: {
          document: 5,
          path: 4,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$['siteSettings']['lastModified']": {
        source: {
          document: 5,
          path: 10,
          type: 'documentValue',
        },
        type: 'value',
      },
    },
  },
  ms: 40,
} satisfies {
  query: string
  result: unknown
  resultSourceMap: ContentSourceMap
  ms: number
}

const cases = [
  {
    studioUrl: 'https://test.sanity.studio',
  },
  {
    studioUrl: '/',
  },
]

test.each(cases)('resolveEditUrl $studioUrl', ({studioUrl}) => {
  const logger = {
    error: vi.fn(),
    log: vi.fn(),
    table: vi.fn(),
  } satisfies Logger
  const encoded = stegaEncodeSourceMap(mock.result, mock.resultSourceMap, {
    enabled: true,
    studioUrl,
    logger,
  })
  expect(
    vercelStegaDecodeAll(JSON.stringify(encoded)).map(
      ({href}: any) => decodeURIComponent(href).split('?')[0],
    ),
  ).toMatchSnapshot('decode all')
  expect(logger.error.mock.calls).toMatchSnapshot('logger.error')
  expect(logger.log.mock.calls).toMatchSnapshot('logger.log')
  expect(logger.table.mock.calls).toMatchSnapshot('logger.table')
})

test('GraphQL API', () => {
  const {data, extensions} = {
    data: {
      allPost: [
        {
          title: 'Stay tuned for details next week!',
        },
        {
          title: 'Anticipation is building 123',
        },
      ],
    },
    extensions: {
      sanitySourceMap: {
        documents: [
          {
            _id: '9696c833-fe71-45b8-b29d-68e8cd78d3db',
            _type: 'post',
          },
          {
            _id: 'ab9e2f38-6ea5-4264-b923-51ae8901ab8e',
            _type: 'post',
          },
        ],
        paths: ["$['_type']", "$['title']"],
        mappings: {
          "$['allPost'][0]['_type']": {
            source: {
              document: 0,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$['allPost'][0]['title']": {
            source: {
              document: 0,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$['allPost'][1]['_type']": {
            source: {
              document: 1,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
          "$['allPost'][1]['title']": {
            source: {
              document: 1,
              path: 1,
              type: 'documentValue',
            },
            type: 'value',
          },
        },
      } satisfies ContentSourceMap,
    },
  }

  const logger = {
    error: vi.fn(),
    log: vi.fn(),
    table: vi.fn(),
  } satisfies Logger
  const studioUrl = 'https://test.sanity.studio'
  const encoded = stegaEncodeSourceMap(data, extensions.sanitySourceMap, {
    enabled: true,
    studioUrl,
    logger,
  })
  expect(
    vercelStegaDecodeAll(JSON.stringify(encoded)).map(
      ({href}: any) => decodeURIComponent(href).split('?')[0],
    ),
  ).toMatchSnapshot('decode all')
  expect(logger.error.mock.calls).toMatchSnapshot('logger.error')
  expect(logger.log.mock.calls).toMatchSnapshot('logger.log')
  expect(logger.table.mock.calls).toMatchSnapshot('logger.table')
})

test('Handles Content Releases', () => {
  const logger = {
    error: vi.fn(),
    log: vi.fn(),
    table: vi.fn(),
  } satisfies Logger
  const studioUrl = 'https://test.sanity.studio'
  const encoded = stegaEncodeSourceMap(
    stegaSnapshotContentReleases.result,
    stegaSnapshotContentReleases.resultSourceMap as ContentSourceMap,
    {
      enabled: true,
      studioUrl,
      logger,
    },
  )
  expect(
    vercelStegaDecodeAll(JSON.stringify(encoded)).map(({href}: any) => {
      const [url, search] = decodeURIComponent(href).split('?')
      return [url, new Map(new URLSearchParams(search).entries())]
    }),
  ).toMatchSnapshot('decode all')
  expect(logger.error.mock.calls).toMatchSnapshot('logger.error')
  expect(logger.log.mock.calls).toMatchSnapshot('logger.log')
  expect(logger.table.mock.calls).toMatchSnapshot('logger.table')
})
