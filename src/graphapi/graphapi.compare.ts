import type { CompareOptions, CompareResult, CompareRules, SourceContext } from "../types"
import { graphApiAnnotateHook } from "./graphapi.annotate"
import { graphApiRules } from "./graphapi.rules"
import { compare, UnsupportedSpecError, withDefaults } from "../core"
import { isObject } from "../utils"

/** A GraphApi 1.x version (`graphapi: "1.0"`, written by gqlapi 0.6 and later). */
export const GRAPHAPI_VERSION_PATTERN = /^1(\.\d+)*$/

/** A GraphApi 0.x version (0.1.2, written by gqlapi 0.5 and earlier): no longer supported. */
export const LEGACY_GRAPHAPI_VERSION_PATTERN = /^0\.\d+(\.\d+)*$/

/** The message of the error for a GraphApi 0.x document (`version` absent: a document without a `graphapi` field). */
export const legacyGraphApiMessage = (version?: string) =>
  `GraphApi ${version ?? "0.1.2"} is not supported${version === undefined ? " (the document has no `graphapi` field)" : ""}: convert the GraphQL SDL with gqlapi 0.6 or later, which writes GraphApi 1.0`

const graphApiVersionOf = (document: unknown): string | undefined => {
  const value = isObject(document) ? document.graphapi : undefined
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined
}

/** Throws `UnsupportedSpecError` unless both documents are GraphApi 1.x. */
const assertGraphApi1 = (before: unknown, after: unknown) => {
  const bVersion = graphApiVersionOf(before)
  const aVersion = graphApiVersionOf(after)
  for (const [document, version] of [
    [before, bVersion],
    [after, aVersion],
  ] as const) {
    const absent = isObject(document) && (document.graphapi === undefined || document.graphapi === null)
    if (absent || (version !== undefined && LEGACY_GRAPHAPI_VERSION_PATTERN.test(version))) {
      throw new UnsupportedSpecError(legacyGraphApiMessage(version), bVersion, aVersion)
    }
  }
  if (!bVersion || !aVersion || !GRAPHAPI_VERSION_PATTERN.test(bVersion) || !GRAPHAPI_VERSION_PATTERN.test(aVersion)) {
    throw new UnsupportedSpecError("Unsupported GraphApi version", String(bVersion), String(aVersion))
  }
}

// the built-in rule tree, shared by every comparison
let builtInRules: CompareRules | undefined

/** Compares two GraphApi 1.x documents (GraphApi 0.1.2 documents throw `UnsupportedSpecError`). */
export const compareGraphApi = (
  before: unknown,
  after: unknown,
  options: CompareOptions = {},
  context: SourceContext = {},
): CompareResult => {
  assertGraphApi1(before, after)

  // set default options
  const _options = withDefaults(
    options,
    options.rules ?? (builtInRules ??= graphApiRules()),
    options.annotateHook ?? graphApiAnnotateHook,
  )

  return compare(before, after, _options, context)
}
