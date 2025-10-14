import type {DecideParameters} from '../types'

const stringOperators = [
  'equals',
  'not-equals',
  'contains',
  'not-contains',
  'is-empty',
  'is-not-empty',
] as const

const numberOperators = [
  'equals',
  'not-equals',
  'is-empty',
  'is-not-empty',
  '>',
  '<',
  '>=',
  '<=',
] as const

/**
 * Helper functions for type conversion
 */
const toNumber = (value: string | number): number =>
  typeof value === 'number' ? value : Number(value)

const toString = (value: string | number): string =>
  typeof value === 'string' ? value : String(value)

/**
 * Operator resolver functions
 */
const resolveOperator = {
  equals: (parameterValue: string | number, targetValue: string | number) =>
    parameterValue === targetValue,
  'not-equals': (parameterValue: string | number, targetValue: string | number) =>
    parameterValue !== targetValue,
  contains: (parameterValue: string | number, targetValue: string | number) =>
    toString(parameterValue).includes(toString(targetValue)),
  'not-contains': (parameterValue: string | number, targetValue: string | number) =>
    !toString(parameterValue).includes(toString(targetValue)),
  'is-empty': (parameterValue: string | number) => !parameterValue,
  'is-not-empty': (parameterValue: string | number) => !!parameterValue,
  '>': (parameterValue: string | number, targetValue: string | number) =>
    toNumber(parameterValue) > toNumber(targetValue),
  '<': (parameterValue: string | number, targetValue: string | number) =>
    toNumber(parameterValue) < toNumber(targetValue),
  '>=': (parameterValue: string | number, targetValue: string | number) =>
    toNumber(parameterValue) >= toNumber(targetValue),
  '<=': (parameterValue: string | number, targetValue: string | number) =>
    toNumber(parameterValue) <= toNumber(targetValue),
}

/**
 * @internal
 */
export interface DecideField<T = unknown> {
  _type: 'sanity.decideField'
  default?: T
  conditions?: Array<{_key: string; _type: 'condition'; value?: T; anyOf?: Array<DecideRule>}>
}

type DecideRule =
  | {
      property: string
      operator: (typeof stringOperators)[number]
      targetValue: string
      and?: DecideRule[]
      _key: string
      _type: 'rule'
    }
  | {
      property: string
      operator: (typeof numberOperators)[number]
      targetValue: number
      and?: DecideRule[]
      _key: string
      _type: 'rule'
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
    '_type' in value &&
    value._type === 'sanity.decideField'

  return isValid
}

/**
 * Evaluates a single rule against the provided parameters
 * @internal
 */
function evaluateRule(rule: DecideRule, decideParameters: DecideParameters): boolean {
  const parameterValue = decideParameters[rule.property]
  // Only string and number types are supported
  if (typeof parameterValue !== 'string' && typeof parameterValue !== 'number') {
    return false
  }

  // Evaluate the operator
  const operatorPassed = resolveOperator[rule.operator](parameterValue, rule.targetValue)
  if (!operatorPassed) {
    return false
  }

  // If there are AND conditions, all must pass
  if (rule.and && rule.and.length > 0) {
    return rule.and.every((andRule) => evaluateRule(andRule, decideParameters))
  }

  return true
}

/**
 * Resolves a decide field based on the provided decide parameters
 * @internal
 */
export function resolveDecideField(
  field: DecideField,
  decideParameters?: DecideParameters,
): unknown {
  if (field._type !== 'sanity.decideField') {
    return field
  }
  if (!decideParameters) {
    return field.default
  }

  // Find matching condition
  const matchingCondition = field.conditions?.find((condition) => {
    return condition.anyOf?.some((rule) => evaluateRule(rule, decideParameters))
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
