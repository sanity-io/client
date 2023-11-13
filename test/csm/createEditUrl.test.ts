import {expect, test} from 'vitest'

import {createEditUrl} from '../../src/csm/createEditUrl'
import {parseJsonPath} from '../../src/csm/jsonPath'

const baseUrl = 'https://test.sanity.studio'
const workspace = 'staging'
const tool = 'content'
const id = 'drafts.homepage'
const type = 'page'

const cases = [
  {
    context: {baseUrl, workspace, tool, id, type},
    path: parseJsonPath("$['foo'][?(@._key=='section-1')][0]['baz'][?(@._key=='section-2')]"),
    expected:
      'https://test.sanity.studio/staging/content/intent/edit/id=homepage;type=page;path=foo[_key=="section-1"][0].baz[_key=="section-2"]?baseUrl=https://test.sanity.studio&id=homepage&type=page&path=foo[_key=="section-1"][0].baz[_key=="section-2"]&workspace=staging&tool=content',
  },
  {
    context: {baseUrl: '/', id, type},
    path: parseJsonPath("$['foo'][?(@._key=='section-1')][0]"),
    expected:
      '/intent/edit/id=homepage;type=page;path=foo[_key=="section-1"][0]?baseUrl=/&id=homepage&type=page&path=foo[_key=="section-1"][0]',
  },
  {
    context: {baseUrl: '/', workspace, tool, id, type},
    path: parseJsonPath("$['foo'][?(@._key=='section-1')][0]"),
    expected:
      '/staging/content/intent/edit/id=homepage;type=page;path=foo[_key=="section-1"][0]?baseUrl=/&id=homepage&type=page&path=foo[_key=="section-1"][0]&workspace=staging&tool=content',
  },
]

test.each(cases)('$expected', ({context, path, expected}) => {
  expect(decodeURIComponent(createEditUrl({...context, path}))).toEqual(expected)
})
