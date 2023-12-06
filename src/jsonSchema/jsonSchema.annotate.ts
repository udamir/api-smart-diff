import type { JsonPath } from "json-crawl"
import type { ChangeAnnotationResolver, ComapreContext, DiffContext } from "../types"

type ChangeAnnotation = [string, string, string]

const annotations = {
  changeTemplate: (text: string, target?: string): ChangeAnnotation => [
    target ? `[Added] ${text} to ${target}` : `[Added] ${text}`,
    target ? `[Removed] ${text} from ${target}` : `[Removed] ${text}`,
    target ? `[Replaced] ${text} of ${target}` : `[Replaced] ${text}`
  ],
  statusChange: (status: string, target?: string) => annotations.changeTemplate(`${status} status`, target),
  validationChange: (key: string, target?: string) => annotations.changeTemplate(`${key} validator`, target), 
  annotationChange: (key: string, target?: string) => annotations.changeTemplate(`annotation (${key})`, target),
  enumChange: (target?: string) => annotations.changeTemplate("possbile values", target),
  formatChange: (target?: string) => annotations.changeTemplate("value format", target),
  defaultChange: (target?: string) => annotations.changeTemplate("default value", target),
  nullableChange: (target?: string) => annotations.changeTemplate("possbile nullable value", target),
} as const

type AnnotationContext = DiffContext & {
  action: number
  target: string
}

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

  return annotations.annotationChange(String(key), target)[action]
}

export const validationChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, action, target } = getDiffContext(diff.action, ctx)

  return annotations.validationChange(String(key), target)[action]
}

export const statusChange: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, target } = getDiffContext(diff.action, ctx)

  if (ctx.after.value) {
    annotations.statusChange(String(key), target)[0]
  } else if (ctx.before.value) {
    annotations.statusChange(String(key), target)[1]
  }
  return ""
}

export const keyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { key, action, target } = getDiffContext(diff.action, ctx)
  switch (key) {
    case "enum": return annotations.enumChange(target)[action]
    case "format": return annotations.formatChange(target)[action]
    case "nullable": return annotations.nullableChange(target)[action]
    case "default": return annotations.defaultChange(target)[action]
  }
  return ""
}

export const parentKeyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, target } = getDiffContext(diff.action, ctx)
  const key = path.length > 1 ? path[path.length-2] : ""
  switch (key) {
    case "enum": return annotations.enumChange(target)[2]
  }
  return ""
}
