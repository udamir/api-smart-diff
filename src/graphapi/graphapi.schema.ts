import { syncClone } from "json-crawl"

import { graphApiSchemaAnnotate } from "./graphapi.annotate"
import { reverseClassifyRule } from "../openapi"
import type { CompareRules } from "../types"
import { isObject } from "../utils"

export const graphApiSchemaRules = (rules: CompareRules, response = false): CompareRules => {
  return syncClone(rules, ({ value }) => {
    if (typeof value === "function") {
      return { value: (...args: unknown[]) => graphApiSchemaRules(value(...args), response) }
    } else if (!Array.isArray(value) && isObject(value)) {
      const _value = { ...value } as CompareRules
      // reverse classify rules
      if (response && "$" in _value && Array.isArray(_value.$)) {
        _value.$ = reverseClassifyRule(_value.$)
      }
      // convert annotations
      if ("annotate" in _value && _value.annotate) {
        _value.annotate = graphApiSchemaAnnotate(_value.annotate)
      }

      return { value: _value }
    }
  })
}
