import type { CompareContext, CompareResolver, CompareResult, Diff, MergeMetaRecord } from "../types"
import { convertDiffToMeta, createChildContext, deepEqual, diffFactory } from "../core"
import { deepCopy, getKeyValue, isObject } from "../utils"
import { httpBindingMappingResolver } from "./protoapi.mapping"
import { type Interval, isInterval, mergeIntervals, refTarget, subtractInterval } from "./protoapi.utils"

// Compare resolvers of ProtoApi values compared as a whole (PROTOAPI_DESIGN §4.6): interval sets by coverage (Q12),
// rpc sides (S5) and HTTP bindings (S6) as one value each, so that one source change is one record (R-1).

// the original value of a side (the input, not a transformed shadow)
const original = (side: CompareContext["before"]): unknown => (side.source !== undefined ? side.source : side.value)

// the merged value of a resolver: a copy of the after value (the merged document never shares input objects)
const mergedCopy = (ctx: CompareContext): unknown => deepCopy(original(ctx.after))

const metaKeyOf = (ctx: CompareContext) => ctx.session.metaKey as string

// ---- interval sets (Q12)

/**
 * Reserved numbers, extension ranges and enum reserved numbers are compared by coverage (Q12): both sides are merged
 * into interval sets; every before interval that lost numbers is one `remove` diff at its before index (`before` = the
 * lost intervals), every after interval that gained numbers one `add` diff at its after index (`after` = the gained
 * intervals); a statement rewritten without a coverage change gives no diff (`reserved 5, 6` ≡ `reserved 5 to 6`). The
 * merged value is the after list, with the removed intervals appended after its last index (as for combinators).
 */
export const rangeCoverageCompareResolver: CompareResolver = (ctx) => {
  const bList = ctx.before.value
  const aList = ctx.after.value
  if (!Array.isArray(bList) || !Array.isArray(aList)) {
    return
  }
  const bSet = mergeIntervals(bList)
  const aSet = mergeIntervals(aList)
  const diffs: Diff[] = []
  const contexts: CompareContext[] = []
  const meta: MergeMetaRecord = {}
  const merged = (mergedCopy(ctx) as unknown[]) ?? []
  const path = ctx.before.path

  // coverage reported so far (an interval listed twice on one side is reported once)
  let lostReported: Interval[] = []
  for (let i = 0; i < bList.length; i++) {
    const interval = bList[i]
    if (!isInterval(interval)) {
      continue
    }
    const lost = subtractInterval(interval, mergeIntervals([...aSet, ...lostReported]))
    if (!lost.length) {
      continue
    }
    lostReported = mergeIntervals([...lostReported, ...lost])
    const child = createChildContext(ctx, i, undefined)
    const diff = diffFactory.removed([...path, i], lost, child)
    diffs.push(diff)
    contexts.push(child)
    meta[merged.length] = convertDiffToMeta(diff)
    merged.push(deepCopy(interval))
  }
  let gainedReported: Interval[] = []
  for (let j = 0; j < aList.length; j++) {
    const interval = aList[j]
    if (!isInterval(interval)) {
      continue
    }
    const gained = subtractInterval(interval, mergeIntervals([...bSet, ...gainedReported]))
    if (!gained.length) {
      continue
    }
    gainedReported = mergeIntervals([...gainedReported, ...gained])
    const child = createChildContext(ctx, undefined, j)
    const diff = diffFactory.added([...path, j], gained, child)
    diffs.push(diff)
    contexts.push(child)
    meta[j] = convertDiffToMeta(diff)
  }
  const hasMeta = Object.keys(meta).length > 0
  if (hasMeta && ctx.session.arrayMeta) {
    ;(merged as unknown as Record<string, unknown>)[metaKeyOf(ctx)] = meta
  }
  return {
    diffs,
    contexts,
    merged,
    rootMergeMeta: hasMeta && !ctx.session.arrayMeta ? { array: meta } : undefined,
  } as CompareResult
}

// ---- rpc sides (S5)

/** The spelling of an rpc side (S5): `[stream ]<message>`, the message named by its fully qualified name. */
export const methodSideSpelling = (side: unknown): string | undefined => {
  if (!isObject(side)) {
    return
  }
  const ref = getKeyValue(side, "schema", "$ref")
  const name = refTarget(ref)?.name ?? (typeof ref === "string" ? ref : undefined)
  return name === undefined ? undefined : `${getKeyValue(side, "stream") === true ? "stream " : ""}${name}`
}

/**
 * An rpc's `request` or `response` is one value (S5): equal spellings give no diff (other keys, if any, are walked),
 * different spellings one `replace` diff at the side with the original values, classified by the side rule
 * (`methodMessageClassifier`: streaming toggled R-5 / R-6, else the retarget R-3 / R-4). The side rule keeps its
 * `scope` and its `schema.$ref` child, so the usage index still records the referenced messages in that scope.
 */
export const methodMessageCompareResolver: CompareResolver = (ctx) => {
  const bSpelling = methodSideSpelling(ctx.before.value)
  const aSpelling = methodSideSpelling(ctx.after.value)
  if (bSpelling === undefined || aSpelling === undefined || bSpelling === aSpelling) {
    return
  }
  const diff = diffFactory.replaced(ctx.before.path, original(ctx.before), original(ctx.after), ctx)
  return {
    diffs: [diff],
    contexts: [ctx],
    merged: mergedCopy(ctx),
    rootMergeMeta: convertDiffToMeta(diff),
  } as CompareResult
}

// ---- HTTP bindings (S6, S7)

const PRIMARY_BINDING_KEYS = ["method", "path", "body", "responseBody"] as const

/** The primary binding of an `http` value (S6): `method`, `path`, `body`, `responseBody`, without the others. */
export const primaryBinding = (http: unknown): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const key of PRIMARY_BINDING_KEYS) {
    const value = getKeyValue(http, key)
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

const bindingsOf = (http: unknown): unknown[] => {
  const bindings = getKeyValue(http, "additionalBindings")
  return Array.isArray(bindings) ? bindings : []
}

/**
 * An rpc's `http` rule (S6, S7): the primary binding is one value, one `replace` diff at `R/http` when it differs
 * (`before` / `after` without `additionalBindings`); the additional bindings pair by method + path, then by position
 * (`httpBindingMappingResolver`), each pair compared as one value (one `replace` diff at
 * `R/http/additionalBindings/<i>`), unmatched bindings added or removed. The rule's `add` / `remove` as a whole is
 * the walk's (R-9, R-10). Classified by the `R/http` and `R/http/additionalBindings/*` rules.
 */
export const httpBindingCompareResolver: CompareResolver = (ctx) => {
  const bHttp = original(ctx.before)
  const aHttp = original(ctx.after)
  if (!isObject(bHttp) || !isObject(aHttp)) {
    return
  }
  const diffs: Diff[] = []
  const contexts: CompareContext[] = []
  const merged = mergedCopy(ctx) as Record<string, unknown>
  const metaKey = metaKeyOf(ctx)

  let rootMergeMeta: CompareResult["rootMergeMeta"]
  const bPrimary = primaryBinding(bHttp)
  const aPrimary = primaryBinding(aHttp)
  if (!deepEqual(bPrimary, aPrimary)) {
    const diff = diffFactory.replaced(ctx.before.path, bPrimary, aPrimary, ctx)
    diffs.push(diff)
    contexts.push(ctx)
    rootMergeMeta = convertDiffToMeta(diff)
  }

  const bBindings = bindingsOf(bHttp)
  const aBindings = bindingsOf(aHttp)
  const listCtx = createChildContext(ctx, "additionalBindings", "additionalBindings")
  listCtx.before.value = bBindings
  listCtx.after.value = aBindings
  const { added, removed, mapped } = httpBindingMappingResolver(bBindings, aBindings, listCtx)
  const path = [...ctx.before.path, "additionalBindings"]
  const meta: MergeMetaRecord = {}
  const mergedBindings = Array.isArray(merged.additionalBindings) ? (merged.additionalBindings as unknown[]) : []
  for (const key of Object.keys(mapped)) {
    const i = Number(key)
    const j = (mapped as Record<number, number>)[i]
    if (deepEqual(bBindings[i], aBindings[j])) {
      continue
    }
    const child = createChildContext(listCtx, i, j)
    const diff = diffFactory.replaced([...path, i], bBindings[i], aBindings[j], child)
    diffs.push(diff)
    contexts.push(child)
    meta[j] = convertDiffToMeta(diff)
  }
  for (const i of removed) {
    const child = createChildContext(listCtx, i, undefined)
    const diff = diffFactory.removed([...path, i], bBindings[i], child)
    diffs.push(diff)
    contexts.push(child)
    meta[mergedBindings.length] = convertDiffToMeta(diff)
    mergedBindings.push(deepCopy(bBindings[i]))
  }
  for (const j of added) {
    const child = createChildContext(listCtx, undefined, j)
    const diff = diffFactory.added([...path, j], aBindings[j], child)
    diffs.push(diff)
    contexts.push(child)
    meta[j] = convertDiffToMeta(diff)
  }
  if (Object.keys(meta).length) {
    merged.additionalBindings = mergedBindings
    if (ctx.session.arrayMeta) {
      ;(mergedBindings as unknown as Record<string, unknown>)[metaKey] = meta
    } else {
      merged[metaKey] = { additionalBindings: { array: meta } }
    }
  }
  return { diffs, contexts, merged, rootMergeMeta } as CompareResult
}
