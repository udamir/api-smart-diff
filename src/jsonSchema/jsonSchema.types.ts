
import { jsonSchemaTypes, jsonSchemaVersion } from "./jsonSchema.consts"
import type { CompareRule } from "../types"

export type JsonSchemaNodeType = typeof jsonSchemaTypes[number]

export type JsonSchemaVersion = typeof jsonSchemaVersion[number]

export type JsonSchemaRulesOptions = {
  rootRule?: CompareRule
  draft?: JsonSchemaVersion
  reversClassifier?: boolean
}

