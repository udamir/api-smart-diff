import type { JsonPath, SyncCrawlHook } from "json-crawl"

import type { ComapreContext, CompareRule, CompareRules } from "./rules"
import type { ClassifierType, DiffAction } from "../core/constants"

export type ActionType = keyof typeof DiffAction
export type DiffType = (typeof ClassifierType)[keyof typeof ClassifierType]

export type Diff = {
  type: DiffType
  action: ActionType
  path: JsonPath
  before?: any
  after?: any
  description?: string
}

export type DiffMeta = {
  action: ActionType
  type: DiffType
  replaced?: any
}

export interface CompareResult {
  diffs: Diff[]
  merged: any
  rootMergeMeta?: MergeMeta
}

export type MergeMeta = DiffMeta | MergeArrayMeta
export type MergeArrayMeta = { array: Record<number, MergeMeta> }

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
  rules?: CompareRules // custom rules for compare

  metaKey?: string | symbol // metakey for merge changes
  arrayMeta?: boolean // add changes to arrays via metakey
  annotateHook?: AnnotateHook // custom format hook

  externalSources?: {
    // external $ref sources
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }
}

export type CompareEngine = (
  before: unknown,
  after: unknown,
  options?: ComapreOptions,
  context?: SourceContext,
) => CompareResult

export type AnnotateHook = (diff: Diff, ctx: ComapreContext) => string
export type NodeRoot = { "#": any }
export type KeyMapping = Record<string | number, string | number>

export interface MergeState<T extends string | number = string> {
  keyMap: KeyMapping // parent keys mappings
  aPath: JsonPath // after path from root
  aNode: JsonNode<T> // after Node
  bPath: JsonPath // before path from root
  bNode: JsonNode<T> // before Node
  mNode: any // merged Node
  parentMeta: MergeMetaRecord // parent merge meta
  root: {
    before: NodeRoot // before root Node
    after: NodeRoot // after root Node
    merged: JsonNode<T> // merged root Node
  }
}

export type MergeMetaRecord = Record<string | number, MergeMeta>

export type JsonNode<T extends string | number = string> = T extends string
  ? Record<string | number, unknown>
  : Array<unknown>

export interface DiffFactory {
  added: (path: JsonPath, after: unknown, ctx: ComapreContext) => Diff
  removed: (path: JsonPath, before: unknown, ctx: ComapreContext) => Diff
  replaced: (
    path: JsonPath,
    before: unknown,
    after: unknown,
    ctx: ComapreContext,
  ) => Diff
  renamed: (
    path: JsonPath,
    before: unknown,
    after: unknown,
    ctx: ComapreContext,
  ) => Diff
}

export interface MergeFactoryResult {
  diffs: Diff[]
  hook: SyncCrawlHook<MergeState, CompareRule>
}

export interface ContextInput extends MergeState {
  before: any
  after: any
  bPath: JsonPath
  akey: string | number
  bkey: string | number
  rules: CompareRules
}
