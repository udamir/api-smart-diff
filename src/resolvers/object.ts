import { MapKeysResult } from "../rules/types"

export const mapObjectKeysRule = (before: object, after: object): MapKeysResult<string> => {

  const result: MapKeysResult<string> = {
    value: {},
    added: [],
    removed: [],
    mapped: {}
  }

  const afterKeys = new Set(Object.keys(after))

  for (const key of Object.keys(before)) {
    if (afterKeys.has(key)) {
      result.mapped[key] = key
      result.value![key] = (before as any)[key]
      afterKeys.delete(key)
    } else {
      result.removed.push(key)
    }
  }

  afterKeys.forEach((key) => result.added.push(key))

  return result
}
