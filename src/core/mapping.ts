import type { MapKeysResult, MappingResolver } from "../types"
import { isObject } from "../utils"

export const arrayMappingResolver: MappingResolver<number> = (before, after) => {
  const length = Math.abs(before.length - after.length)
  const arr = Array.from({ length: Math.min(before.length, after.length) }, (_, i) => i)

  return {
    removed: before.length > after.length ? Array.from({ length }, (_, i) => after.length + i) : [],
    added: before.length < after.length ? Array.from({ length }, (_, i) => before.length + i) : [],
    mapped: arr.reduce(
      (res, i) => {
        res[i] = i
        return res
      },
      {} as Record<number, number>,
    ),
  }
}

// object mapping resolvers that map every key to itself when both objects have the same keys in the same order, with
// the keys that exclude the shortcut (`null`: none)
const equalKeysIdentity = new WeakMap<object, ((key: string) => boolean) | null>()

/**
 * Marks an object mapping resolver that maps every key to itself, in before order, whenever both objects have the same
 * own keys in the same order (no rename, no normalization that could pair two equal keys differently) and none of them
 * satisfies `unless`. The engine then pairs the keys without calling it (the usual case: most compared containers keep
 * their keys). Returns the resolver.
 */
export const identityOnEqualKeys = <T extends MappingResolver<string>>(
  resolver: T,
  unless?: (key: string) => boolean,
): T => {
  equalKeysIdentity.set(resolver, unless ?? null)
  return resolver
}

/**
 * The shortcut condition of a resolver marked with `identityOnEqualKeys`: `null` for any keys, a key predicate that
 * excludes it, or `undefined` when the resolver is not marked.
 */
export const equalKeysShortcut = (resolver: unknown): ((key: string) => boolean) | null | undefined =>
  typeof resolver === "function" ? equalKeysIdentity.get(resolver) : undefined

export const objectMappingResolver: MappingResolver<string> = (before, after) => {
  const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }
  const afterKeys = new Set(Object.keys(after))

  for (const key of Object.keys(before)) {
    if (afterKeys.has(key)) {
      result.mapped[key] = key
      afterKeys.delete(key)
    } else {
      result.removed.push(key)
    }
  }

  for (const key of afterKeys) {
    result.added.push(key)
  }

  return result
}
identityOnEqualKeys(objectMappingResolver)

/**
 * Maps keys by a normalized form (case-insensitive by default) and reports the original spellings: the mapping
 * is `originalBeforeKey -> originalAfterKey`, so the engine finds the before key again.
 */
export const createKeyMappingResolver =
  (normalize: (key: string) => string): MappingResolver<string> =>
  (before, after) => {
    const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }
    const bKeys = Object.keys(before)
    const aKeys = Object.keys(after)
    // the usual case: the same keys, each already in normalized form (the general path below maps them one to one)
    if (bKeys.length === aKeys.length) {
      let same = true
      for (let i = 0; i < bKeys.length && same; i++) {
        same = bKeys[i] === aKeys[i] && normalize(bKeys[i]) === bKeys[i]
      }
      if (same) {
        for (const key of bKeys) {
          result.mapped[key] = key
        }
        return result
      }
    }
    const afterByNormalized = new Map<string, string>()
    for (const key of aKeys) {
      const normalized = normalize(key)
      if (!afterByNormalized.has(normalized)) {
        afterByNormalized.set(normalized, key)
      }
    }

    for (const key of bKeys) {
      const normalized = normalize(key)
      const afterKey = afterByNormalized.get(normalized)
      if (afterKey !== undefined) {
        result.mapped[key] = afterKey
        afterByNormalized.delete(normalized)
      } else {
        result.removed.push(key)
      }
    }

    for (const key of afterByNormalized.values()) {
      result.added.push(key)
    }

    return result
  }

// `toLocaleLowerCase` without the locale-aware (slow) path for the usual keys: an ASCII key without uppercase letters
// is already lower case, and an ASCII key without `I` lower-cases the same in every locale (Turkish / Azeri dotless i
// and Lithuanian rules only concern `I` and non-ASCII letters)
const localeLowerCase = (key: string): string => {
  let upper = false
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i)
    if (code > 127 || code === 73 /* I */) {
      return key.toLocaleLowerCase()
    }
    if (code >= 65 && code <= 90) {
      upper = true
    }
  }
  return upper ? key.toLowerCase() : key
}

export const caseInsensitiveKeyMappingResolver: MappingResolver<string> = createKeyMappingResolver(localeLowerCase)

/** Structural equality of two JSON values (arrays by position, objects by key set). */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true
  }
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
  }
  if (!isObject(a) || !isObject(b) || Array.isArray(b)) {
    return false
  }
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return aKeys.length === bKeys.length && aKeys.every((key) => key in b && deepEqual(a[key], b[key]))
}

/**
 * Maps array items by equality regardless of position (enum values, required names, scopes, tags): equal items are
 * mapped, unmatched items are paired positionally as replacements when `pairUnmatched` is set, the rest is
 * added/removed.
 */
export const createUniqueItemsMappingResolver =
  (equals: (a: unknown, b: unknown) => boolean, pairUnmatched: boolean): MappingResolver<number> =>
  (before, after) => {
    const result: MapKeysResult<number> = { added: [], removed: [], mapped: {} }
    const unmappedAfter = new Set(after.keys())
    const unmappedBefore: number[] = []

    for (let i = 0; i < before.length; i++) {
      let found = -1
      for (const j of unmappedAfter) {
        if (equals(before[i], after[j])) {
          found = j
          break
        }
      }
      if (found < 0) {
        unmappedBefore.push(i)
      } else {
        result.mapped[i] = found
        unmappedAfter.delete(found)
      }
    }

    let j = 0
    for (const i of unmappedAfter) {
      if (pairUnmatched && j < unmappedBefore.length) {
        result.mapped[unmappedBefore[j++]] = i
      } else {
        result.added.push(i)
      }
    }

    for (let i = j; i < unmappedBefore.length; i++) {
      result.removed.push(unmappedBefore[i])
    }

    return result
  }

export const deepEqualsUniqueItemsMappingResolver: MappingResolver<number> = createUniqueItemsMappingResolver(
  deepEqual,
  false,
)
