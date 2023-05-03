import { CrawlHook, crawl, explore, isObject } from "./crawler"
import { isRefNode, resolveRefNode } from "./resolver"
import { ApiDiffOptions } from "./types"
import { ObjPath } from "./types"
import { DiffType } from "./types"
import { ActionType } from "./types"
import { MatchFunc } from "./types"
import { Rules } from "./types"
import { buildPointer, mergeValues } from "./utils"

export type Diff = {
  action: ActionType
  path: ObjPath
  before?: any
  after?: any
  type: DiffType
}

export type JsonCompareOptions<T = Diff> = {
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  matchRules?: {
    [path: string]: MatchFunc
  }
  metaKey?: string | symbol
  arrayMeta?: boolean
  formatDiff?: (diff: Diff) => T
  resolveUnchangedRefs?: boolean
  rules?: Rules
  externalRefs?: {
    [key: string]: any
  }
}

export const allOfResolverHook = (data: any): CrawlHook<{}> => {

  const resolvedCache = new Map<string, any>() 

  return (value, ctx) => {
    // skip if no allOf
    if (!isObject(value) || !!value.allOf || !Array.isArray(value.allOf)) { 
      return { value }
    }

    const pointer = buildPointer(ctx.path)
    if (resolvedCache.has(pointer)) {
      return { value: resolvedCache.get(pointer) }
    }

    const { allOf, ...sibling } = value
    let node = {}
    for (const item of [...allOf, sibling]) {
      if (isRefNode) {
        // TODO save ref if cycle
        const resolved = isRefNode(item) ? resolveRefNode(data, item) : item
        node = mergeValues(node, resolved)
      } else {
        node = mergeValues(node, item)
      }
    }

    return { value: node }
  }
}

export const jsonDiff = <T = Diff>(before: unknown, after: unknown, options: ApiDiffOptions = {}): T[] => {

  const root = { "#": before }
  const diffs: T[] = []

  const hook: CrawlHook<T> = (value, ctx) => {

    return { value }
  }

  crawl(before, { path: [], key: "#", root, node: root }, hook)

  return diffs
}