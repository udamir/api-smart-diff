import { isRefNode, parseRef, resolveRefNode } from "allof-merge"
import type { JsonPath } from "json-crawl"

import { jsonSchemaTypes, jsonSchemaTypeProps, jsonSchemaValidators } from "./jsonSchema.consts"
import type { AllOfNode, JsonSchemaNodeType } from "./jsonSchema.types"
import { excludeKeys, isObject } from "../utils"
import type { Diff } from "../types"

export function isAllOfNode(value: any): value is AllOfNode {
  return value && value.allOf && Array.isArray(value.allOf)
}

export const isValidType = (maybeType: unknown): maybeType is JsonSchemaNodeType =>
  typeof maybeType === "string" && jsonSchemaTypes.includes(maybeType as JsonSchemaNodeType)

export function inferTypes(fragment: unknown): string[] {
  if (typeof fragment !== 'object' || !fragment) { return [] }

  const types: JsonSchemaNodeType[] = []
  for (const type of Object.keys(jsonSchemaTypeProps) as JsonSchemaNodeType[]) {
    if (type === "integer") { continue }
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
  if (!isObject(value)) { return false }

  for (const type of types) {
    if (!value.type || Array.isArray(value.type) && value.type.includes(type) || value.type === type || type === "any") {
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

export const buildPath = (path: JsonPath): string => {
  return "/" + path.map((i) => String(i).replace(new RegExp("/", "g"), "~1")).join("/")
}

export const isCycleRef = ($ref: string, path: string, refs: Record<string, string[]>) => {
  if (!$ref) { return false }
  // cycle refs
  // 1. $ref already included in refs
  if (refs[$ref]?.find((p) => path.startsWith(p))) {
    return true
  }
  // 2. path starts from $ref
  if (path.startsWith($ref)) {
    return true
  }

  return false
}

export const getCompareId = (beforeRef: string, afterRef: string): string => {
  return beforeRef === afterRef ? beforeRef : `${beforeRef}:${afterRef}`
}

export const resolveRef = (node: unknown, source: unknown) => {
  if (!isRefNode(node)) { return node }

  return resolveRefNode(source, node)
}

export const getRef = ($ref?: string) => {
  if (!$ref) { return "" }
  return parseRef($ref).normalized ?? ""
}

export const changeDiffsPath = (diffs: Diff[], path: JsonPath = [], newPath: JsonPath = []): Diff[] => {
  return diffs.map((diff) => ({ ...diff, path: [...newPath, ...diff.path.slice(path.length)] }))
}

export const mergeCombinarySibling = (value: Record<string, unknown>, combiner: string, allowedSibling: string[] = []) => {
  const sibling = { ...value }
  const { [combiner]: list, ...allowedProps } = excludeKeys(sibling, [...allowedSibling, combiner])

  if (!Object.keys(sibling).length) {
    return value
  }

  return {
    ...Array.isArray(list) ? { [combiner]: list.map((item) => ({ allOf: [item, sibling] })) } : sibling,
    ...allowedProps
  }
}

export const mergeAllOfSibling = (value: Record<string, unknown>, allowedSibling: string[] = []) => {
  const sibling = { ...value }
  const { allOf, ...allowedProps } = excludeKeys(sibling, [...allowedSibling, "allOf"])

  if (!Object.keys(sibling).length) {
    return value
  }

  return {
    ...Array.isArray(allOf) ? { allOf: [...allOf, sibling] } : sibling,
    ...allowedProps
  }
}

export const mergeRefSibling = (value: Record<string, unknown>, allowedSibling: string[] = []) => {
  const sibling = { ...value }
  const { $ref, ...allowedProps } = excludeKeys(sibling, [...allowedSibling, "$ref"])

  if (!Object.keys(sibling).length) {
    return value
  }

  return {
    allOf: [{ $ref }, sibling],
    ...allowedProps
  }
}

export const createEmptyCombiner = (value: Record<string, unknown>, combiner: string, allowedSibling: string[] = []) => {
  const sibling = { ...value }
  const { [combiner]: list, ...allowedProps } = excludeKeys(sibling, [...allowedSibling])

  return { 
    ...allowedProps,
    [combiner]: Object.keys(sibling).length ? [sibling] : [],
  }
}
