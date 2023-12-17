import type { ComapreOptions, CompareResult, SourceContext } from "../types"
import { graphApiRules } from "./graphapi.rules"
import { compare } from "../compare"
import { graphApiAnnotateHook } from "./graphapi.annotate"

export const compareGraphApi = (before: unknown, after: unknown, options: ComapreOptions = {}, context: SourceContext = {}): CompareResult => {
 
  // set default options
  const _options = {
    ...options,
    rules: options.rules ?? graphApiRules(),
    annotateHook: options.annotateHook ?? graphApiAnnotateHook
  }

  return compare(before, after, _options, context)
}
