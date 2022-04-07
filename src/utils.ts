import { Rule, RulesMeta, MatchFunc, Rules, DiffType, ObjPath } from "./types"
import { breaking, nonBreaking, RuleMetaKey } from "./constants"

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

export const getRules = (rules: Rules, path: ObjPath, source: any): Rules | Rule | undefined => {
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

export const getPathRuleMeta = (rules: Rules, path: ObjPath, source: any): RulesMeta | undefined => {
  const _rules = getRules(rules, path, source)

  if (_rules && !Array.isArray(_rules) && RuleMetaKey in _rules) {
    return _rules[RuleMetaKey]
  }

  return undefined
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

export const enumRules = (rules: Rules, matchItemsFunc: MatchFunc): Rules => {
  rules[RuleMetaKey] = { matchItemsFunc }
  return rules
}

export const objArray = (key: string, rules: Rules): Rules => {
  rules[RuleMetaKey] = { matchItemsFunc: (b, a) => a[key] === b[key] }
  return rules
}

export const mapRules = (rules: Rules, matchKeysFunc: MatchFunc): Rules => {
  rules[RuleMetaKey] = { matchKeysFunc }
  return rules
}
