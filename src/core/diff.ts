import type { JsonPath } from "json-crawl"

import type {
  DiffFactory,
  CompareContext,
  CompareTransformResolver,
  Diff,
  DiffType,
  NodeContext,
  DiffMeta,
  MergeMetaRecord,
  TransformResolver,
  ActionType,
  CompareSession,
} from "../types"
import {
  DiffAction,
  breaking,
  risky,
  nonBreaking,
  deprecated,
  annotation,
  unclassified,
  isComponentsScope,
  CompareScopes,
} from "./constants"
import { getKeyValue, joinPath, isFunc, isObject } from "../utils"
import { resolveClassifyTuple, ruleView } from "./rules"
import { componentUsageScopes, findComponentRoot } from "./usage"

const actionIndex = (action: ActionType): 0 | 1 | 2 =>
  action === DiffAction.add ? 0 : action === DiffAction.remove ? 1 : 2

// breaking > risky > non-breaking > deprecated > annotation > unclassified
const severity: Record<DiffType, number> = {
  [breaking]: 5,
  [risky]: 4,
  [nonBreaking]: 3,
  [deprecated]: 2,
  [annotation]: 1,
  [unclassified]: 0,
}

export const mostSevere = (types: Iterable<DiffType>): DiffType => {
  let result: DiffType = unclassified
  if (Array.isArray(types)) {
    for (let i = 0; i < types.length; i++) {
      if (severity[types[i] as DiffType] > severity[result]) {
        result = types[i]
      }
    }
    return result
  }
  for (const type of types) {
    if (severity[type] > severity[result]) {
      result = type
    }
  }
  return result
}

const classifyInScope = (action: ActionType, ctx: CompareContext, scope: string): DiffType => {
  const tuple = resolveClassifyTuple(ruleView(ctx.rules).classify, scope)
  const entry = tuple[actionIndex(action)]
  if (!isFunc(entry)) {
    return entry
  }
  // a literal of the context shape (a spread gets a new hidden class after every garbage collection, ISSUE-330)
  const scoped: CompareContext =
    scope === ctx.scope
      ? ctx
      : { before: ctx.before, after: ctx.after, rules: ctx.rules, options: ctx.options, scope, session: ctx.session }
  return entry(scoped)
}

const inComponentsSection = (ctx: CompareContext): boolean => {
  const root = findComponentRoot(ctx)
  return !root || (root.origin ?? root.path)[0] === "components"
}

/** Classifies a change: by the node rule in the current scope, or by the usage scopes of the enclosing component. */
export const classifyDiff = (action: ActionType, ctx: CompareContext): DiffType => {
  if (!ctx.rules || !ruleView(ctx.rules).classify) {
    return unclassified
  }
  try {
    if (isComponentsScope(ctx.scope)) {
      // the opt-out covers the `components` section only: a component scope opened elsewhere (an AsyncAPI 3.0 channel
      // message, used inline by operations) keeps its usage-derived class (ISSUE-107)
      if (ctx.session.unclassifiedComponents && inComponentsSection(ctx)) {
        return unclassified
      }
      const scopes = componentUsageScopes(ctx)
      if (!scopes.size) {
        return unclassified
      }
      const types: DiffType[] = []
      for (const scope of scopes) {
        types.push(classifyInScope(action, ctx, scope))
      }
      return mostSevere(types)
    }
    return classifyInScope(action, ctx, ctx.scope)
  } catch (error) {
    ctx.session.report({
      kind: "classify",
      message: `Classification rule error: ${error instanceof Error ? error.message : String(error)}`,
      path: ctx.before.path,
      scope: ctx.scope,
      error,
    })
    return unclassified
  }
}

/**
 * Key of a change by its declaration paths (the `origin` inside a `$ref` target, the walk path otherwise) and action:
 * the same change has the same key at the declaration and at every usage location of it (POLICY-60).
 */
export const declarationKey = (action: ActionType, ctx: CompareContext): string =>
  `${action}|${(ctx.before.origin ?? ctx.before.path).join("\u0000")}|${(ctx.after.origin ?? ctx.after.path).join("\u0000")}`

/**
 * Whether a diff is reported at the component declaration only (POLICY-57, ISSUE-190): while the content of a component
 * is compared at one of its usage locations (`CompareSession.declarationOnly`), a diff whose class in the usage's scope
 * is `annotation` is not emitted there (no diff, no merge meta, a removed value is not kept in `merged`); the walk of the
 * declaration reports it. Breaking, risky, non-breaking, deprecated and unclassified diffs keep their per-usage diffs
 * (POLICY-62). Not with `components: "unclassified"`, where the declaration is not classified (POLICY-61), and not for a
 * change the declaration does not report (`keepAtUsage`, POLICY-60).
 */
export const isDeclarationOnly = (diff: Diff, ctx: CompareContext): boolean => {
  const { session } = ctx
  if (session.declarationOnly <= 0 || diff.type !== annotation || session.unclassifiedComponents) {
    return false
  }
  const keep = session.keepAtUsage
  return keep === undefined || !keep.has(declarationKey(diff.action, ctx))
}

/**
 * The changes left to a declaration (POLICY-57) that the declaration does not report itself (POLICY-60: e.g. a
 * combinator whose branches pair differently at the declaration, where nested references are nominal, than at a usage,
 * where they are compared by content): their keys, or `undefined` when every one is reported there.
 */
export const unreportedDeclarationChanges = (
  session: CompareSession,
  diffs: Diff[],
  contexts: CompareContext[],
): Set<string> | undefined => {
  const { suppressedDiffs, suppressedContexts } = session
  if (!suppressedDiffs.length) {
    return
  }
  const declared = new Set<string>()
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i].path[0] === "components") {
      declared.add(declarationKey(diffs[i].action, contexts[i]))
    }
  }
  let missing: Set<string> | undefined
  const seen = new Set<CompareContext>()
  for (let i = 0; i < suppressedDiffs.length; i++) {
    const ctx = suppressedContexts[i]
    if (seen.has(ctx)) {
      continue
    }
    seen.add(ctx)
    const key = declarationKey(suppressedDiffs[i].action, ctx)
    if (!declared.has(key)) {
      missing ??= new Set()
      missing.add(key)
    }
  }
  return missing
}

const samePath = (a: JsonPath, b: JsonPath) => {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

// a negated component subtree is reported in the `components` scope (its classification is usage-derived)
const diffScope = (ctx: CompareContext) =>
  ctx.scope === CompareScopes.negatedComponents ? CompareScopes.components : ctx.scope

export const createDiff = (diff: Omit<Diff, "type" | "scope">, ctx: CompareContext): Diff =>
  completeDiff({ ...diff, type: classifyDiff(diff.action, ctx), scope: diffScope(ctx) }, ctx)

// the diff record of a factory call: one literal per action, with the keys in the order of the factory's object
// followed by `type` and `scope` (as the spread in `createDiff` gives them), so every diff of an action has the hidden
// class of its literal instead of a spread-derived one that is created anew after every garbage collection (ISSUE-330)
const diffRecord = (
  action: ActionType,
  path: JsonPath,
  before: unknown,
  after: unknown,
  type: DiffType,
  scope: Diff["scope"],
): Diff =>
  action === DiffAction.add
    ? { path, after, action, type, scope }
    : action === DiffAction.remove
      ? { path, before, action, type, scope }
      : { path, before, after, action, type, scope }

const factoryDiff = (action: ActionType, path: JsonPath, before: unknown, after: unknown, ctx: CompareContext) =>
  completeDiff(diffRecord(action, path, before, after, classifyDiff(action, ctx), diffScope(ctx)), ctx)

// the diff with its origin and description, unless it is reported at the declaration only (POLICY-57)
const completeDiff = (_diff: Diff, ctx: CompareContext): Diff => {
  // not emitted at this usage location: neither described nor counted, but recorded for the check against the
  // declaration's diffs (POLICY-60)
  if (isDeclarationOnly(_diff, ctx)) {
    ctx.session.suppressedDiffs.push(_diff)
    ctx.session.suppressedContexts.push(ctx)
    return _diff
  }

  const bOrigin = ctx.before.origin
  const aOrigin = ctx.after.origin
  if (bOrigin || aOrigin) {
    const before = bOrigin ?? ctx.before.path
    const after = aOrigin ?? ctx.after.path
    if (!samePath(before, _diff.path) || !samePath(after, _diff.path)) {
      _diff.origin = { before, after }
    }
  }

  const { annotateHook } = ctx.session
  if (annotateHook) {
    try {
      const description = annotateHook(_diff, ctx)
      if (description) {
        _diff.description = description
      }
    } catch (error) {
      ctx.session.report({
        kind: "annotate",
        message: `Annotation error: ${error instanceof Error ? error.message : String(error)}`,
        path: _diff.path,
        scope: ctx.scope,
        error,
      })
    }
  }

  ctx.session.diffCount++
  return _diff
}

export const diffFactory: DiffFactory = {
  added: (path, after, ctx) => factoryDiff(DiffAction.add, path, undefined, after, ctx),
  removed: (path, before, ctx) => factoryDiff(DiffAction.remove, path, before, undefined, ctx),
  replaced: (path, before, after, ctx) => factoryDiff(DiffAction.replace, path, before, after, ctx),
  renamed: (path, before, after, ctx) => factoryDiff(DiffAction.rename, path, before, after, ctx),
}

// two literals instead of a conditional spread (one hidden class each, ISSUE-330)
export const convertDiffToMeta = (diff: Diff): DiffMeta => {
  const { action } = diff
  const type = diff.type ?? unclassified
  return action === "replace" || action === "rename" ? { action, type, replaced: diff.before } : { action, type }
}

export const createMergeMeta = (diffs: Diff[]): MergeMetaRecord => {
  const meta: MergeMetaRecord = {}

  for (const diff of diffs) {
    const _meta = convertDiffToMeta(diff)
    const key = diff.action !== "rename" ? diff.path[diff.path.length - 1] : diff.after
    meta[key] = _meta
  }

  return meta
}

const descend = (base: NodeContext, path: JsonPath): NodeContext | undefined => {
  let node = base
  for (const key of path) {
    const value = getKeyValue(node.value, key)
    if (value === undefined) {
      return
    }
    node = { path: [...node.path, key], key, value, parent: node.value, root: node.root, up: node }
  }
  return node
}

/**
 * Navigates relative to the current node: the node's own key is dropped first, every leading "" segment goes one
 * level further up, the remaining segments go down. Uses the parent chain when the context has one (so navigation
 * works inside `$ref` targets), the root document otherwise.
 */
export const getParentContext = (ctx: NodeContext, ...path: JsonPath): NodeContext | undefined => {
  if (ctx.up) {
    let node: NodeContext | undefined = ctx.up
    let i = 0
    for (; i < path.length && path[i] === ""; i++) {
      node = node?.up
    }
    if (!node) {
      return i === path.length
        ? { path: [], key: "", value: ctx.root, root: ctx.root }
        : descend({ path: [], key: "", value: ctx.root, root: ctx.root }, path.slice(i))
    }
    return descend(node, path.slice(i))
  }

  const _path = joinPath(ctx.path.slice(0, -1), path)
  const parentPath = [..._path]
  const key = parentPath.pop()

  if (!_path.length || key === undefined) {
    return { path: [], key: "", value: ctx.root, root: ctx.root }
  }

  const parentValue = getKeyValue(ctx.root, ...parentPath)
  if (!isObject(parentValue)) {
    return
  }
  const value = parentValue[key]

  if (value === undefined) {
    return
  }

  return { path: _path, key, value, parent: parentValue, root: ctx.root }
}

/** Nearest ancestor context (starting at the node itself) matching the predicate. */
export const findAncestorContext = (
  ctx: NodeContext,
  predicate: (node: NodeContext) => boolean,
): NodeContext | undefined => {
  let node: NodeContext | undefined = ctx
  while (node) {
    if (predicate(node)) {
      return node
    }
    node = node.up
  }
  return
}

export const compareTransformationFactory = <T = unknown>(
  resolver: TransformResolver<T>,
): CompareTransformResolver<T> => {
  return (before, after) => [resolver(before, after), resolver(after, before)]
}
