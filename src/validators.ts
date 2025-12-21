import type {Any, InitializedClientConfig, SanityDocumentStub} from './types'

const VALID_ASSET_TYPES = ['image', 'file']
const VALID_INSERT_LOCATIONS = ['before', 'after', 'replace']

export const dataset = (name: string) => {
  if (!/^(~[a-z0-9]{1}[-\w]{0,63}|[a-z0-9]{1}[-\w]{0,63})$/.test(name)) {
    throw new Error(
      'Datasets can only contain lowercase characters, numbers, underscores and dashes, and start with tilde, and be maximum 64 characters',
    )
  }
}

export const projectId = (id: string) => {
  if (!/^[-a-z0-9]+$/i.test(id)) {
    throw new Error('`projectId` can only contain only a-z, 0-9 and dashes')
  }
}

export const validateAssetType = (type: string) => {
  if (VALID_ASSET_TYPES.indexOf(type) === -1) {
    throw new Error(`Invalid asset type: ${type}. Must be one of ${VALID_ASSET_TYPES.join(', ')}`)
  }
}

export const validateObject = (op: string, val: Any) => {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(`${op}() takes an object of properties`)
  }
}

export const validateDocumentId = (op: string, id: string) => {
  if (typeof id !== 'string' || !/^[a-z0-9_][a-z0-9_.-]{0,127}$/i.test(id) || id.includes('..')) {
    throw new Error(`${op}(): "${id}" is not a valid document ID`)
  }
}

export const requireDocumentId = (op: string, doc: Record<string, Any>) => {
  if (!doc._id) {
    throw new Error(`${op}() requires that the document contains an ID ("_id" property)`)
  }

  validateDocumentId(op, doc._id)
}

export const validateDocumentType = (op: string, type: string) => {
  if (typeof type !== 'string') {
    throw new Error(`\`${op}()\`: \`${type}\` is not a valid document type`)
  }
}

export const requireDocumentType = (op: string, doc: Record<string, Any>) => {
  if (!doc._type) {
    throw new Error(`\`${op}()\` requires that the document contains a type (\`_type\` property)`)
  }

  validateDocumentType(op, doc._type)
}

export const validateVersionIdMatch = (builtVersionId: string, document: SanityDocumentStub) => {
  if (document._id && document._id !== builtVersionId) {
    throw new Error(
      `The provided document ID (\`${document._id}\`) does not match the generated version ID (\`${builtVersionId}\`)`,
    )
  }
}

export const validateInsert = (at: string, selector: string, items: Any[]) => {
  const signature = 'insert(at, selector, items)'
  if (VALID_INSERT_LOCATIONS.indexOf(at) === -1) {
    const valid = VALID_INSERT_LOCATIONS.map((loc) => `"${loc}"`).join(', ')
    throw new Error(`${signature} takes an "at"-argument which is one of: ${valid}`)
  }

  if (typeof selector !== 'string') {
    throw new Error(`${signature} takes a "selector"-argument which must be a string`)
  }

  if (!Array.isArray(items)) {
    throw new Error(`${signature} takes an "items"-argument which must be an array`)
  }
}

export const hasDataset = (config: InitializedClientConfig): string => {
  // Check if dataset is directly on the config
  if (config.dataset) {
    return config.dataset
  }

  // Check if dataset is in resource configuration
  // Note: ~experimental_resource is normalized to resource during client initialization
  const resource = config.resource
  if (resource && resource.type === 'dataset') {
    const segments = resource.id.split('.')
    if (segments.length !== 2) {
      throw new Error('Dataset resource ID must be in the format "project.dataset"')
    }
    return segments[1]
  }

  throw new Error('`dataset` must be provided to perform queries')
}

export const requestTag = (tag: string) => {
  if (typeof tag !== 'string' || !/^[a-z0-9._-]{1,75}$/i.test(tag)) {
    throw new Error(
      `Tag can only contain alphanumeric characters, underscores, dashes and dots, and be between one and 75 characters long.`,
    )
  }

  return tag
}

export const resourceConfig = (config: InitializedClientConfig): void => {
  // Note: ~experimental_resource is normalized to resource during client initialization
  const resource = config.resource
  if (!resource) {
    throw new Error('`resource` must be provided to perform resource queries')
  }
  const {type, id} = resource

  switch (type) {
    case 'dataset': {
      const segments = id.split('.')
      if (segments.length !== 2) {
        throw new Error('Dataset resource ID must be in the format "project.dataset"')
      }
      return
    }
    case 'dashboard':
    case 'media-library':
    case 'canvas': {
      return
    }
    default:
      // @ts-expect-error - handle all supported resource types
      throw new Error(`Unsupported resource type: ${type.toString()}`)
  }
}

export const resourceGuard = (service: string, config: InitializedClientConfig): void => {
  // Note: ~experimental_resource is normalized to resource during client initialization
  const resource = config.resource
  if (resource) {
    throw new Error(`\`${service}\` does not support resource-based operations`)
  }
}
