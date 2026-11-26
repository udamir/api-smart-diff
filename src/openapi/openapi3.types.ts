import type { CompareExtensionRules, CompareOptions } from "../types"
import type { OpenApiProfile } from "./openapi3.profile"

export type OpenApiVersion = "3.0" | "3.1" | "3.2"

export type OpenApi3RulesOptions = {
  // profile version; "3.0.x" / "3.1.x" are accepted for compatibility
  version?: OpenApiVersion | "3.0.x" | "3.1.x"
  // a complete profile (takes precedence over `version`)
  profile?: OpenApiProfile
  notMergeAllOf?: boolean
  // custom prefix rules for specification extensions (`x-*`), merged key-wise over the built-in `x-` rule
  extensions?: CompareExtensionRules
}

export type OpenApi3SchemaRulesOptions = OpenApi3RulesOptions & {
  // kept for compatibility: direction is now carried by the compare scope
  response?: boolean
}

export type OpenApiCompareOptions = CompareOptions & Omit<OpenApi3RulesOptions, "version">
