import { JsonPath } from "json-crawl"

import { ComapareRules } from "./rules/types"
import { ClassifierType, DiffAction } from "./constants"

export type ActionType = keyof typeof DiffAction
export type DiffType = typeof ClassifierType[keyof typeof ClassifierType]

export type Diff = {
  action: ActionType
  path: JsonPath
  before?: any
  after?: any
  type?: DiffType
}

export type JsonCompareOptions<T = Diff> = {
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  metaKey?: string | symbol
  arrayMeta?: boolean
  formatDiff?: (diff: Diff) => T
  resolveUnchangedRefs?: boolean
  rules?: ComapareRules
  externalRefs?: {
    [key: string]: any
  }
}

export interface DiffState {
  aPath: JsonPath
  aNode: JsonNode
  keyMap: Record<string | number, string | number>
}


export type FormatDiffFunc<T extends Diff = Diff> = (diff: Diff) => T

export interface MergeState<T extends Diff> extends DiffState {
  nodeDiffs: T[]
}

export type MergeMeta<T extends Diff> = Record<string, T | T[]>

export type JsonNode = Record<any, any>
