import { JsonDiff, MergeResult, JsonMergeOptions, JsonMergedMeta } from "./types"
import { JsonCompare } from "./jsonCompare"
import { DiffAction } from "./constants"

export class JsonMerge<D extends JsonDiff = JsonDiff, T extends MergeResult<D> = MergeResult<D>> extends JsonCompare<D, T> {
  public arrayMeta?: boolean
  public formatMergedMeta: (diff: D) => any

  constructor(before: any, after: any, options: JsonMergeOptions<D>) {
    super(before, after, options)
    this.arrayMeta = options.arrayMeta 
    this.formatMergedMeta = options.formatMergedMeta || this._formatMergeMeta.bind(this)
  }

  protected _formatMergeMeta = (diff: D): JsonMergedMeta => {
    return { 
      action: diff.action,
      ...diff.action === DiffAction.replace ? { replaced: diff.before } : {}
    } 
  }

  public merge(): JsonDiff[] {
    return this.compareAny(this.before, this.after).value
  }

  public mergeResults(results: { [key: string]: MergeResult<D> }, array = false): T {
    const res: MergeResult = { diffs: [], diffTree: {}, value: array ? [] : {} }
    for (const key of Object.keys(results)) {
      const { diffs, diff, diffTree, value, meta } = results[key]
      if (diff && diff.action !== DiffAction.test) {
        const { path, ...rest } = diff
        res.diffTree[this.diffKey] = rest
        res.diffs.push(diff)
        res.value[this.diffKey] = this.formatMergedMeta(diff)
      } else {
        if (diffs.length) {
          res.diffTree[key] = diffTree
          res.diffs.push(...diffs)
        }
        if (meta) {
          res.value[this.diffKey] = meta
        }
      }
      res.value[array ? +key : key] = value      
    }
    return res as T
  }

  public compareResult(diff: JsonDiff): T {
    const res: MergeResult = diff.action === DiffAction.test
      ? { diffs: [], diff, value: diff.before }
      : { diffs: [diff], diff, value: DiffAction.remove ? diff.before : diff.after }
    return res as T
  }
}
