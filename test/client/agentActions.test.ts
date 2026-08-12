import {describe, expect, test} from 'vitest'

import {getActiveMock} from '../helpers/mockFetch'
import {clientConfig, getClient, projectHost} from './helpers'

describe('AGENT ACTION: PROMPT', () => {
  test('can use instruction', async () => {
    const response = 'i did the thing'

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/prompt/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.prompt({
      instruction: 'say you did the thing',
    })
    expect(body).toEqual(response)
  })

  test('can ask for json', async () => {
    const response = {json: true}

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/prompt/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.prompt<{json: true}>({
      instruction: 'return the exact json: {json: true}',
      format: 'json',
    })
    expect(body).toEqual(response)
  })

  test('requires documentId for field and document params', async () => {
    const response = {json: true}

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/prompt/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.prompt({
      instruction: '$a $b',
      instructionParams: {
        //@ts-expect-error documentId is required
        a: {
          type: 'field',
          path: ['title'],
        },
        //@ts-expect-error documentId is required
        b: {
          type: 'document',
        },
      },
    })
    expect(body).toEqual(response)
  })

  test('all the params', async () => {
    const response = 'whatever'

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/prompt/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.prompt<{title?: string}>({
      instruction: '$a $b $d',
      instructionParams: {
        a: 'constant',
        b: {
          type: 'field',
          path: ['title'],
          documentId: 'somewhere',
        },
        c: {
          type: 'groq',
          query: '*[id=$id].title',
          params: {id: 'abc'},
        },
        d: {
          type: 'document',
          documentId: 'somewhere',
        },
      },
      temperature: 0.6,
      format: 'string',
    })
    expect(body).toEqual('whatever')
  })
})

describe('AGENT ACTION: PATCH', () => {
  test('can create new document', async () => {
    const response = {
      _id: 'generated',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/patch/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.patch({
      schemaId: 'some-schema-id',
      targetDocument: {
        operation: 'create',
        _type: 'some-type',
      },
      target: {path: 'title', operation: 'unset'},
    })
    expect(body).toEqual(response)
  })

  test('can create new document with id', async () => {
    const response = {
      _id: 'generated',
      title: 'new title',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/patch/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.patch({
      schemaId: 'some-schema-id',
      targetDocument: {operation: 'createIfNotExists', _id: 'new', _type: 'some-type'},
      target: {path: 'title', operation: 'set', value: 'new title'},
    })
    expect(body).toEqual(response)
  })

  test('can patch existing document', async () => {
    const response = {
      _id: 'generated',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/patch/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.patch({
      documentId: 'some-id',
      target: {path: 'title', operation: 'unset'},
      schemaId: 'some-schema-id',
    })
    expect(body).toEqual(response)
  })

  test('can apply generics to type returned document value', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/patch/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.patch<{title?: string}>({
      documentId: 'some-id',
      target: {path: 'title', operation: 'set', value: 'override'},
      schemaId: 'some-schema-id',
    })
    expect(body.title).toEqual(response.title)
  })

  test('providing both documentId & targetDocument should not compile', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/patch/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    await getClient().agent.action.patch<{title?: string}>({
      documentId: 'some-id',
      //@ts-expect-error not allowed
      targetDocument: {operation: 'create', _type: 'yolo'},
      target: {path: 'title', operation: 'set', value: 'override'},
      schemaId: 'some-schema-id',
    })
  })

  test('can cannot apply generics to async request since it returns _id only', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/patch/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.patch({
      documentId: 'some-id',
      target: {path: 'title', operation: 'set', value: 'override'},
      schemaId: 'some-schema-id',
      async: true,
    })
    expect(body._id).toEqual(response._id)
  })

  test('async cannot noWrite', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/patch/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.patch({
      documentId: 'some-id',
      target: {path: 'title', operation: 'set', value: 'override'},
      schemaId: 'some-schema-id',
      async: true,
      //@ts-expect-error not allowed
      noWrite: true,
    })
    expect(body._id).toEqual(response._id)
  })

  test('all the params', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/patch/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.patch<{title?: string}>({
      targetDocument: {_id: 'some-id', operation: 'edit'},
      async: false,
      forcePublishedWrite: true,
      target: [
        {path: ['title'], operation: 'append', value: 'title'},
        {path: 'description', operation: 'set', value: 'desc'},
        {path: 'body', operation: 'mixed', value: 'mixed'},
        {path: 'body', operation: 'unset'},
      ],
      noWrite: true,
      conditionalPaths: {
        defaultHidden: true,
        defaultReadOnly: false,
        paths: [{path: ['title'], readOnly: false, hidden: false}],
      },
      schemaId: 'some-schema-id',
    })
    expect(body.title).toEqual(response.title)
  })
})

describe('AGENT ACTION: GENERATE', () => {
  test('can create new document', async () => {
    const response = {
      _id: 'generated',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/generate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.generate({
      targetDocument: {
        operation: 'create',
        _type: 'some-type',
      },
      instruction: 'set title to override',
      schemaId: 'some-schema-id',
    })
    expect(body).toEqual(response)
  })

  test('can create new document with id', async () => {
    const response = {
      _id: 'generated',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/generate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.generate({
      targetDocument: {operation: 'createIfNotExists', _id: 'new', _type: 'some-type'},
      instruction: 'set title to override',
      schemaId: 'some-schema-id',
    })
    expect(body).toEqual(response)
  })

  test('can instruct existing document', async () => {
    const response = {
      _id: 'generated',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/generate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.generate({
      documentId: 'some-id',
      instruction: 'set title to override',
      schemaId: 'some-schema-id',
    })
    expect(body).toEqual(response)
  })

  test('can apply generics to type returned document value', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/generate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.generate<{title?: string}>({
      documentId: 'some-id',
      instruction: 'set title to override',
      schemaId: 'some-schema-id',
    })
    expect(body.title).toEqual(response.title)
    expect(body.title).toEqual(response.title)
  })

  test('providing both documentId & targetDocument should not compile', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/generate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    await getClient().agent.action.generate<{title?: string}>({
      documentId: 'some-id',
      //@ts-expect-error not allowed
      targetDocument: {operation: 'create', _type: 'yolo'},
      instruction: 'set title to override',
      schemaId: 'some-schema-id',
    })
  })

  test('can cannot apply generics to async request since it returns _id only', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/generate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.generate({
      documentId: 'some-id',
      instruction: 'set title to override',
      schemaId: 'some-schema-id',
      async: true,
    })
    expect(body._id).toEqual(response._id)
  })

  test('async cannot noWrite', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/generate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.generate({
      documentId: 'some-id',
      instruction: 'set title to override',
      schemaId: 'some-schema-id',
      async: true,
      //@ts-expect-error not allowed
      noWrite: true,
    })
    expect(body._id).toEqual(response._id)
  })

  test('all the params', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/generate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.generate<{title?: string}>({
      targetDocument: {_id: 'some-id', operation: 'edit'},
      instruction: '$a $b $d',
      forcePublishedWrite: true,
      instructionParams: {
        a: 'constant',
        b: {
          type: 'field',
          path: ['title'],
        },
        c: {
          type: 'groq',
          query: '*[id=$id].title',
          params: {id: 'abc'},
          perspective: 'drafts',
        },
        d: {
          type: 'document',
          documentId: 'somewhere',
        },
      },
      temperature: 0.6,
      async: false,
      target: [
        {path: ['title']},
        {
          operation: 'set',
          include: [
            'object',
            {
              path: 'array',
              include: [{_key: '123'}],
              operation: 'append',
              types: {
                include: ['string'],
              },
            },
          ],
          types: {
            exclude: ['number'],
          },
        },
      ],
      noWrite: true,
      conditionalPaths: {
        defaultHidden: true,
        defaultReadOnly: false,
        paths: [{path: ['title'], readOnly: false, hidden: false}],
      },
      schemaId: 'some-schema-id',
    })
    expect(body.title).toEqual(response.title)
  })
})

describe('AGENT ACTION: TRANSFORM', () => {
  test('can create new document', async () => {
    const response = {_id: 'created'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/transform/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.transform({
      schemaId: 'some-schema-id',
      documentId: 'source-id',
      targetDocument: {operation: 'create'},
      instruction: 'make everything CAPITALS ONLY',
    })
    expect(body).toEqual(response)
  })

  test('can transform existing document', async () => {
    const response = {
      _id: 'generated',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/transform/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.transform({
      schemaId: 'some-schema-id',
      documentId: 'some-id',
      instruction: 'fix spelling errors',
    })
    expect(body).toEqual(response)
  })

  test('can apply generics to type returned document value', async () => {
    const response = {
      _id: 'generated',
      title: 'OVERRIDE',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/transform/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.transform<{title?: string}>({
      schemaId: 'some-schema-id',
      documentId: 'some-id',
      instruction: 'ALL CAPS',
    })
    expect(body.title).toEqual(response.title)
  })

  test('can cannot apply generics to async request since it returns _id only', async () => {
    const response = {
      _id: 'generated',
      title: 'OVERRIDE',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/transform/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.transform({
      documentId: 'some-id',
      instruction: 'ALL CAPS',
      schemaId: 'some-schema-id',
      async: true,
    })
    expect(body._id).toEqual(response._id)
  })

  test('async cannot noWrite', async () => {
    const response = {
      _id: 'generated',
      title: 'OVERRIDE',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/transform/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.transform({
      documentId: 'some-id',
      schemaId: 'some-schema-id',
      async: true,
      //@ts-expect-error not allowed
      noWrite: true,
    })
    expect(body._id).toEqual(response._id)
  })

  test('all the params', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/transform/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.transform<{title?: string}>({
      documentId: 'some-id',
      instruction: '$a $b $d',
      forcePublishedWrite: true,
      instructionParams: {
        a: 'constant',
        b: {
          type: 'field',
          path: ['title'],
        },
        c: {
          type: 'groq',
          query: '*[id=$id].title',
          params: {id: 'abc'},
          perspective: 'published',
        },
        d: {
          type: 'document',
          documentId: 'somewhere',
        },
      },
      temperature: 0.6,
      async: false,
      target: [
        {path: ['title'], operation: 'set'},
        {path: ['description'], operation: {type: 'image-description', sourcePath: ['image']}},
        {
          path: ['remoteImageDescription'],
          operation: {type: 'image-description', imageUrl: 'https://www.santiy.io/logo.png'},
        },
        {
          path: ['errorDesc'],
          operation: {
            type: 'image-description',
            imageUrl: 'https://www.santiy.io/logo.png',
            //@ts-expect-error imageUrl and sourcePath are mutually exclusive
            sourcePath: ['image'],
          },
        },
        {
          instruction: 'based on $c – replace this field',
          include: [
            'object',
            {
              path: 'array',
              operation: 'set',
              include: [{_key: '123'}],
              instruction: 'based on $b – replace this field',
              types: {
                include: ['string'],
              },
            },
          ],
          types: {
            exclude: ['number'],
          },
        },
      ],
      noWrite: true,
      conditionalPaths: {
        defaultHidden: true,
        defaultReadOnly: false,
        paths: [{path: ['title'], readOnly: false, hidden: false}],
      },
      schemaId: 'some-schema-id',
    })
    expect(body.title).toEqual(response.title)
  })
})

describe('AGENT ACTION: TRANSLATE', () => {
  test('can create new document', async () => {
    const response = {_id: 'created'}

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/translate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.translate({
      schemaId: 'some-schema-id',
      documentId: 'source-id',
      targetDocument: {operation: 'create'},
      toLanguage: {
        id: 'no-NB',
        title: 'Norsk Bokmål',
      },
    })
    expect(body).toEqual(response)
  })

  test('can tanslate existing document', async () => {
    const response = {
      _id: 'generated',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/translate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.translate({
      schemaId: 'some-schema-id',
      documentId: 'some-id',
      toLanguage: {
        id: 'no-NB',
        title: 'Norsk Bokmål',
      },
    })
    expect(body).toEqual(response)
  })

  test('can apply generics to type returned document value', async () => {
    const response = {
      _id: 'generated',
      title: 'oversatt',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/translate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.translate<{title?: string}>({
      schemaId: 'some-schema-id',
      documentId: 'some-id',
      toLanguage: {
        id: 'no-NB',
        title: 'Norsk Bokmål',
      },
    })
    expect(body.title).toEqual(response.title)
  })

  test('can cannot apply generics to async request since it returns _id only', async () => {
    const response = {
      _id: 'generated',
      title: 'OVERRIDE',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/translate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.translate({
      documentId: 'some-id',
      schemaId: 'some-schema-id',
      async: true,
      toLanguage: {
        id: 'no-NB',
        title: 'Norsk Bokmål',
      },
    })
    expect(body._id).toEqual(response._id)
  })

  test('async cannot noWrite', async () => {
    const response = {
      _id: 'generated',
      title: 'OVERRIDE',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/translate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.translate({
      documentId: 'some-id',
      toLanguage: {
        id: 'no-NB',
        title: 'Norsk Bokmål',
      },
      schemaId: 'some-schema-id',
      async: true,
      //@ts-expect-error not allowed
      noWrite: true,
    })
    expect(body._id).toEqual(response._id)
  })

  test('all the params', async () => {
    const response = {
      _id: 'generated',
      title: 'override',
    }

    getActiveMock()
      .scope(projectHost())
      .on('POST', `/v1/agent/action/translate/${clientConfig.dataset}`)
      .respond({status: 200, body: response})

    const body = await getClient().agent.action.translate<{title?: string}>({
      documentId: 'some-id',
      styleGuide: '$a $b $d',
      forcePublishedWrite: true,
      targetDocument: {
        operation: 'createIfNotExists',
        _id: 'target',
      },
      languageFieldPath: ['lang'],
      protectedPhrases: ['Sanity', 'headless'],
      fromLanguage: {
        id: 'en-US',
        title: 'American English',
      },
      toLanguage: {
        id: 'no-NB',
        title: 'Norsk Bokmål',
      },
      styleGuideParams: {
        a: 'constant',
        b: {
          type: 'field',
          path: ['title'],
        },
        c: {
          type: 'groq',
          query: '*[id=$id].title',
          params: {id: 'abc'},
        },
        d: {
          type: 'document',
          documentId: 'somewhere',
        },
      },
      temperature: 0.6,
      async: false,
      target: [
        {path: ['title']},
        {
          styleGuide: 'based on $c',
          include: [
            'object',
            {
              path: 'array',
              include: [{_key: '123'}],
              styleGuide: 'based on $b',
              types: {
                include: ['string'],
              },
            },
          ],
          types: {
            exclude: ['number'],
          },
        },
      ],
      noWrite: true,
      conditionalPaths: {
        defaultHidden: true,
        defaultReadOnly: false,
        paths: [{path: ['title'], readOnly: false, hidden: false}],
      },
      schemaId: 'some-schema-id',
    })
    expect(body.title).toEqual(response.title)
  })
})
