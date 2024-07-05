import { compare } from "../core"
import type { CompareResult, SourceContext } from "../types"
import type { AsyncApiComapreOptions } from "./asyncapi.types"
import { getAsyncApiVersion } from "./asyncapi.utils"
import { asyncApi2Rules } from "./asyncapi2.rules"

export const compareAsyncApi = (
  before: unknown,
  after: unknown,
  options: AsyncApiComapreOptions = {},
  context: SourceContext = {},
): CompareResult => {
  // const { notMergeAllOf } = options

  const version = getAsyncApiVersion(before, after)

  if (version !== "2.x") {
    throw new Error(`Unsupported version: ${version}`)
  }

  // set default options
  const _options = {
    ...options,
    rules: options.rules ?? asyncApi2Rules(),
    // annotateHook: options.annotateHook ?? openApi3AnnotateHook
  }

  return compare(before, after, _options, context)
}
