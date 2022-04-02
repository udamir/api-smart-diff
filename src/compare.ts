import { CompareContext, CompareResult } from "./context"
import { dereference } from "./dereference"
import { classifyDiff } from "./classifier"
import { buildPath, typeOf } from "./utils"
import { DiffAction } from "./constants"
import { ObjPath } from "./types"

export const compare = <T extends CompareResult>(before: any, after: any, ctx: CompareContext<T>, path: ObjPath = []): T => {
  if (typeOf(before) !== typeOf(after)) {
    const diff = { path, before, after, action: DiffAction.replace }
    return ctx.formatResult(classifyDiff(diff, ctx.rules), before, path)
  }

  switch (typeOf(before)) {
    case "object":
      return compareObjects(before, after, ctx, path)
    case "array":
      return compareArrays(before, after, ctx, path)
    default:
      if (typeof before === "string") {
        before = normalizeString(before, ctx)
        after = normalizeString(after, ctx)
      }
      if (before !== after) {
        const diff = { path, before, after, action: DiffAction.replace }
        return ctx.formatResult(classifyDiff(diff, ctx.rules), before, path)
      } else {
        return ctx.formatResult(undefined, before, path)
      }
  }
}

const normalizeString = <T extends CompareResult>(value: string, ctx: CompareContext<T>) => {
  value = ctx.trimStrings ? value.trim() : value
  value = ctx.caseSensitive ? value : value.toLowerCase()
  return value
}

const compareObjects = <T extends CompareResult>(before: any, after: any, ctx: CompareContext<T>, path: ObjPath): T => {
  const ref = "#" + buildPath(path)
  const result: CompareResult = { diffs: [] }

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
      ctx.mergeResult(result, ctx.formatResult(classifyDiff(diff, ctx.rules), _after[key], path))
    } else if (!_after.hasOwnProperty(key)) {
      // deleted key
      const diff = { path: [...path, key], before: _before[key], action: DiffAction.remove }
      ctx.mergeResult(result, ctx.formatResult(classifyDiff(diff, ctx.rules), _before[key], path))
    } else {
      // updated value
      ctx.mergeResult(result, compare(_before[key], _after[key], ctx, [...path, key]))
    }
  }

  // remove refs
  before.$ref && ctx.beforeRefs.delete(before.$ref)
  after.$ref && ctx.afterRefs.delete(after.$ref)

  ctx.beforeRefs.delete(ref)
  ctx.afterRefs.delete(ref)

  return result as T
}

const compareArrays = <T extends CompareResult>(before: any[], after: any[], ctx: CompareContext<T>, path: ObjPath): T => {
  if (!ctx.strictArrays) {
    return compareEnums(before, after, ctx, path)
  }
  const result: CompareResult = { diffs: [] }
  const _after = [...after]

  for (let i = 0; i < before.length; i++) {
    if (i >= after.length) {
      const diff = { path: [...path, i], before: before[i], action: DiffAction.remove }
      ctx.mergeResult(result, ctx.formatResult(classifyDiff(diff, ctx.rules), before[i], path))
    } else {
      ctx.mergeResult(result, compare(before[i], after[i], ctx, [...path, i]))
    }
  }

  _after.splice(0, before.length)
  for (let j = before.length, i = 0; j < before.length + _after.length; j++, i++) {
    const diff = { path: [...path, -1], after: _after[i], action: DiffAction.add }
    ctx.mergeResult(result, ctx.formatResult(classifyDiff(diff, ctx.rules), _after[i], path))
  }
  
  return result as T
}

export const compareEnums = <T extends CompareResult>(before: any[], after: any[], ctx: CompareContext<T>, path: ObjPath): T => {
  const result: CompareResult = { diffs: [] }

  const itemsDiffs = []
  const beforeDiffs: any[] = []
  const afterEquals = new Set<number>()
  const beforeEquals = new Set<number>()

  for (let i = 0; i < before.length; i++) {
    let afterDiffs: CompareResult[] | CompareResult  = []
    for (let j = 0; j < after.length; j++) {
      if (afterEquals.has(j)) { continue }

      const res = compare(before[i], after[j], ctx, [...path, i])
      if (!res.diffs.length) {
        afterEquals.add(j)
        beforeEquals.add(i)
        afterDiffs = res
        break
      }
      afterDiffs.push(res)
    }
    beforeDiffs.push(afterDiffs)
  }
  
  for (let i = 0; i < before.length; i++) {
    const itemDiff = beforeDiffs[i]
    if (beforeEquals.has(i)) {
      // after has equal item
      itemsDiffs[i] = []
      ctx.mergeResult(result, itemDiff)
    } else {
      // find item with min diff count
      const afterIndexes = [ ...Array(after.length).keys() ]
      const minDiffs = afterIndexes.sort((a, b) => (itemDiff[a]?.length || 0) - (itemDiff[b]?.length || 0))
      for (let j = 0; j < after.length; j++) {
        let minDiffIndex = minDiffs[j]
        if (afterEquals.has(minDiffIndex)) { continue }
        for (let k = 0; k < before.length; k++) {
          if (beforeEquals.has(k)) { continue }
          if (beforeDiffs[k][minDiffIndex] < beforeDiffs[i][minDiffIndex]) {
            minDiffIndex = -1
            break
          }
        }
        if (minDiffIndex >= 0) {
          // merge before[i] with beforeDiffs[i][minDiffIndex]
          ctx.mergeResult(result, itemDiff[minDiffIndex])
          beforeEquals.add(i)
          afterEquals.add(minDiffIndex)
          break
        }
      }

      if (!beforeEquals.has(i)) {
        const diff = { path: [...path, i], before: before[i], action: DiffAction.remove }
        ctx.mergeResult(result, ctx.formatResult(classifyDiff(diff, ctx.rules), before[i], path))
      }
    }
  }

  for (let j = 0; j < after.length; j++) {
    if (!afterEquals.has(j)) {
      const diff = { path: [...path, -1], after: after[j], action: DiffAction.add }
      ctx.mergeResult(result, ctx.formatResult(classifyDiff(diff, ctx.rules), after[j], path))
    }
  }

  return result as T
}
