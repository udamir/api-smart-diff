import { changeFactory, createMergeMeta } from "./utils"
import { Diff, JsonNode, MergeState } from "./types"
import { CrawlHook, clone } from "./crawler"
import { DIFF_META_KEY } from "../constants"
import { ClassifyRules } from "./rules/types"
import { mapArraysKeysRule } from "./rules/mapping/array"
import { mapObjectKeysRule } from "./rules/mapping/object"

export interface JsonMergeResult<T extends Diff> {
  diffs: T[]
  merged: JsonNode
}

interface MergeFactoryResult<T extends Diff> {
  diffs: T[]
  hook: CrawlHook<MergeState<T>>
}

export type MergeOptions<T extends Diff> = {
  strictArrays?: boolean
  resolveUnchangedRefs?: boolean
  metaKey?: string | symbol
  arrayMeta?: boolean
  externalRefs?: {
    [key: string]: any
  }
  rules?: {
    classify: ClassifyRules
    // match: JsonMapTreeRules<MatchRule>
    // diffDoc: JsonMapTreeRules<MatchRule>
  }
  formatDiff?: (diff: Diff) => T
}

const useMergeFactory = <T extends Diff>(
  data: unknown,
  options: MergeOptions<T> = {}
): MergeFactoryResult<T> => {

  const diffs: T[] = []
  const change = changeFactory<T>()
  const { arrayMeta, metaKey = DIFF_META_KEY } = options

  const rootState: MergeState<T> = { path: [], node: { "#": data }, keyMap: { "#": "#" }, nodeDiffs: diffs } 

  const hook: CrawlHook<MergeState<T>> = (before: any, ctx) => {
    const state = ctx.state ? ctx.state : rootState

    const { keyMap, nodeDiffs, node: aNode, path: aPath } = state!

    const akey = keyMap[ctx.key]
    const after = aNode[akey]

    if (typeof before !== typeof after) {
      ctx.node[akey] = after
      nodeDiffs.push(change.replaced(ctx.path, before, after))
      return null
    }

    if (before && typeof before === "object") {
      const _nodeDiffs: T[] = Array.isArray(before) && arrayMeta ? nodeDiffs : []
      
      const mapKeys = Array.isArray(after) ? mapArraysKeysRule : mapObjectKeysRule
      const { added, removed, mapped } = mapKeys(before, after)
      
      const value: any = Array.isArray(before) 
        ? before.filter((_, i) => (removed as number[]).includes(i)) 
        : { ...before }

      removed.forEach((key) => {
        _nodeDiffs.push(change.removed([...ctx.path, key], before[key]))
        delete value[key]
      })

      added.forEach((key) => {
        _nodeDiffs.push(change.added([...ctx.path, key], after[key]))
      })

      const exitHook = () => {
        diffs.push(..._nodeDiffs)

        const _nodeItem = ctx.node[ctx.key]      
        added.forEach((key) => _nodeItem[key] = after[key])
        
        if (!_nodeDiffs.length || (Array.isArray(value) && arrayMeta)) { return }

        _nodeItem[metaKey] = createMergeMeta(_nodeDiffs, ctx.path) 
      }

      const _state = { keyMap: mapped, path: [...aPath, akey], node: after, nodeDiffs: _nodeDiffs }

      return { value, state: _state, exitHook }
    }
    
    if (before !== after) {
      ctx.node[akey] = after
      nodeDiffs.push(change.replaced(ctx.path, before, after))
    } 

    return { value: before }
  }

  return { diffs, hook }
}

export const jsonMerge = <T extends Diff = Diff>(
  before: unknown,
  after: unknown,
  options: MergeOptions<T> = {}
): JsonMergeResult<T> => {
  const { diffs, hook } = useMergeFactory<T>(after, options)

  const merged = clone<MergeState<T>>(before, hook)

  return { diffs, merged }
}
