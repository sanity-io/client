import {expect, test} from 'vitest'

import {createEditUrl} from '../../src/csm/createEditUrl'
import {parseJsonPath} from '../../src/csm/jsonPath'

const baseUrl = 'https://test.sanity.studio'
const workspace = 'staging'
const tool = 'content'
const id = 'drafts.homepage'
const type = 'page'
const projectId = 'a1b2c3d4'
const dataset = 'production'

const cases = [
  {
    context: {baseUrl, workspace, tool, id, type},
    path: parseJsonPath("$['foo'][?(@._key=='section-1')][0]['baz'][?(@._key=='section-2')]"),
    expected:
      'https://test.sanity.studio/staging/intent/edit/mode=presentation;id=homepage;type=page;path=foo[_key=="section-1"][0].baz[_key=="section-2"];tool=content?baseUrl=https://test.sanity.studio&id=homepage&type=page&path=foo[_key=="section-1"][0].baz[_key=="section-2"]&workspace=staging&tool=content&isDraft=',
  },
  {
    context: {baseUrl: '/', id, type},
    path: parseJsonPath("$['foo'][?(@._key=='section-1')][0]"),
    expected:
      '/intent/edit/mode=presentation;id=homepage;type=page;path=foo[_key=="section-1"][0]?baseUrl=/&id=homepage&type=page&path=foo[_key=="section-1"][0]&isDraft=',
  },
  {
    context: {baseUrl: '/', workspace, tool, id, type},
    path: parseJsonPath("$['foo'][?(@._key=='section-1')][0]"),
    expected:
      '/staging/intent/edit/mode=presentation;id=homepage;type=page;path=foo[_key=="section-1"][0];tool=content?baseUrl=/&id=homepage&type=page&path=foo[_key=="section-1"][0]&workspace=staging&tool=content&isDraft=',
  },
  {
    context: {baseUrl: '/', workspace, tool, id, type, projectId, dataset},
    path: parseJsonPath("$['foo'][?(@._key=='section-1')][0]"),
    expected:
      '/staging/intent/edit/mode=presentation;id=homepage;type=page;path=foo[_key=="section-1"][0];tool=content?baseUrl=/&id=homepage&type=page&path=foo[_key=="section-1"][0]&workspace=staging&tool=content&projectId=a1b2c3d4&dataset=production&isDraft=',
  },
]

test.each(cases)('$expected', ({context, path, expected}) => {
  expect(decodeURIComponent(createEditUrl({...context, path}))).toEqual(expected)
})
