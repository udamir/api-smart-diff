import { isRefNode, resolveRefNode } from "allof-merge"

import { changeFactory, convertDiffToMeta, createMergeMeta, isArray } from "../utils"
import type { CompareResolver, CompareResult, Diff } from "../types"
import { compareJsonSchema } from "./jsonSchema"
import { buildPath } from "./jsonSchema.utils"
import { DIFF_META_KEY } from "../constants"

export const compareCombinary: CompareResolver = ({ before, after, options }) => {
  const { arrayMeta, metaKey = DIFF_META_KEY } = options

  const change = changeFactory()
  if (!isArray(before.value) || !isArray(after.value)) {
    const diff = change.replaced(before.path, before.value, after.value)
    return { diffs: [diff], merged: after.value, rootMergeMeta: convertDiffToMeta(diff) }
  }
  // match combinaries
  const afterMatched = new Set<number>(after.value.keys())
  const beforeMached = new Set<number>(before.value.keys())
  const comparedItems = []
  const _merged: any = []
  const _diffs: Diff[] = []

  // compare all combinations, find min diffs
  for (const i of before.value.keys()) {
    const _before = before.value[i]
    for (const j of after.value.keys()) {
      if (!afterMatched.has(j)) { continue }
      const _after = after.value[j]
      const { diffs, merged } = compareJsonSchema(_before, _after, options)
      if (!diffs.length) {
        afterMatched.delete(j)
        beforeMached.delete(i)
        _merged[i] = merged
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
    _merged[compared.after] = compared.merged
    _diffs.push(...compared.diffs.map((diff) => ({ ...diff, path: [...before.path, compared.before, ...diff.path] })))
  }

  const arrayMetaDiffs: Diff[] = []
  for (const i of beforeMached.values()) {
    _merged.push(before.value[i])
    const diff = change.removed([...before.path, i], before.value[i])
    arrayMetaDiffs.push(diff)
    _diffs.push(diff)
  }

  for (const j of afterMatched.values()) {
    _merged[j] = after.value[j]
    const diff = change.added([...after.path, j], after.value[j])
    arrayMetaDiffs.push(diff)
    _diffs.push(diff)
  }
  const rootArrayMeta = createMergeMeta(arrayMetaDiffs)

  if (arrayMeta) {
    _merged[metaKey] = rootArrayMeta
  }

  return { diffs: _diffs, merged: _merged, ...(!arrayMeta && rootArrayMeta) ? { rootMergeMeta: { array: rootArrayMeta } } : {} }
}

export const createCompareRefsResolver = (): CompareResolver => {
  const compareCache = new Map<string, CompareResult>()

  const getCompareId = (beforeRef: string, afterRef: string): string => {
    return beforeRef === afterRef ? beforeRef : `${beforeRef}:${afterRef}`
  }

  const resolveRef = (node: unknown, source: unknown) => {
    if (!isRefNode(node)) { return node }

    return resolveRefNode(source, node)
  }

  const resolver: CompareResolver = ({ before, after, options }) => {
    // check if current path has already been compared via $refs
    const compareRefsId = getCompareId(buildPath(before.path), buildPath(after.path))
    if (compareCache.has(compareRefsId)) {
      return compareCache.get(compareRefsId)
    }

    if (!isRefNode(before.value) || !isRefNode(after.value)) { return }
    
    // compare $refs
    if (isRefNode(before.value) && isRefNode(after.value)) {
      const compareRefsId = getCompareId(before.value.$ref, after.value.$ref)
      
      if (compareCache.has(compareRefsId)) {
        return compareCache.get(compareRefsId)
      }
    }
      
    // compare $refs content
    const _before = resolveRef(before.value, before.root)
    const _after = resolveRef(after.value, after.root)
    
    const result = compareJsonSchema(_before, _after, options)

    if (isRefNode(before.value) && isRefNode(after.value)) {
      compareCache.set(compareRefsId, result)
    }
    return result
  }

  return resolver
}
