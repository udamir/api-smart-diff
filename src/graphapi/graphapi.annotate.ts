import type { JsonPath } from "json-crawl"

import type {
  AnnotateHook,
  AnnotateTemplate,
  ChangeAnnotationResolver,
  CompareContext,
  Diff,
  NodeContext,
} from "../types"
import {
  type ContainerLocator,
  createAnnotation,
  createContainerLocator,
  describeDiff,
  withContainer,
  fallbackAnnotation,
  formatText,
  formatValue,
  annotationTemplate as t,
  ruleView,
} from "../core"
import { jsonSchemaAnnotations } from "../jsonSchema"
import { getKeyValue, getStringValue, isArray, isNumber, isObject, isString } from "../utils"

const graphApiAnnotations = {
  ...jsonSchemaAnnotations,

  interfaces: "implemented interfaces",
  locations: "directive locations",
  interface_item: "implemented interface `{{name}}`",
  interface_swap: "implemented interface `{{before}}` with `{{after}}`",
  interface_list: "implemented interfaces {{names}}",
  location_item: "location `{{name}}`",
  location_swap: "location `{{before}}` with `{{after}}`",
  root_type_name: "{{kind}} root type name `{{name}}`",
  root_type_rename: "{{kind}} root type name from `{{before}}` to `{{after}}`",
  union_member: "union member `{{name}}`",
  directive_usage: "directive `@{{name}}`",
  directive_usages: "directives {{names}}",
}

const kindWords: Record<string, string> = {
  objects: "object type",
  interfaces: "interface",
  unions: "union",
  inputObjects: "input type",
  enums: "enum",
  scalars: "scalar",
}

/**
 * Named containers of a GraphApi document (POLICY-08: the nearest named container): the root operation type of a
 * root field and the named type or directive of a component. Templates name the field, argument or value; the hook
 * appends the type when the text does not name it (`withContainer`).
 */
export const locateGraphApiContainer: ContainerLocator = createContainerLocator([
  { at: ["queries"], name: () => "type `Query`" },
  { at: ["mutations"], name: () => "type `Mutation`" },
  { at: ["subscriptions"], name: () => "type `Subscription`" },
  { at: ["components", "directives", "*"], name: ([name]) => `directive \`@${name}\`` },
  {
    at: ["components", (key) => String(key) in kindWords, "*"],
    name: ([kind, name]) => `${kindWords[String(kind)]} \`${name}\``,
  },
])

const describeGraphApiDiff: AnnotateHook = (diff, ctx) => {
  const annotate = ctx.rules ? ruleView(ctx.rules).annotate : undefined

  if (!annotate) {
    return fallbackAnnotation(diff, ctx, locateGraphApiContainer)
  }

  return describeDiff(diff, ctx, graphApiAnnotations, annotate, locateGraphApiContainer)
}

/**
 * GraphApi descriptions: a change of a GraphQL element (field, input field, argument, enum value, type, directive,
 * schema) is described in GraphQL terms by `describeGraphElementChange`; any other change by its rule's template (or the generated fallback) with the enclosing type or directive named.
 */
export const graphApiAnnotateHook: AnnotateHook = (diff, ctx) =>
  describeGraphElementChange(diff, ctx) ??
  withContainer(describeGraphApiDiff(diff, ctx) ?? "", locateGraphApiContainer(diff, ctx))

// `#/components/enums/Role` -> `Role`, `[#/components/objects/A]` -> `[A]`
const typeName = (type: string | undefined) => type?.replace(/#\/components\/[^/\]]+\//g, "") ?? "?"

const rootTypeNames: Record<string, string> = { query: "Query", mutation: "Mutation", subscription: "Subscription" }

/**
 * Interfaces implemented by a type (`components.<kind>.<name>[.type].interfaces`) or a root operation type
 * (`rootTypes.<kind>.interfaces`): names the implementing type and the interface.
 */
export const interfaceChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, action } = diff
  const index = path.lastIndexOf("interfaces")
  const kind = String(path[1])
  const owner =
    path[0] === "components"
      ? String(path[2])
      : path[0] === "rootTypes"
        ? String(getKeyValue(ctx.after.root, `${kind}TypeName`) ?? rootTypeNames[kind] ?? kind)
        : undefined
  const name = (value: unknown) => typeName(getStringValue(value, "$ref"))
  if (index !== path.length - 2) {
    const list = action === "add" ? diff.after : diff.before
    if (Array.isArray(list) && list.length === 1) {
      return t(action, { text: t("interface_item", { name: name(list[0]) }), target: owner })
    }
    const names = Array.isArray(list) ? list.map((item) => `\`${name(item)}\``).join(", ") : ""
    return t(action, { text: names ? t("interface_list", { names }) : t("interfaces"), target: owner })
  }
  if (action === "replace") {
    return t(action, {
      text: t("interface_swap", { before: name(diff.before), after: name(diff.after) }),
      target: owner,
    })
  }
  return t(action, {
    text: t("interface_item", { name: name(action === "add" ? diff.after : diff.before) }),
    target: owner,
  })
}

/** A location added to / removed from a directive definition (`components.directives.<name>.locations`). */
export const directiveLocationAnnotation: ChangeAnnotationResolver = (diff) => {
  const { path, action } = diff
  const target = `@${String(path[2])}`
  if (path[path.length - 1] === "locations") {
    return t(action, { text: t("locations"), target })
  }
  if (action === "replace") {
    return t(action, { text: t("location_swap", { before: diff.before, after: diff.after }), target })
  }
  return t(action, { text: t("location_item", { name: action === "add" ? diff.after : diff.before }), target })
}

/** `queryTypeName` / `mutationTypeName` / `subscriptionTypeName` (ISSUE-122). */
export const rootTypeNameAnnotation: ChangeAnnotationResolver = (diff) => {
  const { path, action } = diff
  const kind = String(path[path.length - 1]).replace(/TypeName$/, "")
  if (action === "replace") {
    return t(action, { text: t("root_type_rename", { kind, before: diff.before, after: diff.after }) })
  }
  return t(action, { text: t("root_type_name", { kind, name: action === "add" ? diff.after : diff.before }) })
}

/** A union member (`components.unions.<name>[.type].oneOf[i]`): names the union and the member type. */
export const unionMemberAnnotation: ChangeAnnotationResolver = (diff) => {
  const { path, action } = diff
  const union = String(path[2])
  if (!isNumber(path[path.length - 1])) {
    return
  }
  const member = typeName(getStringValue(action === "add" ? diff.after : diff.before, "$ref"))
  return t(action, { text: t("union_member", { name: member }), target: union })
}

// directive usages: `[{ $ref, meta }]`
const usageName = (usage: unknown) => (getStringValue(usage, "$ref") ?? "").replace(/^#\/components\/directives\//, "")

/**
 * A directive applied to a named type or an enum value (`@oneOf` on an input object, ISSUE-117; directives on enum
 * values, ISSUE-125): names the element and the directive.
 */
export const directiveUsageAnnotation: ChangeAnnotationResolver = (diff) => {
  const { path, action } = diff
  const index = path.lastIndexOf("directives")
  if (index < 0) {
    return
  }
  const skipped = ["values", "properties", "methods", "args"]
  const owner = path.slice(path[0] === "components" ? 2 : 1, index).filter((step) => !skipped.includes(String(step)))
  const target = owner.length ? owner.map(String).join(".") : undefined
  const value = action === "add" ? diff.after : diff.before
  if (index === path.length - 1) {
    const usages = Array.isArray(value) ? value : []
    const names = usages.map((usage) => `\`@${usageName(usage)}\``).join(", ")
    return names ? t(action, { text: t("directive_usages", { names }), target }) : undefined
  }
  if (index !== path.length - 2) {
    return
  }
  return t(action, { text: t("directive_usage", { name: usageName(value) }), target })
}

// ---------------------------------------------------------------------------------------------------------------
// GraphQL element descriptions (P8-rest, ISSUE-127 / 128 / 129 / 57, POLICY-90)

/**
 * Templates of the element descriptions: the changed item is named once with its kind ("argument `limit`", "field
 * `age`", "enum value `BLUE`") and the element it belongs to separately ("field `Query.search`", "input type
 * `SearchFilter`", "directive `@limit`", "the schema"); fields, input fields and enum values are qualified by their
 * type (`User.age`), arguments name their field or directive. Targets are complete phrases (no backticks added).
 */
export const graphElementAnnotations = {
  add: "[Added] {{text}}",
  add_target: "[Added] {{text}} to {{target}}",
  add_target_value: "[Added] {{text}} {{value}} to {{target}}",
  add_target_from_to: "[Added] {{text}} to {{target}} (type {{from}} changed to {{to}})",
  remove: "[Removed] {{text}}",
  remove_target: "[Removed] {{text}} from {{target}}",
  remove_target_value: "[Removed] {{text}} {{value}} from {{target}}",
  remove_target_from_to: "[Removed] {{text}} from {{target}} (type {{from}} changed to {{to}})",
  replace: "[Replaced] {{text}}",
  replace_target: "[Replaced] {{text}} of {{target}}",
  replace_target_before_after: "[Replaced] {{text}} of {{target}} from {{before}} to {{after}}",

  // elements and containers
  elField: "field `{{name}}`",
  elInputField: "input field `{{name}}`",
  elEnumValue: "enum value `{{name}}`",
  elEnumValueWord: "enum value",
  elArgument: "argument `{{name}}`",
  elArgumentOf: "argument `{{name}}` of {{owner}}",
  elArguments: "arguments {{names}}",
  elType: "{{kind}} `{{name}}`",
  elRootType: "type `{{name}}`",
  elDirective: "directive `@{{name}}`",
  elSchema: "the schema",
  elListItems: "list items of {{element}}",
  elInnerListItems: "inner list items of {{element}}",
  elUsageOn: "directive `@{{name}}` on {{element}}",

  // what changed
  elDescription: "description",
  elDeprecation: "deprecation",
  elDeprecation_reason: "deprecation with reason {{reason}}",
  elDeprecationReason: "deprecation reason",
  elDefault: "default value",
  elNullable: "nullable status",
  elNonNull: "non-null status",
  elTypeOf: "type",
  elNamedType: "named type {{name}}",
  elBuiltinType: "built-in type {{name}}",
  elListType: "list type",
  elListItemType: "list item type",
  elSpecifiedBy: "specifiedBy URL",
  elRepeatable: "repeatable status",
  elUsage: "directive {{name}}",
  elUsages: "directives {{names}}",
  elUsageArgument: "argument `{{name}}`",
  elUsageArgument_value: "argument `{{name}}: {{value}}`",
  elUsageArguments: "arguments `{{value}}`",
}

// the element templates over the GraphApi dictionary (implemented interfaces, union members, locations)
const elementDictionary: Record<string, string> = { ...graphApiAnnotations, ...graphElementAnnotations }

const rootKinds: Record<string, string> = { queries: "query", mutations: "mutation", subscriptions: "subscription" }

interface GraphElement {
  // the innermost named element and what it belongs to (both absent for a change of a type, directive or the schema)
  element?: AnnotateTemplate
  short?: AnnotateTemplate
  parent?: AnnotateTemplate
  // the enclosing type, directive or the schema
  owner: AnnotateTemplate
  // path length of the node that carries the element's GraphQL type (the usage site)
  usageLength: number
  // the changed path below the element
  rest: JsonPath
}

const sideOf = (diff: Diff, ctx: CompareContext) => (diff.action === "add" ? ctx.after : ctx.before)

// the value of an ancestor (or the node itself) of a node context, by path length
const valueAt = (node: NodeContext | undefined, length: number): unknown => {
  let current = node
  while (current && current.path.length > length) {
    current = current.up
  }
  return current && current.path.length === length ? current.value : undefined
}

const rootTypeName = (root: unknown, kind: string) =>
  getStringValue(root, `${kind}TypeName`) ?? rootTypeNames[kind] ?? kind

/** Splits a GraphApi path into the GraphQL element it belongs to and the change below it. */
const parseGraphElement = (diff: Diff, ctx: CompareContext): GraphElement | undefined => {
  const { path } = diff
  const root = sideOf(diff, ctx).root
  let owner: AnnotateTemplate
  let element: AnnotateTemplate | undefined
  let short: AnnotateTemplate | undefined
  let parent: AnnotateTemplate | undefined
  let i: number
  // the field (or directive) that owns arguments
  let argsOwner: AnnotateTemplate | undefined
  let isField = false

  const head = String(path[0])
  if (head in rootKinds) {
    const typeName = rootTypeName(root, rootKinds[head])
    owner = t("elRootType", { name: typeName })
    if (path.length < 2) {
      return
    }
    const field = String(path[1])
    element = t("elField", { name: `${typeName}.${field}` })
    short = t("elField", { name: field })
    parent = owner
    argsOwner = element
    isField = true
    i = 2
  } else if (head === "rootTypes" && path.length >= 2) {
    owner = t("elRootType", { name: rootTypeName(root, String(path[1])) })
    i = 2
  } else if (head === "components" && path[1] === "directives" && path.length >= 3) {
    owner = t("elDirective", { name: String(path[2]) })
    argsOwner = owner
    i = 3
  } else if (head === "components" && String(path[1]) in kindWords && path.length >= 3) {
    const kind = String(path[1])
    const typeName = String(path[2])
    owner = t("elType", { kind: kindWords[kind], name: typeName })
    i = 3
    const key = path[i]
    const name = path[i + 1]
    if ((key === "methods" || key === "properties") && isString(name)) {
      const word = kind === "inputObjects" ? "elInputField" : "elField"
      element = t(word, { name: `${typeName}.${name}` })
      short = t(word, { name })
      parent = owner
      argsOwner = element
      isField = kind !== "inputObjects"
      i += 2
    } else if (key === "values" && isString(name)) {
      element = t("elEnumValue", { name: `${typeName}.${name}` })
      short = t("elEnumValue", { name })
      parent = owner
      i += 2
    }
  } else if (head === "description" || head === "directives") {
    owner = t("elSchema")
    i = 0
  } else {
    return
  }

  let usageLength = i
  if (argsOwner && path[i] === "args") {
    if (isString(path[i + 1])) {
      element = t("elArgumentOf", { name: String(path[i + 1]), owner: argsOwner })
      short = t("elArgument", { name: String(path[i + 1]) })
      parent = argsOwner
      i += 2
      usageLength = i
    } else {
      return { owner, element: argsOwner, usageLength, rest: path.slice(i) }
    }
  }
  return { owner, element, short, parent, usageLength, rest: path.slice(i) }
}

// ---- GraphQL type of a usage, as SDL (`[String!]`), without the outer non-null marker --------------------------

const refName = (ref: unknown) => (isString(ref) ? ref.slice(ref.lastIndexOf("/") + 1) : undefined)

// a type usage, written flat on its usage site: `$ref`, a built-in `type`, or `type: list` with `items`
const usageType = (node: unknown): string | undefined => {
  const ref = getKeyValue(node, "$ref")
  if (isString(ref)) {
    return refName(ref)
  }
  const type = getKeyValue(node, "type")
  if (type === "list") {
    const items = getKeyValue(node, "items")
    const item = usageType(items)
    return item === undefined ? undefined : `[${item}${getKeyValue(items, "nonNull") === true ? "!" : ""}]`
  }
  return isString(type) ? type : undefined
}

// a named type's kind word, for two types of the same name (an enum replaced by a scalar `Status`)
const usageKind = (node: unknown): string | undefined => {
  const ref = getKeyValue(node, "$ref")
  const kind = isString(ref) ? ref.split("/")[2] : undefined
  return kind && kind in kindWords ? kindWords[kind] : "scalar"
}

const typeChange = (el: GraphElement, diff: Diff, ctx: CompareContext) => {
  const before = valueAt(ctx.before, el.usageLength)
  const after = valueAt(ctx.after, el.usageLength)
  const from = usageType(before)
  const to = usageType(after)
  if (from === undefined || to === undefined || from === to) {
    return from !== undefined && from === to
      ? { from: `${usageKind(before)} \`${from}\``, to: `${usageKind(after)} \`${to}\`` }
      : {}
  }
  return { from: `\`${from}\``, to: `\`${to}\`` }
}

// ---- values -----------------------------------------------------------------------------------------------------

const MAX_LISTED_LENGTH = 80

// a value worth listing in the description (long values are left out); free text (descriptions, deprecation
// reasons) is listed shortened (POLICY-95)
const listedValue = (value: unknown, freeText = false): string | undefined => {
  if (value === undefined) {
    return
  }
  if (freeText) {
    return formatText(value)
  }
  const text = formatValue(value)
  return text.length <= MAX_LISTED_LENGTH ? text : undefined
}

const valueChange = (
  diff: Diff,
  text: AnnotateTemplate,
  target: AnnotateTemplate,
  freeText = false,
): AnnotateTemplate => {
  if (diff.action === "replace") {
    const before = listedValue(diff.before, freeText)
    const after = listedValue(diff.after, freeText)
    return t("replace", { text, target, ...(before && after ? { before, after } : {}) })
  }
  return t(diff.action, {
    text,
    target,
    value: listedValue(diff.action === "add" ? diff.after : diff.before, freeText),
  })
}

const reasonOf = (value: unknown) => listedValue(getKeyValue(value, "reason"), true)

// ---- directive usages -------------------------------------------------------------------------------------------

const usageArguments = (meta: unknown): string => {
  if (!isObject(meta) || isArray(meta) || !Object.keys(meta).length) {
    return ""
  }
  return `(${Object.entries(meta)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(", ")})`
}

// `@tag(name: "x")` (arguments left out when long)
const usageLabel = (usage: unknown): string => {
  const name = usageName(usage)
  const args = usageArguments(getKeyValue(usage, "meta"))
  return `\`@${name}${args.length <= MAX_LISTED_LENGTH ? args : ""}\``
}

const usageList = (value: unknown): string | undefined => {
  const labels = isArray(value) ? value.map((usage) => usageLabel(usage)) : []
  return labels.length ? labels.join(", ") : undefined
}

const directiveChange = (diff: Diff, ctx: CompareContext, rest: JsonPath, target: AnnotateTemplate) => {
  const { action } = diff
  const value = action === "add" ? diff.after : diff.before
  if (rest.length === 1) {
    const names = usageList(value)
    if (!names) {
      return
    }
    const one = isArray(value) && value.length === 1
    return t(action, { text: one ? t("elUsage", { name: names }) : t("elUsages", { names }), target })
  }
  const side = sideOf(diff, ctx)
  const usage = valueAt(side, side.path.length - rest.length + 2)
  const name = usageName(usage)
  if (rest.length === 2) {
    if (action === "replace") {
      return t(action, { text: t("elUsage", { name: `\`@${name}\`` }), target })
    }
    return t(action, { text: t("elUsage", { name: usageLabel(value) }), target })
  }
  const on = t("elUsageOn", { name, element: target })
  if (rest[2] !== "meta") {
    return
  }
  if (rest.length === 3) {
    const args = usageArguments(value).slice(1, -1)
    return args && action !== "replace" && args.length <= MAX_LISTED_LENGTH
      ? t(action, { text: t("elUsageArguments", { value: args }), target: on })
      : undefined
  }
  if (rest.length === 4) {
    const name = String(rest[3])
    if (action === "replace") {
      return valueChange(diff, t("elUsageArgument", { name }), on)
    }
    const argument = JSON.stringify(value)
    return t(action, {
      text: t("elUsageArgument", { name, value: argument.length <= MAX_LISTED_LENGTH ? argument : undefined }),
      target: on,
    })
  }
}

// ---- the description --------------------------------------------------------------------------------------------

// the type of a usage: `$ref` / `type` / `items` of the usage site (except list item nullability)
const isTypePath = (rest: JsonPath) =>
  ["type", "$ref", "items"].includes(String(rest[0])) && rest[rest.length - 1] !== "nonNull"

// list item nullability: `items[/items]/nonNull`
const listDepth = (rest: JsonPath): number => {
  if (rest[rest.length - 1] !== "nonNull") {
    return 0
  }
  const steps = rest.slice(0, -1)
  return steps.length && steps.every((step) => step === "items") ? steps.length : 0
}

const typePartText = (diff: Diff, rest: JsonPath): AnnotateTemplate => {
  const key = rest[rest.length - 1]
  const value = diff.action === "add" ? diff.after : diff.before
  if (key === "$ref") {
    return t("elNamedType", { name: listedValue(refName(value)) })
  }
  if (key === "items") {
    return t("elListItemType")
  }
  if (key === "type" && value === "list") {
    return t("elListType")
  }
  if (key === "type" && isString(value)) {
    return t("elBuiltinType", { name: listedValue(value) })
  }
  return t("elTypeOf")
}

const elementChange = (diff: Diff, ctx: CompareContext, el: GraphElement): AnnotateTemplate | undefined => {
  const { action } = diff
  const { rest } = el
  const target = el.element ?? el.owner
  const key = rest[0]

  if (!rest.length) {
    if (!el.element && (action === "add" || action === "remove")) {
      // a named type or a directive definition added / removed
      return el.owner.template === "elSchema" ? undefined : t(action, { text: el.owner })
    }
    if (!el.element || !el.short || !el.parent || action === "rename") {
      return
    }
    if (action === "add" || action === "remove") {
      return t(action, { text: el.short, target: el.parent })
    }
    const { from, to } = typeChange(el, diff, ctx)
    return from && to ? t("replace", { text: t("elTypeOf"), target, before: from, after: to }) : undefined
  }

  const depth = listDepth(rest)
  if (depth) {
    const items = t(depth > 1 ? "elInnerListItems" : "elListItems", { element: target })
    return t(action === "replace" ? "replace" : action, { text: t("elNonNull"), target: items })
  }
  if (isTypePath(rest)) {
    const { from, to } = typeChange(el, diff, ctx)
    if (action === "replace") {
      return from && to ? t("replace", { text: t("elTypeOf"), target, before: from, after: to }) : undefined
    }
    return t(action, { text: typePartText(diff, rest), target, from, to })
  }

  switch (key) {
    // implemented interfaces, union members and directive locations: the item named by the rule's template, the
    // type or directive by its kind
    case "interfaces":
    case "oneOf":
    case "locations": {
      if (el.element) {
        return
      }
      const annotate =
        key === "interfaces"
          ? interfaceChangeAnnotation
          : key === "oneOf"
            ? unionMemberAnnotation
            : directiveLocationAnnotation
      const template = annotate(diff, ctx)
      const text = template?.params?.text
      return template && isObject(text) ? t(template.template, { text, target: el.owner }) : undefined
    }
    case "description":
      return rest.length === 1 ? valueChange(diff, t("elDescription"), target, true) : undefined
    case "specifiedByURL":
      return rest.length === 1 ? valueChange(diff, t("elSpecifiedBy"), target) : undefined
    case "default":
      return rest.length === 1 && el.element ? valueChange(diff, t("elDefault"), target) : undefined
    case "deprecation": {
      if (rest.length === 2 && rest[1] === "reason") {
        return valueChange(diff, t("elDeprecationReason"), target, true)
      }
      if (rest.length !== 1 || action === "replace") {
        return
      }
      const value = action === "add" ? diff.after : diff.before
      return t(action, { text: t("elDeprecation", { reason: reasonOf(value) }), target })
    }
    case "nonNull":
      // `nonNull: true` (non-null)
      return rest.length === 1 && el.element && action !== "replace"
        ? t(action, { text: t("elNonNull"), target })
        : undefined
    case "directives":
      return directiveChange(diff, ctx, rest, target)
    case "repeatable": {
      if (rest.length !== 1) {
        return
      }
      const on = action === "replace" ? diff.after === true : action === "add" ? diff.after === true : undefined
      if (on === undefined && action === "remove") {
        return diff.before === true ? t("remove", { text: t("elRepeatable"), target }) : undefined
      }
      return on === undefined ? undefined : t(on ? "add" : "remove", { text: t("elRepeatable"), target })
    }
  }
  return
}

/** The description of a change of a GraphQL element, or `undefined` when the element templates do not cover it. */
export const describeGraphElementChange = (diff: Diff, ctx: CompareContext): string | undefined => {
  const el = parseGraphElement(diff, ctx)
  if (!el) {
    return
  }
  const template = elementChange(diff, ctx, el)
  const text = template ? createAnnotation(template, elementDictionary, diff.type) : ""
  return text || undefined
}
