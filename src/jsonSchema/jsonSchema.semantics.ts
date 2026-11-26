// Value-level reading of JSON Schema keywords that the per-keyword rules need: effective numeric bounds (ISSUE-88),
// satisfiability and "accepts every value" (ISSUE-89 / ISSUE-153, POLICY-40), type sets and branch disjointness
// (POLICY-42 / POLICY-44), and the rewrites that make two equivalent spellings compare equal (ISSUE-70, ISSUE-98).
// Every function here is a cheap, conservative check: `false` means "not proven", never "proven otherwise".

import { deepEqual } from "../core"
import { isArray, isNumber, isObject, isPlainObject, isString } from "../utils"
import { hasOwnKey, ownValue } from "../own"
import { jsonSchemaValidators } from "./jsonSchema.consts"

type Schema = Record<string, unknown>

// the JSON types; `integer` values are `number` values
const ALL_TYPES = ["array", "boolean", "null", "number", "object", "string"]

/** The types a schema admits on its own (`type` keyword only), `undefined` when it does not restrict the type. */
export const schemaTypes = (schema: unknown): string[] | undefined => {
  if (!isObject(schema) || isArray(schema)) {
    return
  }
  const type = ownValue(schema, "type")
  if (isString(type)) {
    return [type]
  }
  return isArray(type) && type.every(isString) ? (type as string[]) : undefined
}

const covers = (types: string[], type: string) =>
  types.includes(type) || (type === "integer" && types.includes("number"))

/** The type list names every JSON type (`number` covering `integer`): the keyword does not restrict anything. */
export const coversAllTypes = (types: unknown): boolean =>
  isArray(types) && ALL_TYPES.every((type) => types.includes(type))

/** The schema admits only integers (`type: integer`, or a list whose only numeric member is `integer`). */
const integerOnly = (schema: Schema): boolean => {
  const types = schemaTypes(schema)
  return !!types && types.includes("integer") && !types.includes("number")
}

// ---------------------------------------------------------------------------------------------------------------
// effective numeric bounds (ISSUE-88)

export interface Bound {
  value: number
  exclusive: boolean
}

export type BoundKind = "min" | "max"

const boundKeys: Record<BoundKind, [inclusive: string, exclusive: string]> = {
  min: ["minimum", "exclusiveMinimum"],
  max: ["maximum", "exclusiveMaximum"],
}

/** The keywords of a bound kind. */
export const boundKeywords = (kind: BoundKind): readonly string[] => boundKeys[kind]

/**
 * The effective lower (`min`) or upper (`max`) bound of a schema: the tightest of `minimum` / `exclusiveMinimum`
 * (numeric form; the draft-04 / OpenAPI 3.0 boolean form is rewritten to it by the normalization when the bound is
 * present, and has no effect without one), on integers rounded to the inclusive integer bound.
 */
export const effectiveBound = (schema: unknown, kind: BoundKind): Bound | undefined => {
  if (!isObject(schema) || isArray(schema)) {
    return
  }
  const [inclusiveKey, exclusiveKey] = boundKeys[kind]
  const inclusive = ownValue(schema, inclusiveKey)
  const exclusive = ownValue(schema, exclusiveKey)
  let bound: Bound | undefined
  if (isNumber(inclusive)) {
    bound = { value: inclusive, exclusive: false }
  }
  if (isNumber(exclusive)) {
    const candidate = { value: exclusive, exclusive: true }
    bound = !bound || compareBounds(kind, candidate, bound) > 0 ? candidate : bound
  }
  if (!bound || !integerOnly(schema)) {
    return bound
  }
  const { value } = bound
  const rounded =
    kind === "min"
      ? bound.exclusive
        ? Math.floor(value) + 1
        : Math.ceil(value)
      : bound.exclusive
        ? Math.ceil(value) - 1
        : Math.floor(value)
  return { value: rounded, exclusive: false }
}

/** > 0 when `a` is the tighter bound, < 0 when `b` is, 0 when they are the same (an absent bound is the loosest). */
export const compareBounds = (kind: BoundKind, a: Bound | undefined, b: Bound | undefined): number => {
  if (!a || !b) {
    return a ? 1 : b ? -1 : 0
  }
  if (a.value !== b.value) {
    return kind === "min" ? a.value - b.value : b.value - a.value
  }
  return a.exclusive === b.exclusive ? 0 : a.exclusive ? 1 : -1
}

// ---------------------------------------------------------------------------------------------------------------
// satisfiability (ISSUE-89, ISSUE-153, POLICY-40)

const MAX_DEPTH = 3

const isEmptyRange = (min: unknown, max: unknown) => isNumber(min) && isNumber(max) && min > max

// one JSON type of the schema has no valid value under the keywords that apply to it
const typeUnsatisfiable = (schema: Schema, type: string, depth: number): boolean => {
  switch (type) {
    case "string":
      return isEmptyRange(schema.minLength, schema.maxLength)
    case "number":
    case "integer": {
      const integer = type === "integer" || integerOnly(schema)
      const probe = integer ? { ...schema, type: "integer" } : schema
      const min = effectiveBound(probe, "min")
      const max = effectiveBound(probe, "max")
      if (!min || !max) {
        return false
      }
      return min.value > max.value || (min.value === max.value && (min.exclusive || max.exclusive))
    }
    case "array": {
      if (isEmptyRange(schema.minItems, schema.maxItems) || isEmptyRange(schema.minContains, schema.maxContains)) {
        return true
      }
      // `items: false` limits the length to the tuple positions
      const tuple = isArray(schema.prefixItems) ? schema.prefixItems.length : 0
      return schema.items === false && isNumber(schema.minItems) && schema.minItems > tuple
    }
    case "object": {
      if (isEmptyRange(schema.minProperties, schema.maxProperties)) {
        return true
      }
      const required = isArray(schema.required) ? new Set(schema.required.filter(isString)) : new Set<string>()
      if (isNumber(schema.maxProperties) && required.size > schema.maxProperties) {
        return true
      }
      const properties = isPlainObject(schema.properties) ? schema.properties : {}
      const closed =
        schema.additionalProperties === false && !isPlainObject(schema.patternProperties) && !schema.propertyNames
      if (closed && isNumber(schema.minProperties) && schema.minProperties > Object.keys(properties).length) {
        return true
      }
      // a required property that no value can satisfy (`false`, or an unsatisfiable schema)
      for (const name of required) {
        const property = properties[name]
        if (property === undefined) {
          if (closed) {
            return true
          }
          continue
        }
        if (isUnsatisfiable(property, depth + 1)) {
          return true
        }
      }
      return false
    }
    default:
      return false
  }
}

/** No value is valid against the schema (`false`, an empty `enum`, contradicting bounds for every admitted type, …). */
export const isUnsatisfiable = (schema: unknown, depth = 0): boolean => {
  if (schema === false) {
    return true
  }
  if (!isPlainObject(schema) || depth > MAX_DEPTH) {
    return false
  }
  // own-key reads: schema objects come in many shapes (ISSUE-330)
  const enumValues = ownValue(schema, "enum")
  if (isArray(enumValues) && enumValues.length === 0) {
    return true
  }
  const not = ownValue(schema, "not")
  if (not === true || (isPlainObject(not) && acceptsEverything(not, depth + 1))) {
    return true
  }
  // a schema contained in its own negation (ISSUE-153): `{ additionalProperties: S, not: { additionalProperties: S } }`
  if (isPlainObject(not)) {
    const { not: negated, ...rest } = schema
    if (isSubschema(rest, negated, depth + 1)) {
      return true
    }
  }
  for (const combiner of ["anyOf", "oneOf"]) {
    const branches = ownValue(schema, combiner)
    if (isArray(branches) && branches.length && branches.every((branch) => isUnsatisfiable(branch, depth + 1))) {
      return true
    }
  }
  // a oneOf whose every branch has an identical twin: a value matching one branch matches two
  const oneOf = ownValue(schema, "oneOf")
  if (
    isArray(oneOf) &&
    oneOf.length > 1 &&
    oneOf.every((branch, i) => oneOf.some((other, j) => i !== j && deepEqual(branch, other)))
  ) {
    return true
  }
  const allOf = ownValue(schema, "allOf")
  if (isArray(allOf) && allOf.some((branch) => isUnsatisfiable(branch, depth + 1))) {
    return true
  }
  const types = schemaTypes(schema)
  if (!types) {
    return false
  }
  if (!types.length) {
    return true
  }
  return types.every((type) => typeUnsatisfiable(schema, type, depth))
}

// keywords that never restrict the valid values
const annotationKeywords = new Set([
  "title",
  "description",
  "default",
  "examples",
  "example",
  "deprecated",
  "readOnly",
  "writeOnly",
  "$comment",
  "$id",
  "$schema",
  "$anchor",
  "$dynamicAnchor",
  "$vocabulary",
  "$defs",
  "definitions",
  "externalDocs",
  "xml",
  "contentMediaType",
  "contentEncoding",
  "format",
])

const isAnnotationKeyword = (key: string) => annotationKeywords.has(key) || key.startsWith("x-")

/** Every value is valid against the schema (`true`, `{}`, only annotations, a type list naming every type, …). */
export const acceptsEverything = (schema: unknown, depth = 0): boolean => {
  if (schema === true) {
    return true
  }
  if (!isPlainObject(schema) || depth > MAX_DEPTH) {
    return false
  }
  for (const key of Object.keys(schema)) {
    const value = schema[key]
    if (isAnnotationKeyword(key)) {
      continue
    }
    if (key === "type" && coversAllTypes(value)) {
      continue
    }
    if ((key === "anyOf" || key === "oneOf") && isArray(value)) {
      // anyOf: one branch accepting everything suffices; oneOf: exactly one branch may match every value
      const accepting = value.filter((branch) => acceptsEverything(branch, depth + 1)).length
      if (key === "anyOf" ? accepting > 0 : accepting === 1 && value.length === 1) {
        continue
      }
      return false
    }
    if (key === "allOf" && isArray(value) && value.every((branch) => acceptsEverything(branch, depth + 1))) {
      continue
    }
    if (key === "not" && isUnsatisfiable(value, depth + 1)) {
      continue
    }
    return false
  }
  return true
}

// ---------------------------------------------------------------------------------------------------------------
// type sets of branches (POLICY-44) and governing schemas (POLICY-42)

/** Every branch admits a single type and no two branches admit a common value by type (`integer` ⊂ `number`). */
export const disjointByType = (branches: unknown): boolean => {
  if (!isArray(branches) || branches.length < 2) {
    return false
  }
  const seen: string[] = []
  for (const branch of branches) {
    const types = schemaTypes(branch)
    if (!types?.length) {
      return false
    }
    for (const type of types) {
      if (seen.some((other) => covers([other], type) || covers([type], other))) {
        return false
      }
      seen.push(type)
    }
  }
  return true
}

export type SchemaRelation = "equivalent" | "narrower" | "wider" | "unknown"

/**
 * How a schema `a` relates to a schema `b` by the values they admit, as far as cheaply provable: structurally equal
 * (or both `true` / both `false`), `false` against anything, or type sets in strict containment with no other keyword.
 */
export const schemaRelation = (a: unknown, b: unknown): SchemaRelation => {
  if (deepEqual(a, b) || (acceptsEverything(a) && acceptsEverything(b)) || (a === false && b === false)) {
    return "equivalent"
  }
  if (a === false || acceptsEverything(b)) {
    return "narrower"
  }
  if (b === false || acceptsEverything(a)) {
    return "wider"
  }
  const onlyType = (schema: unknown) =>
    isPlainObject(schema) && Object.keys(schema).every((key) => key === "type" || isAnnotationKeyword(key))
  const ta = schemaTypes(a)
  const tb = schemaTypes(b)
  if (!ta || !tb || !onlyType(a) || !onlyType(b)) {
    return "unknown"
  }
  const aInB = ta.every((type) => covers(tb, type))
  const bInA = tb.every((type) => covers(ta, type))
  return aInB && bInA ? "equivalent" : aInB ? "narrower" : bInA ? "wider" : "unknown"
}

// ---------------------------------------------------------------------------------------------------------------
// rewrites (applied to both sides before the comparison)

// keywords whose value is the default: the same schema as without the keyword (ISSUE-70)
const isDefaultValued = (key: string, value: unknown): boolean => {
  switch (key) {
    case "minLength":
    case "minItems":
    case "minProperties":
      return value === 0
    case "uniqueItems":
    case "readOnly":
    case "writeOnly":
    case "nullable":
      return value === false
    case "additionalProperties":
    case "additionalItems":
    case "unevaluatedProperties":
    case "unevaluatedItems":
    case "items":
    case "propertyNames":
      return value === true || (isPlainObject(value) && Object.keys(value).length === 0)
    case "type":
      return coversAllTypes(value)
    default:
      return false
  }
}

/**
 * Drops keywords that carry their default value (`minItems: 0`, `uniqueItems: false`, `additionalProperties: {}`, …)
 * where the other side does not have the keyword: the two schemas are the same (a keyword on both sides is compared
 * by value, `minItems: 1` → `0` stays a replaced bound).
 */
export const withoutDefaultValues = (schema: Schema, other: Schema): Schema => {
  let result: Schema | undefined
  for (const key of Object.keys(schema)) {
    if (!(key in other) && isDefaultValued(key, schema[key])) {
      result ??= { ...schema }
      delete result[key]
    }
  }
  return result ?? schema
}

const typeKeywords: Record<string, readonly string[]> = jsonSchemaValidators

// a branch that admits one type and holds only keywords of that type (and annotations)
const singleTypeBranch = (branch: unknown): string | undefined => {
  if (!isPlainObject(branch) || !isString(branch.type)) {
    return
  }
  const type = branch.type
  const own = typeKeywords[type] ?? []
  for (const key of Object.keys(branch)) {
    if (key !== "type" && !own.includes(key) && !isAnnotationKeyword(key)) {
      return
    }
  }
  return type
}

/**
 * A combinator of single-type branches (`anyOf: [{ type: string }, { type: object, properties }]`, a `oneOf` only
 * when the branches are disjoint) is the schema `{ type: [string, object], properties }`: the type-specific keywords
 * of different types do not interact (ISSUE-98). Collapsed only when every branch admits a different type and no
 * keyword appears in two branches or next to the combinator, so the result is exactly equivalent.
 */
export const collapseTypeBranches = (schema: Schema, combiner: "anyOf" | "oneOf"): Schema | undefined => {
  const list = schema[combiner]
  if (!isArray(list) || list.length < 2 || "type" in schema) {
    return
  }
  // in an anyOf, a bare `integer` branch next to a `number` branch adds no value
  const numberBranch = list.some((branch) => singleTypeBranch(branch) === "number")
  const branches =
    combiner === "anyOf" && numberBranch
      ? list.filter(
          (branch) => !(isPlainObject(branch) && branch.type === "integer" && Object.keys(branch).length === 1),
        )
      : list
  const types: string[] = []
  const merged: Schema = {}
  for (const branch of branches) {
    const type = singleTypeBranch(branch)
    if (!type || types.some((other) => covers([other], type) || covers([type], other))) {
      return
    }
    types.push(type)
    for (const key of Object.keys(branch as Schema)) {
      if (key === "type") {
        continue
      }
      // annotations of a branch describe that branch only; a keyword in two branches would interact
      if (isAnnotationKeyword(key) || key in merged || key in schema) {
        return
      }
      merged[key] = (branch as Schema)[key]
    }
  }
  const { [combiner]: _list, ...rest } = schema
  return { ...rest, ...merged, type: types }
}

// ---------------------------------------------------------------------------------------------------------------
// set-level normalization (ISSUE-153): effective array / object bounds, containment, branch partitions, negations

/** A count range of one instance type (`minItems` / `maxItems`, …); `max` is `Infinity` when unbounded. */
interface CountRange {
  min: number
  max: number
}

const countFamilies = [
  { type: "array", min: "minItems", max: "maxItems" },
  { type: "string", min: "minLength", max: "maxLength" },
  { type: "object", min: "minProperties", max: "maxProperties" },
] as const

type CountFamily = (typeof countFamilies)[number]

const countRange = (schema: Schema, family: CountFamily): CountRange => ({
  min: isNumber(schema[family.min]) ? (schema[family.min] as number) : 0,
  max: isNumber(schema[family.max]) ? (schema[family.max] as number) : Number.POSITIVE_INFINITY,
})

/**
 * The effective upper bound of the item count (`maxItems`, `items: false` after the tuple, the draft-07 tuple with
 * `additionalItems: false`) or of the property count (`maxProperties`, `additionalProperties: false` without declared or
 * pattern properties); `Infinity` when unbounded.
 */
export const effectiveMaxCount = (schema: unknown, type: "array" | "object"): number => {
  if (!isPlainObject(schema)) {
    return schema === false ? 0 : Number.POSITIVE_INFINITY
  }
  let max = Number.POSITIVE_INFINITY
  if (type === "array") {
    max = isNumber(schema.maxItems) ? schema.maxItems : max
    if (schema.items === false) {
      max = Math.min(max, isArray(schema.prefixItems) ? schema.prefixItems.length : 0)
    } else if (isArray(schema.items) && schema.additionalItems === false) {
      max = Math.min(max, schema.items.length)
    }
    return max
  }
  max = isNumber(schema.maxProperties) ? schema.maxProperties : max
  if (
    schema.additionalProperties === false &&
    !hasEntries(schema.properties) &&
    !hasEntries(schema.patternProperties)
  ) {
    max = 0
  }
  return max
}

const hasEntries = (value: unknown) => isPlainObject(value) && Object.keys(value).length > 0

// keywords whose meaning depends on their siblings: a schema is merged into another, or compared keyword by keyword,
// only when the other side has no keyword of the same group (or the whole group is equal)
const keywordGroups: readonly (readonly string[])[] = [
  ["properties", "patternProperties", "additionalProperties"],
  ["prefixItems", "items", "additionalItems"],
  ["contains", "minContains", "maxContains"],
  ["if", "then", "else"],
]
const groupOf = new Map<string, readonly string[]>()
for (const group of keywordGroups) {
  for (const key of group) {
    groupOf.set(key, group)
  }
}

// keywords that see the whole schema (the annotations of every applicator): never rewritten or merged
const opaqueKeywords = new Set(["unevaluatedProperties", "unevaluatedItems", "$ref", "$dynamicRef", "nullable"])

const hasOpaqueKeyword = (schema: Schema) => Object.keys(schema).some((key) => opaqueKeywords.has(key))

// the instance type a validator keyword applies to (`minLength` -> string), `undefined` for keywords of every type
const validatorType = new Map<string, string>()
for (const [type, keys] of Object.entries(jsonSchemaValidators)) {
  if (type !== "integer") {
    for (const key of keys) {
      validatorType.set(key, type)
    }
  }
}
for (const [key, type] of [
  ["minContains", "array"],
  ["maxContains", "array"],
  ["contains", "array"],
  ["prefixItems", "array"],
  ["dependentRequired", "object"],
  ["dependentSchemas", "object"],
] as const) {
  validatorType.set(key, type)
}

/** The schema's own type list in canonical form: `integer` dropped next to `number`, sorted, `undefined` for all. */
const canonicalTypes = (types: string[]): string[] | undefined => {
  const unique = [...new Set(types)].filter((type) => type !== "integer" || !types.includes("number")).sort()
  return coversAllTypes(unique) ? undefined : unique
}

const intersectTypes = (a: string[], b: string[]): string[] => {
  const result = new Set<string>()
  for (const type of a) {
    if (covers(b, type)) {
      result.add(type)
    }
  }
  for (const type of b) {
    if (covers(a, type)) {
      result.add(type)
    }
  }
  return [...result]
}

// every type the list does not admit, `undefined` when that is not a type list (`number` without `integer`)
const complementTypes = (types: string[]): string[] | undefined => {
  if (types.includes("integer") && !types.includes("number")) {
    return
  }
  return ALL_TYPES.filter((type) => !types.includes(type))
}

/**
 * Inner ⊆ outer: every value valid against `inner` is valid against `outer`, as far as cheaply provable (structural
 * equality, `true` / `false`, type sets, count and numeric ranges, `required`, `enum`, item and property schemas
 * compared recursively, a branch of an `anyOf`). `false` means "not proven".
 */
export const isSubschema = (inner: unknown, outer: unknown, depth = 0): boolean => {
  if (deepEqual(inner, outer) || acceptsEverything(outer, depth) || isUnsatisfiable(inner, depth)) {
    return true
  }
  if (!isPlainObject(inner) || !isPlainObject(outer) || depth > MAX_DEPTH) {
    return false
  }
  // an inner disjunction: every branch is contained (the inner keywords next to it only narrow the branches)
  if (
    isArray(inner.anyOf) &&
    inner.anyOf.length &&
    Object.keys(inner).every((key) => key === "anyOf" || isAnnotationKeyword(key))
  ) {
    if (inner.anyOf.every((branch) => isSubschema(branch, outer, depth + 1))) {
      return true
    }
  }
  if (hasOpaqueKeyword(outer) || inner.nullable === true) {
    return false
  }
  // an outer disjunction without other keywords: one branch containing the inner schema suffices
  const outerKeys = Object.keys(outer).filter((key) => !isAnnotationKeyword(key))
  if (outerKeys.length === 1 && outerKeys[0] === "anyOf" && isArray(outer.anyOf)) {
    return outer.anyOf.some((branch) => isSubschema(inner, branch, depth + 1))
  }
  const innerTypes = schemaTypes(inner)
  const checkedGroups = new Set<readonly string[]>()
  for (const key of outerKeys) {
    const value = outer[key]
    // a validator of a type the inner schema does not admit constrains nothing there
    const own = validatorType.get(key)
    if (own && innerTypes && !innerTypes.some((type) => covers([own], type))) {
      continue
    }
    const group = groupOf.get(key)
    if (group) {
      if (checkedGroups.has(group)) {
        continue
      }
      checkedGroups.add(group)
      if (!groupContained(inner, outer, group, depth)) {
        return false
      }
      continue
    }
    if (!keywordContained(inner, outer, key, value, innerTypes, depth)) {
      return false
    }
  }
  return true
}

const keywordContained = (
  inner: Schema,
  outer: Schema,
  key: string,
  value: unknown,
  innerTypes: string[] | undefined,
  depth: number,
): boolean => {
  switch (key) {
    case "type": {
      const outerTypes = schemaTypes(outer)
      return !!outerTypes && !!innerTypes && innerTypes.every((type) => covers(outerTypes, type))
    }
    case "required":
      return isArray(value) && value.every((name) => isArray(inner.required) && inner.required.includes(name))
    case "minItems":
    case "minLength":
    case "minProperties":
    case "minContains":
      return isNumber(value) && isNumber(inner[key]) && (inner[key] as number) >= value
    case "maxItems":
    case "maxProperties":
      return isNumber(value) && effectiveMaxCount(inner, key === "maxItems" ? "array" : "object") <= value
    case "maxLength":
    case "maxContains":
      return isNumber(value) && isNumber(inner[key]) && (inner[key] as number) <= value
    case "minimum":
    case "exclusiveMinimum":
    case "maximum":
    case "exclusiveMaximum": {
      const kind: BoundKind = key.endsWith("inimum") ? "min" : "max"
      const bound = effectiveBound(inner, kind)
      return !!bound && compareBounds(kind, bound, effectiveBound(outer, kind)) >= 0
    }
    case "enum":
      return (
        isArray(value) &&
        (isArray(inner.enum)
          ? inner.enum.every((item) => value.some((other) => deepEqual(item, other)))
          : "const" in inner && value.some((other) => deepEqual(inner.const, other)))
      )
    case "const":
      return (
        ("const" in inner && deepEqual(inner.const, value)) ||
        (isArray(inner.enum) && inner.enum.length > 0 && inner.enum.every((item) => deepEqual(item, value)))
      )
    case "propertyNames":
      return isSubschema(inner.propertyNames ?? true, value, depth + 1) || effectiveMaxCount(inner, "object") === 0
    default:
      // any other constraint must be the same on the inner side (an equal `not`, `oneOf`, `pattern`, …)
      return key in inner && deepEqual(inner[key], value)
  }
}

// a group of keywords that depend on each other (`properties` / `patternProperties` / `additionalProperties`,
// `prefixItems` / `items`): contained when equal, or by property / item schema for the forms without patterns or tuples
const groupContained = (inner: Schema, outer: Schema, group: readonly string[], depth: number): boolean => {
  if (group.every((key) => deepEqual(inner[key], outer[key]))) {
    return true
  }
  if (group[0] === "properties") {
    if (hasEntries(inner.patternProperties) || hasEntries(outer.patternProperties)) {
      return false
    }
    if (effectiveMaxCount(inner, "object") === 0) {
      return true
    }
    const innerProperties = isPlainObject(inner.properties) ? inner.properties : {}
    const outerProperties = isPlainObject(outer.properties) ? outer.properties : {}
    const innerAdditional = inner.additionalProperties ?? true
    const outerAdditional = outer.additionalProperties ?? true
    // the schema a key gets on a side: its declaration, else the additional-properties schema
    for (const name of new Set([...Object.keys(innerProperties), ...Object.keys(outerProperties)])) {
      const innerSchema = name in innerProperties ? innerProperties[name] : innerAdditional
      const outerSchema = name in outerProperties ? outerProperties[name] : outerAdditional
      if (!isSubschema(innerSchema, outerSchema, depth + 1)) {
        return false
      }
    }
    return isSubschema(innerAdditional, outerAdditional, depth + 1)
  }
  if (group[0] === "prefixItems") {
    if (isArray(inner.items) || isArray(outer.items) || !deepEqual(inner.prefixItems, outer.prefixItems)) {
      return false
    }
    return effectiveMaxCount(inner, "array") === (isArray(inner.prefixItems) ? inner.prefixItems.length : 0)
      ? true
      : isSubschema(inner.items ?? true, outer.items ?? true, depth + 1)
  }
  return false
}

// ---- canonical form: equal canonical forms accept the same values -------------------------------------------

const CANONICAL_BUDGET = 128

class BudgetExceeded extends Error {}

// the value has at most CANONICAL_BUDGET objects (a cheap count before any rewrite)
const withinBudget = (value: unknown): boolean => {
  const stack: unknown[] = [value]
  let count = 0
  while (stack.length) {
    const node = stack.pop()
    if (typeof node !== "object" || node === null) {
      continue
    }
    if (++count > CANONICAL_BUDGET) {
      return false
    }
    if (isArray(node)) {
      for (const item of node) {
        stack.push(item)
      }
    } else {
      for (const key in node) {
        stack.push((node as Schema)[key])
      }
    }
  }
  return true
}

interface Budget {
  nodes: number
  // the set-level rewrites too (otherwise only the spellings the keyword-level comparison already treats as equal:
  // defaults, type lists, branch order, a single branch, a oneOf of branches disjoint by type)
  full: boolean
}

const schemaMapKeys = ["properties", "patternProperties", "dependentSchemas", "$defs", "definitions"]
const schemaListKeys = ["allOf", "anyOf", "oneOf", "prefixItems"]
const schemaValueKeys = [
  "items",
  "additionalItems",
  "additionalProperties",
  "not",
  "contains",
  "propertyNames",
  "if",
  "then",
  "else",
  "contentSchema",
]

// a key for ordering branches: JSON with sorted object keys
const sortKey = (value: unknown): string => {
  if (isArray(value)) {
    return `[${value.map(sortKey).join(",")}]`
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${sortKey(value[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "undefined"
}

// the values in the order of their sort keys (each key computed once)
const sortedByKey = (values: unknown[]): unknown[] =>
  values
    .map((value) => ({ key: sortKey(value), value }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.value)

/**
 * The conjunction of two canonical schemas as one schema, `undefined` when it cannot be written without `allOf`
 * (a keyword on both sides with different values other than `type`, interacting keywords such as `properties` and
 * `additionalProperties` from different sides, keywords that see the whole schema).
 */
const conjoin = (schema: Schema, other: unknown): Schema | false | undefined => {
  if (other === true) {
    return schema
  }
  if (other === false) {
    return false
  }
  if (!isPlainObject(other) || hasOpaqueKeyword(schema) || hasOpaqueKeyword(other)) {
    return
  }
  const result: Schema = { ...schema }
  for (const key of Object.keys(other)) {
    const value = other[key]
    if (!(key in result)) {
      const group = groupOf.get(key)
      if (group?.some((member) => member !== key && member in schema && !(member in other))) {
        return
      }
      result[key] = value
      continue
    }
    if (deepEqual(result[key], value)) {
      continue
    }
    if (key === "type") {
      const a = schemaTypes(result)
      const b = schemaTypes(other)
      if (!a || !b) {
        return
      }
      const types = intersectTypes(a, b)
      if (!types.length) {
        return false
      }
      result.type = types.length === 1 ? types[0] : types.sort()
      continue
    }
    return
  }
  for (const key of Object.keys(schema)) {
    const group = groupOf.get(key)
    if (group?.some((member) => member !== key && member in other && !(member in schema))) {
      return
    }
  }
  return result
}

const canonicalChild = (value: unknown, budget: Budget, depth: number): unknown =>
  typeof value === "boolean" || isPlainObject(value) ? canonicalize(value, budget, depth + 1) : value

const canonicalize = (input: unknown, budget: Budget, depth: number): unknown => {
  if (!isPlainObject(input)) {
    return input
  }
  if (++budget.nodes > CANONICAL_BUDGET || depth > 32) {
    throw new BudgetExceeded()
  }
  if ("$ref" in input) {
    return input
  }
  if (budget.full && isUnsatisfiable(input)) {
    return false
  }
  let schema: Schema = {}
  for (const key of Object.keys(input)) {
    const value = input[key]
    if (schemaValueKeys.includes(key) && !isArray(value)) {
      schema[key] = canonicalChild(value, budget, depth)
    } else if (schemaListKeys.includes(key) && isArray(value)) {
      schema[key] = value.map((item) => canonicalChild(item, budget, depth))
    } else if (key === "items" && isArray(value)) {
      schema[key] = value.map((item) => canonicalChild(item, budget, depth))
    } else if (schemaMapKeys.includes(key) && isPlainObject(value)) {
      const map: Schema = {}
      for (const name of Object.keys(value)) {
        map[name] = canonicalChild(value[name], budget, depth)
      }
      schema[key] = map
    } else {
      schema[key] = value
    }
  }
  const rewritten = rewrite(schema, budget.full)
  if (rewritten === false || (budget.full && isUnsatisfiable(rewritten))) {
    return false
  }
  if (budget.full && acceptsEverything(rewritten)) {
    const annotations = Object.keys(rewritten).filter(isAnnotationKeyword)
    if (!annotations.length) {
      return true
    }
    schema = {}
    for (const key of annotations) {
      schema[key] = rewritten[key]
    }
    return schema
  }
  return rewritten
}

// the rewrites of one schema node whose subschemas are canonical already; `false` when the node accepts nothing
const rewrite = (input: Schema, full = true): Schema | false => {
  let schema: Schema = input
  const opaque = hasOpaqueKeyword(schema)

  // keywords with their default value
  for (const key of Object.keys(schema)) {
    const value = schema[key]
    if (
      isDefaultValued(key, value) ||
      ((key === "required" || key === "examples") && isArray(value) && !value.length) ||
      (schemaMapKeys.includes(key) && isPlainObject(value) && !Object.keys(value).length) ||
      (key === "dependentRequired" && isPlainObject(value) && !Object.keys(value).length) ||
      (key === "deprecated" && value === false)
    ) {
      delete schema[key]
    }
  }
  if (isArray(schema.required)) {
    schema.required = [...new Set(schema.required)].sort()
  }
  if (isArray(schema.enum)) {
    schema.enum = sortedByKey(schema.enum)
  }
  const types = schemaTypes(schema)
  if (types && !opaque) {
    const canonical = canonicalTypes(types)
    if (!canonical) {
      delete schema.type
    } else {
      schema.type = canonical.length === 1 ? canonical[0] : canonical
    }
  }
  if (opaque) {
    return schema
  }

  // negations: `not` of `false`, of a negation, of a type list, of an `allOf` (De Morgan)
  for (let guard = 0; full && "not" in schema && guard < 8; guard++) {
    const negated = schema.not
    const { not: _not, ...rest } = schema
    let next: Schema | false | undefined
    if (negated === false) {
      next = rest
    } else if (isPlainObject(negated)) {
      const keys = Object.keys(negated)
      if (keys.length === 1 && keys[0] === "not") {
        next = conjoin(rest, negated.not)
      } else if (keys.length === 1 && keys[0] === "type") {
        const complement = complementTypes(schemaTypes(negated) ?? [])
        next = complement ? conjoin(rest, { type: complement.length === 1 ? complement[0] : complement }) : undefined
        if (complement && !complement.length) {
          next = false
        }
      } else if (keys.length === 1 && keys[0] === "allOf" && isArray(negated.allOf) && !("anyOf" in rest)) {
        next = { ...rest, anyOf: negated.allOf.map((branch) => rewriteNegation(branch)) }
      }
    }
    if (next === false) {
      return false
    }
    if (!next) {
      break
    }
    schema = next
  }

  // disjunctions: drop branches that accept nothing or are contained in another, merge branches that differ by a
  // count range only, fold a single branch into the schema; a oneOf whose branches no value matches twice is an anyOf
  for (const combiner of ["oneOf", "anyOf"] as const) {
    if (!isArray(schema[combiner])) {
      continue
    }
    const { [combiner]: list, ...rest } = schema
    let branches = (list as unknown[]).filter((branch) => branch !== false)
    let target: "anyOf" | "oneOf" = combiner
    if (combiner === "oneOf" && !("anyOf" in rest) && disjointByType(branches)) {
      target = "anyOf"
    }
    if (full) {
      branches = simplifyBranches(branches, target)
    }
    if (!branches.length) {
      return false
    }
    if (full && target === "anyOf" && branches.some((branch) => acceptsEverything(branch))) {
      schema = rest
      continue
    }
    if (branches.length === 1) {
      const folded = conjoin(rest, branches[0])
      if (folded === false) {
        return false
      }
      if (folded) {
        const next = rewrite(folded, full)
        if (next === false) {
          return false
        }
        schema = next
        continue
      }
    }
    schema = { ...rest, [target]: sortedByKey(branches) }
  }

  if (!full) {
    return schema
  }
  // effective item and property counts: `items: false` is a maximum item count, `additionalProperties: false`
  // without declared properties a maximum property count of 0; with nothing allowed, the item / property schemas
  // constrain nothing
  const maxItems = effectiveMaxCount(schema, "array")
  if (schema.items === false || (isArray(schema.items) && schema.additionalItems === false)) {
    schema = { ...schema, maxItems }
    if (schema.items === false) {
      delete schema.items
    } else {
      delete schema.additionalItems
    }
  }
  if (maxItems === 0) {
    for (const key of ["items", "prefixItems", "additionalItems", "uniqueItems"]) {
      delete schema[key]
    }
  }
  const maxProperties = effectiveMaxCount(schema, "object")
  if (schema.additionalProperties === false && maxProperties === 0) {
    const { additionalProperties: _additional, ...rest } = schema
    schema = { ...rest, maxProperties: 0 }
  }
  if (maxProperties === 0) {
    for (const key of [
      "properties",
      "patternProperties",
      "additionalProperties",
      "propertyNames",
      "dependentRequired",
      "dependentSchemas",
    ]) {
      delete schema[key]
    }
  }
  return schema
}

// `not` of a canonical branch, rewritten where the negation simplifies
const rewriteNegation = (branch: unknown): unknown => {
  if (branch === true) {
    return false
  }
  if (branch === false) {
    return true
  }
  const negated = rewrite({ not: branch })
  return negated === false ? false : acceptsEverything(negated) ? true : negated
}

// two branches that differ only by the count range of one family (the rest equal): the range of each
const rangePair = (
  a: unknown,
  b: unknown,
): { family: CountFamily; rest: Schema; ra: CountRange; rb: CountRange } | undefined => {
  if (!isPlainObject(a) || !isPlainObject(b)) {
    return
  }
  for (const family of countFamilies) {
    if (!(family.min in a || family.max in a) || !(family.min in b || family.max in b)) {
      continue
    }
    const { [family.min]: _aMin, [family.max]: _aMax, ...aRest } = a
    const { [family.min]: _bMin, [family.max]: _bMax, ...bRest } = b
    if (deepEqual(aRest, bRest)) {
      return { family, rest: aRest, ra: countRange(a, family), rb: countRange(b, family) }
    }
  }
}

const withRange = (schema: Schema, family: CountFamily, range: CountRange): Schema => {
  const result = { ...schema }
  if (range.min > 0) {
    result[family.min] = range.min
  }
  if (range.max !== Number.POSITIVE_INFINITY) {
    result[family.max] = range.max
  }
  return result
}

// the type lists do not rule out `inner` ⊆ `outer` (canonical branches: an unsatisfiable branch is `false` already)
const typesMayContain = (inner: unknown, outer: unknown): boolean => {
  const outerTypes = schemaTypes(outer)
  const innerTypes = schemaTypes(inner)
  return !outerTypes || (!!innerTypes && innerTypes.every((type) => covers(outerTypes, type)))
}

const simplifyBranches = (input: unknown[], combiner: "anyOf" | "oneOf"): unknown[] => {
  let branches = [...input]
  if (combiner === "anyOf") {
    // (P and not Q) or Q = P or Q
    branches = branches.map((branch) => {
      if (!isPlainObject(branch) || !("not" in branch)) {
        return branch
      }
      const { not: negated, ...rest } = branch
      return branches.some((other) => other !== branch && deepEqual(other, negated)) ? rest : branch
    })
    // a branch contained in another adds no value (removed one at a time: two equivalent branches keep one)
    for (let i = 0; i < branches.length;) {
      const branch = branches[i]
      if (branches.some((other, j) => j !== i && typesMayContain(branch, other) && isSubschema(branch, other))) {
        branches.splice(i, 1)
      } else {
        i++
      }
    }
  }
  // branches that differ by a count range only: one branch with the union of the ranges where it is one range (in a
  // oneOf, the ranges must be disjoint and the branches admit only the range's type, else a value matches both)
  for (let merged = true; merged && branches.length > 1;) {
    merged = false
    outer: for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const pair = rangePair(branches[i], branches[j])
        if (!pair) {
          continue
        }
        const { family, rest, ra, rb } = pair
        const [lo, hi] = ra.min <= rb.min ? [ra, rb] : [rb, ra]
        const disjoint = lo.max < hi.min
        const touching = hi.min <= lo.max + 1
        if (!touching) {
          continue
        }
        if (combiner === "oneOf") {
          const types = schemaTypes(rest)
          if (!disjoint || !types || types.some((type) => type !== family.type)) {
            continue
          }
        }
        const union = { min: lo.min, max: Math.max(lo.max, hi.max) }
        const next = rewrite(withRange(rest, family, union))
        branches = [...branches.slice(0, i), next, ...branches.slice(i + 1, j), ...branches.slice(j + 1)]
        merged = true
        break outer
      }
    }
  }
  return branches
}

/**
 * Two schemas accept exactly the same values only by a set-level rewrite (ISSUE-153): both unsatisfiable, or equal
 * after the rewrites of effective bounds, partitions and negations, but not already equal in the spellings the
 * keyword-level comparison handles (defaults, branch order, a single branch), which it reports itself. `false` means
 * "not proven"; schemas larger than the canonicalization budget are not compared.
 */
export const equivalentBySetRewrite = (a: unknown, b: unknown): boolean => {
  if (!withinBudget(a) || !withinBudget(b)) {
    return false
  }
  try {
    const canonical = (value: unknown, full: boolean) => canonicalize(value, { nodes: 0, full }, 0)
    const proven = (isUnsatisfiable(a) && isUnsatisfiable(b)) || deepEqual(canonical(a, true), canonical(b, true))
    return proven && !deepEqual(canonical(a, false), canonical(b, false))
  } catch (error) {
    if (error instanceof BudgetExceeded) {
      return false
    }
    throw error
  }
}

/**
 * A schema node pair worth the set-level comparison: a keyword on either side that another spelling can express
 * (`not`, `anyOf` / `oneOf`, `items: false`, `maxItems: 0`, `additionalProperties: false`, `maxProperties: 0`, a type
 * list). A cheap check of the top-level keywords only.
 */
export const hasSetLevelKeyword = (schema: unknown): boolean =>
  isPlainObject(schema) &&
  (hasOwnKey(schema, "not") ||
    hasOwnKey(schema, "anyOf") ||
    hasOwnKey(schema, "oneOf") ||
    ownValue(schema, "items") === false ||
    ownValue(schema, "maxItems") === 0 ||
    ownValue(schema, "additionalProperties") === false ||
    ownValue(schema, "maxProperties") === 0 ||
    isArray(ownValue(schema, "type")))
