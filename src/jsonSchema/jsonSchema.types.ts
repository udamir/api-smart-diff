
import { JsonPath } from "json-crawl"

import type { ComapreOptions, CompareResult, DiffContext } from "../types"
import { jsonSchemaTypes } from "./jsonSchema.consts"

export type JsonSchemaNodeType = typeof jsonSchemaTypes[number]

export type JsonSchemaRulesOptions = {
  notMergeAllOf?: boolean
}

export type ChangeAnnotation = [string, string, string]

export type AnnotationContext = DiffContext & {
  action: number
  target: string
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
