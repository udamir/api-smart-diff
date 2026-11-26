import type {
  AnnotateTemplate,
  CompareContext,
  CompareExtensionRules,
  CompareResolver,
  CompareRules,
  Diff,
  MappingResolver,
  NodeContext,
} from "../types"
import { annotationTemplate as t, formatValue } from "./annotate"
import { compareNested } from "./compare"
import { equalKeysShortcut, identityOnEqualKeys, objectMappingResolver } from "./mapping"
import { allAnnotation } from "./constants"
import { mergeExtensionRules } from "./rules"

/** Prefix of specification extensions (`x-*`) in OpenAPI and AsyncAPI documents. */
export const EXTENSION_PREFIX = "x-"

export const isExtensionKey = (key: unknown): boolean => typeof key === "string" && key.startsWith(EXTENSION_PREFIX)

/**
 * Template of a change inside an extension: `extension` is the index of the extension key in `diff.path` (the
 * extension node itself when it is the last segment). The spec annotate hooks render it with their dictionaries,
 * which all define `extension`, `extensionProperty` and `extensionValue`.
 */
export type ExtensionAnnotationResolver = (
  diff: Diff,
  ctx: CompareContext,
  extension: number,
) => AnnotateTemplate | undefined

/** The text part of an extension change: the extension key, or the nested property / value inside its value. */
export const extensionChangeText = (diff: Diff, ctx: CompareContext, extension: number): AnnotateTemplate => {
  const { path, action } = diff
  const key = String(path[extension])
  const nested = path.slice(extension + 1)
  if (!nested.length) {
    return t("extension", { key })
  }
  const last = nested[nested.length - 1]
  if (typeof last === "number") {
    const { value } = action === "add" ? ctx.after : ctx.before
    return t("extensionValue", { key, value: formatValue(value) })
  }
  return t("extensionProperty", { key, property: nested.join(".") })
}

/** An extension change described with a target (a template or a plain string) located by the spec. */
export const extensionChangeAnnotation =
  (
    target?: (diff: Diff, ctx: CompareContext, extension: number) => AnnotateTemplate | string | undefined,
  ): ExtensionAnnotationResolver =>
  (diff, ctx, extension) =>
    t(diff.action, {
      text: extensionChangeText(diff, ctx, extension),
      target: target?.(diff, ctx, extension) as AnnotateTemplate | string | undefined,
    })

// position of the extension key in the path of the node being described (the node itself for its own diffs)
const ownPosition = (diff: Diff) => diff.path.length - 1

/** `NodeContext.kind` of an extension node (set by the built-in extension rule, inherited by custom exact entries). */
const EXTENSION_KIND = "extension"

// position of the extension key in the path of a node inside an extension value that is walked with child rules (a
// custom entry with `compare: undefined`): the nearest enclosing node of the extension kind, counted from the end of the
// diff path, so that a path rebased to a usage location is counted the same way (ISSUE-418: the last segment was taken
// as the extension key, "[Removed] extension `2`")
const nestedPosition = (diff: Diff, ctx: CompareContext): number => {
  for (const start of [ctx.after, ctx.before]) {
    let steps = 0
    for (let node: NodeContext | undefined = start; node; node = node.up, steps++) {
      if (node.kind === EXTENSION_KIND) {
        return diff.path.length - 1 - steps
      }
    }
  }
  return ownPosition(diff)
}

/**
 * The extension value is compared with an isolated rule tree: every nested key is an annotation described through
 * the extension, whatever rules the enclosing node defines for keys of that name (the prefix rule is merged over the
 * sibling `/*` rule, so without isolation its exact child rules would leak into the extension value).
 */
const isolatedCompare =
  (annotate: ExtensionAnnotationResolver): CompareResolver =>
  (ctx) => {
    const position = ctx.before.path.length - 1
    const node: CompareRules = {
      $: ctx.rules.$ ?? allAnnotation,
      annotate: (diff, nested) => annotate(diff, nested, position),
    }
    node["/*"] = node
    return compareNested(ctx, ctx.before.value, ctx.after.value, { rules: node })
  }

/**
 * The built-in rule of an `x-*` key: an annotation (POLICY-06 / POLICY-07: also `x-sunset`, `x-stability-level`)
 * described with the extension key, nested values covered (ISSUE-73). Fields the enclosing `/*` rule would contribute
 * (transforms, mapping, compare, scope) are reset, so a map entry rule never applies to an extension (ISSUE-54).
 */
export const extensionRule = (annotate: ExtensionAnnotationResolver): CompareRules => {
  const nested: CompareRules = {
    $: allAnnotation,
    annotate: (diff, ctx) => annotate(diff, ctx, nestedPosition(diff, ctx)),
  }
  return {
    $: allAnnotation,
    annotate: (diff, ctx) => annotate(diff, ctx, ownPosition(diff)),
    compare: isolatedCompare(annotate),
    transform: undefined,
    mapping: undefined,
    scope: undefined,
    skip: undefined,
    kind: EXTENSION_KIND,
    "/*": nested,
    "/**": nested,
  } as CompareRules
}

/** Rule key of the built-in extension prefix rule. */
export const EXTENSION_RULE_KEY = `/${EXTENSION_PREFIX}*` as const

/**
 * The extension rules spread into every object node that allows specification extensions: the built-in `"/x-*"`
 * prefix rule merged key-wise with custom entries in json-crawl 1.x syntax (an exact key such as
 * `"/x-extensible-enum"` is merged over the `"/x-*"` rule, a longer prefix such as `"/x-internal-*"` replaces it for
 * its keys, a custom `"/x-*"` entry overrides the built-in fields). A custom entry that defines `compare` (even as
 * `undefined`) opts out of the isolated comparison and walks the extension value with its own child rules.
 */
export const extensionRules = (annotate: ExtensionAnnotationResolver, custom?: CompareExtensionRules): CompareRules =>
  mergeExtensionRules({ [EXTENSION_RULE_KEY]: extensionRule(annotate) }, custom) as CompareRules

/**
 * Wraps a mapping resolver of a map object whose entries are not extensions (paths, responses, callbacks): `x-*`
 * keys are matched by name only and never reach the entry matching (ISSUE-54).
 */
export const excludeExtensions = (
  resolver: MappingResolver<string> = objectMappingResolver,
): MappingResolver<string> => {
  const excluding: MappingResolver<string> = (before, after, ctx) => {
    const bKeys = Object.keys(before)
    const aKeys = Object.keys(after)
    if (!bKeys.some(isExtensionKey) && !aKeys.some(isExtensionKey)) {
      return resolver(before, after, ctx)
    }
    const strip = (value: Record<string, unknown>) => {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(value)) {
        if (!isExtensionKey(key)) {
          result[key] = value[key]
        }
      }
      return result
    }
    const inner = resolver(strip(before), strip(after), ctx)
    const result = { added: [...inner.added], removed: [...inner.removed], mapped: { ...inner.mapped } }
    for (const key of bKeys) {
      if (isExtensionKey(key)) {
        if (key in after) {
          result.mapped[key] = key
        } else {
          result.removed.push(key)
        }
      }
    }
    for (const key of aKeys) {
      if (isExtensionKey(key) && !(key in before)) {
        result.added.push(key)
      }
    }
    return result
  }
  // without extension keys the resolver alone maps the keys
  return equalKeysShortcut(resolver) === null ? identityOnEqualKeys(excluding, isExtensionKey) : excluding
}
