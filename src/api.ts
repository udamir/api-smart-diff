import type { ComapreOptions, CompareEngine } from "./types"
import { compareJsonSchema } from "./jsonSchema"
import { compareGraphApi } from "./graphapi"
import { compareOpenApi } from "./openapi"

export const discoverCompareEngine = (data: any): CompareEngine => {
  if (typeof data !== "object" || !data) { return compareJsonSchema }

  if (/3.+/.test(data.openapi ?? "")) return compareOpenApi
  // if (/2.+/.test(data?.asyncapi || "")) return asyncApi2Rules
  // if (/2.+/.test(data?.swagger || "")) return swagger2Rules
  if (data?.graphapi) return compareGraphApi
  return compareJsonSchema
}

// !Deprecated
export const apiMerge = (before: unknown, after: unknown, options: ComapreOptions = {}) => {
  const engine = discoverCompareEngine(before)

  const { merged } = engine(before, after, options)

  return merged
}

// !Deprecated
export const apiDiff = (before: unknown, after: unknown, options: ComapreOptions = {}) => {
  const engine = discoverCompareEngine(before)

  const { diffs } = engine(before, after, options)

  return diffs
}

export const apiCompare = (before: unknown, after: unknown, options: ComapreOptions = {}) => {
  const engine = discoverCompareEngine(before)

  return engine(before, after, options)
}
