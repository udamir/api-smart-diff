import type { CompareExtensionRules, CompareOptions } from "../types"

export type AsyncApiRulesOptions = {
  // version?: "2.x" | "3.x"
  notMergeAllOf?: boolean
  // custom prefix rules for specification extensions (`x-*`), merged key-wise over the built-in `x-` rule
  extensions?: CompareExtensionRules
}

export type AsyncApiSchemaRulesOptions = AsyncApiRulesOptions & {
  response?: boolean
}

export type AsyncApiCompareOptions = CompareOptions & AsyncApiRulesOptions
