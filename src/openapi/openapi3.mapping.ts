import type { MapKeysResult, MappingResolver } from "../types"
import { getValueByPath, objectKeys } from "../utils"

export const pathMappingResolver: MappingResolver<string> = (before, after) => {

  const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }

  const beforeKeys = objectKeys(before)
  const _beforeKeys = beforeKeys.map((key) => key.replace(new RegExp("\{.*?\}", "g"), "*"))
  const afterKeys = objectKeys(after)
  const _afterKeys = afterKeys.map((key) => key.replace(new RegExp("\{.*?\}", "g"), "*"))

  const mappedIndex = new Set(afterKeys.keys())

  for (let i = 0; i < beforeKeys.length; i++) {
    const _afterIndex = _afterKeys.indexOf(_beforeKeys[i])
    
    if (_afterIndex < 0) {
      // removed item
      result.removed.push(beforeKeys[i])
    } else {
      // mapped items
      result.mapped[beforeKeys[i]] = afterKeys[_afterIndex]
      mappedIndex.delete(_afterIndex)
    }
  }

  // added items
  mappedIndex.forEach((i) => result.added.push(afterKeys[i]))

  return result
}

export const paramMappingResolver: MappingResolver<number> = (before, after) => {
  const result: MapKeysResult<number> = { added: [], removed: [], mapped: {} }

  const mappedIndex = new Set(after.keys())

  for (let i = 0; i < before.length; i++) {
    const _afterIndex = after.findIndex((after) => {
      const beforeIn = getValueByPath(before[i], "in")
      const afterIn = getValueByPath(after, "in")
      
      const beforeName = getValueByPath(before[i], "name")
      const afterName = getValueByPath(after, "name")

      // TODO: add extra mapping logic for path parameters
      return beforeIn === afterIn && (beforeIn === "path" || beforeName === afterName)
    })
    
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

export const contentMediaTypeMappingResolver: MappingResolver<string> = (before, after) => {
  const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }

  const beforeKeys = objectKeys(before)
  const _beforeKeys = beforeKeys.map((key) => key.split(";")[0] ?? "")
  const afterKeys = objectKeys(after)
  const _afterKeys = afterKeys.map((key) => key.split(";")[0] ?? "")

  const mappedIndex = new Set(afterKeys.keys())

  for (let i = 0; i < beforeKeys.length; i++) {
    const _afterIndex = _afterKeys.findIndex((key) => {
      const [ afterType, afterSubType ] = key.split("/")
      const [ beforeType, beforeSubType ] = _beforeKeys[i].split("/")

      if (afterType !== beforeType && afterType !== "*" && beforeType !== "*") { return false }
      if (afterSubType !== beforeSubType && afterSubType !== "*" && beforeSubType !== "*") { return false }
      return true
    })
    
    if (_afterIndex < 0) {
      // removed item
      result.removed.push(beforeKeys[i])
    } else {
      // mapped items
      result.mapped[beforeKeys[i]] = afterKeys[_afterIndex]
      mappedIndex.delete(_afterIndex)
    }
  }

  // added items
  mappedIndex.forEach((i) => result.added.push(afterKeys[i]))

  return result
}
