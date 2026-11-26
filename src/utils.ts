import type { JsonPath } from "json-crawl"

export const isKey = <T extends object>(x: T, k: PropertyKey): k is keyof T => {
  return k in x
}

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
  return typeof value === "number" || (isString(value) && value.trim() !== "" && !Number.isNaN(+value))
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

/** `getKeyValue(obj, key)` for a single key, without the rest-parameter array (hot path of the compare walk). */
export const getChildValue = (obj: unknown, key: string | number): unknown | undefined => {
  if (Array.isArray(obj)) {
    const index = typeof key === "number" ? key : isNumber(key) ? +key : Number.NaN
    return Number.isInteger(index) && index >= 0 && index < obj.length ? obj[index] : undefined
  }
  // one keyed load (`key in obj` before it doubled the cost of every child lookup; an absent key reads `undefined`)
  return typeof obj === "object" && obj !== null ? (obj as Record<string | number, unknown>)[key] : undefined
}

export const getKeyValue = (obj: unknown, ...path: JsonPath): unknown | undefined => {
  let value: unknown = obj
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    if (Array.isArray(value)) {
      const index = typeof key === "number" ? key : isNumber(key) ? +key : Number.NaN
      if (!Number.isInteger(index) || index < 0 || index >= value.length) {
        return
      }
      value = value[index]
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
  if (typeof value === "number") {
    return value
  }
  return isString(value) && isNumber(value) ? +value : undefined
}

export const getBooleanValue = (obj: unknown, ...path: JsonPath): boolean | undefined => {
  const value = getKeyValue(obj, ...path)
  if (typeof value === "boolean") {
    return value
  }
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  return
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

// the keys of an array besides its items: merge meta (`arrayMeta: true` writes it on the array, under a string or a
// symbol key) must survive the copy
const copyArrayExtras = (value: unknown[], result: unknown[], copy: (item: object) => unknown): void => {
  const symbols = Object.getOwnPropertySymbols(value)
  for (let i = 0; i < symbols.length; i++) {
    const item = (value as unknown as Record<symbol, unknown>)[symbols[i]]
    ;(result as unknown as Record<symbol, unknown>)[symbols[i]] =
      typeof item === "object" && item !== null ? copy(item) : item
  }
  // a dense array without other keys lists exactly its indexes
  const keys = Object.keys(value)
  if (keys.length === value.length) {
    return
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (String(Number(key) >>> 0) === key && Number(key) < value.length) {
      continue
    }
    const item = (value as unknown as Record<string, unknown>)[key]
    ;(result as unknown as Record<string, unknown>)[key] = typeof item === "object" && item !== null ? copy(item) : item
  }
}

// a copy deeper than this is assumed to be a cyclic graph and redone with identity tracking
const MAX_COPY_DEPTH = 512
const TOO_DEEP = Symbol("too-deep")

const copyTree = (value: object, depth: number): unknown => {
  if (depth > MAX_COPY_DEPTH) {
    throw TOO_DEEP
  }
  if (Array.isArray(value)) {
    const result = new Array(value.length)
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      result[i] = typeof item === "object" && item !== null ? copyTree(item, depth + 1) : item
    }
    copyArrayExtras(value, result, (item) => copyTree(item, depth + 1))
    return result
  }
  const result: Record<string | symbol, unknown> = {}
  const keys = Object.keys(value)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const item = (value as Record<string, unknown>)[key]
    result[key] = typeof item === "object" && item !== null ? copyTree(item, depth + 1) : item
  }
  // symbol keys carry merge meta and must survive the copy
  const symbols = Object.getOwnPropertySymbols(value)
  for (let i = 0; i < symbols.length; i++) {
    const item = (value as Record<symbol, unknown>)[symbols[i]]
    result[symbols[i]] = typeof item === "object" && item !== null ? copyTree(item, depth + 1) : item
  }
  return result
}

/**
 * Deep copy of plain JSON data (objects, arrays, primitives, cyclic graphs); other values are returned as is. A tree
 * is copied without identity tracking; a graph deeper than any real document (a cycle) is copied again with it, so
 * cycles and shared nodes are preserved there.
 */
export const deepCopy = <T>(value: T, copies?: WeakMap<object, unknown>): T => {
  if (!isObject(value)) {
    return value
  }
  if (!copies) {
    try {
      return copyTree(value, 0) as T
    } catch (error) {
      if (error !== TOO_DEEP) {
        throw error
      }
      return deepCopyGraph(value, new WeakMap())
    }
  }
  return deepCopyGraph(value, copies)
}

const deepCopyGraph = <T>(value: T, copies: WeakMap<object, unknown>): T => {
  if (!isObject(value)) {
    return value
  }
  const existing = copies.get(value)
  if (existing) {
    return existing as T
  }
  if (Array.isArray(value)) {
    const result: unknown[] = []
    copies.set(value, result)
    for (const item of value) {
      result.push(deepCopyGraph(item, copies))
    }
    copyArrayExtras(value, result, (item) => deepCopyGraph(item, copies))
    return result as T
  }
  const result: Record<string | symbol, unknown> = {}
  copies.set(value, result)
  // symbol keys carry merge meta and must survive the copy
  for (const key of Reflect.ownKeys(value)) {
    result[key] = deepCopyGraph((value as Record<string | symbol, unknown>)[key], copies)
  }
  return result as T
}
