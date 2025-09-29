import type {DecideParameters} from '../types'

/**
 * @internal
 */
export interface DecideCondition {
  audience: string
  value: unknown
  [key: string]: unknown
}

/**
 * @internal
 */
export interface DecideField {
  default: unknown
  conditions: DecideCondition[]
}

/**
 * Checks if a value is a decide field with the expected structure
 * @internal
 */
export function isDecideField(value: unknown): value is DecideField {
  const isValid =
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'default' in value &&
    'conditions' in value &&
    Array.isArray((value as any).conditions)

  return isValid
}

/**
 * Resolves a decide field based on the provided decide parameters
 * @internal
 */
export function resolveDecideField(
  field: DecideField,
  decideParameters?: DecideParameters,
): unknown {
  const audience = decideParameters?.audience

  // If no audience defined or empty, return default
  if (!audience || (Array.isArray(audience) && audience.length === 0) || audience === '') {
    return field.default
  }

  // Find matching condition for the audience
  const matchingCondition = field.conditions.find((condition) => {
    const isMatch = Array.isArray(audience)
      ? audience.includes(condition.audience)
      : condition.audience === audience

    return isMatch
  })

  // Return matching value or fall back to default
  return matchingCondition ? matchingCondition.value : field.default
}

/**
 * Recursively processes an object or array to resolve decide fields
 * @internal
 */
export function processObjectRecursively(
  obj: unknown,
  decideParameters?: DecideParameters,
): unknown {
  // Handle null, undefined, or primitive values
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => processObjectRecursively(item, decideParameters))
  }

  // Handle objects using reduce
  return Object.entries(obj).reduce<Record<string, unknown>>((processed, [key, value]) => {
    const isDecide = isDecideField(value)

    try {
      if (isDecide) {
        // Resolve decide field
        processed[key] = resolveDecideField(value, decideParameters)
      } else {
        // Recursively process nested objects/arrays
        processed[key] = processObjectRecursively(value, decideParameters)
      }
    } catch {
      // On error, preserve original value and continue
      processed[key] = value
    }
    return processed
  }, {})
}

/**
 * Main function to process decide fields in API response data
 * @internal
 */
export function processDecideFields(data: unknown, decideParameters?: DecideParameters): unknown {
  try {
    const result = processObjectRecursively(data, decideParameters)
    return result
  } catch {
    return data
  }
}
