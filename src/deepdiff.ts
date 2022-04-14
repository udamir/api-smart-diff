import { ObjPath, ActionType, CompareOptions, MatchFunc, UnclassifiedDiff } from "./types"
import { DiffAction } from "./constants"
import { typeOf } from "./utils"

export type CompareResultDetails = {
  action?: ActionType
  path: ObjPath
  before?: any
  after?: any
}

export class DeepDiff {
  public trimStrings?: boolean
  public caseSensitive?: boolean
  public strictArrays?: boolean

  constructor(public before: any, public after: any, options: CompareOptions) {
    this.trimStrings = options.trimStrings 
    this.caseSensitive = options.caseSensitive 
    this.strictArrays = options.strictArrays
  }

  public compare(): UnclassifiedDiff[] {
    return this.compareAny(this.before, this.after)
  }

  public normalizeString(value: string) {
    value = this.trimStrings ? value.trim() : value
    value = this.caseSensitive ? value : value.toLowerCase()
    return value
  }

  public mergeResult(res1: UnclassifiedDiff[], res2: UnclassifiedDiff[]) {
    return [...res1, ...res2]
  }  

  public compareResult(res: CompareResultDetails): UnclassifiedDiff[] {
    return res.action ? [res as any] : []
  }

  public compareAny(before: any, after: any, path: ObjPath = []): UnclassifiedDiff[] {
    if (typeOf(before) !== typeOf(after)) {
      return this.compareResult({ path, before, after, action: DiffAction.replace })
    }

    switch (typeOf(before)) {
      case "object": return this.compareObjects(before, after, path)
      case "array": return this.compareArrays(before, after, path)
      default:
        if (typeof before === "string") {
          before = this.normalizeString(before)
          after = this.normalizeString(after)
        }
        if (before !== after) {
          return this.compareResult({ path, before, after, action: DiffAction.replace })
        } else {
          return this.compareResult({ before, path })
        }
    }
  }

  public compareObjects(before: any, after: any, objPath: ObjPath, matchFunc?: MatchFunc) {
    const result: UnclassifiedDiff[] = []

    if (Object.keys(before).length === 0 && Object.keys(after).length === 0) {
      return this.compareResult({ before, path: objPath })
    }

    const beforeKeys = Object.keys(before)
    const afterKeys = new Set(Object.keys(after))
    
    for (const key of beforeKeys) {
      const afterKey = [...afterKeys].find((k) => k === key || (matchFunc && matchFunc(key, k)))
      const path = [...objPath, key]

      if (afterKey && afterKey !== key) {
        const diff = { path, before: key, after: afterKey, action: DiffAction.replace }
        this.mergeResult(result, this.compareResult(diff))
      }

      if (afterKey === undefined) {
        // deleted key
        const diff = { path, before: before[key], action: DiffAction.remove }
        this.mergeResult(result, this.compareResult(diff))
      } else {
        // updated value
        this.mergeResult(result, this.compareAny(before[key], after[afterKey], path))
        afterKeys.delete(afterKey)
      } 
    }

    for (const key of afterKeys) {
      // added key
      const diff = { path: [...objPath, key], after: after[key], action: DiffAction.add }
      this.mergeResult(result, this.compareResult(diff))
    }

    return result
  }

  public compareArrays(before: any[], after: any[], objPath: ObjPath, matchFunc?: MatchFunc) {
    if (before.length === 0 && after.length === 0) {
      return this.compareResult({ before, path: objPath })
    }

    if (!this.strictArrays && !matchFunc) {
      return this.compareEnums(before, after, objPath)
    }
    const result: UnclassifiedDiff[] = []
    const afterKeys = new Set(after.keys())

    for (const i of before.keys()) {
      const path = [...objPath, i]
      if (matchFunc) {
        const j = matchFunc && [...afterKeys].find((j) => matchFunc!(before[i], after[j]))
        if (j === undefined) {
          this.mergeResult(result, this.compareResult({ path, before: before[i], action: DiffAction.remove }))
        } else {
          afterKeys.delete(j)
          this.mergeResult(result, this.compareAny(before[i], after[j], path))
        }
      } else {
        if (i >= after.length) {
          this.mergeResult(result, this.compareResult({ path, before: before[i], action: DiffAction.remove }))
        } else {
          afterKeys.delete(i)
          this.mergeResult(result, this.compareAny(before[i], after[i], path))
        }
      }
    }

    for (const key of afterKeys) {
      this.mergeResult(result, this.compareResult({ path: [...objPath, -1], after: after[key], action: DiffAction.add }))
    }

    return result
  }

  public compareEnums(before: any[], after: any[], path: ObjPath) {
    const result: UnclassifiedDiff[] = []

    const itemsDiffs = []
    const beforeDiffs: any[] = []
    const afterEquals = new Set<number>()
    const beforeEquals = new Set<number>()

    for (let i = 0; i < before.length; i++) {
      let afterDiffs: Array<UnclassifiedDiff[] | UnclassifiedDiff>  = []
      for (let j = 0; j < after.length; j++) {
        if (afterEquals.has(j)) { continue }

        const diffs = this.compareAny(before[i], after[j], [...path, i])
        if (!diffs.length) {
          afterEquals.add(j)
          beforeEquals.add(i)
          afterDiffs = diffs
          break
        }
        afterDiffs[j] = diffs
      }
      beforeDiffs.push(afterDiffs)
    }
    
    for (let i = 0; i < before.length; i++) {
      const itemDiff = beforeDiffs[i]
      if (beforeEquals.has(i)) {
        // after has equal item
        itemsDiffs[i] = []
        this.mergeResult(result, itemDiff)
      } else {
        // find item with min diff count
        const afterIndexes = [ ...Array(after.length).keys() ]
        const minDiffs = afterIndexes.sort((a, b) => (itemDiff[a]?.diffs.length || 0) - (itemDiff[b]?.diffs.length || 0))
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
            this.mergeResult(result, itemDiff[minDiffIndex])
            beforeEquals.add(i)
            afterEquals.add(minDiffIndex)
            break
          }
        }

        if (!beforeEquals.has(i)) {
          const diff = { path: [...path, i], before: before[i], action: DiffAction.remove }
          this.mergeResult(result, this.compareResult(diff))
        }
      }
    }

    for (let j = 0; j < after.length; j++) {
      if (!afterEquals.has(j)) {
        const diff = { path: [...path, -1], after: after[j], action: DiffAction.add }
        this.mergeResult(result, this.compareResult(diff))
      }
    }

    return result
  }

}
