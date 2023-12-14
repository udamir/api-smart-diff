import type { TemplateFunc } from "../types"
import { isExist, objectKeys } from "../utils"

export const createTemplateFunc = (dict: Record<string, string>): TemplateFunc => {
  const findKey = (key: string, params: Record<string | number, unknown>) => {

    const keys = objectKeys(dict).filter((k) => k.startsWith(`${key}_`))
    
    for (const _key of keys) {
      const _params = _key.split("_").slice(1)
      // find params
      if (!_params.filter((p) => !isExist(params[p]) || params[p] === "").length) {
        return dict[_key]
      }
    }
    
    if (key in dict) {
      return dict[key]
    }
  }

  return (key, params = {}) => {

    let expr = findKey(key, params)

    if (!expr) { return "" }
    
    for (const match of [...expr.matchAll(/{{(\w+)}}/g)].reverse()) {
      if (!(match[1] in params)) { continue }

      const index = match.index ?? 0
      expr = expr.substring(0, index) + String(params[match[1]]) + expr.substring(index + match[0].length)
    }
    return expr
  }
}
