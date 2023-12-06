import { JsonPath, syncCrawl, SyncCrawlHook } from "json-crawl"

import { changeFactory, convertDiffToMeta, createMergeMeta, getValueByPath, isArray, isObject, objectKeys, typeOf } from "./utils"
import type { ComapreContext, CompareRule, ComapreOptions, CompareResult, MergeMeta, SourceContext } from "./types"
import { mapObjectKeysRule, mapArraysKeysRule } from "./mapping"
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
  const beforePath = (bPath.length || bkey !== "#") ? [...bPath, bkey] : []
  const afterPath = (aPath.length || akey !== "#") ? [...aPath, akey] : []
  return {
    before: { key: bkey, path: beforePath, parent: bNode, value: before, root: root.before["#"] },
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
    const { rules = {}, state, value, key } = crawlContext
    const { transform, compare, mapping } = rules
    const { keyMap, parentMeta, bNode, aNode, aPath, bPath, mNode } = state

    const bkey = key ?? Object.keys(keyMap).pop()
    const akey = keyMap[bkey]

    // skip if node was removed
    if (!(bkey in keyMap)) { 
      return mergedResult(mNode, bkey, value)
    }

    // transform values before comparison
    const data: [unknown, unknown] = [value, aNode[akey]]
    const [before, after] = !isArray(value) && transform ? transform.reduce((res, t) => t(...res), data) : data
    // save transformed values to root nodes
    bNode[bkey] = before
    aNode[akey] = after

    // compare via custom handler
    const ctx = createContext({ ...state, before, after, akey, bkey }, { ...options, rules })
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
      _nodeDiffs.push(...renamed.map((key) => change.renamed(bPath, key, mapped[key], ctx)))

      _diffs.push(..._nodeDiffs)
      
      const nodeMeta = createMergeMeta(_nodeDiffs) ?? {}
      
      const exitHook = () => {
        added.forEach((key) => {
          const diff = change.added([...bPath, key], after[key], ctx) 
          
          nodeMeta[key] = convertDiffToMeta(diff)
          merged[key] = after[key]

          _diffs.push(diff)
        })

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
        bPath: (bPath.length || bkey !== "#") ? [...bPath, bkey] : [],
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

export const compare = (before: unknown, after: unknown, options: ComapreOptions = {}, context: SourceContext = {}): CompareResult => {
  // set default context if not assigned
  const { jsonPath: _bPath = [], source: bSource = before } = context.before ?? {}
  const { jsonPath: _aPath = [], source: aSource = after } = context.after ?? {}

  const root: MergeState["root"] = { 
    before: { "#": bSource }, 
    after: { "#": aSource }, 
    merged: {} 
  }

  const bPath = _bPath.slice(0, -1)
  const aPath = _aPath.slice(0, -1)

  const bNode = bPath.length ? getValueByPath(bSource, ...bPath) : root.before
  const aNode = aPath.length ? getValueByPath(aSource, ...aPath) : root.after

  if (!isObject(bNode) || !isObject(aNode)) {
    // TODO
    throw new Error("")
  }

  const bKey = bPath.length ? _bPath[bPath.length] : "#" 
  const aKey = aPath.length ? _aPath[aPath.length] : "#" 

  bNode[bKey] = before
  aNode[aKey] = after

  const { diffs, hook } = useMergeFactory(options)  

  const rootState: MergeState = { 
    aPath,
    bPath,
    mNode: root.merged,
    bNode,
    aNode,
    keyMap: { [bKey]: aKey },
    parentMeta: {},
    root,
  } 

  syncCrawl<MergeState, CompareRule>(before, hook, { state: rootState, rules: options.rules })

  return { diffs, merged: root.merged[aKey], rootMergeMeta: rootState.parentMeta?.[aKey] }
}
