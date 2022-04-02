import { breaking, nonBreaking } from "./constants"
import { DiffType, ObjPath } from "./types"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue = (_: any, a: any): DiffType => breakingIf(a)

export const typeOf = (value: any) => {
  if (Array.isArray(value)) {
    return "array"
  }
  return typeof value == null ? "null" : typeof value
}

export const parsePath = (path: string): string[] => {
  const [_, ...pathArr] = path.split("/").map((i) => i.replace(new RegExp("~1", "g"), "/"))
  return pathArr
}

export const buildPath = (path: ObjPath): string => {
  return "/" + path.map((i) => String(i).replace(new RegExp("/", "g"), "~1")).join("/")
}

export const findExternalRefs = (source: any | any[]): string[] => {
  if (typeof source !== "object") {
    return []
  }
  let refs: Set<string> = new Set()
  if (typeOf(source) === "array") {
    for (const item of source) {
      if (typeof item === "object") {
        refs = new Set([...refs, ...findExternalRefs(item)])
      }
    }
  } else {
    for (const key of Object.keys(source)) {
      if (key === "$ref") {
        const [external] = source[key].split("#")
        external && refs.add(external)
      } else {
        if (typeof source[key] === "object") {
          refs = new Set([...refs, ...findExternalRefs(source[key])])
        }
      }
    }
  }
  return [...refs]
}