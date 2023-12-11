
import { jsonSchemaTypes, jsonSchemaVersion } from "./jsonSchema.consts"
import type { CompareTransformResolver, DiffContext } from "../types"

export type JsonSchemaNodeType = typeof jsonSchemaTypes[number]

export type JsonSchemaVersion = typeof jsonSchemaVersion[number]

export type JsonSchemaRulesOptions = {
  transform?: CompareTransformResolver[]
  draft?: JsonSchemaVersion
  mergeAllOf?: boolean
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
