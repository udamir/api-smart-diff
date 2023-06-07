import { ActionType, DiffType, MatchFunc, ObjPath, Rules } from "../types"

export type Diff = {
  action: ActionType
  path: ObjPath
  before?: any
  after?: any
  type?: DiffType
}

export type JsonCompareOptions<T = Diff> = {
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  matchRules?: {
    [path: string]: MatchFunc
  }
  metaKey?: string | symbol
  arrayMeta?: boolean
  formatDiff?: (diff: Diff) => T
  resolveUnchangedRefs?: boolean
  rules?: Rules
  externalRefs?: {
    [key: string]: any
  }
}


export interface DiffState {
  aPath: ObjPath
  aNode: JsonNode
  keyMap: Record<string | number, string | number>
}


export type FormatDiffFunc<T extends Diff = Diff> = (diff: Diff) => T

export interface MergeState<T extends Diff> extends DiffState {
  nodeDiffs: T[]
}

export type MergeMeta<T extends Diff> = Record<string, T | T[]>

export type JsonNode = Record<any, any>
