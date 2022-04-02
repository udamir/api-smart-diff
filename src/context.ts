import { Diff, BaseRulesType, CompareOptions, Rules, MergedKeyMeta, MergeOptions } from "./types"
import { asyncApi2Rules, jsonSchemaRules, openapi3Rules } from "./rules"
import { DiffAction, DIFF_META_KEY,  } from "./constants"
import { ObjPath } from "."

export interface CompareResult {
  diffs: Diff[]
}

export class CompareContext<T extends CompareResult> implements CompareOptions {
  public rules?: Rules

  public beforeRefs: Set<string> = new Set()
  public afterRefs: Set<string> = new Set()
  public beforeCache: Map<string, any> = new Map()
  public afterCache: Map<string, any> = new Map()
  public findFirstDiff = false

  public trimStrings?: boolean
  public caseSensitive?: boolean
  public strictArrays?: boolean

  // public circularRef?: boolean

  constructor(public before: any, public after: any, options: CompareOptions) {
    this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules
    this.trimStrings = options.trimStrings 
    this.caseSensitive = options.caseSensitive 
    this.strictArrays = options.strictArrays
    // this.circularRef = options.circularRef || false

    const externalRefs = options.externalRefs || {}
    for (const ref of Object.keys(externalRefs)) {
      this.beforeCache.set(ref, externalRefs[ref])
      this.afterCache.set(ref, externalRefs[ref])
    }
  }

  private getBaseRules (name: BaseRulesType): Rules {
    switch (name) {
      case "OpenApi3":
        return openapi3Rules
      case "AsyncApi2":
        return asyncApi2Rules
      case "JsonSchema":
        return jsonSchemaRules()
    }
  }

  public newObjectCompareResult(): T {
    const result: CompareResult = {
      diffs: []
    }
    return result as T
  }

  public newArrayCompareResult(): T {
    const result: CompareResult = {
      diffs: []
    }
    return result as T
  }

  public formatResult (diff: Diff | undefined, value: any, path: ObjPath): T {
    const result: CompareResult = {
      diffs: diff ? [diff] : []
    }
    return result as T
  }

  public mergeResult(res1: CompareResult, res2: CompareResult) {
    res1.diffs = [...res1.diffs, ...res2.diffs]
  } 
  
}

export interface MergeResult extends CompareResult {
  meta?: any
  merged: any
}

export class MergeContext extends CompareContext<MergeResult> {
  public formatMeta: (diff: Diff) => MergedKeyMeta
  public metaKey: string | symbol
  public arrayMeta?: boolean
  public merged: any

  constructor(before: any, after: any, options: MergeOptions) {
    super(before, after, options)
    this.formatMeta = options.formatMeta || ((d: Diff) => this._formatMeta(d))
    this.metaKey = options.metaKey || DIFF_META_KEY
    this.arrayMeta = options.arrayMeta || false
  }

  private _formatMeta = (diff: Diff): MergedKeyMeta => {
    return { 
      type: diff.type,
      action: diff.action,
      ...diff.action === DiffAction.replace ? { replaced: diff.before } : {}
    } 
  }

  public formatResult (diff: Diff | undefined, value: any, path: ObjPath): MergeResult {
    const key = path[path.length - 1]

    const merged: any = typeof key === "number" ? [] : {}
    merged[key] = value

    if (diff) {
      if (diff.action === DiffAction.remove) {
        return {
          diffs: [diff],
          merged,
          meta: this.formatMeta(diff)
        }
      } else {
        return {
          diffs: [diff],
          merged,
          meta: this.formatMeta(diff)
        }
      }
    } else {
      return {
        diffs: [],
        merged
      }
    }
  }

  public mergeResult(res1: MergeResult, res2: MergeResult) {
    res1.diffs = [...res1.diffs, ...res2.diffs]
    if (typeof res1.merged )
    res1.merged = []
  } 
  
}
