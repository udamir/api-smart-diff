import { graphapiMergeRules, merge } from "allof-merge"

import type { CompareTransformResolver } from "../types"
import { getSessionMerger } from "../jsonSchema/jsonSchema.transform"

import { graphApiComponents, graphApiOperations, graphSchemaCustomProps } from "./graphapi.const"
import { compareTransformationFactory } from "../core"

export const transformGraphApiComponents = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }
  const result: any = { ...value }

  for (const comp of Object.values(graphApiComponents)) {
    // add empty component
    if (!(comp in value) && comp in other) {
      result[comp] = {}
    }
  }

  return result
})

export const transformGraphSchema = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }
  const { nullable, ...result }: any = { ...value }

  for (const comp of graphSchemaCustomProps) {
    // add empty component; an absent `args` is an empty arguments object (`type: object` is not inferred from the
    // other side's validators any more, POLICY-21); `interfaces` is a list
    if (!(comp in value) && comp in other) {
      result[comp] = comp === "args" ? { type: "object", properties: {} } : comp === "interfaces" ? [] : {}
    }

    // add empty values items (on a copy: the input must not be mutated); the metadata of a value that exists on one
    // side only is the other side's: the value itself is reported by `enum` (ISSUE-119, GQL-DEP-016)
    if (comp === "values" && comp in other) {
      const items = other[comp] as Record<string, unknown>
      const own = (value as Record<string, unknown>).enum
      const ownValues = Array.isArray(own) ? (own as unknown[]) : []
      const values = { ...result[comp] }
      for (const item of Object.keys(items)) {
        if (item in values) {
          continue
        }
        values[item] = ownValues.includes(item) ? {} : items[item]
      }
      result[comp] = values
    }
  }

  if (nullable) {
    result.nullable = nullable
  }

  return result
})

export const transformGraphSchemaDirective = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }

  // the usage's arguments and its further usages (`repeats`, a repeatable directive applied several times, gqlapi 0.6,
  // ISSUE-126); the `$ref` is the key
  const result: Record<string, unknown> = {}
  for (const key of ["meta", "repeats"] as const) {
    if (key in value) {
      result[key] = (value as Record<string, unknown>)[key]
    } else if (key in other) {
      result[key] = key === "meta" ? {} : []
    }
  }
  return result
})

export const transformGraphApiDocument = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }
  const result: any = { ...value }

  for (const comp of Object.values(graphApiOperations)) {
    // add empty component
    if (!(comp in value) && comp in other) {
      result[comp] = {}
    }
  }

  return result
})

export const transformGraphApiDirective = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }
  const result: any = { ...value }

  // add empty args object
  if (!("args" in value) && "args" in other) {
    result.args = {
      type: "object",
      properties: {},
    }
  }

  // add empty location array
  if (!("locations" in value) && "locations" in other) {
    result.locations = []
  }

  return result
})

// allOf merge with the session's per-document merger (refs resolved against the document root, results memoized).
// A `$ref` with siblings (`{ $ref, nullable, description, args }`, a field typed by a named type) is not inlined: the
// usage is nominal and the named type is compared once, at its declaration (ISSUE-53); inlining it at every usage
// turned the type graph into the tree of all its acyclic paths.
const mergeOptions = { mergeCombinarySibling: false, mergeRefSibling: false }

export const graphApiMergeAllOf: CompareTransformResolver = (before, after, ctx) => {
  if (!ctx) {
    return [
      merge(before, { rules: graphapiMergeRules, ...mergeOptions }),
      merge(after, { rules: graphapiMergeRules, ...mergeOptions }),
    ]
  }
  return [
    getSessionMerger(ctx.session, ctx.before.root, graphapiMergeRules, mergeOptions).merge(before, {
      source: ctx.before.root,
    }),
    getSessionMerger(ctx.session, ctx.after.root, graphapiMergeRules, mergeOptions).merge(after, {
      source: ctx.after.root,
    }),
  ]
}
