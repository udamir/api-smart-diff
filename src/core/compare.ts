import type { JsonPath } from "json-crawl"

import type {
  CompareContext,
  CompareOptions,
  CompareEngine,
  CompareResult,
  CompareRules,
  CompareScope,
  CompareSession,
  MergeMeta,
  MergeMetaRecord,
  NestedCompareResult,
  NodeContext,
  Diff,
} from "../types"
import { deepCopy, getChildValue, getKeyValue, isArray, isObject, isPlainObject } from "../utils"
import { diffFactory, convertDiffToMeta, isDeclarationOnly, unreportedDeclarationChanges } from "./diff"
import { objectMappingResolver, arrayMappingResolver, equalKeysShortcut } from "./mapping"
import { CompareScopes } from "./constants"
import { createSession } from "./session"
import { type RuleView, cachedChildRules, resolveNodeRules, resolveScope, ruleView } from "./rules"
import { checkUnchangedSubtree } from "./unchanged"

const ROOT_KEY = "#"
const isOwnEnumerable = Object.prototype.propertyIsEnumerable
const EMPTY_RULES: CompareRules = {}

interface DiffSink {
  diffs: Diff[]
  contexts: CompareContext[]
}

interface MergedSlot {
  node: Record<string | number, unknown> | unknown[]
  key: string | number
  meta: MergeMetaRecord
  // the open container whose merge meta record `meta` is (it counts the entries written)
  owner: ContainerFrame | undefined
}

const push = (sink: DiffSink, diff: Diff, ctx: CompareContext) => {
  sink.diffs.push(diff)
  sink.contexts.push(ctx)
}

// stores under document keys (new hidden classes on every call) live in these helpers, so their changing inline caches
// do not keep the walk functions from being optimized (ISSUE-191)
const write = (slot: MergedSlot, value: unknown) => {
  ;(slot.node as Record<string | number, unknown>)[slot.key] = value
}

const setMeta = (meta: MergeMetaRecord, key: string | number, value: MergeMeta) => {
  meta[key] = value
}

// the merge meta of the slot's node, counted by the container that owns the record: whether a container has merge
// meta is then known without enumerating the record (a `for...in` over a fresh object was a noticeable part of
// finishing every changed container, ISSUE-330)
const setSlotMeta = (slot: MergedSlot, value: MergeMeta) => {
  setMeta(slot.meta, slot.key, value)
  if (slot.owner) {
    slot.owner.metaCount++
  }
}

const setKey = (node: Record<string | number, unknown> | unknown[], key: string | number | symbol, value: unknown) => {
  ;(node as Record<string | number | symbol, unknown>)[key] = value
}

// reports a diff of the slot's node (unless it is reported at the component declaration only, POLICY-57)
const emitAt = (slot: MergedSlot, diff: Diff, ctx: CompareContext, sink: DiffSink) => {
  if (isDeclarationOnly(diff, ctx)) {
    return
  }
  setSlotMeta(slot, convertDiffToMeta(diff))
  push(sink, diff, ctx)
}

/**
 * Creates the context of a child node. Either key may be absent (removed or added node); the rules are resolved from
 * the parent rules with json-crawl semantics and the scope is inherited unless the child rule opens one.
 */
export const createChildContext = (
  ctx: CompareContext,
  bkey: number | string | undefined,
  akey: number | string | undefined,
): CompareContext => childContext(ctx, bkey, akey, null)

// a child value: the keyed load for an object written out, arrays through `getChildValue` (ISSUE-330)
const childValue = (parent: unknown, key: string | number): unknown =>
  typeof parent !== "object" || parent === null
    ? undefined
    : Array.isArray(parent)
      ? getChildValue(parent, key)
      : (parent as Record<string | number, unknown>)[key]

// `createChildContext` with the child rules when already known (`cachedNodeRules`; `null` resolves them)
const childContext = (
  ctx: CompareContext,
  bkey: number | string | undefined,
  akey: number | string | undefined,
  known: CompareRules | undefined | null,
): CompareContext => {
  const { before, after, rules, options, session } = ctx
  const key = (bkey ?? akey) as string | number
  const bValue = bkey !== undefined ? childValue(before.value, bkey) : undefined
  const aValue = akey !== undefined ? childValue(after.value, akey) : undefined
  const bPath = [...before.path, bkey ?? key]
  // one array for both sides while they are at the same path (paths are never changed in place): halves the memory the
  // paths of deeply nested documents take (ISSUE-210)
  const aPath = before.path === after.path && akey === bkey ? bPath : [...after.path, akey ?? key]
  const rulePath = bkey !== undefined ? bPath : aPath
  const ruleValue = bkey !== undefined ? bValue : aValue

  const childRules = (known !== null ? known : resolveNodeRules(rules, key, rulePath, ruleValue)) ?? EMPTY_RULES
  const view = ruleView(childRules)
  const scope =
    view.scope === undefined
      ? ctx.scope
      : resolveScope(childRules, ctx.scope, { key, path: rulePath, value: ruleValue })
  const kind = view.kind

  // both node contexts have one shape (`origin` present, possibly undefined) so property access stays monomorphic
  const bSource = before.source
  const aSource = after.source
  return {
    before: {
      path: bPath,
      key: bkey ?? key,
      value: bValue,
      parent: before.value,
      root: before.root,
      up: before,
      scope,
      source: bkey !== undefined ? childValue(bSource, bkey) : undefined,
      origin: before.origin ? [...before.origin, bkey ?? key] : undefined,
      kind,
    },
    after: {
      path: aPath,
      key: akey ?? key,
      value: aValue,
      parent: after.value,
      root: after.root,
      up: after,
      scope,
      source: akey !== undefined ? childValue(aSource, akey) : undefined,
      origin: after.origin ? [...after.origin, akey ?? key] : undefined,
      kind,
    },
    rules: childRules,
    options,
    scope,
    session,
  }
}

/**
 * Value written into the merged document for a node: the original input value unless `merged: "normalized"`.
 * Containers are written by reference and remembered as aliases; they are copied once, by the nearest changed
 * ancestor (or at the root), so an unchanged subtree costs one copy instead of one per level.
 */
export const mergedValue = (ctx: CompareContext, side: NodeContext, compared: unknown): unknown => {
  const value = ctx.session.normalized ? compared : side.source !== undefined ? side.source : compared
  if (isObject(value)) {
    ctx.session.aliases.add(value)
  }
  return value
}

// replaces the aliased children of a merged container with deep copies (the container itself carries changes)
const detachAliases = (session: CompareSession, merged: Record<string | number, unknown> | unknown[]) => {
  const { aliases } = session
  if (Array.isArray(merged)) {
    for (let i = 0; i < merged.length; i++) {
      // (a hole reads as undefined, as `forEach` skipped it)
      const item = merged[i]
      if (isObject(item) && aliases.has(item)) {
        merged[i] = deepCopy(item)
      }
    }
    return
  }
  const keys = Object.keys(merged)
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k]
    const item = merged[key]
    if (isObject(item) && aliases.has(item)) {
      merged[key] = deepCopy(item)
    }
  }
}

// keys from a node to a difference found by the unchanged-subtree check of an ancestor (`checkUnchangedSubtree`):
// the nodes along them are known to differ and are not checked again
type ChangedHint = (string | number)[] | undefined

/**
 * A container pair being compared. The walk is iterative (ISSUE-200): `walk` keeps the open containers on an explicit
 * stack and compares their mapped children one by one, so the nesting depth of a document is not limited by the call
 * stack (only resolvers that compare nested values, such as `$ref` targets and combinator branches, start a new walk).
 */
// (an object literal: its hidden class comes with the literal and survives garbage collections, unlike the
// transitions of a class instance's field stores, ISSUE-330)
interface ContainerFrame {
  // index of the next mapped child to compare
  i: number
  readonly ctx: CompareContext
  // the view of the container's rules (`ruleView(ctx.rules)`)
  readonly view: RuleView
  readonly before: Record<string | number, unknown>
  readonly after: Record<string | number, unknown>
  readonly slot: MergedSlot
  readonly sink: DiffSink
  readonly merged: Record<string | number, unknown> | unknown[]
  readonly nodeMeta: MergeMetaRecord
  readonly added: (string | number)[]
  readonly removedNodes: RemovedNodes
  readonly bkeys: (string | number)[]
  readonly akeys: (string | number)[]
  readonly hint: ChangedHint
  readonly hintKey: string | undefined
  readonly diffCountBefore: number
  // entries of `nodeMeta` written so far (written only through `setSlotMeta` and by the container itself)
  metaCount: number
}

/**
 * Compares a node up to its children: a leaf, a node handled by a resolver, an unchanged or skipped subtree is done
 * here; for a container pair whose children must be compared the open container is returned (`walk` continues it).
 */
const enterNode = (
  ctx: CompareContext,
  slot: MergedSlot,
  sink: DiffSink,
  changedHint: ChangedHint,
): ContainerFrame | undefined => {
  let hint = changedHint
  const { session } = ctx
  const rules = ruleView(ctx.rules)
  let before = ctx.before.value
  let after = ctx.after.value

  if (rules.skip) {
    write(slot, mergedValue(ctx, ctx.before, before))
    return
  }

  // an unchanged subtree (equal, with unchanged `$ref` targets) has no diff: its merged value is the original
  // (`isObject`, `typeOf` and `for...of` written out in the walk: most of it runs before V8 optimizes it, where every
  // helper call and iterator costs, ISSUE-330)
  const bObject = typeof before === "object" && before !== null
  const aObject = typeof after === "object" && after !== null
  if (hint === undefined && bObject && aObject) {
    const checked = checkUnchangedSubtree(ctx, before, after)
    if (checked === true) {
      write(slot, mergedValue(ctx, ctx.after, after))
      return
    }
    hint = checked || undefined
  }

  // transform values before comparison (never written back into the inputs)
  const transforms = rules.transform
  if (transforms?.length && !Array.isArray(before)) {
    try {
      let b = before
      let a = after
      for (let i = 0; i < transforms.length; i++) {
        const result = transforms[i](b, a, ctx)
        b = result[0]
        a = result[1]
      }
      before = b
      after = a
      ctx.before.value = before
      ctx.after.value = after
    } catch (error) {
      session.report({
        kind: "transform",
        message: `Transform error: ${error instanceof Error ? error.message : String(error)}`,
        path: ctx.before.path,
        scope: ctx.scope,
        error,
      })
    }
  }

  // compare via custom handler
  if (rules.compare) {
    let compared: CompareResult | undefined
    try {
      compared = rules.compare.call(ctx.rules, ctx)
    } catch (error) {
      session.report({
        kind: "compare",
        message: `Compare resolver error: ${error instanceof Error ? error.message : String(error)}`,
        path: ctx.before.path,
        scope: ctx.scope,
        error,
      })
    }
    if (compared) {
      acceptResolved(ctx, compared, slot, sink)
      return
    }
  }

  // types are different (`typeOf` written out: null and undefined are one type)
  const bIsObject = typeof before === "object" && before !== null
  const aIsObject = typeof after === "object" && after !== null
  const typeChanged =
    bIsObject !== aIsObject ||
    (bIsObject
      ? Array.isArray(before) !== Array.isArray(after)
      : (before == null) !== (after == null) || (before != null && typeof before !== typeof after))
  if (typeChanged) {
    emitAt(slot, diffFactory.replaced(ctx.before.path, before, after, ctx), ctx, sink)
    write(slot, mergedValue(ctx, ctx.after, after))
    return
  }

  // compare objects or arrays
  if (bIsObject && aIsObject) {
    const bContainer = before as Record<string | number, unknown>
    const aContainer = after as Record<string | number, unknown>
    // a container already being compared higher up the current path (cyclic object graph): treated as unchanged
    // (a short array: paths are shallow, and a linear scan of it is cheaper than a set)
    const { pathStack } = session
    if (pathStack.includes(bContainer) || pathStack.includes(aContainer)) {
      write(slot, mergedValue(ctx, ctx.after, after))
      return
    }
    pathStack.push(bContainer, aContainer)
    return openContainer(ctx, bContainer, aContainer, slot, sink, hint)
  }

  if (before !== after) {
    emitAt(slot, diffFactory.replaced(ctx.before.path, before, after, ctx), ctx, sink)
  }

  write(slot, mergedValue(ctx, ctx.after, after))
}

// the result of a `compare` resolver: its diffs (except those left to the declaration, POLICY-57) and merged value
const acceptResolved = (ctx: CompareContext, compared: CompareResult, slot: MergedSlot, sink: DiffSink) => {
  const contexts = (compared as NestedCompareResult).contexts
  const declarationOnly = ctx.session.declarationOnly > 0
  let rootSuppressed = false
  const { diffs } = compared
  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i]
    const diffCtx = contexts?.[i] ?? ctx
    if (!declarationOnly || !isDeclarationOnly(diff, diffCtx)) {
      push(sink, diff, diffCtx)
    } else if (diff.path.length === ctx.before.path.length) {
      rootSuppressed = true
    }
  }
  // the merge meta of a root diff left to the declaration is dropped with it
  const rootMeta = compared.rootMergeMeta
  if (rootMeta && !rootSuppressed) {
    setSlotMeta(slot, rootMeta)
  }
  write(slot, compared.merged)
}

/**
 * Walks a node and its descendants (ISSUE-200: iteratively, see `ContainerFrame`). The order of the work is the one
 * of a recursive walk: a container's removed and renamed keys are reported first, then its mapped children are
 * compared in before order, then its added keys are reported and its merged value is finished.
 */
const walk = (ctx: CompareContext, slot: MergedSlot, sink: DiffSink): void => {
  const first = enterNode(ctx, slot, sink, undefined)
  if (!first) {
    return
  }
  const { pathStack } = ctx.session
  const base = pathStack.length - 2
  const stack: ContainerFrame[] = [first]
  try {
    while (stack.length) {
      const frame = stack[stack.length - 1]
      if (frame.i < frame.bkeys.length) {
        const i = frame.i++
        const bkey = frame.bkeys[i]
        const akey = frame.akeys[i]
        const hintKey = frame.hintKey
        let childHint =
          hintKey !== undefined && String(bkey) === hintKey ? (frame.hint as (string | number)[]).slice(1) : undefined
        let known: CompareRules | undefined | null = null
        if (childHint === undefined) {
          const quick = quickChild(frame, bkey, akey)
          if (quick === DONE) {
            continue
          }
          childHint = quick
          known = quickRules
        }
        const child = childContext(frame.ctx, bkey, akey, known)
        const next = enterNode(
          child,
          { node: frame.merged, key: akey, meta: frame.nodeMeta, owner: frame },
          frame.sink,
          childHint,
        )
        if (next) {
          stack.push(next)
        }
      } else {
        stack.pop()
        finishContainer(frame)
        pathStack.pop()
        pathStack.pop()
      }
    }
  } finally {
    // a resolver error is reported and the walk of the resolver's caller goes on: the path guard must be balanced
    pathStack.length = base
  }
}

// `quickChild`: the child is done
const DONE: ChangedHint = []

/**
 * A mapped child whose outcome is known without a context of its own (ISSUE-330: most children of a changed container
 * are unchanged, and creating their contexts was a large part of the walk): with static rules that neither skip it
 * nor (for a primitive) transform or compare it, an identical primitive and an unchanged subtree are written as
 * `enterNode` would write them. Returns `DONE`, or the result of the unchanged-subtree check for `enterNode` (the keys
 * to the first difference, `undefined` when not checked).
 */
// the child rules `quickChild` found (memoized), for the child context when it does not finish the child
let quickRules: CompareRules | undefined | null = null

const quickChild = (frame: ContainerFrame, bkey: string | number, akey: string | number): ChangedHint => {
  const { ctx } = frame
  const rules = cachedChildRules(frame.view, bkey)
  quickRules = rules
  if (rules === null) {
    return
  }
  const view = ruleView(rules ?? EMPTY_RULES)
  if (view.skip) {
    return
  }
  const before = childValue(ctx.before.value, bkey)
  const after = childValue(ctx.after.value, akey)
  const { session } = ctx
  if (typeof before === "object" && before !== null) {
    if (typeof after !== "object" || after === null) {
      return
    }
    const checked = checkUnchangedSubtree(ctx, before, after)
    if (checked !== true) {
      return checked || undefined
    }
  } else if (before !== after || view.compare || view.transform?.length) {
    return
  }
  // `mergedValue` of the child's after side
  const source = session.normalized ? undefined : childValue(ctx.after.source, akey)
  const value = source !== undefined ? source : after
  if (typeof value === "object" && value !== null) {
    session.aliases.add(value)
  }
  setKey(frame.merged, akey, value)
  return DONE
}

// key mapping of a container pair as parallel arrays (before key -> after key, in before order)
interface ContainerKeys {
  added: (string | number)[]
  removed: (string | number)[]
  bkeys: (string | number)[]
  akeys: (string | number)[]
  renamed: boolean
}

// whether a mapping resolver marked with `identityOnEqualKeys` (`shortcut` is its key condition) may be skipped: both
// objects have the same own keys in the same order, none excluded by the condition; fills `bkeys` / `akeys` with them
// (partially when not)
const sameOwnKeys = (
  before: Record<string | number, unknown>,
  after: Record<string | number, unknown>,
  bkeys: (string | number)[],
  akeys: (string | number)[],
  shortcut: ((key: string) => boolean) | null | undefined,
): boolean => {
  if (shortcut === undefined) {
    return false
  }
  const bOwn = Object.keys(before)
  const aOwn = Object.keys(after)
  if (bOwn.length !== aOwn.length) {
    return false
  }
  for (let i = 0; i < bOwn.length; i++) {
    const key = bOwn[i]
    if (key !== aOwn[i] || shortcut?.(key)) {
      return false
    }
    bkeys.push(key)
    akeys.push(key)
  }
  return true
}

const mapContainerKeys = (
  ctx: CompareContext,
  before: Record<string | number, unknown>,
  after: Record<string | number, unknown>,
  isArr: boolean,
  mapping: CompareRules["mapping"],
): ContainerKeys => {
  const { session } = ctx
  const bPath = ctx.before.path
  let added: (string | number)[] = []
  let removed: (string | number)[] = []
  const bkeys: (string | number)[] = []
  const akeys: (string | number)[] = []
  let renamed = false
  if (!mapping) {
    // the default resolvers, inlined: no intermediate `mapped` object (ISSUE-191)
    if (isArr) {
      const bLength = (before as unknown as unknown[]).length
      const aLength = (after as unknown as unknown[]).length
      const common = Math.min(bLength, aLength)
      for (let i = 0; i < common; i++) {
        bkeys.push(i)
        akeys.push(i)
      }
      for (let i = aLength; i < bLength; i++) {
        removed.push(i)
      }
      for (let i = bLength; i < aLength; i++) {
        added.push(i)
      }
    } else {
      const bOwn = Object.keys(before)
      for (let i = 0; i < bOwn.length; i++) {
        const key = bOwn[i]
        if (isOwnEnumerable.call(after, key)) {
          bkeys.push(key)
          akeys.push(key)
        } else {
          removed.push(key)
        }
      }
      const aOwn = Object.keys(after)
      for (let i = 0; i < aOwn.length; i++) {
        if (!isOwnEnumerable.call(before, aOwn[i])) {
          added.push(aOwn[i])
        }
      }
    }
  } else if (!isArr && sameOwnKeys(before, after, bkeys, akeys, equalKeysShortcut(mapping))) {
    // the resolver would map every key to itself: `bkeys` / `akeys` are filled by `sameOwnKeys`
  } else {
    bkeys.length = 0
    akeys.length = 0
    try {
      const result = (mapping as any)(before, after, ctx)
      added = result.added
      removed = result.removed
      const mapped = result.mapped as Record<string, string | number>
      // `Object.keys` instead of `for...in`: a keyed load inside `for...in` is specialized to the hidden class of the
      // mapping object, which differs for every container, and V8 deoptimized this function on every call (ISSUE-191)
      const keys = Object.keys(mapped)
      for (let i = 0; i < keys.length; i++) {
        const bkey = keys[i]
        const akey = mapped[bkey]
        bkeys.push(isArr ? +bkey : bkey)
        akeys.push(akey)
        renamed ||= !isArr && bkey !== akey
      }
    } catch (error) {
      session.report({
        kind: "mapping",
        message: `Mapping resolver error: ${error instanceof Error ? error.message : String(error)}`,
        path: bPath,
        scope: ctx.scope,
        error,
      })
      const fallback = (isArr ? arrayMappingResolver : objectMappingResolver)(before as any, after as any, ctx)
      added = fallback.added
      removed = fallback.removed
      bkeys.length = 0
      akeys.length = 0
      renamed = false
      for (const [bkey, akey] of Object.entries(fallback.mapped as Record<string, string | number>)) {
        bkeys.push(isArr ? +bkey : bkey)
        akeys.push(akey)
      }
    }
  }

  return { added, removed, bkeys, akeys, renamed }
}

// removed nodes: reported first, written into merged after the mapped nodes (appended for arrays)
interface RemovedNodes {
  keys: (string | number)[]
  diffs: Diff[]
  contexts: CompareContext[]
}

const reportRemoved = (
  ctx: CompareContext,
  before: Record<string | number, unknown>,
  removed: (string | number)[],
  sink: DiffSink,
): RemovedNodes => {
  const bPath = ctx.before.path
  const result: RemovedNodes = { keys: [], diffs: [], contexts: [] }
  for (let k = 0; k < removed.length; k++) {
    const bkey = removed[k]
    const child = createChildContext(ctx, bkey, undefined)
    const diff = diffFactory.removed([...bPath, bkey], before[bkey], child)
    // reported at the component declaration only: `merged` shows the after state here
    if (isDeclarationOnly(diff, child)) {
      continue
    }
    result.diffs.push(diff)
    result.contexts.push(child)
    result.keys.push(bkey)
    push(sink, diff, child)
  }
  return result
}

// renamed keys (objects only); returns the number of merge meta entries written
const reportRenamed = (
  ctx: CompareContext,
  bkeys: (string | number)[],
  akeys: (string | number)[],
  nodeMeta: MergeMetaRecord,
  sink: DiffSink,
): number => {
  const bPath = ctx.before.path
  let count = 0
  for (let i = 0; i < bkeys.length; i++) {
    const bkey = bkeys[i]
    const akey = akeys[i]
    if (bkey === akey) {
      continue
    }
    const child = createChildContext(ctx, bkey, akey)
    const diff = diffFactory.renamed(bPath, bkey, akey, child)
    if (!isDeclarationOnly(diff, child)) {
      setMeta(nodeMeta, akey, convertDiffToMeta(diff))
      count++
      push(sink, diff, child)
    }
  }
  return count
}

const finishContainer = (frame: ContainerFrame): void => {
  const { ctx, before, after, merged, nodeMeta, added, removedNodes, slot, sink, diffCountBefore } = frame
  const { session } = ctx
  const { arrayMeta, metaKey, normalized } = session
  const isArr = Array.isArray(merged)
  const bPath = ctx.before.path

  // added nodes
  for (let k = 0; k < added.length; k++) {
    const akey = added[k]
    const child = createChildContext(ctx, undefined, akey)
    const diff = diffFactory.added([...bPath, akey], after[akey], child)
    setKey(merged, akey, mergedValue(ctx, child.after, after[akey]))
    if (!isDeclarationOnly(diff, child)) {
      setMeta(nodeMeta, akey, convertDiffToMeta(diff))
      frame.metaCount++
      push(sink, diff, child)
    }
  }

  // removed values: appended after the last after index for arrays, kept under their key for objects
  const removedKeys = removedNodes.keys
  for (let i = 0; i < removedKeys.length; i++) {
    const bkey = removedKeys[i]
    const mkey = isArr ? (after as unknown as unknown[]).length + i : bkey
    setKey(merged, mkey, mergedValue(ctx, removedNodes.contexts[i].before, before[bkey]))
    setMeta(nodeMeta, mkey, convertDiffToMeta(removedNodes.diffs[i]))
    frame.metaCount++
  }

  const hasMeta = frame.metaCount > 0

  if (!normalized) {
    const aSource = ctx.after.source
    // an unchanged subtree is the original after value (aliased until a changed ancestor copies it), also where a
    // transform changed its shape (decision §11.1: merged holds the original values)
    if (session.diffCount === diffCountBefore && !hasMeta && isObject(aSource)) {
      session.aliases.add(aSource)
      write(slot, aSource)
      return
    }
    if (!isArr && isPlainObject(aSource)) {
      const mergedObject = merged as Record<string, unknown>
      const bSource = isPlainObject(ctx.before.source) ? ctx.before.source : undefined
      const { aliases } = session
      // one pass: aliased children are copied (this container changed, it must not leak input objects), empty
      // containers created by a transform (present in neither input) are dropped
      const mergedKeys = Object.keys(mergedObject)
      for (let k = 0; k < mergedKeys.length; k++) {
        const key = mergedKeys[k]
        const value = mergedObject[key]
        if (typeof value !== "object" || value === null) {
          continue
        }
        if (
          !(key in aSource || (bSource && key in bSource) || key in nodeMeta) &&
          Object.keys(value).length === 0 &&
          !Object.getOwnPropertySymbols(value).length
        ) {
          delete mergedObject[key]
        } else if (aliases.has(value)) {
          setKey(mergedObject, key, deepCopy(value))
        }
      }
      // keys the transforms removed from the compared value come back from the original
      const sourceKeys = Object.keys(aSource)
      for (let k = 0; k < sourceKeys.length; k++) {
        const key = sourceKeys[k]
        if (!(key in mergedObject)) {
          setKey(mergedObject, key, deepCopy(aSource[key]))
        }
      }
    } else {
      detachAliases(session, merged)
    }
  } else {
    // this container changed (or holds changed descendants): its aliased children must not leak input objects
    detachAliases(session, merged)
  }

  if (!hasMeta) {
    return
  }

  if (isArr && !arrayMeta) {
    setSlotMeta(slot, { array: nodeMeta })
  } else {
    setKey(merged, metaKey, nodeMeta)
  }
}

const openContainer = (
  ctx: CompareContext,
  before: Record<string | number, unknown>,
  after: Record<string | number, unknown>,
  slot: MergedSlot,
  sink: DiffSink,
  hint: ChangedHint,
): ContainerFrame => {
  const { session } = ctx
  const view = ruleView(ctx.rules)
  const { mapping } = view
  const isArr = Array.isArray(before)
  const merged: Record<string | number, unknown> | unknown[] = isArr ? [] : {}
  const diffCountBefore = session.diffCount

  write(slot, merged)

  const { added, removed, bkeys, akeys, renamed } = mapContainerKeys(ctx, before, after, isArr, mapping)

  const nodeMeta: MergeMetaRecord = {}

  const removedNodes = reportRemoved(ctx, before, removed, sink)
  const renamedCount = renamed ? reportRenamed(ctx, bkeys, akeys, nodeMeta, sink) : 0

  // mapped nodes, in before order, written at the after key (by `walk`)
  const hintKey = hint?.length ? String(hint[0]) : undefined
  return {
    i: 0,
    ctx,
    view,
    before,
    after,
    slot,
    sink,
    merged,
    nodeMeta,
    added,
    removedNodes,
    bkeys,
    akeys,
    hint,
    hintKey,
    diffCountBefore,
    metaCount: renamedCount,
  }
}

const runCompare = (ctx: CompareContext): NestedCompareResult => {
  const holder: Record<string, unknown> = {}
  const meta: MergeMetaRecord = {}
  const sink: DiffSink = { diffs: [], contexts: [] }

  walk(ctx, { node: holder, key: ROOT_KEY, meta, owner: undefined }, sink)

  // the root (or a nested root returned to a resolver) must be an independent copy
  const merged = holder[ROOT_KEY]
  if (isObject(merged) && ctx.session.aliases.has(merged)) {
    holder[ROOT_KEY] = deepCopy(merged)
    ctx.session.aliases.delete(merged)
  }

  // one shape for every nested result (`rootMergeMeta` may be undefined)
  return {
    diffs: sink.diffs,
    contexts: sink.contexts,
    merged: holder[ROOT_KEY],
    rootMergeMeta: meta[ROOT_KEY],
  }
}

export interface NestedCompareOptions {
  // rules for the nested root (default: the rules of the context)
  rules?: CompareRules
  // declaration paths of the nested values when they are not the context paths (inside $ref targets)
  origin?: { before: JsonPath; after: JsonPath }
  // scope for the nested root (default: inherited)
  scope?: CompareScope
}

/**
 * Compares two values as the content of the context node: paths, parent chain, scope and session are inherited from
 * `ctx`, so a `$ref` target or a combinator branch is compared as if it were in place.
 */
export const compareNested = (
  ctx: CompareContext,
  before: unknown,
  after: unknown,
  nested: NestedCompareOptions = {},
): NestedCompareResult => {
  const scope = nested.scope ?? ctx.scope
  const b = ctx.before
  const a = ctx.after
  // node contexts of the one shape `createChildContext` uses (a spread would give each call a new hidden class)
  const rootCtx: CompareContext = {
    before: {
      path: b.path,
      key: b.key,
      value: before,
      parent: b.parent,
      root: b.root,
      up: b.up,
      scope,
      source: before,
      origin: nested.origin ? nested.origin.before : b.origin,
      kind: b.kind,
    },
    after: {
      path: a.path,
      key: a.key,
      value: after,
      parent: a.parent,
      root: a.root,
      up: a.up,
      scope,
      source: after,
      origin: nested.origin ? nested.origin.after : a.origin,
      kind: a.kind,
    },
    rules: nested.rules ?? ctx.rules,
    options: ctx.options,
    scope,
    session: ctx.session,
  }
  return runCompare(rootCtx)
}

const rootNodeContext = (
  value: unknown,
  source: { source: unknown; jsonPath: JsonPath } | undefined,
  scope: CompareScope,
  kind: string | undefined,
): NodeContext => {
  if (!source) {
    return {
      path: [],
      key: ROOT_KEY,
      value,
      parent: undefined,
      root: value,
      up: undefined,
      scope,
      source: value,
      origin: undefined,
      kind,
    }
  }
  const { source: root, jsonPath } = source
  const parentPath = jsonPath.slice(0, -1)
  const parent = parentPath.length ? getKeyValue(root, ...parentPath) : root
  return {
    path: [...jsonPath],
    key: jsonPath.length ? jsonPath[jsonPath.length - 1] : ROOT_KEY,
    value,
    parent: jsonPath.length ? parent : undefined,
    root,
    up: undefined,
    scope,
    source: value,
    origin: undefined,
    kind,
  }
}

export const createRootContext = (
  before: unknown,
  after: unknown,
  options: CompareOptions,
  session: CompareSession,
  context: { before?: { source: unknown; jsonPath: JsonPath }; after?: { source: unknown; jsonPath: JsonPath } } = {},
): CompareContext => {
  const rules = options.rules ?? {}
  const scope = resolveScope(rules, CompareScopes.root, { key: ROOT_KEY, path: [], value: before })
  const { kind } = ruleView(rules)
  const bNode = rootNodeContext(before, context.before, scope, kind)
  const aNode = rootNodeContext(after, context.after, scope, kind)
  if (!context.before && !context.after) {
    aNode.path = bNode.path
  }
  return {
    before: bNode,
    after: aNode,
    rules,
    options,
    scope,
    session,
  }
}

/**
 * The options of an engine call with its default `rules` and `annotateHook`: a literal of one shape extended with the
 * caller's options, instead of a spread of the caller's options whose hidden class is created anew after every garbage
 * collection (the walk reads `ctx.options`, ISSUE-191).
 */
export const withDefaults = <T extends CompareOptions>(
  options: T,
  rules: CompareRules,
  annotateHook: CompareOptions["annotateHook"],
): T & { rules: CompareRules; annotateHook: CompareOptions["annotateHook"] } => {
  const result = Object.assign({ rules, annotateHook }, options)
  result.rules = rules
  result.annotateHook = annotateHook
  return result
}

export const compare: CompareEngine = (before, after, options = {}, context = {}): CompareResult => {
  let session = createSession(options)
  let result = runCompare(createRootContext(before, after, options, session, context))
  // a change left to a declaration that the declaration does not report is emitted at its usage locations instead
  // (POLICY-60): the second pass knows which changes those are; with consistent pairing it is rarely needed
  const unreported = unreportedDeclarationChanges(session, result.diffs, result.contexts)
  if (unreported) {
    session = createSession(options)
    session.keepAtUsage = unreported
    result = runCompare(createRootContext(before, after, options, session, context))
  }
  const { diffs, merged, rootMergeMeta } = result

  return {
    diffs,
    merged,
    ...(rootMergeMeta ? { rootMergeMeta } : {}),
    ...(session.errors.length ? { errors: session.errors } : {}),
  }
}
