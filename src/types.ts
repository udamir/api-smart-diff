export type ObjPath = Array<string | number>

export type ActionType = "add" | "remove" | "replace" | "test" | "rename"

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

export interface IChageContext {
  before: any
  after: any
  up: (n?: number) => IChageContext
  root: IChageContext
}

export type DiffTypeFunc = (ctx: IChageContext) => DiffType

export type Rule = [AddDiffType, RemoveDiffType, ReplaceDiffType]
export type RulesRef = (b: any) => Rules

export type MatchContext = {
  path: ObjPath
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

export type MatchFunc = (ctx: MatchContext) => boolean

export type Rules = {
  [key: `/${string}`]: Rule | Rules | RulesRef
} & {
  "/"?: Rule
  "#"?: MatchFunc
}

export type BaseRulesType = "OpenApi3" | "AsyncApi2" | "JsonSchema"

export type JsonCompareOptions<T extends JsonDiff = JsonDiff> = {
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  matchRules?: {
    [path: string]: MatchFunc
  }
  metaKey?: string | symbol
  arrayMeta?: boolean
  formatMergedMeta?: (diff: T) => any
}

export type CompareResult<T extends JsonDiff = JsonDiff> = {
  diffs: T[]
  diff?: T
  diffTree?: any
  parentMeta?: any
}

export type ApiDiffOptions = JsonCompareOptions & {
  resolveUnchangedRefs?: boolean
  rules?: Rules | BaseRulesType
  externalRefs?: {
    [key: string]: any
  }
}

export type JsonMergedMeta = {
  action: ActionType
  replaced?: any
}

export type ApiMergedMeta = JsonMergedMeta & {
  type: DiffType
}

export type MergedArrayMeta<T = JsonMergedMeta> = {
  array: {
    [key: number]: T | MergedArrayMeta<T>
  }
}
