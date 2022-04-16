import { ObjPath, JsonCompareOptions, MatchFunc, JsonDiff, CompareResult } from "./types"
import { typeOf, replaced, unchanged, added, removed } from "./utils"
import { DiffAction, DIFF_META_KEY } from "./constants"

export class JsonCompare<D extends JsonDiff = JsonDiff, T extends CompareResult<D> = CompareResult<D>> {
  public trimStrings?: boolean
  public caseSensitive?: boolean
  public strictArrays?: boolean
  public diffKey: string | symbol

  constructor(public before: any, public after: any, options: JsonCompareOptions) {
    this.trimStrings = options.trimStrings 
    this.caseSensitive = options.caseSensitive 
    this.strictArrays = options.strictArrays
    this.diffKey = options.metaKey || DIFF_META_KEY
  }

  public compare(): D[] {
    return this.compareAny(this.before, this.after).diffs
  }

  public buildDiffTree() {
    return this.compareAny(this.before, this.after).diffTree
  }

  public normalizeString(value: string) {
    value = this.trimStrings ? value.trim() : value
    value = this.caseSensitive ? value : value.toLowerCase()
    return value
  }

  public mergeResults(results: { [key: string]: CompareResult }, array = false): T {
    const res: CompareResult = { diffs: [], diffTree: {} }
    for (const key of Object.keys(results)) {
      const { diffs, diff, diffTree } = results[key]
      if (diff) {
        const { path, ...rest } = diff
        res.diffTree[this.diffKey] = { [array ? +key : key]: rest }
        res.diffs.push(diff)
      } else if (diffs.length) {
        res.diffTree[key] = diffTree
        res.diffs.push(...diffs)
      }
    }
    return res as T
  }

  public compareResult(diff: JsonDiff): T {
    return { diffs: diff.action === DiffAction.test ? [] : [diff], diff } as T
  }

  public compareAny(before: any, after: any, path: ObjPath = []): T {
    if (typeOf(before) !== typeOf(after)) {
      return this.compareResult(replaced(path, before, after))
    }

    switch (typeOf(before)) {
      case "object": return this.compareObjects(before, after, path)
      case "array": return this.compareArrays(before, after, path)
      default:
        const equal = typeof before === "string" 
          ? this.normalizeString(before) === this.normalizeString(after)
          : before === after
        
        return this.compareResult(equal ? unchanged(path, before) : replaced(path, before, after))
    }
  }

  public compareObjects(before: any, after: any, path: ObjPath, matchFunc?: MatchFunc): T {
    const result: { [key: string]: CompareResult } = {}

    if (Object.keys(before).length === 0 && Object.keys(after).length === 0) {
      return this.compareResult(unchanged(path, before))
    }

    const beforeKeys = Object.keys(before)
    const afterKeys = new Set(Object.keys(after))
    
    for (const key of beforeKeys) {
      const afterKey = [...afterKeys].find((k) => k === key || (matchFunc && matchFunc(key, k)))
      const propPath = [...path, key]

      if (afterKey && afterKey !== key) {
        result[key] = this.compareResult(replaced(propPath, key, afterKey))
      }

      if (afterKey === undefined) {
        // deleted key
        result[key] = this.compareResult(removed(propPath, before[key]))
      } else {
        // updated value
        result[key] = this.compareAny(before[key], after[afterKey], propPath)
        afterKeys.delete(afterKey)
      } 
    }

    for (const key of afterKeys) {
      // added key
      result[key] = this.compareResult(added([...path, key], after[key]))
    }

    return this.mergeResults(result)
  }

  public compareArrays(before: any[], after: any[], path: ObjPath, matchFunc?: MatchFunc): T {
    if (before.length === 0 && after.length === 0) {
      return this.compareResult(unchanged(path, before))
    }

    if (!this.strictArrays && !matchFunc) {
      return this.compareEnums(before, after, path)
    }
    const result: { [key: number]: CompareResult } = {}
    const afterKeys = new Set(after.keys())

    for (const i of before.keys()) {
      const itemPath = [...path, i]
      if (matchFunc) {
        const j = matchFunc && [...afterKeys].find((j) => matchFunc!(before[i], after[j]))
        if (j === undefined) {
          result[i] = this.compareResult(removed(itemPath, before[i]))
        } else {
          afterKeys.delete(j)
          result[i] = this.compareAny(before[i], after[j], itemPath)
        }
      } else {
        if (i >= after.length) {
          result[i] = this.compareResult(removed(itemPath, before[i]))
        } else {
          afterKeys.delete(i)
          result[i] = this.compareAny(before[i], after[i], itemPath)
        }
      }
    }

    let i = before.length
    for (const key of afterKeys) {
      
      result[i] = this.compareResult(added([...path, i++], after[key]))
    }

    return this.mergeResults(result, true)
  }

  public compareEnums(before: any[], after: any[], path: ObjPath): T {
    const result: { [key: number]: CompareResult } = {}

    const itemsDiffs = []
    const beforeDiffs: (CompareResult[] | CompareResult)[] = []
    const afterEquals = new Set<number>()
    const beforeEquals = new Set<number>()

    for (const i of before.keys()) {
      let afterDiffs: CompareResult[] | CompareResult = []
      for (const j of after.keys()) {
        if (afterEquals.has(j)) { continue }

        const res = this.compareAny(before[i], after[j], [...path, i])
        if (!res.diffs.length) {
          afterEquals.add(j)
          beforeEquals.add(i)
          afterDiffs = res
          break
        }
        afterDiffs[j] = res
      }
      beforeDiffs.push(afterDiffs)
    }
    
    for (const i of before.keys()) {
      const itemRes = beforeDiffs[i]
      if (!Array.isArray(itemRes)) {
        // after has equal item
        itemsDiffs[i] = []
        result[i] = itemRes
      } else {
        // find item with min diff count
        const afterIndexes = [ ...Array(after.length).keys() ]
        const minDiffs = afterIndexes.sort((a, b) => (itemRes[a]?.diffs.length || 0) - (itemRes[b]?.diffs.length || 0))
        for (const j of after.keys()) {
          let minDiffIndex = minDiffs[j]
          if (afterEquals.has(minDiffIndex)) { continue }
          for (const k of before.keys()) {
            const minDiffRes = beforeDiffs[k]
            if (!Array.isArray(minDiffRes) || beforeEquals.has(k)) { continue }
            if (minDiffRes[minDiffIndex] < itemRes[minDiffIndex]) {
              minDiffIndex = -1
              break
            }
          }
          if (minDiffIndex >= 0) {
            result[i] = itemRes[minDiffIndex]
            beforeEquals.add(i)
            afterEquals.add(minDiffIndex)
            break
          }
        }

        if (!beforeEquals.has(i)) {
          result[i] = this.compareResult(removed([...path, i], before[i]))
        }
      }
    }

    let i = before.length
    for (let j of after.keys()) {
      if (!afterEquals.has(j)) {
        result[i] = this.compareResult(added([...path, i++], after[j]))
      }
    }

    return this.mergeResults(result, true)
  }
}
