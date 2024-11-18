import {stegaEncodeSourceMap as stegaEncodeSourceMapLatest} from '@sanity/client-latest/stega'
import {bench, describe} from 'vitest'

import {stegaEncodeSourceMap} from '../../src/stega/stegaEncodeSourceMap'
import type {InitializedStegaConfig} from '../../src/stega/types'
import data from './stegaSnapshotHuge.json' with {type: 'json'}

const config = {
  enabled: true,
  studioUrl: 'https://test.sanity.studio',
} satisfies InitializedStegaConfig

describe('stegaEncodeSourceMap can handle Portable Text in a performant way', () => {
  bench('@sanity/client@latest', () => {
    stegaEncodeSourceMapLatest(data.result, data.resultSourceMap as any, config)
  })
  bench('src', () => {
    stegaEncodeSourceMap(data.result, data.resultSourceMap as any, config)
  })
})
