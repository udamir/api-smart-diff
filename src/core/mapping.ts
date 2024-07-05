import type { MapKeysResult, MappingResolver } from "../types"

export const arrayMappingResolver: MappingResolver<number> = (before, after) => {
  const length = Math.abs(before.length - after.length)
  const arr = Array.from({ length: Math.min(before.length, after.length) }, ((_, i) => i))

  return {
    removed: before.length > after.length ? Array.from({length}, (_, i) => after.length + i) : [],
    added: before.length < after.length ? Array.from({length}, (_, i) => before.length + i) : [],
    mapped: arr.reduce((res, i) => { res[i] = i; return res }, {} as Record<number, number>)
  }
}

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

  afterKeys.forEach((key) => result.added.push(key))

  return result
}

export const caseInsensitiveKeyMappingResolver: MappingResolver<string> = (before, after) => {

  const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }
  const afterKeys = new Set(Object.keys(after).map((k) => k.toLocaleLowerCase()))

  for (const _key of Object.keys(before)) {
    const key = _key.toLocaleLowerCase()
    if (afterKeys.has(key)) {
      result.mapped[key] = key
      afterKeys.delete(key)
    } else {
      result.removed.push(key)
    }
  }

  afterKeys.forEach((key) => result.added.push(key))

  return result
}
