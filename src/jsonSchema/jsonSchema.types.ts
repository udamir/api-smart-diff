
import { jsonSchemaTypes, jsonSchemaVersion } from "./jsonSchema.consts"
import { ComapreRule } from "../types"

export type JsonSchemaNodeType = typeof jsonSchemaTypes[number]

export type JsonSchemaVersion = typeof jsonSchemaVersion[number]

export type JsonSchemaRulesOptions = {
  rootRule?: ComapreRule
  draft?: JsonSchemaVersion
  reversClassifier?: boolean
}

