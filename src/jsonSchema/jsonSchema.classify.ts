import {
  transformClassifyRule,
  getParentContext,
  breaking,
  risky,
  nonBreaking,
  unclassified,
  annotation,
  deepEqual,
  isInvertedScope,
} from "../core"
import { isExist, isString, isNumber, getArrayValue, getKeyValue, isObject, isArray } from "../utils"
import { ownValue } from "../own"
import type { ClassifyRule, ClassifyTuple, DiffType, DiffTypeClassifier, CompareContext, NodeContext } from "../types"
import { isValidSchemaTypes } from "./jsonSchema.utils"
import {
  type BoundKind,
  boundKeywords,
  compareBounds,
  disjointByType,
  effectiveBound,
  effectiveMaxCount,
  isSubschema,
  schemaRelation,
} from "./jsonSchema.semantics"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue: DiffTypeClassifier = ({ after }): DiffType => breakingIf(!!after.value)

/** Marks a classifier as applying to every scope without inversion (object form with only a default). */
export const nonDirectional = (tuple: ClassifyTuple): ClassifyRule => ({ default: tuple })

export const typeClassifier = (types: string[] | string, base: ClassifyRule): ClassifyRule => {
  const _types = Array.isArray(types) ? types : [types]
  if (_types.includes("number")) {
    _types.push("integer")
  }

  // a validator of another type than the schema declares has no effect: an annotation (POLICY-10 decided (a),
  // ISSUE-133)
  return transformClassifyRule(base, (diffType, { before, after }, action) => {
    return isValidSchemaTypes(_types, action === "remove" ? before.parent : after.parent) ? diffType : annotation
  })
}

export const maxClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(!isNumber(before.value) || !isNumber(after.value) || before.value > after.value),
]

/**
 * `maxItems` / `maxProperties` by the effective count of the schema before (ISSUE-153): a bound added where `items:
 * false` (after the tuple) or `additionalProperties: false` (without declared properties) already allowed no more
 * values rejects nothing that was valid.
 */
const countMaxRule = (type: "array" | "object"): ClassifyRule => {
  const looser = ({ before, after }: CompareContext) =>
    isNumber(after.value) && effectiveMaxCount(before.parent, type) <= after.value
  const tighter = ({ before, after }: CompareContext) =>
    !isNumber(before.value) || !isNumber(after.value) || before.value > after.value
  return [
    (ctx) => (looser(ctx) ? nonBreaking : breaking),
    nonBreaking,
    (ctx) => (looser(ctx) ? nonBreaking : breakingIf(tighter(ctx))),
    nonBreaking,
    breaking,
    (ctx) => breakingIf(!tighter(ctx)),
  ]
}

const countMaxRules = { array: countMaxRule("array"), object: countMaxRule("object") }

/**
 * `maxItems` / `maxProperties` by the effective count of the schema before (ISSUE-153): a bound added where `items:
 * false` (after the tuple) or `additionalProperties: false` (without declared properties) already allowed no more
 * values rejects nothing that was valid in a request; in a response the keyword reads as before.
 */
export const countMaxClassifier = (type: "array" | "object"): ClassifyRule => countMaxRules[type]

export const minClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(!isNumber(before.value) || !isNumber(after.value) || before.value < after.value),
]

const bothNumbers = (before: unknown, after: unknown): boolean => isNumber(before) && isNumber(after)

// inside a `not` subtree the opposite scope expresses negation, not the other direction: a loosened negated
// constraint is a tightened schema, so the risky reading of the opposite direction does not apply there
const negated = ({ before, after }: CompareContext) => {
  let count = 0
  for (let node = before.up ?? after.up; node; node = node.up) {
    if (node.key === "not" && node.up?.key !== "properties" && node.up?.key !== "patternProperties") {
      count++
    }
  }
  return count % 2 === 1
}

/** `risky` in the direction where a change is risky (POLICY-03 / POLICY-05), `breaking` inside a negation. */
export const riskyClassifier =
  (unlessRisky?: (ctx: CompareContext) => DiffType | undefined): DiffTypeClassifier =>
  (ctx) =>
    unlessRisky?.(ctx) ?? (negated(ctx) ? breaking : risky)

/**
 * Numeric upper bound (`maximum`, 2020-12 `exclusiveMaximum`): in a response a raised or removed bound is risky
 * (POLICY-05: a client that validates or sizes by the old range can fail), a lowered or added one is a guarantee.
 */
export const numberMaxClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) =>
    breakingIf(!bothNumbers(before.value, after.value) || (before.value as number) > (after.value as number)),
  nonBreaking,
  riskyClassifier(),
  riskyClassifier(({ before, after }) =>
    !bothNumbers(before.value, after.value) || (before.value as number) > (after.value as number)
      ? nonBreaking
      : undefined,
  ),
]

/** Numeric lower bound (`minimum`, 2020-12 `exclusiveMinimum`): see `numberMaxClassifier`. */
export const numberMinClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) =>
    breakingIf(!bothNumbers(before.value, after.value) || (before.value as number) < (after.value as number)),
  nonBreaking,
  riskyClassifier(),
  riskyClassifier(({ before, after }) =>
    !bothNumbers(before.value, after.value) || (before.value as number) < (after.value as number)
      ? nonBreaking
      : undefined,
  ),
]

export const exclusiveClassifier: ClassifyRule = [breakingIfAfterTrue, nonBreaking, breakingIfAfterTrue]

// the keywords of the bound kind that changed and hold a value on the after side: they carry the new bound
const boundCarriers = (kind: BoundKind, before: unknown, after: unknown): boolean => {
  for (const key of boundKeywords(kind)) {
    const value = getKeyValue(after, key)
    if (isNumber(value) && value !== getKeyValue(before, key)) {
      return true
    }
  }
  return false
}

const classifyBound =
  (kind: BoundKind, response: boolean): DiffTypeClassifier =>
  (ctx) => {
    const { before, after } = ctx
    const bSchema = before.parent
    const aSchema = after.parent
    const relation = compareBounds(kind, effectiveBound(aSchema, kind), effectiveBound(bSchema, kind))
    if (relation === 0) {
      // the same effective bound written differently (inclusive <-> exclusive at an integer, a redundant bound, …)
      return annotation
    }
    // a keyword removed while another keyword of the same bound carries the new value: the change is that keyword's
    if (after.value === undefined && boundCarriers(kind, bSchema, aSchema)) {
      return nonBreaking
    }
    // tighter: narrows a request, a guarantee for a response; looser: widens a request, risky for a response (POLICY-05)
    if (relation > 0) {
      return response ? nonBreaking : breaking
    }
    return response ? riskyClassifier()(ctx) : nonBreaking
  }

/**
 * Numeric bounds (`minimum`, `exclusiveMinimum`, `maximum`, `exclusiveMaximum`) by the effective bound of the schema on
 * each side rather than per keyword (ISSUE-88): inclusive <-> exclusive at the same threshold, the draft-04 boolean
 * form, a bound redundant next to a tighter one and integer rounding are compared as the bounds they make.
 */
export const boundClassifyRule = (kind: BoundKind): ClassifyRule => {
  const request = classifyBound(kind, false)
  const response = classifyBound(kind, true)
  return [request, request, request, response, response, response]
}

const isMultiple = (value: number, of: number) => {
  const ratio = value / of
  return Math.abs(ratio - Math.round(ratio)) < 1e-9
}

export const booleanClassifier: ClassifyRule = [breakingIfAfterTrue, nonBreaking, breakingIfAfterTrue]

/**
 * `multipleOf` by divisibility (ISSUE-95): the new step widens the values when the old step is a multiple of it
 * (2 -> 1, 0.1 -> 0.01), narrows them when it is a multiple of the old one (1 -> 2), and is unrelated otherwise (2 -> 3).
 */
export const multipleOfClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) =>
    breakingIf(!isNumber(before.value) || !isNumber(after.value) || !isMultiple(before.value, after.value)),
  nonBreaking,
  breaking,
  ({ before, after }) =>
    breakingIf(!isNumber(before.value) || !isNumber(after.value) || !isMultiple(after.value, before.value)),
]

// formats whose values are a subset of another format's (oasdiff `isFormatContained`)
const formatGeneralizations: Record<string, string[]> = {
  int32: ["int64"],
  float: ["double"],
}

const generalizes = (before: unknown, after: unknown, key: unknown): boolean => {
  if (!isString(before) || !isString(after)) {
    return false
  }
  if (key === "pattern") {
    // a pattern that matches every string generalizes any other
    return /^\^?\.\*\$?$/.test(after)
  }
  return !!formatGeneralizations[before]?.includes(after)
}

/**
 * `format` / `pattern`: a changed value breaks both directions, except a provable generalization (int32 -> int64,
 * float -> double, any pattern -> `.*`), which is non-breaking in a request (POLICY-41 decided (b): set inclusion).
 */
export const constraintGeneralizationClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => (generalizes(before.value, after.value, before.key) ? nonBreaking : breaking),
  nonBreaking,
  breaking,
  breaking,
]

const hasDefault = (ctx: CompareContext["after"]) =>
  isString(ctx.value) && isExist(getParentContext(ctx, "", "properties", ctx.value, "default")?.value)

// the property a `required` item names still exists on the after side (required -> optional, not removed), or was a
// forbidden (`false`) declaration whose removal is not a removed value
const keepsProperty = ({ before, after }: CompareContext) =>
  isString(before.value) &&
  (isExist(getParentContext(after, "", "properties", before.value)?.value) ||
    getParentContext(before, "", "properties", before.value)?.value === false)

export const requiredItemClassifyRule: ClassifyRule = [
  ({ after }) => (!isString(after.value) || hasDefault(after) ? nonBreaking : breaking),
  nonBreaking,
  ({ after }) => (!isString(after.value) || hasDefault(after) ? nonBreaking : breaking),
  // response: a new required property is always delivered; a property that is no longer required may be missing
  // (POLICY-05: risky), a removed required property is reported by the property itself as breaking
  nonBreaking,
  riskyClassifier((ctx) => (keepsProperty(ctx) ? undefined : breaking)),
  riskyClassifier((ctx) => (keepsProperty(ctx) ? undefined : breaking)),
]

const isRequired = (node: CompareContext["before"]) =>
  !!getArrayValue(getParentContext(node, "", "required")?.value)?.includes(node.key)

// the schema that owns a `properties` entry still validates objects on that side (no `type`, or `object` among its types)
const ownerIsObjectSchema = (node: CompareContext["after"]) => {
  const type = getKeyValue(node.up?.up?.value, "type")
  return type === undefined || type === "object" || (isArray(type) && type.includes("object"))
}

// the schema that governed (or governs) the key of a property on the other side: `additionalProperties` when it is an
// explicit schema or `false` (POLICY-42 decided (a)); `undefined` when the key was (is) unconstrained
const governingSchema = (node: NodeContext): unknown => {
  const additional = getKeyValue(node.up?.up?.value, "additionalProperties")
  return additional === false || (isObject(additional) && !isArray(additional) && Object.keys(additional).length)
    ? additional
    : undefined
}

// a property declared (or dropped) where `additionalProperties` governed (governs) the key: classified by how the
// declaration relates to the governing schema (equivalent: no change of the valid values)
const againstGoverning = (
  _ctx: CompareContext,
  declared: unknown,
  governing: unknown,
  added: boolean,
  response: boolean,
): DiffType | undefined => {
  if (governing === undefined) {
    return
  }
  const relation = schemaRelation(declared, governing)
  if (relation === "equivalent") {
    return annotation
  }
  // a dropped declaration otherwise keeps the reading of a removed property (POLICY-03 / POLICY-48)
  if (!added) {
    return
  }
  if (relation === "wider") {
    return response ? breaking : nonBreaking
  }
  if (relation === "narrower") {
    return response ? nonBreaking : breaking
  }
  return breaking
}

export const propertyClassifyRule: ClassifyRule = [
  (ctx) => {
    const { after } = ctx
    const governed = againstGoverning(ctx, after.value, governingSchema(ctx.before), true, false)
    if (governed) {
      return governed
    }
    // a property declared `false` forbids a key every value was allowed under
    if (after.value === false) {
      return breaking
    }
    return !isExist(getKeyValue(after.value, "default")) && isRequired(after) ? breaking : nonBreaking
  },
  // request: clients still sending the property may have it silently dropped (POLICY-03: risky); a forbidden (`false`)
  // property could not be sent, and when the schema no longer validates objects the `type` change carries the class
  (ctx) =>
    againstGoverning(ctx, ctx.before.value, governingSchema(ctx.after), false, false) ??
    riskyClassifier(({ before, after }) =>
      before.value !== false && ownerIsObjectSchema(after) ? undefined : nonBreaking,
    )(ctx),
  unclassified,
  (ctx) => againstGoverning(ctx, ctx.after.value, governingSchema(ctx.before), true, true) ?? nonBreaking,
  (ctx) =>
    againstGoverning(ctx, ctx.before.value, governingSchema(ctx.after), false, true) ??
    (isRequired(ctx.before) ? breaking : nonBreaking),
  unclassified,
]

// `integer` values are valid `number` values: widening the type is harmless for a request, narrowing is not
const isWidening = (before: unknown, after: unknown) => before === "integer" && after === "number"
const isNarrowing = (before: unknown, after: unknown) => before === "number" && after === "integer"

/**
 * `type` keyword: adding a type restricts (breaking in a request), removing it loosens, replacing it is breaking in
 * both directions except for the integer/number lattice (widening is harmless for a request, narrowing for a response).
 */
export const typeChangeClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => (isWidening(before.value, after.value) ? nonBreaking : breaking),
  nonBreaking,
  breaking,
  ({ before, after }) => (isNarrowing(before.value, after.value) ? nonBreaking : breaking),
]

// `integer` added to or removed from a type list that keeps `number` on that side admits the same values (ISSUE-154)
const integerUnderNumber = ({ before, after }: CompareContext) => {
  const item = before.value ?? after.value
  return (
    item === "integer" &&
    isArray(before.parent) &&
    isArray(after.parent) &&
    (before.parent.includes("number") || after.parent.includes("number"))
  )
}

const typeItem =
  (type: DiffType): DiffTypeClassifier =>
  (ctx) =>
    integerUnderNumber(ctx) ? annotation : type

// items of a `type` array: adding a type widens the accepted values, removing narrows them
export const typeItemClassifyRule: ClassifyRule = [
  typeItem(nonBreaking),
  typeItem(breaking),
  breaking,
  typeItem(breaking),
  typeItem(nonBreaking),
  breaking,
]

// a changed constraint value (format, pattern, const) breaks both producers and consumers
export const constraintValueClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking,
  breaking,
  nonBreaking,
  breaking,
  breaking,
]

// the schema has no `enum` (nor `const`) on that side: the normalization created an empty `enum` for the comparison
// (an empty `enum` in a document would accept no value at all), i.e. the schema accepts any value of its type
const enumAbsent = (side: CompareContext["before"]) => isArray(side.up?.value) && side.up.value.length === 0

/**
 * Enum members: a new value widens the request domain; in a response a new (or replaced) value can surprise a client
 * with an exhaustive switch (POLICY-05: risky), and so does dropping the whole `enum` (any value can now arrive),
 * while introducing an `enum` only narrows what the client receives.
 */
// the JSON type of a value (`integer` and `number` alike)
const jsonType = (value: unknown) => (value === null ? "null" : isArray(value) ? "array" : typeof value)

export const enumItemClassifyRule: ClassifyRule = [
  nonBreaking,
  breaking,
  breaking,
  riskyClassifier(({ before }) => (enumAbsent(before) ? nonBreaking : undefined)),
  riskyClassifier(({ after }) => (enumAbsent(after) ? undefined : nonBreaking)),
  // a value replaced by one of another JSON type (1 -> "1") breaks a client typed for the old value
  riskyClassifier(({ before, after }) => (jsonType(before.value) !== jsonType(after.value) ? breaking : undefined)),
]

// the schema validates arrays on that side (no `type`, or `array` among its types)
const validatesArrays = (schema: unknown) => {
  const type = getKeyValue(schema, "type")
  return type === undefined || type === "array" || (isArray(type) && type.includes("array"))
}

/**
 * An `items` schema added to an array that was unconstrained narrows a request and is a guarantee for a response
 * (ISSUE-92 (fixed)); removing it is the reverse. When the before side did not validate arrays at all (the type became
 * an array), the added `items` keeps the former reading (non-breaking in a request, breaking in a response) next to
 * the `type` change that carries the class (form-style query parameters, GraphQL list wrapping).
 */
export const itemsSchemaClassifyRule: ClassifyRule = [
  ({ before }) => breakingIf(validatesArrays(before.parent)),
  nonBreaking,
  nonBreaking,
  ({ before }) => breakingIf(!validatesArrays(before.parent)),
  breaking,
  breaking,
]

/** The `enum` keyword added (the schema became an enum) or removed (it accepts any value of its type now). */
export const enumKeywordClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking,
  breaking,
  nonBreaking,
  riskyClassifier(),
  breaking,
]

// how permissive an `additionalProperties` / `additionalItems` value is: anything > a schema > nothing
const permissiveness = (value: unknown): number => {
  if (value === false) {
    return 0
  }
  if (value === true || value === undefined) {
    return 2
  }
  return isObject(value) && !isArray(value) && Object.keys(value).length === 0 ? 2 : 1
}

/** `additionalProperties` / `additionalItems`: becoming less permissive is breaking for a request. */
export const permissivenessClassifyRule: ClassifyRule = [
  ({ after }) => breakingIf(permissiveness(after.value) < 2),
  nonBreaking,
  ({ before, after }) => breakingIf(permissiveness(after.value) < permissiveness(before.value)),
]

// the branch is contained in another branch of the after side: adding or removing it changes no valid value of an
// anyOf, and in a oneOf only values that matched two branches (rejected before) are concerned
const containedInOtherBranch = (branch: unknown, branches: unknown, self?: unknown): boolean =>
  isArray(branches) && branches.some((other, i) => i !== self && isSubschema(branch, other))

/**
 * An `anyOf` / `oneOf` branch added or removed (ISSUE-153): removing a branch contained in a remaining one rejects no
 * value in a request, adding one contained in another branch delivers no new value in a response.
 */
export const branchClassifyRule: ClassifyRule = [
  nonBreaking,
  ({ before, after }) => (containedInOtherBranch(before.value, after.parent) ? nonBreaking : breaking),
  breaking,
  ({ after }) => (containedInOtherBranch(after.value, after.parent, after.key) ? nonBreaking : breaking),
  nonBreaking,
  breaking,
]

/** `oneOf` <-> `anyOf`: `anyOf` accepts everything `oneOf` accepts, the other direction may reject overlaps. */
export const combinerKeyClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => {
    // over branches no value can match twice, oneOf and anyOf accept the same values (POLICY-44 decided (b))
    if (disjointByType(before.value) && disjointByType(after.value)) {
      return annotation
    }
    if (before.key === "oneOf" && after.key === "anyOf") {
      return nonBreaking
    }
    if (before.key === "anyOf" && after.key === "oneOf") {
      return breaking
    }
    return breaking
  },
]

// the schema of a message body (a media type `schema`, an AsyncAPI `payload` or the `schema` of a multi-format
// payload, a JSON Schema document root), not a subschema, a parameter or a header schema
const isBodyRoot = (node: NodeContext): boolean =>
  !node.path.length ||
  node.key === "payload" ||
  node.key === "#" ||
  (node.key === "schema" && (node.up?.up?.key === "content" || node.up?.key === "payload"))

/**
 * A boolean schema (`true`/`false`) replacing or replaced by an object schema. In a response, a body that becomes
 * unsatisfiable (`false`, a contradicting `allOf`) breaks the server's contract and leaving that state does not
 * (POLICY-40 decided (a)); a subschema or a header becoming `false` reads like a removed optional value.
 */
export const booleanSchemaClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => {
    if (after.value === false) {
      return breaking
    }
    if (after.value === true) {
      return nonBreaking
    }
    return before.value === true ? breaking : nonBreaking
  },
  nonBreaking,
  breaking,
  ({ before, after }) => {
    if (after.value === false) {
      return isBodyRoot(after) ? breaking : nonBreaking
    }
    if (after.value === true) {
      return breaking
    }
    // a response header schema leaving `false` reads like a subschema: breaking (POLICY-65 decided (b), OAS-HDR-021,
    // JS-TYP-056)
    return before.value === true || isBodyRoot(before) ? nonBreaking : breaking
  },
]

// the `items` schema of a tuple's schema constrains the positions after it (true / {} constrains nothing)
const itemsGovern = (schema: unknown): boolean => {
  const items = getKeyValue(schema, "items")
  return items === false || (isObject(items) && !isArray(items) && Object.keys(items).length > 0)
}

/**
 * `prefixItems` as a whole (ISSUE-90): a tuple added narrows a request; where `items` governed the positions, the
 * tuple replaces it there (breaking in both directions); removing a tuple without `items` widens the positions.
 */
export const prefixItemsKeywordRule: ClassifyRule = [
  breaking,
  ({ after }) => breakingIf(itemsGovern(after.parent)),
  breaking,
  ({ after }) => breakingIf(itemsGovern(after.parent)),
  breaking,
  breaking,
]

/**
 * A `prefixItems` entry added or removed (ISSUE-96): the position is constrained by the entry or, without it, by
 * `items` (unconstrained without `items`): removing an entry widens a request unless `items` governs the position.
 */
export const tupleEntryClassifyRule: ClassifyRule = [
  breaking,
  ({ after }) => breakingIf(itemsGovern(after.up?.up?.value)),
  breaking,
  ({ before }) => breakingIf(itemsGovern(before.up?.up?.value)),
  breaking,
  breaking,
]

const hasConditionalBranch = (schema: unknown) =>
  isObject(schema) && !isArray(schema) && ("then" in schema || "else" in schema)

const conditional =
  (type: DiffType): DiffTypeClassifier =>
  ({ before, after }) =>
    hasConditionalBranch(before.parent) || hasConditionalBranch(after.parent) ? type : annotation

/**
 * `if`: without `then` / `else` on either side it has no effect (ISSUE-90). Otherwise adding it makes the branches
 * apply (narrowing, like `then` added), removing it makes them inert (widening), changing the condition moves values
 * between the branches (breaking in both directions).
 */
export const ifClassifyRule: ClassifyRule = [
  conditional(breaking),
  conditional(nonBreaking),
  conditional(breaking),
  conditional(nonBreaking),
  conditional(breaking),
  conditional(breaking),
]

/** `default` (POLICY-23 decided (c)): request add non-breaking, remove / replace breaking; response annotation. */
export const defaultClassifyRule: ClassifyRule = [nonBreaking, breaking, breaking, annotation, annotation, annotation]

/** `deprecated` and other status keywords: a change of the boolean flag only. */
export const statusClassifyRule: ClassifyRule = [annotation, annotation, annotation]

export const isEqualValue = deepEqual

// ---------------------------------------------------------------------------------------------------------------
// readOnly / writeOnly (ISSUE-72): a read-only property is not sent in requests, a write-only one is not returned in
// responses. In the direction that hides it, changes of the property (and inside it) cannot break a client.

// the flag that hides a property in the direction of the scope
const hidingFlag = (scope: string) => (isInvertedScope(scope) ? "writeOnly" : "readOnly")

const flagOf = (value: unknown, flag: string) => isObject(value) && !isArray(value) && ownValue(value, flag) === true

// on one side: true inside (or at) a hidden property, undefined when a property on the way is absent on that side
// and no hidden property is found above it, false otherwise
const hiddenOnSide = (node: NodeContext | undefined, flag: string): boolean | undefined => {
  let absent = false
  for (let n = node; n; n = n.up) {
    if (n.up?.key !== "properties") {
      continue
    }
    if (n.value === undefined) {
      absent = true
    } else if (flagOf(n.value, flag)) {
      return true
    }
  }
  return absent ? undefined : false
}

/** The node lies in a property hidden in the current direction on both sides (or on the only side it exists). */
export const hiddenInDirection = (ctx: CompareContext): boolean => {
  const flag = hidingFlag(ctx.scope)
  const before = hiddenOnSide(ctx.before, flag)
  if (before === false) {
    return false
  }
  const after = hiddenOnSide(ctx.after, flag)
  return after !== false && (before === true || after === true)
}

const exposedRules = new WeakMap<object, ClassifyRule>()

/**
 * Wraps a classifier so that a breaking or risky change inside a property hidden in the direction (readOnly in a
 * request, writeOnly in a response) reads non-breaking; memoized per rule object.
 */
export const exposedOnly = (rule: ClassifyRule): ClassifyRule => {
  let result = exposedRules.get(rule)
  if (!result) {
    result = transformClassifyRule(rule, (type, ctx) =>
      (type === breaking || type === risky) && hiddenInDirection(ctx) ? nonBreaking : type,
    )
    exposedRules.set(rule, result)
  }
  return result
}

// the object schema that lists a property (the flag node is a keyword of the property schema)
const propertyRequired = (flagNode: NodeContext): boolean => {
  const property = flagNode.up
  if (property?.up?.key !== "properties") {
    return false
  }
  const required = getKeyValue(property.up.up?.value, "required")
  return isArray(required) && required.includes(property.key)
}

/**
 * `readOnly`: request side, marking a property read-only stops clients from sending it (breaking); unmarking a
 * required one makes it required in requests in OpenAPI 3.0 (`required` applies to responses only while it is
 * read-only), not in 3.1 / JSON Schema. Response side: no change for readers.
 */
export const readOnlyClassifyRule = (draft04: boolean): ClassifyRule => {
  // the flag is gone on the after side: required in requests from now on in OpenAPI 3.0
  const unmarked = (after: NodeContext): DiffType => (draft04 && propertyRequired(after) ? breaking : nonBreaking)
  return [
    ({ after }) => (after.value === true ? breaking : nonBreaking),
    ({ before, after }) => (before.value === true ? unmarked(after) : nonBreaking),
    ({ after }) => (after.value === true ? breaking : unmarked(after)),
    nonBreaking,
    nonBreaking,
    nonBreaking,
  ]
}

/**
 * `writeOnly`: response side, a required property marked write-only is no longer returned (breaking), an optional
 * one is like a removed optional response property; request side: no change for writers.
 */
export const writeOnlyClassifyRule: ClassifyRule = [
  nonBreaking,
  nonBreaking,
  nonBreaking,
  ({ after }) => (after.value === true && propertyRequired(after) ? breaking : nonBreaking),
  nonBreaking,
  ({ after }) => (after.value === true && propertyRequired(after) ? breaking : nonBreaking),
]

// the property a `required` item names is hidden in the direction for `required` purposes: write-only properties
// are never returned; read-only ones are required in responses only in OpenAPI 3.0 (draft-04 rule set)
const requiredIgnored = (ctx: CompareContext, draft04: boolean): boolean => {
  const inverted = isInvertedScope(ctx.scope)
  if (!inverted && !draft04) {
    return false
  }
  const flag = inverted ? "writeOnly" : "readOnly"
  const named = (side: NodeContext) =>
    isString(side.value) ? getParentContext(side, "", "properties", side.value)?.value : undefined
  const before = ctx.before.value !== undefined ? named(ctx.before) : undefined
  const after = ctx.after.value !== undefined ? named(ctx.after) : undefined
  return (
    (before !== undefined || after !== undefined) &&
    (before === undefined || flagOf(before, flag)) &&
    (after === undefined || flagOf(after, flag))
  )
}

/** `required` items with the readOnly / writeOnly exceptions (ISSUE-72). */
export const requiredItemRule = (draft04: boolean): ClassifyRule =>
  transformClassifyRule(requiredItemClassifyRule, (type, ctx) =>
    type !== nonBreaking && type !== annotation && requiredIgnored(ctx, draft04) ? nonBreaking : type,
  )
