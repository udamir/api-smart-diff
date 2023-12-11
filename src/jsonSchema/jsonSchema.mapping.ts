import type { MapKeysResult, MappingResolver } from "../types"

export const enumMappingResolver: MappingResolver<number> = (before, after) => {

  const result: MapKeysResult<number> = { added: [], removed: [],  mapped: {} }

  const afterItems = [...after]
  const unmappedAfter = new Set(after.keys())
  const unmappedBefore: number[] = []

  for (let i = 0; i < before.length; i++) {
    const _afterIndex = afterItems.indexOf(before[i])
    
    if (_afterIndex < 0) {
      unmappedBefore.push(i)
    } else {
      // mapped items
      result.mapped[i] = _afterIndex
      unmappedAfter.delete(_afterIndex)
    }
  }

  let j = 0
  unmappedAfter.forEach((i) => {
    if (j < unmappedBefore.length) {
      // replaced items
      result.mapped[unmappedBefore[j++]] = i
    } else {
      // added items
      result.added.push(i)
    }
  })

  // removed items
  for (let i = j; i < unmappedBefore.length; i++) {
    result.removed.push(unmappedBefore[i])
  }

  return result
}

export const requiredMappingResolver: MappingResolver<number> = (before, after) => {

  const result: MapKeysResult<number> = { added: [], removed: [],  mapped: {} }

  const afterItems = [...after]
  const unmappedAfter = new Set(after.keys())

  for (let i = 0; i < before.length; i++) {
    const _afterIndex = afterItems.indexOf(before[i])
    
    if (_afterIndex < 0) {
      result.removed.push(i)
    } else {
      // mapped items
      result.mapped[i] = _afterIndex
      unmappedAfter.delete(_afterIndex)
    }
  }

  unmappedAfter.forEach((i) => {
    // added items
    result.added.push(i)
  })

  return result
}
