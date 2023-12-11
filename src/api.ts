import type { ComapreOptions, CompareRules } from "./types"
import { jsonSchemaRules } from "./jsonSchema"
import { openapi3Rules } from "./openapi"
import { compare } from "./compare"

export const discoverCompareRules = (data: any): CompareRules => {
  if (typeof data !== "object" || !data) { return jsonSchemaRules() }

  if (/3.+/.test(data?.openapi || "")) return openapi3Rules()
  // if (/2.+/.test(data?.asyncapi || "")) return asyncApi2Rules
  // if (/2.+/.test(data?.swagger || "")) return swagger2Rules
  // if (data?.graphapi) return graphapiRules
  return jsonSchemaRules()
}

export const apiMerge = (before: unknown, after: unknown, options: ComapreOptions) => {
  const rules = options.rules ?? discoverCompareRules(before)

  const { merged } = compare(before, after, { ...options, rules })

  return merged
}

export const apiDiff = (before: unknown, after: unknown, options: ComapreOptions) => {
  const rules = options.rules ?? discoverCompareRules(before)

  const { diffs } = compare(before, after, { ...options, rules })

  return diffs
}

export const apiCompare = (before: unknown, after: unknown, options: ComapreOptions) => {
  const rules = options.rules ?? discoverCompareRules(before)

  return compare(before, after, { ...options, rules })
}
