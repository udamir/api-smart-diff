import { DiffPath, DiffOptions, Diff } from "./types"
import { dereference } from "./dereference"
import { classifyDiff } from "./classifier"
import { buildPath, typeOf } from "./utils"
import { DiffContext } from "./context"
import { DiffAction } from "./constants"

export const apiDiff = (before: any, after: any, options: DiffOptions): Diff[] => {
  return findDiff(before, after, new DiffContext(before, after, options))
}

export const findDiff = (before: any, after: any, ctx: DiffContext, path: DiffPath = []): Diff[] => {
  if (typeOf(before) !== typeOf(after)) {
    const diff = { path: path, before, after, action: DiffAction.replace }
    return [classifyDiff(diff, ctx.rules)]
  }

  switch (typeOf(before)) {
    case "object":
      return objectsDiff(before, after, ctx, path)
    case "array":
      return arrayDiff(before, after, ctx, path)
    default:
      if (typeOf(before) === "string") {
        before = normalizeString(before, ctx)
        after = normalizeString(after, ctx)
      }

      const diff = { path, before, after, action: DiffAction.replace }
      return before !== after ? [classifyDiff(diff, ctx.rules)] : []
  }
}

const normalizeString = (value: string, ctx: DiffContext) => {
  value = ctx.trimStrings ? value.trim() : value
  value = ctx.caseSensitive ? value : value.toLowerCase()
  return value
}

const objectsDiff = (before: any, after: any, ctx: DiffContext, path: DiffPath): Diff[] => {
  const diffs: Diff[] = []
  const ref = "#" + buildPath(path)

  ctx.beforeRefs.add(ref)
  ctx.afterRefs.add(ref)

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
      const diff = { path: [...path, key], after: _after[key], action: DiffAction.add }
      diffs.push(classifyDiff(diff, ctx.rules))
    } else if (!_after.hasOwnProperty(key)) {
      // deleted key
      const diff = { path: [...path, key], before: _before[key], action: DiffAction.remove }
      diffs.push(classifyDiff(diff, ctx.rules))
    } else {
      // updated value
      diffs.push(...findDiff(_before[key], _after[key], ctx, [...path, key]))
    }

    if (ctx.findFirstDiff && diffs.length) {
      break
    }
  }

  // remove refs
  before.$ref && ctx.beforeRefs.delete(before.$ref)
  after.$ref && ctx.afterRefs.delete(after.$ref)

  ctx.beforeRefs.delete(ref)
  ctx.afterRefs.delete(ref)

  return diffs
}

export const findEqualItemIndex = (item: any, array: any[], ctx: DiffContext): number => {
  for (let j = 0; j < array.length; j++) {
    ctx.findFirstDiff = true
    const diff = findDiff(item, array[j], ctx)
    ctx.findFirstDiff = false
    if (!diff.length) {
      return j
    }
  }
  return -1
}

const arrayDiff = (before: any[], after: any[], ctx: DiffContext, path: DiffPath): Diff[] => {
  const diffs: Diff[] = []

  const _after = [...after]
  for (let i = 0; i < before.length; i++) {
    if (ctx.strictArrays) {
      if (i >= after.length) {
        const diff = { path: [...path, i], before: before[i], action: DiffAction.remove }
        diffs.push(classifyDiff(diff, ctx.rules))
      } else {
        diffs.push(...findDiff(before[i], after[i], ctx, [...path, i]))
      }
    } else {
      const index = findEqualItemIndex(before[i], _after, ctx)
      if (index >= 0) {
        _after.splice(index, 1)
      } else {
        const diff = { path: [...path, i], before: before[i], action: DiffAction.remove }
        diffs.push(classifyDiff(diff, ctx.rules))
      }
    }
    if (ctx.findFirstDiff && diffs.length) {
      break
    }
  }

  if (ctx.strictArrays) {
    _after.splice(0, before.length)
  }

  for (let i = 0; i < _after.length; i++) {
    const diff = { path: [...path, before.length + i], after: _after[i], action: DiffAction.add }
    diffs.push(classifyDiff(diff, ctx.rules))
  }

  return diffs
}
