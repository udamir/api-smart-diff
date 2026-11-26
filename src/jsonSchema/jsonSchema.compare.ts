import type { JsonSchemaCompareOptions, JsonSchemaDraft } from "./jsonSchema.types"
import { jsonSchemaAnnotationHook } from "./jsonSchema.annotate"
import type { CompareResult, CompareRules, SourceContext } from "../types"
import { jsonSchemaRules } from "./jsonSchema.rules"
import { compare, withDefaults } from "../core"
import { getStringValue } from "../utils"
import { SCHEMA_KIND } from "./jsonSchema.utils"

const draftOrder: JsonSchemaDraft[] = ["draft-04", "draft-06", "draft-07", "2020-12"]

const draftOf = (document: unknown): JsonSchemaDraft | undefined => {
  const $schema = getStringValue(document, "$schema") ?? ""
  if (/draft-04/.test($schema)) {
    return "draft-04"
  }
  if (/draft-06/.test($schema)) {
    return "draft-06"
  }
  if (/draft-07/.test($schema)) {
    return "draft-07"
  }
  return $schema ? "2020-12" : undefined
}

/**
 * Schema dialect declared by `$schema` (draft-04 / draft-06 / draft-07), 2020-12 when absent or newer; of two documents
 * with different dialects the later one, so that both sides are read in the later draft (POLICY-28 decided (b)).
 */
export const detectJsonSchemaDraft = (...documents: unknown[]): JsonSchemaDraft => {
  let result: JsonSchemaDraft | undefined
  for (const document of documents) {
    const draft = draftOf(document)
    if (draft && (!result || draftOrder.indexOf(draft) > draftOrder.indexOf(result))) {
      result = draft
    }
  }
  return result ?? "2020-12"
}

// the document is a schema: its root is marked (a new object, so the nested schema rules, which spread the rule set,
// do not carry the mark; ISSUE-300)
const schemaRoot = (rules: CompareRules): CompareRules => ({ ...rules, kind: SCHEMA_KIND })

// built-in rule trees per (draft, notMergeAllOf), shared by every comparison with the same configuration
const rulesCache = new Map<string, CompareRules>()

const builtInRules = (version: JsonSchemaDraft, notMergeAllOf: boolean | undefined): CompareRules => {
  const key = `${version}|${!!notMergeAllOf}`
  let rules = rulesCache.get(key)
  if (!rules) {
    rules = schemaRoot(jsonSchemaRules({ notMergeAllOf, version }))
    rulesCache.set(key, rules)
  }
  return rules
}

export const compareJsonSchema = (
  before: unknown,
  after: unknown,
  options: JsonSchemaCompareOptions = {},
  context: SourceContext = {},
): CompareResult => {
  const version = options.version ?? detectJsonSchemaDraft(before, after)

  // set default options
  const rules =
    options.rules ??
    (options.extensions
      ? schemaRoot(jsonSchemaRules({ notMergeAllOf: options.notMergeAllOf, version, extensions: options.extensions }))
      : builtInRules(version, options.notMergeAllOf))
  const _options = withDefaults(options, rules, options.annotateHook ?? jsonSchemaAnnotationHook)

  return compare(before, after, _options, context)
}
