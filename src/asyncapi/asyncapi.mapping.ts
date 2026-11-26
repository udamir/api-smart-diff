import { createUniqueItemsMappingResolver, deepEqual, renamedReference } from "../core"
import type { MappingResolver } from "../types"
import { getStringValue, isObject, isString } from "../utils"

/** Tags are matched by name, so reordering them is not a change (ISSUE-111). */
export const tagMappingResolver: MappingResolver<number> = createUniqueItemsMappingResolver(
  (a, b) => (isObject(a) && isObject(b) && a.name !== undefined ? a.name === b.name : deepEqual(a, b)),
  false,
)

// the last segment of a local reference (`#/channels/userEvents/messages/signup` -> `signup`)
const refKey = (item: unknown): string | undefined => {
  if (!isObject(item) || !isString(item.$ref)) {
    return
  }
  const segments = item.$ref.split("/")
  return segments.length > 1 ? segments[segments.length - 1] : undefined
}

/**
 * 3.0 operation / reply message references: equal references are the same message; a reference to a message with
 * the same key in another channel (the operation moved to another channel) is the same entry retargeted, so the
 * change is one nominal reference change instead of a removed and an added message (ISSUE-106).
 */
export const messageRefMappingResolver: MappingResolver<number> = (before, after, ctx) => {
  const exact = createUniqueItemsMappingResolver(deepEqual, false)(before, after, ctx)
  if (!exact.added.length || !exact.removed.length) {
    return exact
  }
  const mapped: Record<number, number> = { ...exact.mapped }
  const added = new Set(exact.added)
  const removed: number[] = []
  for (const i of exact.removed) {
    const key = refKey(before[i])
    // a reference repointed to a renamed message (ISSUE-78)
    const ref = getStringValue(before[i], "$ref")
    const renamed = ref !== undefined ? renamedReference(ctx, ref) : undefined
    let found = -1
    if (renamed !== undefined) {
      for (const j of added) {
        if (getStringValue(after[j], "$ref") === renamed) {
          found = j
          break
        }
      }
    }
    if (found < 0 && key !== undefined) {
      for (const j of added) {
        if (refKey(after[j]) === key) {
          found = j
          break
        }
      }
    }
    if (found < 0) {
      removed.push(i)
    } else {
      mapped[i] = found
      added.delete(found)
    }
  }
  return { added: [...added], removed, mapped }
}
