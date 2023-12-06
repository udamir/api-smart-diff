import { JsonPath } from "json-crawl"

import { ClassifierType, DiffAction } from "../constants"
import { ComapreContext, CompareRules } from "./rules"

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

export interface CompareResult {
  diffs: Diff[]
  merged: any
  rootMergeMeta?: DiffMeta | MergeArrayMeta
}

export type SourceContext = {
  before?: {
    source: unknown
    jsonPath: JsonPath
  }
  after?: {
    source: unknown
    jsonPath: JsonPath
  }
}

export type ComapreOptions = {
  // strictArrays?: boolean
  // resolveUnchangedRefs?: boolean
  metaKey?: string | symbol
  arrayMeta?: boolean
  rules?: CompareRules

  externalSources?: {
    before?: {
      [key: string]: unknown
    },
    after?: {
      [key: string]: unknown
    }
  }
}

export type FormatDiffFunc<T extends Diff = Diff> = (diff: Diff, ctx: ComapreContext) => T
export type NodeRoot = { "#": any }
export type KeyMapping = Record<string | number, string | number>

export interface MergeState<T extends string | number = string> {
  keyMap: KeyMapping      // parent keys mappings
  aPath: JsonPath         // after path from root
  aNode: JsonNode<T>      // after Node
  bPath: JsonPath         // before path from root
  bNode: JsonNode<T>      // before Node 
  mNode: any              // merged Node
  parentMeta: MergeMeta   // parent merge meta
  root: { 
    before: NodeRoot      // before root Node
    after: NodeRoot       // after root Node
    merged: JsonNode<T>   // merged root Node
  },
}

export type MergeArrayMeta = { array: Record<number, DiffMeta | MergeArrayMeta> }
export type MergeMeta = Record<string | number, DiffMeta | MergeArrayMeta>

export type JsonNode<T extends string | number = string> = T extends string ? Record<string | number, unknown> : Array<unknown>

export interface ChangeFactory<T extends Diff = Diff> {
  added: (path: JsonPath, after: unknown, ctx: ComapreContext) => T
  removed: (path: JsonPath, before: unknown, ctx: ComapreContext) => T
  replaced: (path: JsonPath, before: unknown, after: unknown, ctx: ComapreContext) => T
  renamed: (path: JsonPath, before: unknown, after: unknown, ctx: ComapreContext) => T
}
