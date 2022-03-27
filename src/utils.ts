import { DiffPath } from "./types"

export const typeOf = (value: any) => {
  if (Array.isArray(value)) {
    return "array"
  }
  return typeof value == null ? "null" : typeof value
}

export const resolveObjValue = (obj: any, path: string) => {
  let value = obj
  for (const key of parsePath(path)) {
    value = typeOf(value) === "array" ? value[+key] : value[key]
    if (value === undefined) {
      break
    }
  }
  return value
}

export const parsePath = (path: string): string[] => {
  const [_, ...pathArr] = path.split("/")
  return pathArr
}

export const buildPath = (path: DiffPath): string => {
  return "/" + path.join("/")
}
