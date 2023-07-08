import { JsonPath } from "json-crawl"
import { DiffAction } from "./constants"

import { Diff, FormatDiffFunc, MergeMeta } from "./types"

// import { JsonMergeResult, jsonMerge } from "./jsonMerge";
// export const mapKeys = <T>(before: JsonNode, after: JsonNode): MapKeysResult<number> => {
  
export const typeOf = (value: unknown): string  => {
  if (Array.isArray(value)) {
    return "array"
  }
  return value == null ? "null" : typeof value
}

export const changeFactory = <T extends Diff>(formatDiffFunc?: FormatDiffFunc<T>) => {
  const formatDiff = formatDiffFunc ? formatDiffFunc : ((diff: Diff) => diff as T)
  return {
    added: (path: JsonPath, after: unknown): T => formatDiff({ path, after, action: DiffAction.add }),
    removed: (path: JsonPath, before: unknown): T => formatDiff({ path, before, action: DiffAction.remove }),
    replaced: (path: JsonPath, before: unknown, after: unknown): T => formatDiff({ path, before, after, action: DiffAction.replace }),
    renamed: (path: JsonPath, before: unknown, after: unknown): T => formatDiff({ path, before, after, action: DiffAction.rename }),
  }
}

export const createMergeMeta = <T extends Diff>(diffs: T[], path: JsonPath): MergeMeta<T> => {
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
