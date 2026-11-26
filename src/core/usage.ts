import type { JsonPath } from "json-crawl"
import { parseRefCached as parseRef } from "./ref"

import type {
  CompareContext,
  CompareRule,
  CompareRules,
  CompareScope,
  CompareSession,
  NodeContext,
  UsageIndex,
} from "../types"
import { getKeyValue, isObject } from "../utils"
import { ownValue } from "../own"
import { CompareScopes, isComponentsScope, oppositeScopes } from "./constants"
import { resolveNodeRules, resolveNodeRulesShared, resolveScope, ruleView } from "./rules"

const USAGE_CACHE_KEY = "usage-index"

const escapeStep = (step: string | number): string => {
  const text = String(step)
  return text.indexOf("~") < 0 && text.indexOf("/") < 0 ? text : text.replace(/~/g, "~0").replace(/\//g, "~1")
}

const pointerOf = (path: JsonPath): string => {
  let pointer = "#"
  for (let i = 0; i < path.length; i++) {
    pointer += `/${escapeStep(path[i])}`
  }
  return pointer
}

interface RefUsage {
  target: string
  scope: CompareScope
  // pointer of the component the reference sits in (when referenced from inside a component)
  from?: string
  // the component the reference sits in also inherits the usage scopes of the target (`CompareRule.inheritUsage`)
  inherit?: boolean
}

// a component-to-component reference; `negated` when it sits in a subtree read in the opposite direction (`not`)
interface Referrer {
  from: string
  negated: boolean
}

const flip = (scope: CompareScope): CompareScope => oppositeScopes[scope] ?? scope

interface PathInfo {
  rules: CompareRules | undefined
  scope: CompareScope
  // pointer of the enclosing component
  component: string | undefined
  children?: Map<unknown, PathInfo>
  // the entry stands for several siblings (or lies below such an entry): node-dependent results are not cached in it
  shared?: boolean
}

// deeper nodes (a cyclic object graph) are not scanned
const MAX_SCAN_DEPTH = 1024

/** A `$ref` string of a document: the path of the object that holds it, the reference and that object. */
export interface DocumentReference {
  path: JsonPath
  ref: string
  holder: object
}

/**
 * Every `$ref` string of a document in walk order (an object reached on several paths is reported on each), and
 * whether the walk was complete (no subtree cut off by the depth limit, which ends cyclic object graphs).
 */
export interface DocumentReferences {
  refs: DocumentReference[]
  complete: boolean
}

// every `$ref` string below `value` with its path (`path` is the path of `value`, extended in place); `false` when a
// subtree was cut off by the depth limit
const scanRefs = (
  value: Record<string | number, unknown>,
  path: (string | number)[],
  depth: number,
  found: DocumentReference[],
): boolean => {
  const ref = ownValue(value, "$ref")
  if (typeof ref === "string") {
    found.push({ path: path.slice(), ref, holder: value })
  }
  if (depth > MAX_SCAN_DEPTH) {
    return false
  }
  let complete = true
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const child = value[i]
      if (typeof child === "object" && child !== null) {
        path.push(i)
        complete = scanRefs(child as Record<string | number, unknown>, path, depth + 1, found) && complete
        path.pop()
      }
    }
    return complete
  }
  const keys = Object.keys(value)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const child = value[key]
    if (typeof child === "object" && child !== null) {
      path.push(key)
      complete = scanRefs(child as Record<string | number, unknown>, path, depth + 1, found) && complete
      path.pop()
    }
  }
  return complete
}

const REFERENCES_CACHE_KEY = "document-references"

/**
 * The `$ref` strings of a document, scanned once per session and document: shared by the usage index and the rename
 * detection (`localReferenceSitesOf`), which scanned each document again (ISSUE-330).
 */
export const documentReferences = (session: CompareSession, root: unknown): DocumentReferences => {
  let byRoot = session.caches.get(REFERENCES_CACHE_KEY) as Map<unknown, DocumentReferences> | undefined
  if (!byRoot) {
    byRoot = new Map()
    session.caches.set(REFERENCES_CACHE_KEY, byRoot)
  }
  let scan = byRoot.get(root)
  if (!scan) {
    const refs: DocumentReference[] = []
    const complete = isObject(root) ? scanRefs(root as Record<string | number, unknown>, [], 0, refs) : true
    scan = { refs, complete }
    byRoot.set(root, scan)
  }
  return scan
}

/**
 * Records every local `$ref` of one document together with the scope it sits in. The document is scanned without
 * rules first; the rule tree is then resolved only along the paths that lead to a reference (shared prefixes once),
 * which gives the same scopes as walking every node with the rules (ISSUE-58).
 */
const collectRefs = (session: CompareSession, root: unknown, rules: CompareRules | undefined, out: RefUsage[]) => {
  if (!isObject(root)) {
    return
  }
  const found = documentReferences(session, root).refs
  const implied = (rules as CompareRule | undefined)?.impliedReferences
  const references: { path: JsonPath; ref: string }[] = implied ? [...found, ...implied(root)] : found

  const rootInfo: PathInfo = { rules, scope: CompareScopes.root, component: undefined }
  for (let i = 0; i < references.length; i++) {
    const usage = references[i]
    const { filePath, normalized } = parseRef(usage.ref)
    if (filePath) {
      continue
    }
    const info = pathInfo(rootInfo, root, usage.path)
    out.push({
      target: normalized,
      scope: info.scope,
      from: info.component,
      inherit: !!info.rules && !!ruleView(info.rules).inheritUsage,
    })
  }
}

// the rules, scope and enclosing component of the node at `path`, resolved along the path (shared prefixes once); a
// function of its own, so the engine optimizes it after a few references (it runs once per reference)
const pathInfo = (rootInfo: PathInfo, root: unknown, path: JsonPath): PathInfo => {
  let info = rootInfo
  let value: unknown = root
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    value = (value as Record<string | number, unknown>)[key]
    let child = info.children?.get(key)
    if (!child) {
      const childPath = path.slice(0, i + 1)
      const { rules: childRules, shareKey } = resolveNodeRulesShared(info.rules, key, childPath, value)
      const byClass = shareKey !== undefined && shareKey !== key
      // siblings resolved to the same static rules (e.g. every path of `paths`) share one entry
      const shared = byClass ? info.children?.get(shareKey) : undefined
      if (shared) {
        child = shared
      } else {
        const childScope = resolveScope(childRules, info.scope, { key, path: childPath, value })
        // the node that opens the components scope is the component itself
        const opens = isComponentsScope(childScope) && !isComponentsScope(info.scope)
        const component = opens ? pointerOf(childPath) : info.component
        const nodeDependent =
          shareKey === undefined || (!!childRules && typeof ruleView(childRules).scope === "function")
        child = { rules: childRules, scope: childScope, component }
        if (nodeDependent && info.shared) {
          // depends on this node, below an entry shared by siblings: not cached
          info = child
          continue
        }
        if (!info.children) {
          info.children = new Map()
        }
        if (byClass && !opens && !nodeDependent) {
          child.shared = true
          info.children.set(shareKey, child)
        } else if (info.shared) {
          child.shared = true
        }
      }
      if (!info.children) {
        info.children = new Map()
      }
      info.children.set(key, child)
    }
    info = child
  }
  return info
}

const buildUsageIndex = (session: CompareSession, roots: unknown[], rules: CompareRules | undefined): UsageIndex => {
  const refs: RefUsage[] = []
  for (const root of roots) {
    collectRefs(session, root, rules, refs)
  }

  // direct usage scopes and component-to-component edges
  const direct = new Map<string, Set<CompareScope>>()
  const referrers = new Map<string, Referrer[]>()
  // edges seen, keyed `target|negated|from`: a component referenced from many components (an interface implemented by
  // hundreds of types) was checked against its whole referrer list for every reference
  const edges = new Set<string>()
  const addReferrer = (target: string, from: string, negated: boolean) => {
    const edge = `${target}|${negated ? 1 : 0}|${from}`
    if (edges.has(edge)) {
      return
    }
    edges.add(edge)
    let list = referrers.get(target)
    if (!list) {
      list = []
      referrers.set(target, list)
    }
    list.push({ from, negated })
  }
  for (const { target, scope, from, inherit } of refs) {
    if (from !== undefined && isComponentsScope(scope)) {
      const negated = scope === CompareScopes.negatedComponents
      addReferrer(target, from, negated)
      // the referencing component is used wherever the target is (ISSUE-118: interface implementors)
      if (inherit && target !== from) {
        addReferrer(from, target, negated)
      }
    } else {
      let set = direct.get(target)
      if (!set) {
        set = new Set()
        direct.set(target, set)
      }
      set.add(scope)
    }
  }

  // The usage scopes of a component are the direct scopes of every component it reaches through its referrers, each
  // flipped when the way there crosses an odd number of negations. A walk per queried component cost O(reachable
  // components) each, so the components of a long reference chain cost O(chain²) together (ISSUE-413); the
  // reachable sets are resolved once per strongly connected component of the referrer graph instead (Tarjan, on an
  // explicit stack: a recursive walk exceeded the call stack on a chain of thousands of components, ISSUE-410), each
  // from the sets of the components it refers to. A set is kept as the raw direct scopes reached on an even and on an
  // odd number of negations: `oppositeScopes` is not an involution (root → response → request), so a flipped set is
  // never flipped again.
  interface Reach {
    even: Set<CompareScope>
    odd: Set<CompareScope>
  }
  const reach = new Map<string, Reach>()
  const order = new Map<string, number>()
  const low = new Map<string, number>()
  let counter = 0

  // every node of a strongly connected component of the referrer graph is resolved together
  const resolveComponent = (members: string[]) => {
    const inside = new Set(members)
    // parity of the way from the first member to each member; a member reached on both parities (an odd cycle of
    // negations) makes every member reach everything on both parities
    const parity = new Map<string, boolean>([[members[0], false]])
    let mixed = false
    const queue = [members[0]]
    while (queue.length) {
      const p = queue.pop()!
      const odd = parity.get(p)!
      for (const referrer of referrers.get(p) ?? []) {
        if (!inside.has(referrer.from)) {
          continue
        }
        const next = odd !== referrer.negated
        const known = parity.get(referrer.from)
        if (known === undefined) {
          parity.set(referrer.from, next)
          queue.push(referrer.from)
        } else if (known !== next) {
          mixed = true
        }
      }
    }
    const base: Reach = { even: new Set(), odd: new Set() }
    for (const p of members) {
      const odd = parity.get(p)!
      for (const scope of direct.get(p) ?? []) {
        ;(odd ? base.odd : base.even).add(scope)
      }
      for (const referrer of referrers.get(p) ?? []) {
        if (inside.has(referrer.from)) {
          continue
        }
        const target = reach.get(referrer.from)!
        const swap = odd !== referrer.negated
        for (const scope of target.even) {
          ;(swap ? base.odd : base.even).add(scope)
        }
        for (const scope of target.odd) {
          ;(swap ? base.even : base.odd).add(scope)
        }
      }
    }
    if (mixed) {
      for (const scope of base.odd) {
        base.even.add(scope)
      }
      base.odd = base.even
    }
    const swapped: Reach = { even: base.odd, odd: base.even }
    for (const p of members) {
      reach.set(p, parity.get(p) && !mixed ? swapped : base)
    }
  }

  // Tarjan's algorithm from `start` over the components not resolved yet
  const resolveFrom = (start: string) => {
    const stack: string[] = []
    const onStack = new Set<string>()
    const work: { p: string; list: Referrer[]; i: number }[] = []
    const open = (p: string) => {
      order.set(p, counter)
      low.set(p, counter)
      counter++
      stack.push(p)
      onStack.add(p)
      work.push({ p, list: referrers.get(p) ?? [], i: 0 })
    }
    open(start)
    while (work.length) {
      const top = work[work.length - 1]
      if (top.i < top.list.length) {
        const next = top.list[top.i++].from
        if (reach.has(next)) {
          continue
        }
        if (!order.has(next)) {
          open(next)
        } else if (onStack.has(next)) {
          low.set(top.p, Math.min(low.get(top.p)!, order.get(next)!))
        }
        continue
      }
      work.pop()
      if (work.length) {
        const parent = work[work.length - 1].p
        low.set(parent, Math.min(low.get(parent)!, low.get(top.p)!))
      }
      if (low.get(top.p) === order.get(top.p)) {
        const members: string[] = []
        let p: string
        do {
          p = stack.pop()!
          onStack.delete(p)
          members.push(p)
        } while (p !== top.p)
        resolveComponent(members)
      }
    }
  }

  const resolved = new Map<string, Set<CompareScope>>()

  const usage = (pointer: string): Set<CompareScope> => {
    const cached = resolved.get(pointer)
    if (cached) {
      return cached
    }
    if (!reach.has(pointer)) {
      resolveFrom(pointer)
    }
    const { even, odd } = reach.get(pointer)!
    const result = new Set(even)
    for (const scope of odd) {
      result.add(flip(scope))
    }
    resolved.set(pointer, result)
    return result
  }

  return { usage }
}

export const getUsageIndex = (
  session: CompareSession,
  roots: unknown[],
  rules: CompareRules | undefined,
): UsageIndex => {
  let index = session.caches.get(USAGE_CACHE_KEY) as UsageIndex | undefined
  if (!index) {
    index = buildUsageIndex(session, roots, rules)
    session.caches.set(USAGE_CACHE_KEY, index)
  }
  return index
}

/** The node at which the `components` scope was opened for this context (the component root). */
export const findComponentRoot = (ctx: CompareContext): NodeContext | undefined => {
  let node: NodeContext | undefined = ctx.before.value !== undefined ? ctx.before : ctx.after
  let result: NodeContext | undefined
  while (node && isComponentsScope(node.scope ?? ctx.scope)) {
    result = node
    node = node.up
  }
  return result
}

/**
 * Scopes referencing the component the node belongs to (both documents, transitively through components); inside a
 * negated subtree of the component (`components-negated`) the opposite scopes.
 */
export const componentUsageScopes = (ctx: CompareContext): Set<CompareScope> => {
  const root = findComponentRoot(ctx)
  if (!root) {
    return new Set()
  }
  // the component root context is shared by every node of the component: its usage scopes are looked up once
  let byRoot = ctx.session.caches.get(ROOT_USAGE_CACHE_KEY) as WeakMap<NodeContext, Set<CompareScope>> | undefined
  if (!byRoot) {
    byRoot = new WeakMap()
    ctx.session.caches.set(ROOT_USAGE_CACHE_KEY, byRoot)
  }
  let scopes = byRoot.get(root)
  if (!scopes) {
    const index = getUsageIndex(ctx.session, [ctx.before.root, ctx.after.root], ctx.options.rules)
    scopes = index.usage(pointerOf(root.origin ?? root.path))
    if (!scopes.size) {
      scopes = unreferencedScopes(ctx, root) ?? scopes
    }
    byRoot.set(root, scopes)
  }
  return ctx.scope === CompareScopes.negatedComponents ? new Set([...scopes].map(flip)) : scopes
}

// the `unreferencedScopes` of the rule of a component root, found by walking the rule tree from the document root
const unreferencedScopes = (ctx: CompareContext, root: NodeContext): Set<CompareScope> | undefined => {
  const path = root.origin ?? root.path
  const doc = getKeyValue(ctx.before.root, ...path) !== undefined ? ctx.before.root : ctx.after.root
  let rules: CompareRules | undefined = ctx.options.rules
  let value: unknown = doc
  const current: JsonPath = []
  for (const key of path) {
    value = isObject(value) ? (value as Record<string | number, unknown>)[key] : undefined
    current.push(key)
    rules = resolveNodeRules(rules, key, [...current], value)
    if (!rules) {
      return
    }
  }
  const scopes = (rules as { unreferencedScopes?: CompareScope[] }).unreferencedScopes
  return scopes?.length ? new Set(scopes) : undefined
}

const ROOT_USAGE_CACHE_KEY = "component-root-usage"
const DECLARATION_CACHE_KEY = "declaration-paths"
const DECLARATION_PATH_CACHE_KEY = "declaration-path-arrays"

/**
 * Whether a local `$ref` target is compared as a declaration of its own: it lies in the document's `components`
 * section and the rule tree, walked from the document root along the target path, has rules for it. A change there is
 * reported at the declaration, so a reference to it from inside another component is not expanded again (ISSUE-53).
 */
export const isDeclarationTarget = (ctx: CompareContext, root: unknown, path: JsonPath): boolean => {
  if (path.length < 2 || path[0] !== "components") {
    return false
  }
  // the path arrays of resolved references are reused for every lookup of the reference: answered by identity first
  let byPath = ctx.session.caches.get(DECLARATION_PATH_CACHE_KEY) as WeakMap<JsonPath, [unknown, boolean]> | undefined
  if (!byPath) {
    byPath = new WeakMap()
    ctx.session.caches.set(DECLARATION_PATH_CACHE_KEY, byPath)
  }
  const known = byPath.get(path)
  if (known && known[0] === root) {
    return known[1]
  }
  const result = isDeclarationPath(ctx, root, path)
  byPath.set(path, [root, result])
  return result
}

const isDeclarationPath = (ctx: CompareContext, root: unknown, path: JsonPath): boolean => {
  let cache = ctx.session.caches.get(DECLARATION_CACHE_KEY) as Map<unknown, Map<string, boolean>> | undefined
  if (!cache) {
    cache = new Map()
    ctx.session.caches.set(DECLARATION_CACHE_KEY, cache)
  }
  let byRoot = cache.get(root)
  if (!byRoot) {
    byRoot = new Map()
    cache.set(root, byRoot)
  }
  const pointer = pointerOf(path)
  const cached = byRoot.get(pointer)
  if (cached !== undefined) {
    return cached
  }
  let rules: CompareRules | undefined = ctx.options.rules
  let value: unknown = root
  const current: JsonPath = []
  for (const key of path) {
    value = isObject(value) ? (value as Record<string | number, unknown>)[key] : undefined
    current.push(key)
    rules = resolveNodeRules(rules, key, [...current], value)
    if (!rules) {
      break
    }
  }
  const result = rules !== undefined
  byRoot.set(pointer, result)
  return result
}
