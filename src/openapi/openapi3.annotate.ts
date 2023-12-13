import { isParameterPath, isRequestBodyPath, isResponsePath } from "./openapi3.utils"
import type { ChangeAnnotationResolver, ComapreContext, Diff } from "../types"
import { getObjectValue, createTemplateFunc } from "../utils"

const openApiAnnotations = {
  requestBodySchema: "{{schemaChange}} in Request body content ({{contentType}})",
  responseSchema: "{{schemaChange}} in Response ${responseCode} content ({{contentType}})",
  parameterSchema: "{{schemaChange}} in {{in}} parameter `{{name}}`",

  add: "[Added] {{text}}",
  add_target: "[Added] {{text}} to `{{target}}`",
  remove: "[Removed] {{text}}",
  remove_target: "[Removed] {{text}} from `{{target}}`",
  replace: "[Replaced] {{text}}",
  replace_target: "[Replaced] {{text}} of `{{target}}`",
  rename: "[Renamed] {{text}}",
  rename_target: "[Renamed] {{text}} of `{{target}}`",

  param: "{{in}} parameter `{{name}}`",
  param_required: "required {{in}} parameter `{{name}}`",
  status: "{{key}} status",
  method: "operation {{method}} {{path}}",
  annotation: "annotation ({{key}})",
  security: "some security details",
}

export const openApiKeyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const key = diff.path[diff.path.length-1]
  switch (key) {

  }
  return ""
}

export const openApiParentKeyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const key = diff.path[diff.path.length-1]
  switch (key) {

  }
  return ""
}

export const pathMethodChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const t = createTemplateFunc(ctx.options.dictionary?.openapi ?? openApiAnnotations)

  return t(diff.action, { text: t("method", { path: diff.path[1], method: String(diff.path[2]).toUpperCase() }) })
}

export const documentChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const t = createTemplateFunc(ctx.options.dictionary?.openapi ?? openApiAnnotations)

  return t(diff.action, { text: t("method", { path: diff.path[1], method: String(diff.path[2]).toUpperCase() }) })
}

export const operationSecurityChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const t = createTemplateFunc(ctx.options.dictionary?.openapi ?? openApiAnnotations)

  return t(diff.action, { text: t("security") })
}

export const operationChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const t = createTemplateFunc(ctx.options.dictionary?.openapi ?? openApiAnnotations)
  const key = diff.path[diff.path.length-1]

  if (key === "deprecated") {
    if (ctx.after.value) {
      return t("add", { text: t("status", { key }) })
    } else if (ctx.before.value) {
      return t("remove", { text: t("status", { key }) })
    }
    return ""
  }

  if (typeof key === "number") {
    const { value } = diff.action === "add" ? ctx.after : ctx.before
    return t(diff.action, { text: t("annotation", { key: `${diff.path[diff.path.length-2]}: ${value}` }) })
  }

  return t(diff.action, { text: t("annotation", { key }) })
}

export const parameterChangeAnnotation: ChangeAnnotationResolver = (diff, ctx): string => {
  const t = createTemplateFunc(ctx.options.dictionary?.openapi ?? openApiAnnotations)
  const key = diff.path[diff.path.length-1]

  const { path, root } = diff.action === "add" ? ctx.after : ctx.before
  const paramPath = path.slice(0, path[2] === "parameters" ? 4 : 5)
  const param = getObjectValue(root, ...paramPath)

  if (key === "required" || key === "deprecated") {
    return t(diff.action, { text: t("status", { key }), target: t("param", param) })
  } else {
    return t(diff.action, { text: t("param", param) })
  }
}

export const openApiSchemaAnnotate = (resolver: ChangeAnnotationResolver): ChangeAnnotationResolver => {
  return (diff: Diff, ctx: ComapreContext): string => {
    const t = createTemplateFunc(ctx.options.dictionary?.openapi ?? openApiAnnotations)
    const schemaChange = resolver(diff, ctx) 
    if (!schemaChange) { return "" }

    if (isResponsePath(ctx.before.path)) {
      return t("responseSchema", { schemaChange, responseCode: ctx.before.path[4], contentType: ctx.before.path[6] })
    } else if (isRequestBodyPath(ctx.before.path)) {
      return t("requestBodySchema", { schemaChange, contentType: ctx.before.path[5] })
    } else if (isParameterPath(ctx.before.path)) {
      const { path, root } = diff.action === "add" ? ctx.after : ctx.before
      const paramPath = path.slice(0, path[2] === "parameters" ? 4 : 5)
      return t("parameterSchema", { ...getObjectValue(root, ...paramPath), schemaChange })
    }

    return ""
  }
}

