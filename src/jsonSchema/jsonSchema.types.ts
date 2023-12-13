
import { JsonPath } from "json-crawl"

import type { ComapreOptions, CompareResult, DiffContext, TemplateFunc } from "../types"
import { jsonSchemaTypes } from "./jsonSchema.consts"

export type JsonSchemaNodeType = typeof jsonSchemaTypes[number]

export type JsonSchemaRulesOptions = {
  notMergeAllOf?: boolean
}

export type AnnotationContext = DiffContext & {
  t: TemplateFunc
  target: string | undefined
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
