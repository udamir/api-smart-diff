import { CrawlRules, CrawlRulesFunc, JsonPath } from "json-crawl"

import type { Diff, DiffType, ComapreOptions, CompareResult } from "./compare"

export type DiffTypeClassifier = (ctx: ComapreContext) => DiffType

export type ClassifyRule = [AddDiffType, RemoveDiffType, ReplaceDiffType]
export type AddDiffType = DiffType | DiffTypeClassifier
export type RemoveDiffType = DiffType | DiffTypeClassifier
export type ReplaceDiffType = DiffType | DiffTypeClassifier

export type DiffContext =  {
  path: JsonPath
  key: string | number
  value: unknown
  parent?: unknown
  root: unknown
}

export type ComapreContext = {
  before: DiffContext
  after: DiffContext
  options: ComapreOptions
}

export type CompareResolver = (ctx: ComapreContext) => CompareResult | void

export type TransformResolver = (value: unknown, other: unknown) => unknown
export type CompareTransformResolver = (before: unknown, after: unknown) => [unknown, unknown]

export type MappingResolver<T extends string | number> = T extends string ? MappingObjectResolver : MappingArrayResolver
export type MappingObjectResolver = (before: Record<string, unknown>, after: Record<string, unknown>, ctx: ComapreContext) => MapKeysResult<string>
export type MappingArrayResolver = (before: Array<unknown>, after: Array<unknown>, ctx: ComapreContext) => MapKeysResult<number>

export type ChangeAnnotationResolver = (diff: Diff, ctx: ComapreContext) => string

export type CompareRule = {
  $?: ClassifyRule                            // classifier for current node
  compare?: CompareResolver                   // compare handler for current node
  transform?: CompareTransformResolver[]      // transformations 
  mapping?: MappingResolver<string | number>  // key mapping rules
  annotate?: ChangeAnnotationResolver         // 
  skip?: boolean                              // skip comparison, use before value as merge result
}

export type CompareRules = CrawlRules<CompareRule>
export type CompareRulesFunc = CrawlRulesFunc<CompareRule>

export interface MapKeysResult<T extends string | number> {
  added: Array<T>
  removed: Array<T>
  mapped: Record<T, T>
}
