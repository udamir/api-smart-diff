import { CrawlContext, syncCrawl, SyncCrawlHook } from "json-crawl"

import { changeFactory, createMergeMeta, isArray, isObject, objectKeys, typeOf } from "./utils"
import { ComapreContext, CompareRules, CrawlRule } from "./rules"
import { mapObjectKeysRule, mapArraysKeysRule } from "./resolvers"
import { Diff, JsonNode, MergeState } from "./types"
import { DIFF_META_KEY } from "./constants"

export interface JsonMergeResult {
  diffs: Diff[]
  merged: JsonNode
}

interface MergeFactoryResult {
  diffs: Diff[]
  hook: SyncCrawlHook<MergeState, CrawlRule>
}

export type MergeOptions = {
  strictArrays?: boolean
  resolveUnchangedRefs?: boolean
  metaKey?: string | symbol
  arrayMeta?: boolean
  externalRefs?: {
    [key: string]: any
  }
  rules?: {
    classify: CompareRules
    // match: JsonMapTreeRules<MatchRule>
    // diffDoc: JsonMapTreeRules<MatchRule>
  }
}

const createContext = (before: any, after: any, ctx: CrawlContext<MergeState>): ComapreContext => {
  const { keyMap, bNode, aNode, aPath, root } = ctx.state
  return {
    before: { key: ctx.key, path: ctx.path, parent: bNode, value: before, source: root.before["#"] },
    after: { key: keyMap[ctx.key], path: aPath, parent: aNode, value: after, source: root.after["#"] }
  }
}

const mergedResult = (mNode: JsonNode, key: number | string, value: unknown) => {
  mNode[key] = value
  return { done: true } 
}

const useMergeFactory = (
  options: MergeOptions = {}
): MergeFactoryResult => {

  const _diffs: Diff[] = []
  const change = changeFactory<Diff>()
  const { arrayMeta, metaKey = DIFF_META_KEY } = options

  const hook: SyncCrawlHook<MergeState, CrawlRule> = (ctx) => {
    const { transformers, compare, mapping } = ctx.rules ?? {}
    const { keyMap, nodeDiffs, bNode, aNode, aPath, mNode } = ctx.state

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
  
    // compare via custom handler
    if (compare) {
      const { diffs, merged } = compare(createContext(before, after, ctx))
      nodeDiffs.push(...diffs)
      return mergedResult(mNode, akey, merged)
    }

    // types are different
    if (typeOf(before) !== typeOf(after)) {
      nodeDiffs.push(change.replaced(ctx.path, before, after))
      return mergedResult(mNode, akey, after)
    } 
    
    // compare objects or arrays
    if (isObject(before) && isObject(after)) {
      const _nodeDiffs: Diff[] = isArray(before) && !arrayMeta ? nodeDiffs : []
      const merged: any = isArray(before) ? [] : {}
      mNode[akey] = merged
      
      const mapKeys = mapping ?? isArray(before) ? mapArraysKeysRule : mapObjectKeysRule
      const { added, removed, mapped } = mapKeys(before as any, after as any)
      const renamed = isArray(before) ? [] : objectKeys(mapped).filter((key) => key !== mapped[key])

      _nodeDiffs.push(...removed.map((key) => change.removed([...ctx.path, key], before[key])))
      _nodeDiffs.push(...added.map((key) => change.added([...ctx.path, key], after[key])))
      _nodeDiffs.push(...renamed.map((key) => change.renamed(ctx.path, key, mapped[key])))

      const exitHook = () => {
        added.forEach((key) => merged[key] = after[key])
        
        if (!_nodeDiffs.length || (Array.isArray(before) && !arrayMeta)) { return }
        
        _diffs.push(..._nodeDiffs)
        merged[metaKey] = createMergeMeta(_nodeDiffs, ctx.path) 
      }

      const _state: MergeState = { 
        ...ctx.state,
        keyMap: mapped,
        aPath: [...aPath, akey],
        aNode: after,
        nodeDiffs: _nodeDiffs,
        mNode: merged,
      }

      return { value: before, state: _state, exitHook }
    }
    
    if (before !== after) {
      nodeDiffs.push(change.replaced(ctx.path, before, after))
    } 

    return mergedResult(mNode, akey, after)
  }

  return { diffs: _diffs, hook }
}

export const compare = (before: unknown, after: unknown, options: MergeOptions = {}): JsonMergeResult => {
  const { diffs, hook } = useMergeFactory(options)
  
  const root: MergeState["root"] = { before: { "#": before }, after: { "#": after }, merged: { "#": undefined } }
  const rootState: MergeState = { aPath: [], mNode: root.merged, bNode: root.before, aNode: root.after, keyMap: { "#": "#" }, nodeDiffs: diffs, root } 

  syncCrawl<MergeState, CrawlRule>(before, hook, { state: rootState })

  return { diffs, merged: root.merged["#"] }
}
