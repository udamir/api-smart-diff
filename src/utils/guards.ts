export const isKey = <T extends object>(x: T, k: PropertyKey): k is keyof T => {
  return k in x;
}

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
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
  return typeof value === "number" || isString(value) && !Number.isNaN(+value)
}

export const isFunc = (value: unknown): value is Function => {
  return typeof value === "function"
}
