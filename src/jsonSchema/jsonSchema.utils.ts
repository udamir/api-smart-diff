import { isRefNode, parseRef, resolveRefNode } from "allof-merge"
import { JsonPath } from "json-crawl"

import { jsonSchemaTypes, jsonSchemaTypeProps, jsonSchemaValidators } from "./jsonSchema.consts"
import type { JsonSchemaNodeType } from "./jsonSchema.types"

export function isAllOfNode(value: any): value is { allOf: any[] } {
  return value && value.allOf && Array.isArray(value.allOf)
}

export const isValidType = (maybeType: unknown): maybeType is JsonSchemaNodeType =>
  typeof maybeType === "string" && jsonSchemaTypes.includes(maybeType as JsonSchemaNodeType)

export function inferTypes(fragment: unknown): JsonSchemaNodeType[] {
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
