import { syncClone } from "json-crawl"

import type { ClassifyRule, ComapreContext, CompareRules, DiffType, DiffTypeClassifier } from "../types"
import { openApiSchemaAnnotate } from "./openapi3.annotate"
import { breaking, nonBreaking } from "../constants"
import { isObject } from "../utils"

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

const reverseClassifyRule = ([add, remove, replace]: ClassifyRule): ClassifyRule => {
  return [reverseDiffType(add), reverseDiffType(remove), reverseDiffType(replace)]
}

export const openApiSchemaRules = (rules: CompareRules, response = false): CompareRules => {
  return syncClone(rules, ({ value }) => {
    if (typeof value === "function") {
      return { value: (...args: unknown[]) => openApiSchemaRules(value(...args), response) }
    } else if (!Array.isArray(value) && isObject(value)) {
      const _value = { ...value } as CompareRules
      // reverse classify rules
      if (response && "$" in _value && Array.isArray(_value.$)) {
        _value.$ = reverseClassifyRule(_value.$)
      }
      // convert annotations
      if ("annotate" in _value && _value.annotate) {
        _value.annotate = openApiSchemaAnnotate(_value.annotate)
      }

      return { value: _value }
    }
  })
}
