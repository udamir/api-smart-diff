import type { CompareExtensionRules, CompareOptions } from "../types"

// The ProtoApi engine reads documents built by the `protoapi` package (format `protoapi: "0.1"`, PROTOAPI_PACKAGE_DESIGN
// §3) but never imports it (runtime dependencies stay `json-crawl` and `allof-merge`): the types below describe only
// what the engine relies on (PROTOAPI_DESIGN §3.2), every other key is open.

/** Supported ProtoApi format version (major.minor of the `protoapi` field). */
export type ProtoApiVersion = "0.1"

/**
 * Compatibility level of a comparison (PROTOAPI_DESIGN §5, U4): the runtime clients and the generated code a change is
 * judged for. Ordered from the strictest to the most lenient; a row's severity never increases along the order.
 */
export type ProtoApiCompatibility = "FILE" | "PACKAGE" | "WIRE_JSON" | "WIRE"

export type ProtoApiRulesOptions = {
  // compatibility level (default "FILE", U4)
  compatibility?: ProtoApiCompatibility
  // classification of file paths and `file` keywords (default "compare"); "ignore" makes them annotations for inputs
  // whose paths carry no meaning (Q17, C4); the file package keeps its class (PD-21)
  files?: "compare" | "ignore"
  // custom rules for option keys (`buf.validate.field`, `mycompany.audit`, prefix keys such as `"/mycompany.*"`),
  // merged key-wise into the `options` node of every element (C3)
  optionRules?: CompareExtensionRules
  // custom rules for `x-*` keys of elements, merged key-wise over the built-in `x-` rule (as for OpenAPI / AsyncAPI)
  extensions?: CompareExtensionRules
}

export type ProtoApiCompareOptions = CompareOptions & Omit<ProtoApiRulesOptions, "extensions">

// minimal document shape (PROTOAPI_DESIGN §3.2): only the keys the engine reads; no index signatures below the root,
// so that the document types of the protoapi package (interfaces with more keys) are assignable

export type ProtoApiFileEntry = {
  syntax?: string
  package?: string
  imports?: string[]
  importFlags?: Record<string, string>
  options?: Record<string, unknown>
  description?: string
  // a bundled file that is not an entry file (U3): contributes referenced declarations only
  bundled?: true
}

export type ProtoApiElement = {
  // path of the declaring file (absent when the document was built with `files: false`)
  file?: string
  title?: string
  description?: string
  deprecation?: { reason?: string }
  options?: Record<string, unknown>
}

export type ProtoApiMethodSide = { schema: { $ref: string }; stream?: true }

export type ProtoApiMethod = ProtoApiElement & {
  request: ProtoApiMethodSide
  response: ProtoApiMethodSide
}

export type ProtoApiService = ProtoApiElement & { methods?: Record<string, ProtoApiMethod> }

export type ProtoApiDocument = {
  protoapi: string
  files?: Record<string, ProtoApiFileEntry>
  services?: Record<string, ProtoApiService>
  components?: {
    messages?: Record<string, ProtoApiElement>
    enums?: Record<string, ProtoApiElement>
    extensions?: Record<string, ProtoApiElement>
  }
}
