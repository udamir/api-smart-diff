import { CrawlRules, JsonPath } from "json-crawl"

import type { Diff, DiffType, ComapreOptions, CompareResult } from "./compare"

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
    parent: unknown
    root: unknown
  }
  after: {
    path: JsonPath
    key: string | number
    value: any
    parent: unknown
    root: unknown
  }
  options: ComapreOptions
}

export type CompareResolver = (ctx: ComapreContext) => CompareResult | void

export type TransformationResolver = (value: unknown, other: unknown) => unknown
export type CompareTransformationResolver = (before: unknown, after: unknown) => [unknown, unknown]

export type MappingResolver<T extends string | number> = T extends string ? MappingObjectResolver : MappingArrayResolver
export type MappingObjectResolver = (before: Record<string, unknown>, after: Record<string, unknown>) => MapKeysResult<string>
export type MappingArrayResolver = (before: Array<unknown>, after: Array<unknown>) => MapKeysResult<number>

export type ChangeAnnotationResolver = (diff: Diff, ctx: ComapreContext) => string

export type ComapreRule = {
  $?: ClassifyRule      // classifier for current node
  compare?: CompareResolver      // compare handler for current node
  transformers?: CompareTransformationResolver[]
  mapping?: MappingResolver<string | number>
  annotate?: ChangeAnnotationResolver
}

export type CompareRules = CrawlRules<ComapreRule>

export interface MapKeysResult<T extends string | number> {
  added: Array<T>
  removed: Array<T>
  mapped: Record<T, T>
}
