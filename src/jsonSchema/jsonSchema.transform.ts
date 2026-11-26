import { type MergeOptions, type MergeRules, type Merger, createMerger, jsonSchemaMergeRules } from "allof-merge"

import { createEmptyCombiner, mergeAllOfSibling, mergeCombinarySibling, mergeRefSibling } from "./jsonSchema.utils"
import { collapseTypeBranches, coversAllTypes, isUnsatisfiable, withoutDefaultValues } from "./jsonSchema.semantics"
import type { CompareContext, CompareSession, CompareTransformResolver, TransformResolver } from "../types"
import type { JsonSchemaDraft } from "./jsonSchema.types"
import { jsonSchemaAllowedSibling } from "./jsonSchema.consts"
import { isArray, isPlainObject, isString } from "../utils"
import { isRefNode, ownValue } from "../own"

export const valuesTransformation = <T = unknown>(
  values: Record<"before" | "after", T>,
  resolver: TransformResolver<T>,
) => {
  values.before = resolver(values.before, values.after)
  values.after = resolver(values.after, values.before)
}

const isPlainRef = (value: Record<string, unknown>) => {
  for (const key in value) {
    if (key !== "$ref") {
      return false
    }
  }
  return typeof value.$ref === "string"
}

export const transformJsonSchemaCombiners =
  (allowedSibling = jsonSchemaAllowedSibling): CompareTransformResolver =>
  (before, after) => {
    if (!isPlainObject(before) || !isPlainObject(after)) {
      return [before, after]
    }

    // a combinator of single-type branches facing a schema without one is the schema with the type list (ISSUE-98)
    const values = { before: collapseCombiner(before, after), after: collapseCombiner(after, before) }

    valuesTransformation(values, (value) => {
      if ("oneOf" in value) {
        return mergeCombinarySibling(value, "oneOf", allowedSibling)
      }
      if ("anyOf" in value) {
        return mergeCombinarySibling(value, "anyOf", allowedSibling)
      }
      if ("allOf" in value) {
        return mergeAllOfSibling(value, allowedSibling)
      }
      if ("$ref" in value) {
        return mergeRefSibling(value, allowedSibling)
      }
      return value
    })

    // a plain reference facing a combinator is not wrapped into one (ISSUE-320): the `$ref` resolver compares its
    // target, which is normalized against the combinator at that point
    for (const prop of ["oneOf", "anyOf"]) {
      if (prop in values.before && !("oneOf" in values.after || "anyOf" in values.after)) {
        return isPlainRef(values.after)
          ? [values.before, values.after]
          : [values.before, createEmptyCombiner(values.after, prop, allowedSibling)]
      }
      if (prop in values.after && !("oneOf" in values.before || "anyOf" in values.before)) {
        return isPlainRef(values.before)
          ? [values.before, values.after]
          : [createEmptyCombiner(values.before, prop, allowedSibling), values.after]
      }
    }

    return [values.before, values.after]
  }

// collapsed only against a schema that admits several types itself (a type list, or an OpenAPI 3.0 nullable type), or
// where the branches together admit every type: against a single type the branches stay branches (a type wrapped
// into a oneOf is reported as an added branch)
const collapseCombiner = (value: Record<string, unknown>, other: Record<string, unknown>) => {
  if ("oneOf" in other || "anyOf" in other || !("anyOf" in value || "oneOf" in value)) {
    return value
  }
  const collapsed = collapseTypeBranches(value, "anyOf" in value ? "anyOf" : "oneOf")
  if (!collapsed) {
    return value
  }
  const types = isArray(other.type) ? other.type.length : isString(other.type) ? 1 + +(other.nullable === true) : 0
  return types > 1 || coversAllTypes(collapsed.type) ? collapsed : value
}

export const createFields =
  (...fields: string[]): CompareTransformResolver =>
  (before, after) => {
    if (!isPlainObject(before) || !isPlainObject(after)) {
      return [before, after]
    }
    const values = { before: { ...before }, after: { ...after } }

    valuesTransformation(values, (value, other) => {
      for (const prop of fields) {
        if (prop in other && typeof other[prop] === "object" && other[prop] !== null && !(prop in value)) {
          value[prop] = Array.isArray(other[prop]) ? [] : {}
        }
      }
      return value
    })

    return [values.before, values.after]
  }

type SchemaValue = Record<string, unknown>

// the normalization steps of `transformJsonSchema`, applied in this order, each to the before value (facing the after
// value) and then to the after value (facing the transformed before value), as `valuesTransformation` does; module
// functions instead of closures created on every call (ISSUE-330)

const MISSING_CONTAINERS = ["required", "properties", "patternProperties", "definitions", "examples"]

// create missing properties: required, properties, items, definitions; a missing `enum` is not created (a schema that
// becomes an enum is one keyword change, ISSUE-87 (fixed)), a `const` facing an `enum` becomes one below
const createMissingContainers = (value: SchemaValue, other: SchemaValue): SchemaValue => {
  for (let i = 0; i < MISSING_CONTAINERS.length; i++) {
    const prop = MISSING_CONTAINERS[i]
    if (prop in other && typeof other[prop] === "object" && other[prop] !== null && !(prop in value)) {
      value[prop] = Array.isArray(other[prop]) ? [] : {}
    }
  }
  return value
}

// transform const into enum
const constToEnum = (value: SchemaValue, other: SchemaValue): SchemaValue => {
  if ("const" in value && "enum" in other) {
    const { const: v, ...rest } = value
    return { ...rest, enum: [v] }
  }
  return value
}

// remove not unique items from enum (own-key reads: schema objects come in many shapes, ISSUE-330)
const uniqueEnum = (value: SchemaValue): SchemaValue => {
  const enumValues = ownValue(value, "enum")
  if (Array.isArray(enumValues)) {
    value.enum = enumValues.filter((v, i, arr) => arr.indexOf(v) === i)
  }
  return value
}

// remove not unique items from required
const uniqueRequired = (value: SchemaValue): SchemaValue => {
  if ("required" in value && Array.isArray(value.required)) {
    const required = value.required.filter((v, i, arr) => isString(v) && arr.indexOf(v) === i)
    return { ...value, required }
  }
  return value
}

// transform items
const tupleItems = (value: SchemaValue, other: SchemaValue): SchemaValue => {
  if ("items" in other && isArray(other.items)) {
    if ("items" in value && typeof value.items === "object") {
      return isArray(value.items)
        ? value
        : { ...value, items: other.items.map(() => value.items), additionalItems: value.items }
    }
    return { ...value, items: [] }
  }
  return value
}

// the type is not inferred from the validators on the other side: a schema without `type` admits every type, so
// adding or removing `type` is a change (POLICY-21 decided (b), ISSUE-136)

// `type: "string"` and `type: ["string"]` are the same schema: compare as arrays when either side is one
const typeList = (value: SchemaValue, other: SchemaValue): SchemaValue => {
  const type = ownValue(value, "type")
  if (isString(type) && Array.isArray(ownValue(other, "type"))) {
    return { ...value, type: [type] }
  }
  return value
}

const BOOLEAN_BOUNDS = ["exclusiveMinimum", "minimum", "exclusiveMaximum", "maximum"]

// the draft-04 / OpenAPI 3.0 boolean form without its bound has no effect (and is not valid in later drafts)
const unboundFlags = (value: SchemaValue): SchemaValue => {
  for (let i = 0; i < BOOLEAN_BOUNDS.length; i += 2) {
    const flag = BOOLEAN_BOUNDS[i]
    if (typeof ownValue(value, flag) === "boolean" && !(BOOLEAN_BOUNDS[i + 1] in value)) {
      delete value[flag]
    }
  }
  return value
}

// 1. convert exclusiveMinimum from boolean to number
// 2. remove minimum if exclusiveMinimum exists
const booleanExclusiveMinimum = (value: SchemaValue): SchemaValue => {
  if ("exclusiveMinimum" in value && typeof value.exclusiveMinimum === "boolean" && "minimum" in value) {
    const { minimum, exclusiveMinimum, ...rest } = value
    return exclusiveMinimum ? { ...rest, exclusiveMinimum: minimum } : { ...rest, minimum }
  }
  return value
}

// 1. convert exclusiveMaximum from boolean to number
// 2. remove maximum if exclusiveMaximum exists
const booleanExclusiveMaximum = (value: SchemaValue): SchemaValue => {
  if ("exclusiveMaximum" in value && typeof value.exclusiveMaximum === "boolean" && "maximum" in value) {
    const { maximum, exclusiveMaximum, ...rest } = value
    return exclusiveMaximum ? { ...rest, exclusiveMaximum: maximum } : { ...rest, maximum }
  }
  return value
}

// convert example to array of examples
const exampleToExamples = (value: SchemaValue, other: SchemaValue): SchemaValue => {
  if ("example" in value && "examples" in other) {
    const { example, ...rest } = value
    const examples = "examples" in value && Array.isArray(value.examples) ? value.examples : []
    return { ...rest, examples: [...examples, example] }
  }
  return value
}

// `deprecated: false` means not deprecated, exactly like an absent keyword
const notDeprecated = (value: SchemaValue): SchemaValue => {
  if (ownValue(value, "deprecated") === false) {
    const { deprecated, ...rest } = value
    return rest
  }
  return value
}

const SCHEMA_STEPS: ((value: SchemaValue, other: SchemaValue) => SchemaValue)[] = [
  createMissingContainers,
  constToEnum,
  uniqueEnum,
  uniqueRequired,
  tupleItems,
  typeList,
  unboundFlags,
  booleanExclusiveMinimum,
  booleanExclusiveMaximum,
  exampleToExamples,
  notDeprecated,
]

export const transformJsonSchema =
  (version: JsonSchemaDraft = "2020-12"): CompareTransformResolver =>
  (before, after, ctx?: CompareContext) => {
    if (!isPlainObject(before) || !isPlainObject(after)) {
      return [before, after]
    }
    // keywords with their default value are the schema without them (ISSUE-70); a 2020-12 comparison reads the
    // draft-07 tuple form as `prefixItems` (POLICY-28 decided (b): both sides in the later draft, ISSUE-138)
    const bValue = laterDraftItems(before, version, ctx?.before.root, ctx?.after.root)
    const aValue = laterDraftItems(after, version, ctx?.after.root, ctx?.before.root)
    let b: SchemaValue = { ...withoutDefaultValues(bValue, aValue) }
    let a: SchemaValue = { ...withoutDefaultValues(aValue, bValue) }
    for (let i = 0; i < SCHEMA_STEPS.length; i++) {
      const step = SCHEMA_STEPS[i]
      b = step(b, a)
      a = step(a, b)
    }
    return [b, a]
  }

const earlyDraft = (root: unknown) => isPlainObject(root) && isString(root.$schema) && /draft-0[467]/.test(root.$schema)

// the draft-07 tuple form (`items: [..]`, `additionalItems`) of a document that declares an earlier draft, compared
// with a 2020-12 document, in 2020-12 terms (`prefixItems`, `items`)
const laterDraftItems = (
  value: Record<string, unknown>,
  version: JsonSchemaDraft,
  root: unknown,
  otherRoot: unknown,
): Record<string, unknown> => {
  if (version !== "2020-12" || !isArray(value.items) || "prefixItems" in value) {
    return value
  }
  if (!earlyDraft(root) || earlyDraft(otherRoot)) {
    return value
  }
  const { items, additionalItems, ...rest } = value
  return additionalItems === undefined
    ? { ...rest, prefixItems: items }
    : { ...rest, prefixItems: items, items: additionalItems }
}

export const mergeRulesForDraft = (version: JsonSchemaDraft): MergeRules => {
  switch (version) {
    case "draft-04":
      return jsonSchemaMergeRules("draft-04")
    case "2020-12":
      return jsonSchemaMergeRules("2020-12")
    default:
      return jsonSchemaMergeRules("draft-06")
  }
}

const MERGER_CACHE_KEY = "allof-mergers"

// only a node that carries an allOf needs the merger; nested allOf nodes are merged when the walk reaches them
const hasAllOf = (value: unknown): value is Record<string, unknown> => isPlainObject(value) && "allOf" in value

/**
 * One allOf merger per document (and per rule set) for the lifetime of the session: the merger resolves `$ref`
 * items against the document root and memoizes merged conjunctions, so merging every schema node costs about one
 * merge of the whole document.
 */
export const getSessionMerger = (
  session: CompareSession,
  root: unknown,
  rules: MergeRules,
  options: Pick<MergeOptions, "mergeRefSibling" | "mergeCombinarySibling"> = {},
): Merger => {
  let mergers = session.caches.get(MERGER_CACHE_KEY) as WeakMap<object, Map<string, Merger>> | undefined
  if (!mergers) {
    mergers = new WeakMap()
    session.caches.set(MERGER_CACHE_KEY, mergers)
  }
  const key = typeof root === "object" && root !== null ? root : rules
  let byRules = mergers.get(key)
  if (!byRules) {
    byRules = new Map()
    mergers.set(key, byRules)
  }
  const { mergeRefSibling = true, mergeCombinarySibling = true } = options
  const mergerKey = `${ruleSetId(rules)}|${mergeRefSibling}|${mergeCombinarySibling}`
  let merger = byRules.get(mergerKey)
  if (!merger) {
    merger = createMerger({ source: root, rules, mergeCombinarySibling, mergeRefSibling })
    byRules.set(mergerKey, merger)
  }
  return merger
}

// identity of a rule set object for cache keys
const ruleSetIds = new WeakMap<object, number>()
let nextRuleSetId = 1
const ruleSetId = (rules: MergeRules): number => {
  let id = ruleSetIds.get(rules)
  if (!id) {
    id = nextRuleSetId++
    ruleSetIds.set(rules, id)
  }
  return id
}

// keywords next to a combinator in the merged result stay next to it: the normalization that runs after the merge
// lifts them into the branches by the allowed-sibling list of the rule set, as for a written schema (ISSUE-149)
const siblingOptions = { mergeCombinarySibling: false }

// a merged conjunction no value satisfies is the boolean schema `false` (POLICY-40: a response becoming unsatisfiable)
const unsatisfiableAsFalse = (value: unknown) => (isUnsatisfiable(value) ? false : value)

/**
 * Merges `allOf` on both sides with the session's per-document mergers (contradictions become `false`). Where a side
 * was merged, the `normalize` transforms run again on the merged pair, so the keywords the merge introduced (a
 * `required` of a new branch) are normalized like written ones (ISSUE-91).
 */
export const jsonSchemaMergeAllOf =
  (
    version: JsonSchemaDraft,
    rules: MergeRules = mergeRulesForDraft(version),
    normalize: CompareTransformResolver[] = [],
  ): CompareTransformResolver =>
  (before, after, ctx?: CompareContext) => {
    if (!ctx) {
      const merger = createMerger({ rules, mergeCombinarySibling: true, mergeRefSibling: true })
      return [merger.merge(before), merger.merge(after)]
    }
    const bMerge = hasAllOf(before)
    const aMerge = hasAllOf(after)
    if (!bMerge && !aMerge) {
      return [before, after]
    }
    let _before = bMerge
      ? unsatisfiableAsFalse(
          getSessionMerger(ctx.session, ctx.before.root, rules, siblingOptions).merge(before, {
            source: ctx.before.root,
          }),
        )
      : before
    let _after = aMerge
      ? unsatisfiableAsFalse(
          getSessionMerger(ctx.session, ctx.after.root, rules, siblingOptions).merge(after, { source: ctx.after.root }),
        )
      : after
    // a `$ref` on the other side is compared by its resolved content (normalized then)
    if (isRefNode(_before) || isRefNode(_after)) {
      return [_before, _after]
    }
    for (const transform of normalize) {
      ;[_before, _after] = transform(_before, _after, ctx)
    }
    return [_before, _after]
  }
