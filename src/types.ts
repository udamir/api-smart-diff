export type DiffPath = Array<string | number>

export type ActionType = "add" | "remove" | "replace"

export type UnclassifiedDiff = {
  action: ActionType
  path: DiffPath
  before?: any
  after?: any
}

export type Diff = UnclassifiedDiff & {
  type: DiffType
}

export type DiffType = "breaking" | "non-breaking" | "annotation" | "unclassified"

export type AddDiffType = DiffType | DiffTypeFunc
export type RemoveDiffType = DiffType | DiffTypeFunc
export type ReplaceDiffType = DiffType | DiffTypeFunc

export type DiffTypeFunc = (before: any, after: any) => DiffType

export type Classifier = [AddDiffType, RemoveDiffType, ReplaceDiffType]
export type RulesRef = () => Rules

export type Rules = {
  [key: `/${string}`]: Classifier | Rules | RulesRef
} & {
  "/"?: Classifier
}

export type BaseRulesType = "OpenApi3" | "AsyncApi2" | "JsonSchema"

export type DiffOptions = {
  rules?: Rules | BaseRulesType
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  circularRef?: boolean
  externalRefs?: { [key: string]: any }
  arrayMeta?: boolean
}

export type MergeOptions<T = MergedKeyMeta> = DiffOptions & {
  formatMeta?: (diff: Diff) => T
  metaKey?: string | symbol
}

export type MergedKeyMeta = {
  type: DiffType
  action: ActionType
  replaced?: any
}

export type MergedArrayMeta<T = MergedKeyMeta> = {
  array: { [key: number]: T | MergedArrayMeta }
}

export type MergeResult = [any, (MergedKeyMeta | MergedArrayMeta)?]
