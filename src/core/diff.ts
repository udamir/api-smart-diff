import type { JsonPath } from "json-crawl"

import type {
  DiffFactory,
  ComapreContext,
  CompareTransformResolver,
  Diff,
  NodeContext,
  DiffMeta,
  MergeMetaRecord,
  TransformResolver,
} from "../types"
import { DiffAction, allUnclassified, unclassified } from "./constants"
import { getKeyValue, joinPath, isFunc } from "../utils"

export const createDiff = (
  diff: Omit<Diff, "type">,
  ctx: ComapreContext,
): Diff => {
  const rule = ctx.rules?.$ ?? {}
  const _diff: Diff = { ...diff, type: unclassified }

  if (rule) {
    const classifier = Array.isArray(rule) ? rule : allUnclassified

    const index =
      diff.action === "rename"
        ? 2
        : ["add", "remove", "replace"].indexOf(diff.action)
    const changeType = classifier[index]

    try {
      _diff.type = isFunc(changeType) ? changeType(ctx) : changeType
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      console.error(
        `Classification Rule error for node: ${ctx.before.path.join(".")}. ${message}`,
      )
    }
  }

  const description = ctx.options.annotateHook?.(_diff, ctx)
  return { ..._diff, ...(description ? { description } : {}) }
}

export const diffFactory: DiffFactory = {
  added: (path, after, ctx) =>
    createDiff({ path, after, action: DiffAction.add }, ctx),
  removed: (path, before, ctx) =>
    createDiff({ path, before, action: DiffAction.remove }, ctx),
  replaced: (path, before, after, ctx) =>
    createDiff({ path, before, after, action: DiffAction.replace }, ctx),
  renamed: (path, before, after, ctx) =>
    createDiff({ path, before, after, action: DiffAction.rename }, ctx),
}

export const convertDiffToMeta = (diff: Diff): DiffMeta => {
  return {
    action: diff.action,
    type: diff.type ?? unclassified,
    ...(diff.action === "replace" || diff.action === "rename"
      ? { replaced: diff.before }
      : {}),
  }
}

export const createMergeMeta = (diffs: Diff[]): MergeMetaRecord => {
  const meta: MergeMetaRecord = {}

  for (const diff of diffs) {
    const _meta = convertDiffToMeta(diff)
    const key =
      diff.action !== "rename" ? diff.path[diff.path.length - 1] : diff.after
    meta[key] = _meta
  }

  return meta
}

export const getParentContext = (
  ctx: NodeContext,
  ...path: JsonPath
): NodeContext | undefined => {
  const _path = joinPath(ctx.path.slice(0, -1), path)

  if (!_path.length) {
    return { path: [], key: "", value: ctx.root, root: ctx.root }
  }

  const parentPath = [..._path]
  const key = parentPath.pop()!

  const parentValue = getKeyValue(ctx.root, ...parentPath) as Record<
    string | number,
    unknown
  >
  const value = parentValue[key]

  if (value === undefined) {
    return
  }

  return { path: _path, key, value, parent: parentValue, root: ctx.root }
}

export const compareTransformationFactory = <T = unknown>(
  resolver: TransformResolver<T>,
): CompareTransformResolver<T> => {
  return (before, after) => [resolver(before, after), resolver(after, before)]
}
