import type { JsonPath } from "json-crawl"

import type {
  CompareContext,
  CompareResolver,
  CompareRule,
  CompareSession,
  MapKeysResult,
  MappingResolver,
  NodeContext,
} from "../types"
import { isObject, isString } from "../utils"
import { mergedValue } from "./compare"
import { deepEqual, equalKeysShortcut, identityOnEqualKeys, objectMappingResolver } from "./mapping"
import { documentReferences } from "./usage"

// ---------------------------------------------------------------------------------------------------------------
// renamed entries (ISSUE-78, POLICY-100 / POLICY-101): a keyed entry (a component, a channel, a channel message, a
// security scheme) whose key changed while every reference to it moved from the old key to the new one

/** A reference of a document: the JSON pointer of the node that holds it and its target (`#/components/schemas/A`). */
export interface ReferenceSite {
  site: string
  ref: string
}

/**
 * A keyed map whose entries may be renamed: its path and its values on both sides (`afterPath`: its path in the after
 * document when the map lies in a renamed entry, e.g. the messages of a renamed channel).
 */
export interface RenameableMap {
  path: JsonPath
  before: Record<string, unknown>
  after: Record<string, unknown>
  afterPath?: JsonPath
}

const escapeStep = (step: string | number) => {
  const text = String(step)
  return text.indexOf("~") < 0 && text.indexOf("/") < 0 ? text : text.replace(/~/g, "~0").replace(/\//g, "~1")
}

/** The JSON pointer of a path (`#/components/schemas/Pet`). */
export const pointerOfPath = (path: readonly (string | number)[]): string => {
  let pointer = "#"
  for (const step of path) {
    pointer += `/${escapeStep(step)}`
  }
  return pointer
}

/** The last key of a JSON pointer, unescaped. */
export const lastPointerKey = (pointer: string): string =>
  pointer
    .slice(pointer.lastIndexOf("/") + 1)
    .replace(/~1/g, "/")
    .replace(/~0/g, "~")

/** Whether `ref` points at `pointer` or inside it. */
export const pointsInto = (ref: string, pointer: string): boolean =>
  ref === pointer || (ref.startsWith(pointer) && ref.charCodeAt(pointer.length) === 47) /* "/" */

/**
 * A reference held by a string other than `$ref` (POLICY-106: a discriminator mapping value, a link `operationRef`):
 * the target pointer of the string `value` under `key`, or `undefined` when it is none. `holder` lists the (escaped)
 * keys of the object that holds the string, from the document root.
 */
export type StringReference = (key: string, value: string, holder: readonly string[]) => string | undefined

const escapeKey = (key: string) => (key.indexOf("~") < 0 && key.indexOf("/") < 0 ? key : escapeStep(key))

/**
 * Every local `$ref` string of a document (`#...`) with the pointer of the object that holds it; with `strings`, also
 * the references held by other string values, sited at the pointer of the string itself. The pointers are built only
 * for the references found.
 */
export const localReferenceSites = (root: unknown, strings?: StringReference): ReferenceSite[] => {
  const result: ReferenceSite[] = []
  const seen = new Set<unknown>()
  const steps: string[] = []
  const pointer = () => (steps.length ? `#/${steps.join("/")}` : "#")
  const walk = (value: Record<string | number, unknown>) => {
    seen.add(value)
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const child = value[i]
        if (isObject(child) && !seen.has(child)) {
          steps.push(String(i))
          walk(child)
          steps.pop()
        }
      }
      return
    }
    const keys = Object.keys(value)
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k]
      const child = value[key]
      if (key === "$ref" && isString(child)) {
        if (child.startsWith("#")) {
          result.push({ site: pointer(), ref: child })
        }
      } else if (isObject(child)) {
        if (!seen.has(child)) {
          steps.push(escapeKey(key))
          walk(child)
          steps.pop()
        }
      } else if (strings && isString(child)) {
        const ref = strings(key, child, steps)
        if (ref !== undefined) {
          steps.push(escapeKey(key))
          result.push({ site: pointer(), ref })
          steps.pop()
        }
      }
    }
  }
  if (isObject(root)) {
    walk(root)
  }
  return result
}

/**
 * `localReferenceSites(root)` from the session's scan of the document's `$ref` strings (`documentReferences`, shared
 * with the usage index), instead of a walk of its own (ISSUE-330). An object reached on several paths gives its site
 * once, on the first path, as with the walk; the sites may come in another order (`findRenames` does not depend on
 * it). A document whose scan was cut off by the depth limit (a cyclic object graph) is walked as before.
 */
export const localReferenceSitesOf = (session: CompareSession, root: unknown): ReferenceSite[] => {
  const scan = documentReferences(session, root)
  if (!scan.complete) {
    return localReferenceSites(root)
  }
  const result: ReferenceSite[] = []
  const holders = new Set<object>()
  for (const { path, ref, holder } of scan.refs) {
    if (!ref.startsWith("#") || holders.has(holder)) {
      continue
    }
    holders.add(holder)
    let site = "#"
    for (const step of path) {
      site += `/${typeof step === "number" ? String(step) : escapeKey(step)}`
    }
    result.push({ site, ref })
  }
  return result
}

// a pointer rewritten by the renames found so far (old entry -> new entry): the longest renamed entry it points into
// (a message renamed in a renamed channel before the channel)
const rewrite = (pointer: string, pairs: ReadonlyMap<string, string>): string => {
  let best: string | undefined
  for (const from of pairs.keys()) {
    if ((best === undefined || from.length > best.length) && pointsInto(pointer, from)) {
      best = from
    }
  }
  return best === undefined ? pointer : (pairs.get(best) as string) + pointer.slice(best.length)
}

// the references of the entries of interest, by entry pointer: every pointer prefix of a reference is looked up
const indexReferences = (refs: ReferenceSite[], entries: Set<string>): Map<string, ReferenceSite[]> => {
  const index = new Map<string, ReferenceSite[]>()
  for (const reference of refs) {
    const { ref } = reference
    for (let i = ref.indexOf("/", 2); ; i = ref.indexOf("/", i + 1)) {
      const prefix = i < 0 ? ref : ref.slice(0, i)
      if (entries.has(prefix)) {
        let list = index.get(prefix)
        if (!list) {
          list = []
          index.set(prefix, list)
        }
        list.push(reference)
      }
      if (i < 0) {
        break
      }
    }
  }
  return index
}

const NONE: ReferenceSite[] = []

/** Share of a definition pair above which a removed and an added entry are a rename (POLICY-105). */
export const RENAME_SIMILARITY = 0.5

const isPlainMap = (value: unknown): value is Record<string, unknown> => isObject(value) && !Array.isArray(value)
const hasOwn = Object.prototype.hasOwnProperty

/** Tells whether a reference of the before definition (`#/...`) names the same entry as one of the after definition. */
export type SameReference = (before: string, after: string) => boolean

/**
 * Options of `findRenames` (POLICY-116): `strings` reads the references held by strings other than `$ref` on each side
 * (POLICY-106: discriminator mapping values, link `operationRef`s; called with the escaped holder keys from the
 * document root, as `localReferenceSites`), and `nested` lists the renameable maps inside an entry pair (a 3.0
 * channel's `messages`): they are compared for renames once the pair is renamed (ISSUE-301), and their keys renamed
 * together with the entry count as equal for the direct field share.
 */
export interface RenameOptions {
  strings?: { before: StringReference; after: StringReference }
  nested?: (map: RenameableMap, oldKey: string, newKey: string) => RenameableMap[]
}

// how two definitions are compared for the direct field share: the reference comparison, the string references of
// each side, and the nested renameable maps of the pair (before pointer -> after pointer)
interface ShareEquality {
  same: SameReference
  strings?: RenameOptions["strings"]
  nested?: ReadonlyMap<string, string>
}

const pointerOfSteps = (steps: readonly string[]) => (steps.length ? `#/${steps.join("/")}` : "#")

// deep equality where a reference pair (a `$ref` string, or a string reference of `strings`) also counts as equal when
// `same` says so (POLICY-113 / 116), and the keys of a nested renameable map are paired through `same` (POLICY-116).
// `bSteps` / `aSteps` are the escaped keys of the objects holding `b` / `a` (from the document root; mutated and
// restored).
const equalWithReferences = (
  b: unknown,
  a: unknown,
  eq: ShareEquality,
  key: string | number | undefined,
  bSteps: string[],
  aSteps: string[],
): boolean => {
  if (b === a) {
    return true
  }
  if (isString(b) && isString(a)) {
    if (key === "$ref") {
      return eq.same(b, a)
    }
    if (!eq.strings || !isString(key)) {
      return false
    }
    const bRef = eq.strings.before(key, b, bSteps)
    const aRef = bRef === undefined ? undefined : eq.strings.after(key, a, aSteps)
    return aRef !== undefined && eq.same(bRef as string, aRef)
  }
  if (!isObject(b) || !isObject(a) || Array.isArray(b) !== Array.isArray(a)) {
    return false
  }
  if (key !== undefined) {
    bSteps.push(escapeKey(String(key)))
    aSteps.push(escapeKey(String(key)))
  }
  const result =
    Array.isArray(b) && Array.isArray(a)
      ? b.length === a.length && b.every((item, i) => equalWithReferences(item, a[i], eq, i, bSteps, aSteps))
      : equalMaps(b, a, eq, bSteps, aSteps)
  if (key !== undefined) {
    bSteps.pop()
    aSteps.pop()
  }
  return result
}

// two maps at `bSteps` / `aSteps`; a nested renameable map pairs a before key with the after key `same` names
const equalMaps = (
  b: Record<string, unknown>,
  a: Record<string, unknown>,
  eq: ShareEquality,
  bSteps: string[],
  aSteps: string[],
): boolean => {
  const bKeys = Object.keys(b)
  const aKeys = Object.keys(a)
  if (bKeys.length !== aKeys.length) {
    return false
  }
  const bPointer = eq.nested?.size ? pointerOfSteps(bSteps) : undefined
  const aPointer = bPointer === undefined ? undefined : eq.nested?.get(bPointer)
  if (aPointer === undefined) {
    for (const k of bKeys) {
      if (!hasOwn.call(a, k) || !equalWithReferences(b[k], a[k], eq, k, bSteps, aSteps)) {
        return false
      }
    }
    return true
  }
  // the before key's entry, named in the after map by the renames (its own key when it was not renamed)
  const used = new Set<string>()
  for (const k of bKeys) {
    const from = `${bPointer}/${escapeKey(k)}`
    let to: string | undefined
    if (hasOwn.call(a, k) && eq.same(from, `${aPointer}/${escapeKey(k)}`)) {
      to = k
    } else {
      to = aKeys.find((c) => !used.has(c) && !hasOwn.call(b, c) && eq.same(from, `${aPointer}/${escapeKey(c)}`))
    }
    if (to === undefined || used.has(to)) {
      return false
    }
    used.add(to)
    // the entry's value, compared at its own key on each side
    bSteps.push(escapeKey(k))
    aSteps.push(escapeKey(to))
    const equal = equalWithReferences(b[k], a[to], eq, undefined, bSteps, aSteps)
    bSteps.pop()
    aSteps.pop()
    if (!equal) {
      return false
    }
  }
  return true
}

// whether a value holds a reference: a `$ref` string, or a string reference of `strings` (POLICY-106), itself (under
// `key`, held by the object at `steps`) or anywhere inside
const holdsReference = (
  value: unknown,
  key: string | number | undefined,
  steps: string[],
  strings?: StringReference,
): boolean => {
  if (isString(value)) {
    return key === "$ref" || (strings !== undefined && isString(key) && strings(key, value, steps) !== undefined)
  }
  if (!isObject(value)) {
    return false
  }
  if (key !== undefined) {
    steps.push(escapeKey(String(key)))
  }
  let result = false
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length && !result; i++) {
      result = holdsReference(value[i], i, steps, strings)
    }
  } else {
    for (const k of Object.keys(value)) {
      if (holdsReference(value[k], k, steps, strings)) {
        result = true
        break
      }
    }
  }
  if (key !== undefined) {
    steps.pop()
  }
  return result
}

// the parts of a direct field share that do not depend on the renames: the union of the direct keys, the fields that
// are deep-equal, and the unequal fields whose equality depends on the renames (they hold references on both sides, or
// hold a nested renameable map)
interface ShareParts {
  union: number
  equal: number
  referenceKeys: string[]
}

// where the definitions of a pair lie (escaped keys from the document root) and the direct keys holding nested maps
interface PairPlace {
  bSteps: readonly string[]
  aSteps: readonly string[]
  nestedKeys?: ReadonlySet<string>
}

const shareParts = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  strings?: RenameOptions["strings"],
  place?: PairPlace,
): ShareParts => {
  const bKeys = Object.keys(before)
  let union = bKeys.length
  let equal = 0
  const referenceKeys: string[] = []
  for (const key of bKeys) {
    if (!hasOwn.call(after, key)) {
      continue
    }
    if (deepEqual(before[key], after[key])) {
      equal++
    } else if (
      place?.nestedKeys?.has(key) ||
      (holdsReference(before[key], key, [...(place?.bSteps ?? [])], strings?.before) &&
        holdsReference(after[key], key, [...(place?.aSteps ?? [])], strings?.after))
    ) {
      referenceKeys.push(key)
    }
  }
  for (const key of Object.keys(after)) {
    if (!hasOwn.call(before, key)) {
      union++
    }
  }
  return { union, equal, referenceKeys }
}

const shareOf = (
  parts: ShareParts,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  eq?: ShareEquality,
  place?: PairPlace,
): number => {
  if (!parts.union) {
    return 1
  }
  let equal = parts.equal
  if (eq) {
    for (const key of parts.referenceKeys) {
      if (
        equalWithReferences(before[key], after[key], eq, key, [...(place?.bSteps ?? [])], [...(place?.aSteps ?? [])])
      ) {
        equal++
      }
    }
  }
  return equal / parts.union
}

/**
 * The share of equal direct fields of two definitions (POLICY-105): the direct keys whose values are deep-equal on both
 * sides divided by the union of the direct keys of both (nested fields are not counted separately). Values that are
 * not objects (or arrays) count 1 when equal and 0 otherwise; two empty objects are equal (1). With `same`, a field
 * that differs only by `$ref`s for which `same` holds counts as equal (POLICY-113: a reference repointed through a
 * rename names the same entry).
 */
export const directFieldShare = (before: unknown, after: unknown, same?: SameReference): number => {
  if (!isPlainMap(before) || !isPlainMap(after)) {
    return deepEqual(before, after) ? 1 : 0
  }
  return shareOf(shareParts(before, after), before, after, same && { same })
}

// a candidate pair of a map: its score is 2 for a reference-site match (POLICY-101), else the direct field share
interface RenameCandidate {
  oldPointer: string
  newPointer: string
  score: number
}

/**
 * Pairs the candidates one-to-one, the best score first (stable: document order of the old, then of the new keys); a
 * candidate whose old or new key has another candidate with the same score that is not paired yet is ambiguous
 * (POLICY-112), and neither key is paired. `paired` holds the keys paired before (and receives the new ones).
 */
const selectPairs = (list: RenameCandidate[], paired: Set<string>): RenameCandidate[] => {
  const result: RenameCandidate[] = []
  list.sort((a, b) => b.score - a.score)
  const blocked = new Set<string>()
  for (let i = 0; i < list.length; i++) {
    const candidate = list[i]
    const { oldPointer, newPointer, score } = candidate
    if (blocked.has(oldPointer) || blocked.has(newPointer)) {
      continue
    }
    let ambiguous = false
    for (let j = 0; j < list.length && !ambiguous; j++) {
      const other = list[j]
      ambiguous =
        j !== i &&
        other.score === score &&
        !paired.has(other.oldPointer) &&
        !paired.has(other.newPointer) &&
        (other.oldPointer === oldPointer || other.newPointer === newPointer)
    }
    blocked.add(oldPointer).add(newPointer)
    if (!ambiguous) {
      result.push(candidate)
      paired.add(oldPointer).add(newPointer)
    }
  }
  return result
}

/**
 * Pairs the removed and added keys of the maps into renames. A pair is considered when the old key is no longer
 * referenced in the after document and the new key is not referenced in the before document; it is a rename when the
 * old key was referenced and every reference moved — the references of the new key are those of the old key at the same
 * sites, with the renames found so far (the pair itself included) applied to the sites and targets (POLICY-101) — or,
 * referenced or not (POLICY-111), when more than half of the direct fields of the two definitions are equal
 * (`directFieldShare`, POLICY-105; a deep-equal definition is a rename that changes nothing, ISSUE-78), a field that
 * differs only by references repointed through the renames found so far (the pair itself included) counting as equal
 * (POLICY-113) — `$ref` strings, the string references of `options.strings` (POLICY-106) and the keys of the nested
 * renameable maps of `options.nested` renamed together with the entry (POLICY-116). Pairing is one-to-one, the best score first (a reference-site match before any share); a pair whose old
 * or new key has another candidate with the same score is ambiguous, and neither key is paired (POLICY-112). The passes
 * repeat until no pair is added (nested and cascading renames); entries that are renames only together (references in a
 * cycle) are paired by a consistent assumption: every remaining candidate is assumed a rename, and the assumption is
 * narrowed to the pairs that the scores under it select until it selects itself. A nested map is considered while its
 * entry pair is renamed (or assumed renamed and selected first in the same round). Returns the before pointer -> after
 * pointer of each rename. The references may be given as functions, called only when some map has both removed and
 * added keys.
 */
export const findRenames = (
  maps: RenameableMap[],
  bRefs: ReferenceSite[] | (() => ReferenceSite[]),
  aRefs: ReferenceSite[] | (() => ReferenceSite[]),
  options: RenameOptions = {},
): Map<string, string> => {
  const { strings, nested } = options
  const pairs = new Map<string, string>()
  // a candidate map; a nested map (`parent`) lies in an entry pair and is considered only while that pair is renamed
  // (or assumed renamed)
  interface Candidate {
    path: JsonPath
    afterPath: JsonPath
    removed: string[]
    added: string[]
    // the pointers of the removed (before) and added (after) entries, built once (ISSUE-330)
    removedPointers: string[]
    addedPointers: string[]
    map: RenameableMap
    parent?: { oldPointer: string; newPointer: string }
  }
  const candidates: Candidate[] = []
  // the nested renameable maps of each entry pair: old pointer -> new pointer -> (before map pointer -> after pointer)
  const nestedMaps = new Map<string, Map<string, Map<string, string>>>()
  const entries = new Set<string>()
  const addMap = (map: RenameableMap, parent?: Candidate["parent"]) => {
    const removed = Object.keys(map.before).filter((key) => !(key in map.after))
    const added = Object.keys(map.after).filter((key) => !(key in map.before))
    if (!removed.length || !added.length) {
      return
    }
    const afterPath = map.afterPath ?? map.path
    const beforePrefix = pointerOfPath(map.path)
    const afterPrefix = pointerOfPath(afterPath)
    const removedPointers = removed.map((key) => `${beforePrefix}/${escapeStep(key)}`)
    const addedPointers = added.map((key) => `${afterPrefix}/${escapeStep(key)}`)
    candidates.push({ path: map.path, afterPath, removed, added, removedPointers, addedPointers, map, parent })
    for (const pointer of removedPointers) {
      entries.add(pointer)
    }
    for (const pointer of addedPointers) {
      entries.add(pointer)
    }
  }
  for (const map of maps) {
    addMap(map)
  }
  // the nested maps of every pair of a candidate map (a nested map may hold nested maps itself)
  for (let c = 0; nested && c < candidates.length; c++) {
    const { map, removed, added, removedPointers, addedPointers } = candidates[c]
    for (let r = 0; r < removed.length; r++) {
      const oldKey = removed[r]
      const oldPointer = removedPointers[r]
      for (let a = 0; a < added.length; a++) {
        const newKey = added[a]
        const newPointer = addedPointers[a]
        const inner = nested(map, oldKey, newKey)
        if (!inner.length) {
          continue
        }
        let byNew = nestedMaps.get(oldPointer)
        if (!byNew) {
          byNew = new Map()
          nestedMaps.set(oldPointer, byNew)
        }
        const pointers = new Map<string, string>()
        byNew.set(newPointer, pointers)
        for (const item of inner) {
          pointers.set(pointerOfPath(item.path), pointerOfPath(item.afterPath ?? item.path))
          addMap(item, { oldPointer, newPointer })
        }
      }
    }
  }
  if (!candidates.length) {
    return pairs
  }
  // the references are collected only when some map has both removed and added keys
  const bIndex = indexReferences(typeof bRefs === "function" ? bRefs() : bRefs, entries)
  const aIndex = indexReferences(typeof aRefs === "function" ? aRefs() : aRefs, entries)
  const sitesKey = (sites: ReferenceSite[], renames: Map<string, string>) =>
    sites
      .map(({ site, ref }) => `${rewrite(site, renames)}\u0000${rewrite(ref, renames)}`)
      .sort()
      .join("\u0001")
  // where the definitions of a pair lie, and its nested maps (POLICY-116)
  const stepsOf = (path: JsonPath, key: string) => [...path, key].map((step) => escapeKey(String(step)))
  const placeOf = (candidate: Candidate, oldKey: string, newKey: string, oldPointer: string, newPointer: string) => {
    const inner = nestedMaps.get(oldPointer)?.get(newPointer)
    const bSteps = stepsOf(candidate.path, oldKey)
    const nestedKeys = new Set<string>()
    for (const pointer of inner?.keys() ?? []) {
      // the direct key of the entry the nested map lies in (`#/channels/a/messages` -> `messages`)
      const rest = pointer.slice(pointerOfSteps(bSteps).length + 1)
      nestedKeys.add(rest.slice(0, rest.indexOf("/") < 0 ? rest.length : rest.indexOf("/")))
    }
    return { place: { bSteps, aSteps: stepsOf(candidate.afterPath, newKey), nestedKeys }, inner }
  }

  const paired = new Set<string>()
  // the parts of each pair's share that do not depend on the renames, and the share computed with a number of renames
  // found (the renames only grow, so a share stays valid until a rename is added)
  const parts = new Map<string, ShareParts | null>()
  const places = new Map<string, (PairPlace & { inner?: Map<string, string> }) | undefined>()
  const shares = new Map<string, { renames: number; score: number }>()
  // the references of the old definition rewritten by the renames found so far and the candidate itself; with an
  // assumption, a reference into an assumed entry (the longest renamed or assumed entry it points into) matches any of
  // its assumed new entries
  const sameUnder = (oldPointer: string, newPointer: string, assumed?: Map<string, Set<string>>): SameReference => {
    const renames = new Map(pairs).set(oldPointer, newPointer)
    const matchesAssumed = (ref: string, aRef: string, longerThan: number) => {
      for (const [from, targets] of assumed as Map<string, Set<string>>) {
        if (from.length > longerThan && pointsInto(ref, from)) {
          const rest = ref.slice(from.length)
          for (const to of targets) {
            if (aRef === to + rest) {
              return true
            }
          }
        }
      }
      return false
    }
    return (bRef, aRef) => {
      const rewritten = rewrite(bRef, renames)
      if (rewritten === aRef || !assumed) {
        return rewritten === aRef
      }
      let renamedPrefix = -1
      for (const from of renames.keys()) {
        if (from.length > renamedPrefix && pointsInto(bRef, from)) {
          renamedPrefix = from.length
        }
      }
      // an entry renamed inside an assumed one (a message of an assumed channel), or an assumed entry
      return matchesAssumed(bRef, aRef, renamedPrefix) || matchesAssumed(rewritten, aRef, -1)
    }
  }
  const scoreOf = (
    candidate: Candidate,
    oldKey: string,
    newKey: string,
    oldPointer: string,
    newPointer: string,
    assumed?: Map<string, Set<string>>,
  ): number => {
    const before = candidate.map.before[oldKey]
    const after = candidate.map.after[newKey]
    const key = `${oldPointer}\u0000${newPointer}`
    let share = parts.get(key)
    let place = places.get(key)
    if (share === undefined) {
      const located =
        isPlainMap(before) && isPlainMap(after) ? placeOf(candidate, oldKey, newKey, oldPointer, newPointer) : undefined
      place = located && { ...located.place, inner: located.inner }
      share = located
        ? shareParts(before as Record<string, unknown>, after as Record<string, unknown>, strings, located.place)
        : null
      parts.set(key, share)
      places.set(key, place)
    }
    if (!share) {
      return deepEqual(before, after) ? 1 : 0
    }
    if (!share.referenceKeys.length) {
      return shareOf(share, before as Record<string, unknown>, after as Record<string, unknown>)
    }
    if (!assumed) {
      const cached = shares.get(key)
      if (cached && cached.renames === pairs.size) {
        return cached.score
      }
    }
    const score = shareOf(
      share,
      before as Record<string, unknown>,
      after as Record<string, unknown>,
      { same: sameUnder(oldPointer, newPointer, assumed), strings, nested: place?.inner },
      place,
    )
    if (!assumed) {
      shares.set(key, { renames: pairs.size, score })
    }
    return score
  }
  // the pairs of a map that meet the reference conditions (old key no longer referenced, new key not referenced
  // before), with the old key's references in the before document
  const eachPair = (
    candidate: Candidate,
    visit: (oldKey: string, oldPointer: string, newKey: string, newPointer: string, bSites: ReferenceSite[]) => void,
  ) => {
    const { removed, added, removedPointers, addedPointers } = candidate
    for (let r = 0; r < removed.length; r++) {
      const oldKey = removed[r]
      const oldPointer = removedPointers[r]
      if (paired.has(oldPointer) || aIndex.has(oldPointer)) {
        continue
      }
      const bSites = bIndex.get(oldPointer) ?? NONE
      for (let a = 0; a < added.length; a++) {
        const newKey = added[a]
        const newPointer = addedPointers[a]
        if (!paired.has(newPointer) && !bIndex.has(newPointer)) {
          visit(oldKey, oldPointer, newKey, newPointer, bSites)
        }
      }
    }
  }
  // a nested map is considered while its entry pair is renamed, or (in an assumption) assumed / selected
  const isRenamedPair = (parent: Candidate["parent"], also?: (oldPointer: string, newPointer: string) => boolean) =>
    !parent ||
    pairs.get(parent.oldPointer) === parent.newPointer ||
    also?.(parent.oldPointer, parent.newPointer) === true

  for (;;) {
    let found = false
    for (const candidate of candidates) {
      if (!isRenamedPair(candidate.parent)) {
        continue
      }
      const list: RenameCandidate[] = []
      eachPair(candidate, (oldKey, oldPointer, newKey, newPointer, bSites) => {
        // a reference-site match needs references (POLICY-101); an unreferenced pair is judged by its fields
        const aSites = aIndex.get(newPointer) ?? NONE
        const moved =
          bSites.length > 0 &&
          aSites.length === bSites.length &&
          sitesKey(bSites, new Map(pairs).set(oldPointer, newPointer)) === sitesKey(aSites, new Map())
        const score = moved ? 2 : scoreOf(candidate, oldKey, newKey, oldPointer, newPointer)
        if (score > RENAME_SIMILARITY) {
          list.push({ oldPointer, newPointer, score })
        }
      })
      for (const { oldPointer, newPointer } of selectPairs(list, paired)) {
        pairs.set(oldPointer, newPointer)
        found = true
      }
    }
    if (found) {
      continue
    }
    // entries that are renames only together (POLICY-113: references in a cycle; POLICY-116: an entry and the entries
    // of its nested maps): every remaining pair is assumed a rename, then the assumption is narrowed to the pairs its
    // scores select, until it selects itself
    let assumed = new Map<string, Set<string>>()
    const isAssumed = (oldPointer: string, newPointer: string) => assumed.get(oldPointer)?.has(newPointer) === true
    for (const candidate of candidates) {
      // a nested map's parent pair comes before it
      if (!isRenamedPair(candidate.parent, isAssumed)) {
        continue
      }
      eachPair(candidate, (_oldKey, oldPointer, _newKey, newPointer) => {
        let targets = assumed.get(oldPointer)
        if (!targets) {
          targets = new Set()
          assumed.set(oldPointer, targets)
        }
        targets.add(newPointer)
      })
    }
    let selected: RenameCandidate[] = []
    while (assumed.size) {
      const size = [...assumed.values()].reduce((sum, targets) => sum + targets.size, 0)
      const taken = new Set(paired)
      selected = []
      // a nested map counts in this round only when its parent pair was selected in it (parents come first)
      const isSelected = (oldPointer: string, newPointer: string) =>
        selected.some((pair) => pair.oldPointer === oldPointer && pair.newPointer === newPointer)
      for (const candidate of candidates) {
        if (!isRenamedPair(candidate.parent, isSelected)) {
          continue
        }
        const list: RenameCandidate[] = []
        eachPair(candidate, (oldKey, oldPointer, newKey, newPointer) => {
          if (!isAssumed(oldPointer, newPointer) || taken.has(oldPointer) || taken.has(newPointer)) {
            return
          }
          const score = scoreOf(candidate, oldKey, newKey, oldPointer, newPointer, assumed)
          if (score > RENAME_SIMILARITY) {
            list.push({ oldPointer, newPointer, score })
          }
        })
        selected.push(...selectPairs(list, taken))
      }
      if (selected.length === size) {
        break
      }
      assumed = new Map(selected.map(({ oldPointer, newPointer }) => [oldPointer, new Set([newPointer])]))
      selected = []
    }
    for (const { oldPointer, newPointer } of selected) {
      pairs.set(oldPointer, newPointer)
      paired.add(oldPointer).add(newPointer)
    }
    if (!selected.length) {
      break
    }
  }
  return pairs
}

/** The before key -> after key of the renames in the map at `path` (`findRenames` pointers). */
export const renamesIn = (renames: ReadonlyMap<string, string>, path: JsonPath): Map<string, string> => {
  const result = new Map<string, string>()
  if (!renames.size) {
    return result
  }
  const prefix = pointerOfPath(path)
  // the map's pointer in the after document (inside a renamed entry: its new key)
  const afterPrefix = rewrite(prefix, renames)
  for (const [from, to] of renames) {
    const key = from.lastIndexOf("/")
    if (from.slice(0, key) === prefix && to.slice(0, to.lastIndexOf("/")) === afterPrefix) {
      result.set(lastPointerKey(from), lastPointerKey(to))
    }
  }
  return result
}

const NO_RENAMES: ReadonlyMap<string, string> = new Map()

/**
 * The renamed entries of the compared documents, from the root rule's `referenceRenames` (before pointer -> after
 * pointer; empty when the rule set has none).
 */
export const documentEntryRenames = (ctx: CompareContext): ReadonlyMap<string, string> => {
  const rules = ctx.options?.rules as CompareRule | undefined
  return rules && typeof rules === "object" && rules.referenceRenames ? rules.referenceRenames(ctx) : NO_RENAMES
}

/** The names of a renamed entry: its after key and the before key it was renamed from (POLICY-107). */
export interface RenamedEntryNames {
  name: string
  from: string
}

const inverseRenames = new WeakMap<ReadonlyMap<string, string>, Map<string, string>>()

/**
 * The names of the renamed entry at `path` (a declaration path of the `side` document), or `undefined` when the entry
 * there was not renamed: descriptions of the changes inside it name both ("schema component `New` (renamed from
 * `Old`)", POLICY-107).
 */
export const renamedEntry = (
  ctx: CompareContext,
  side: "before" | "after",
  path: readonly (string | number)[],
): RenamedEntryNames | undefined => {
  const renames = documentEntryRenames(ctx)
  if (!renames.size) {
    return
  }
  const pointer = pointerOfPath(path)
  if (side === "before") {
    const to = renames.get(pointer)
    return to === undefined ? undefined : { name: lastPointerKey(to), from: lastPointerKey(pointer) }
  }
  let inverse = inverseRenames.get(renames)
  if (!inverse) {
    inverse = new Map()
    for (const [from, to] of renames) {
      inverse.set(to, from)
    }
    inverseRenames.set(renames, inverse)
  }
  const from = inverse.get(pointer)
  return from === undefined ? undefined : { name: lastPointerKey(pointer), from: lastPointerKey(from) }
}

/** `renamedEntry` for a node context of either side (its declaration path inside `$ref` targets). */
export const renamedEntryOf = (ctx: CompareContext, node: NodeContext | undefined): RenamedEntryNames | undefined =>
  node ? renamedEntry(ctx, node.root === ctx.after.root ? "after" : "before", node.origin ?? node.path) : undefined

/** A reference rewritten by the renames (`#/components/schemas/Old/properties/a` -> `#/components/schemas/New/...`). */
export const renamedReference = (ctx: CompareContext, ref: string): string | undefined => {
  const renames = documentEntryRenames(ctx)
  if (!renames.size) {
    return
  }
  const result = rewrite(ref, renames)
  return result !== ref ? result : undefined
}

/** Whether the node pair is an entry renamed with its references repointed (the mapped keys differ). */
export const isRenamedEntry = (ctx: CompareContext): boolean => {
  const { before, after } = ctx
  if (before.key === after.key || before.key === undefined || after.key === undefined) {
    return false
  }
  const renames = documentEntryRenames(ctx)
  return (
    renames.size > 0 &&
    renames.get(pointerOfPath(before.origin ?? before.path)) === pointerOfPath(after.origin ?? after.path)
  )
}

/** Pairs the keys a plain key mapping leaves removed / added through `renames` (before key -> after key). */
export const withRenamedKeys = (result: MapKeysResult<string>, renames: Map<string, string>): MapKeysResult<string> => {
  if (!renames.size || !result.removed.length || !result.added.length) {
    return result
  }
  const added = new Set(result.added)
  const removed: string[] = []
  for (const key of result.removed) {
    const renamed = renames.get(key)
    if (renamed !== undefined && added.has(renamed)) {
      result.mapped[key] = renamed
      added.delete(renamed)
    } else {
      removed.push(key)
    }
  }
  return { added: [...added], removed, mapped: result.mapped }
}

/**
 * A keyed map whose entries may be renamed (`documentEntryRenames`): by key (`base`), a renamed entry mapped to its new
 * key, so the rename is one `rename` diff at the map and the old and new definitions are compared (POLICY-100 / 101).
 */
export const renameMappingResolver = (
  base: MappingResolver<string> = objectMappingResolver,
): MappingResolver<string> => {
  const resolver: MappingResolver<string> = (before, after, ctx) => {
    const result = base(before, after, ctx)
    if (!result.removed.length || !result.added.length) {
      return result
    }
    return withRenamedKeys(result, renamesIn(documentEntryRenames(ctx), ctx.before.origin ?? ctx.before.path))
  }
  // without removed and added keys there is no rename
  const shortcut = equalKeysShortcut(base)
  return shortcut === undefined ? resolver : identityOnEqualKeys(resolver, shortcut ?? undefined)
}

/**
 * A reference object (`{ $ref }`) repointed from a renamed entry to its new key: unchanged (the rename is reported at
 * the renamed map, POLICY-100); any other reference pair is compared by the node's rules.
 */
export const repointedReferenceResolver: CompareResolver = (ctx) => {
  const { before, after } = ctx
  const b = before.value
  const a = after.value
  if (!isObject(b) || !isObject(a) || !isString(b.$ref) || !isString(a.$ref) || b.$ref === a.$ref) {
    return
  }
  if (Object.keys(b).length !== 1 || Object.keys(a).length !== 1 || renamedReference(ctx, b.$ref) !== a.$ref) {
    return
  }
  return { diffs: [], merged: mergedValue(ctx, after, a) }
}

/**
 * A string that references an entry (POLICY-106: a discriminator mapping value, a link `operationRef`) repointed from a
 * renamed entry to its new key: unchanged (the rename is reported at the renamed map); `target(side, value, ctx)` reads
 * the pointer a string names (`undefined` when it names none). Any other pair is compared by the node's rules.
 */
export const repointedStringResolver =
  (target: (side: "before" | "after", value: string, ctx: CompareContext) => string | undefined): CompareResolver =>
  (ctx) => {
    const b = ctx.before.value
    const a = ctx.after.value
    if (!isString(b) || !isString(a) || b === a) {
      return
    }
    const bRef = target("before", b, ctx)
    const aRef = target("after", a, ctx)
    if (bRef === undefined || aRef === undefined || renamedReference(ctx, bRef) !== aRef) {
      return
    }
    return { diffs: [], merged: mergedValue(ctx, ctx.after, a) }
  }
