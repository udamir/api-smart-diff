import { isObject } from "./crawler";

export interface RefNode {
  $ref: string
  [key: string]: any
}

const pathMask = {
  slash: /\//g,
  tilde: /~/g,
  escapedSlash: /~1/g,
  escapedTilde: /~0/g
}

export const isRefNode = (value: any): value is RefNode => {
  return value && value.$ref && typeof value.$ref === "string"
}

export const mergeValues = (value: any, patch: any) => {
  if (Array.isArray(value) && Array.isArray(patch)) {
    return Array.isArray(patch) ? [...value, ...patch] : [...value]
  } else if (isObject(value) && isObject(patch)) {
    const result = { ...value }
    for(const key of Object.keys(patch)) {
      result[key] = mergeValues(result[key], patch[key])
    }
    return result
  } else {
    return patch
  }
}

export const parseRef = ($ref: string, basePath = "") => {
  const [filePath = basePath, ref] = $ref.split("#")

  const pointer = !ref || ref === "/" ? "" : ref
  const normalized = createRef(filePath, pointer)
  
  return { filePath, pointer, normalized }
}

export const createRef = (basePath?: string, pointer?: string): string => {
  if (!basePath) {
    return !pointer ? "#" : `#${pointer}`
  } else {
    return `${basePath}${!pointer ? "" : "#" + pointer}`
  }
}

export const parsePointer = (pointer: string): string[] => {
  return pointer.split("/").map((i) => i.replace(pathMask.escapedSlash, "/").replace(pathMask.escapedTilde, "~")).slice(1)
}

export const resolveRefNode = (data: any, node: any) => {
  const { $ref, ...rest } = node
  const _ref = parseRef($ref)
  return !_ref.filePath ? resolvePointer(data, _ref.pointer, rest) : undefined
}

const resolvePointer = (data: unknown, pointer: string, sibling?: any): any => {
  if (!isObject(data)) { return }
    
  let value: any = data
  const path = parsePointer(pointer)
  for (const key of path) {
    if (Array.isArray(value) && value.length > +key) {
      value = value[+key]
    } else if (isObject(value) && key in value) {
      value = value[key]
    } else if (isRefNode(value)) {
      value = resolveRefNode(data, value)
    } else {
      return
    }       
  }
  return mergeValues(value, sibling)
}
