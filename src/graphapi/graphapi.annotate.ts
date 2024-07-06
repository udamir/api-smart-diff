import type { AnnotateHook, ChangeAnnotationResolver } from "../types"
import { createAnnotation, annotationTemplate as t } from "../core"
import { getTarget, jsonSchemaAnnotations } from "../jsonSchema"
import { isArgSchema } from "./graphapi.utils"

const graphSchemaArgAnnotations = {
  add: "[Added] {{text}} to Argument `{{target}}`",
  add_target: "[Added] {{text}} to Argument `{{target}}`",
  add_target_schema: "[Added] {{text}} to Argument `{{target}}` of property `{{schema}}(...)`",
  add_target_directive: "[Added] {{text}} to Argument `{{target}}` of directive `@{{directive}}(...)`",
  remove: "[Removed] {{text}} from Argument {{target}}",
  remove_target: "[Removed] {{text}} from Argument `{{target}}`",
  remove_target_schema: "[Removed] {{text}} from Argument `{{target}}` of property `{{schema}}(...)`",
  remove_target_directive: "[Removed] {{text}} from Argument `{{target}}` of directive `@{{directive}}(...)`",
  replace: "[Replaced] {{text}} of Argument {{target}}",
  replace_target: "[Replaced] {{text}} of Argument `{{target}}`",
  replace_target_schema: "[Replaced] {{text}} of Argument `{{target}}` of property `{{schema}}(...)`",
  replace_target_directive: "[Replaced] {{text}} of Argument `{{target}}` of directive `@{{directive}}(...)`",
}

const graphApiAnnotations = {
  ...jsonSchemaAnnotations,

  directive: "directive `@{{key}}`",
  directive_definition: "difinition for directive `@{{key}}`",
  directive_meta: "directive meta `@{{key}}({{meta}})`",
  values_annotation: "possible values annotation ({{key}})",
  values_status: "possible values {{key}} status",
}

export const graphApiAnnotateHook: AnnotateHook = (diff, ctx) => {
  const annotate = ctx.rules?.annotate

  if (!annotate || (diff.path[0] === "components" && diff.path[1] !== "directives")) {
    return ""
  }
  if (isArgSchema(diff.path)) {
    const argsIndex = diff.path.indexOf("args")
    const _diff = { ...diff, path: diff.path.slice(argsIndex) }
    const schema = getTarget(diff.path.slice(0, argsIndex))
    const directive = diff.path[1] === "directives" ? diff.path[2] : undefined

    const schemaChangeTemplate = annotate(_diff, ctx)
    if (!schemaChangeTemplate) {
      return ""
    }

    const argsTemplate = { ...schemaChangeTemplate, params: { ...schemaChangeTemplate.params, schema, directive } }
    return createAnnotation(argsTemplate, { ...graphApiAnnotations, ...graphSchemaArgAnnotations })
  }

  return createAnnotation(annotate(diff, ctx), graphApiAnnotations)
}

export const valuesAnnotationChange: ChangeAnnotationResolver = ({ path, action }, ctx) => {
  const key = path[path.length - 1]
  const target = getTarget(path.slice(0, -4))
  // TODO
  switch (key) {
    case "description":
      return t(action, { text: t("values_annotation", { key }), target })
    case "deprecated":
      return t(action, { text: t("values_status", { key }), target })
    case "reason":
      return t(action, { text: t("values_annotation", { key: "deprecation reason" }), target })
  }
}

export const parentKeyChangeAnnotation: ChangeAnnotationResolver = ({ path, action }, ctx) => {
  const key = path[path.length - 1]
  const parentKey = path[path.length - 2]
  const target = getTarget(path)

  switch (parentKey) {
    case "directives":
      return t(action, { text: t("directive", { key, definition: path[0] === "components" ? 1 : undefined }), target })
    case "deprecated":
      return t(action, { text: t("reason", { key }), target })
    case "meta":
      return t(action, {
        text: t("directive", { key: path[path.length - 3], meta: key }),
        target: getTarget(path.slice(0, -4)),
      })
  }
}
