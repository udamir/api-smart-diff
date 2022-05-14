import { ObjPath, JsonCompareOptions, MatchFunc, JsonDiff, CompareResult, JsonMergedMeta } from "./types"
import { typeOf, replaced, unchanged, added, removed, renamed, buildPath, isEmptyObject } from "./utils"
import { DiffAction, DIFF_META_KEY } from "./constants"

type EnumCompareResult<D extends JsonDiff = JsonDiff> = { value: any, res: CompareResult<D>, diffs?: number }

export class JsonCompare<D extends JsonDiff = JsonDiff, T extends CompareResult<D> = CompareResult<D>> {
  public trimStrings?: boolean
  public caseSensitive?: boolean
  public strictArrays?: boolean
  public matchRules: { [path: string]: MatchFunc }
  public diffKey: string | symbol
  public arrayMeta?: boolean
  public formatMergedMeta: (diff: D) => any
  private _merged: any = {}

  public get merged() { return this._merged.value }

  constructor(public before: any, public after: any, options: JsonCompareOptions = {}) {
    this.trimStrings = options.trimStrings 
    this.caseSensitive = options.caseSensitive 
    this.strictArrays = options.strictArrays
    this.matchRules = options.matchRules || {}
    this.diffKey = options.metaKey || DIFF_META_KEY
    this.arrayMeta = options.arrayMeta 
    this.formatMergedMeta = options.formatMergedMeta || this._formatMergeMeta.bind(this)
  }

  protected _formatMergeMeta = (diff: D): JsonMergedMeta => {
    return { 
      action: diff.action,
      ...diff.action === DiffAction.replace ? { replaced: diff.before } : {}
    } 
  }

  private setMeta(obj: any, key: string | number, meta: any) {
    if (obj[this.diffKey] === undefined) {
      obj[this.diffKey] = {}
    }
    obj[this.diffKey][key] = meta
  }

  private checkMatch(path: ObjPath, before: any, after: any, bKey: string | number, aKey: string | number): boolean {
    const matchFunc = this.getMatchFunc(path)
    return matchFunc ? matchFunc({
      path,
      before: { key: bKey, value: before[bKey], parent: before, source: this.before },
      after: { key: aKey, value: after[aKey], parent: after, source: this.after }
    }) : false
  }

  protected getMatchFunc(path: ObjPath): MatchFunc | undefined {
    // TODO: support masked path
    const strPath = buildPath(path)
    return this.matchRules[strPath]
  }

  public compare(): D[] {
    return this.compareAny(this.before, this.after).diffs
  }

  public buildDiffTree() {
    return this.compareAny(this.before, this.after).diffTree
  }

  public merge(): any {
    this.compareAny(this.before, this.after)
    return this._merged.value
  }

  public normalizeString(value: string) {
    value = this.trimStrings ? value.trim() : value
    value = this.caseSensitive ? value : value.toLowerCase()
    return value
  }

  public mergeResults(results: { [key: string]: CompareResult<D> }, merged: any, array = false): T {
    const res: CompareResult = { diffs: [], diffTree: {} }
    for (let key of Object.keys(results)) {
      const { diffs, diff, diffTree, parentMeta } = results[key]
      if (diff && diff.action !== DiffAction.test) {
        const { path, ...rest } = diff
        const i = path[path.length - 1]
        this.setMeta(res.diffTree, i, rest)
        res.diffs.push(diff)
        if (array && !this.arrayMeta) {
          if (res.parentMeta === undefined) { 
            res.parentMeta = {} 
          }
          res.parentMeta[i] = this.formatMergedMeta(diff)
        } else {
          this.setMeta(merged, i, this.formatMergedMeta(diff))
        }
        if (i !== (array ? +key : key)) {
          continue
        }
      } else {
        if (diffs.length) {
          res.diffTree[key] = diffTree
          res.diffs.push(...diffs)
        }
        if (parentMeta) {
          this.setMeta(merged, array ? +key : key, { array: parentMeta })
        }
      }
    }
    return res as T
  }

  public mergeValue({ action, before, after }: JsonDiff) {
    return (action === DiffAction.test || action === DiffAction.remove) ? before : after
  }

  public compareResult(diff: JsonDiff): T {
    const res: CompareResult = diff.action === DiffAction.test
      ? { diffs: [], diff }
      : { diffs: [diff], diff }
    return res as T
  }

  public compareAny(before: any, after: any, path: ObjPath = [], merged: any = this._merged, key: string | number = "value"): T {
    if (typeOf(before) !== typeOf(after)) {
      merged[key] = after
      return this.compareResult(replaced(path, before, after))
    }

    switch (typeOf(before)) {
      case "object": 
        merged[key] = {}
        return this.compareObjects(before, after, path, merged[key])
      case "array": 
        merged[key] = []
        return this.compareArrays(before, after, path, merged[key])
      default:
        const equal = typeof before === "string" 
          ? this.normalizeString(before) === this.normalizeString(after)
          : before === after
        const diff = equal ? unchanged(path, before) : replaced(path, before, after)
        merged[key] = this.mergeValue(diff)
        return this.compareResult(diff)
    }
  }

  public compareObjects(before: any, after: any, path: ObjPath, merged: any): T {
    const result: { [key: string]: CompareResult<D> } = {}

    if (isEmptyObject(before) && isEmptyObject(after)) {
      return this.compareResult(unchanged(path, before))
    }

    const beforeKeys = Object.keys(before)
    const afterKeys = new Set(Object.keys(after))
    
    for (const key of beforeKeys) {
      const afterKey = [...afterKeys].find((k) => k === key || (this.checkMatch(path, before, after, key, k)))

      // renamed key 
      if (afterKey && afterKey !== key) {
        result[afterKey] = this.compareResult(renamed(path, key, afterKey))
      }

      if (afterKey === undefined) {
        // deleted key
        const diff = removed([...path, key], before[key])
        merged[key] = this.mergeValue(diff)
        result[key] = this.compareResult(diff)
      } else {
        // updated key value
        result[key] = this.compareAny(before[key], after[afterKey], [...path, key], merged, afterKey)
        afterKeys.delete(afterKey)
      } 
    }

    for (const key of afterKeys) {
      // added key
      const diff = added([...path, key], after[key])
      merged[key] = this.mergeValue(diff)
      result[key] = this.compareResult(diff)
    }

    return this.mergeResults(result, merged)
  }

  public compareArrays(before: any[], after: any[], path: ObjPath, merged: any): T {
    if (before.length === 0 && after.length === 0) {
      return this.compareResult(unchanged(path, before))
    }

    const matchFunc = this.getMatchFunc(path)
    if (!this.strictArrays && !matchFunc) {
      return this.compareEnums(before, after, path, merged)
    }
    const result: { [key: number]: CompareResult<D> } = {}
    const afterKeys = new Set(after.keys())

    for (const i of before.keys()) {
      const itemPath = [...path, i]
      const j = matchFunc ? [...afterKeys].find((k) => this.checkMatch(path, before, after, i, k)) : i
      if (j === undefined || j >= after.length) {
        const diff = removed(itemPath, before[i])
        merged[i] = this.mergeValue(diff)
        result[i] = this.compareResult(diff)
      } else {
        afterKeys.delete(j)
        result[i] = this.compareAny(before[i], after[j], itemPath, merged, i)
      }
    }

    let i = before.length
    for (const key of afterKeys) {
      const diff = added([...path, i], after[key])
      merged[i] = this.mergeValue(diff)
      result[i++] = this.compareResult(diff)
    }

    return this.mergeResults(result, merged, true)
  }

  public compareEnums(before: any[], after: any[], path: ObjPath, merged: any): T {
    const result: { [key: number]: CompareResult<D> } = {}

    const itemsDiffs = []
    const beforeDiffs: (EnumCompareResult<D>[] | EnumCompareResult<D>)[] = []
    const afterEquals = new Set<number>()
    const beforeEquals = new Set<number>()

    for (const i of before.keys()) {
      let afterDiffs: EnumCompareResult<D>[] | EnumCompareResult<D> = []
      for (const j of after.keys()) {
        if (afterEquals.has(j)) { continue }
        const _merged: any = {}
        const res = this.compareAny(before[i], after[j], [...path, i], _merged)
        if (!res.diffs.length) {
          afterEquals.add(j)
          beforeEquals.add(i)
          afterDiffs = { value: _merged.value, res }
          break
        }
        afterDiffs[j] = { value: _merged.value, res, diffs: typeof before[i] === typeof after[j] ? res.diffs.length : -1 }
      }
      beforeDiffs.push(afterDiffs)
    }
    
    for (const i of before.keys()) {
      const itemRes = beforeDiffs[i]
      if (!Array.isArray(itemRes)) {
        // after has equal item
        itemsDiffs[i] = []
        merged[i] = itemRes.value
        result[i] = itemRes.res
      } else {
        // find item with min diff count
        const afterIndexes = [...Array(after.length).keys()].filter((a) => (itemRes[a]?.diffs || 0) >= 0)
        
        const minDiffs = afterIndexes.sort((a, b) => (itemRes[a]?.diffs || 0) - (itemRes[b]?.diffs || 0))
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
            const { value, res } = itemRes[minDiffIndex]
            merged[i] = value
            result[i] = res
            beforeEquals.add(i)
            afterEquals.add(minDiffIndex)
            break
          }
        }

        if (!beforeEquals.has(i)) {
          const diff = removed([...path, i], before[i])
          merged[i] = this.mergeValue(diff)
          result[i] = this.compareResult(diff)
        }
      }
    }

    let i = before.length
    for (let j of after.keys()) {
      if (!afterEquals.has(j)) {
        const diff = added([...path, i], after[j])
        merged[i] = this.mergeValue(diff)
        result[i++] = this.compareResult(diff)
      }
    }

    return this.mergeResults(result, merged, true)
  }
}
