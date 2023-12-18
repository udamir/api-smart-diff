import { syncClone } from "json-crawl"

import type { ClassifyRule, ClassifyRuleTransformer, ComapreContext, CompareRules, CompareRulesTransformer, DiffType, DiffTypeClassifier } from "../types"
import { breaking, nonBreaking } from "../core/constants"
import { isFunc, isObject, isString } from "./guards"

export const transformComapreRules = (rules: CompareRules, tranformer: CompareRulesTransformer): CompareRules => {
  return syncClone(rules, ({ value, key }) => {
    if (key && (!isString(key) || !key.startsWith("/"))) { return } 
    if (typeof value === "function") {
      return { value: (...args: unknown[]) => transformComapreRules(value(...args), tranformer) }
    } else if (!Array.isArray(value) && isObject(value)) {
      return { value: tranformer(value as CompareRules) }
    }
  })
}

export const reverseClassifyRuleTransformer: CompareRulesTransformer = (value) => {
  // reverse classify rules
  if ("$" in value && Array.isArray(value.$)) {
    return { ...value, $: reverseClassifyRule(value.$) }
  }

  return value
}


const reverseDiffType = (diffType: DiffType | DiffTypeClassifier): DiffType | DiffTypeClassifier => {
  if (typeof diffType === "function") {
    return ((ctx: ComapreContext) => reverseDiffType(diffType(ctx))) as DiffTypeClassifier
  } else {
    switch (diffType) {
      case breaking: return nonBreaking
      case nonBreaking: return breaking
      default: return diffType
    }
  }
}

export const reverseClassifyRule = ([add, remove, replace]: ClassifyRule): ClassifyRule => {
  return [
    reverseDiffType(add),
    reverseDiffType(remove),
    reverseDiffType(replace),
  ]
}

export const transformClassifyRule = ([add, remove, replace]: ClassifyRule, transformer: ClassifyRuleTransformer): ClassifyRule => {
  return [
    (ctx) => transformer(isFunc(add) ? add(ctx) : add, ctx, "add"),
    (ctx) => transformer(isFunc(remove) ? remove(ctx) : remove, ctx, "remove"),
    (ctx) => transformer(isFunc(replace) ? replace(ctx) : replace, ctx, "replace"),
  ]
}
