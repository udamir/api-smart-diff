import { JsonPath } from "json-crawl"

import type { ChangeFactory, ComapreContext, CompareTransformResolver, Diff, DiffContext, DiffMeta, FormatDiffFunc, MergeMeta, TransformResolver } from "../types"
import { DiffAction, allUnclassified, unclassified } from "../constants"
import { getKeyValue, joinPath } from "./misc"

export const classifyDiff = (diff: Diff, ctx: ComapreContext): Diff => {
  const { rules } = ctx.options
  const { $: rule, annotate } = rules ?? {}

  if (!rule) { 
    return { ...diff, type: unclassified }
  }

  const classifier = Array.isArray(rule) ? rule : allUnclassified

  const index = diff.action === "rename" ? 2 : ["add", "remove", "replace"].indexOf(diff.action)
  const changeType = classifier[index]

  const description = annotate?.(diff, ctx)

  try {
    if (typeof changeType === "function") {
      return { ...diff, type: changeType(ctx), ...description ? { description } : {} }
    } else {
      return { ...diff, type: changeType, ...description ? { description } : {} }
    }

  } catch (error) {
    return { ...diff, type: unclassified, ...description ? { description } : {} }
  }
}

export const changeFactory = <T extends Diff>(formatDiffFunc?: FormatDiffFunc<T>): ChangeFactory<T> => {
  const formatDiff = formatDiffFunc ? formatDiffFunc : ((diff: Diff) => diff as T)

  return {
    added: (path, after, ctx) => formatDiff(classifyDiff({ path, after, action: DiffAction.add }, ctx), ctx),
    removed: (path, before, ctx) => formatDiff(classifyDiff({ path, before, action: DiffAction.remove }, ctx), ctx),
    replaced: (path, before, after, ctx) => formatDiff(classifyDiff({ path, before, after, action: DiffAction.replace }, ctx), ctx),
    renamed: (path, before, after, ctx) => formatDiff(classifyDiff({ path, before, after, action: DiffAction.rename }, ctx), ctx),
  }
}

export const convertDiffToMeta = (diff: Diff): DiffMeta => {
  return {
    action: diff.action,
    type: diff.type ?? unclassified,
    ...diff.action === "replace" || diff.action === "rename" ? { replaced: diff.before } : {}
  }
}

export const createMergeMeta = (diffs: Diff[]): MergeMeta => {
  const meta: MergeMeta = {}

  for (const diff of diffs) {
    const _meta = convertDiffToMeta(diff)
    const key = diff.action !== "rename" ? diff.path[diff.path.length - 1] : diff.after
    meta[key] = _meta
  }

  return meta
}

export const getParentContext = (ctx: DiffContext, ...path: JsonPath): DiffContext | undefined => {
  const _path = joinPath(ctx.path.slice(0, -1), path)
  
  if (!_path.length) {
    return { path: [], key: "", value: ctx.root, root: ctx.root }
  }

  const parentPath = [..._path]
  const key = parentPath.pop()!

  const parentValue = getKeyValue(ctx.root, ...parentPath) as Record<string | number, unknown>
  const value = parentValue[key]

  if (value === undefined) {
    return
  }

  return { path: _path, key, value, parent: parentValue, root: ctx.root }
}

export const compareTransformationFactory = (resolver: TransformResolver): CompareTransformResolver => {
  return (before, after) => [resolver(before, after), resolver(after, before)]
}
