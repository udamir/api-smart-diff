import { JsonPath } from "json-crawl"

import { ClassifierType, DiffAction } from "./constants"
import { CompareRules } from "./rules/types"

export type ActionType = keyof typeof DiffAction
export type DiffType = typeof ClassifierType[keyof typeof ClassifierType]

export type Diff = {
  action: ActionType
  path: JsonPath
  before?: any
  after?: any
  type?: DiffType
  description?: string
}

export type DiffMeta = {
  action: ActionType
  type?: DiffType
  replaced?: any
}

export type JsonCompareOptions<T = Diff> = {
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  metaKey?: string | symbol
  arrayMeta?: boolean
  formatDiff?: (diff: Diff) => T
  resolveUnchangedRefs?: boolean
  rules?: CompareRules
  externalRefs?: {
    [key: string]: any
  }
}

export type FormatDiffFunc<T extends Diff = Diff> = (diff: Diff) => T
export type NodeRoot = { "#": any }
export type KeyMapping<T extends string | number> = Record<T, T>

export interface MergeState {
  keyMap: KeyMapping<any> // parent keys mappings
  aPath: JsonPath         // after path 
  aNode: JsonNode         // after Node
  bNode: JsonNode         // before Node 
  mNode: JsonNode         // merged Node
  nodeDiffs: Diff[]       // parent diffs
  root: { 
    before: NodeRoot      // before root Node
    after: NodeRoot       // after root Node
    merged: NodeRoot      // merged root Node
  }
}


export type MergeMeta = Record<string, Diff | Diff[]>

export type JsonNode = Record<string | number, unknown>
