import {expect, test, vi} from 'vitest'

import {encodeIntoResult} from '../../src/stega/encodeIntoResult'
import type {ContentSourceMap} from '../../src/types'

const encodeTestCases: {
  name: string
  queryResult: {
    result: unknown
    resultSourceMap: ContentSourceMap
  }
  expected: {
    encoderCalls: number
    encoderArgs: unknown[][]
  }
}[] = [
  {
    name: 'resolves exact mappings to source',
    queryResult: {
      result: [
        {
          _id: 'foo',
          this: 'that',
        },
      ],
      resultSourceMap: {
        documents: [
          {
            _id: 'foo',
            _type: 'bar',
          },
        ],
        paths: ["$['this']"],
        mappings: {
          "$[0]['this']": {
            source: {
              document: 0,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
        },
      },
    },
    expected: {
      encoderCalls: 1,
      encoderArgs: [
        [
          {
            sourcePath: ['this'],
            sourceDocument: {
              _id: 'foo',
              _type: 'bar',
            },
            resultPath: [0, 'this'],
            value: 'that',
          },
        ],
      ],
    },
  },
  {
    name: 'resolves aggregated mappings to source',
    queryResult: {
      result: [
        {
          _id: 'foo',
          nested: {
            object: {
              this: 'that',
            },
          },
        },
      ],
      resultSourceMap: {
        documents: [
          {
            _id: 'foo',
            _type: 'bar',
          },
        ],
        paths: ["$['something']['nested']"],
        mappings: {
          "$[0]['nested']": {
            source: {
              document: 0,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
        },
      },
    },
    expected: {
      encoderCalls: 1,
      encoderArgs: [
        [
          {
            sourcePath: ['something', 'nested', 'object', 'this'],
            sourceDocument: {
              _id: 'foo',
              _type: 'bar',
            },
            resultPath: [0, 'nested', 'object', 'this'],
            value: 'that',
          },
        ],
      ],
    },
  },
  {
    name: 'plucks out _key to use as path segment',
    queryResult: {
      result: [
        {
          _id: 'foo',
          nested: {
            arr: [
              {
                _key: 'im_a_key',
                value: 'that',
              },
            ],
          },
        },
      ],
      resultSourceMap: {
        documents: [
          {
            _id: 'foo',
            _type: 'bar',
          },
        ],
        paths: ["$['projected']['nested']"],
        mappings: {
          "$[0]['nested']": {
            source: {
              document: 0,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
        },
      },
    },
    expected: {
      encoderCalls: 2,
      encoderArgs: [
        [
          {
            sourcePath: ['projected', 'nested', 'arr', {_key: 'im_a_key', _index: 0}, '_key'],
            sourceDocument: {
              _id: 'foo',
              _type: 'bar',
            },
            resultPath: [0, 'nested', 'arr', {_key: 'im_a_key', _index: 0}, '_key'],
            value: 'im_a_key',
          },
        ],
        [
          {
            sourcePath: ['projected', 'nested', 'arr', {_key: 'im_a_key', _index: 0}, 'value'],
            sourceDocument: {
              _id: 'foo',
              _type: 'bar',
            },
            resultPath: [0, 'nested', 'arr', {_key: 'im_a_key', _index: 0}, 'value'],
            value: 'that',
          },
        ],
      ],
    },
  },
  {
    name: 'handles _key array filter selectors in source paths',
    queryResult: {
      result: [
        {
          _id: 'foo',
          arr: [
            {
              _key: 'im_a_key',
              value: 'that',
            },
          ],
        },
      ],
      resultSourceMap: {
        documents: [
          {
            _id: 'foo',
            _type: 'bar',
          },
        ],
        paths: ["$['projected'][?(@._key=='fooKey')]"],
        mappings: {
          "$[0]['arr']": {
            source: {
              document: 0,
              path: 0,
              type: 'documentValue',
            },
            type: 'value',
          },
        },
      },
    },
    expected: {
      encoderCalls: 2,
      encoderArgs: [
        [
          {
            sourcePath: [
              'projected',
              {_key: 'fooKey', _index: -1},
              {_key: 'im_a_key', _index: 0},
              '_key',
            ],
            sourceDocument: {
              _id: 'foo',
              _type: 'bar',
            },
            resultPath: [0, 'arr', {_key: 'im_a_key', _index: 0}, '_key'],
            value: 'im_a_key',
          },
        ],
        [
          {
            sourcePath: [
              'projected',
              {_key: 'fooKey', _index: -1},
              {_key: 'im_a_key', _index: 0},
              'value',
            ],
            sourceDocument: {
              _id: 'foo',
              _type: 'bar',
            },
            resultPath: [0, 'arr', {_key: 'im_a_key', _index: 0}, 'value'],
            value: 'that',
          },
        ],
      ],
    },
  },
]

test.each(encodeTestCases)('encode $name', ({queryResult, expected}) => {
  const mockTranscoder = vi.fn().mockImplementation((input: string) => input)
  encodeIntoResult(queryResult.result, queryResult.resultSourceMap, mockTranscoder)

  expect(mockTranscoder).toBeCalledTimes(expected.encoderCalls)
  for (const args of expected.encoderArgs) {
    expect(mockTranscoder).toBeCalledWith(...args)
  }
})
