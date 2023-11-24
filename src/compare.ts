import { JsonPath, syncCrawl, SyncCrawlHook } from "json-crawl"

import { changeFactory, convertDiffToMeta, createMergeMeta, isArray, isObject, objectKeys, typeOf } from "./utils"
import type { ComapreContext, CompareRule, ComapreOptions, CompareResult, MergeMeta } from "./types"
import { mapObjectKeysRule, mapArraysKeysRule } from "./resolvers"
import type { Diff, JsonNode, MergeState } from "./types"
import { DIFF_META_KEY } from "./constants"

export interface MergeFactoryResult {
  diffs: Diff[]
  hook: SyncCrawlHook<MergeState, CompareRule>
}

export interface ContextInput extends MergeState {
  before: any
  after: any
  bPath: JsonPath
  akey: string | number
  bkey: string | number
}

const createContext = (data: ContextInput, options: ComapreOptions): ComapreContext => {
  const { bNode, aNode, aPath, root, akey, bkey, bPath, before, after } = data
  const afterPath = (aPath.length || akey !== "#") ? [...aPath, akey] : []
  return {
    before: { key: bkey, path: bPath, parent: bNode, value: before, root: root.before["#"] },
    after: { key: akey, path: afterPath, parent: aNode, value: after, root: root.after["#"] },
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

  const hook: SyncCrawlHook<MergeState, CompareRule> = (crawlContext) => {
    const { rules = {}, state, value, key: bkey = "#", path: bPath } = crawlContext
    const { transformers, compare, mapping } = rules
    const { keyMap, parentMeta, bNode, aNode, aPath, mNode } = state

    const akey = keyMap[bkey]

    // skip if node was removed
    if (!(bkey in keyMap)) { 
      return mergedResult(mNode, bkey, value)
    }

    // transform values before comparison
    const data: [unknown, unknown] = [value, aNode[akey]]
    const [before, after] = !isArray(value) && transformers ? transformers.reduce((res, t) => t(...res), data) : data
    // save transformed values to root nodes
    bNode[bkey] = before
    aNode[akey] = after

    // compare via custom handler
    const ctx = createContext({ ...crawlContext.state, before, after, akey, bkey, bPath }, { ...options, rules })
    const compared = compare?.(ctx)
    if (compared) {
      const { diffs, merged, rootMergeMeta } = compared

      _diffs.push(...(aPath.length || akey !== "#") 
        ? diffs.map((diff) => ({ ...diff, path: [...aPath, akey, ...diff.path]}))
        : diffs 
      )
      if (rootMergeMeta) { 
        parentMeta[akey] = rootMergeMeta
      }
      return mergedResult(mNode, akey, merged)
    }

    // types are different
    if (typeOf(before) !== typeOf(after)) {
      _diffs.push(setMergeMeta(parentMeta, akey, change.replaced(bPath, before, after, ctx)))
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

      _nodeDiffs.push(...removed.map((key) => change.removed([...bPath, key], before[key], ctx)))
      _nodeDiffs.push(...added.map((key) => change.added([...bPath, key], after[key], ctx)))
      _nodeDiffs.push(...renamed.map((key) => change.renamed(bPath, key, mapped[key], ctx)))

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
        ...crawlContext.state,
        keyMap: mapped,
        aPath: (aPath.length || akey !== "#") ? [...aPath, akey] : [],
        bNode: before,
        aNode: after,
        parentMeta: nodeMeta,
        mNode: merged,
      }

      return { value: before, state: _state, exitHook }
    }
    
    if (before !== after) {
      _diffs.push(setMergeMeta(parentMeta, akey, change.replaced(bPath, before, after, ctx)))
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

  syncCrawl<MergeState, CompareRule>(before, hook, { state: rootState, rules: options.rules })

  return { diffs, merged: root.merged["#"], rootMergeMeta: rootState.parentMeta?.["#"] }
}
