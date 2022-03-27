import { ActionType, DiffPath, DiffOptions, Diff } from "./types"
import { dereference } from "./dereference"
import { classifyDiff } from "./classifier"
import { DiffContext } from "./context"
import { typeOf } from "./utils"

export const apiDiff = (before: any, after: any, options: DiffOptions): Diff[] => {
  return findDiff(before, after, new DiffContext(before, after, options))
}

const findDiff = (before: any, after: any, ctx: DiffContext, path: DiffPath = []): Diff[] => {
  if (typeOf(before) !== typeOf(after)) {
    return [classifyDiff({ path: path, before, after, action: ActionType.replace }, ctx.rules)]
  }

  switch (typeOf(before)) {
    case "string":
      return stringsDiff(before, after, ctx, path)
    case "object":
      return objectsDiff(before, after, ctx, path)
    case "array":
      return arrayDiff(before, after, ctx, path)
    default:
      return before !== after ? [classifyDiff({ path, before, after, action: ActionType.replace }, ctx.rules)] : []
  }
}

const normalizeString = (value: string, ctx: DiffContext) => {
  value = ctx.trimStrings ? value.trim() : value
  value = ctx.caseSensitive ? value : value.toLowerCase()
  return value
}

const stringsDiff = (before: string, after: string, ctx: DiffContext, path: DiffPath): Diff[] => {
  before = normalizeString(before, ctx)
  after = normalizeString(after, ctx)
  return before !== after 
    ? [classifyDiff({ path, before, after, action: ActionType.replace }, ctx.rules)]
    : []
}

const objectsDiff = (before: any, after: any, ctx: DiffContext, path: DiffPath): Diff[] => {
  const diffs: Diff[] = []

  const _before = dereference(before, ctx.before, ctx.beforeRefs, ctx.cache)
  const _after = dereference(after, ctx.after, ctx.afterRefs, ctx.cache)
  
  const keys = new Set([...Object.keys(_before), ...Object.keys(_after)])
  for (const key of keys) {
    // skip symbol key
    if (typeof key === "symbol") {
      continue
    }

    if (!_before.hasOwnProperty(key)) {
      // added key
      diffs.push(
        classifyDiff(
          {
            path: [...path, key],
            after: _after[key],
            action: ActionType.add,
          },
          ctx.rules
        )
      )
    } else if (!_after.hasOwnProperty(key)) {
      // deleted key
      diffs.push(
        classifyDiff(
          {
            path: [...path, key],
            before: _before[key],
            action: ActionType.remove,
          },
          ctx.rules
        )
      )
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

  return diffs
}

const findEqualItemIndex = (item: any, array: any[], ctx: DiffContext): number => {
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
        diffs.push(
          classifyDiff(
            {
              path: [...path, i],
              before: before[i],
              action: ActionType.remove,
            },
            ctx.rules
          )
        )
      } else {
        diffs.push(...findDiff(before[i], after[i], ctx, [...path, i]))
      }
    } else {
      const index = findEqualItemIndex(before[i], _after, ctx)
      if (index >= 0) {
        _after.splice(index, 1)
      } else {
        diffs.push(
          classifyDiff(
            {
              path: [...path, i],
              before: before[i],
              action: ActionType.remove,
            },
            ctx.rules
          )
        )
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
    diffs.push(
      classifyDiff(
        {
          path: [...path, before.length + i],
          after: _after[i],
          action: ActionType.add,
        },
        ctx.rules
      )
    )
  }

  return diffs
}
