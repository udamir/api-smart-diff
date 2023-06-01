import { JsonMapTreeRules, ObjPath } from "../jsonMap"

export type DiffType = "breaking" | "non-breaking" | "annotation" | "unclassified" | "deprecated"

export type AddDiffType = DiffType | DiffTypeFunc
export type RemoveDiffType = DiffType | DiffTypeFunc
export type ReplaceDiffType = DiffType | DiffTypeFunc

export interface IChangeContext {
  before: any
  after: any
  up: (n?: number) => IChangeContext
  root: IChangeContext
}

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

export type MatchKeysRule = (ctx: MatchContext) => boolean

export type DiffTypeFunc = (ctx: IChangeContext) => DiffType

export type ClassifyRule = [AddDiffType, RemoveDiffType, ReplaceDiffType]
export type ClassifyRules = {
  "#"?: MatchKeysRule
} & JsonMapTreeRules<ClassifyRule>

export interface MapKeysResult<T extends string | number> {
  added: Array<T>
  removed: Array<T>
  mapped: Record<T, T>
}
