import { JsonPath } from "json-crawl"

import { ClassifierType, DiffAction } from "../constants"
import { CompareRules } from "./rules"

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
export interface CompareResult {
  diffs: Diff[]
  merged: any
  rootMergeMeta?: DiffMeta | MergeArrayMeta
}

export type ComapreOptions = {
  // strictArrays?: boolean
  // resolveUnchangedRefs?: boolean
  metaKey?: string | symbol
  arrayMeta?: boolean
  externalRefs?: {
    [key: string]: any
  }
  rules?: CompareRules
  sources?: {
    before: unknown
    after: unknown
  }
}


export type FormatDiffFunc<T extends Diff = Diff> = (diff: Diff) => T
export type NodeRoot = { "#": any }
export type KeyMapping<T extends string | number> = T extends string ? Record<string, string> : Record<number, number>

export interface MergeState<T extends string | number = string> {
  keyMap: KeyMapping<T> // parent keys mappings
  aPath: JsonPath         // after path 
  aNode: JsonNode<T>      // after Node
  bNode: JsonNode<T>      // before Node 
  mNode: any              // merged Node
  parentMeta: MergeMeta   // parent merge meta
  // nodeDiffs: Diff[]       // parent diffs
  root: { 
    before: NodeRoot      // before root Node
    after: NodeRoot       // after root Node
    merged: NodeRoot      // merged root Node
  }
}

export type MergeArrayMeta = { array: Record<number, DiffMeta | MergeArrayMeta> }
export type MergeMeta = Record<string | number, DiffMeta | MergeArrayMeta>

export type JsonNode<T extends string | number = string> = T extends string ? Record<string | number, unknown> : Array<unknown>
