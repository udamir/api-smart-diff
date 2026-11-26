import { isRefNode } from "../own"

import {
  annotation,
  breaking,
  nonBreaking,
  unclassified,
  createUniqueItemsMappingResolver,
  deepEqual,
  getUsageIndex,
  resolveClassifyTuple,
  type ReferenceSite,
  type RenameableMap,
  documentEntryRenames,
  pointerOfPath,
  renamesIn,
  findRenames,
  isRenamedEntry,
  localReferenceSitesOf,
  renamedReference,
} from "../core"
import { nonDirectional } from "../jsonSchema"
import type {
  ClassifyRule,
  ClassifyTuple,
  CompareContext,
  CompareRules,
  CompareSide,
  DiffType,
  DiffTypeClassifier,
  NodeContext,
  RuleDiffType,
} from "../types"
import { isNotEmptyArray, isObject, isString } from "../utils"

// AsyncAPI structural rules keep their literal meaning in both operation directions
export const fixed = (tuple: ClassifyTuple): ClassifyRule => nonDirectional(tuple)

const evaluate = (entry: RuleDiffType | undefined, ctx: CompareContext): DiffType =>
  entry === undefined ? unclassified : typeof entry === "function" ? entry(ctx) : entry

/** A rule whose add / remove / replace slots are `base` unless `override` returns a class for the change. */
export const overrideRule = (
  base: ClassifyRule,
  override: (ctx: CompareContext, action: 0 | 1 | 2) => DiffType | undefined,
): ClassifyRule => {
  const slot =
    (action: 0 | 1 | 2): DiffTypeClassifier =>
    (ctx) =>
      override(ctx, action) ?? evaluate(resolveClassifyTuple(base, ctx.scope)[action], ctx)
  return { default: [slot(0), slot(1), slot(2)] }
}

const majorVersion = (root: unknown) => (isObject(root) ? String(root.asyncapi ?? "").charAt(0) : "")

const resolveValue = (ctx: CompareContext, side: CompareSide, value: unknown): unknown => {
  if (!isRefNode(value)) {
    return value
  }
  const root = ctx[side].root
  return ctx.session.resolveRef(side, root, value.$ref)?.value
}

// ---------------------------------------------------------------------------------------------------------------
// traits (ISSUE-103): the effective object is the object with its traits merged in

/**
 * The effective object of an operation / message: its traits merged in, `$ref` traits resolved. 2.x applies every
 * trait as a JSON Merge Patch onto the object (the trait value wins, 2.6 §Operation Object `traits`); in 3.0 the value
 * defined in the object wins (3.0 §Traits Merge Mechanism).
 */
export const effectiveObject = (
  ctx: CompareContext,
  side: CompareSide,
  value: unknown,
): Record<string, unknown> | undefined => {
  const owner = resolveValue(ctx, side, value)
  if (!isObject(owner) || Array.isArray(owner)) {
    return
  }
  const { traits, ...own } = owner as Record<string, unknown>
  const merged: Record<string, unknown>[] = []
  if (Array.isArray(traits)) {
    for (const trait of traits) {
      const resolved = resolveValue(ctx, side, trait)
      if (isObject(resolved) && !Array.isArray(resolved)) {
        merged.push(resolved)
      }
    }
  }
  if (!merged.length) {
    return own
  }
  return majorVersion(ctx[side].root) === "2" ? Object.assign({}, own, ...merged) : Object.assign({}, ...merged, own)
}

// AsyncAPI schema formats (the default `schemaFormat`, any spelling and version)
export const isAsyncApiSchemaFormat = (format: unknown): boolean =>
  isString(format) && /^application\/vnd\.aai\.asyncapi(\+json|\+yaml)?(;|$)/i.test(format.trim())

// the value a message field takes when it is absent: `defaultContentType`, the AsyncAPI schema format
const fieldDefault = (key: string, root: unknown): unknown =>
  key === "contentType" && isObject(root) ? root.defaultContentType : undefined

const sameEffectiveValue = (key: string, value: unknown, effective: unknown, root: unknown): boolean => {
  if (key === "schemaFormat") {
    // an absent `schemaFormat` is the AsyncAPI schema format, written in any of its spellings
    if (effective === undefined) {
      return isAsyncApiSchemaFormat(value)
    }
    return (isAsyncApiSchemaFormat(value) && isAsyncApiSchemaFormat(effective)) || deepEqual(value, effective)
  }
  const other = effective === undefined ? fieldDefault(key, root) : effective
  return other !== undefined && deepEqual(value, other)
}

/**
 * A field of an object that traits (and document defaults) can supply: adding or removing the field itself is an
 * annotation when the effective value on the other side is the same (a trait inlined into the object, a
 * `contentType` equal to `defaultContentType`, an explicit default `schemaFormat`: ISSUE-103, ISSUE-70).
 */
export const effectiveField = (key: string, base: ClassifyRule): ClassifyRule =>
  overrideRule(base, (ctx, action) => {
    if (action === 0) {
      const owner = ctx.before.up?.value === undefined ? undefined : effectiveObject(ctx, "before", ctx.before.up.value)
      return sameEffectiveValue(key, ctx.after.value, owner?.[key], ctx.before.root) ? annotation : undefined
    }
    if (action === 1) {
      const owner = ctx.after.up?.value === undefined ? undefined : effectiveObject(ctx, "after", ctx.after.up.value)
      return sameEffectiveValue(key, ctx.before.value, owner?.[key], ctx.after.root) ? annotation : undefined
    }
    if (key === "schemaFormat" && isAsyncApiSchemaFormat(ctx.before.value) && isAsyncApiSchemaFormat(ctx.after.value)) {
      return annotation
    }
    return
  })

// fields of an object that only document it
const documentationKeys = new Set(["summary", "description", "title", "tags", "externalDocs", "examples", "messageId"])
const isDocumentationKey = (key: string) => documentationKeys.has(key) || key.startsWith("x-")

/**
 * A trait (or the `traits` list) added or removed: classified by what it changes in the effective object. A trait
 * whose fields leave the effective object unchanged (inlined into the object) or change documentation only is an
 * annotation (ISSUE-103); otherwise the base rule applies.
 */
export const traitRule = (base: ClassifyRule, list: boolean): ClassifyRule =>
  overrideRule(base, (ctx, action) => {
    if (action === 2) {
      return
    }
    // the owner object: the parent of the `traits` list
    const bList = list ? ctx.before : ctx.before.up
    const aList = list ? ctx.after : ctx.after.up
    const bOwner = bList?.up?.value
    const aOwner = aList?.up?.value
    if (bOwner === undefined || aOwner === undefined) {
      return
    }
    const before = effectiveObject(ctx, "before", bOwner) ?? {}
    const after = effectiveObject(ctx, "after", aOwner) ?? {}
    const side: CompareSide = action === 0 ? "after" : "before"
    const changed = ctx[side].value
    const traits = list ? (Array.isArray(changed) ? changed : []) : [changed]
    const keys = new Set<string>()
    for (const trait of traits) {
      const resolved = resolveValue(ctx, side, trait)
      if (isObject(resolved)) {
        for (const key of Object.keys(resolved)) {
          keys.add(key)
        }
      }
    }
    for (const key of keys) {
      if (!isDocumentationKey(key) && !deepEqual(before[key], after[key])) {
        return
      }
    }
    return annotation
  })

// the trait item a node lies in (an entry of a `traits` list) and the depth of the node below the trait's field
const traitOf = (node: NodeContext): { trait: NodeContext; depth: number } | undefined => {
  let depth = -1
  for (let current: NodeContext | undefined = node; current?.up; current = current.up, depth++) {
    if (current.up.key === "traits" && typeof current.key === "number") {
      return depth >= 0 ? { trait: current, depth } : undefined
    }
  }
  return
}

const fieldOfTrait = (node: NodeContext, depth: number): NodeContext => {
  let field = node
  for (let i = 0; i < depth; i++) {
    field = field.up as NodeContext
  }
  return field
}

/**
 * A change inside a trait of an operation / message (POLICY-81 decided): classified by its effect on the effective
 * (merged) object. When the effective value of the trait's field is the same on both sides (another trait or the
 * object itself supplies it), the change is an annotation; a change of the whole field is classified by `base` applied
 * to the effective values; a change deeper inside the field keeps the structural classification. A trait outside a
 * `traits` list (a `components.*Traits` entry) is classified structurally by its usages.
 */
export const traitFieldRule = (base: ClassifyRule): ClassifyRule =>
  overrideRule(base, (ctx) => {
    const bTrait = traitOf(ctx.before)
    const aTrait = traitOf(ctx.after)
    const bOwner = bTrait?.trait.up?.up?.value
    const aOwner = aTrait?.trait.up?.up?.value
    if (!bTrait || !aTrait || bOwner === undefined || aOwner === undefined) {
      return
    }
    const key = fieldOfTrait(ctx.before, bTrait.depth).key
    if (!isString(key)) {
      return
    }
    const bEffective = effectiveObject(ctx, "before", bOwner) ?? {}
    const aEffective = effectiveObject(ctx, "after", aOwner) ?? {}
    const before = bEffective[key]
    const after = aEffective[key]
    if (deepEqual(before, after)) {
      return annotation
    }
    if (bTrait.depth > 0) {
      return
    }
    const action = before === undefined ? 0 : after === undefined ? 1 : 2
    const effectiveCtx: CompareContext = {
      ...ctx,
      before: { ...ctx.before, value: before, parent: bEffective },
      after: { ...ctx.after, value: after, parent: aEffective },
    }
    return evaluate(resolveClassifyTuple(base, ctx.scope)[action], effectiveCtx)
  })

const TRAIT_FIELD_DEPTH = 3

const wrapTraitSubtree = (rules: CompareRules, depth: number): CompareRules => {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(rules)) {
    const value = (rules as Record<string, unknown>)[key]
    if (key === "$" && value !== undefined) {
      result[key] = traitFieldRule(value as ClassifyRule)
    } else if (key.startsWith("/") && depth < TRAIT_FIELD_DEPTH && isObject(value) && !Array.isArray(value)) {
      result[key] = wrapTraitSubtree(value as CompareRules, depth + 1)
    } else {
      result[key] = value
    }
  }
  return result as CompareRules
}

const STATIC_RULES = Symbol.for("api-smart-diff/static-rules")
type RulesFunction = ((ctx: unknown) => unknown) & { [STATIC_RULES]?: true }

// wrapped rule objects and functions, by original: recursive schema rules are wrapped once, lazily
const wrappedRules = new WeakMap<object, unknown>()

/**
 * A schema-valued trait field (`headers`, lazily built recursive schema rules, ISSUE-260): every rule below it
 * classified by its effect on the effective object, at any depth. Functions are wrapped lazily (a static rule stays
 * static), rule objects once.
 */
const wrapTraitRulesDeep = (rules: unknown): unknown => {
  if (typeof rules !== "function" && (!isObject(rules) || Array.isArray(rules))) {
    return rules
  }
  const cached = wrappedRules.get(rules as object)
  if (cached !== undefined) {
    return cached
  }
  if (typeof rules === "function") {
    const original = rules as RulesFunction
    let wrapped: RulesFunction
    if (original[STATIC_RULES]) {
      let built: unknown
      wrapped = (() => {
        built ??= wrapTraitRulesDeep(original(undefined))
        return built
      }) as RulesFunction
      wrapped[STATIC_RULES] = true
    } else {
      wrapped = ((ctx: unknown) => wrapTraitRulesDeep(original(ctx))) as RulesFunction
    }
    wrappedRules.set(original, wrapped)
    return wrapped
  }
  const result: Record<string, unknown> = {}
  wrappedRules.set(rules as object, result)
  for (const key of Object.keys(rules as object)) {
    const value = (rules as Record<string, unknown>)[key]
    if (key === "$" && value !== undefined) {
      result[key] = traitFieldRule(value as ClassifyRule)
    } else {
      result[key] = key.startsWith("/") ? wrapTraitRulesDeep(value) : value
    }
  }
  return result
}

/**
 * The rules of a trait item with every field (and the static rules below it, a few levels deep; schema-valued fields
 * with lazily built rules at any depth, ISSUE-260) classified by its effect on the effective object (POLICY-81).
 */
export const traitItemRules = (rules: CompareRules): CompareRules => {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(rules)) {
    const value = (rules as Record<string, unknown>)[key]
    const field = key.startsWith("/") && key !== "/*" && key !== "/**"
    result[key] =
      field && isObject(value) && !Array.isArray(value)
        ? wrapTraitSubtree(value as CompareRules, 0)
        : field && typeof value === "function"
          ? wrapTraitRulesDeep(value)
          : value
  }
  return result as CompareRules
}

// ---------------------------------------------------------------------------------------------------------------
// security (ISSUE-101): requirements are alternatives (only one must be satisfied), classified in both directions

// identity of a security alternative: the 2.x requirement's scheme names (scopes are compared inside it), the 3.0
// scheme reference or inline scheme
const alternativeKey = (item: unknown): string => {
  if (isRefNode(item)) {
    return `$ref:${item.$ref}`
  }
  if (!isObject(item)) {
    return JSON.stringify(item)
  }
  return Object.keys(item).sort().join("&")
}

const isV3 = (ctx: CompareContext) => majorVersion(ctx.before.root ?? ctx.after.root) === "3"

/** A list without requirements, or with an empty 2.x requirement (`{}`: anonymous access allowed). */
const emptySecurity = (value: unknown, v3: boolean): boolean =>
  Array.isArray(value) &&
  (value.length === 0 || (!v3 && value.some((item) => isObject(item) && !isRefNode(item) && !Object.keys(item).length)))

/** Every alternative of `items` is still offered by `value`: a client satisfying `items` still passes. */
const includeSecurity = (value: unknown, items: unknown, v3: boolean): boolean => {
  const _items = Array.isArray(items) ? items : []
  const _value = Array.isArray(value) ? value : []
  if (!_items.length) {
    return !_value.length || emptySecurity(_value, v3)
  }
  const offered = new Set(_value.map(alternativeKey))
  return _items.every((item) => offered.has(alternativeKey(item)))
}

/** The security list of an operation / server: requiring credentials where none were needed breaks clients. */
export const securityListRule: ClassifyRule = fixed([
  (ctx) => (Array.isArray(ctx.after.value) && !emptySecurity(ctx.after.value, isV3(ctx)) ? breaking : nonBreaking),
  nonBreaking,
  (ctx) =>
    includeSecurity(ctx.after.value, ctx.before.value, isV3(ctx)) || emptySecurity(ctx.after.value, isV3(ctx))
      ? nonBreaking
      : breaking,
])

/** One alternative: adding one to a secured list opens a new option, removing one of several closes it. */
export const securityAlternativeRule: ClassifyRule = fixed([
  ({ before }) => (isNotEmptyArray(before.parent) ? nonBreaking : breaking),
  (ctx) => (isNotEmptyArray(ctx.after.parent) && !emptySecurity(ctx.after.parent, isV3(ctx)) ? breaking : nonBreaking),
  (ctx) =>
    includeSecurity(ctx.after.parent, ctx.before.parent, isV3(ctx)) || emptySecurity(ctx.after.value, isV3(ctx))
      ? nonBreaking
      : breaking,
])

/** A 3.0 alternative pointing at another scheme: breaking unless the list still offers every former alternative. */
export const securityReferenceRule: ClassifyRule = fixed([
  breaking,
  nonBreaking,
  (ctx) => {
    const bList = ctx.before.up?.up?.value
    const aList = ctx.after.up?.up?.value
    return includeSecurity(aList, bList, true) ? nonBreaking : breaking
  },
])

/** Alternatives are matched by identity first, the remaining ones pairwise by position (a switched scheme). */
export const securityMappingResolver = createUniqueItemsMappingResolver(
  (a, b) => alternativeKey(a) === alternativeKey(b),
  true,
)

// ---------------------------------------------------------------------------------------------------------------
// structural fields

const isUnknownAddress = (value: unknown) => value === null || value === undefined

/**
 * 3.0 channel `address`: a null or absent address is unknown (dynamic). Absent ↔ null is no change, unknown → known
 * is non-breaking, known → unknown or another address is breaking (ISSUE-110).
 */
export const channelAddressRule: ClassifyRule = fixed([
  ({ after }) => (isUnknownAddress(after.value) ? annotation : nonBreaking),
  ({ before }) => (isUnknownAddress(before.value) ? annotation : breaking),
  ({ before, after }) =>
    isUnknownAddress(before.value) && isUnknownAddress(after.value)
      ? annotation
      : isUnknownAddress(before.value)
        ? nonBreaking
        : breaking,
])

/**
 * A whole `components.*` map added or removed (decision §11.4, ISSUE-143): classified by `base` when an entry of it
 * is referenced, unclassified when nothing references any of its entries.
 */
export const componentMapRule = (base: ClassifyTuple = [nonBreaking, breaking, breaking]): ClassifyRule =>
  overrideRule(fixed(base), (ctx, action) => {
    if (action === 2 || ctx.options.components === "unclassified") {
      return action === 2 ? undefined : unclassified
    }
    const node: NodeContext = action === 0 ? ctx.after : ctx.before
    if (!isObject(node.value)) {
      return
    }
    const index = getUsageIndex(ctx.session, [ctx.before.root, ctx.after.root], ctx.options.rules)
    const path = node.origin ?? node.path
    const base = `#/${path.map((step) => String(step).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`
    for (const key of Object.keys(node.value)) {
      if (index.usage(`${base}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`).size) {
        return
      }
    }
    return unclassified
  })

// ---------------------------------------------------------------------------------------------------------------
// renamed entries (ISSUE-78, POLICY-100 / 101): a channel, a channel message or a component whose key changed while
// every reference to it moved to the new key (or whose definition stayed identical); `findRenames` in `core/renames.ts`

// the keyed maps whose entries are referenced by `$ref`: 3.0 channels and channel messages, components of both versions
const renameableMaps = (before: Record<string, unknown>, after: Record<string, unknown>): RenameableMap[] => {
  const maps: RenameableMap[] = []
  const add = (path: string[], b: unknown, a: unknown) => {
    if (isObject(b) && isObject(a) && !Array.isArray(b) && !Array.isArray(a)) {
      maps.push({ path, before: b, after: a })
    }
  }
  if (isObject(before.components) && isObject(after.components)) {
    for (const kind of Object.keys(before.components)) {
      add(["components", kind], before.components[kind], after.components[kind])
    }
  }
  if (String(before.asyncapi ?? "").startsWith("3") && isObject(before.channels) && isObject(after.channels)) {
    add(["channels"], before.channels, after.channels)
    for (const channel of Object.keys(before.channels)) {
      const bChannel = before.channels[channel]
      const aChannel = after.channels[channel]
      if (isObject(bChannel) && isObject(aChannel)) {
        add(["channels", channel, "messages"], bChannel.messages, aChannel.messages)
      }
    }
  }
  return maps
}

// the messages map of a 3.0 channel pair (old channel -> new channel), compared for renames while the channel is
// renamed (ISSUE-301); its keys renamed with the channel count as equal for the channel's direct field share (POLICY-116)
const channelMessageMaps = (map: RenameableMap, oldKey: string, newKey: string): RenameableMap[] => {
  if (map.path.length !== 1 || map.path[0] !== "channels") {
    return []
  }
  const bMessages = (map.before[oldKey] as Record<string, unknown> | undefined)?.messages
  const aMessages = (map.after[newKey] as Record<string, unknown> | undefined)?.messages
  if (!isObject(bMessages) || !isObject(aMessages) || Array.isArray(bMessages) || Array.isArray(aMessages)) {
    return []
  }
  return [
    {
      path: ["channels", oldKey, "messages"],
      afterPath: ["channels", newKey, "messages"],
      before: bMessages,
      after: aMessages,
    },
  ]
}

const NO_RENAMES: ReadonlyMap<string, string> = new Map()

// subtrees that hold no security requirement (payloads, schemas and examples may use `security` as a property name)
const NO_REQUIREMENTS = new Set(["payload", "headers", "schemas", "examples", "bindings", "messages", "messageTraits"])
const escapeKey = (key: string) =>
  key.indexOf("~") < 0 && key.indexOf("/") < 0 ? key : key.replace(/~/g, "~0").replace(/\//g, "~1")

// 2.x security requirements as reference sites: each scheme name of a requirement points at
// `#/components/securitySchemes/<name>` (3.0 requirements are `$ref`s, found with the other references); the pointers
// are built only for the requirements found (ISSUE-330)
const requirementSites = (root: unknown): ReferenceSite[] => {
  const sites: ReferenceSite[] = []
  const seen = new Set<unknown>()
  const steps: string[] = []
  const scan = (value: unknown) => {
    if (!isObject(value) || seen.has(value)) {
      return
    }
    seen.add(value)
    const keys = Object.keys(value)
    for (let k = 0; k < keys.length; k++) {
      const name = keys[k]
      const child = value[name]
      if (name === "security" && Array.isArray(child)) {
        const at = `${steps.length ? `#/${steps.join("/")}` : "#"}/security`
        child.forEach((item, i) => {
          if (isObject(item) && !isString(item.$ref)) {
            for (const scheme of Object.keys(item)) {
              sites.push({ site: `${at}/${i}`, ref: pointerOfPath(["components", "securitySchemes", scheme]) })
            }
          }
        })
      } else if (!NO_REQUIREMENTS.has(name) && isObject(child)) {
        steps.push(escapeKey(name))
        scan(child)
        steps.pop()
      }
    }
  }
  scan(root)
  return sites
}

// whether a map has a removed and an added key (a rename candidate)
const hasRemovedAndAdded = (map: RenameableMap): boolean => {
  const before = Object.keys(map.before)
  const after = Object.keys(map.after)
  return before.some((key) => !(key in map.after)) && after.some((key) => !(key in map.before))
}

// the reference sites of a document: local `$ref`s from the session's reference scan, and 2.x security requirements
// when some security scheme may have been renamed (they point at nothing else, so they matter for no other entry)
const referenceSitesOf = (ctx: CompareContext, root: Record<string, unknown>, schemes: boolean): ReferenceSite[] => {
  const local = localReferenceSitesOf(ctx.session, root)
  return schemes && String(root.asyncapi ?? "").startsWith("2") ? [...local, ...requirementSites(root)] : local
}

/**
 * The renamed entries of the compared documents (once per compare session): before pointer -> after pointer. Used as
 * the root rule's `referenceRenames`.
 */
export const documentRenames = (ctx: CompareContext): ReadonlyMap<string, string> => {
  const key = "asyncapi:renames"
  let renames = ctx.session.caches.get(key) as ReadonlyMap<string, string> | undefined
  if (!renames) {
    const { root: before } = ctx.before
    const { root: after } = ctx.after
    if (isObject(before) && isObject(after)) {
      const maps = renameableMaps(before, after)
      const schemes = maps.some(
        (map) => map.path.length === 2 && map.path[1] === "securitySchemes" && hasRemovedAndAdded(map),
      )
      let bSites: ReferenceSite[] | undefined
      let aSites: ReferenceSite[] | undefined
      const bRefs = () => {
        bSites ??= referenceSitesOf(ctx, before, schemes)
        return bSites
      }
      const aRefs = () => {
        aSites ??= referenceSitesOf(ctx, after, schemes)
        return aSites
      }
      // the messages of a renamed 3.0 channel may be renamed too (ISSUE-301, POLICY-116)
      renames = findRenames(maps, bRefs, aRefs, { nested: channelMessageMaps })
    } else {
      renames = NO_RENAMES
    }
    ctx.session.caches.set(key, renames)
  }
  return renames
}

// the node a local JSON pointer (`#/channels/userEvents`) names in `root`, own keys only (`undefined` when none)
const localTarget = (root: unknown, pointer: string): unknown => {
  if (!pointer.startsWith("#")) {
    return
  }
  let value = root
  const steps = pointer.length > 2 ? pointer.slice(2).split("/") : []
  for (const step of steps) {
    const key = step.indexOf("~") < 0 ? step : step.replace(/~1/g, "/").replace(/~0/g, "~")
    if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, key)) {
      return
    }
    value = value[key]
  }
  return value
}

// the messages of the channel an operation names (`channel: { $ref }`, a local channel or `components.channels` entry)
const MAX_REF_HOPS = 8
const operationChannelRef = (root: unknown, operation: Record<string, unknown>) => {
  const channel = operation.channel
  if (!isObject(channel) || Array.isArray(channel) || !isString(channel.$ref)) {
    return
  }
  // the channel node itself may be a reference to another channel declaration
  let ref = channel.$ref
  let target = localTarget(root, ref)
  for (let hop = 0; hop < MAX_REF_HOPS && isObject(target) && isString(target.$ref); hop++) {
    ref = target.$ref
    target = localTarget(root, ref)
  }
  return isObject(target) && !Array.isArray(target) ? { ref, channel: target } : undefined
}

/**
 * The references an AsyncAPI 3.0 document makes without a `$ref` (the root rule's `impliedReferences`): an operation
 * without a `messages` list uses every message of its channel (POLICY-120 decided (a), ISSUE-340), so each message
 * of that channel gets a reference sited at the operation's `channel` (it takes the operation's direction, or, for a
 * component operation, the directions of the operations that use it). An empty list names no message.
 */
export const operationChannelMessages = (root: unknown): { path: (string | number)[]; ref: string }[] => {
  const result: { path: (string | number)[]; ref: string }[] = []
  if (!isObject(root) || !String(root.asyncapi ?? "").startsWith("3")) {
    return result
  }
  const visit = (operations: unknown, path: string[]) => {
    if (!isObject(operations) || Array.isArray(operations)) {
      return
    }
    for (const key of Object.keys(operations)) {
      const operation = operations[key]
      if (
        !isObject(operation) ||
        Array.isArray(operation) ||
        Object.prototype.hasOwnProperty.call(operation, "messages")
      ) {
        continue
      }
      const target = operationChannelRef(root, operation)
      const messages = target?.channel.messages
      if (!target || !isObject(messages) || Array.isArray(messages)) {
        continue
      }
      for (const message of Object.keys(messages)) {
        result.push({ path: [...path, key, "channel"], ref: `${target.ref}/messages/${escapeKey(message)}` })
      }
    }
  }
  visit(root.operations, ["operations"])
  const components = root.components
  if (isObject(components)) {
    visit(components.operations, ["components", "operations"])
  }
  return result
}

/**
 * A rule that classifies a renamed entry (one `rename` diff at its map, read through the replace slot) and a
 * reference string repointed from the old to the new key as annotations (ISSUE-78, POLICY-100); any other change keeps
 * `base`. The content of a renamed entry is compared old definition against new definition (POLICY-101).
 */
export const renameAware = (base: ClassifyRule): ClassifyRule =>
  overrideRule(base, (ctx, action) => {
    if (action !== 2 || !documentEntryRenames(ctx).size) {
      return
    }
    if (isRenamedEntry(ctx)) {
      return annotation
    }
    const before = ctx.before.value
    const after = ctx.after.value
    return isString(before) && isString(after) && renamedReference(ctx, before) === after ? annotation : undefined
  })

/**
 * A scheme of a 2.x security requirement (a key of the requirement object) renamed with its scheme (ISSUE-78,
 * POLICY-101): the rename is an annotation; any other change keeps `base`.
 */
export const requirementSchemeRenameAware = (base: ClassifyRule): ClassifyRule =>
  overrideRule(base, (ctx, action) => {
    const { before, after } = ctx
    if (action !== 2 || before.key === after.key || !isString(before.key) || !documentEntryRenames(ctx).size) {
      return
    }
    return schemeRenames(ctx).get(before.key) === after.key ? annotation : undefined
  })

/** The security schemes renamed with every requirement repointed: before name -> after name. */
export const schemeRenames = (ctx: CompareContext): Map<string, string> =>
  renamesIn(documentEntryRenames(ctx), ["components", "securitySchemes"])
