import type { AnnotateHook, ChangeAnnotationResolver } from "../types"
import { createAnnotation, annotationTemplate as t } from "../core"
import { getTarget } from "./jsonSchema.utils"
import { isNumber, isString } from "../utils"

export const jsonSchemaAnnotations = {
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
  additionalProperties: "schema for additional properties",
  arrayItems: "schema for array items",
  additionalArrayItems: "schema for additional array items",
  oneOfItem: "oneOf schema",
  anyOfItem: "anyOf schema",
  allOfItem: "allOf schema",
} as const

export const jsonSchemaAnnotationHook: AnnotateHook = (diff, ctx) => {
  const annotate = ctx.rules?.annotate

  if (!annotate) {
    return ""
  }

  return createAnnotation(annotate(diff, ctx), jsonSchemaAnnotations)
}

export const schemaAnnotationChange: ChangeAnnotationResolver = ({
  action,
  path,
}) => {
  const key = path[path.length - 1]

  return {
    template: action,
    params: {
      text: { template: "annotation", params: { key } },
      target: getTarget(path),
    },
  }
}

export const schemaExampleChange: ChangeAnnotationResolver = ({
  action,
  path,
}) => {
  const key = path[path.length - 1]

  return t(action, {
    text: t("annotation", { key: "example" }),
    target: getTarget(path),
  })
}

export const schemaValidationChange: ChangeAnnotationResolver = ({
  action,
  path,
}) => {
  const key = path[path.length - 1]

  return t(action, { text: t("validation", { key }), target: getTarget(path) })
}

export const schemaStatusChange: ChangeAnnotationResolver = ({ path }, ctx) => {
  const key = path[path.length - 1]

  if (ctx.after.value) {
    return t("add", { text: t("status", { key }), target: getTarget(path) })
  }
  if (ctx.before.value) {
    return t("remove", { text: t("status", { key }), target: getTarget(path) })
  }
}

export const jsonSchemaKeyChange: ChangeAnnotationResolver = ({
  action,
  path,
}) => {
  const key = path[path.length - 1]

  if (isNumber(key)) {
    return
  }

  return t(action, { target: getTarget(path), text: t(key) })
}

export const schemaKeyItemChange: ChangeAnnotationResolver = (
  { action, path },
  ctx,
) => {
  const key = path[path.length - 1]
  const { value } = action === "add" ? ctx.after : ctx.before
  const parentKey = path.length > 1 ? path[path.length - 2] : ""
  const parentTarget = getTarget(path.slice(0, -1))
  const target = getTarget(path)

  switch (parentKey) {
    case "enum":
      return t("replace", { text: t("enum"), target })
    case "properties":
      return isString(key)
        ? t(action, { text: t("property", { key }), target: parentTarget })
        : undefined
    case "items":
      return isNumber(key)
        ? t(action, { text: t("arratItem", { key }), target: parentTarget })
        : undefined
    case "patternProperties":
      return isString(key)
        ? t(action, {
            text: t("patternProperty", { key }),
            target: parentTarget,
          })
        : undefined
    case "oneOf":
    case "anyOf":
    case "allOf":
      return t(action, { text: t(`${parentKey}Item`), target })
    case "required":
      return isString(value)
        ? t(action, {
            text: t("status", { key: parentKey }),
            target: target ? `${target}.${value}` : value,
          })
        : undefined
  }
  return
}
