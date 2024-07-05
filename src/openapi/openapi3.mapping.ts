import type { MapKeysResult, MappingResolver } from "../types"
import { getStringValue, objectKeys } from "../utils"
import { mapPathParams } from "./openapi3.utils"
import { resolveRef } from "../jsonSchema"

export const pathMappingResolver: MappingResolver<string> = (before, after) => {
  const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }

  const beforeKeys = objectKeys(before)
  const _beforeKeys = beforeKeys.map((key) => key.replace(/\{.*?\}/g, "*"))
  const afterKeys = objectKeys(after)
  const _afterKeys = afterKeys.map((key) => key.replace(/\{.*?\}/g, "*"))

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

export const paramMappingResolver: MappingResolver<number> = (
  before,
  after,
  ctx,
) => {
  const result: MapKeysResult<number> = { added: [], removed: [], mapped: {} }

  const pathParamMapping = mapPathParams(ctx)
  const mappedIndex = new Set(after.keys())
  const _before = before.map((b) => resolveRef(b, ctx.before.root))
  const _after = after.map((a) => resolveRef(a, ctx.after.root))

  for (let i = 0; i < _before.length; i++) {
    const beforeIn = getStringValue(_before[i], "in")
    const beforeName = getStringValue(_before[i], "name") ?? ""

    const _afterIndex = _after.findIndex((a) => {
      const afterIn = getStringValue(a, "in")
      const afterName = getStringValue(a, "name") ?? ""

      // use extra mapping logic for path parameters
      return (
        beforeIn === afterIn &&
        (beforeName === afterName ||
          (beforeIn === "path" && pathParamMapping[beforeName] === afterName))
      )
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

export const contentMediaTypeMappingResolver: MappingResolver<string> = (
  before,
  after,
) => {
  const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }

  const beforeKeys = objectKeys(before)
  const _beforeKeys = beforeKeys.map((key) => key.split(";")[0] ?? "")
  const afterKeys = objectKeys(after)
  const _afterKeys = afterKeys.map((key) => key.split(";")[0] ?? "")

  const mappedIndex = new Set(afterKeys.keys())

  for (let i = 0; i < beforeKeys.length; i++) {
    const _afterIndex = _afterKeys.findIndex((key) => {
      const [afterType, afterSubType] = key.split("/")
      const [beforeType, beforeSubType] = _beforeKeys[i].split("/")

      if (afterType !== beforeType && afterType !== "*" && beforeType !== "*") {
        return false
      }
      if (
        afterSubType !== beforeSubType &&
        afterSubType !== "*" &&
        beforeSubType !== "*"
      ) {
        return false
      }
      return true
    })

    if (_afterIndex < 0 || !mappedIndex.has(_afterIndex)) {
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
