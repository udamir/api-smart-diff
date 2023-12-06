import { CrawlRulesKey, JsonPath, getNodeRules } from "json-crawl"

import type { ChangeFactory, ComapreContext, CompareRules, Diff, DiffContext, DiffMeta, FormatDiffFunc, MergeMeta } from "./types"
import { DiffAction, allUnclassified, unclassified } from "./constants"
  
export const typeOf = (value: unknown): string  => {
  if (Array.isArray(value)) {
    return "array"
  }
  return value == null ? "null" : typeof value
}

export const objectKeys = <T extends {}>(value: T): (keyof T)[] => {
  return Object.keys(value) as (keyof T)[]
}

export const filterObj = <T extends {}>(value: T, func: (key: number | string | symbol, obj: T) => boolean ): Partial<T> => {
  const result: Partial<T> = {}
  for (const key of objectKeys(value)) {
    if (!func(key, value)) { continue }
    result[key] = value[key]
  }
  return result
}

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const isArray = (value: unknown): value is Array<unknown> => {
  return Array.isArray(value)
}

export const isNotEmptyArray = (value: unknown): boolean => {
  return !!(Array.isArray(value) && value.length)
}

export const classifyDiff = (diff: Diff, ctx: ComapreContext): Diff => {
  const { rules } = ctx.options
  const key: CrawlRulesKey = diff.action === "rename" ? "/*" : `/${diff.path[diff.path.length - 1]}`
  const _rules: CompareRules | undefined = diff.action === "replace" ? rules : getNodeRules(rules, key, ctx.before.path)
  const rule = _rules?.$

  if (!rule || diff.action === "test") { 
    return { ...diff, type: unclassified }
  }

  const classifier = Array.isArray(rule) ? rule : allUnclassified

  const index = diff.action === "rename" ? 2 : ["add", "remove", "replace"].indexOf(diff.action)
  const changeType = classifier[index]

  try {
    if (typeof changeType === "function") {
      return { ...diff, type: changeType(ctx) }
    } else {
      return { ...diff, type: changeType }
    }

  } catch (error) {
    return { ...diff, type: unclassified }
  }
}

export const changeFactory = <T extends Diff>(formatDiffFunc?: FormatDiffFunc<T>): ChangeFactory<T> => {
  const formatDiff = formatDiffFunc ? formatDiffFunc : ((diff: Diff) => diff as T)

  return {
    added: (path, after, ctx) => formatDiff(classifyDiff({ path, after, action: DiffAction.add }, ctx), ctx),
    removed: (path, before, ctx) => formatDiff(classifyDiff({ path, before, action: DiffAction.remove }, ctx), ctx),
    replaced: (path, before, after, ctx) => formatDiff(classifyDiff({ path, before, after, action: DiffAction.replace }, ctx), ctx),
    renamed: (path, before, after, ctx) => formatDiff(classifyDiff({ path, before, after, action: DiffAction.rename }, ctx), ctx),
  }
}

export const convertDiffToMeta = (diff: Diff): DiffMeta => {
  return {
    action: diff.action,
    type: diff.type ?? unclassified,
    ...diff.action === "replace" || diff.action === "rename" ? { replaced: diff.before } : {}
  }
}

export const createMergeMeta = (diffs: Diff[]): MergeMeta => {
  const meta: MergeMeta = {}

  for (const diff of diffs) {
    const _meta = convertDiffToMeta(diff)
    const key = diff.action !== "rename" ? diff.path[diff.path.length - 1] : diff.after
    meta[key] = _meta
  }

  return meta
}

export const getValueByPath = (obj: unknown, ...path: JsonPath): unknown | undefined => {
  let value: unknown = obj
  for (const key of path) {
    if (Array.isArray(value) && typeof +key === "number" && value.length < +key) {
      value = value[+key]
    } else if (isObject(value) && key in value) {
      value = value[key]
    } else { 
      return
    }
    if (value === undefined) { return }
  }
  return value
}

export const joinPath = (base: JsonPath, ...items: JsonPath[]): JsonPath => {
  const result = [...base]
  for (const item of items) {
    for (const step of item) {
      if (step === "..") {
        result.pop()
      } else {
        result.push(step)
      }
    }
  }
  return result
}

export const getParentContextByPath = (ctx: DiffContext, path: JsonPath): DiffContext | undefined => {
  const newPath = joinPath(ctx.path, path)
  
  if (!newPath.length) {
    return { path: [], key: "", value: ctx.root, root: ctx.root }
  }

  const parentPath = [...newPath]
  const key = parentPath.pop()!

  const parentValue = getValueByPath(ctx.root, ...parentPath) as Record<string | number, unknown>
  const value = parentValue[key]

  if (value === undefined) {
    return
  }

  return {
    path: newPath,
    key: parentPath[parentPath.length-1],
    value,
    parent: parentValue,
    root: ctx.root
  }
}
