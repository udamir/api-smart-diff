import type { JsonPath } from "json-crawl"

import type { CompareExtensionRules, CompareOptions, CompareResult, CompareRules } from "../types"
import type { jsonSchemaTypes } from "./jsonSchema.consts"

export type JsonSchemaNodeType = (typeof jsonSchemaTypes)[number]

// schema dialect: draft-04 (boolean exclusive bounds, used by OpenAPI 3.0), draft-06/07 and 2020-12
export type JsonSchemaDraft = "draft-04" | "draft-06" | "draft-07" | "2020-12"

export type JsonSchemaRulesOptions = {
  version?: JsonSchemaDraft
  baseRules?: CompareRules
  notMergeAllOf?: boolean
  // custom prefix rules for `x-*` keywords, merged key-wise over the built-in `x-` rule
  extensions?: CompareExtensionRules
  // kept for compatibility: the `$ref` cache now lives in the compare session
  cache?: JsonSchemaCompareCache
}

export type AllOfNode = {
  allOf: any[]
  [key: string]: any
}

export type JsonSchemaCompareOptions = CompareOptions & {
  notMergeAllOf?: boolean // do not merge allOf combiners before compare
  version?: JsonSchemaDraft // schema dialect (default: detected from `$schema`, else 2020-12)
}

export type CompareResultCache = CompareResult & {
  path: JsonPath
}

export type JsonSchemaCompareCache = {
  results?: Map<string, CompareResultCache>
  bRefs?: Record<string, string[]>
  aRefs?: Record<string, string[]>
}
