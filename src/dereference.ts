import { parsePath, typeOf } from "./utils"

export const resolveObjValue = (obj: any, path: string, cache: any = {}) => {
  let value = obj
  cache = new Map(Object.entries(cache))
  for (const key of parsePath(path)) {
    value = typeOf(value) === "array" ? value[+key] : value[key]
    if (value === undefined) {
      break
    }
    value = dereference(value, obj, new Set(), cache)
  }
  return value
}

export const dereference = (value: any, source: any, refs: Set<string>, cache: Map<string, any>): any => {
  if (value.hasOwnProperty("$ref")) {
    const { $ref, ...rest } = value
    if (refs.has($ref)) {
      // TODO: handle circular ref
      value = { $circularRef: $ref }
    }
    const [external, path] = $ref.split("#")

    // resolve external obj 
    if (external) {
      if (!cache.has(external)) {
        return value
      }
      source = cache.get(external)
    }

    value = { ...rest, ...resolveObjValue(source, path) }
    refs.add($ref)
  }
  return value
}
