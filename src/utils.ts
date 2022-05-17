import { Rule, MatchFunc, Rules, DiffType, ObjPath, DiffTypeFunc } from "./types"
import { breaking, nonBreaking, DiffAction } from "./constants"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue: DiffTypeFunc = ({ after }): DiffType => breakingIf(after)

export const added = (path: ObjPath, after: any) => ({ path, after, action: DiffAction.add })
export const removed = (path: ObjPath, before: any) => ({ path, before, action: DiffAction.remove })
export const replaced = (path: ObjPath, before: any, after: any) => ({ path, before, after, action: DiffAction.replace })
export const renamed = (path: ObjPath, before: any, after: any) => ({ path, before, after, action: DiffAction.rename })
export const unchanged = (path: ObjPath, before: any) => ({ path, before, action: DiffAction.test })

export const isEmptyObject = (obj:any) => {
  for (const key in obj)
    return false
  return true
}

export const typeOf = (value: any) => {
  if (Array.isArray(value)) {
    return "array"
  }
  return value == null ? "null" : typeof value
}

export const parsePath = (path: string): string[] => {
  const [_, ...pathArr] = path.split("/").map((i) => i.replace(new RegExp("~1", "g"), "/"))
  return pathArr
}

export const buildPath = (path: ObjPath): string => {
  return "/" + path.map((i) => String(i).replace(new RegExp("/", "g"), "~1")).join("/")
}

export const getPathRules = (rules: Rules, path: ObjPath, source: any): Rules | Rule | undefined => {
  let _rules = rules
  let value = source
  for (let key of [...path]) {
    value = (key !== undefined && value !== undefined) ? value[key] : undefined
    // check if rules dont have key of key is array index
    if (!_rules.hasOwnProperty(`/${key}`) || typeof key === "number") {
      key = "*"
    }

    // check if rules have key
    if (_rules.hasOwnProperty(`/${key}`)) {
      const rule = _rules[`/${key}`]
      if (Array.isArray(rule)) {
        return rule
      }
      _rules = typeof rule === "function" ? rule(value) : rule
    } else {
      return undefined
    }
  }
  return _rules
}

export const getPathMatchFunc = (rules: Rules, path: ObjPath, source: any): MatchFunc | undefined => {
  const _rules = getPathRules(rules, path, source)
  return (_rules && !Array.isArray(_rules)) ? _rules["#"] : undefined
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

export const matchRule = (rules: Rules, matchFunc: MatchFunc): Rules => {
  rules["#"] = matchFunc
  return rules
}

export const objArray = (key: string, rules: Rules): Rules => {
  return matchRule(rules, ({ before, after }) => after.value[key] === before.value[key])
}

export const resolveRef = (val: any, source: any, cache: any) => {
  const { $ref, ...rest } = val
  if ($ref) {
    const [external, path] = $ref.split("#")
    if (external && !cache.has(external)) { return val }
    const value = getValueByPath(external ? cache.get(external) : source, parsePath(path))
    return !isEmptyObject(rest) ? mergeValues(value, rest) : value
  } else {
    return val
  }
}

export const getValueByPath = (obj: any, objPath: ObjPath) => {
  let value = obj
  for (const key of objPath) {
    value = typeOf(value) === "array" ? value[+key] : value[key]
    if (value === undefined) {
      break
    }
  }
  return value
}

export const setValueByPath = (obj: any, objPath: ObjPath, value: any, i = 0) => {
  if (i >= objPath.length) { return }
  
  const key = objPath[i]
  if (typeof obj[key] !== "object") {
    obj[key] = {}
  }

  if (i === objPath.length - 1) {
    obj[key] = value
  } else {
    setValueByPath(obj[key], objPath, value, i + 1)
  }
}

export const mergeValues = (value: any, patch: any) => {
  if (Array.isArray(value)) {
    return Array.isArray(patch) ? value.push(...patch) : value
  } else if (typeof value === "object" && typeof patch === "object") {
    for(const key of Reflect.ownKeys(patch)) {
      value[key] = mergeValues(value[key], patch[key])
    }
    return value
  } else {
    return patch
  }
}
