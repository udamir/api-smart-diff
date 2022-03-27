import { typeOf } from "./utils"

export const dereference = (ref: string, obj: any, cache: Map<string, any>): any => {
  // try to find ref in cache
  if (cache.has(ref)) {
    return cache.get(ref)
  }

  const [external, path] = ref.split("#")

  // resolve external obj 
  if (external && cache.has(external)) {
    obj = cache.get(external)
  }

  const [_, ...pathArr] = path.split("/")
  let _obj = obj

  for (const key of pathArr) {
    if (typeOf(_obj) === "array") {
      _obj = _obj[+key]
    } else {
      _obj = _obj[key]
    }
  }

  cache.set(ref, _obj)

  return _obj
}
