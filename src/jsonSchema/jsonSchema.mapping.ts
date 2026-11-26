import type { MapKeysResult, MappingResolver } from "../types"
import { deepEqual, identityOnEqualKeys, objectMappingResolver } from "../core"

export const jsonSchemaMappingResolver: MappingResolver<string> = identityOnEqualKeys((before, after, ctx) => {
  const { added, removed, mapped } = objectMappingResolver(before, after, ctx)

  const beforeCombinaryIndex = removed.findIndex((item) => item === "oneOf" || item === "anyOf")
  const afterCombinaryIndex = added.findIndex((item) => item === "oneOf" || item === "anyOf")

  if (beforeCombinaryIndex < 0 || afterCombinaryIndex < 0) {
    return { added, removed, mapped }
  }

  const [bkey] = removed.splice(beforeCombinaryIndex, 1)
  const [akey] = added.splice(afterCombinaryIndex, 1)
  mapped[bkey] = akey

  return { added, removed, mapped }
})

// the index of an equal value among the items not mapped yet: objects and arrays by deep equality, so that enum values
// with another key order are the same value (ISSUE-97)
const indexOfValue = (items: unknown[], value: unknown, unmapped: Set<number>): number => {
  if (typeof value !== "object" || value === null) {
    return items.indexOf(value)
  }
  for (let j = 0; j < items.length; j++) {
    if (unmapped.has(j) && deepEqual(items[j], value)) {
      return j
    }
  }
  return -1
}

export const enumMappingResolver: MappingResolver<number> = (before, after) => {
  const result: MapKeysResult<number> = { added: [], removed: [], mapped: {} }

  const afterItems = [...after]
  const unmappedAfter = new Set(after.keys())
  const unmappedBefore: number[] = []

  for (let i = 0; i < before.length; i++) {
    const _afterIndex = indexOfValue(afterItems, before[i], unmappedAfter)

    if (_afterIndex < 0) {
      unmappedBefore.push(i)
    } else {
      // mapped items
      result.mapped[i] = _afterIndex
      unmappedAfter.delete(_afterIndex)
    }
  }

  let j = 0
  for (const i of unmappedAfter) {
    if (j < unmappedBefore.length) {
      // replaced items
      result.mapped[unmappedBefore[j++]] = i
    } else {
      // added items
      result.added.push(i)
    }
  }

  // removed items
  for (let i = j; i < unmappedBefore.length; i++) {
    result.removed.push(unmappedBefore[i])
  }

  return result
}

export const requiredMappingResolver: MappingResolver<number> = (before, after) => {
  const result: MapKeysResult<number> = { added: [], removed: [], mapped: {} }

  const afterItems = [...after]
  // after indexes mapped so far (an array instead of a set of the unmapped ones: no iterator, ISSUE-330)
  const mappedAfter: boolean[] = []

  for (let i = 0; i < before.length; i++) {
    const _afterIndex = afterItems.indexOf(before[i])

    if (_afterIndex < 0) {
      result.removed.push(i)
    } else {
      // mapped items
      result.mapped[i] = _afterIndex
      mappedAfter[_afterIndex] = true
    }
  }

  for (let i = 0; i < afterItems.length; i++) {
    if (!mappedAfter[i]) {
      // added items
      result.added.push(i)
    }
  }

  return result
}
