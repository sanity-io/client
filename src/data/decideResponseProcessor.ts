import type {DecideParameters} from '../types'

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
const resolveOperator: Record<
  CompareOp,
  (parameterValue: string | number, targetValue: string | number) => boolean
> = {
  eq: (parameterValue: string | number, targetValue: string | number) =>
    parameterValue === targetValue,
  neq: (parameterValue: string | number, targetValue: string | number) =>
    parameterValue !== targetValue,
  contains: (parameterValue: string | number, targetValue: string | number) =>
    toString(parameterValue).includes(toString(targetValue)),
  ncontains: (parameterValue: string | number, targetValue: string | number) =>
    !toString(parameterValue).includes(toString(targetValue)),
  lt: (parameterValue: string | number, targetValue: string | number) =>
    toNumber(parameterValue) < toNumber(targetValue),
  lte: (parameterValue: string | number, targetValue: string | number) =>
    toNumber(parameterValue) <= toNumber(targetValue),
  gt: (parameterValue: string | number, targetValue: string | number) =>
    toNumber(parameterValue) > toNumber(targetValue),
  gte: (parameterValue: string | number, targetValue: string | number) =>
    toNumber(parameterValue) >= toNumber(targetValue),
  empty: (parameterValue: string | number) => !parameterValue,
  exists: (parameterValue: string | number) =>
    parameterValue !== undefined && parameterValue !== null && Boolean(parameterValue),
  in: (parameterValue: string | number, targetValue: string | number) =>
    Array.isArray(targetValue) && targetValue.includes(parameterValue),
  nin: (parameterValue: string | number, targetValue: string | number) =>
    !Array.isArray(targetValue) || !targetValue.includes(parameterValue),
}

export type CompareOp =
  | 'eq'
  | 'neq'
  | 'in'
  | 'nin'
  | 'contains'
  | 'ncontains'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'exists'
  | 'empty'

export type CmpExpr = {
  _type: 'expr'
  _key: string
  kind: 'cmp'
  attr?: string // e.g. "audience", "language", "age", "locales"
  op?: CompareOp
  value?: string | number | boolean | string[] | number[]
  // optional type hints to aid validation & UI
  type?: 'string' | 'number' | 'boolean' | 'set<string>' | 'set<number>'
}

export type AndExpr = {_type: 'expr'; _key: string; kind: 'and'; exprs: Expr[]}
export type OrExpr = {_type: 'expr'; _key: string; kind: 'or'; exprs: Expr[]}
export type NotExpr = {_type: 'expr'; _key: string; kind: 'not'; expr: Expr}
// Canonical, UI-agnostic model
export type Expr = AndExpr | OrExpr | NotExpr | CmpExpr

// Helper type guards
export function isAndExpr(expr: Expr): expr is AndExpr {
  return expr.kind === 'and'
}

export function isOrExpr(expr: Expr): expr is OrExpr {
  return expr.kind === 'or'
}

export function isNotExpr(expr: Expr): expr is NotExpr {
  return expr.kind === 'not'
}

export function isCmpExpr(expr: Expr): expr is CmpExpr {
  return expr.kind === 'cmp'
}

export type Variant<T = unknown> = {
  _key: string
  _type: 'variant'
  value?: T
  when: Expr
}

export type DecideField<T = unknown> = {
  default?: T
  _type: 'sanity.decideField'
  variants: Variant<T>[]
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
 * Evaluates an expression against the provided parameters
 * @internal
 */
function evaluateExpr(expr: Expr, decideParameters: DecideParameters): boolean {
  if (isAndExpr(expr)) {
    // All expressions in AND must be true
    return expr.exprs.every((e) => evaluateExpr(e, decideParameters))
  }

  if (isOrExpr(expr)) {
    // At least one expression in OR must be true
    return expr.exprs.some((e) => evaluateExpr(e, decideParameters))
  }

  if (isNotExpr(expr)) {
    // Negate the result of the inner expression
    return !evaluateExpr(expr.expr, decideParameters)
  }

  if (isCmpExpr(expr)) {
    // Get the parameter value
    const parameterValue = expr.attr ? decideParameters[expr.attr] : undefined

    // Only string and number types are supported for comparison
    if (typeof parameterValue !== 'string' && typeof parameterValue !== 'number') {
      return false
    }

    // For other operators, we need both a value and an operator
    if (!expr.op) {
      return false
    }

    // Evaluate the operator
    return resolveOperator[expr.op](parameterValue, expr.value as string | number)
  }

  return false
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

  // Find first matching variant
  const matchingVariant = field.variants?.find((variant) => {
    return evaluateExpr(variant.when, decideParameters)
  })

  // Return matching value or fall back to default
  return matchingVariant ? matchingVariant.value : field.default
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
