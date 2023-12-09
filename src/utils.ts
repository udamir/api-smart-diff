import { JsonPath, getNodeRules } from "json-crawl"

import type { ChangeFactory, ComapreContext, CompareRules, CompareTransformResolver, Diff, DiffContext, DiffMeta, FormatDiffFunc, MergeMeta, TransformResolver } from "./types"
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

export const isKey = <T extends object>(x: T, k: PropertyKey): k is keyof T => {
  return k in x;
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
  // const key = diff.action === "rename" ? "*" : `${diff.path[diff.path.length - 1]}`
  // const _rules: CompareRules | undefined = diff.action === "replace" ? rules : getNodeRules(rules, key, diff.path)
  const rule = rules?.$

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

export const getKeyValue = (obj: unknown, ...path: JsonPath): unknown | undefined => {
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

export const getStringValue = (obj: unknown, ...path: JsonPath): string | undefined => {
  const value = getKeyValue(obj, ...path)
  return typeof value === "string" ? value : undefined
}

export const getNumberValue = (obj: unknown, ...path: JsonPath): number | undefined => {
  const value = getKeyValue(obj, ...path)
  return typeof value === "number" ? value : ((typeof value === "string" && +value) ? +value : undefined)
}

export const getBooleanValue = (obj: unknown, ...path: JsonPath): boolean | undefined => {
  const value = getKeyValue(obj, ...path)
  return typeof value === "boolean" ? value : ((typeof value === "string" && (value === "true" || value === "false") ? Boolean(value) : undefined))
}

export const joinPath = (base: JsonPath, ...items: JsonPath[]): JsonPath => {
  const result = [...base]
  for (const item of items) {
    for (const step of item) {
      if (step === "") {
        result.pop()
      } else {
        result.push(step)
      }
    }
  }
  return result
}

export const getParentContext = (ctx: DiffContext, ...path: JsonPath): DiffContext | undefined => {
  const _path = joinPath(ctx.path.slice(0, -1), path)
  
  if (!_path.length) {
    return { path: [], key: "", value: ctx.root, root: ctx.root }
  }

  const parentPath = [..._path]
  const key = parentPath.pop()!

  const parentValue = getKeyValue(ctx.root, ...parentPath) as Record<string | number, unknown>
  const value = parentValue[key]

  if (value === undefined) {
    return
  }

  return { path: _path, key, value, parent: parentValue, root: ctx.root }
}

export const isExist = (value: unknown): boolean => {
  return typeof value !== "undefined"
}

export const isString = (value: unknown): value is string => {
  return typeof value === "string"
}

export const isNumber = (value: unknown): value is number => {
  return typeof value === "number" || isString(value) && !Number.isNaN(+value)
}

export const compareTransformationFactory = (resolver: TransformResolver): CompareTransformResolver => {
  return (before, after) => [resolver(before, after), resolver(after, before)]
}
