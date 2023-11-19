import type { ComapreOptions, CompareResult } from "../types"
import { jsonSchemaRules } from "./jsonSchema.rules"
import { compare } from "../compare"

export const compareJsonSchema = (before: unknown, after: unknown, options: ComapreOptions = {}): CompareResult => {
 
  // set default options
  const _options = {
    ...options,
    sources: {
      before: options.sources?.before ?? before,
      after: options.sources?.after ?? after,
    },
    rules: options.rules ?? jsonSchemaRules()
  }

  return compare(before, after, _options)
}
