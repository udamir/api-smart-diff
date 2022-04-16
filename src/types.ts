export type ObjPath = Array<string | number>

export type ActionType = "add" | "remove" | "replace" | "test"

export type JsonDiff = {
  action: ActionType
  path: ObjPath
  before?: any
  after?: any
}

export type Diff = JsonDiff & {
  type: DiffType
}

export type DiffType = "breaking" | "non-breaking" | "annotation" | "unclassified"

export type AddDiffType = DiffType | DiffTypeFunc
export type RemoveDiffType = DiffType | DiffTypeFunc
export type ReplaceDiffType = DiffType | DiffTypeFunc

export type DiffTypeFunc = (before: any, after: any) => DiffType

export type Rule = [AddDiffType, RemoveDiffType, ReplaceDiffType]
export type RulesRef = (b: any) => Rules

export type MatchFunc = (b: any, a: any) => boolean

export type Rules = {
  [key: `/${string}`]: Rule | Rules | RulesRef
} & {
  "/"?: Rule
  "#"?: MatchFunc
}

export type BaseRulesType = "OpenApi3" | "AsyncApi2" | "JsonSchema"

export type JsonCompareOptions = {
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  metaKey?: string | symbol
}

export type CompareResult<T extends JsonDiff = JsonDiff> = {
  diffs: T[]
  diff?: T
  diffTree?: any
}

export type MergeResult<T extends JsonDiff = JsonDiff> = CompareResult<T> & {
  value: any
  meta?: any
}

export type ApiDiffOptions = JsonCompareOptions & {
  rules?: Rules | BaseRulesType
  externalRefs?: { [key: string]: any }
}

export type JsonMergeOptions<T extends JsonDiff = JsonDiff> = JsonCompareOptions & {
  arrayMeta?: boolean
  formatMergedMeta?: (diff: T) => any
}

export type JsonMergedMeta = {
  action: ActionType
  replaced?: any
}

export type ApiMergedMeta = JsonMergedMeta & {
  type: DiffType
}

export type MergedArrayMeta<T = JsonMergedMeta> = {
  array: { [key: number]: T | MergedArrayMeta }
}
