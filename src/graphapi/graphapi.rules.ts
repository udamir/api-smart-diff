import {
  allAnnotation,
  allBreaking,
  allDeprecated,
  breaking,
  nonBreaking,
  risky,
  CompareScopes,
  compareNested,
  convertDiffToMeta,
  deepEqualsUniqueItemsMappingResolver,
  diffFactory,
  mergedValue,
  staticRules,
} from "../core"
import { createFields, nonDirectional, valueCompareResolver } from "../jsonSchema"
import type {
  ClassifyRule,
  ClassifyTuple,
  CompareContext,
  CompareResolver,
  CompareResult,
  CompareRules,
  CompareScope,
  CompareTransformResolver,
  DiffTypeClassifier,
  MappingResolver,
} from "../types"
import { getKeyValue, isArray, isObject } from "../utils"
import {
  directiveLocationClassifyRule,
  interfacesMappingResolver,
  oneOfUsageClassifyRule,
  repeatableClassifyRule,
  rootTypeNameClassifyRule,
  transformBuiltinDirectives,
} from "./graphapi.classify"
import {
  directiveLocationAnnotation,
  directiveUsageAnnotation,
  interfaceChangeAnnotation,
  rootTypeNameAnnotation,
  unionMemberAnnotation,
} from "./graphapi.annotate"

// GraphApi 1.0 rules keep their literal meaning in every scope unless stated otherwise
const fixed = (tuple: ClassifyTuple): ClassifyRule => nonDirectional(tuple)
const annotationTree: CompareRules = { $: allAnnotation, "/**": { $: allAnnotation } }

// a non-null position (`T!`): only `nonNull: true` counts (GraphApi 1.0 §4.3)
const isNonNull = (value: unknown) => getKeyValue(value, "nonNull") === true

// an argument or input field that must be provided: non-null without a default
const isRequiredInput = (value: unknown) => isNonNull(value) && getKeyValue(value, "default") === undefined

// with a default value, operations that omit the argument / input field silently get that value (POLICY-05: risky)
const addInputClassifier: DiffTypeClassifier = ({ after }) =>
  isRequiredInput(after.value) ? breaking : getKeyValue(after.value, "default") !== undefined ? risky : nonBreaking

// default value of an argument / input field: operations that omit it silently get another value (POLICY-05: risky),
// except that a default added to / removed from a non-null input makes it optional / required
const defaultClassifyRule: ClassifyRule = nonDirectional([
  ({ after }) => (isNonNull(after.parent) ? nonBreaking : risky),
  ({ before }) => (isNonNull(before.parent) ? breaking : risky),
  risky,
])

// an interface implemented: clients matching on the abstract type may get a new concrete type (POLICY-05: risky); an
// interface no longer implemented breaks fragments `... on Named` inside a selection of the type (ISSUE-116); one
// interface replaced by another is both
const interfacesClassifyRule = nonDirectional([risky, breaking, breaking])

// interfaces implemented by a type (or a root operation type, ISSUE-141), matched as a set (ISSUE-124)
const interfacesRules: CompareRules = {
  $: interfacesClassifyRule,
  annotate: interfaceChangeAnnotation,
  mapping: interfacesMappingResolver,
  "/*": { $: interfacesClassifyRule, annotate: interfaceChangeAnnotation, compare: valueCompareResolver },
}

// `implementedBy` is the reverse index of `interfaces`: a change is reported once, at the implementing type's
// `interfaces` (as graphql-inspector reports OBJECT_TYPE_INTERFACE_ADDED / REMOVED once)
const derivedCompareResolver: CompareResolver = (ctx) => ({
  diffs: [],
  merged: mergedValue(ctx, ctx.after, ctx.after.value),
})

const usageRef = (usage: unknown) => getKeyValue(usage, "$ref")

// the `@deprecated` usage of a deprecated element is reported by its `deprecation` (ISSUE-119): one diff per change
const withoutDeprecatedUsage: CompareTransformResolver = (before, after) => {
  const strip = (value: unknown) => {
    if (!isObject(value) || isArray(value) || !isObject(value.deprecation) || !isArray(value.directives)) {
      return value
    }
    const directives = value.directives.filter((usage) => usageRef(usage) !== "#/components/directives/deprecated")
    if (directives.length === value.directives.length) {
      return value
    }
    const { directives: _, ...rest } = value
    return directives.length ? { ...rest, directives } : rest
  }
  return [strip(before), strip(after)]
}

// applied directives (1.0 lists): equal usages are paired first, then the remaining usages of the same directive in
// order, so an argument added to / changed in a usage is one change of that usage (ISSUE-128)
const directiveUsagesMappingResolver: MappingResolver<number> = (before, after, ctx) => {
  const result = deepEqualsUniqueItemsMappingResolver(before, after, ctx)
  const added = new Set(result.added)
  const removed: number[] = []
  for (const i of result.removed) {
    const definition = usageRef(before[i])
    const j = definition === undefined ? undefined : [...added].find((k) => usageRef(after[k]) === definition)
    if (j === undefined) {
      removed.push(i)
    } else {
      result.mapped[i] = j
      added.delete(j)
    }
  }
  return { added: [...added], removed, mapped: result.mapped }
}

// a paired usage without arguments compares as one with an empty argument list (`@tag` -> `@tag(name: "x")`)
const withUsageArguments: CompareTransformResolver = (before, after) => {
  const fill = (value: unknown, other: unknown) =>
    isObject(value) && !isArray(value) && !("meta" in value) && isObject(other) && "meta" in other
      ? { ...value, meta: {} }
      : value
  return [fill(before, after), fill(after, before)]
}

const isOneOfUsage = (usage: unknown) => usageRef(usage) === "#/components/directives/oneOf"
const containsOneOfUsage = (value: unknown) => (isArray(value) ? value.some(isOneOfUsage) : isOneOfUsage(value))

// the type usage of a usage site (GraphApi 1.0 §4.1): `$ref` for a named type, `type` for a built-in scalar or a list
// with `items`, written next to the site's own fields (description, args, default, ...) and `nonNull`
const typeUsageKeys = ["$ref", "type", "items"]

const typeUsageForm = (value: unknown) =>
  !isObject(value) || isArray(value)
    ? undefined
    : "$ref" in value
      ? "ref"
      : value.type === "list"
        ? "list"
        : "type" in value
          ? "builtin"
          : undefined

const splitUsageSite = (value: unknown) => {
  const usage: Record<string, unknown> = {}
  const site: Record<string, unknown> = {}
  if (isObject(value) && !isArray(value)) {
    for (const key of Object.keys(value)) {
      ;(typeUsageKeys.includes(key) ? usage : site)[key] = value[key]
    }
  }
  return { usage, site }
}

/**
 * A usage site whose type usage changes form (`type: String` -> `$ref: Date`, `String` -> `[String]`) changes one
 * thing, the GraphQL type: one replace diff for the type usage (breaking, types are nominal), with the site's own
 * fields (nullability, description, arguments, default, directives) compared as usual. Usages of the same form are
 * compared key by key: `$ref`, `type` or the list `items`.
 */
const typeUsageCompareResolver: CompareResolver = (ctx) => {
  const { before, after } = ctx
  const bForm = typeUsageForm(before.value)
  const aForm = typeUsageForm(after.value)
  if (bForm === undefined || aForm === undefined || bForm === aForm) {
    return
  }
  const b = splitUsageSite(before.value)
  const a = splitUsageSite(after.value)
  const rules = { ...ctx.rules, $: fixed(allBreaking as ClassifyTuple) }
  const scoped: CompareContext = { ...ctx, rules }
  const diff = diffFactory.replaced(before.path, b.usage, a.usage, scoped)
  const rest = compareNested({ ...ctx, rules: { ...ctx.rules, compare: undefined } }, b.site, a.site)
  const original = after.source ?? after.value
  return {
    diffs: [diff, ...rest.diffs],
    merged:
      isObject(original) && isObject(rest.merged)
        ? { ...original, ...rest.merged }
        : mergedValue(ctx, after, after.value),
    rootMergeMeta: convertDiffToMeta(diff),
    contexts: [scoped, ...rest.contexts],
  } as CompareResult
}

/**
 * Rules for GraphApi 1.0 documents (gqlapi 0.6, https://udamir.github.io/graphapi/spec/v1.0): definitions carry an
 * explicit `type` (their kind) with their members next to it, type usages are written flat on the usage site and
 * reference types nominally (`$ref` for named types, `type` for built-in scalars, `type: list` with `items`),
 * nullability is `nonNull: true` and "must be provided" is derived from `nonNull` + `default`. Operations open the
 * `output` scope, `args` the `args` scope; named types are classified by the scopes that reference them.
 */
export const graphApiRules = (): CompareRules => {
  const directiveUsagesRules: CompareRules = {
    $: allAnnotation,
    annotate: directiveUsageAnnotation,
    mapping: directiveUsagesMappingResolver,
    "/*": { ...annotationTree, annotate: directiveUsageAnnotation, transform: [withUsageArguments] },
  }

  // `@oneOf` on an input object changes which values operations may pass (ISSUE-117)
  const inputObjectDirectiveUsagesRules: CompareRules = {
    $: oneOfUsageClassifyRule(containsOneOfUsage),
    annotate: directiveUsageAnnotation,
    mapping: directiveUsagesMappingResolver,
    "/*": {
      ...annotationTree,
      $: oneOfUsageClassifyRule(containsOneOfUsage),
      annotate: directiveUsageAnnotation,
      transform: [withUsageArguments],
    },
  }

  const deprecationRules: CompareRules = {
    $: allDeprecated,
    "/reason": { $: allDeprecated },
  }

  // `nonNull: true` marks a non-null position: adding it restricts inputs (breaking for arguments, unless a default
  // keeps the input optional for operations: POLICY-47 decided, non-breaking) and guarantees outputs (non-breaking for
  // results); the 3-tuple inverts in the output scope
  const nonNullRules: CompareRules = {
    $: {
      [CompareScopes.args]: [
        ({ after }) => (getKeyValue(after.parent, "default") !== undefined ? nonBreaking : breaking),
        nonBreaking,
        breaking,
      ],
      [CompareScopes.output]: [nonBreaking, breaking, breaking],
      default: [breaking, nonBreaking, breaking],
    },
  }

  // a type usage is nominal: the reference itself is compared, never the referenced type's content; every change of
  // the referenced type or built-in scalar is a type change
  const typeUsageRules: CompareRules = {
    compare: typeUsageCompareResolver,
    "/$ref": { $: fixed(allBreaking as ClassifyTuple) },
    "/type": { $: fixed(allBreaking as ClassifyTuple) },
    "/items": staticRules(() => listItemRules),
    "/nonNull": nonNullRules,
  }

  // the item of a list: an object that holds nothing but a type usage
  const listItemRules: CompareRules = { ...typeUsageRules, $: fixed(allBreaking as ClassifyTuple) }

  const argumentRules: CompareRules = {
    ...typeUsageRules,
    $: fixed([addInputClassifier, breaking, breaking]),
    transform: [withoutDeprecatedUsage],
    "/default": { $: defaultClassifyRule, compare: valueCompareResolver },
    "/deprecation": deprecationRules,
    "/description": { $: allAnnotation },
    "/directives": directiveUsagesRules,
  }

  const argumentsRules: CompareRules = {
    scope: CompareScopes.args,
    $: fixed([nonBreaking, breaking, breaking]),
    "/*": argumentRules,
  }

  // an operation or an object field: `args` are inputs, `output` is the result
  const operationRules: CompareRules = {
    ...typeUsageRules,
    $: fixed([nonBreaking, breaking, breaking]),
    transform: [createFields("args"), withoutDeprecatedUsage],
    "/description": { $: allAnnotation },
    "/directives": directiveUsagesRules,
    "/deprecation": deprecationRules,
    "/args": argumentsRules,
  }

  const operationsRules: CompareRules = {
    scope: CompareScopes.output,
    $: fixed([nonBreaking, breaking, breaking]),
    "/*": operationRules,
  }

  // enum values: a new value widens the input domain but can surprise an output consumer with an exhaustive switch
  // (POLICY-05: risky)
  const enumValueClassifyRule: ClassifyRule = {
    [CompareScopes.args]: [nonBreaking, breaking, breaking],
    [CompareScopes.output]: [risky, nonBreaking, breaking],
    default: [nonBreaking, breaking, breaking],
  }

  // the members of a definition, next to its `type` (the kind, fixed by the components section)
  const definitionMemberRules: CompareRules = {
    "/type": { $: fixed(allBreaking as ClassifyTuple) },
    "/interfaces": interfacesRules,
    "/implementedBy": { $: allAnnotation, compare: derivedCompareResolver },
    "/methods": {
      $: fixed([nonBreaking, breaking, breaking]),
      "/*": operationRules,
    },
    "/properties": {
      $: fixed([nonBreaking, breaking, breaking]),
      "/*": argumentRules,
    },
    "/values": {
      $: fixed([nonBreaking, breaking, breaking]),
      "/*": {
        $: enumValueClassifyRule,
        transform: [withoutDeprecatedUsage],
        "/description": { $: allAnnotation },
        "/deprecation": deprecationRules,
        "/directives": directiveUsagesRules,
      },
    },
    "/oneOf": {
      $: fixed([nonBreaking, breaking, breaking]),
      mapping: deepEqualsUniqueItemsMappingResolver,
      // a new union member is a new possible result type (POLICY-05: risky); a member removed breaks fragments
      // `... on Video` inside a selection of the union (ISSUE-115)
      "/*": {
        $: {
          [CompareScopes.output]: [risky, breaking, breaking],
          default: [nonBreaking, breaking, breaking],
        },
        annotate: unionMemberAnnotation,
      },
    },
  }

  const componentRules: CompareRules = {
    ...definitionMemberRules,
    scope: CompareScopes.components,
    $: fixed([nonBreaking, breaking, breaking]),
    transform: [createFields("implementedBy")],
    "/title": { $: allAnnotation },
    "/description": { $: allAnnotation },
    "/directives": directiveUsagesRules,
    "/specifiedByURL": { $: allAnnotation },
  }

  // types no root operation type reaches are classified as if reachable (POLICY-02 decided (a), ISSUE-132): output
  // semantics for object / interface / union types, argument semantics for input types, both for enums and scalars
  const componentsOf = (unreferencedScopes: CompareScope[], rules: CompareRules = componentRules): CompareRules => ({
    $: fixed([nonBreaking, breaking, breaking]),
    "/*": { ...rules, unreferencedScopes },
  })
  const outputComponentsRules = componentsOf([CompareScopes.output])
  const eitherComponentsRules = componentsOf([CompareScopes.args, CompareScopes.output])
  const inputObjectsRules = componentsOf([CompareScopes.args], {
    ...componentRules,
    "/directives": inputObjectDirectiveUsagesRules,
  })

  // description, directives and implemented interfaces of the root operation types (gqlapi 0.6, ISSUE-141); a root
  // type implementing an interface is returned wherever the interface is (the output scope)
  const rootTypeRules: CompareRules = {
    $: allAnnotation,
    transform: [createFields("interfaces", "directives")],
    "/description": { $: allAnnotation },
    "/directives": directiveUsagesRules,
    "/interfaces": interfacesRules,
  }

  const directiveDefinitionRules: CompareRules = {
    $: fixed([nonBreaking, breaking, breaking]),
    transform: [createFields("args")],
    "/title": { $: allAnnotation },
    "/description": { $: allAnnotation },
    "/locations": {
      $: directiveLocationClassifyRule,
      annotate: directiveLocationAnnotation,
      mapping: deepEqualsUniqueItemsMappingResolver,
      "/*": { $: directiveLocationClassifyRule, annotate: directiveLocationAnnotation },
    },
    "/repeatable": { $: repeatableClassifyRule },
    "/args": argumentsRules,
  }

  const componentKinds = ["scalars", "objects", "interfaces", "unions", "enums", "inputObjects", "directives"]

  return {
    transform: [createFields("queries", "mutations", "subscriptions", "components", "rootTypes")],
    "/graphapi": { $: allAnnotation },
    "/description": { $: allAnnotation },
    "/directives": directiveUsagesRules,
    "/queryTypeName": { $: rootTypeNameClassifyRule("query"), annotate: rootTypeNameAnnotation },
    "/mutationTypeName": { $: rootTypeNameClassifyRule("mutation"), annotate: rootTypeNameAnnotation },
    "/subscriptionTypeName": { $: rootTypeNameClassifyRule("subscription"), annotate: rootTypeNameAnnotation },
    "/rootTypes": {
      $: allAnnotation,
      scope: CompareScopes.output,
      transform: [createFields("query", "mutation", "subscription")],
      "/*": rootTypeRules,
    },
    "/queries": operationsRules,
    "/mutations": operationsRules,
    "/subscriptions": operationsRules,
    "/components": {
      transform: [createFields(...componentKinds)],
      $: fixed([nonBreaking, breaking, breaking]),
      "/scalars": eitherComponentsRules,
      "/objects": outputComponentsRules,
      "/interfaces": outputComponentsRules,
      "/unions": outputComponentsRules,
      "/enums": eitherComponentsRules,
      "/inputObjects": inputObjectsRules,
      "/directives": {
        $: fixed([nonBreaking, breaking, breaking]),
        transform: [transformBuiltinDirectives],
        "/*": directiveDefinitionRules,
      },
    },
  }
}
