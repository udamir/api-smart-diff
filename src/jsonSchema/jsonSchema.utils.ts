import { type RefNode, parseRef, resolvePointer } from "allof-merge"

import { isRefNode } from "../own"
import type { JsonPath } from "json-crawl"

import { jsonSchemaTypes, jsonSchemaTypeProps, jsonSchemaValidators } from "./jsonSchema.consts"
import type { AllOfNode, JsonSchemaNodeType } from "./jsonSchema.types"
import type { NodeContext } from "../types"
import { excludeKeys, isNumber, isObject } from "../utils"

export function isAllOfNode(value: unknown): value is AllOfNode {
  return isObject(value) && "allOf" in value && Array.isArray(value.allOf)
}

export const resolveRefNode = (data: unknown, node: RefNode) => {
  const { $ref } = node
  const _ref = parseRef($ref)
  return !_ref.filePath ? resolvePointer(data, _ref.pointer) : undefined
}

export const isValidType = (maybeType: unknown): maybeType is JsonSchemaNodeType =>
  typeof maybeType === "string" && jsonSchemaTypes.includes(maybeType as JsonSchemaNodeType)

export function inferTypes(fragment: unknown): string[] {
  if (typeof fragment !== "object" || !fragment) {
    return []
  }

  const types: JsonSchemaNodeType[] = []
  for (const type of Object.keys(jsonSchemaTypeProps) as JsonSchemaNodeType[]) {
    if (type === "integer") {
      continue
    }
    const props = jsonSchemaValidators[type]
    for (const prop of props) {
      if (prop in fragment) {
        types.push(type)
        break
      }
    }
  }
  return types
}

export const isValidSchemaTypes = (types: string[], value: unknown): boolean => {
  if (!isObject(value)) {
    return false
  }

  for (const type of types) {
    if (
      !value.type ||
      (Array.isArray(value.type) && value.type.includes(type)) ||
      value.type === type ||
      type === "any"
    ) {
      return true
    }
  }

  return false
}

export function unwrapStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

export function unwrapArrayOrNull(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

/** JSON pointer of a path with RFC 6901 escaping (`~` → `~0`, then `/` → `~1`). */
export const buildPath = (path: JsonPath): string => {
  return `/${path.map((i) => String(i).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`
}

const isPointerPrefix = (prefix: string, path: string): boolean => {
  if (!path.startsWith(prefix)) {
    return false
  }
  // segment-wise prefix: "#/a" is a prefix of "#/a/b" but not of "#/ab"
  return path.length === prefix.length || path.charAt(prefix.length) === "/" || prefix.endsWith("/")
}

export const isCycleRef = ($ref: string, path: string, refs: Record<string, string[]>) => {
  if (!$ref) {
    return false
  }
  // cycle refs
  // 1. $ref already included in refs
  if (refs[$ref]?.find((p) => isPointerPrefix(p, path))) {
    return true
  }
  // 2. path starts from $ref
  if (isPointerPrefix($ref, path)) {
    return true
  }

  return false
}

export const getCompareId = (beforeRef: string, afterRef: string): string => {
  return beforeRef === afterRef ? beforeRef : `${beforeRef}:${afterRef}`
}

export const resolveRef = (node: unknown, source: unknown) => {
  if (!isRefNode(node)) {
    return node
  }

  return resolveRefNode(source, node)
}

export const getRef = ($ref?: string) => {
  if (!$ref) {
    return ""
  }
  return parseRef($ref).normalized ?? ""
}

export const mergeCombinarySibling = (
  value: Record<string, unknown>,
  combiner: string,
  allowedSibling: string[] = [],
) => {
  const sibling = { ...value }
  const { [combiner]: list, ...allowedProps } = excludeKeys(sibling, [...allowedSibling, combiner])

  if (!Object.keys(sibling).length) {
    return value
  }

  return {
    ...(Array.isArray(list) ? { [combiner]: list.map((item) => ({ allOf: [item, sibling] })) } : sibling),
    ...allowedProps,
  }
}

export const mergeAllOfSibling = (value: Record<string, unknown>, allowedSibling: string[] = []) => {
  const sibling = { ...value }
  const { allOf, ...allowedProps } = excludeKeys(sibling, [...allowedSibling, "allOf"])

  if (!Object.keys(sibling).length) {
    return value
  }

  return {
    ...(Array.isArray(allOf) ? { allOf: [...allOf, sibling] } : sibling),
    ...allowedProps,
  }
}

export const mergeRefSibling = (value: Record<string, unknown>, allowedSibling: string[] = []) => {
  // a plain reference (the common case) has nothing to merge
  let only$ref = true
  for (const key in value) {
    if (key !== "$ref") {
      only$ref = false
      break
    }
  }
  if (only$ref) {
    return value
  }
  const sibling = { ...value }
  const { $ref, ...allowedProps } = excludeKeys(sibling, [...allowedSibling, "$ref"])

  if (!Object.keys(sibling).length) {
    return value
  }

  return {
    allOf: [{ $ref }, sibling],
    ...allowedProps,
  }
}

export const createEmptyCombiner = (
  value: Record<string, unknown>,
  combiner: string,
  allowedSibling: string[] = [],
) => {
  const sibling = { ...value }
  const { [combiner]: list, ...allowedProps } = excludeKeys(sibling, [...allowedSibling])

  return {
    ...allowedProps,
    [combiner]: Object.keys(sibling).length ? [sibling] : [],
  }
}

// keywords of a schema whose value is a map of named subschemas (`$defs` and `dependentSchemas` are not named in the
// property path), a list of subschemas, or one subschema
const NAMED_SCHEMA_MAPS = new Set<unknown>(["$defs", "definitions", "dependentSchemas", "dependencies"])
const SCHEMA_LISTS = new Set<unknown>(["allOf", "anyOf", "oneOf", "prefixItems"])
const SCHEMA_VALUES = new Set<unknown>([
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

/**
 * The property path of a node inside a schema and the index of its last segment, read from `root` (the index of the
 * first segment inside the schema): every segment is read in schema terms (a keyword at a schema position, then the
 * name or index its value is keyed by), and the walk ends at a keyword whose value is not a schema (`enum`, `type`,
 * `discriminator`, an extension, …), so a name never reads as a keyword (ISSUE-300). Without `root` (a rule set that
 * does not mark its schema roots, see `CompareRule.kind`) every segment of the path is scanned for the keywords that
 * name properties, as before 2.0.0.
 */
export const schemaPropertyPath = (path: JsonPath, root?: number): { target: string; last: number } => {
  let target = ""
  let last = -1
  if (root === undefined) {
    for (let i = 0; i < path.length; i++) {
      const step = path[i]
      if (step === "properties" && i < path.length - 1) {
        target += target ? `.${String(path[++i])}` : String(path[++i])
        last = i
      } else if (step === "additionalProperties") {
        target += "{.*}"
        last = i
      } else if (step === "patternProperties" && i < path.length - 1) {
        target += `{${String(path[++i])}}`
        last = i
      } else if (step === "items") {
        if (i < path.length - 1 && isNumber(path[i + 1])) {
          target += `[${path[++i]}]`
        } else {
          target += "[]"
        }
        last = i
      }
    }
    return { target, last }
  }
  last = root - 1
  let i = root
  while (i < path.length) {
    const step = path[i]
    if (step === "properties" || step === "patternProperties") {
      if (i === path.length - 1) {
        // the keyword itself is not part of the described rest (as for a named entry)
        last = i + 1
        break
      }
      const name = String(path[i + 1])
      target += step === "properties" ? (target ? `.${name}` : name) : `{${name}}`
      last = i + 1
      i += 2
    } else if (step === "additionalProperties") {
      target += "{.*}"
      last = i
      i++
    } else if (step === "items") {
      if (i < path.length - 1 && isNumber(path[i + 1])) {
        target += `[${path[i + 1]}]`
        last = i + 1
        i += 2
      } else {
        target += "[]"
        last = i
        i++
      }
    } else if (NAMED_SCHEMA_MAPS.has(step) || SCHEMA_LISTS.has(step)) {
      i += 2
    } else if (SCHEMA_VALUES.has(step)) {
      i++
    } else {
      break
    }
  }
  return { target, last }
}

/**
 * The property path of a node inside a schema (`a.b`, `[]`, `{.*}`, `{pattern}`), `undefined` at the schema itself;
 * `root` is the index of the first segment inside the schema (see `schemaPropertyPath`).
 */
export const getTarget = (path: JsonPath, root?: number): string | undefined =>
  schemaPropertyPath(path, root).target || undefined

/**
 * The number of path segments above the schema a node lies in: the innermost node of its context chain whose rule
 * marks a schema root (`kind: "schema"`); `undefined` when no rule marks one (custom rule sets, GraphApi).
 */
export const schemaRootOf = (ctx: { before: NodeContext }): number | undefined => {
  for (let node: NodeContext | undefined = ctx.before; node; node = node.up) {
    if (node.kind === SCHEMA_KIND) {
      return node.path.length
    }
  }
  return undefined
}

/** The `kind` of a rule at the root of a schema (`CompareRule.kind`). */
export const SCHEMA_KIND = "schema"
