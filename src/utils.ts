import { CrawlRulesKey, JsonPath, getNodeRules } from "json-crawl"

import type { ComapreContext, CompareRules, CompareRulesFunc, Diff, DiffMeta, FormatDiffFunc, MergeMeta } from "./types"
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

export const changeFactory = <T extends Diff>(formatDiffFunc?: FormatDiffFunc<T>) => {
  const formatDiff = formatDiffFunc ? formatDiffFunc : ((diff: Diff) => diff as T)

  return {
    added: (path: JsonPath, after: unknown, ctx: ComapreContext): T => formatDiff(classifyDiff({ path, after, action: DiffAction.add }, ctx), ctx),
    removed: (path: JsonPath, before: unknown, ctx: ComapreContext): T => formatDiff(classifyDiff({ path, before, action: DiffAction.remove }, ctx), ctx),
    replaced: (path: JsonPath, before: unknown, after: unknown, ctx: ComapreContext): T => formatDiff(classifyDiff({ path, before, after, action: DiffAction.replace }, ctx), ctx),
    renamed: (path: JsonPath, before: unknown, after: unknown, ctx: ComapreContext): T => formatDiff(classifyDiff({ path, before, after, action: DiffAction.rename }, ctx), ctx),
  }
}

export const convertDiffToMeta = (diff: Diff): DiffMeta => {
  return {
    action: diff.action,
    type: diff.type ?? unclassified,
    ...diff.action === "replace" ? { replaced: diff.before } : {}
  }
}

export const createMergeMeta = (diffs: Diff[]): MergeMeta => {
  const meta: MergeMeta = {}

  for (const diff of diffs) {
    const _meta = convertDiffToMeta(diff)
    const key = diff.path[diff.path.length - 1]
    meta[key] = _meta
  }

  return meta
}
