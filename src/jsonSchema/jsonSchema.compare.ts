import type { JsonSchemaCompareOptions } from "./jsonSchema.types"
import type { CompareResult, SourceContext } from "../types"
import { jsonSchemaRules } from "./jsonSchema.rules"
import { compare } from "../compare"

export const compareJsonSchema = (before: unknown, after: unknown, options: JsonSchemaCompareOptions = {}, context: SourceContext = {}): CompareResult => {
 
  // set default options
  const _options = {
    ...options,
    rules: options.rules ?? jsonSchemaRules({ notMergeAllOf: options.notMergeAllOf }),
  }

  return compare(before, after, _options, context)
}
