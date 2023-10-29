import { JsonPath } from "json-crawl"

import { Diff, FormatDiffFunc, MergeMeta } from "./types"
import { DiffAction } from "./constants"
  
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

export const changeFactory = <T extends Diff>(formatDiffFunc?: FormatDiffFunc<T>) => {
  const formatDiff = formatDiffFunc ? formatDiffFunc : ((diff: Diff) => diff as T)
  return {
    added: (path: JsonPath, after: unknown): T => formatDiff({ path, after, action: DiffAction.add }),
    removed: (path: JsonPath, before: unknown): T => formatDiff({ path, before, action: DiffAction.remove }),
    replaced: (path: JsonPath, before: unknown, after: unknown): T => formatDiff({ path, before, after, action: DiffAction.replace }),
    renamed: (path: JsonPath, before: unknown, after: unknown): T => formatDiff({ path, before, after, action: DiffAction.rename }),
  }
}

export const createMergeMeta = (diffs: Diff[], path: JsonPath): MergeMeta => {
  const meta: MergeMeta = {}

  for (const diff of diffs) {
    const key = diff.path[path.length]
    if (diff.path.length === path.length + 1) {
      meta[key] = diff
    } else {
      // diff in array
      const item = meta[key]
      meta[key] = Array.isArray(item) ? [...item, diff] : [diff]
    }
  }

  return meta
}
