import { ActionType, IDiff, IJsonPath } from "./types"

interface IJsonDiffOptions {
  trimStrings?: boolean
  caseSensitive?: boolean
  findFirstDiff?: boolean
  strictArrays?: boolean
}

const typeOf = (value: any) => {
  if (Array.isArray(value)) {
    return "array"
  }
  return typeof value == null ? "null" : typeof value
}

export const jsonDiff = (before: any, after: any, options?: IJsonDiffOptions, path: IJsonPath = []): IDiff[] => {
  if (typeOf(before) !== typeOf(after)) {
    return [{ path, before, after, action: ActionType.replace }]
  }

  switch (typeOf(before)) {
    case "string":
      return stringsDiff(before, after, options, path)
    case "object":
      return objectsDiff(before, after, options, path)
    case "array":
      return arrayDiff(before, after, options, path)
    default:
      return before !== after ? [{ path, before, after, action: ActionType.replace }] : []
  }
}

const stringsDiff = (
  before: string,
  after: string,
  options?: IJsonDiffOptions,
  path: IJsonPath = []
): IDiff[] => {
  const a = normalizeString(before, options)
  const b = normalizeString(after, options)
  return a !== b ? [{ path, before, after, action: ActionType.replace }] : []
}

const normalizeString = (value: string, options?: IJsonDiffOptions) => {
  value = options?.trimStrings ? value.trim() : value
  value = options?.caseSensitive ? value : value.toLowerCase()
  return value
}

const objectsDiff = (before: any, after: any, options?: IJsonDiffOptions, path: IJsonPath = []): IDiff[] => {
  const diffs: IDiff[] = []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    // skip symbol key
    if (typeof key === "symbol") {
      continue
    }

    if (!before.hasOwnProperty(key)) {
      // added key
      diffs.push({
        path: [...path, key],
        before: undefined,
        after: after[key],
        action: ActionType.add,
      })
    } else if (!after.hasOwnProperty(key)) {
      // deleted key
      diffs.push({
        path: [...path, key],
        before: before[key],
        after: undefined,
        action: ActionType.remove,
      })
    } else {
      // updated value
      diffs.push(...jsonDiff(before[key], after[key], options, [...path, key]))
    }

    if (options?.findFirstDiff && diffs.length) {
      break
    }
  }
  return diffs
}

const findEqualItemIndex = (item: any, array: any[], options?: IJsonDiffOptions): number => {
  for (let j = 0; j < array.length; j++) {
    if (!jsonDiff(item, array[j], { ...options, findFirstDiff: true }).length) {
      return j
    }
  }
  return -1
}

const arrayDiff = (before: any[], after: any[], options?: IJsonDiffOptions, path: IJsonPath = []): IDiff[] => {
  const diffs: IDiff[] = []

  const _after = [...after]
  for (let i = 0; i < before.length; i++) {
    if (options?.strictArrays) {
      if (i >= after.length) {
        diffs.push({
          path: [...path, i],
          before: before[i],
          after: undefined,
          action: ActionType.remove,
        })
      } else {
        diffs.push(...jsonDiff(before[i], after[i], options, [...path, i]))
      }
    } else {
      const index = findEqualItemIndex(before[i], _after, options)
      if (index >= 0) {
        _after.splice(index, 1)
      } else {
        diffs.push({
          path: [...path, i],
          before: before[i],
          after: undefined,
          action: ActionType.remove,
        })
      }
    }
    if (options?.findFirstDiff && diffs.length) {
      break
    }
  }

  if (options?.strictArrays) {
    _after.splice(0, before.length)
  }

  for (let i = 0; i < _after.length; i++) {
    diffs.push({
      path: [...path, before.length + i],
      before: undefined,
      after: _after[i],
      action: ActionType.add,
    })
  }

  return diffs
}
