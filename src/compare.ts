import { CompareContext, CompareResult } from "./context"
import { ObjPath, Diff, CompareOptions } from "./types"
import { DiffAction } from "./constants"
import { typeOf } from "./utils"

export const apiDiff = (before: any, after: any, options: CompareOptions): Diff[] => {
  const res = compare(before, after, new CompareContext(before, after, options))
  return res.diffs
}

export const compare = <T extends CompareResult>(before: any, after: any, ctx: CompareContext<T>, path: ObjPath = []): T => {
  if (typeOf(before) !== typeOf(after)) {
    return ctx.diffResult({ path, before, after, action: DiffAction.replace })
  }

  switch (typeOf(before)) {
    case "object": return compareObjects(before, after, ctx, path)
    case "array": return compareArrays(before, after, ctx, path)
    default:
      if (typeof before === "string") {
        before = ctx.normalizeString(before)
        after = ctx.normalizeString(after)
      }
      if (before !== after) {
        return ctx.diffResult({ path, before, after, action: DiffAction.replace })
      } else {
        return ctx.equalResult(before, path)
      }
  }
}

const compareObjects = <T extends CompareResult>(before: any, after: any, ctx: CompareContext<T>, objPath: ObjPath): T => {
  const result: CompareResult = { diffs: [] }

  const [_before, _after, clearCache] = ctx.dereference(before, after, objPath)

  if (Object.keys(_before).length === 0 && Object.keys(_after).length === 0) {
    return ctx.equalResult(before, objPath)
  }

  const beforeKeys = Object.keys(_before)
  const afterKeys = new Set(Object.keys(_after))
  const meta = ctx.getPathRuleMeta(objPath)
  
  for (const key of beforeKeys) {
    const afterKey = [...afterKeys].find((k) => k === key || (meta?.matchKeysFunc && meta.matchKeysFunc(key, k)))
    const path = [...objPath, key]

    if (afterKey !== key) {
      const diff = { path, before: key, after: afterKey, action: DiffAction.replace }
      ctx.mergeResult(result, ctx.diffResult(diff))
    }

    if (!afterKey) {
      // deleted key
      const diff = { path, before: _before[key], action: DiffAction.remove }
      ctx.mergeResult(result, ctx.diffResult(diff))
    } else {
      // updated value
      ctx.mergeResult(result, compare(_before[key], _after[afterKey], ctx, path))
      afterKeys.delete(afterKey)
    } 
  }

  for (const key of afterKeys) {
    // added key
    const diff = { path: [...objPath, key], after: _after[key], action: DiffAction.add }
    ctx.mergeResult(result, ctx.diffResult(diff))
  }

  clearCache()

  return result as T
}

const compareArrays = <T extends CompareResult>(before: any[], after: any[], ctx: CompareContext<T>, objPath: ObjPath): T => {

  if (before.length === 0 && after.length === 0) {
    return ctx.equalResult(before, objPath)
  }

  const meta = ctx.getPathRuleMeta(objPath)

  if (!ctx.strictArrays && !meta?.matchItemsFunc) {
    return compareEnums(before, after, ctx, objPath)
  }
  const result: CompareResult = { diffs: [] }
  const afterKeys = new Set(after.keys())

  for (const i of before.keys()) {
    const path = [...objPath, i]
    if (meta?.matchItemsFunc) {
      const j = meta?.matchItemsFunc && [...afterKeys].find((j) => meta.matchItemsFunc!(before[i], after[j]))
      if (j === undefined) {
        ctx.mergeResult(result, ctx.diffResult({ path, before: before[i], action: DiffAction.remove }))
      } else {
        afterKeys.delete(j)
        ctx.mergeResult(result, compare(before[i], after[j], ctx, path))
      }
    } else {
      if (i >= after.length) {
        ctx.mergeResult(result, ctx.diffResult({ path, before: before[i], action: DiffAction.remove }))
      } else {
        afterKeys.delete(i)
        ctx.mergeResult(result, compare(before[i], after[i], ctx, path))
      }
    }
  }

  for (const key of afterKeys) {
    ctx.mergeResult(result, ctx.diffResult({ path: [...objPath, -1], after: after[key], action: DiffAction.add }))
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
        ctx.mergeResult(result, ctx.diffResult(diff))
      }
    }
  }

  for (let j = 0; j < after.length; j++) {
    if (!afterEquals.has(j)) {
      const diff = { path: [...path, -1], after: after[j], action: DiffAction.add }
      ctx.mergeResult(result, ctx.diffResult(diff))
    }
  }

  return result as T
}
