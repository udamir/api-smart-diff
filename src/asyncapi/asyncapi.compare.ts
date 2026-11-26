import type { AsyncApiCompareOptions } from "./asyncapi.types"
import type { CompareResult, CompareRules, SourceContext } from "../types"
import { getAsyncApiVersion } from "./asyncapi.utils"
import { asyncApi2Rules } from "./asyncapi2.rules"
import { asyncApi3Rules } from "./asyncapi3.rules"
import { asyncApiAnnotateHook } from "./asyncapi.annotate"
import { compare, UnsupportedSpecError, withDefaults } from "../core"
import { isObject } from "../utils"

const versionOf = (document: unknown) => (isObject(document) ? String(document.asyncapi) : undefined)

// built-in rule trees per (major version, notMergeAllOf), shared by every comparison with the same configuration
const rulesCache = new Map<string, CompareRules>()

const builtInRules = (version: "2.x" | "3.x", notMergeAllOf: boolean | undefined): CompareRules => {
  const key = `${version}|${!!notMergeAllOf}`
  let rules = rulesCache.get(key)
  if (!rules) {
    rules = version === "3.x" ? asyncApi3Rules({ notMergeAllOf }) : asyncApi2Rules({ notMergeAllOf })
    rulesCache.set(key, rules)
  }
  return rules
}

export const compareAsyncApi = (
  before: unknown,
  after: unknown,
  options: AsyncApiCompareOptions = {},
  context: SourceContext = {},
): CompareResult => {
  const { notMergeAllOf, extensions } = options

  const version = getAsyncApiVersion(before, after)

  // 2.x and 3.x have their own profiles; a 2 <-> 3 comparison is not supported (DESIGN_PROPOSALS §11.7)
  if (version !== "2.x" && version !== "3.x") {
    throw new UnsupportedSpecError(`Unsupported version: ${version}`, versionOf(before), versionOf(after))
  }

  // set default options
  const rules =
    options.rules ??
    (!extensions
      ? builtInRules(version, notMergeAllOf)
      : version === "3.x"
        ? asyncApi3Rules({ notMergeAllOf, extensions })
        : asyncApi2Rules({ notMergeAllOf, extensions }))
  const annotateHook = options.annotateHook ?? asyncApiAnnotateHook
  const _options = withDefaults(options, rules, annotateHook)

  return compare(before, after, _options, context)
}
