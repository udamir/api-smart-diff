import { isRefNode } from "../own"

import {
  combinerKeyClassifyRule,
  jsonSchemaKeyChange,
  jsonSchemaRules,
  nonDirectional,
  requiredMappingResolver,
  schemaCompareResolver,
  schemaKeyItemChange,
  schemaStatusChange,
  transformJsonSchema,
  transformJsonSchemaCombiners,
  valueCompareResolver,
} from "../jsonSchema"
import {
  allAnnotation,
  allBreaking,
  allDeprecated,
  nonBreaking,
  breaking,
  risky,
  unclassified,
  CompareScopes,
  convertDiffToMeta,
  diffFactory,
  getParentContext,
  mergedValue,
  compareNested,
  createUniqueItemsMappingResolver,
  deepEqual,
  staticRules,
} from "../core"
import { transformGraphSchema, transformGraphSchemaDirective } from "./graphapi.transform"
import {
  directiveUsageAnnotation,
  graphTypeChangeAnnotation,
  interfaceChangeAnnotation,
  unionMemberAnnotation,
  parentKeyChangeAnnotation,
  valuesAnnotationChange,
} from "./graphapi.annotate"
import { graphTypeOf, interfacesMappingResolver, graphNodePath, oneOfUsageClassifyRule } from "./graphapi.classify"
import type {
  ChangeAnnotationResolver,
  ClassifyRule,
  ClassifyTuple,
  CompareContext,
  CompareResolver,
  CompareResult,
  CompareRules,
  CompareTransformResolver,
  MappingResolver,
  NestedCompareResult,
  NodeContext,
} from "../types"
import { getArrayValue, getKeyValue, isExist, isObject, isString } from "../utils"

/**
 * GraphQL types are nominal: a usage that points at another named type (`T` -> `U`) is a type change even when the
 * two types are structurally identical, so differing `$ref`s are reported as one replace diff instead of being
 * compared by content (ISSUE-41). A usage of the same named type is not expanded either: the type's changes are
 * reported once, at its declaration, as GraphApi 1.0 `typeDef`s are (ISSUE-53); the usage node itself (`nullable`,
 * `description`, `args`, `deprecated`, directives) is compared as a plain node. Ref/inline pairs use the structural
 * resolver.
 */
export const graphApiRefsCompareResolver: CompareResolver = (ctx) => {
  const { before, after } = ctx
  // the merge transform may have inlined the referenced type: the original nodes carry the `$ref`
  const bRef = isRefNode(before.source) ? before.source.$ref : isRefNode(before.value) ? before.value.$ref : undefined
  const aRef = isRefNode(after.source) ? after.source.$ref : isRefNode(after.value) ? after.value.$ref : undefined
  if (bRef !== undefined && bRef === aRef && isRefNode(before.value) && isRefNode(after.value)) {
    return
  }
  // the GraphQL type of a usage is nominal (ISSUE-123): `Int` -> `Float`, `String` -> `[String]`, an enum -> a scalar
  // are one type change (breaking), not JSON Schema keyword changes with set-inclusion semantics; nullability is
  // compared apart (`nullable`, `required`)
  if (!isDeclaration(before.path)) {
    const bType = graphTypeOf(before.source ?? before.value)
    const aType = graphTypeOf(after.source ?? after.value)
    const bothLists = bType?.startsWith("[") && aType?.startsWith("[")
    if (bType !== undefined && aType !== undefined && bType !== aType && !bothLists && (!bRef || !aRef)) {
      return usageTypeChange(ctx, graphTypeChangeAnnotation(bType, aType))
    }
  }
  // a usage switching between a named type and an inline (built-in / custom scalar) type: the named side is compared
  // by content, with the usage's own keywords (`nullable`, `description`, ...) kept next to the inlined type
  if ((bRef === undefined) !== (aRef === undefined)) {
    const inlined = (side: NodeContext, sideName: "before" | "after") => {
      if (!isRefNode(side.value)) {
        return side.value
      }
      const { $ref, ...siblings } = side.value as Record<string, unknown>
      if (!Object.keys(siblings).length) {
        return side.value
      }
      const target = ctx.session.resolveRef(sideName, side.root, $ref as string)
      return isObject(target?.value) ? { ...target.value, ...siblings } : side.value
    }
    const bValue = inlined(before, "before")
    const aValue = inlined(after, "after")
    if (bValue !== before.value || aValue !== after.value) {
      return compareNested(ctx, bValue, aValue)
    }
  }
  if (bRef !== undefined && aRef !== undefined && bRef !== aRef) {
    return nominalTypeChange(ctx)
  }
  return schemaCompareResolver(ctx)
}

// a named type declaration (`components.<kind>.<name>`) or the document root: not a usage
const isDeclaration = (path: readonly unknown[]) => path.length === 0 || (path.length === 3 && path[0] === "components")

// keywords of a usage node that describe the field / argument, not its type
const usageKeys = ["description", "deprecated", "directives", "args", "default", "nullable"]

const pickUsage = (value: unknown) => {
  const result: Record<string, unknown> = {}
  if (isObject(value)) {
    for (const key of usageKeys) {
      if (key in value) {
        result[key] = (value as Record<string, unknown>)[key]
      }
    }
  }
  return result
}

// a usage whose GraphQL type changed: one replace diff for the type, and the usage's own keywords (description,
// deprecation, directives, arguments, default, nullability) compared as usual, as GraphApi 1.0 compares `typeDef` apart
const usageTypeChange = (ctx: CompareContext, annotate: ChangeAnnotationResolver): CompareResult => {
  const type = nominalTypeChange(ctx, annotate) as NestedCompareResult
  const bUsage = pickUsage(ctx.before.value)
  const aUsage = pickUsage(ctx.after.value)
  if (!Object.keys(bUsage).length && !Object.keys(aUsage).length) {
    return type
  }
  const usage = compareNested(ctx, bUsage, aUsage)
  const original = ctx.after.source ?? ctx.after.value
  return {
    diffs: [...type.diffs, ...usage.diffs],
    merged: isObject(original) && isObject(usage.merged) ? { ...original, ...usage.merged } : type.merged,
    rootMergeMeta: type.rootMergeMeta,
    contexts: [...type.contexts, ...usage.contexts],
  } as NestedCompareResult
}

// one replace diff for a usage whose type changed: the usage's other keywords are not compared (as for a `$ref` swap)
const nominalTypeChange = (ctx: CompareContext, annotate?: ChangeAnnotationResolver): CompareResult => {
  const { before, after } = ctx
  const rules = { ...ctx.rules, $: nonDirectional(allBreaking as ClassifyTuple), ...(annotate ? { annotate } : {}) }
  const scoped = { ...ctx, rules }
  const diff = diffFactory.replaced(before.path, before.value, after.value, scoped)
  return {
    diffs: [diff],
    merged: mergedValue(ctx, after, after.value),
    rootMergeMeta: convertDiffToMeta(diff),
    contexts: [scoped],
  } as any
}

// a property (argument / input field) is non-null: listed in the `required` array of its owner
const isRequiredProperty = (node: NodeContext | undefined) =>
  !!node && !!getArrayValue(getParentContext(node, "", "required")?.value)?.includes(node.key)

// an argument / input field added: with a default value operations that omit it silently get that value
// (POLICY-05: risky), a non-null one without a default must be supplied (breaking)
const addInputClassifier = ({ after }: CompareContext) =>
  isExist(getKeyValue(after.value, "default")) ? risky : isRequiredProperty(after) ? breaking : nonBreaking

// GraphQL is a selection-set language: a removed output field or argument breaks every client selecting it
const graphPropertyClassifyRule: ClassifyRule = {
  [CompareScopes.args]: [addInputClassifier, breaking, unclassified],
  [CompareScopes.output]: [nonBreaking, breaking, unclassified],
  default: [nonBreaking, breaking, unclassified],
}

const hasJsonSchemaDefault = ({ after }: CompareContext) =>
  isString(after.value) && isExist(getParentContext(after, "", "properties", after.value, "default")?.value)

// non-null status of an input: with a default it is optional for operations; a new argument / input field with a
// default is reported (POLICY-05: risky) by its property and by its `required` entry
const requiredInputAdd = (ctx: CompareContext) => {
  if (!hasJsonSchemaDefault(ctx)) {
    return isString(ctx.after.value) ? breaking : nonBreaking
  }
  const existed = isExist(getParentContext(ctx.before, "", "properties", ctx.after.value as string)?.value)
  return existed ? nonBreaking : risky
}

const requiredInputReplace = (ctx: CompareContext) =>
  !isString(ctx.after.value) || hasJsonSchemaDefault(ctx) ? nonBreaking : breaking

// a non-null input made nullable is non-breaking; the `required` entry of a removed input is part of that removal
// (breaking, ISSUE-123)
const requiredInputRemove = ({ before, after }: CompareContext) =>
  isString(before.value) && !isExist(getParentContext(after, "", "properties", before.value)?.value)
    ? breaking
    : nonBreaking

const graphRequiredItemClassifyRule: ClassifyRule = {
  [CompareScopes.args]: [requiredInputAdd, requiredInputRemove, requiredInputReplace],
  [CompareScopes.output]: [nonBreaking, breaking, breaking],
  default: [requiredInputAdd, requiredInputRemove, requiredInputReplace],
}

// default value of an argument / input field: operations that omit it silently get another value (POLICY-05: risky),
// except that a default added to / removed from a non-null input makes it optional / required
const argumentDefaultClassifyRule: ClassifyRule = {
  [CompareScopes.args]: [
    ({ after }) => (isRequiredProperty(after.up) ? nonBreaking : risky),
    ({ before }) => (isRequiredProperty(before.up) ? breaking : risky),
    risky,
  ],
  default: [nonBreaking, breaking, breaking],
}

// a union member added to an output can surprise a client with an exhaustive switch (POLICY-05: risky); a member
// removed breaks fragments `... on Video` inside a selection of the union (ISSUE-115)
const unionMemberClassifyRule: ClassifyRule = {
  [CompareScopes.output]: [risky, breaking, breaking],
  default: [nonBreaking, breaking, breaking],
}

// an interface implemented: clients matching on the abstract type may get a new concrete type (POLICY-05: risky); an
// interface no longer implemented breaks fragments `... on Named` inside a selection of the type (ISSUE-116)
const interfaceClassifyRule = nonDirectional([risky, breaking, breaking])

// `@oneOf` applied to an input object declaration (`components.inputObjects.<name>.directives.oneOf`, ISSUE-117)
const isOneOfOnInputObject = (value: unknown, ctx: CompareContext) => {
  const path = graphNodePath(ctx)
  return (
    path.length === 5 &&
    path[0] === "components" &&
    path[1] === "inputObjects" &&
    path[3] === "directives" &&
    getKeyValue(value, "$ref") === "#/components/directives/oneOf"
  )
}

// directive usages keyed by name (`{ $ref, meta, repeats }`; `repeats` holds the further usages of a repeatable
// directive, gqlapi 0.6, ISSUE-126); applied type-system directives are annotations (ISSUE-40) except `@oneOf`
export const graphDirectiveUsagesRules: CompareRules = {
  $: allAnnotation,
  annotate: directiveUsageAnnotation,
  "/*": {
    $: oneOfUsageClassifyRule(isOneOfOnInputObject),
    annotate: directiveUsageAnnotation,
    transform: [transformGraphSchemaDirective],
    "/meta": {
      $: allAnnotation,
      annotate: parentKeyChangeAnnotation,
      "/*": {
        annotate: parentKeyChangeAnnotation,
        $: allAnnotation,
      },
    },
    "/repeats": {
      $: allAnnotation,
      annotate: parentKeyChangeAnnotation,
      "/**": { $: allAnnotation, annotate: parentKeyChangeAnnotation },
    },
  },
}

// union members are named types: matched by name (the original `$ref`; the merge may have inlined the member), a
// member kept is not compared by content (its changes are reported at its declaration, ISSUE-53)
const memberRef = (value: unknown) => {
  const ref = getKeyValue(value, "$ref")
  return isString(ref) ? ref : undefined
}

const unionMembersMappingResolver: MappingResolver<number> = (before, after, ctx) => {
  const bSource =
    Array.isArray(ctx.before.source) && ctx.before.source.length === before.length ? ctx.before.source : before
  const aSource = Array.isArray(ctx.after.source) && ctx.after.source.length === after.length ? ctx.after.source : after
  return membersBySource(bSource, aSource, ctx)
}

const membersBySource = createUniqueItemsMappingResolver((a, b) => {
  const aRef = memberRef(a)
  return aRef !== undefined ? aRef === memberRef(b) : deepEqual(a, b)
}, false)

const unionMemberCompareResolver: CompareResolver = (ctx) => {
  const bRef = memberRef(ctx.before.source)
  if (bRef !== undefined && bRef === memberRef(ctx.after.source)) {
    return { diffs: [], merged: mergedValue(ctx, ctx.after, ctx.after.value) }
  }
  return graphApiRefsCompareResolver(ctx)
}

// interfaces implemented by a type or a root operation type (ISSUE-141), matched as a set (ISSUE-124)
export const graphInterfacesRules: CompareRules = {
  $: interfaceClassifyRule,
  annotate: interfaceChangeAnnotation,
  mapping: interfacesMappingResolver,
  // an implementor is returned wherever the interface is: it inherits the interface's usage scopes (ISSUE-118)
  "/*": {
    $: interfaceClassifyRule,
    annotate: interfaceChangeAnnotation,
    compare: valueCompareResolver,
    inheritUsage: true,
  },
}

const jsonSchemaCombiners = transformJsonSchemaCombiners()

// a usage of a named type (`{ $ref, nullable, description, args, ... }`) keeps its siblings next to the `$ref`: they
// describe the usage (the field), not the referenced type, so they are not lifted into an allOf; a union (`oneOf` of
// named types) keeps its title / description / directives next to its members, which are compared by name (ISSUE-115)
const isUnion = (value: unknown) => isObject(value) && "oneOf" in value
const graphSchemaCombiners: CompareTransformResolver = (before, after, ctx) =>
  isRefNode(before) || isRefNode(after) || isUnion(before) || isUnion(after)
    ? [before, after]
    : jsonSchemaCombiners(before, after, ctx)

/**
 * Rules for a GraphApi 0.1.2 schema node. Direction is a scope: operations open `output`, `args` opens `args`;
 * the one rule set serves both.
 */
export const graphApiSchemaRules = (): CompareRules => {
  const graphSchemaRules: CompareRules = jsonSchemaRules({
    notMergeAllOf: true,
    baseRules: {
      compare: graphApiRefsCompareResolver,
      transform: [graphSchemaCombiners, transformJsonSchema(), transformGraphSchema],
      // graphschema extentions
      "/nullable": { $: [nonBreaking, breaking, nonBreaking], annotate: jsonSchemaKeyChange },
      // `format` carries the scalar name: any change is a (nominal) type change
      "/format": { $: nonDirectional(allBreaking as ClassifyTuple), annotate: jsonSchemaKeyChange },
      "/specifiedByURL": { $: allAnnotation },
      "/args": staticRules(() => ({
        ...graphSchemaRules,
        scope: CompareScopes.args,
        $: nonDirectional([nonBreaking, breaking, breaking]),
      })),
      "/default": { $: argumentDefaultClassifyRule, annotate: jsonSchemaKeyChange, compare: valueCompareResolver },
      "/required": {
        mapping: requiredMappingResolver,
        "/*": { $: graphRequiredItemClassifyRule, annotate: schemaKeyItemChange },
      },
      // union members: named types, matched by name (ISSUE-115: not paired by content like JSON Schema branches)
      "/oneOf": {
        $: combinerKeyClassifyRule,
        annotate: jsonSchemaKeyChange,
        mapping: unionMembersMappingResolver,
        "/*": staticRules(() => ({
          ...graphSchemaRules,
          $: unionMemberClassifyRule,
          annotate: unionMemberAnnotation,
          compare: unionMemberCompareResolver,
        })),
      },
      "/properties": {
        "/*": staticRules(() => ({
          ...graphSchemaRules,
          $: graphPropertyClassifyRule,
        })),
      },
      "/values": {
        "/*": {
          $: allAnnotation,
          annotate: valuesAnnotationChange,
          "/description": {
            annotate: valuesAnnotationChange,
            $: allAnnotation,
          },
          // directives applied to an enum value (ISSUE-125)
          "/directives": graphDirectiveUsagesRules,
          "/deprecated": {
            annotate: valuesAnnotationChange,
            $: allDeprecated,
            "/reason": {
              annotate: valuesAnnotationChange,
              $: allDeprecated,
            },
          },
        },
      },
      "/deprecated": {
        $: allDeprecated,
        annotate: schemaStatusChange,
        "/reason": {
          annotate: parentKeyChangeAnnotation,
          $: allDeprecated,
        },
      },
      "/interfaces": graphInterfacesRules,
      "/directives": graphDirectiveUsagesRules,
    },
  })

  return graphSchemaRules
}
