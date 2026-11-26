import type { CompareResult, CompareRules, SourceContext } from "../types"
import { compare, UnsupportedSpecError, withDefaults } from "../core"
import { isObject } from "../utils"
import { createProtoApiAnnotateHook } from "./protoapi.annotate"
import { PROTOAPI_DEFAULT_COMPATIBILITY, protoApiCompatibilityLevels } from "./protoapi.const"
import { mergeElementDiffs } from "./protoapi.merge"
import { protoApiRules } from "./protoapi.rules"
import { implicitDefaultTransform } from "./protoapi.transform"
import type { ProtoApiCompareOptions, ProtoApiCompatibility, ProtoApiVersion } from "./protoapi.types"

const rawVersion = (document: unknown): string | undefined => {
  if (!isObject(document)) {
    return
  }
  const value = document.protoapi
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined
}

/**
 * ProtoApi format version (major.minor) from the `protoapi` field: `"0.1"` for `0.1` and `0.1.<patch>`; `undefined`
 * for any other value (the engine knows only format 0.1).
 */
export const getProtoApiVersion = (document: unknown): ProtoApiVersion | undefined => {
  const version = rawVersion(document)
  return version !== undefined && /^0\.1(\.\d+)?$/.test(version) ? "0.1" : undefined
}

// built-in rule trees per (compatibility, files): rule objects are immutable, so a tree (and the memoized rule
// resolution of its nodes) is shared by every comparison with the same configuration; custom `optionRules` or
// `extensions` build a tree of their own (PROTOAPI_DESIGN §4.1)
const rulesCache = new Map<string, CompareRules>()

const builtInRules = (compatibility: ProtoApiCompatibility, files: "compare" | "ignore"): CompareRules => {
  const key = `${compatibility}|${files}`
  let rules = rulesCache.get(key)
  if (!rules) {
    rules = protoApiRules({ compatibility, files })
    rulesCache.set(key, rules)
  }
  return rules
}

export const compareProtoApi = (
  before: unknown,
  after: unknown,
  options: ProtoApiCompareOptions = {},
  context: SourceContext = {},
): CompareResult => {
  const bVersion = getProtoApiVersion(before)
  const aVersion = getProtoApiVersion(after)
  if (!bVersion || !aVersion) {
    throw new UnsupportedSpecError(
      `Unsupported ProtoApi version: ${bVersion ? rawVersion(after) : rawVersion(before)}`,
      rawVersion(before),
      rawVersion(after),
    )
  }
  // both documents of a comparison come from one protoapi version (invariant 16); different formats are rejected
  // (AD-11; unreachable while 0.1 is the only format)
  if ((bVersion as string) !== aVersion) {
    throw new UnsupportedSpecError(
      `Cannot compare ProtoApi ${String(bVersion)} with ProtoApi ${String(aVersion)}`,
      bVersion,
      aVersion,
    )
  }

  const { optionRules, extensions } = options
  const compatibility = options.compatibility ?? PROTOAPI_DEFAULT_COMPATIBILITY
  const files = options.files ?? "compare"
  if (!protoApiCompatibilityLevels.includes(compatibility)) {
    throw new TypeError(
      `Invalid ProtoApi compatibility "${String(compatibility)}": expected one of ${protoApiCompatibilityLevels.join(", ")}`,
    )
  }
  if (files !== "compare" && files !== "ignore") {
    throw new TypeError(`Invalid ProtoApi files option "${String(files)}": expected "compare" or "ignore"`)
  }

  const rules =
    options.rules ??
    (optionRules || extensions
      ? protoApiRules({ compatibility, files, optionRules, extensions })
      : builtInRules(compatibility, files))

  // descriptions (R-D, §4.11): the hook reads the walk shadows and the inputs; a custom `annotateHook` replaces it (and
  // the merged records keep the representative's description)
  const describe = options.annotateHook ? undefined : createProtoApiAnnotateHook({ before, after })
  const _options = withDefaults(options, rules, options.annotateHook ?? describe?.hook)

  // the implicit enum defaults (C6) are set on a before shadow ahead of the walk (ISSUE-370); the input stays as given
  const [bShadow] = implicitDefaultTransform(before, after)
  const result = compare(bShadow, after, _options, context)

  // one record per element per cause (A4, PD-16, PD-25, PD-27)
  const diffs = mergeElementDiffs(result.diffs, { before, after }, describe?.describer(result.diffs))
  return diffs === result.diffs ? result : { ...result, diffs }
}
