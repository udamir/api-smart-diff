import { DiffAction } from "../constants";
import { ObjPath } from "../types";
import { JsonMergeResult, jsonMerge } from "./jsonMerge";
import { Diff, FormatDiffFunc, MergeMeta } from "./types";

// export const mapKeys = <T>(before: JsonNode, after: JsonNode): MapKeysResult<number> => {

export class MapArray<K, V> extends Map<K, Array<V>> {
  public add(key: K, value: V): this {
    const arr = this.get(key)
    if (arr) {
      arr.push(value)
    } else {
      this.set(key, [value])
    }
    return this
  }
}

export const changeFactory = <T extends Diff>(formatDiffFunc?: FormatDiffFunc<T>) => {
  const formatDiff = formatDiffFunc ? formatDiffFunc : ((diff: Diff) => diff as T)
  return {
    added: (path: ObjPath, after: unknown): T => formatDiff({ path, after, action: DiffAction.add }),
    removed: (path: ObjPath, before: unknown): T => formatDiff({ path, before, action: DiffAction.remove }),
    replaced: (path: ObjPath, before: unknown, after: unknown): T => formatDiff({ path, before, after, action: DiffAction.replace }),
    renamed: (path: ObjPath, before: unknown, after: unknown): T => formatDiff({ path, before, after, action: DiffAction.rename }),
  }
}

export const createMergeMeta = <T extends Diff>(diffs: T[], path: ObjPath): MergeMeta<T> => {
  const meta: any = {}

  for (const diff of diffs) {
    if (diff.path.length === path.length + 1) {
      const key = diff.path[diff.path.length - 1]
      meta[key] = diff
    } else {
      const key = diff.path[diff.path.length - 2]
      meta[key] = Array.isArray(meta[key]) ? meta[key].push(diff) : [diff]
    }
  }

  return meta
}
