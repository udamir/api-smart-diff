import type { JsonPath } from "json-crawl"

import type { CompareContext, CompareExtensionRules, CompareRules } from "./rules"
import type { ClassifierType, DiffAction } from "../core/constants"

export type ActionType = keyof typeof DiffAction
export type DiffType = (typeof ClassifierType)[keyof typeof ClassifierType]

// Scope is explicit state carried in the compare context; the built-in scope names are listed in `CompareScopes`
export type CompareScope = string

export type Diff = {
  type: DiffType
  action: ActionType
  path: JsonPath
  before?: any
  after?: any
  description?: string
  // scope the node was compared in (always present)
  scope: CompareScope
  // declaration paths of the value when they differ from `path` (inside $ref targets)
  origin?: { before: JsonPath; after: JsonPath }
}

export type DiffMeta = {
  action: ActionType
  type: DiffType
  replaced?: any
}

export type CompareErrorKind = "classify" | "annotate" | "ref" | "transform" | "mapping" | "compare"

export interface CompareError {
  kind: CompareErrorKind
  message: string
  path: JsonPath
  scope: CompareScope
  error?: unknown
}

export interface CompareResult {
  diffs: Diff[]
  merged: any
  rootMergeMeta?: MergeMeta
  // errors collected while comparing (present only when `onError` is not set and at least one error occurred)
  errors?: CompareError[]
}

export type MergeMeta = DiffMeta | MergeArrayMeta
export type MergeArrayMeta = { array: Record<number, MergeMeta> }

export type SourceContext = {
  before?: {
    source: unknown
    jsonPath: JsonPath
  }
  after?: {
    source: unknown
    jsonPath: JsonPath
  }
}

export type CompareEngineName = "openapi" | "asyncapi" | "graphapi" | "protoapi" | "jsonschema"

export type CompareOptions = {
  // custom rules for compare
  rules?: CompareRules

  // custom prefix rules for specification extensions (`x-*`), merged key-wise over the built-in `x-` rule of the
  // OpenAPI / AsyncAPI / JSON Schema rule sets (ignored when `rules` is given: spread `extensionRules` yourself)
  extensions?: CompareExtensionRules

  // metakey for merge changes
  metaKey?: string | symbol
  // add changes to arrays via metakey
  arrayMeta?: boolean
  // custom format hook
  annotateHook?: AnnotateHook

  externalSources?: {
    // external $ref sources: { [absoluteUri]: document }
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }

  // receives classifier / annotation / $ref resolution errors; when absent they are collected in `result.errors`
  onError?: (error: CompareError) => void

  // classification of `components.*` diffs: derived from the scopes that reference the component (default) or unclassified
  components?: "usage" | "unclassified"

  // merged document content: original values from the inputs (default) or the normalized comparison values
  merged?: "original" | "normalized"

  // walk structurally equal subtrees too (default false: a subtree that is structurally equal, with unchanged `$ref`
  // targets, is written to `merged` without invoking any rule). Set it for custom rule sets whose `compare` resolvers,
  // transforms or mapping resolvers report diffs on equal values (POLICY-58). The built-in rule sets give the same
  // result either way; the option only costs time.
  compareUnchanged?: boolean

  // force an engine in `apiCompare` instead of detecting it from the documents
  engine?: CompareEngineName
}

export type CompareEngine = (
  before: unknown,
  after: unknown,
  options?: CompareOptions,
  context?: SourceContext,
) => CompareResult

export type AnnotateHook = (diff: Diff, ctx: CompareContext) => string
export type KeyMapping = Record<string | number, string | number>

export type MergeMetaRecord = Record<string | number, MergeMeta>

export interface DiffFactory {
  added: (path: JsonPath, after: unknown, ctx: CompareContext) => Diff
  removed: (path: JsonPath, before: unknown, ctx: CompareContext) => Diff
  replaced: (path: JsonPath, before: unknown, after: unknown, ctx: CompareContext) => Diff
  renamed: (path: JsonPath, before: unknown, after: unknown, ctx: CompareContext) => Diff
}

export type { CompareRules }
