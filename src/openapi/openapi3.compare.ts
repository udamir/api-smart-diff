import type { ComapreOptions, CompareResult } from "../types"
import { openapi3Rules } from "./openapi3.rules"
import { compare } from "../compare"

export const compareOpenApi = (before: unknown, after: unknown, options: ComapreOptions = {}): CompareResult => {
 
  // set default options
  const _options = {
    ...options,
    sources: {
      before: options.sources?.before ?? before,
      after: options.sources?.after ?? after,
    },
    rules: options.rules ?? openapi3Rules
  }

  return compare(before, after, _options)
}
