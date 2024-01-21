import { getNodeRules } from "json-crawl"
import { isRefNode } from "allof-merge"

import { diffFactory, convertDiffToMeta, createMergeMeta, compare, createChildContext, DIFF_META_KEY } from "../core"
import { buildPath, changeDiffsPath, getCompareId, getRef, isCycleRef, resolveRef } from "./jsonSchema.utils"
import type { CompareResultCache, JsonSchemaComapreCache } from "./jsonSchema.types"
import { compareJsonSchema } from "./jsonSchema.compare"
import type { CompareResolver, Diff } from "../types"
import { isArray } from "../utils"

export const combinaryCompareResolver: CompareResolver = (ctx) => {
  const { before, after, options } = ctx
  const { arrayMeta, metaKey = DIFF_META_KEY } = options

  if (!isArray(before.value) || !isArray(after.value)) {
    const diff = diffFactory.replaced(before.path, before.value, after.value, ctx)
    return { diffs: [diff], merged: after.value, rootMergeMeta: convertDiffToMeta(diff) }
  }
  // match combinaries
  const afterMatched = new Set<number>(after.value.keys())
  const beforeMached = new Set<number>(before.value.keys())
  const comparedItems = []
  const _merged: any = []
  const _diffs: Diff[] = []

  const rules = getNodeRules(ctx.rules, "*", before.path, before.value)

  // compare all combinations, find min diffs
  for (const i of before.value.keys()) {
    const _before = before.value[i]
    for (const j of after.value.keys()) {
      if (!afterMatched.has(j)) { continue }
      const _after = after.value[j]

      const { diffs, merged } = compareJsonSchema(_before, _after, { ...options, rules }, {
        before: { jsonPath: [ ...before.path, i ], source: before.root },
        after: { jsonPath: [ ...after.path, j ], source: after.root }
      })

      if (!diffs.length) {
        afterMatched.delete(j)
        beforeMached.delete(i)
        _merged[j] = merged
        break
      }
      comparedItems.push({ before: i, after: j, diffs, merged })
    }
  }

  comparedItems.sort((a, b) => a.diffs.length - b.diffs.length)

  for (const compared of comparedItems) {
    if (!afterMatched.has(compared.after) || !beforeMached.has(compared.before)) { continue }
    afterMatched.delete(compared.after)
    beforeMached.delete(compared.before)
    _merged[compared.before] = compared.merged
    _diffs.push(...compared.diffs)
  }

  const arrayMetaDiffs: Diff[] = []
  for (const i of beforeMached.values()) {
    _merged[i] = before.value[i]
    const diff = diffFactory.removed([...before.path, i], before.value[i], createChildContext(ctx, i, ""))
    arrayMetaDiffs.push(diff)
    _diffs.push(diff)
  }

  for (const j of afterMatched.values()) {
    const diff = diffFactory.added([...after.path, _merged.length], after.value[j], createChildContext(ctx, "", j))
    _merged.push(after.value[j])
    arrayMetaDiffs.push(diff)
    _diffs.push(diff)
  }
  const rootArrayMeta = createMergeMeta(arrayMetaDiffs)

  if (arrayMeta) {
    _merged[metaKey] = rootArrayMeta
  }

  return { diffs: _diffs, merged: _merged, ...(!arrayMeta && Object.keys(rootArrayMeta).length) ? { rootMergeMeta: { array: rootArrayMeta } } : {} }
}

export const createRefsCompareResolver = (cache: JsonSchemaComapreCache = {}): CompareResolver => {
  cache.results = cache.results ?? new Map<string, CompareResultCache>()
  cache.bRefs = cache.bRefs ?? {}
  cache.aRefs = cache.aRefs ?? {}

  const { results, bRefs, aRefs } = cache

  const resolver: CompareResolver = ({ before, after, rules, options }) => {
    // check if current path has already been compared via $refs
    const bPath = buildPath(before.path)
    const aPath = buildPath(after.path)

    let compareRefsId = getCompareId(bPath, aPath)
    if (results.has(compareRefsId)) {
      return results.get(compareRefsId)
    }

    // normalize ref
    const bRef = isRefNode(before.value) ? getRef(before.value.$ref) : ""
    const aRef = isRefNode(after.value) ? getRef(after.value.$ref) : ""

    if (!bRef && !aRef) { return }

    // skip if cycle ref
    if (isCycleRef(bRef, `#${bPath}`, bRefs) || isCycleRef(aRef, `#${aPath}`, aRefs)) {
      return
    }

    // save refs to refs history
    bRef && (bRefs[bRef] = [...bRefs[bRef] ?? [], `#${bPath}`])
    aRef && (aRefs[aRef] = [...aRefs[aRef] ?? [], `#${aPath}`])

    // compare $refs
    if (bRef && aRef) {
      compareRefsId = getCompareId(bRef, aRef)
      
      if (results.has(compareRefsId)) {
        const { path, diffs, ...rest } = results.get(compareRefsId)!
        return { ...rest, diffs: changeDiffsPath(diffs, path, before.path) }
      }
    }
      
    // compare $refs content
    const _before = resolveRef(before.value, before.root)
    const _after = resolveRef(after.value, after.root)
    
    if (_before === undefined || _after === undefined) {
      return
    }

    // compare content
    const result = compare(_before, _after, { ...options, rules }, {
      before: { jsonPath: before.path, source: before.root }, 
      after: { jsonPath: after.path, source: after.root }, 
    })

    // save compare result
    if (bRef && aRef) {
      results.set(compareRefsId, { ...result, path: before.path })
    }

    return result
  }

  return resolver
}
