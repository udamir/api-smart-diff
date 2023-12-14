import type { JsonPath } from "json-crawl"

import type { ChangeAnnotationResolver, ComapreContext } from "../types"
import { isNumber, isString, createTemplateFunc } from "../utils"
import type { AnnotationContext } from "./jsonSchema.types"

const jsonSchemaAnnotations = {
  add: "[Added] {{text}}",
  add_target: "[Added] {{text}} to `{{target}}`",
  remove: "[Removed] {{text}}",
  remove_target: "[Removed] {{text}} from `{{target}}`",
  replace: "[Replaced] {{text}}",
  replace_target: "[Replaced] {{text}} of `{{target}}`",
  rename: "[Renamed] {{text}}",
  rename_target: "[Renamed] {{text}} of `{{target}}`",
  status: "{{key}} status",
  validation: "{{key}} validator", 
  annotation: "annotation ({{key}})",
  enum: "possible values",
  format: "value format",
  default: "default value",
  const: "possible value",
  type: "type definition",
  nullable: "possbile nullable value",
  property: "property `{{key}}`",
  arratItem: "array item with index `{{key}}`",
  patternProperty: "property with key pattern `{{key}}`",
  additionalProperties: `schema for additional properties`,
  arrayItems: `schema for array items`,
  additionalArrayItems: `schema for additional array items`,
  oneOfItem: `oneOf schema`,
  anyOfItem: `anyOf schema`,
  allOfItem: `allOf schema`,
} as const

const getTarget = (path: JsonPath, prefix = ""): string | undefined => {
  for (let i = 0; i < path.length; i++) {
    if (path[i] === "properties" && i < path.length - 1) {
      prefix += prefix ? "." + String(path[++i]) : String(path[++i]) 
    } else if (path[i] === "additionalProperties") {
      prefix += "{.*}" 
    } else if (path[i] === "patternProperties" && i < path.length - 1) {
      prefix += `{${String(path[++i])}}` 
    } else if (path[i] === "items") {
      if ((i < path.length - 1) && isNumber(path[i+1])) {
        prefix += `[${path[++i]}]`
      } else {
        prefix += "[]"
      }
    }
  }
  return prefix ? prefix : undefined
}

const getDiffContext = (action: string, ctx: ComapreContext): AnnotationContext => {
  const _ctx = action === "add" ? ctx.after : ctx.before

  return {
    ..._ctx,
    t: createTemplateFunc(ctx.options.dictionary?.jsonSchema ?? jsonSchemaAnnotations),
    target: getTarget(_ctx.path)
  }
}

export const schemaAnnotationChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { t, key, target } = getDiffContext(diff.action, ctx)

  return t(diff.action, { text: t("annotation", { key }), target })
}

export const schemaExampleChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { t, target } = getDiffContext(diff.action, ctx)

  return t(diff.action, { text: t("annotation", { key: "example" }), target })
}

export const schemaValidationChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, t, target } = getDiffContext(diff.action, ctx)

  return t(diff.action, { text: t("validation", { key }), target })
}

export const schemaStatusChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { t, key, target } = getDiffContext(diff.action, ctx)

  if (ctx.after.value) {
    return t("add", { text: t("status", { key }), target })
  } else if (ctx.before.value) {
    return t("remove", { text: t("status", { key }), target })
  }
  return ""
}

export const jsonSchemaKeyChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { t, key, target } = getDiffContext(diff.action, ctx)

  if (isNumber(key)) { return "" }

  return t(diff.action, { target, text: t(key) })
}

export const schemaParentKeyChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, path, target, t } = getDiffContext(diff.action, ctx)
  const parentKey = path.length > 1 ? path[path.length-2] : ""
  const parentTarget = getTarget(path.slice(0, -1))
  switch (parentKey) {
    case "enum": 
      return t("replace", { text: t("enum"), target })
    case "properties": 
      return isString(key) ? t(diff.action, { text: t("property", { key }), target: parentTarget }) : "" 
    case "items": 
      return isNumber(key) ? t(diff.action, { text: t("arratItem", { key }), target: parentTarget }) : "" 
    case "patternProperties": 
      return isString(key) ? t(diff.action, { text: t("patternProperty", { key }), target: parentTarget}) : "" 
    case "oneOf": case "anyOf": case "allOf": 
      return t(diff.action, { text: t(`${parentKey}Item`), target })
  }
  return ""
}

export const schemaRequiredChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, target, t, value } = getDiffContext(diff.action, ctx)
  if (!isString(value)) { return "" }

  const key = path.length > 1 ? path[path.length-2] : ""
  const childTarget = target ? `${target}.${value}` : value
 
  return t(diff.action, { text: t("status", { key }), target: childTarget })
}
