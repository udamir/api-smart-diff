import { type JsonPath, syncClone } from "json-crawl"

import type {
  ClassifyRule,
  ClassifyRuleTransformer,
  ClassifyTuple,
  ClassifyTuple6,
  CompareContext,
  CompareExtensionRules,
  CompareRule,
  CompareRules,
  CompareRulesFunc,
  CompareRulesTransformer,
  CompareScope,
  DiffType,
  DiffTypeClassifier,
  ScopeContext,
} from "../types"
import { isFunc, isObject, isString } from "../utils"
import { allUnclassified, breaking, invertedScopes, nonBreaking } from "./constants"

/**
 * Whether a rule key is a prefix rule (json-crawl 1.x syntax): `"/<prefix>*"` with a non-empty prefix matches every
 * string key that starts with `<prefix>`; `"/*"` and `"/**"` keep their wildcard meaning and only a trailing `*` is
 * special (`"/a*b*"` matches keys starting with `a*b`, `"/*-id"` is the exact key `*-id`).
 */
export const isPrefixRuleKey = (key: string): boolean =>
  key.length > 2 &&
  key.charCodeAt(key.length - 1) === 42 /* "*" */ &&
  key.charCodeAt(0) === 47 /* "/" */ &&
  key !== "/**"

/**
 * Applies `tranformer` to every rule node of a rule tree (nested, function, `/**` and prefix `/<prefix>*` rules
 * included).
 * Kept for custom-rule authors; the built-in rule sets express direction through scopes instead.
 */
export const transformCompareRules = (rules: CompareRules, tranformer: CompareRulesTransformer): CompareRules => {
  return syncClone(rules, ({ value, key, path }) => {
    // only rule nodes (keys starting with "/", prefix rules included) and the root are transformed; arrays
    // (transforms, tuples) are kept
    if (path.length && (!isString(key) || !key.startsWith("/"))) {
      return
    }
    if (typeof value === "function") {
      return { value: (...args: unknown[]) => transformCompareRules(value(...args), tranformer) }
    }
    if (!Array.isArray(value) && isObject(value)) {
      return { value: tranformer(value as CompareRules) }
    }
  }) as CompareRules
}

export const reverseClassifyRuleTransformer: CompareRulesTransformer = (value) => {
  // reverse classify rules
  if ("$" in value && Array.isArray(value.$)) {
    return { ...value, $: reverseClassifyRule(value.$) }
  }

  return value
}

const reverseDiffType = (diffType: DiffType | DiffTypeClassifier): DiffType | DiffTypeClassifier => {
  if (typeof diffType === "function") {
    return ((ctx: CompareContext) => reverseDiffType(diffType(ctx))) as DiffTypeClassifier
  }
  switch (diffType) {
    case breaking:
      return nonBreaking
    case nonBreaking:
      return breaking
    // `risky`, `annotation`, `deprecated` and `unclassified` keep their meaning in both directions
    default:
      return diffType
  }
}

export const reverseClassifyRule = (rule: ClassifyRule): ClassifyRule => {
  if (!Array.isArray(rule)) {
    return rule
  }
  const [add, remove, replace, r_add, r_remove, r_replace] = rule
  return [r_add ?? reverseDiffType(add), r_remove ?? reverseDiffType(remove), r_replace ?? reverseDiffType(replace)]
}

export const transformClassifyRule = (rule: ClassifyRule, transformer: ClassifyRuleTransformer): ClassifyRule => {
  if (!Array.isArray(rule)) {
    const result: Record<string, ClassifyTuple | undefined> = {}
    for (const scope of Object.keys(rule)) {
      const tuple = rule[scope]
      result[scope] = tuple ? (transformClassifyRule(tuple, transformer) as ClassifyTuple) : undefined
    }
    return result as ClassifyRule
  }
  // every slot is wrapped, the reversed slots of a 6-tuple included
  const actions = ["add", "remove", "replace"] as const
  return rule.map((entry, i) => (ctx: CompareContext) => {
    return transformer(isFunc(entry) ? entry(ctx) : entry, ctx, actions[i % 3])
  }) as unknown as ClassifyRule
}

export const isInvertedScope = (scope: CompareScope): boolean => invertedScopes.has(scope)

// resolved classifier tuples per rule object and scope
const resolvedClassifiers = new WeakMap<object, Map<CompareScope, ClassifyTuple>>()

/**
 * Resolves the classifier tuple of a rule for a scope: a 3-tuple is inverted in response-like scopes, a 6-tuple
 * supplies its own inverted slots, the object form is looked up by scope name (then `default`).
 */
export const resolveClassifyTuple = (rule: ClassifyRule | undefined, scope: CompareScope): ClassifyTuple => {
  if (!rule || typeof rule !== "object") {
    return allUnclassified as ClassifyTuple
  }

  let byScope = resolvedClassifiers.get(rule)
  if (!byScope) {
    byScope = new Map()
    resolvedClassifiers.set(rule, byScope)
  }
  const cached = byScope.get(scope)
  if (cached) {
    return cached
  }

  let tuple: ClassifyTuple
  if (Array.isArray(rule)) {
    const inverted = isInvertedScope(scope)
    if (rule.length > 3) {
      const [add, remove, replace, r_add, r_remove, r_replace] = rule as ClassifyTuple6
      tuple = inverted ? [r_add, r_remove, r_replace] : [add, remove, replace]
    } else {
      tuple = inverted ? (reverseClassifyRule(rule) as ClassifyTuple) : (rule as ClassifyTuple)
    }
  } else {
    tuple = rule[scope] ?? rule.default ?? (allUnclassified as ClassifyTuple)
  }

  byScope.set(scope, tuple)
  return tuple
}

/** Scope of a child node: the rule may open a fixed scope or derive one from the parent scope. */
export const resolveScope = (
  rules: CompareRule | undefined,
  parent: CompareScope,
  ctx: Omit<ScopeContext, "scope">,
) => {
  // read through the rule view: a named access on rule objects of hundreds of shapes is megamorphic (ISSUE-330)
  const scope = rules ? ruleView(rules).scope : undefined
  if (scope === undefined) {
    return parent
  }
  // a literal of one shape instead of a spread (ISSUE-330)
  return typeof scope === "function" ? scope({ key: ctx.key, path: ctx.path, value: ctx.value, scope: parent }) : scope
}

/**
 * Rule of the longest prefix rule (`"/<prefix>*"`) of `rules` matching `key` (unresolved: a rule object or a function
 * rule), or `undefined` when none matches; array indexes never match (json-crawl 1.x `matchPrefixRule`).
 */
export const matchPrefixRule = (rules: CompareRules, key: string | number): RuleEntry =>
  typeof key === "string" ? matchViewPrefix(ruleView(rules), key) : undefined

const matchViewPrefix = (view: RuleView, key: string): RuleEntry => {
  const prefixes = view.prefixes
  if (prefixes === undefined || !view.prefixFirst?.has(key.charCodeAt(0))) {
    return
  }
  for (let i = 0; i < prefixes.length; i++) {
    if (key.startsWith(prefixes[i])) {
      return view.prefixRules?.get(prefixes[i])
    }
  }
}

/**
 * Merges rule-set fragments key-wise (exact `/<key>` and prefix `/<prefix>*` entries): a key present in one fragment
 * keeps its rule, a key present in several gets the rules merged field by field with the later fragment winning (a
 * custom `/x-*` entry overriding the built-in `$` / `annotate`). Every key must be a rule key (start with `/`); a
 * plain key such as `x-foo` (the former prefix-map form) is a `TypeError`.
 */
export const mergeExtensionRules = (...fragments: Array<CompareExtensionRules | undefined>): CompareExtensionRules => {
  const result: CompareExtensionRules = {}
  for (const fragment of fragments) {
    if (!fragment) {
      continue
    }
    if (!isObject(fragment) || Array.isArray(fragment)) {
      throw new TypeError("Invalid extension rules: expected an object mapping rule keys to rules")
    }
    for (const key of Object.keys(fragment)) {
      if (!key.startsWith("/") || key === "/*" || key === "/**") {
        throw new TypeError(
          `Invalid extension rule key "${key}": use an exact rule key such as "/${key.replace(/^\//, "")}" or a prefix rule key such as "/x-foo*"`,
        )
      }
      const base = result[key as `/${string}`]
      const rule = fragment[key as `/${string}`]
      result[key as `/${string}`] =
        base === undefined
          ? rule
          : typeof base === "function" || typeof rule === "function"
            ? (ctx: { key: string | number; path: JsonPath; value: unknown }) => ({
                ...(typeof base === "function" ? base(ctx) : base),
                ...(typeof rule === "function" ? rule(ctx) : rule),
              })
            : { ...base, ...rule }
    }
  }
  return result
}

// cache entry of the combination shared by every key without an exact or prefix rule
const WILDCARD_KEY = Symbol("wildcard")
// class of the key of the last static resolution (see `resolveNodeRulesShared`)
let lastShareKey: unknown

type RulesContext = { key: string | number; path: JsonPath; value: unknown }
type RuleEntry = CompareRules | ((ctx: RulesContext) => CompareRules | undefined) | undefined

const callRule = (entry: RuleEntry, key: string | number, path: JsonPath, value: unknown): CompareRules | undefined =>
  typeof entry === "function" ? entry({ key, path, value }) : entry

const STATIC_RULES = Symbol.for("api-smart-diff/static-rules")

/**
 * A lazily built rule set that does not depend on the node: the factory runs once, and the resolver treats the entry
 * as static, so the rules of its descendants are memoized like those of a plain rule object (ISSUE-58). Used for the
 * recursive (self-referencing) parts of the built-in rule trees; any function rule written without this wrapper is
 * still evaluated per node.
 */
export const staticRules = (factory: () => CompareRules): CompareRulesFunc => {
  let cached: CompareRules | undefined
  const entry = (() => {
    if (cached === undefined) {
      cached = factory()
    }
    return cached
  }) as CompareRulesFunc & { [STATIC_RULES]?: true }
  entry[STATIC_RULES] = true
  return entry
}

const isDynamicEntry = (entry: unknown): boolean =>
  typeof entry === "function" && !(entry as { [STATIC_RULES]?: true })[STATIC_RULES]

// `/<key>` strings, built once per key: a freshly concatenated string has to be hashed and looked up in the string
// table on every property access, a reused one is already internalized (ISSUE-191)
const ruleKeys = new Map<string | number, string>()
const RULE_KEYS_LIMIT = 10000

const ruleKeyOf = (key: string | number): string => {
  let ruleKey = ruleKeys.get(key)
  if (ruleKey === undefined) {
    ruleKey = `/${key}`
    if (ruleKeys.size >= RULE_KEYS_LIMIT) {
      ruleKeys.clear()
    }
    ruleKeys.set(key, ruleKey)
  }
  return ruleKey
}

/**
 * A rule object read once into a record of one fixed shape: its child entries in a map, its own fields in properties.
 * Rule objects are literals of hundreds of different shapes, so reading their properties directly is a megamorphic
 * access, and V8 clears the cache behind those accesses on every full garbage collection; reading the record (one
 * shape) stays fast (ISSUE-191). Rule objects are treated as immutable once used, as by the static rule cache.
 */
export interface RuleView {
  // every `/<key>` entry (including `/*` and `/**`, which a child literally named `*` / `**` matches exactly)
  exact: Map<string, RuleEntry>
  star: RuleEntry
  any: RuleEntry
  // prefixes of the `/<prefix>*` entries, longest first, their rules, and the first characters of the prefixes (a key
  // whose first character starts no prefix is rejected without a loop); undefined without prefix rules
  prefixes: string[] | undefined
  prefixRules: Map<string, RuleEntry> | undefined
  prefixFirst: Set<number> | undefined
  // `/*` or `/**` is a function rule (evaluated per node)
  dynamicWildcards: boolean
  // memoized static child rules (see `resolveNodeRules`)
  children: Map<unknown, CompareRules | undefined> | undefined
  skip: CompareRule["skip"]
  transform: CompareRule["transform"]
  compare: CompareRule["compare"]
  mapping: CompareRule["mapping"]
  scope: CompareRule["scope"]
  classify: CompareRule["$"]
  annotate: CompareRule["annotate"]
  inheritUsage: CompareRule["inheritUsage"]
  kind: CompareRule["kind"]
}

const ruleViews = new WeakMap<object, RuleView>()
// the last two rule objects looked up: a node's rules are read several times in a row (its context, the walk, its
// container), so most lookups are answered without the weak map (ISSUE-330)
let lastRules: object | undefined
let lastView: RuleView | undefined
let prevRules: object | undefined
let prevView: RuleView | undefined

export const ruleView = (rules: CompareRules): RuleView => {
  if (rules === lastRules) {
    return lastView as RuleView
  }
  if (rules === prevRules) {
    const view = prevView as RuleView
    prevRules = lastRules
    prevView = lastView
    lastRules = rules
    lastView = view
    return view
  }
  let view = ruleViews.get(rules)
  if (!view) {
    const record = rules as Record<string, unknown>
    const exact = new Map<string, RuleEntry>()
    // `for...in`: entries inherited from a prototype rule object count, as with a direct property access (run once per
    // rule object, so the keyed load below does not matter for speed)
    let prefixRules: Map<string, RuleEntry> | undefined
    for (const key in record) {
      if (key.charCodeAt(0) !== 47 /* "/" */) {
        continue
      }
      if (isPrefixRuleKey(key)) {
        prefixRules ??= new Map()
        prefixRules.set(key.slice(1, -1), record[key] as RuleEntry)
      } else {
        exact.set(key, record[key] as RuleEntry)
      }
    }
    // equal-length prefixes cannot both match one key, so only the length order matters
    const prefixes = prefixRules ? [...prefixRules.keys()].sort((a, b) => b.length - a.length) : undefined
    const star = record["/*"] as RuleEntry
    const any = record["/**"] as RuleEntry
    const rule = rules as CompareRule
    view = {
      exact,
      star,
      any,
      prefixes,
      prefixRules,
      prefixFirst: prefixes ? new Set(prefixes.map((prefix) => prefix.charCodeAt(0))) : undefined,
      dynamicWildcards: isDynamicEntry(star) || isDynamicEntry(any),
      children: undefined,
      skip: rule.skip,
      transform: rule.transform,
      compare: rule.compare,
      mapping: rule.mapping,
      scope: rule.scope,
      classify: rule.$,
      annotate: rule.annotate,
      inheritUsage: rule.inheritUsage,
      kind: rule.kind,
    }
    ruleViews.set(rules, view)
  }
  prevRules = lastRules
  prevView = lastView
  lastRules = rules
  lastView = view
  return view
}

// merged rule objects per (lower, higher) pair: function rules return the same (cached) objects for many nodes, so a
// combination involving one is merged once instead of per node; rule objects are immutable once used, and a fresh
// object from a function rule only gets an entry that is collected with it
const mergedRules = new WeakMap<object, WeakMap<object, CompareRules>>()

const mergeRuleObjects = (lower: CompareRules, higher: CompareRules): CompareRules => {
  let byHigher = mergedRules.get(lower)
  if (!byHigher) {
    byHigher = new WeakMap()
    mergedRules.set(lower, byHigher)
  }
  let merged = byHigher.get(higher)
  if (!merged) {
    merged = { ...lower, ...higher } as CompareRules
    byHigher.set(higher, merged)
  }
  return merged
}

// `{ "/**": any, ...anyRules }` per (`/**` entry, its resolved rules)
const anyBases = new WeakMap<object, WeakMap<object, CompareRules>>()
const NO_ANY_RULES = {}

const anyBase = (any: CompareRules, anyRules: CompareRules | undefined): CompareRules => {
  let byRules = anyBases.get(any)
  if (!byRules) {
    byRules = new WeakMap()
    anyBases.set(any, byRules)
  }
  const ruleKey = anyRules ?? NO_ANY_RULES
  let base = byRules.get(ruleKey)
  if (!base) {
    base = { "/**": any, ...anyRules } as CompareRules
    byRules.set(ruleKey, base)
  }
  return base
}

/**
 * Rules of a child node with json-crawl 1.x semantics: exact key `/<key>` > longest matching prefix rule
 * `/<prefix>*` > `/*` > `/**`, merged with higher-priority fields overriding lower ones, and `/**` kept for the
 * descendants. Prefix rules apply to string keys only (array indexes never match). Rule objects are returned as they are when nothing has to be merged,
 * and fully static combinations (no function rule) are memoized per parent rules object and
 * key.
 */
export const resolveNodeRules = (
  rules: CompareRules | undefined,
  key: string | number,
  path: JsonPath,
  value: unknown,
): CompareRules | undefined => {
  if (!rules) {
    return
  }
  const view = ruleView(rules)
  const exact = view.exact.get(ruleKeyOf(key))
  const { star, any } = view
  // the matched prefix rule, not the key itself, selects the cached combination of a key without an exact rule
  const prefix = typeof key === "string" ? matchViewPrefix(view, key) : undefined
  const dynamic = isDynamicEntry(exact) || view.dynamicWildcards || isDynamicEntry(prefix)

  // the memoized combination: per key for a key with an exact rule, otherwise per matched prefix rule (or one entry
  // for every other key), so the cache does not grow with the property names of the documents compared
  let byKey: Map<unknown, CompareRules | undefined> | undefined
  const cacheKey: unknown = exact !== undefined ? key : prefix !== undefined ? prefix : WILDCARD_KEY
  if (!dynamic) {
    byKey = view.children
    if (byKey?.has(cacheKey)) {
      lastShareKey = cacheKey
      return byKey.get(cacheKey)
    }
  }

  let resolved: CompareRules | undefined
  if (exact !== undefined || prefix !== undefined || star !== undefined || any !== undefined) {
    let node = exact !== undefined ? callRule(exact, key, path, value) : undefined
    const prefixRules = prefix !== undefined ? callRule(prefix, key, path, value) : undefined
    const starRules = callRule(star, key, path, value)
    if (prefixRules) {
      node = node ? mergeRuleObjects(prefixRules, node) : prefixRules
    }
    if (starRules) {
      node = node ? mergeRuleObjects(starRules, node) : starRules
    }
    if (any !== undefined) {
      const anyRules = callRule(any, key, path, value)
      const base = anyBase(any as CompareRules, anyRules)
      resolved = node ? mergeRuleObjects(base, node) : base
    } else {
      resolved = node ?? (exact !== undefined ? ({} as CompareRules) : undefined)
    }
  }

  if (!dynamic) {
    if (!byKey) {
      byKey = new Map()
      view.children = byKey
    }
    lastShareKey = exact !== undefined ? key : prefix !== undefined ? prefix : WILDCARD_KEY
    byKey.set(lastShareKey, resolved)
  } else {
    lastShareKey = undefined
  }
  return resolved
}

/**
 * The memoized `resolveNodeRules(rules, key, ...)` of a static combination, without a path or value, or `null` when
 * the combination is not memoized (function rules, or not resolved yet); the engine's shortcut for children that need
 * no context of their own (ISSUE-330).
 */
export const cachedNodeRules = (
  rules: CompareRules | undefined,
  key: string | number,
): CompareRules | undefined | null => (rules ? cachedChildRules(ruleView(rules), key) : undefined)

/** `cachedNodeRules` with the view of the parent rules (`ruleView`). */
export const cachedChildRules = (view: RuleView, key: string | number): CompareRules | undefined | null => {
  const exact = view.exact.get(ruleKeyOf(key))
  const prefix = typeof key === "string" ? matchViewPrefix(view, key) : undefined
  if (isDynamicEntry(exact) || view.dynamicWildcards || isDynamicEntry(prefix)) {
    return null
  }
  const cacheKey: unknown = exact !== undefined ? key : prefix !== undefined ? prefix : WILDCARD_KEY
  const byKey = view.children
  return byKey?.has(cacheKey) ? byKey.get(cacheKey) : null
}

/**
 * `resolveNodeRules` plus the class of the key: siblings with the same class get the same (static) rules, so
 * per-path results derived from the rules alone can be shared between them; `undefined` when the rules depend on the
 * node (function rules).
 */
export const resolveNodeRulesShared = (
  rules: CompareRules | undefined,
  key: string | number,
  path: JsonPath,
  value: unknown,
): { rules: CompareRules | undefined; shareKey: unknown } => {
  lastShareKey = undefined
  const resolved = resolveNodeRules(rules, key, path, value)
  return { rules: resolved, shareKey: rules ? lastShareKey : WILDCARD_KEY }
}
