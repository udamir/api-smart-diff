import type { ComapreOptions, CompareResult, SourceContext } from "../types"
import { jsonSchemaDiffFormat } from "./jsonSchema.format"
import { jsonSchemaRules } from "./jsonSchema.rules"
import { compare } from "../compare"

export const compareJsonSchema = (before: unknown, after: unknown, options: ComapreOptions = {}, context: SourceContext = {}): CompareResult => {
 
  // set default options
  const _options = {
    ...options,
    rules: options.rules ?? jsonSchemaRules(),
    formatDiffFunc: options.formatDiffFunc ?? jsonSchemaDiffFormat
  }

  return compare(before, after, _options, context)
}
