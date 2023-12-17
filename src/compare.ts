import { getNodeRules, syncCrawl, SyncCrawlHook } from "json-crawl"

import type { 
  ComapreContext, CompareRule, ComapreOptions, CompareResult, MergeMeta, 
  SourceContext, ContextInput, MergeFactoryResult, CompareEngine
} from "./types"
import { 
  diffFactory, convertDiffToMeta, createMergeMeta, getKeyValue, isArray, 
  isNumber, isObject, objectKeys, typeOf 
} from "./utils"
import { objectMappingResolver, arrayMappingResolver } from "./mapping"
import type { Diff, JsonNode, MergeState } from "./types"
import { DIFF_META_KEY } from "./constants"

export const createContext = (data: ContextInput, options: ComapreOptions): ComapreContext => {
  const { bNode, aNode, aPath, root, akey, bkey, bPath, before, after, rules } = data
  const beforePath = (bPath.length || bkey !== "#") ? [...bPath, bkey] : []
  const afterPath = (aPath.length || akey !== "#") ? [...aPath, akey] : []
  return {
    before: { key: bkey, path: beforePath, parent: bNode, value: before, root: root.before["#"] },
    after: { key: akey, path: afterPath, parent: aNode, value: after, root: root.after["#"] },
    rules,
    options
  }
}

export const createChildContext = ({ before, after, rules, options}: ComapreContext, bkey: number | string, akey: number | string): ComapreContext => {
  const bValue = getKeyValue(before.value, bkey)
  const aValue = getKeyValue(after.value, akey)
  return { 
    before: { path: [...before.path, bkey], key: bkey, value: bValue, parent: before.value, root: before.root },
    after: { path: [...after.path, akey], key: akey, value: aValue, parent: after.value, root: after.root },
    rules: getNodeRules(rules, bkey || akey, bkey ? before.path : after.path, bkey ? bValue : aValue) ?? {},
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
  const { arrayMeta, metaKey = DIFF_META_KEY } = options

  const hook: SyncCrawlHook<MergeState, CompareRule> = (crawlContext) => {
    const { rules = {}, state, value, key } = crawlContext
    const { transform, compare, mapping, skip } = rules
    const { keyMap, parentMeta, bNode, aNode, mNode } = state

    const bkey = key ?? (isArray(bNode) ? +Object.keys(keyMap).pop()! : Object.keys(keyMap).pop())
    const akey = keyMap[bkey]
    const mkey = isArray(mNode) && isNumber(bkey) ? bkey : akey

    // skip if node was removed
    if (skip || !(bkey in keyMap)) { 
      return mergedResult(mNode, bkey, value)
    }

    const bPath = (!state.bPath.length && bkey === "#") ? [] : [...state.bPath, bkey]
    const aPath = (!state.aPath.length && akey === "#") ? [] : [...state.aPath, akey]

    // transform values before comparison
    const data: [unknown, unknown] = [value, aNode[akey]]
    const [before, after] = !isArray(value) && transform ? transform.reduce((res, t) => t(...res), data) : data
    // save transformed values to root nodes
    bNode[bkey] = before
    aNode[akey] = after

    // compare via custom handler
    const ctx = createContext({ ...state, before, after, akey, bkey, rules }, options)
    const compared = compare?.(ctx)
    if (compared) {
      const { diffs, merged, rootMergeMeta } = compared

      _diffs.push(...diffs)
      if (rootMergeMeta) { 
        parentMeta[akey] = rootMergeMeta
      }
      // TODO: check akey for arrays
      return mergedResult(mNode, mkey, merged)
    }

    // types are different
    if (typeOf(before) !== typeOf(after)) {
      _diffs.push(setMergeMeta(parentMeta, akey, diffFactory.replaced(bPath, before, after, ctx)))
      return mergedResult(mNode, mkey, after)
    } 
    
    // compare objects or arrays
    if (isObject(before) && isObject(after)) {
      const _nodeDiffs: Diff[] = []
      const merged: any = isArray(before) ? [] : {}

      mNode[mkey] = merged

      const mapKeys = mapping ?? (isArray(before) ? arrayMappingResolver : objectMappingResolver)
      const { added, removed, mapped } = mapKeys(before as any, after as any, ctx)
      const renamed = isArray(before) ? [] : objectKeys(mapped).filter((key) => key !== mapped[key])

      _nodeDiffs.push(...removed.map((k) => diffFactory.removed([...bPath, k], before[k], createChildContext(ctx, k, ""))))
      _nodeDiffs.push(...renamed.map((k) => diffFactory.renamed(bPath, k, mapped[k], createChildContext(ctx, k, mapped[k]))))

      _diffs.push(..._nodeDiffs)
      
      const nodeMeta = createMergeMeta(_nodeDiffs) ?? {}
      
      const exitHook = () => {
        added.forEach((k) => {
          const _key = isArray(merged) ? merged.length : k
          const diff = diffFactory.added([...bPath, _key], after[k], createChildContext(ctx, "", k)) 
          
          nodeMeta[_key] = convertDiffToMeta(diff)
          merged[_key] = after[k]

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
        aPath,
        bPath,
        bNode: before,
        aNode: after,
        parentMeta: nodeMeta,
        mNode: merged,
      }

      return { value: before, state: _state, exitHook }
    }
    
    if (before !== after) {
      _diffs.push(setMergeMeta(parentMeta, akey, diffFactory.replaced(bPath, before, after, ctx)))
    } 

    //TODO: check for rename
    return mergedResult(mNode, mkey, after)
  }

  return { diffs: _diffs, hook }
}

export const compare: CompareEngine = (before: unknown, after: unknown, options: ComapreOptions = {}, context: SourceContext = {}): CompareResult => {
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

  const bNode = bPath.length ? getKeyValue(bSource, ...bPath) : root.before
  const aNode = aPath.length ? getKeyValue(aSource, ...aPath) : root.after

  if (!isObject(bNode) || !isObject(aNode)) {
    // TODO
    throw new Error("")
  }

  const bKey = bPath.length ? _bPath[bPath.length] : "#" 
  const aKey = aPath.length ? _aPath[aPath.length] : "#" 

  const _before = bNode[bKey]
  const _after = aNode[aKey]

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

  bNode[bKey] = _before
  aNode[aKey] = _after

  return { diffs, merged: root.merged[aKey], rootMergeMeta: rootState.parentMeta?.[aKey] }
}
