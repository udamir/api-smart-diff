import type { ComapreOptions, CompareResult, SourceContext } from "../types"
import { openapi3Rules } from "./openapi3.rules"
import { compare } from "../compare"

export const compareOpenApi = (before: unknown, after: unknown, options: ComapreOptions = {}, context: SourceContext = {}): CompareResult => {
 
  // set default options
  const _options = {
    ...options,
    rules: options.rules ?? openapi3Rules
  }

  return compare(before, after, _options)
}
