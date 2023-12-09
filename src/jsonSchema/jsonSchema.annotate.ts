import type { JsonPath } from "json-crawl"

import type { ChangeAnnotationResolver, ComapreContext } from "../types"
import { AnnotationContext, ChangeAnnotation } from "./jsonSchema.types"

const jsonSchemaAnnotations = {
  changeTemplate: (text: string, target?: string): ChangeAnnotation => [
    target ? `[Added] ${text} to ${target}` : `[Added] ${text}`,
    target ? `[Removed] ${text} from ${target}` : `[Removed] ${text}`,
    target ? `[Replaced] ${text} of ${target}` : `[Replaced] ${text}`
  ],
  statusChange: (status: string, target?: string) => jsonSchemaAnnotations.changeTemplate(`${status} status`, target),
  validationChange: (key: string, target?: string) => jsonSchemaAnnotations.changeTemplate(`${key} validator`, target), 
  annotationChange: (key: string, target?: string) => jsonSchemaAnnotations.changeTemplate(`annotation (${key})`, target),
  enumChange: (target?: string) => jsonSchemaAnnotations.changeTemplate("possbile values", target),
  formatChange: (target?: string) => jsonSchemaAnnotations.changeTemplate("value format", target),
  defaultChange: (target?: string) => jsonSchemaAnnotations.changeTemplate("default value", target),
  constChange: (target?: string) => jsonSchemaAnnotations.changeTemplate("possible value", target),
  nullableChange: (target?: string) => jsonSchemaAnnotations.changeTemplate("possbile nullable value", target),
} as const


const getTarget = (path: JsonPath, prefix = ""): string => {
  for (let i = 0; i < path.length; i++) {
    if (path[i] === "properties" && i < path.length - 1) {
      prefix += prefix ? "." + String(path[i++]) : String(path[i++]) 
    } else if (path[i] === "items") {
      prefix += "[]"
    }
  }
  return prefix
}

const getDiffContext = (action: string, ctx: ComapreContext): AnnotationContext => {
  const _ctx = action === "add" ? ctx.after : ctx.before

  return {
    ..._ctx,
    action: ["add", "remove", "replace"].indexOf(action),
    target: getTarget(_ctx.path)
  }
}

export const annotationChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, action, target } = getDiffContext(diff.action, ctx)

  return jsonSchemaAnnotations.annotationChange(String(key), target)[action]
}

export const exampleChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, target } = getDiffContext(diff.action, ctx)

  return jsonSchemaAnnotations.annotationChange("example", target)[action]
}

export const validationChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, action, target } = getDiffContext(diff.action, ctx)

  return jsonSchemaAnnotations.validationChange(String(key), target)[action]
}

export const statusChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, target } = getDiffContext(diff.action, ctx)

  if (ctx.after.value) {
    return jsonSchemaAnnotations.statusChange(String(key), target)[0]
  } else if (ctx.before.value) {
    return jsonSchemaAnnotations.statusChange(String(key), target)[1]
  }
  return ""
}

export const keyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, action, target } = getDiffContext(diff.action, ctx)
  switch (key) {
    case "enum": return jsonSchemaAnnotations.enumChange(target)[action]
    case "const": return jsonSchemaAnnotations.constChange(target)[action]
    case "format": return jsonSchemaAnnotations.formatChange(target)[action]
    case "nullable": return jsonSchemaAnnotations.nullableChange(target)[action]
    case "default": return jsonSchemaAnnotations.defaultChange(target)[action]
  }
  return ""
}

export const parentKeyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, target } = getDiffContext(diff.action, ctx)
  const key = path.length > 1 ? path[path.length-2] : ""
  switch (key) {
    case "enum": return jsonSchemaAnnotations.enumChange(target)[2]
  }
  return ""
}
