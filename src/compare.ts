import { CrawlContext, syncCrawl, SyncCrawlHook } from "json-crawl"

import { changeFactory, convertDiffToMeta, createMergeMeta, isArray, isObject, objectKeys, typeOf } from "./utils"
import type { ComapreContext, ComapreRule, ComapreOptions, CompareResult, MergeMeta } from "./types"
import { mapObjectKeysRule, mapArraysKeysRule } from "./resolvers"
import type { Diff, JsonNode, MergeState } from "./types"
import { DIFF_META_KEY } from "./constants"

export interface MergeFactoryResult {
  diffs: Diff[]
  hook: SyncCrawlHook<MergeState, ComapreRule>
}

const createContext = (before: any, after: any, ctx: CrawlContext<MergeState>, options: ComapreOptions): ComapreContext => {
  const { keyMap, bNode, aNode, aPath, root } = ctx.state
  return {
    before: { key: ctx.key, path: ctx.path, parent: bNode, value: before, root: root.before["#"] },
    after: { key: keyMap[ctx.key], path: aPath, parent: aNode, value: after, root: root.after["#"] },
    options
  }
}

const mergedResult = (mNode: JsonNode, key: number | string, value: unknown) => {
  mNode[key] = value
  return { done: true } 
}

const setMergeMeta = (parentMeta: MergeMeta, key: string | number, diff: Diff) => {
  parentMeta[key] = convertDiffToMeta(diff)
  return diff
}

const useMergeFactory = (options: ComapreOptions = {}): MergeFactoryResult => {
  const _diffs: Diff[] = []
  const change = changeFactory<Diff>()
  const { arrayMeta, metaKey = DIFF_META_KEY } = options

  const hook: SyncCrawlHook<MergeState, ComapreRule> = (ctx) => {
    const { transformers, compare, mapping } = ctx.rules ?? {}
    const { keyMap, parentMeta, bNode, aNode, aPath, mNode } = ctx.state

    const bkey = ctx.key ?? "#"
    const akey = keyMap[bkey]

    // skip if node was removed
    if (!(bkey in keyMap)) { 
      return mergedResult(mNode, bkey, ctx.value)
    }

    // transform values before comparison
    const data: [unknown, unknown] = [ctx.value, aNode[akey]]
    const [before, after] = transformers?.reduce((res, t) => t(...res), data) ?? data
    // save transformed values to root nodes
    bNode[bkey] = before
    aNode[akey] = after
    if (aPath.length || akey !== "#") {
      aPath.push(akey)
    }

    // compare via custom handler
    const compared = compare?.(createContext(before, after, ctx, options))
    if (compared) {
      const { diffs, merged, rootMergeMeta } = compared
      _diffs.push(...diffs.map((diff) => ({ ...diff, path: [...aPath, akey, ...diff.path]})))
      if (rootMergeMeta) { 
        parentMeta[akey] = { array: rootMergeMeta }
      }
      return mergedResult(mNode, akey, merged)
    }

    // types are different
    if (typeOf(before) !== typeOf(after)) {
      _diffs.push(setMergeMeta(parentMeta, akey, change.replaced(ctx.path, before, after)))
      return mergedResult(mNode, akey, after)
    } 
    
    // compare objects or arrays
    if (isObject(before) && isObject(after)) {
      const _nodeDiffs: Diff[] = []
      const merged: any = isArray(before) ? [] : {}
      mNode[akey] = merged
      
      const mapKeys = mapping ?? (isArray(before) ? mapArraysKeysRule : mapObjectKeysRule)
      const { added, removed, mapped } = mapKeys(before as any, after as any)
      const renamed = isArray(before) ? [] : objectKeys(mapped).filter((key) => key !== mapped[key])

      _nodeDiffs.push(...removed.map((key) => change.removed([...ctx.path, key], before[key])))
      _nodeDiffs.push(...added.map((key) => change.added([...ctx.path, key], after[key])))
      _nodeDiffs.push(...renamed.map((key) => change.renamed(ctx.path, key, mapped[key])))

      _diffs.push(..._nodeDiffs)
      
      const nodeMeta = createMergeMeta(_nodeDiffs) ?? {}
      
      const exitHook = () => {
        added.forEach((key) => merged[key] = after[key])

        if (!Object.keys(nodeMeta).length) { return }

        if (isArray(merged) && !arrayMeta) { 
          parentMeta[akey] = { array: nodeMeta }
        } else {
          merged[metaKey] = nodeMeta
        }
      }

      const _state: MergeState<string | number> = { 
        ...ctx.state,
        keyMap: mapped,
        aPath: [...aPath],
        bNode: before,
        aNode: after,
        parentMeta: nodeMeta,
        mNode: merged,
      }

      return { value: before, state: _state, exitHook }
    }
    
    if (before !== after) {
      _diffs.push(setMergeMeta(parentMeta, akey, change.replaced(ctx.path, before, after)))
    } 

    return mergedResult(mNode, akey, after)
  }

  return { diffs: _diffs, hook }
}

export const compare = (before: unknown, after: unknown, options: ComapreOptions = {}): CompareResult => {
  const { diffs, hook } = useMergeFactory(options)
  
  const root: MergeState["root"] = { 
    before: { "#": before }, 
    after: { "#": after }, 
    merged: { "#": undefined } 
  }

  const rootState: MergeState = { 
    aPath: [],
    mNode: root.merged,
    bNode: root.before,
    aNode: root.after,
    keyMap: { "#": "#" },
    parentMeta: {},
    root
  } 

  syncCrawl<MergeState, ComapreRule>(before, hook, { state: rootState, rules: options.rules })

  return { diffs, merged: root.merged["#"], rootMergeMeta: rootState.parentMeta?.["#"] }
}
