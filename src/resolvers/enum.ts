import { MapKeysResult, MappingResolver } from "../types"


export const mapSimpleEnumItemsRule: MappingResolver<number> = (before, after) => {

  const result: MapKeysResult<number> = {
    added: [],
    removed: [],
    mapped: {}
  }

  const afterItems = [...after]
  const mappedIndex = new Set(after.keys())

  for (let i = 0; i < before.length; i++) {
    const _afterIndex = afterItems.indexOf(before[i])
    
    if (_afterIndex < 0) {
      // removed item
      result.removed.push(i)
    } else {
      // mapped items
      result.mapped[i] = _afterIndex
      mappedIndex.delete(_afterIndex)
    }
  }

  // added items
  mappedIndex.forEach((i) => result.added.push(i))

  return result
}
