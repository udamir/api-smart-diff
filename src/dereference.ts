import { resolveObjValue } from "./utils"

export const dereference = (value: any, source: any, refs: Set<string>, cache: Map<string, any>): any => {
  if (value.hasOwnProperty("$ref")) {
    const ref = value["$ref"]
    if (refs.has(ref)) {
      // TODO: handle circular ref
      value = { $circularRef: ref }
    }
    const [external, path] = ref.split("#")

    // resolve external obj 
    if (external && cache.has(external)) {
      source = cache.get(external)
    }

    value = resolveObjValue(source, path)
    refs.add(ref)
  }
  return value
}
