import type { CrawlRules, CrawlRulesFunc, JsonPath } from "json-crawl"

import type { Diff, DiffType, ComapreOptions, CompareResult } from "./compare"

export type DiffTypeClassifier = (ctx: ComapreContext) => DiffType

export type ClassifyRule =
  | [AddDiffType, RemoveDiffType, ReplaceDiffType]
  | [AddDiffType, RemoveDiffType, ReplaceDiffType, ReversedAddDiffType, ReversedRemoveDiffType, ReversedReplaceDiffType]

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
}

export type ComapreContext = {
  before: NodeContext
  after: NodeContext
  rules: CompareRules
  options: ComapreOptions
}

export type CompareResolver = (ctx: ComapreContext) => CompareResult | undefined

export type TransformResolver<T = unknown> = (value: T, other: T) => T
export type CompareTransformResolver<T = unknown> = (before: T, after: T) => [T, T]

export type MappingResolver<T extends string | number> = T extends string ? MappingObjectResolver : MappingArrayResolver
export type MappingObjectResolver = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ctx: ComapreContext,
) => MapKeysResult<string>
export type MappingArrayResolver = (
  before: Array<unknown>,
  after: Array<unknown>,
  ctx: ComapreContext,
) => MapKeysResult<number>

export interface AnnotateTemplate {
  template: string
  params?: { [key: string]: AnnotateTemplate | string | number | undefined }
}

export type ChangeAnnotationResolver = (diff: Diff, ctx: ComapreContext) => AnnotateTemplate | undefined

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
}

export type CompareRules = CrawlRules<CompareRule>
export type CompareRulesFunc = CrawlRulesFunc<CompareRule>

export interface MapKeysResult<T extends string | number> {
  added: Array<T>
  removed: Array<T>
  mapped: Record<T, T>
}

export type CompareRulesTransformer = (rules: CompareRules) => CompareRules
export type ClassifyRuleTransformer = (
  type: DiffType,
  ctx: ComapreContext,
  action: "add" | "remove" | "replace",
) => DiffType
