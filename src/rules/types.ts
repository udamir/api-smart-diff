import { CrawlRules, JsonPath } from "json-crawl"

import { Diff } from "../types"

export type DiffType = "breaking" | "non-breaking" | "annotation" | "unclassified" | "deprecated"

export type DiffTypeClassifier = (ctx: ComapreContext) => DiffType

export type ClassifyRule = [AddDiffType, RemoveDiffType, ReplaceDiffType]
export type AddDiffType = DiffType | DiffTypeClassifier
export type RemoveDiffType = DiffType | DiffTypeClassifier
export type ReplaceDiffType = DiffType | DiffTypeClassifier

export type ComapreContext = {
  before: {
    path: JsonPath
    key: string | number
    value: any
    parent: any
    source: any
  }
  after: {
    path: JsonPath
    key: string | number
    value: any
    parent: any
    source: any
  }
}

export type CompareResolver = (ctx: ComapreContext) => { diffs: Diff[], merged: any }

export type TransformationResolver = (before: unknown, after: unknown) => [unknown, unknown]

export type MappingResolver<T extends string | number> = T extends string ? MappingObjectResolver : MappingArrayResolver
export type MappingObjectResolver = (before: Record<string, unknown>, after: Record<string, unknown>) => MapKeysResult<string>
export type MappingArrayResolver = (before: Array<unknown>, after: Array<unknown>) => MapKeysResult<number>

export type ChangeAnnotationResolver = (diff: Diff, ctx: ComapreContext) => string

export type CrawlRule = {
  $?: ClassifyRule      // classifier for current node
  $$?: ClassifyRule     // classifier for current and all child nodes
  compare?: CompareResolver      // compare handler for current node
  transformers?: TransformationResolver[]
  mapping?: MappingResolver<string | number>
  annotate?: ChangeAnnotationResolver
}

export type CompareRules = CrawlRules<CrawlRule>

export interface MapKeysResult<T extends string | number> {
  value: Record<T, unknown> | null
  added: Array<T>
  removed: Array<T>
  mapped: Record<T, T>
}
