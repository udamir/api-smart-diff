import { ObjPath, UnclassifiedDiff, CompareOptions } from "./types"
import { DiffAction, DIFF_META_KEY } from "./constants"
import { classifyDiff } from "./classifier"
import { CompareContext } from "./context"
import { MergeResult } from "./merge"
import { compare } from "./compare"

export const apiDiffTree = (before: any, after: any, options: CompareOptions = {}): any => {
  const { diffTree } = compare(before, after, new DiffTreeContext(before, after, options))
  return diffTree
}

export interface DiffTreeResult extends MergeResult {
  diffTree?: any
}

export class DiffTreeContext extends CompareContext<DiffTreeResult> {
  public metaKey = DIFF_META_KEY
  public merged: any

  public equalResult(value: any, path: ObjPath) {
    const result: DiffTreeResult = {
      diffs: [],
      value,
      path
    }
    return result
  }

  public diffResult (diff: UnclassifiedDiff): DiffTreeResult {
    const result: DiffTreeResult = {
      diffs: [classifyDiff(diff, this.before, this.rules)],
      diff: classifyDiff(diff, this.before, this.rules),
      path: diff.path
    }
    return result
  }

  public mergeResult(parent: DiffTreeResult, child: DiffTreeResult) {
    // merge object properties or array items
    parent.diffs = [...parent.diffs, ...child.diffs]
    
    let key = child.path[child.path.length - 1]
    const array = typeof key === "number"
    const value = parent.value ? parent.value : array ? [] : {}
    const diffTree = parent.diffTree ? parent.diffTree : {}

    key = key === -1 ? value.length : key

    if (child.diff) {
      if (child.diff.action === DiffAction.remove) {
        value[key] = child.diff.before
      } else {
        value[key] = child.diff.after
      }
        
      const { path, ...meta } = child.diff
      diffTree[this.metaKey] = { ...diffTree[this.metaKey], [key]: meta }
    } else {
      value[key] = child.value
      if (child.diffTree !== undefined && Object.keys(child.diffTree).length) {
        diffTree[key] = child.diffTree
      }
      if (child.meta) {
        diffTree[this.metaKey] = { ...diffTree[this.metaKey], [key]: child.meta }
      }
    }
    
    parent.value = value
    parent.diffTree = diffTree
    parent.path = child.path.slice(0, -1)
  } 
}
