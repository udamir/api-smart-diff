import { compareAsyncApi } from "./asyncapi"
import { compareGraphApi } from "./graphapi"
import { compareJsonSchema } from "./jsonSchema"
import { compareOpenApi } from "./openapi"
import type { ComapreOptions, CompareEngine } from "./types"
import { isObject, isString } from "./utils"

export const discoverCompareEngine = (data: unknown): CompareEngine => {
  if (!isObject(data)) {
    return compareJsonSchema
  }

  if ("openapi" in data && isString(data.openapi) && /3.+/.test(data.openapi))
    return compareOpenApi
  if (
    "asyncapi" in data &&
    isString(data.asyncapi) &&
    /2.+/.test(data.asyncapi)
  )
    return compareAsyncApi
  // if (/2.+/.test(data?.swagger || "")) return swagger2Rules
  if ("graphapi" in data && data.graphapi) return compareGraphApi
  return compareJsonSchema
}

// !Deprecated
export const apiMerge = (
  before: unknown,
  after: unknown,
  options: ComapreOptions = {},
) => {
  const engine = discoverCompareEngine(before)

  const { merged } = engine(before, after, options)

  return merged
}

// !Deprecated
export const apiDiff = (
  before: unknown,
  after: unknown,
  options: ComapreOptions = {},
) => {
  const engine = discoverCompareEngine(before)

  const { diffs } = engine(before, after, options)

  return diffs
}

export const apiCompare = (
  before: unknown,
  after: unknown,
  options: ComapreOptions = {},
) => {
  const engine = discoverCompareEngine(before)

  return engine(before, after, options)
}
