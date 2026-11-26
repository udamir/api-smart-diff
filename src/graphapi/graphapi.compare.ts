import type { CompareOptions, CompareResult, CompareRules, SourceContext } from "../types"
import { graphApiAnnotateHook } from "./graphapi.annotate"
import { graphApiRules } from "./graphapi.rules"
import { graphApi10Rules } from "./graphapi10.rules"
import { compare, UnsupportedSpecError, withDefaults } from "../core"
import { getStringValue, isObject } from "../utils"

export type GraphApiVersion = "0.1.2" | "1.0"

/** GraphApi document version from the `graphapi` field (0.1.2 when absent). */
export const getGraphApiVersion = (document: unknown): GraphApiVersion | undefined => {
  if (!isObject(document)) {
    return
  }
  const version = getStringValue(document, "graphapi")
  if (version === undefined || version.startsWith("0.")) {
    return "0.1.2"
  }
  if (version === "1.0" || version.startsWith("1.")) {
    return "1.0"
  }
  return
}

// built-in rule trees per encoding, shared by every comparison
const rulesCache = new Map<GraphApiVersion, CompareRules>()

const builtInRules = (version: GraphApiVersion): CompareRules => {
  let rules = rulesCache.get(version)
  if (!rules) {
    rules = version === "1.0" ? graphApi10Rules() : graphApiRules()
    rulesCache.set(version, rules)
  }
  return rules
}

export const compareGraphApi = (
  before: unknown,
  after: unknown,
  options: CompareOptions = {},
  context: SourceContext = {},
): CompareResult => {
  const bVersion = getGraphApiVersion(before)
  const aVersion = getGraphApiVersion(after)

  if (!bVersion || !aVersion) {
    throw new UnsupportedSpecError("Unsupported GraphApi version", String(bVersion), String(aVersion))
  }
  if (bVersion !== aVersion) {
    throw new UnsupportedSpecError(`Cannot compare GraphApi ${bVersion} with GraphApi ${aVersion}`, bVersion, aVersion)
  }

  // set default options
  const _options = withDefaults(
    options,
    options.rules ?? builtInRules(bVersion),
    options.annotateHook ?? graphApiAnnotateHook,
  )

  return compare(before, after, _options, context)
}
