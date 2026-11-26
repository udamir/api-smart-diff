import type { OpenApiCompareOptions, OpenApiVersion } from "./openapi3.types"
import type { CompareResult, CompareRules, SourceContext } from "../types"
import { openApi3AnnotateHook } from "./openapi3.annotate"
import { getMaxOpenApiVersion } from "./openapi3.utils"
import { openapi3Rules } from "./openapi3.rules"
import { openApiProfile } from "./openapi3.profile"
import { compare } from "../core"

// built-in rule trees per (version, notMergeAllOf): rule objects are immutable, so a tree (and the memoized rule
// resolution of its nodes) is shared by every comparison with the same configuration; custom `extensions` build their
// own tree
const rulesCache = new Map<string, CompareRules>()

const builtInRules = (version: OpenApiVersion, notMergeAllOf: boolean | undefined): CompareRules => {
  const key = `${version}|${!!notMergeAllOf}`
  let rules = rulesCache.get(key)
  if (!rules) {
    rules = openapi3Rules({ notMergeAllOf, profile: openApiProfile(version) })
    rulesCache.set(key, rules)
  }
  return rules
}

export const compareOpenApi = (
  before: unknown,
  after: unknown,
  options: OpenApiCompareOptions = {},
  context: SourceContext = {},
): CompareResult => {
  const { notMergeAllOf, extensions } = options
  // cross-version comparison uses the profile of the higher version (DESIGN_PROPOSALS §7.3)
  const version = getMaxOpenApiVersion(before, after)
  const profile = openApiProfile(version)

  // set default options
  const rules =
    options.rules ??
    (extensions ? openapi3Rules({ notMergeAllOf, profile, extensions }) : builtInRules(version, notMergeAllOf))
  const annotateHook = options.annotateHook ?? openApi3AnnotateHook
  // a literal of one shape extended with the caller's options (see `withDefaults`)
  const _options = Object.assign({ rules, version, annotateHook }, options)
  _options.rules = rules
  _options.version = version
  _options.annotateHook = annotateHook

  return compare(before, after, _options, context)
}
