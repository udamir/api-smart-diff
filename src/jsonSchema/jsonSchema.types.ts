
import type { JsonPath } from "json-crawl"

import type { ComapreOptions, CompareResult, CompareRules } from "../types"
import type { jsonSchemaTypes } from "./jsonSchema.consts"

export type JsonSchemaNodeType = typeof jsonSchemaTypes[number]

export type JsonSchemaRulesOptions = {
  version?: "draft-04" | "2020-12"
  baseRules?: CompareRules
  notMergeAllOf?: boolean
  cache?: JsonSchemaComapreCache
}

export type AllOfNode = {
  allOf: any[]
  [key: string]: any
}

export type JsonSchemaCompareOptions = ComapreOptions & {
  notMergeAllOf?: boolean           // do not merge allOf combiners before compare
}

export type CompareResultCache = CompareResult & {
  path: JsonPath
}

export type JsonSchemaComapreCache = {
  results?: Map<string, CompareResultCache>
  bRefs?: Record<string, string[]>
  aRefs?: Record<string, string[]>
}
