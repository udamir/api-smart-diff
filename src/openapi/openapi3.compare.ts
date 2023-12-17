import type { OpenApiComapreOptions } from "./openapi3.types"
import type { CompareResult, SourceContext } from "../types"
import { openApi3AnnotateHook } from "./openapi3.annotate"
import { getMaxOpenApiVersion } from "./openapi3.utils"
import { openapi3Rules } from "./openapi3.rules"
import { compare } from "../compare"

export const compareOpenApi = (before: unknown, after: unknown, options: OpenApiComapreOptions = {}, context: SourceContext = {}): CompareResult => {
  const { notMergeAllOf } = options

  // set default options
  const _options = {
    ...options,
    rules: options.rules ?? openapi3Rules({ notMergeAllOf }),
    version: getMaxOpenApiVersion(before, after),
    annotateHook: options.annotateHook ?? openApi3AnnotateHook
  }

  return compare(before, after, _options, context)
}
