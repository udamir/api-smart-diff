
import { jsonSchemaTypes, jsonSchemaVersion } from "./jsonSchema.consts"
import type { CompareTransformResolver } from "../types"

export type JsonSchemaNodeType = typeof jsonSchemaTypes[number]

export type JsonSchemaVersion = typeof jsonSchemaVersion[number]

export type JsonSchemaRulesOptions = {
  transform?: CompareTransformResolver[]
  draft?: JsonSchemaVersion
  writer?: boolean
}

