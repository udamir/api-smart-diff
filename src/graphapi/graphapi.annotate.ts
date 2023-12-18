import { createAnnotation, annotationTemplate as t } from "../utils"
import { getTarget, jsonSchemaAnnotations } from "../jsonSchema"
import { isArgSchema } from "./graphapi.utils"
import type { AnnotateHook } from "../types"

const graphSchemaArgAnnotations = {
  add: "[Added] {{text}} to Argument `{{target}}`",
  add_target: "[Added] {{text}} to Argument `{{target}}`",
  add_target_schema: "[Added] {{text}} to Argument `{{target}}` of property`{{schema}}`",
  remove: "[Removed] {{text}} from Argument {{target}}",
  remove_target: "[Removed] {{text}} from Argument `{{target}}`",
  remove_target_schema: "[Removed] {{text}} from Argument `{{target}}` of property `{{schema}}`",
  replace: "[Replaced] {{text}} of Argument {{target}}",
  replace_target: "[Replaced] {{text}} of Argument `{{target}}`",
  replace_target_schema: "[Replaced] {{text}} of Argument `{{target}}` of property `{{schema}}`",
}

const graphApiAnnotations = {
  ...jsonSchemaAnnotations,
}

export const graphApiAnnotateHook: AnnotateHook = (diff, ctx) => {
  let annotate = ctx.rules?.annotate

  if (!annotate || diff.path[0] === "components") { return "" }
  if (isArgSchema(diff.path)) {
    const argsIndex = diff.path.indexOf("args")
    const _diff = { ...diff, path: diff.path.slice(argsIndex) }
    const schema = getTarget(diff.path.slice(0, argsIndex))

    const schemaChangeTemplate = annotate(_diff, ctx)
    if (!schemaChangeTemplate) { return "" }

    const argsTemplate = { ...schemaChangeTemplate, params: { ...schemaChangeTemplate.params, schema }}
    return createAnnotation(argsTemplate, { ...jsonSchemaAnnotations, ...graphSchemaArgAnnotations })
  } 

  return createAnnotation(annotate(diff, ctx), graphApiAnnotations)
}
