import { MergeOptions, Diff, MergedKeyMeta, ObjPath, UnclassifiedDiff } from "./types"
import { CompareContext, CompareResult } from "./context"
import { DiffAction, DIFF_META_KEY } from "./constants"
import { classifyDiff } from "./classifier"
import { compare } from "./compare"
import { typeOf } from "./utils"

export const apiMerge = (before: any, after: any, options: MergeOptions): any => {
  const { value } = compare(before, after, new MergeContext(before, after, options))
  return value
}

export interface MergeResult extends CompareResult {
  diff?: Diff
  meta?: any
  value?: any
  path: ObjPath
}

export class MergeContext extends CompareContext<MergeResult> {
  public formatMeta: (diff: Diff) => MergedKeyMeta
  public metaKey: string | symbol
  public arrayMeta?: boolean
  public merged: any

  constructor(before: any, after: any, options: MergeOptions) {
    super(before, after, options)
    this.formatMeta = options.formatMeta || ((d: Diff) => this._formatMeta(d))
    this.metaKey = options.metaKey || DIFF_META_KEY
    this.arrayMeta = options.arrayMeta || false
  }

  private _formatMeta = (diff: Diff): MergedKeyMeta => {
    return { 
      type: diff.type,
      action: diff.action,
      ...diff.action === DiffAction.replace ? { replaced: diff.before } : {}
    } 
  }

  public equalResult(value: any, path: ObjPath) {
    const result: MergeResult = {
      diffs: [],
      value,
      path
    }
    return result
  }

  public diffResult (diff: UnclassifiedDiff): MergeResult {
    const result: MergeResult = {
      diffs: [classifyDiff(diff, this.before, this.rules)],
      diff: classifyDiff(diff, this.before, this.rules),
      path: diff.path
    }
    return result
  }

  public mergeResult(parent: MergeResult, child: MergeResult) {
    // merge object properties or array items
    parent.diffs = [...parent.diffs, ...child.diffs]

    let key = child.path[child.path.length - 1]
    const array = typeof key === "number"
    const value = parent.value ? parent.value : array ? [] : {}

    key = key === -1 ? value.length : key

    if (child.diff) {
      if (child.diff.action === DiffAction.remove) {
        value[key] = child.diff.before
      } else {
        value[key] = child.diff.after
      }
        
      const meta = this.formatMeta(child.diff)
      if (typeOf(value) === "array" && !this.arrayMeta) {
        parent.meta = { array: { ...parent.meta?.array, [key]: meta }}
      } else {
        value[this.metaKey] = { ...value[this.metaKey], [key]: meta }
      }
    } else {
      value[key] = child.value
      if (child.meta) {
        value[this.metaKey] = { [key]: child.meta }
      }
    }

    parent.value = value
    parent.path = child.path.slice(0, -1)
  } 
}
