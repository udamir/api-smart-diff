import { isParameterSchema, isRequestBodySchema, isResponseSchema } from "./openapi3.utils"
import { createAnnotation, getObjectValue, annotationTemplate as t } from "../utils"
import type { AnnotateHook, ChangeAnnotationResolver } from "../types"
import { jsonSchemaAnnotations, resolveRef } from "../jsonSchema"

const openApiAnnotations = {
  requestBodySchema: "{{schemaChange}} in Request Body content ({{contentType}})",
  responseSchema: "{{schemaChange}} in Response {{responseCode}} content ({{contentType}})",
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
  document: "document metadata ({{key}})",
  requestBody: "Request Body",
  requestBody_contentType: "Request Body content ({{contentType}})",
  response: "Response {{responseCode}}",
  response_contentType: "Response {{responseCode}} content ({{contentType}})",
  contentType: "Content type",
  encoding: "Encoding details",
  encoding_key: "Encoding details ({{key}})",
}

export const openApi3AnnotateHook: AnnotateHook = (diff, ctx) => {
  let annotate = ctx.rules?.annotate

  if (!annotate || diff.path[0] === "components") { return "" }
  if (isResponseSchema(diff.path)) {
    const schemaChange = createAnnotation(annotate(diff, ctx), jsonSchemaAnnotations)
    annotate = () => t("responseSchema", { schemaChange, responseCode: diff.path[4], contentType: diff.path[6] })
  } else if (isRequestBodySchema(diff.path)) {
    const schemaChange = createAnnotation(annotate(diff, ctx), jsonSchemaAnnotations)
    annotate = () => t("requestBodySchema", { schemaChange, contentType: diff.path[5] })
  } else if (isParameterSchema(diff.path)) {
    const schemaChange = createAnnotation(annotate(diff, ctx), jsonSchemaAnnotations)
    const { root } = diff.action === "add" ? ctx.after : ctx.before
    const paramPath = diff.path.slice(0, diff.path[2] === "parameters" ? 4 : 5)
    const node = getObjectValue(root, ...paramPath)
    annotate = () => t("parameterSchema", { ...resolveRef(node, root), schemaChange })
  }

  return createAnnotation(annotate(diff, ctx), openApiAnnotations)
}

export const pathMethodChangeAnnotation: ChangeAnnotationResolver = ({ action, path }) => {
  return t(action, { text: t("method", { path: path[1], method: String(path[2]).toUpperCase() })})
}

export const documentChangeAnnotation: ChangeAnnotationResolver = ({ action, path }) => {
  return t(action, { text: t("document", { key: path.join(".") })})
}

export const operationSecurityChangeAnnotation: ChangeAnnotationResolver = ({ action }) => {
  return t(action, { text: t("security")})
}

export const requestBodyChangeAnnotation: ChangeAnnotationResolver = ({ path, action }) => {
  const key = path[path.length-1]

  if (key === "required" || key === "deprecated") {
    return t(action, { text: t("status", { key }), target: t("requestBody") })
  } 
  
  return t(action, { text: t("annotation", { key }), target: t("requestBody") })
}

export const responseChangeAnnotation: ChangeAnnotationResolver = ({ path, action }) => {
  const responseCode = path[4]
  const key = path[path.length-1]
  
  if (responseCode === key) {
    return t(action, { text: t("response", { responseCode })})
  }

  return t(action, { text: t("annotation", { key }), target: t("response", { responseCode })})
}

export const contentChangeAnnotation: ChangeAnnotationResolver = ({ path, action }, ctx) => {
  const contentType = isResponseSchema(path) ? path[6] : path[5]
  const responseCode = isResponseSchema(path) ? path[4] : undefined
  const target = isResponseSchema(path) ? t("response", { contentType, responseCode }) : t("requestBody", { contentType })
  const key = path[path.length-1]

  if (contentType && contentType !== key) {
    return t(action, { text: t("annotation", { key }), target })
  }

  return t(action, { text: t("contentType"), target })
}

export const encodingChangeAnnotation: ChangeAnnotationResolver = ({ path, action }, ctx) => {
  const contentType = isResponseSchema(path) ? path[6] : path[5]
  const responseCode = isResponseSchema(path) ? path[4] : undefined
  const target = isResponseSchema(path) ? t("response", { contentType, responseCode }) : t("requestBody", { contentType })

  const encodingPath = isResponseSchema(path) ? path.slice(8) : path.slice(7)
  const key = encodingPath.join(".")

  return t(action, { text: t("encoding", { key }), target })
}

export const operationChangeAnnotation: ChangeAnnotationResolver = ({ path, action }, ctx) => {
  const { value, key } = action === "add" ? ctx.after : ctx.before

  if (key === "deprecated") {
    if (ctx.after.value) {
      return t("add", { text: t("status", { key }) })
    } else if (ctx.before.value) {
      return t("remove", { text: t("status", { key }) })
    }
    return
  } else if (key === "requestBody") {
    return t(action, { text: t(key) })
  }

  if (typeof key === "number") {
    const { value } = action === "add" ? ctx.after : ctx.before
    return t(action, { text: t("annotation", { key: `${path[path.length-2]}: ${value}` }) })
  }

  return t(action, { text: t("annotation", { key }) })
}

export const parameterChangeAnnotation: ChangeAnnotationResolver = ({ action }, ctx) => {
  const { path, root, key } = action === "add" ? ctx.after : ctx.before

  const paramPath = path.slice(0, path[2] === "parameters" ? 4 : 5)
  const node = getObjectValue(root, ...paramPath)
  const param = resolveRef(node, root)

  if (key === "required" || key === "deprecated") {
    return t(action, { text: t("status", { key }), target: t("param", param) })
  } else {
    return t(action, { text: t("param", param) })
  }
}
