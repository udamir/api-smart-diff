import type { MapKeysResult, MappingArrayResolver, MappingObjectResolver } from "../types"
import { getKeyValue } from "../utils"
import { pairExtensions, pairFiles, pairOneofs, shadowRoot } from "./protoapi.utils"
import { PROTOAPI_FILE_PAIRS_CACHE_KEY } from "./protoapi.const"

/**
 * The oneof pairs of a message pair, computed by `renameCascadeTransform` before it rewrote the members' `oneof`
 * values, keyed by the before shadow it returned (the members of the shadow no longer show the old names).
 */
export const oneofPairsOfShadow = new WeakMap<object, Map<string, string>>()

// Pairing resolvers of ProtoApi containers (PROTOAPI_DESIGN §4.6). None is marked with `identityOnEqualKeys`: two
// entries that swap their identity (field numbers, enum value numbers) keep the key order and would pair by name.

const emptyResult = <T extends string | number>(): MapKeysResult<T> => ({
  added: [],
  removed: [],
  mapped: {} as Record<T, T>,
})

// pairs by key first, then the remaining before keys with the remaining after keys `match` accepts (first match in
// after order), the rest added / removed
const pairByKeyThen = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  match: (bKey: string, aKey: string) => boolean,
): MapKeysResult<string> => {
  const result = emptyResult<string>()
  const aRemaining = new Set(Object.keys(after).filter((key) => !(key in before)))
  for (const key of Object.keys(before)) {
    if (key in after) {
      result.mapped[key] = key
      continue
    }
    let found: string | undefined
    for (const candidate of aRemaining) {
      if (match(key, candidate)) {
        found = candidate
        break
      }
    }
    if (found === undefined) {
      result.removed.push(key)
    } else {
      result.mapped[key] = found
      aRemaining.delete(found)
    }
  }
  result.added.push(...aRemaining)
  return result
}

/**
 * Fields of a message (and of a field-shaped extension body) pair by `number` (R4 / Q14): the first declaration of a
 * number wins on duplicates (IN-11); entries without a number pair by key. A pair with different keys is a rename,
 * classified by the replace slot of the `/properties/*` rule (DG-03).
 */
export const fieldNumberMappingResolver: MappingObjectResolver = (before, after) => {
  const result = emptyResult<string>()
  const aByNumber = new Map<number, string>()
  const aUnnumbered = new Set<string>()
  for (const key of Object.keys(after)) {
    const number = getKeyValue(after[key], "number")
    if (typeof number !== "number") {
      aUnnumbered.add(key)
    } else if (!aByNumber.has(number)) {
      aByNumber.set(number, key)
    }
  }
  const aMapped = new Set<string>()
  const bSeen = new Set<number>()
  for (const key of Object.keys(before)) {
    const number = getKeyValue(before[key], "number")
    let aKey: string | undefined
    if (typeof number !== "number") {
      aKey = aUnnumbered.has(key) ? key : undefined
    } else if (!bSeen.has(number)) {
      bSeen.add(number)
      aKey = aByNumber.get(number)
    }
    if (aKey === undefined) {
      result.removed.push(key)
    } else {
      result.mapped[key] = aKey
      aMapped.add(aKey)
    }
  }
  for (const key of Object.keys(after)) {
    if (!aMapped.has(key)) {
      result.added.push(key)
    }
  }
  return result
}

/**
 * Enum values pair per number (§4.6, V-2, V-3, V-8): equal names first, then the remaining names of one number
 * positionally (renames); a name left over is added or removed (an alias added, or removed while its number stays).
 */
export const enumValueMappingResolver: MappingObjectResolver = (before, after) => {
  const result = emptyResult<string>()
  const byNumber = (values: Record<string, unknown>) => {
    const map = new Map<number | undefined, string[]>()
    for (const key of Object.keys(values)) {
      const raw = getKeyValue(values[key], "number")
      const number = typeof raw === "number" ? raw : undefined
      const list = map.get(number)
      if (list) {
        list.push(key)
      } else {
        map.set(number, [key])
      }
    }
    return map
  }
  const aByNumber = byNumber(after)
  const aMapped = new Set<string>()
  for (const [number, bKeys] of byNumber(before)) {
    const aKeys = aByNumber.get(number) ?? []
    const aRemaining = aKeys.filter((key) => !bKeys.includes(key))
    let next = 0
    for (const key of bKeys) {
      if (aKeys.includes(key)) {
        result.mapped[key] = key
        aMapped.add(key)
      } else if (number !== undefined && next < aRemaining.length) {
        const aKey = aRemaining[next++]
        result.mapped[key] = aKey
        aMapped.add(aKey)
      } else {
        result.removed.push(key)
      }
    }
  }
  for (const key of Object.keys(after)) {
    if (!aMapped.has(key)) {
      result.added.push(key)
    }
  }
  return result
}

/**
 * Oneofs pair by name, then by an equal member number set (G3): a renamed oneof is one rename diff. The message pair
 * is read from the context (the `oneofs` container's parent nodes), so the resolver shares `pairOneofs` with
 * `renameCascadeTransform`.
 */
export const oneofMappingResolver: MappingObjectResolver = (before, after, ctx) => {
  const bMessage = ctx.before.up?.value
  const known = typeof bMessage === "object" && bMessage !== null ? oneofPairsOfShadow.get(bMessage) : undefined
  const pairs = known ?? pairOneofs(ctx.before.up?.source ?? bMessage, ctx.after.up?.source ?? ctx.after.up?.value)
  return pairByKeyThen(before, after, (bKey, aKey) => pairs.get(bKey) === aKey)
}

/**
 * Extensions pair by key, then a remaining before extension with a remaining after extension of the same `extendee`
 * and `number` (A3): a renamed extension is one rename diff.
 */
export const extensionMappingResolver: MappingObjectResolver = (before, after) => {
  const pairs = pairExtensions(before, after)
  return pairByKeyThen(before, after, (bKey, aKey) => pairs.get(bKey) === aKey)
}

/**
 * Files pair by path, then a remaining before path with the remaining after path whose declared element set is
 * identical and not empty (A5): a renamed file is one rename diff. The pairs are the ones `fileRenameTransform`
 * computed for the root pair (shared through the session), so both see the same renames.
 */
export const fileMappingResolver: MappingObjectResolver = (before, after, ctx) => {
  const cached = ctx.session.caches.get(PROTOAPI_FILE_PAIRS_CACHE_KEY) as Map<string, string> | undefined
  const pairs = cached ?? pairFiles(shadowRoot(ctx.before), shadowRoot(ctx.after))
  return pairByKeyThen(before, after, (bKey, aKey) => pairs.get(bKey) === aKey)
}

// the spelling of an HTTP binding's verb and path (S7)
const bindingKey = (binding: unknown): string =>
  `${String(getKeyValue(binding, "method"))} ${String(getKeyValue(binding, "path"))}`

/**
 * Additional HTTP bindings pair by method + path first, then the remaining bindings by position (S7); unmatched
 * bindings are added or removed.
 */
export const httpBindingMappingResolver: MappingArrayResolver = (before, after) => {
  const result = emptyResult<number>()
  const aRemaining = new Set(after.keys())
  const bRemaining: number[] = []
  for (let i = 0; i < before.length; i++) {
    const key = bindingKey(before[i])
    let found = -1
    for (const j of aRemaining) {
      if (bindingKey(after[j]) === key) {
        found = j
        break
      }
    }
    if (found < 0) {
      bRemaining.push(i)
    } else {
      result.mapped[i] = found
      aRemaining.delete(found)
    }
  }
  const aLeft = [...aRemaining]
  for (let k = 0; k < bRemaining.length; k++) {
    if (k < aLeft.length) {
      result.mapped[bRemaining[k]] = aLeft[k]
    } else {
      result.removed.push(bRemaining[k])
    }
  }
  for (let k = bRemaining.length; k < aLeft.length; k++) {
    result.added.push(aLeft[k])
  }
  return result
}

const rangeOf = (entry: unknown): [number, number] | undefined => {
  const range = getKeyValue(entry, "range")
  return Array.isArray(range) && typeof range[0] === "number" && typeof range[1] === "number"
    ? [range[0], range[1]]
    : undefined
}

/**
 * Extension range options (`extensionOptions`) pair by range: equal start and end first, then a remaining entry with
 * the one remaining entry of the other side whose range overlaps it, when the overlap is one to one (a range extended
 * or shrunk keeps its options, POLICY-136).
 */
export const rangeOptionsMappingResolver: MappingArrayResolver = (before, after) => {
  const result = emptyResult<number>()
  const aRemaining = new Set(after.keys())
  const bRemaining: number[] = []
  for (let i = 0; i < before.length; i++) {
    const range = rangeOf(before[i])
    let found = -1
    for (const j of aRemaining) {
      const other = rangeOf(after[j])
      if (range && other && range[0] === other[0] && range[1] === other[1]) {
        found = j
        break
      }
    }
    if (found < 0) {
      bRemaining.push(i)
    } else {
      result.mapped[i] = found
      aRemaining.delete(found)
    }
  }
  const overlapping = (a: [number, number] | undefined, b: [number, number] | undefined) =>
    !!a && !!b && a[0] <= b[1] && b[0] <= a[1]
  for (const i of bRemaining) {
    const range = rangeOf(before[i])
    const candidates = [...aRemaining].filter((j) => overlapping(range, rangeOf(after[j])))
    const unique =
      candidates.length === 1 &&
      bRemaining.filter((k) => overlapping(rangeOf(before[k]), rangeOf(after[candidates[0]]))).length === 1
    if (unique) {
      result.mapped[i] = candidates[0]
      aRemaining.delete(candidates[0])
    } else {
      result.removed.push(i)
    }
  }
  result.added.push(...aRemaining)
  return result
}

/** Extension declarations of one range (`options.extension_declarations["<lo>-<hi>"]`) pair by `number`. */
export const declarationMappingResolver: MappingArrayResolver = (before, after) => {
  const result = emptyResult<number>()
  const aRemaining = new Set(after.keys())
  for (let i = 0; i < before.length; i++) {
    const number = getKeyValue(before[i], "number")
    let found = -1
    for (const j of aRemaining) {
      if (getKeyValue(after[j], "number") === number) {
        found = j
        break
      }
    }
    if (found < 0) {
      result.removed.push(i)
    } else {
      result.mapped[i] = found
      aRemaining.delete(found)
    }
  }
  result.added.push(...aRemaining)
  return result
}
