import { CrawlRules, JsonPath } from "json-crawl"
import { Diff } from "../types"

export type DiffType = "breaking" | "non-breaking" | "annotation" | "unclassified" | "deprecated"

export type AddDiffType = DiffType | DiffTypeFunc
export type RemoveDiffType = DiffType | DiffTypeFunc
export type ReplaceDiffType = DiffType | DiffTypeFunc

export interface ChangeContext {
  before: any
  after: any
  up: (n?: number) => ChangeContext
  root: ChangeContext
}

export type ComapreContext = {
  path: JsonPath
  before: {
    key: string | number
    value: any
    parent: any
    source: any
  }
  after: {
    key: string | number
    value: any
    parent: any
    source: any
  }
}

export type ComapreRule = (ctx: ComapreContext) => Diff[]

export type DiffTypeFunc = (ctx: ChangeContext) => DiffType

export type ClassifyRule = [AddDiffType, RemoveDiffType, ReplaceDiffType]

export type ComapareRules = CrawlRules<{
  $?: ClassifyRule      // classifier for current node
  $$?: ClassifyRule     // classifier for current and all child nodes
  "#"?: ComapreRule   // match rules for current node
}>


export interface MapKeysResult<T extends string | number> {
  value: Record<T, any> | null
  added: Array<T>
  removed: Array<T>
  mapped: Record<T, T>
}

export type AnnotationRule = {
  "%"?: AnnotationRuleRef | string    // annotation rule for change in current node
  "%%"?: AnnotationRuleRef            // annotation rule for change in child node
}
export type AnnotationRuleRef = (ctx: ChangeAnnotationContext) => string
export type AnnotationRules = CrawlRules<AnnotationRule> 

export interface ChangeAnnotationContext extends ChangeContext {
  diff: Diff
}


export type ChangeDocResolver = (ctx: ChangeDocContext) => string

export type ChangeDocRule = {
  "%"?: string | ChangeDocResolver
}

export type ChangeDocRules = CrawlRules<ChangeDocRule>

export interface ChangeDocContext extends Diff {
  key: string | number
  node: any
  parent?: any
  source: any // source before (replace, delete) | after (add)
}
