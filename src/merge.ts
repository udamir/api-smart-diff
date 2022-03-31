import { DiffContext, MergeContext } from "./context"
import { dereference } from "./dereference"
import { classifyDiff } from "./classifier"
import { findEqualItemIndex } from "./diff"
import { typeOf } from "./utils"
import { 
  ActionType, DiffPath, MergedArrayMeta,
  MergeOptions, MergeResult
} from "./types"

export const apiMerge = (before: any, after: any, options: MergeOptions): any => {
  const [ value ] = mergeChanges(before, after, new MergeContext(before, after, options), [])
  return value
}

const mergeChanges = (before: any, after: any, ctx: MergeContext, path: DiffPath = []): MergeResult => {
  if (typeOf(before) !== typeOf(after)) {
    const diff = { path, before, after, action: ActionType.replace }
    return [ after, ctx.formatMeta(classifyDiff(diff, ctx.rules)) ]
  }

  switch (typeOf(before)) {
    case "object":
      return mergeObjects(before, after, ctx, path)
    case "array":
      return mergeArrays(before, after, ctx, path)
    default:
      if (typeof before === "string") {
        before = normalizeString(before, ctx)
        after = normalizeString(after, ctx)
      }
      if (before !== after) {
        const diff = { path, before, after, action: ActionType.replace }
        return [ after, ctx.formatMeta(classifyDiff(diff, ctx.rules)) ]
      } 
  }
  return [ after ]
}

const normalizeString = (value: string, ctx: DiffContext) => {
  value = ctx.trimStrings ? value.trim() : value
  value = ctx.caseSensitive ? value : value.toLowerCase()
  return value
}

const mergeObjects = (before: any, after: any, ctx: MergeContext, path: DiffPath): MergeResult => {
  const merged: any = {}
  const meta: any = {}

  const _before = dereference(before, ctx.before, ctx.beforeRefs, ctx.beforeCache)
  const _after = dereference(after, ctx.after, ctx.afterRefs, ctx.afterCache)

  const keys = new Set([...Object.keys(_before), ...Object.keys(_after)])

  for (const key of keys) {
    // skip symbol key
    if (typeof key === "symbol") {
      continue
    }

    if (!_before.hasOwnProperty(key)) {
      // added key
      const diff = { path: [...path, key], after: _after[key], action: ActionType.add }
      merged[key] = _after[key]
      meta[key] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
    } else if (!_after.hasOwnProperty(key)) {
      // deleted key
      const diff = { path: [...path, key], before: _before[key], action: ActionType.remove }
      merged[key] = _before[key]
      meta[key] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
    } else {
      // updated value
      const [ value, m ] = mergeChanges(_before[key], _after[key], ctx, [...path, key])
      merged[key] = value
      if (m) {
        meta[key] = m
      }
    }
  }

  // remove refs
  before.$ref && ctx.beforeRefs.delete(before.$ref)
  after.$ref && ctx.afterRefs.delete(after.$ref)

  if (Object.keys(meta).length) {
    merged[ctx.metaKey] = meta
  }

  return [ merged ]
}

const mergeArrays = (before: any[], after: any[], ctx: MergeContext, path: DiffPath): MergeResult => {
  const arrMeta: MergedArrayMeta = { array: {} }
  const meta = arrMeta.array

  const array: any[] = []
  const _after = [...after]

  for (let i = 0; i < before.length; i++) {
    if (ctx.strictArrays) {
      if (i >= after.length) {
        const diff = { path: [...path, i], before: before[i], action: ActionType.remove }
        array[i] = before[i]
        meta[i] = ctx.formatMeta((classifyDiff(diff, ctx.rules)))
      } else {
        const [value, m] = mergeChanges(before[i], after[i], ctx, [...path, i])
        array[i] = value
        if (m) {
          meta[i] = m
        } 
      }
    } else {
      const index = findEqualItemIndex(before[i], _after, ctx)
      array[i] = before[i]
      if (index >= 0) {
        _after.splice(index, 1)
      } else {
        const diff = { path: [...path, i], before: before[i], action: ActionType.remove }
        meta[i] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
      }
    }
  }

  if (ctx.strictArrays) {
    _after.splice(0, before.length)
  }

  for (let j = before.length, i = 0; j < before.length + _after.length; j++, i++) {
    array[j] = _after[i]
    const diff = { path: [...path, j], after: _after[i], action: ActionType.add }
    meta[j] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
  }

  if (ctx.arrayMeta && Object.keys(arrMeta.array).length) {
    (array as any)[ctx.metaKey] = arrMeta.array
  }
  
  if (ctx.arrayMeta || !Object.keys(arrMeta.array).length) {
    return [array]
  } else {
    return [array, arrMeta]
  }
}
