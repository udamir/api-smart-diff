import type { CompareContext, CompareSession } from "../types"
import { isObject } from "../utils"
import { ownValue } from "../own"

// root keys that select a specification profile: a subtree is interpreted the same way on both sides only when the
// two documents agree on them (OpenAPI 3.0 and 3.1 read `exclusiveMaximum`, `nullable` or `example` differently)
const PROFILE_KEYS = ["openapi", "asyncapi", "graphapi", "protoapi", "swagger", "$schema", "jsonSchemaDialect"]

const UNCHANGED_KEY = "unchanged-subtrees"

interface UnchangedState {
  enabled: boolean
  // results of `$ref` pairs (`before ref|after ref`); `false` is final, `true` may be tentative (see `frames`)
  refs: Map<string, boolean>
  // container pairs known to differ (the nodes on the way to a difference found by an ancestor's check): their own
  // check is answered without scanning them again
  changed: WeakMap<object, { after: object; path: (string | number)[] }>
  // container pairs a check found unchanged (before -> after): a `$ref` to one of them (an AsyncAPI 3.0 operation's
  // channel, an OpenAPI usage of a component walked as unchanged) is answered without scanning it again (ISSUE-331)
  equal: WeakMap<object, object>
  // the `$ref` pairs being compared, outermost first, and the stack index of each: a pair met again while it is being
  // compared (a cycle) is assumed unchanged until its own check ends
  frames: RefFrame[]
  pending: Map<string, number>
}

// a `$ref` pair being compared: `low` is the outermost pending pair its result assumed unchanged (its own index when
// none), `tentative` the pairs found unchanged under the assumption that this pair is unchanged (ISSUE-416)
interface RefFrame {
  low: number
  tentative: string[]
}

// deeper subtrees (and cyclic object graphs, which never end) are left to the walk, which guards against cycles
const MAX_DEPTH = 256
// nested `$ref` targets followed by one check (`MAX_DEPTH` restarts at every target); a longer reference chain is left
// to the walk, which compares it target by target (ISSUE-411)
const MAX_REF_DEPTH = 128

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true
  }
  // JSON documents: NaN does not occur, but keep `Object.is` semantics for numbers
  return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)
}

const stateOf = (ctx: CompareContext): UnchangedState => {
  const { session } = ctx
  let state = session.caches.get(UNCHANGED_KEY) as UnchangedState | undefined
  if (!state) {
    const bRoot = ctx.before.root
    const aRoot = ctx.after.root
    const enabled =
      ctx.options.compareUnchanged !== true &&
      isObject(bRoot) &&
      isObject(aRoot) &&
      PROFILE_KEYS.every((key) => sameValue(ownValue(bRoot, key), ownValue(aRoot, key)))
    state = { enabled, refs: new Map(), changed: new WeakMap(), equal: new WeakMap(), frames: [], pending: new Map() }
    session.caches.set(UNCHANGED_KEY, state)
  }
  return state
}

const equalRefs = (session: CompareSession, state: UnchangedState, ctx: CompareContext, ref: string): boolean => {
  const bTarget = session.resolveRef("before", ctx.before.root, ref)
  const aTarget = session.resolveRef("after", ctx.after.root, ref)
  if (!bTarget || !aTarget) {
    // an unresolvable reference is reported by the walk
    return false
  }
  const key = `${bTarget.ref}|${aTarget.ref}`
  const { frames } = state
  const pending = state.pending.get(key)
  if (pending !== undefined) {
    // a cycle: unchanged as long as nothing else differs, which the pair's own check decides
    const top = frames[frames.length - 1]
    if (pending < top.low) {
      top.low = pending
    }
    return true
  }
  const known = state.refs.get(key)
  if (known !== undefined) {
    return known
  }
  const bValue = bTarget.value
  const aValue = aTarget.value
  if (isObject(bValue) && state.equal.get(bValue) === aValue) {
    state.refs.set(key, true)
    return true
  }
  const index = frames.length
  if (index >= MAX_REF_DEPTH) {
    // not cached: the same pair checked from a shallower start may still be found unchanged; the pairs on the stack
    // above it are cached as changed, which only means that the walk compares them (ISSUE-411)
    return false
  }
  const frame: RefFrame = { low: index, tentative: [] }
  frames.push(frame)
  state.pending.set(key, index)
  const mark = diffPath.length
  const result = equalNodes(session, state, ctx, bValue, aValue, 0)
  // the keys inside the target are not keys of the tree being checked (the walk compares a target through the
  // reference's resolver, never with this hint): dropped, so that the way to a difference ends at the reference and
  // does not grow with the length of a reference chain, which made checking a chain quadratic (ISSUE-412)
  diffPath.length = mark
  frames.pop()
  state.pending.delete(key)
  state.refs.set(key, result)
  if (!result) {
    // a difference is final; the pairs found unchanged on the assumption that this one is unchanged are not (a
    // cached `true` there hid a change inside a cycle from every later usage, ISSUE-416)
    for (let i = 0; i < frame.tentative.length; i++) {
      state.refs.delete(frame.tentative[i])
    }
    return false
  }
  if (frame.low < index) {
    // unchanged if the outer pending pair it assumed unchanged is: decided when that pair's check ends
    const owner = frames[frame.low]
    owner.tentative.push(key)
    for (let i = 0; i < frame.tentative.length; i++) {
      owner.tentative.push(frame.tentative[i])
    }
    const parent = frames[index - 1]
    if (frame.low < parent.low) {
      parent.low = frame.low
    }
    return true
  }
  // final: the same pair met again in the walked tree is answered without scanning it (P10)
  if (isObject(bValue) && isObject(aValue)) {
    state.equal.set(bValue, aValue)
  }
  return true
}

// keys from the node being checked down to the first difference found, collected in reverse while unwinding
let diffPath: (string | number)[] = []

const equalNodes = (
  session: CompareSession,
  state: UnchangedState,
  ctx: CompareContext,
  before: unknown,
  after: unknown,
  depth: number,
): boolean => {
  // `isObject` written out: this runs for every node of every checked subtree (ISSUE-330)
  const bObject = typeof before === "object" && before !== null
  if (before === after && !bObject) {
    return true
  }
  if (!bObject || typeof after !== "object" || after === null) {
    return sameValue(before, after)
  }
  if (depth > MAX_DEPTH) {
    return false
  }
  if (state.equal.get(before) === after) {
    return true
  }
  const known = state.changed.get(before)
  if (known?.after === after) {
    for (let i = known.path.length - 1; i >= 0; i--) {
      diffPath.push(known.path[i])
    }
    return false
  }
  const mark = diffPath.length
  const equal = equalContainers(
    session,
    state,
    ctx,
    before as Record<string | number, unknown>,
    after as Record<string | number, unknown>,
    depth,
  )
  // remembered for the root of a check (a walked container or a `$ref` target, reached again from other usages); the
  // containers inside it on the way to the difference are passed down by the walk as its hint (ISSUE-330: a weak map
  // entry per container on that way was a noticeable part of every check)
  if (!equal && depth === 0) {
    state.changed.set(before, { after, path: diffPath.slice(mark).reverse() })
  }
  return equal
}

const equalContainers = (
  session: CompareSession,
  state: UnchangedState,
  ctx: CompareContext,
  before: Record<string | number, unknown>,
  after: Record<string | number, unknown>,
  depth: number,
): boolean => {
  if (Array.isArray(before)) {
    if (!Array.isArray(after) || before.length !== after.length) {
      return false
    }
    for (let i = 0; i < before.length; i++) {
      if (!equalNodes(session, state, ctx, before[i], after[i], depth + 1)) {
        diffPath.push(i)
        return false
      }
    }
    return true
  }
  if (Array.isArray(after)) {
    return false
  }
  // `Object.keys` for the keyed loads: inside `for...in` they are specialized to the hidden class of the object, which
  // differs for almost every node, and V8 deoptimized this function again and again (ISSUE-191); the after side is
  // only counted
  const keys = Object.keys(before)
  let count = keys.length
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (!(key in after)) {
      return false
    }
    if (!equalNodes(session, state, ctx, before[key], after[key], depth + 1)) {
      diffPath.push(key)
      return false
    }
  }
  for (const _key in after) {
    count--
  }
  if (count !== 0) {
    return false
  }
  // a reference is unchanged only when its targets are
  const ref = ownValue(before, "$ref")
  return typeof ref !== "string" || equalRefs(session, state, ctx, ref)
}

/**
 * Whether two containers are unchanged: structurally equal, every `$ref` in them pointing at the same reference whose
 * targets are unchanged too, and both documents read with the same specification profile. Such a subtree yields no
 * diff and its merged value is the after value as written, so the walk (rules, transforms, mapping) is skipped
 * (ISSUE-58). Disabled with `compareUnchanged: true` (custom rules that report on equal values, POLICY-58).
 */
export const isUnchangedSubtree = (ctx: CompareContext, before: unknown, after: unknown): boolean =>
  checkUnchangedSubtree(ctx, before, after) === true

/**
 * `true` when the subtree is unchanged (see `isUnchangedSubtree`), otherwise the keys (in before order) from the node
 * to the first difference found, or `false` when the check does not apply. The walk uses the keys to skip the check on
 * the nodes along that way: they are known to differ.
 */
export const checkUnchangedSubtree = (
  ctx: CompareContext,
  before: unknown,
  after: unknown,
): true | false | (string | number)[] => {
  const state = stateOf(ctx)
  if (!state.enabled) {
    return false
  }
  diffPath = []
  if (equalNodes(ctx.session, state, ctx, before, after, 0)) {
    if (isObject(before) && isObject(after)) {
      state.equal.set(before, after)
    }
    return true
  }
  const path = diffPath.reverse()
  diffPath = []
  return path
}
