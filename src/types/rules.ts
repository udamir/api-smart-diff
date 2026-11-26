import type { CrawlRules, CrawlRulesFunc, JsonPath } from "json-crawl"

import type { CompareScope, Diff, DiffType, CompareOptions, CompareResult } from "./compare"
import type { CompareSession } from "./session"

export type DiffTypeClassifier = (ctx: CompareContext) => DiffType

export type ClassifyTuple = [AddDiffType, RemoveDiffType, ReplaceDiffType]
export type ClassifyTuple6 = [
  AddDiffType,
  RemoveDiffType,
  ReplaceDiffType,
  ReversedAddDiffType,
  ReversedRemoveDiffType,
  ReversedReplaceDiffType,
]

// object form: one tuple per scope, `default` for every other scope
export type ScopedClassifyRule = { [scope: string]: ClassifyTuple | undefined } & { default?: ClassifyTuple }

export type ClassifyRule = ClassifyTuple | ClassifyTuple6 | ScopedClassifyRule

export type AddDiffType = RuleDiffType
export type RemoveDiffType = RuleDiffType
export type ReplaceDiffType = RuleDiffType

// Reversed DiffType uses to specify rule for reverse case
export type ReversedAddDiffType = RuleDiffType
export type ReversedRemoveDiffType = RuleDiffType
export type ReversedReplaceDiffType = RuleDiffType

export type RuleDiffType = DiffType | DiffTypeClassifier

export type NodeContext = {
  path: JsonPath
  key: string | number
  value: unknown
  parent?: unknown
  root: unknown
  // context of the parent node (absent at the root of a comparison)
  up?: NodeContext
  // declaration path of the value when it differs from `path` (inside a $ref target)
  origin?: JsonPath
  // scope the node is compared in (set by the engine)
  scope?: CompareScope
  // the untransformed value of the node in the input document (absent for nodes created by a transform)
  source?: unknown
  // what the node is in its document, from the `kind` of its rule (set by the engine; see `CompareRule.kind`)
  kind?: string
}

export type CompareContext = {
  before: NodeContext
  after: NodeContext
  rules: CompareRules
  options: CompareOptions
  scope: CompareScope
  session: CompareSession
}

export type CompareResolver = (ctx: CompareContext) => CompareResult | undefined

export type TransformResolver<T = unknown> = (value: T, other: T) => T
// the context is passed as a third argument (additive); transforms that do not need it keep the two-argument form
export type CompareTransformResolver<T = unknown> = (before: T, after: T, ctx?: CompareContext) => [T, T]

export type MappingResolver<T extends string | number> = T extends string ? MappingObjectResolver : MappingArrayResolver
export type MappingObjectResolver = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ctx: CompareContext,
) => MapKeysResult<string>
export type MappingArrayResolver = (
  before: Array<unknown>,
  after: Array<unknown>,
  ctx: CompareContext,
) => MapKeysResult<number>

export interface AnnotateTemplate {
  template: string
  params?: { [key: string]: AnnotateTemplate | string | number | undefined }
}

export type ChangeAnnotationResolver = (diff: Diff, ctx: CompareContext) => AnnotateTemplate | undefined

export type ScopeContext = { scope: CompareScope; key: string | number; path: JsonPath; value: unknown }
export type ScopeResolver = (ctx: ScopeContext) => CompareScope

export type CompareRule = {
  // classifier for current node
  $?: ClassifyRule

  // compare handler for current node
  compare?: CompareResolver

  // transformations
  transform?: CompareTransformResolver[]

  // key mapping rules
  mapping?: MappingResolver<string | number>

  // resolver for annotation template
  annotate?: ChangeAnnotationResolver

  // skip comparison, use before value as merge result
  skip?: boolean

  // open a scope for this node and its subtree (a function derives it from the parent scope)
  scope?: CompareScope | ScopeResolver

  // what the node is in its document (`"schema"` at the root of a schema, `"header"`, `"parameter"`, `"message"`, …):
  // copied to the node contexts (`NodeContext.kind`), so descriptions locate a node by the structure the rules
  // describe instead of by key names (ISSUE-300); not inherited by the children (a rule spread into a child rule
  // carries it along, so the built-in rule sets set it at the site that embeds a rule set, never inside one)
  kind?: string

  // a `$ref` at this node also makes the enclosing component a usage of the referenced one: the component inherits
  // the usage scopes of the target (a GraphQL type implementing an interface is returned wherever the interface is)
  inheritUsage?: boolean

  // on the rule that opens the `components` scope (a component root): the scopes a component that nothing references
  // is classified in (without it, such a component is unclassified, decision §11.4); GraphQL types are classified as if
  // reachable (POLICY-02)
  unreferencedScopes?: CompareScope[]

  // on the root rule: the entries of the compared documents renamed with every reference repointed (before JSON
  // pointer -> after JSON pointer, `findRenames` in `core/renames.ts`; ISSUE-78, POLICY-100 / 101): a reference
  // repointed through a rename names the same declaration on both sides
  referenceRenames?: (ctx: CompareContext) => ReadonlyMap<string, string>

  // on the root rule: the references a document makes without a `$ref` (the path of the node that makes one and its
  // target pointer), read by the usage index like `$ref`s: an AsyncAPI 3.0 operation without a `messages` list uses
  // every message of its channel (POLICY-120, ISSUE-340)
  impliedReferences?: (root: unknown) => { path: JsonPath; ref: string }[]
}

export type CompareRules = CrawlRules<CompareRule>
export type CompareRulesFunc = CrawlRulesFunc<CompareRule>

/**
 * A fragment of a rule set holding extension rules in json-crawl 1.x syntax: exact keys (`"/x-internal"`) and prefix
 * rules (`"/x-*"`, `"/x-internal-*"`: a trailing `*` after a non-empty prefix matches every string key starting with
 * the prefix). Resolution is exact key > longest prefix > `/*` > `/**`, merged field by field; array indexes never
 * match a prefix.
 */
export type CompareExtensionRules = {
  [key: `/${string}`]: CompareRules | CompareRulesFunc
}

export interface MapKeysResult<T extends string | number> {
  added: Array<T>
  removed: Array<T>
  mapped: Record<T, T>
}

export type CompareRulesTransformer = (rules: CompareRules) => CompareRules
export type ClassifyRuleTransformer = (
  type: DiffType,
  ctx: CompareContext,
  action: "add" | "remove" | "replace",
) => DiffType
