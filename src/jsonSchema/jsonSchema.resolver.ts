import { isRefNode } from "../own"

import {
  diffFactory,
  convertDiffToMeta,
  createMergeMeta,
  compareNested,
  createChildContext,
  mergedValue,
  resolveNodeRules,
  DIFF_META_KEY,
  deepEqual,
  isComponentsScope,
  componentUsageScopes,
  isDeclarationTarget,
  isDeclarationOnly,
  allAnnotation,
  renamedReference,
} from "../core"
import { getCompareId } from "./jsonSchema.utils"
import { booleanSchemaClassifyRule } from "./jsonSchema.classify"
import { booleanSchemaChange, equivalentSchemaChange } from "./jsonSchema.annotate"
import {
  acceptsEverything,
  equivalentBySetRewrite,
  hasSetLevelKeyword,
  isUnsatisfiable,
  schemaTypes,
} from "./jsonSchema.semantics"
import type { JsonSchemaCompareCache } from "./jsonSchema.types"
import type { CachedCompareResult, CompareContext, CompareResolver, CompareResult, Diff, NodeContext } from "../types"
import { deepCopy, getKeyValue, isArray, isObject, isPlainObject, isString } from "../utils"
import { jsonSchemaAllowedSibling } from "./jsonSchema.consts"

/** Cheap signature of a schema branch used to order combinator candidates before the full comparison. */
const branchSignature = (value: unknown): string => {
  if (!isObject(value) || isArray(value)) {
    return typeof value
  }
  const parts: string[] = []
  if (isString(value.$ref)) {
    parts.push(`$ref:${value.$ref}`)
  }
  if (value.type !== undefined) {
    parts.push(`type:${JSON.stringify(value.type)}`)
  }
  if (isString(value.title)) {
    parts.push(`title:${value.title}`)
  }
  if (value.const !== undefined) {
    parts.push(`const:${JSON.stringify(value.const)}`)
  }
  if (isObject(value.properties)) {
    parts.push(`props:${Object.keys(value.properties).sort().join(",")}`)
  }
  return parts.join("|")
}

// the types a branch admits by its `type` keyword, as a comparable key ("" when it does not restrict the type)
const branchTypes = (value: unknown): string => {
  const types = schemaTypes(value)
  return types ? [...types].sort().join(",") : ""
}

export const combinaryCompareResolver: CompareResolver = (ctx) => {
  const { before, after, options } = ctx
  const { arrayMeta, metaKey = DIFF_META_KEY } = options

  if (!isArray(before.value) || !isArray(after.value)) {
    const diff = diffFactory.replaced(before.path, before.value, after.value, ctx)
    return {
      diffs: [diff],
      merged: after.value,
      rootMergeMeta: convertDiffToMeta(diff),
      contexts: [ctx],
    } as CompareResult
  }

  const { session } = ctx
  const afterMatched = new Set<number>(after.value.keys())
  const beforeMatched = new Set<number>(before.value.keys())
  const comparedItems: {
    before: number
    after: number
    diffs: Diff[]
    contexts: CompareContext[]
    merged: unknown
    // diffs left to the declaration (POLICY-57) with their contexts: counted for the pairing, so that a usage pairs the
    // branches as the declaration does, and recorded again for the chosen pairs only (POLICY-60)
    suppressedDiffs: Diff[]
    suppressedContexts: CompareContext[]
    // of these, the diffs of references nested in a usage's content that name the same declaration on both sides
    // (nominal at the declaration, so not counted for the pairing either)
    nominal: number
    weight: number
    // the branches admit the same types (or one does not restrict the type): preferred over a pair of branches of
    // different types, however few diffs that pair has (ISSUE-150)
    sameType: boolean
  }[] = []
  const nominalStart = session.nominalDiffs
  const _merged: unknown[] = []
  const _diffs: Diff[] = []
  const _contexts: CompareContext[] = []

  const rules = resolveNodeRules(ctx.rules, "*", before.path, before.value)
  const afterSignatures = after.value.map(branchSignature)
  const afterTypes = after.value.map(branchTypes)

  // exact (structurally equal) branches first: no comparison needed
  for (const i of before.value.keys()) {
    for (const j of afterMatched) {
      if (deepEqual(before.value[i], after.value[j])) {
        afterMatched.delete(j)
        beforeMatched.delete(i)
        _merged[j] = after.value[j]
        break
      }
    }
  }

  // compare the remaining combinations, candidates with an equal signature first, keep the pairs with the fewest diffs
  for (const i of beforeMatched) {
    const _before = before.value[i]
    const signature = branchSignature(_before)
    const types = branchTypes(_before)
    // candidates with an equal signature first, then those admitting the same types (ISSUE-150)
    const rank = (j: number) => (afterSignatures[j] === signature ? 0 : afterTypes[j] === types ? 1 : 2)
    const candidates = [...afterMatched].sort((a, b) => rank(a) - rank(b) || a - b)
    for (const j of candidates) {
      const child = createChildContext(ctx, i, j)
      const mark = session.suppressedDiffs.length
      const nominalMark = session.nominalDiffs
      const { diffs, merged, contexts } = compareNested(child, _before, after.value[j], { rules })
      const suppressedDiffs = session.suppressedDiffs.splice(mark)
      const suppressedContexts = session.suppressedContexts.splice(mark)
      const nominal = session.nominalDiffs - nominalMark
      const weight = diffs.length + suppressedDiffs.length - nominal
      comparedItems.push({
        sameType: !types || !afterTypes[j] || afterTypes[j] === types,
        before: i,
        after: j,
        diffs,
        contexts,
        merged,
        suppressedDiffs,
        suppressedContexts,
        nominal,
        weight,
      })
      if (!weight) {
        break
      }
    }
  }
  // only the chosen pairs count for an enclosing combinator
  session.nominalDiffs = nominalStart

  comparedItems.sort((a, b) => +b.sameType - +a.sameType || a.weight - b.weight)

  // keywords placed next to the combinator were lifted into every branch for comparison: a change to such a
  // keyword is reported once, at the combinator's parent, unless the branch itself declares the keyword
  const siblings = liftedSiblingKeys(ctx)
  const reported = new Set<string>()
  const parentPath = before.path.slice(0, -1)

  for (const compared of comparedItems) {
    if (!afterMatched.has(compared.after) || !beforeMatched.has(compared.before)) {
      continue
    }
    afterMatched.delete(compared.after)
    beforeMatched.delete(compared.before)
    for (let k = 0; k < compared.suppressedDiffs.length; k++) {
      session.suppressedDiffs.push(compared.suppressedDiffs[k])
      session.suppressedContexts.push(compared.suppressedContexts[k])
    }
    session.nominalDiffs += compared.nominal
    const bBranch = getKeyValue(before.source ?? before.value, compared.before)
    const aBranch = getKeyValue(after.source ?? after.value, compared.after)
    const ownKeys = new Set([
      ...(isObject(bBranch) ? Object.keys(bBranch) : []),
      ...(isObject(aBranch) ? Object.keys(aBranch) : []),
    ])
    const isLifted = (key: unknown) => isString(key) && siblings.has(key) && !ownKeys.has(key)

    compared.diffs.forEach((diff, i) => {
      const relative = diff.path.slice(before.path.length + 1)
      if (relative.length && isLifted(relative[0])) {
        const remapped: Diff = { ...diff, path: [...parentPath, ...relative] }
        const id = `${remapped.action}|${remapped.path.join("\u0000")}`
        if (reported.has(id)) {
          return
        }
        reported.add(id)
        _diffs.push(remapped)
      } else if (compared.before !== compared.after && relative.length) {
        // inside a branch paired with a branch at another index the diff is reported at the branch's merged (after)
        // position, where its merge meta is (decision §11.2, ISSUE-211)
        _diffs.push({ ...diff, path: [...before.path, compared.after, ...relative] })
      } else {
        _diffs.push(diff)
      }
      _contexts.push(compared.contexts[i])
    })

    // with original merged values (`keepOriginalMerged`) a lifted keyword stays at the combinator's parent only: it is
    // dropped from the branch (the compared branches hold it, as the normalized merged document does). The branch
    // result may be a cached `$ref` result lent to this usage (`refsCompareResolver`): copied before the lifted keys
    // are dropped, never changed in place
    if (isObject(compared.merged) && !isArray(compared.merged) && !session.normalized) {
      const keys = Object.keys(compared.merged)
      const meta = (compared.merged as Record<string | symbol, unknown>)[metaKey as string]
      const metaKeys = isObject(meta) ? Object.keys(meta) : []
      if (keys.some(isLifted) || metaKeys.some(isLifted)) {
        const branch: Record<string | symbol, unknown> = { ...compared.merged }
        for (const key of keys) {
          if (isLifted(key)) {
            delete branch[key]
          }
        }
        if (isObject(meta)) {
          const branchMeta: Record<string, unknown> = { ...meta }
          for (const key of metaKeys) {
            if (isLifted(key)) {
              delete branchMeta[key]
            }
          }
          if (Object.keys(branchMeta).length) {
            branch[metaKey as string] = branchMeta
          } else {
            delete branch[metaKey as string]
          }
        }
        compared.merged = branch
      }
    }
    _merged[compared.after] = compared.merged
  }

  const arrayMetaDiffs: Diff[] = []
  for (const j of afterMatched) {
    _merged[j] = after.value[j]
    const child = createChildContext(ctx, undefined, j)
    const diff = diffFactory.added([...before.path, j], after.value[j], child)
    if (isDeclarationOnly(diff, child)) {
      continue
    }
    arrayMetaDiffs.push(diff)
    _diffs.push(diff)
    _contexts.push(child)
  }

  // removed branches are appended after the last after index
  for (const i of beforeMatched) {
    const child = createChildContext(ctx, i, undefined)
    const diff = diffFactory.removed([...before.path, i], before.value[i], child)
    if (isDeclarationOnly(diff, child)) {
      continue
    }
    const mkey = _merged.length
    _merged.push(before.value[i])
    arrayMetaDiffs.push({ ...diff, path: [...before.path, mkey] })
    _diffs.push(diff)
    _contexts.push(child)
  }
  const rootArrayMeta = createMergeMeta(arrayMetaDiffs)

  if (arrayMeta) {
    ;(_merged as any)[metaKey] = rootArrayMeta
  }

  return {
    diffs: _diffs,
    contexts: _contexts,
    merged: _merged,
    rootMergeMeta: !arrayMeta && Object.keys(rootArrayMeta).length ? { array: rootArrayMeta } : undefined,
  } as CompareResult
}

// keys next to the combinator in either original parent node (except the combinator itself and the allowed siblings)
const liftedSiblingKeys = (ctx: CompareContext): Set<string> => {
  const keys = new Set<string>()
  const excluded = new Set([...jsonSchemaAllowedSibling, "oneOf", "anyOf", "allOf", "discriminator"])
  for (const side of [ctx.before, ctx.after]) {
    const parent = side.up?.source
    if (!isObject(parent) || isArray(parent)) {
      continue
    }
    for (const key of Object.keys(parent)) {
      if (!excluded.has(key)) {
        keys.add(key)
      }
    }
  }
  return keys
}

const NONE: never[] = []

const rebasePath = (path: (string | number)[], from: (string | number)[], to: (string | number)[]) => [
  ...to,
  ...path.slice(from.length),
]

/**
 * A node context of a cached `$ref` result moved to another usage: the node at the depth of the reference (the root of
 * the cached nested compare) takes the usage's path, key, parent and parent chain; the nodes below it keep their keys
 * and values with re-based paths. Shared nodes are rebuilt once per usage (`done`).
 */
const rebaseNode = (
  node: NodeContext,
  from: (string | number)[],
  usage: NodeContext,
  done: Map<NodeContext, NodeContext>,
): NodeContext => {
  const known = done.get(node)
  if (known) {
    return known
  }
  let result: NodeContext
  if (node.path.length <= from.length || !node.up) {
    result = {
      path: usage.path,
      key: usage.key,
      value: node.value,
      parent: usage.parent,
      root: node.root,
      up: usage.up,
      scope: node.scope,
      source: node.source,
      origin: node.origin,
      kind: usage.kind,
    }
  } else {
    const up = rebaseNode(node.up, from, usage, done)
    result = {
      path: rebasePath(node.path, from, usage.path),
      key: node.key,
      value: node.value,
      parent: node.parent,
      root: node.root,
      up,
      scope: node.scope,
      source: node.source,
      origin: node.origin,
      kind: node.kind,
    }
  }
  done.set(node, result)
  return result
}

// `prefix` is an ancestor path of `path` (or the same path); the target then contains the node being compared
const isPathPrefix = (prefix: (string | number)[], path: (string | number)[]) =>
  prefix.length <= path.length && prefix.every((step, i) => String(step) === String(path[i]))

/**
 * Direction of a node in the `components` scope: the usage scopes of the enclosing component (ISSUE-102). Two
 * components used in different directions classify the same `$ref` target differently, so a cached result is reused
 * only by a component with the same usage scopes. Other scopes carry their direction in the scope itself.
 */
const componentDirection = (ctx: CompareContext): string =>
  isComponentsScope(ctx.scope) && ctx.options.components !== "unclassified"
    ? [...componentUsageScopes(ctx)].sort().join(",")
    : ""

/**
 * Compares `$ref` nodes by their resolved content, reporting the changes at the usage path. Results of a `$ref` pair
 * are cached per session, scope and direction (`componentDirection`); cycles are detected with the session's
 * reference stack.
 */
export const refsCompareResolver: CompareResolver = (ctx: CompareContext) => {
  const { before, after, rules, options, session, scope } = ctx

  const bRefNode = isRefNode(before.value) ? before.value : undefined
  const aRefNode = isRefNode(after.value) ? after.value : undefined
  if (!bRefNode && !aRefNode) {
    return
  }

  const bTarget = bRefNode ? session.resolveRef("before", before.root, bRefNode.$ref) : undefined
  const aTarget = aRefNode ? session.resolveRef("after", after.root, aRefNode.$ref) : undefined

  if (bRefNode && !bTarget) {
    session.report({ kind: "ref", message: `Cannot resolve $ref: ${bRefNode.$ref}`, path: before.path, scope })
    return
  }
  if (aRefNode && !aTarget) {
    session.report({ kind: "ref", message: `Cannot resolve $ref: ${aRefNode.$ref}`, path: after.path, scope })
    return
  }

  const bRef = bTarget?.ref ?? ""
  const aRef = aTarget?.ref ?? ""

  // a reference that is being resolved higher up the current path, or that points at an ancestor of the node
  // (e.g. "#"): compared as an opaque node; when both sides close their cycle on the pair being compared up there
  // (a reference retargeted between two recursive components), the change is the one that comparison reports
  // (ISSUE-99)
  if ((bRef && session.refStack.before.has(bRef)) || (aRef && session.refStack.after.has(aRef))) {
    // ISSUE-310: a reference repointed through a rename names the same declaration, also when only one side closes its
    // cycle here (an inline copy of a renamed recursive component)
    if (
      bRef &&
      aRef &&
      (session.refPairs.has(`${bRef}|${aRef}`) || (bRef !== aRef && renamedReference(ctx, bRef) === aRef))
    ) {
      return { diffs: [], merged: mergedValue(ctx, after, after.value) }
    }
    return
  }
  // only a target in the node's own document can be its ancestor: a whole external document (`pet.json`, `pet.json#`)
  // resolves to the path `[]` of that document, which is no ancestor (ISSUE-417; a cycle through external documents is
  // caught by the reference stack above)
  if (
    (bTarget && bTarget.document === before.root && isPathPrefix(bTarget.path, before.origin ?? before.path)) ||
    (aTarget && aTarget.document === after.root && isPathPrefix(aTarget.path, after.origin ?? after.path))
  ) {
    // a reference to a renamed ancestor (a recursive component renamed with its references) is unchanged (POLICY-101)
    if (bRef && aRef && bRef !== aRef && renamedReference(ctx, bRef) === aRef) {
      return { diffs: [], merged: mergedValue(ctx, after, after.value) }
    }
    return
  }

  // inside the `components` section (schemas, responses, parameters, request bodies, messages, ...), a reference to
  // another declaration is nominal: the target's changes are reported once, at its own declaration, and not re-expanded
  // in every component that references it (ISSUE-53); the reference node itself (and any sibling keyword) is compared
  // as a plain node. Usage locations (operations, OpenAPI paths, AsyncAPI channels and their messages) keep expanding
  // references: each is a distinct location a client reads.
  // a reference repointed from a renamed declaration to its new key names the same declaration (POLICY-101)
  const repointed = !!bRef && !!aRef && bRef !== aRef && renamedReference(ctx, bRef) === aRef
  const sameDeclaration =
    !!bTarget &&
    !!aTarget &&
    (bRef === aRef || repointed) &&
    bTarget.document === before.root &&
    aTarget.document === after.root &&
    isDeclarationTarget(ctx, before.root, bTarget.path) &&
    isDeclarationTarget(ctx, after.root, aTarget.path)
  if (sameDeclaration && before.path[0] === "components" && after.path[0] === "components") {
    // a plain reference repointed by a rename is unchanged here: the content change is reported at the declaration
    if (
      repointed &&
      Object.keys(before.value as object).length === 1 &&
      Object.keys(after.value as object).length === 1
    ) {
      return { diffs: [], merged: mergedValue(ctx, after, after.value) }
    }
    if (!repointed) {
      return
    }
  }

  // at a usage location, the content of a declaration referenced on both sides is compared without its annotation
  // diffs: those are reported once, at the declaration (POLICY-57, ISSUE-190); results computed in this mode (also
  // inherited by references nested in it) are cached apart from the full ones
  const declarationOnly = sameDeclaration || session.declarationOnly > 0
  let cacheKey = bRef && aRef ? `${scope}|${getCompareId(bRef, aRef)}${declarationOnly ? "|d" : ""}` : ""
  let cached = cacheKey ? session.refResults.get(cacheKey) : undefined
  // a result without diffs does not depend on the direction; one with diffs is reused in the same direction only
  // (the usage index is built by then: the cached diffs were classified with it)
  if (cached?.direction !== undefined) {
    const direction = componentDirection(ctx)
    if (direction !== cached.direction) {
      cacheKey = `${cacheKey}|${direction}`
      cached = session.refResults.get(cacheKey)
    }
  }
  // an unchanged reference stays a reference in `merged` (decision §11.1: original values; the resolved target is
  // inlined only where it carries changes)
  if (cached && !cached.diffs.length && !cached.rootMergeMeta) {
    return { diffs: [], merged: mergedValue(ctx, after, after.value) }
  }
  // a reference nested in the content of a usage that names the same declaration on both sides: nominal at the
  // declaration (counted apart for the combinator pairing, see `combinaryCompareResolver`)
  const nominal = sameDeclaration && session.declarationOnly > 0 && session.nominalNesting === 0
  if (cached) {
    if (nominal) {
      session.nominalDiffs += cached.diffs.length + cached.suppressedDiffs.length
    }
    for (let k = 0; k < cached.suppressedDiffs.length; k++) {
      session.suppressedDiffs.push(cached.suppressedDiffs[k])
      session.suppressedContexts.push(cached.suppressedContexts[k])
    }
    // the contexts of the cached diffs are re-based onto this usage: paths and the parent chain above the
    // reference, so a description names this usage's media type, status code, header or channel (ISSUE-55)
    const bChain = new Map<NodeContext, NodeContext>()
    const aChain = new Map<NodeContext, NodeContext>()
    const diffs = cached.diffs.map((diff, i) => {
      const cachedCtx = cached.contexts[i]
      const _ctx: CompareContext = {
        ...cachedCtx,
        before: rebaseNode(cachedCtx.before, cached.bPath, before, bChain),
        after: rebaseNode(cachedCtx.after, cached.aPath, after, aChain),
      }
      // without the cached description (a `delete` would turn every re-based diff into a slow dictionary object)
      const { description: _description, ...rest } = diff
      const _diff: Diff = { ...rest, path: rebasePath(diff.path, cached.bPath, before.path) }
      const description = options.annotateHook?.(_diff, _ctx)
      if (description) {
        _diff.description = description
      }
      session.diffCount++
      return _diff
    })
    return {
      diffs,
      contexts: cached.contexts,
      merged: deepCopy(cached.merged),
      rootMergeMeta: cached.rootMergeMeta ? deepCopy(cached.rootMergeMeta) : undefined,
    } as CompareResult
  }

  const _before = bTarget ? bTarget.value : before.value
  const _after = aTarget ? aTarget.value : after.value

  if (bRef) {
    session.refStack.before.add(bRef)
  }
  if (aRef) {
    session.refStack.after.add(aRef)
  }
  const pair = bRef && aRef ? `${bRef}|${aRef}` : ""
  const newPair = !!pair && !session.refPairs.has(pair)
  if (newPair) {
    session.refPairs.add(pair)
  }
  if (sameDeclaration) {
    session.declarationOnly++
  }
  if (nominal) {
    session.nominalNesting++
  }

  let result: CachedCompareResult
  const mark = session.suppressedDiffs.length
  try {
    const nested = compareNested(ctx, _before, _after, {
      rules,
      origin: {
        before: bTarget ? bTarget.path : (before.origin ?? before.path),
        after: aTarget ? aTarget.path : (after.origin ?? after.path),
      },
    })
    // one shape for every cached result
    result = {
      diffs: nested.diffs,
      contexts: nested.contexts,
      merged: nested.merged,
      rootMergeMeta: nested.rootMergeMeta,
      bPath: before.path,
      aPath: after.path,
      direction: undefined,
      suppressedDiffs: session.suppressedDiffs.length > mark ? session.suppressedDiffs.slice(mark) : NONE,
      suppressedContexts: session.suppressedContexts.length > mark ? session.suppressedContexts.slice(mark) : NONE,
    }
  } finally {
    if (nominal) {
      session.nominalNesting--
    }
    if (sameDeclaration) {
      session.declarationOnly--
    }
    if (newPair) {
      session.refPairs.delete(pair)
    }
    if (bRef) {
      session.refStack.before.delete(bRef)
    }
    if (aRef) {
      session.refStack.after.delete(aRef)
    }
  }

  if (nominal) {
    session.nominalDiffs += result.diffs.length + result.suppressedDiffs.length
  }

  if (cacheKey) {
    if (result.diffs.length && isComponentsScope(scope)) {
      result.direction = componentDirection(ctx)
    }
    session.refResults.set(cacheKey, result)
    if (!result.diffs.length && !result.rootMergeMeta) {
      return { diffs: [], merged: mergedValue(ctx, after, after.value) }
    }
    // the first usage gets the cached merged value itself (nothing changes a merged subtree in place once it is
    // returned); a later usage of the same pair gets a deep copy of it
    return result
  }

  if (!result.diffs.length && !result.rootMergeMeta && aRefNode) {
    return { diffs: [], merged: mergedValue(ctx, after, after.value) }
  }
  return result
}

/**
 * Boolean schemas (`true`, `false`, including a `false` produced by an unsatisfiable allOf merge) are compared as one
 * change of the schema node: `false` forbids every value, `true` allows every value.
 */
export const booleanSchemaCompareResolver: CompareResolver = (ctx) => {
  const { before, after } = ctx
  if (typeof before.value !== "boolean" && typeof after.value !== "boolean") {
    return
  }
  if (before.value === after.value) {
    return { diffs: [], merged: after.value }
  }
  // `true` and a schema that accepts every value (`{}`, a type list naming every type, ...), `false` and an
  // unsatisfiable schema are the same schema written differently: one annotation (ISSUE-89, ISSUE-153, POLICY-28)
  const other = typeof before.value === "boolean" ? after.value : before.value
  const equivalent =
    (typeof before.value === "boolean"
      ? before.value
        ? acceptsEverything(after.value)
        : isUnsatisfiable(after.value)
      : after.value
        ? acceptsEverything(before.value)
        : isUnsatisfiable(before.value)) ||
    // a partition of every value or a contradiction that only the set-level rewrites prove (ISSUE-153)
    (hasSetLevelKeyword(other) && equivalentBySetRewrite(before.value, after.value))
  const scoped: CompareContext = {
    ...ctx,
    rules: { ...ctx.rules, $: equivalent ? allAnnotation : booleanSchemaClassifyRule, annotate: booleanSchemaChange },
  }
  const diff = diffFactory.replaced(before.path, before.value, after.value, scoped)
  return {
    diffs: [diff],
    merged: mergedValue(ctx, after, after.value),
    rootMergeMeta: convertDiffToMeta(diff),
    contexts: [scoped],
  } as CompareResult
}

/**
 * Two schemas written differently that accept the same values (ISSUE-153: `maxItems: 0` ≡ `items: false`,
 * `additionalProperties: false` ≡ `maxProperties: 0`, two unsatisfiable schemas, branches partitioning a type, De
 * Morgan, double negation, a type list as a negated type) are one annotation of the schema node. Only checked where a
 * keyword on either side has another spelling (`hasSetLevelKeyword`) or both sides are unsatisfiable, and only when
 * the keyword-level comparison would not see the two as equal already.
 */
export const setEquivalenceCompareResolver: CompareResolver = (ctx) => {
  const { before, after, session } = ctx
  const b = before.value
  const a = after.value
  if (!isPlainObject(b) || !isPlainObject(a) || isRefNode(b) || isRefNode(a)) {
    return
  }
  if (!hasSetLevelKeyword(b) && !hasSetLevelKeyword(a) && !(isUnsatisfiable(b) && isUnsatisfiable(a))) {
    return
  }
  // a declaration and its usages compare the same source pair: proven once per session
  const bSource = isPlainObject(before.source) ? before.source : undefined
  const aSource = isPlainObject(after.source) ? after.source : undefined
  let cache = session.caches.get(SET_EQUIVALENCE_CACHE_KEY) as WeakMap<object, WeakMap<object, boolean>> | undefined
  let known = bSource && aSource ? cache?.get(bSource)?.get(aSource) : undefined
  if (known === undefined) {
    known = equivalentBySetRewrite(b, a)
    if (bSource && aSource) {
      if (!cache) {
        cache = new WeakMap()
        session.caches.set(SET_EQUIVALENCE_CACHE_KEY, cache)
      }
      let byAfter = cache.get(bSource)
      if (!byAfter) {
        byAfter = new WeakMap()
        cache.set(bSource, byAfter)
      }
      byAfter.set(aSource, known)
    }
  }
  if (!known) {
    return
  }
  const scoped: CompareContext = { ...ctx, rules: { ...ctx.rules, $: allAnnotation, annotate: equivalentSchemaChange } }
  const diff = diffFactory.replaced(before.path, bSource ?? b, aSource ?? a, scoped)
  return {
    diffs: [diff],
    merged: mergedValue(ctx, after, a),
    rootMergeMeta: convertDiffToMeta(diff),
    contexts: [scoped],
  } as CompareResult
}

const SET_EQUIVALENCE_CACHE_KEY = "set-equivalence"

/** The schema node resolver: boolean schemas first, then equivalent rewrites, then `$ref` resolution. */
export const schemaCompareResolver: CompareResolver = (ctx) =>
  booleanSchemaCompareResolver(ctx) ?? setEquivalenceCompareResolver(ctx) ?? refsCompareResolver(ctx)

/** Kept for compatibility: the resolver no longer holds state, the cache lives in the compare session. */
export const createRefsCompareResolver = (_cache?: JsonSchemaCompareCache): CompareResolver => refsCompareResolver

/** Compares a node as an opaque value: structurally equal values yield no diff, anything else one replace diff. */
export const valueCompareResolver: CompareResolver = (ctx) => {
  const { before, after } = ctx
  if (deepEqual(before.value, after.value)) {
    return { diffs: [], merged: after.value }
  }
  const diff = diffFactory.replaced(before.path, before.value, after.value, ctx)
  return {
    diffs: [diff],
    merged: after.value,
    rootMergeMeta: convertDiffToMeta(diff),
    contexts: [ctx],
  } as CompareResult
}
