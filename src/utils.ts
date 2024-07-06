import type { JsonPath } from "json-crawl"

export const isKey = <T extends object>(x: T, k: PropertyKey): k is keyof T => {
  return k in x
}

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

export const isArray = (value: unknown): value is Array<unknown> => {
  return Array.isArray(value)
}

export const isNotEmptyArray = (value: unknown): boolean => {
  return !!(Array.isArray(value) && value.length)
}

export const isExist = (value: unknown): boolean => {
  return typeof value !== "undefined"
}

export const isString = (value: unknown): value is string => {
  return typeof value === "string"
}

export const isNumber = (value: unknown): value is number => {
  return typeof value === "number" || (isString(value) && !Number.isNaN(+value))
}

export const isFunc = (value: unknown): value is Function => {
  return typeof value === "function"
}

export const typeOf = (value: unknown): string => {
  if (Array.isArray(value)) {
    return "array"
  }
  return value == null ? "null" : typeof value
}

export const objectKeys = <T extends {}>(value: T): (keyof T)[] => {
  return Object.keys(value) as (keyof T)[]
}

export const setKeyValue = (
  obj: Record<string | number, unknown>,
  key: string | number,
  value: unknown,
): Record<string | number, unknown> => {
  obj[key] = value
  return obj
}

export const filterObj = <T extends {}>(
  value: T,
  func: (key: number | string | symbol, obj: T) => boolean,
): Partial<T> => {
  const result: Partial<T> = {}
  for (const key of objectKeys(value)) {
    if (!func(key, value)) {
      continue
    }
    result[key] = value[key]
  }
  return result
}

export const excludeKeys = <T extends {}>(value: T, keys: Array<keyof T>): Partial<T> => {
  const excluded: Partial<T> = {}
  for (const key of keys) {
    if (key in value) {
      excluded[key] = value[key]
      delete value[key]
    }
  }
  return excluded
}

export const getKeyValue = (obj: unknown, ...path: JsonPath): unknown | undefined => {
  let value: unknown = obj
  for (const key of path) {
    if (Array.isArray(value) && typeof +key === "number" && value.length < +key) {
      value = value[+key]
    } else if (isObject(value) && key in value) {
      value = value[key]
    } else {
      return
    }
    if (value === undefined) {
      return
    }
  }
  return value
}

export const getStringValue = (obj: unknown, ...path: JsonPath): string | undefined => {
  const value = getKeyValue(obj, ...path)
  return typeof value === "string" ? value : undefined
}

export const getObjectValue = (obj: unknown, ...path: JsonPath): Record<string | number, unknown> | undefined => {
  const value = getKeyValue(obj, ...path)
  return isObject(value) ? value : undefined
}

export const getArrayValue = (obj: unknown, ...path: JsonPath): Array<unknown> | undefined => {
  const value = getKeyValue(obj, ...path)
  return Array.isArray(value) ? value : undefined
}

export const getNumberValue = (obj: unknown, ...path: JsonPath): number | undefined => {
  const value = getKeyValue(obj, ...path)
  return typeof value === "number" ? value : typeof value === "string" && +value ? +value : undefined
}

export const getBooleanValue = (obj: unknown, ...path: JsonPath): boolean | undefined => {
  const value = getKeyValue(obj, ...path)
  return typeof value === "boolean"
    ? value
    : typeof value === "string" && (value === "true" || value === "false")
      ? Boolean(value)
      : undefined
}

export const joinPath = (base: JsonPath, ...items: JsonPath[]): JsonPath => {
  const result = [...base]
  for (const item of items) {
    for (const step of item) {
      if (step === "") {
        result.pop()
      } else {
        result.push(step)
      }
    }
  }
  return result
}
