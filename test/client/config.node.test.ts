import fs from 'node:fs'

import {type ClientConfig} from '@sanity/client'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {bodyBytes, getActiveMock} from '../helpers/mockFetch'
import {apiHost, getClient, projectHost} from './helpers'
import {fixture} from './helpers.node'

describe('base client', () => {
  test('observable requests leave no listeners on a reused caller signal', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/ping')
      .respondPersist({status: 200, body: {pong: true}})

    const controller = new AbortController()
    for (let i = 0; i < 3; i++) {
      await firstValueFrom(
        getClient().observable.request({url: '/ping', signal: controller.signal}),
      )
    }

    const {default: nodeEvents} = await import('node:events')
    expect(nodeEvents.getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })

  describe('resource client', () => {
    // Replicated from config.test.ts's `resource client` > `resource
    // variants` setup (not imported: that suite's loop also covers a
    // `perspective` axis this test doesn't use). Keep the values in sync if
    // that source ever changes.
    const resourceVariants = [
      {
        type: 'media-library',
        id: 'theResourceId',
        baseUrl: `/media-libraries/theResourceId`,
      },
      {
        type: 'canvas',
        id: 'theResourceId',
        baseUrl: `/canvases/theResourceId`,
      },
      {
        type: 'dashboard',
        id: 'theResourceId',
        baseUrl: `/dashboards/theResourceId`,
      },
      {
        type: 'dataset',
        id: 'myProjectId.myDatasetName',
        baseUrl: `/projects/myProjectId/datasets/myDatasetName`,
      },
    ] as const
    const apiVersionsVariants = [undefined, '1', '2025-03-25', 'X']

    describe('resource variants', () => {
      for (const resource of resourceVariants) {
        describe(`Resource: ${resource.type}:${resource.id}`, () => {
          for (const apiVersion of apiVersionsVariants) {
            describe(`API Version: ${String(apiVersion)}`, () => {
              test('uploads images using resource config', async () => {
                const fixturePath = fixture('horsehead-nebula.jpg')

                const config: ClientConfig = {
                  apiHost: `https://${apiHost}`,
                  '~experimental_resource': resource,
                }
                if (apiVersion) {
                  config.apiVersion = apiVersion
                }
                const assetsClient = getClient(config).assets

                if (resource.type === 'dataset') {
                  // Rejected client-side - no request is made, so no mock is needed.
                  expect(() =>
                    assetsClient.upload('image', fs.createReadStream(fixturePath)),
                  ).toThrow(/Assets are not supported for dataset/i)
                  return
                }

                const uploadPath =
                  resource.type === 'media-library'
                    ? `/v${apiVersion || '1'}${resource.baseUrl}/upload`
                    : `/v${apiVersion || '1'}${resource.baseUrl}/assets/images`
                getActiveMock()
                  .scope(`https://${apiHost}`)
                  .on('POST', uploadPath, {body: bodyBytes(fs.readFileSync(fixturePath))})
                  .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

                const document = await assetsClient.upload(
                  'image',
                  fs.createReadStream(fixturePath),
                )
                expect(document).toMatchObject({url: 'https://some.asset.url'})
              })
            })
          }
        })
      }
    })
  })
})
