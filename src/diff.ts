import { DiffPath, DiffOptions, Diff, EnumDiff } from "./types"
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
  if (ctx.strictArrays) {
    for (let i = 0; i < before.length; i++) {
      if (i >= after.length) {
        const diff = { path: [...path, i], before: before[i], action: DiffAction.remove }
        diffs.push(classifyDiff(diff, ctx.rules))
      } else {
        diffs.push(...findDiff(before[i], after[i], ctx, [...path, i]))
      }
    }
  } else {
    const itemsDiff = enumDiff(before, after, ctx, path)
    for (let addedIndex of itemsDiff.added) {
      const diff = { path: [...path, addedIndex], after: after[addedIndex], action: DiffAction.add }
      diffs.push(classifyDiff(diff, ctx.rules))
    }
    for (let removedIndex of itemsDiff.removed) {
      const diff = { path: [...path, removedIndex], before: before[removedIndex], action: DiffAction.remove }
      diffs.push(classifyDiff(diff, ctx.rules))
    }
    for (let key of Object.keys(itemsDiff.changed)) {
      diffs.push(...itemsDiff.changed[+key].diffs)
    }
  }

  if (ctx.strictArrays) {
    _after.splice(0, before.length)
    for (let i = 0; i < _after.length; i++) {
      const diff = { path: [...path, before.length + i], after: _after[i], action: DiffAction.add }
      diffs.push(classifyDiff(diff, ctx.rules))
    }
  }

  return diffs
}

export const enumDiff = (before: any[], after: any[], ctx: DiffContext, path: DiffPath): EnumDiff => {
  const result: EnumDiff = {
    added: [],
    removed: [],
    changed: {},
    unchanged: [],
  }
  const itemsDiffs = []
  const beforeDiffs: any[] = []
  const afterEquals = new Set<number>()
  const beforeEquals = new Set<number>()
  for (let i = 0; i < before.length; i++) {
    let afterDiffs: any[] | number  = []
    for (let j = 0; j < after.length; j++) {
      if (afterEquals.has(j)) { continue }

      const diffs = findDiff(before[i], after[j], ctx, [...path, i])
      if (!diffs.length) {
        afterEquals.add(j)
        afterDiffs = j
        break
      }
      afterDiffs.push(diffs)
    }
    if (typeof afterDiffs === "number") {
      beforeEquals.add(i)
    }
    beforeDiffs.push(afterDiffs)
  }
  
  for (let i = 0; i < before.length; i++) {
    if (beforeEquals.has(i)) {
      // after has equal item
      itemsDiffs[i] = []
      result.unchanged.push(i)
    } else {
      // find item with min diff count
      const afterIndexes = [ ...Array(after.length).keys() ]
      const minDiffs = afterIndexes.sort((a, b) => (beforeDiffs[i][a]?.length || 0) - (beforeDiffs[i][b]?.length || 0))
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
          result.changed[i] = {
            afterIndex: minDiffIndex,
            diffs: beforeDiffs[i][minDiffIndex]
          }
          beforeEquals.add(i)
          afterEquals.add(minDiffIndex)
          break
        }
      }

      if (!beforeEquals.has(i)) {
        result.removed.push(i)
      }
    }
  }

  for (let j = 0; j < after.length; j++) {
    if (!afterEquals.has(j)) {
      result.added.push(j)
    }
  }

  return result
}
