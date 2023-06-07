export interface JsonMapTreeCrawlContext {
  index: number
  path: ObjPath
  source: any
}

export type JsonMapTreeRule<T> = T extends Function ? never : T;

// export type MatchRule = (ctx: MatchContext) => boolean

export type ObjPath = Array<string | number>
export type JsonMapTreeRuleFunc<T> = (ctx: JsonMapTreeCrawlContext) => JsonMapTreeRule<T>
export type JsonMapTreeRulesFunc<T> = (ctx: JsonMapTreeCrawlContext) => JsonMapTreeRules<T>

export type JsonMapTreeRules<T> = {
  [key: `/${string}` | "/"]: JsonMapTreeRule<T> | JsonMapTreeRuleFunc<T>  | JsonMapTreeRules<T> | JsonMapTreeRulesFunc<T>
}

export const findPathRules = <T>(
  rules: JsonMapTreeRules<T>,
  path: ObjPath,
  source: any
): JsonMapTreeRules<T> | T | undefined => {
  let _rules = rules
  for (let index = 0; index < path.length; index++) {
    let key = path[index]
  
    if (index === path.length) {
      key = ""
    } else if (!(`/${key}` in rules) || typeof key === "number") {
      key = "*"
    }
  
    if (`/${key}` in rules) {
      const rule = rules[`/${key}`] as any

      _rules = typeof rule === "function" ? rule({ source, index, path }) : rule
    } else {
      return
    }

    if (!_rules) {
      return
    }
  }

  return _rules
}
