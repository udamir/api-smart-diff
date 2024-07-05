import { compare } from "../core"
import type { CompareResult, SourceContext } from "../types"
import { jsonSchemaAnnotationHook } from "./jsonSchema.annotate"
import { jsonSchemaRules } from "./jsonSchema.rules"
import type { JsonSchemaCompareOptions } from "./jsonSchema.types"

export const compareJsonSchema = (
  before: unknown,
  after: unknown,
  options: JsonSchemaCompareOptions = {},
  context: SourceContext = {},
): CompareResult => {
  // set default options
  const _options = {
    ...options,
    rules:
      options.rules ??
      jsonSchemaRules({ notMergeAllOf: options.notMergeAllOf }),
    annotateHook: options.annotateHook ?? jsonSchemaAnnotationHook,
  }

  return compare(before, after, _options, context)
}
