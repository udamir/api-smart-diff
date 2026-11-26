import type { AnnotateHook, AnnotateTemplate, ChangeAnnotationResolver, CompareContext, Diff } from "../types"
import type { JsonPath } from "json-crawl"
import {
  type DiffContainer,
  describeDiff,
  describePath,
  extensionChangeAnnotation,
  FREE_TEXT_LENGTH,
  formatValue,
  isFreeTextKey,
  annotationTemplate as t,
} from "../core"
import { getTarget, schemaPropertyPath, schemaRootOf } from "./jsonSchema.utils"
import { isNumber, isObject, isString } from "../utils"

export const jsonSchemaAnnotations = {
  add: "[Added] {{text}}",
  add_target: "[Added] {{text}} to `{{target}}`",
  add_value: "[Added] {{text}} {{value}}",
  add_target_value: "[Added] {{text}} {{value}} to `{{target}}`",
  remove: "[Removed] {{text}}",
  remove_target: "[Removed] {{text}} from `{{target}}`",
  remove_value: "[Removed] {{text}} {{value}}",
  remove_target_value: "[Removed] {{text}} {{value}} from `{{target}}`",
  replace: "[Replaced] {{text}}",
  replace_target: "[Replaced] {{text}} of `{{target}}`",
  replace_before_after: "[Replaced] {{text}} from {{before}} to {{after}}",
  replace_target_before_after: "[Replaced] {{text}} of `{{target}}` from {{before}} to {{after}}",
  rename: "[Renamed] {{text}}",
  rename_target: "[Renamed] {{text}} of `{{target}}`",
  // a change inside a conditional applicator (`if` / `then` / `else`, ISSUE-100): the applicator named after the target
  add_applicator: "[Added] {{text}} to {{applicator}}",
  add_applicator_value: "[Added] {{text}} {{value}} to {{applicator}}",
  add_target_applicator: "[Added] {{text}} to `{{target}}` in {{applicator}}",
  add_target_applicator_value: "[Added] {{text}} {{value}} to `{{target}}` in {{applicator}}",
  remove_applicator: "[Removed] {{text}} from {{applicator}}",
  remove_applicator_value: "[Removed] {{text}} {{value}} from {{applicator}}",
  remove_target_applicator: "[Removed] {{text}} from `{{target}}` in {{applicator}}",
  remove_target_applicator_value: "[Removed] {{text}} {{value}} from `{{target}}` in {{applicator}}",
  replace_applicator: "[Replaced] {{text}} of {{applicator}}",
  replace_applicator_before_after: "[Replaced] {{text}} of {{applicator}} from {{before}} to {{after}}",
  replace_target_applicator: "[Replaced] {{text}} of `{{target}}` in {{applicator}}",
  replace_target_applicator_before_after:
    "[Replaced] {{text}} of `{{target}}` in {{applicator}} from {{before}} to {{after}}",
  rename_target_applicator: "[Renamed] {{text}} of `{{target}}` in {{applicator}}",
  ifApplicator: "the `if` condition",
  thenApplicator: "the `then` schema",
  elseApplicator: "the `else` schema",
  definition: "definition `{{key}}`",
  keyword: "`{{key}}`",
  enumValue: "possible value",
  constValue: "constant value",
  status: "{{key}} status",
  validation: "{{key}} validator",
  // POLICY-119: an added or removed validator names its value after the text, a replaced one lists both at the end
  validation_value: "{{key}} validator with value {{value}}",
  annotation: "annotation ({{key}})",
  enum: "possible values",
  enumValues: "possible values {{values}}",
  format: "value format",
  default: "default value",
  const: "possible value",
  type: "type definition",
  typeItem: "`{{key}}` type",
  nullable: "possible nullable value",
  property: "property `{{key}}`",
  arrayItem: "array item with index `{{key}}`",
  patternProperty: "property with key pattern `{{key}}`",
  additionalProperties: "schema for additional properties",
  arrayItems: "schema for array items",
  additionalArrayItems: "schema for additional array items",
  oneOfItem: "oneOf schema",
  anyOfItem: "anyOf schema",
  allOfItem: "allOf schema",
  combiner: "combiner `{{before}}` to `{{after}}`",
  not: "negated schema",
  items: "schema for array items",
  additionalItems: "schema for additional array items",
  prefixItems: "tuple item schemas",
  propertyNames: "property names schema",
  contains: "schema for contained items",
  if: "conditional schema",
  dependentRequired: "dependent required properties",
  dependentSchemas: "dependent schemas",
  dependencies: "dependencies",
  schema: "schema",
  becameFalse: "{{subject}} with `false` (no value is valid)",
  becameTrue: "{{subject}} with `true` (any value is valid)",
  wasFalse: "{{subject}} `false` (no value was valid)",
  wasTrue: "{{subject}} `true` (any value was valid)",
  wasFalse_type: "{{subject}} `false` (no value was valid) with a schema of type {{type}}",
  wasTrue_type: "{{subject}} `true` (any value was valid) with a schema of type {{type}}",
  equivalentFalse: "{{subject}} with the equivalent `false` (no value is valid)",
  equivalentTrue: "{{subject}} with the equivalent `true` (any value is valid)",
  equivalentFromFalse: "{{subject}} `false` with an equivalent schema (no value is valid)",
  equivalentFromTrue: "{{subject}} `true` with an equivalent schema (any value is valid)",
  equivalentSchema: "{{subject}} with an equivalent schema (the same values are valid)",
  dependentKeys: "{{keyword}} of {{keys}}",
  unevaluatedProperties: "schema for unevaluated properties",
  unevaluatedItems: "schema for unevaluated items",
  contentSchema: "content schema",
  contentMediaType: "content media type",
  contentEncoding: "content encoding",
  deprecated: "deprecated status",
  readOnly: "readOnly status",
  writeOnly: "writeOnly status",
  extension: "extension `{{key}}`",
  extensionProperty: "property `{{property}}` of extension `{{key}}`",
  extensionValue: "value {{value}} of extension `{{key}}`",
} as const

/**
 * A path inside a schema (starting at its root) in schema terms: the keywords below the property path, then the
 * property path (`dependentRequired.card of \`name\``), as `getTarget` names properties.
 */
export const describeSchemaPath = (inside: JsonPath): string => {
  // `inside` starts at the schema root
  const { target, last } = schemaPropertyPath(inside, 0)
  const rest = describePath(inside.slice(last + 1))
  return target ? (rest ? `${rest} of \`${target}\`` : `\`${target}\``) : rest
}

/** The fallback container of a node inside a schema whose root is at `length` path segments (named by the caller). */
export const schemaContainer = (length: number): DiffContainer => ({
  name: "",
  length,
  describeInside: describeSchemaPath,
})

// map keywords whose next segment is a name, not a keyword
const NAMED_MAPS = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
  "dependencies",
])
// keywords whose value is a schema or a list of schemas (the path goes on inside a schema)
const SCHEMA_POSITIONS = new Set<unknown>([
  "additionalProperties",
  "items",
  "prefixItems",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "contains",
  "propertyNames",
  "additionalItems",
  "unevaluatedProperties",
  "unevaluatedItems",
  "contentSchema",
])
const CONDITIONAL = new Set(["if", "then", "else"])

/**
 * The innermost conditional applicator (`if` / `then` / `else`) a changed node lies inside (ISSUE-100), as a template
 * ("the `if` condition"); `undefined` when the node is not below one (a change of the applicator itself is named by
 * its keyword template). `root` is the index of the first segment inside the schema (`schemaRootOf`); without it the
 * whole path is scanned.
 */
export const schemaApplicator = (path: JsonPath, root?: number): AnnotateTemplate | undefined => {
  let applicator: string | undefined
  for (let i = root ?? 0; i < path.length - 1; i++) {
    const step = path[i]
    if (isString(step) && NAMED_MAPS.has(step)) {
      i++
      continue
    }
    if (isString(step) && CONDITIONAL.has(step) && isString(path[i + 1]) && SCHEMA_KEYWORDS.has(path[i + 1])) {
      applicator = step
    }
    // from a known schema root (ISSUE-300): a keyword whose value is not a schema ends the walk, the rest of the path
    // is inside its value
    if (root !== undefined && !isNumber(step) && !SCHEMA_POSITIONS.has(step)) {
      break
    }
  }
  return applicator ? t(`${applicator}Applicator`) : undefined
}

// keywords that follow a schema position (a conditional applicator is recognized by the keyword below it)
const SCHEMA_KEYWORDS = new Set<unknown>([
  "properties",
  "patternProperties",
  "additionalProperties",
  "required",
  "type",
  "enum",
  "const",
  "items",
  "prefixItems",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "format",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minProperties",
  "maxProperties",
  "multipleOf",
  "uniqueItems",
  "contains",
  "dependentRequired",
  "dependentSchemas",
  "propertyNames",
  "default",
  "description",
  "title",
  "deprecated",
  "readOnly",
  "writeOnly",
  "nullable",
  "$ref",
])

/** Adds the conditional applicator of the changed node to a resolver's template (ISSUE-100). */
const applicatorAware =
  (resolver: ChangeAnnotationResolver): ChangeAnnotationResolver =>
  (diff, ctx) => {
    const template = resolver(diff, ctx)
    const applicator = template ? schemaApplicator(diff.path, schemaRootOf(ctx)) : undefined
    return template && applicator ? { ...template, params: { ...template.params, applicator } } : template
  }

export const jsonSchemaAnnotationHook: AnnotateHook = (diff, ctx) =>
  describeDiff(diff, ctx, jsonSchemaAnnotations, undefined, () => schemaContainer(0))

export const schemaAnnotationChange: ChangeAnnotationResolver = applicatorAware((diff, ctx) => {
  const { action, path } = diff
  const key = path[path.length - 1]
  // a free-text keyword (`title`, `description`, `$comment`) lists its values shortened (POLICY-95)
  const values = isFreeTextKey(key) ? keywordValues(diff, ctx, false, FREE_TEXT_LENGTH) : {}
  return t(action, { text: t("annotation", { key }), target: getTarget(path, schemaRootOf(ctx)), ...values })
})

export const schemaExampleChange: ChangeAnnotationResolver = applicatorAware(({ action, path }, ctx) => {
  return t(action, { text: t("annotation", { key: "example" }), target: getTarget(path, schemaRootOf(ctx)) })
})

/**
 * A validator keyword change (`maxLength`, `minimum`, `pattern`, ...): named with its scalar values like other scalar
 * keywords (POLICY-119): "[Replaced] maxLength validator of `name` from `50` to `30`", "[Added] maxLength validator with
 * value `30` to `name`"; a validator whose value is not a scalar (`propertyNames`, a `dependentRequired` entry) is named
 * without values.
 */
export const schemaValidationChange: ChangeAnnotationResolver = applicatorAware((diff, ctx) => {
  const { action, path } = diff
  const key = path[path.length - 1]
  const { value, ...values } = keywordValues(diff, ctx) ?? {}
  return t(action, { text: t("validation", { key, value }), target: getTarget(path, schemaRootOf(ctx)), ...values })
})

export const schemaStatusChange: ChangeAnnotationResolver = applicatorAware(({ path }, ctx) => {
  const key = path[path.length - 1]

  if (ctx.after.value) {
    return t("add", { text: t("status", { key }), target: getTarget(path, schemaRootOf(ctx)) })
  }
  if (ctx.before.value) {
    return t("remove", { text: t("status", { key }), target: getTarget(path, schemaRootOf(ctx)) })
  }
})

const isScalarValue = (value: unknown) => value === null || (typeof value !== "object" && value !== undefined)

/**
 * The values of a keyword change, for the `_value` / `_before_after` template variants: the added or removed scalar
 * value, the scalar values before and after a replace (an object or array value is not listed). `maxLength` shortens
 * string values (free text, POLICY-95; `FREE_TEXT_LENGTH`).
 */
export const keywordValues = (
  diff: Pick<Diff, "action">,
  ctx: CompareContext,
  anyValue = false,
  maxLength?: number,
): AnnotateTemplate["params"] => {
  const listed = (value: unknown) => (anyValue ? value !== undefined : isScalarValue(value))
  const before = ctx.before.value
  const after = ctx.after.value
  if (diff.action === "replace") {
    return listed(before) && listed(after)
      ? { before: formatValue(before, maxLength), after: formatValue(after, maxLength) }
      : {}
  }
  const value = diff.action === "add" ? after : before
  return listed(value) ? { value: formatValue(value, maxLength) } : {}
}

// the dictionary entry naming a keyword, or the keyword itself in backticks
const keywordText = (key: string) => (key in jsonSchemaAnnotations ? t(key) : t("keyword", { key }))

export const jsonSchemaKeyChange: ChangeAnnotationResolver = applicatorAware((diff, ctx) => {
  const { action, path } = diff
  const key = path[path.length - 1]

  if (action === "rename") {
    return t("rename", {
      text: t("combiner", { before: String(diff.before), after: String(diff.after) }),
      target: getTarget(path, schemaRootOf(ctx)),
    })
  }

  if (isNumber(key)) {
    return
  }

  // ISSUE-57: `const` is named with its value
  const text = key === "const" ? t("constValue") : keywordText(key)
  return t(action, {
    target: getTarget(path, schemaRootOf(ctx)),
    text,
    ...keywordValues(diff, ctx, key === "const" || key === "default"),
  })
})

const MAX_LISTED_VALUES = 10

const listValues = (value: unknown): string | undefined => {
  if (!Array.isArray(value) || !value.length) {
    return
  }
  const listed = value.slice(0, MAX_LISTED_VALUES).map((v) => `\`${typeof v === "string" ? v : JSON.stringify(v)}\``)
  return value.length > MAX_LISTED_VALUES ? `${listed.join(", ")}, …` : listed.join(", ")
}

/** The `enum` keyword added or removed as a whole: the schema became / stopped being an enum (ISSUE-87). */
export const enumKeywordChange: ChangeAnnotationResolver = applicatorAware((diff, ctx) => {
  const { action, path } = diff
  if (action === "add" || action === "remove") {
    const values = listValues(action === "add" ? ctx.after.value : ctx.before.value)
    if (values) {
      return t(action, { text: t("enumValues", { values }), target: getTarget(path, schemaRootOf(ctx)) })
    }
  }
  return jsonSchemaKeyChange(diff, ctx)
})

export const schemaKeyItemChange: ChangeAnnotationResolver = applicatorAware(({ action, path }, ctx) => {
  const key = path[path.length - 1]
  const { value } = action === "add" ? ctx.after : ctx.before
  const parentKey = path.length > 1 ? path[path.length - 2] : ""
  const parentTarget = getTarget(path.slice(0, -1), schemaRootOf(ctx))
  const target = getTarget(path, schemaRootOf(ctx))

  switch (parentKey) {
    case "enum":
      // ISSUE-57: a value added to or removed from the enum is named with its action and value
      return t(action, { text: t("enumValue"), target, ...keywordValues({ action }, ctx, true) })
    case "type":
      return isString(value) ? t(action, { text: t("typeItem", { key: value }), target: parentTarget }) : undefined
    case "properties":
      return isString(key) ? t(action, { text: t("property", { key }), target: parentTarget }) : undefined
    case "items":
    case "prefixItems":
      return isNumber(key) ? t(action, { text: t("arrayItem", { key }), target: parentTarget }) : undefined
    case "patternProperties":
      return isString(key) ? t(action, { text: t("patternProperty", { key }), target: parentTarget }) : undefined
    case "oneOf":
    case "anyOf":
    case "allOf":
      return t(action, { text: t(`${parentKey}Item`), target })
    case "definitions":
    case "$defs":
      return isString(key) ? t(action, { text: t("definition", { key }), target: parentTarget }) : undefined
    case "required":
      return isString(value)
        ? t(action, { text: t("status", { key: parentKey }), target: target ? `${target}.${value}` : value })
        : undefined
  }
  return
})

/**
 * `dependentRequired` / `dependentSchemas` / `dependencies` added or removed as a whole: names the properties whose
 * presence the dependencies apply to (ISSUE-90).
 */
export const dependentKeywordChange: ChangeAnnotationResolver = applicatorAware((diff, ctx) => {
  const { action, path } = diff
  const key = path[path.length - 1]
  const value = action === "remove" ? ctx.before.value : ctx.after.value
  const keys = isObject(value) && !Array.isArray(value) ? Object.keys(value) : []
  if ((action !== "add" && action !== "remove") || !keys.length || !isString(key)) {
    return jsonSchemaKeyChange(diff, ctx)
  }
  return t(action, {
    text: t("dependentKeys", { keyword: t(key), keys: keys.map((k) => `\`${k}\``).join(", ") }),
    target: getTarget(path, schemaRootOf(ctx)),
  })
})

// what a schema node is, for the boolean schema descriptions: a property, a keyword's schema or the schema itself
const schemaSubject = (path: (string | number)[]) => {
  const key = path[path.length - 1]
  const parentKey = path.length > 1 ? path[path.length - 2] : undefined
  if ((parentKey === "properties" || parentKey === "patternProperties") && isString(key)) {
    return {
      subject: t(parentKey === "properties" ? "property" : "patternProperty", { key }),
      target: path.slice(0, -2),
    }
  }
  if (isString(key) && key in jsonSchemaAnnotations && key !== "schema") {
    return { subject: t(key), target: path }
  }
  return { subject: t("schema"), target: path }
}

/** A boolean schema (`true` / `false`) replacing or replaced by an object schema (ISSUE-89). */
export const booleanSchemaChange: ChangeAnnotationResolver = applicatorAware(({ path, type: diffType }, ctx) => {
  const { subject, target } = schemaSubject(path)
  const b = ctx.before.value
  const a = ctx.after.value
  const equivalent = diffType === "annotation"
  const text =
    a === false
      ? equivalent
        ? "equivalentFalse"
        : "becameFalse"
      : a === true
        ? equivalent
          ? "equivalentTrue"
          : "becameTrue"
        : b === false
          ? equivalent
            ? "equivalentFromFalse"
            : "wasFalse"
          : equivalent
            ? "equivalentFromTrue"
            : "wasTrue"
  const other = isObject(a) ? a.type : isObject(b) ? b.type : undefined
  const types = isString(other) ? [other] : Array.isArray(other) ? other.filter(isString) : []
  const typeList = types.length ? types.map((x) => `\`${x}\``).join(", ") : undefined
  return t("replace", { text: t(text, { subject, type: typeList }), target: getTarget(target, schemaRootOf(ctx)) })
})

/** A schema rewritten as another schema that accepts the same values (ISSUE-153). */
export const equivalentSchemaChange: ChangeAnnotationResolver = applicatorAware(({ path }, ctx) => {
  const { subject, target } = schemaSubject(path)
  return t("replace", { text: t("equivalentSchema", { subject }), target: getTarget(target, schemaRootOf(ctx)) })
})

/** A change of an `x-*` keyword (or inside its value), located by the property path of the schema node. */
export const schemaExtensionChange = extensionChangeAnnotation((diff, ctx, extension) =>
  getTarget(diff.path.slice(0, extension + 1), schemaRootOf(ctx)),
)
