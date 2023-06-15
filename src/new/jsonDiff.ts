import { changeFactory } from "./utils"
import { SyncCrawlHook, syncCrawl } from "./crawler"
import { Diff, DiffState } from "./types"
import { ApiDiffOptions } from "../types"
import { typeOf } from "../utils"
import { mapArraysKeysRule } from "./rules/mapping/array"
import { mapObjectKeysRule } from "./rules/mapping/object"

export const jsonDiff = <T extends Diff = Diff>(
  before: unknown,
  after: unknown,
  options: ApiDiffOptions = {}
): T[] => {
  const diffs: T[] = []
  const change = changeFactory<T>()

  const hook: SyncCrawlHook<DiffState> = (b: any, ctx) => {
    const { state, ...ctxB } = ctx
    const { keyMap, aNode, aPath } = state!

    const keyA = keyMap[ctxB.key]
    const a = aNode[keyA]

    if (typeOf(b) !== typeOf(a)) {
      diffs.push(change.replaced(ctxB.path, b, a))
      return null
    }

    if (a && b && typeof b === "object" && typeof a === "object") {    
      const { added, removed, mapped } = Array.isArray(b) && Array.isArray(a) ? mapArraysKeysRule(b, a) : mapObjectKeysRule(b, a)

      diffs.push(...added.map((key) => change.added(ctxB.path, a[key])))
      diffs.push(...removed.map((key) => change.removed(ctxB.path, b[key])))

      if (!Array.isArray(b)) {
        Object.entries(mapped).forEach(([k1, k2]) => 
          k1 !== k2 && diffs.push(change.renamed(ctxB.path, k1, k2)))
      }

      return { value: b, state: { keyMap: mapped, aPath: [...aPath, keyA], aNode: a } }
    }
    
    if (b !== a) {
      diffs.push(change.replaced(ctxB.path, b, a))
    }

    return null
  }
  
  syncCrawl<DiffState>(before, hook, { aPath: [], aNode: { "#": after }, keyMap: { "#": "#" } })

  return diffs
}
