import { annotation, breaking, createUniqueItemsMappingResolver, deepEqual, nonBreaking } from "../core"
import { nonDirectional } from "../jsonSchema"
import type { ClassifyRule, CompareContext, CompareTransformResolver, DiffTypeClassifier } from "../types"
import { getKeyValue, isArray, isObject, isString } from "../utils"

/**
 * Classifiers shared by the GraphApi 0.1.2 and 1.0 rule sets: both encodings must give the same verdicts.
 */

const operationsKey = { query: "queries", mutation: "mutations", subscription: "subscriptions" } as const
const defaultRootName = { query: "Query", mutation: "Mutation", subscription: "Subscription" } as const
export type RootKind = keyof typeof operationsKey

const hasOperations = (root: unknown, kind: RootKind) => {
  const operations = getKeyValue(root, operationsKey[kind])
  return isObject(operations) && Object.keys(operations).length > 0
}

/**
 * Name of a root operation type (`queryTypeName`, ...): operations do not name the root type, but fragments `on Query`
 * and `__typename` checks do, so renaming an existing root type is breaking (graphql-inspector
 * SCHEMA_*_TYPE_CHANGED, ISSUE-122). 0.1.2 writes the name only when it is not the default one, 1.0 always: a default
 * name appearing with a new root type, or a custom name of a root type that is new / gone, is an annotation.
 */
export const rootTypeNameClassifyRule = (kind: RootKind): ClassifyRule => {
  const isDefault = (value: unknown) => value === undefined || value === defaultRootName[kind]
  return nonDirectional([
    // the name written on the after side: a rename when the root type existed before under the default name
    ({ before, after }) => (!isDefault(after.value) && hasOperations(before.root, kind) ? breaking : annotation),
    // the name dropped on the after side: a rename back to the default name when the root type still exists
    ({ before, after }) => (!isDefault(before.value) && hasOperations(after.root, kind) ? breaking : annotation),
    ({ before, after }) =>
      before.value !== after.value && hasOperations(before.root, kind) && hasOperations(after.root, kind)
        ? breaking
        : annotation,
  ])
}

// a directive location added widens where the directive may be used, a location removed invalidates usages there
// (executable locations: operations; type-system locations: SDL applications, POLICY-20 decided (a)) (ISSUE-120)
export const directiveLocationClassifyRule: ClassifyRule = nonDirectional([nonBreaking, breaking, breaking])

// `repeatable` turned on is non-breaking; turned off, schemas / operations applying the directive twice fail (ISSUE-121)
export const repeatableClassifyRule: ClassifyRule = nonDirectional([
  nonBreaking,
  breaking,
  ({ after }) => (after.value ? nonBreaking : breaking),
])

/**
 * Interfaces implemented by a type are a set (`implements A & B` = `implements B & A`, ISSUE-124): items are matched by
 * equality; an interface replaced by another is a removal (breaking) plus an addition (risky), as for union members
 * (POLICY-86 decided).
 */
export const interfacesMappingResolver = createUniqueItemsMappingResolver(deepEqual, false)

/**
 * `@oneOf` on an input object (ISSUE-117): exactly one field must then be supplied, so adding it breaks operations that
 * supply several fields (or none), removing it is non-breaking; other directive usages are annotations.
 */
export const oneOfUsageClassifyRule = (contains: (value: unknown, ctx: CompareContext) => boolean): ClassifyRule => {
  const add: DiffTypeClassifier = (ctx) => (contains(ctx.after.value, ctx) ? breaking : annotation)
  const remove: DiffTypeClassifier = (ctx) => (contains(ctx.before.value, ctx) ? nonBreaking : annotation)
  const replace: DiffTypeClassifier = (ctx) => {
    const b = contains(ctx.before.value, ctx)
    const a = contains(ctx.after.value, ctx)
    return a === b ? annotation : a ? breaking : nonBreaking
  }
  return nonDirectional([add, remove, replace])
}

// the specified directives in the shape graphql-js defines them; one with another shape is an override (GraphApi 1.0
// §7.11): locations match as a set apart from the optional ones, argument names as a set
const specifiedDirectives: Record<string, { locations: string[]; args: string[]; optionalLocations?: string[] }> = {
  skip: { locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"], args: ["if"] },
  include: { locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"], args: ["if"] },
  deprecated: {
    locations: ["FIELD_DEFINITION", "ARGUMENT_DEFINITION", "INPUT_FIELD_DEFINITION", "ENUM_VALUE"],
    args: ["reason"],
    // graphql-js 16.14+ and 17 also allow `@deprecated` on directive definitions
    optionalLocations: ["DIRECTIVE_DEFINITION"],
  },
  specifiedBy: { locations: ["SCALAR"], args: ["url"] },
  oneOf: { locations: ["INPUT_OBJECT"], args: [] },
}

const sameSet = (a: unknown, b: string[]) => isArray(a) && a.length === b.length && b.every((item) => a.includes(item))

/** A built-in directive definition as written by GraphApi 1.0 (it is present only where the directive is used). */
export const isBuiltinDirectiveDefinition = (name: string, definition: unknown): boolean => {
  const spec = specifiedDirectives[name]
  if (!spec || !isObject(definition)) {
    return false
  }
  const args = getKeyValue(definition, "args")
  const optional = spec.optionalLocations ?? []
  const locations = isArray(definition.locations)
    ? definition.locations.filter((location) => !optional.includes(location as string))
    : definition.locations
  return sameSet(locations, spec.locations) && sameSet(isObject(args) ? Object.keys(args) : [], spec.args)
}

/**
 * Built-in directives exist in every schema: GraphApi 1.0 lists their definitions only where they are used, so a
 * built-in definition present on one side only is the same definition on the other side (ISSUE-119: removing the last
 * `@deprecated` no longer reports the removal of the `deprecated` directive). A built-in definition on both sides is the
 * one of the GraphQL implementation (its description and optional locations differ between graphql-js versions), not
 * a change of the schema: it is not compared.
 */
export const transformBuiltinDirectives: CompareTransformResolver = (before, after) => {
  if (!isObject(before) || !isObject(after) || isArray(before) || isArray(after)) {
    return [before, after]
  }
  let b: Record<string, unknown> | undefined
  let a: Record<string, unknown> | undefined
  for (const name of Object.keys(specifiedDirectives)) {
    if (name in before && !(name in after) && isBuiltinDirectiveDefinition(name, before[name])) {
      a ??= { ...after }
      a[name] = before[name]
    } else if (name in after && !(name in before) && isBuiltinDirectiveDefinition(name, after[name])) {
      b ??= { ...before }
      b[name] = after[name]
    } else if (
      name in before &&
      name in after &&
      before[name] !== after[name] &&
      isBuiltinDirectiveDefinition(name, before[name]) &&
      isBuiltinDirectiveDefinition(name, after[name])
    ) {
      b ??= { ...before }
      b[name] = after[name]
    }
  }
  return [b ?? before, a ?? after]
}

// GraphQL type of a GraphApi 0.1.2 usage node (a field, an argument, an input field, a list item), nullability aside:
// a named type (`$ref`), a built-in or custom scalar (`type` + `format`) or a list of one of them
const builtinScalars: Record<string, string> = { integer: "Int", number: "Float", boolean: "Boolean", string: "String" }

export const graphTypeOf = (node: unknown): string | undefined => {
  if (!isObject(node) || isArray(node)) {
    return
  }
  if (isString(node.$ref)) {
    return node.$ref
  }
  const { type } = node
  if (type === "array") {
    const item = graphTypeOf(node.items)
    return item === undefined ? undefined : `[${item}]`
  }
  if (!isString(type) || !(type in builtinScalars)) {
    return
  }
  return isString(node.format) ? node.format : builtinScalars[type]
}

/** The document path of the node a diff is about (the after path for an added node). */
export const graphNodePath = (ctx: CompareContext) =>
  ctx.before.value !== undefined ? ctx.before.path : ctx.after.path
