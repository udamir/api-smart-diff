import { Diff, UnclassifiedDiff, ObjPath, ActionType, BaseRulesType, CompareOptions, Rules } from "./types"
import { buildPath, getPathMatchFunc, getPathRules } from "./utils"
import { asyncApi2Rules, jsonSchemaRules, openapi3Rules } from "./rules"
import { allUnclassified } from "./constants"
import { dereference } from "./dereference"
import { DeepDiff } from "./deepdiff"
import { DiffAction, DIFF_META_KEY, MergedKeyMeta, MergeOptions, typeOf } from "."

export type CompareResultDetails = {
  action?: ActionType
  path: ObjPath
  before?: any
  after?: any
}

export class ApiDiff extends DeepDiff {
  public rules: Rules

  public beforeRefs: Set<string> = new Set()
  public afterRefs: Set<string> = new Set()
  public beforeCache: Map<string, any> = new Map()
  public afterCache: Map<string, any> = new Map()

  constructor(public before: any, public after: any, options: CompareOptions) {
    super(before, after, options)
    this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules || {}
    
    const externalRefs = options.externalRefs || {}
    for (const ref of Object.keys(externalRefs)) {
      this.beforeCache.set(ref, externalRefs[ref])
      this.afterCache.set(ref, externalRefs[ref])
    }
  }

  public compare(): Diff[] {
    return this.compareAny(this.before, this.after) as Diff[]
  }

  public dereference(before: any, after: any, objPath: ObjPath): [any, any, () => void] {
    const ref = "#" + buildPath(objPath)
  
    this.beforeRefs.add(ref)
    this.afterRefs.add(ref)
  
    const _before = dereference(before, this.before, this.beforeRefs, this.beforeCache)
    const _after = dereference(after, this.after, this.afterRefs, this.afterCache)

    const clearCache = () => {
      // remove refs
      before.$ref && this.beforeRefs.delete(before.$ref)
      after.$ref && this.afterRefs.delete(after.$ref)

      this.beforeRefs.delete(ref)
      this.afterRefs.delete(ref)
    }

    return [_before, _after, clearCache]
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

  public classifyDiff (diff: UnclassifiedDiff): Diff {
    const _diff = diff as Diff
  
    const rule = getPathRules(this.rules, [...diff.path, ""], this.before)
    const classifier = Array.isArray(rule) ? rule : allUnclassified
  
    const index = ["add", "remove", "replace"].indexOf(diff.action)
    const changeType = classifier[index]
  
    _diff.type = typeof changeType === "function" 
      ? changeType(diff.before, diff.after)
      : changeType
  
    return _diff
  }
  
  public compareResult(res: CompareResultDetails) {
    return res.action ? [this.classifyDiff(res as any)] : []
  }

  public compareObjects(before: any, after: any, objPath: ObjPath) {
    const matchFunc = getPathMatchFunc(this.rules, objPath, this.before)
    const [_before, _after, clearCache] = this.dereference(before, after, objPath)

    const result = super.compareObjects(_before, _after, objPath, matchFunc)
    clearCache()

    return result
  }

  public compareArrays(before: any[], after: any[], objPath: ObjPath) {
    const matchFunc = getPathMatchFunc(this.rules, objPath, this.before)
    return super.compareArrays(before, after, objPath, matchFunc)
  }
}

export class ApiMergeDiff extends ApiDiff {
  public formatMeta: (diff: Diff) => MergedKeyMeta
  public metaKey: string | symbol
  public arrayMeta?: boolean
  public merged: any

  constructor(public before: any, public after: any, options: MergeOptions) {
    super(before, after, options)
    
    this.formatMeta = options.formatMeta || ((d: Diff) => this._formatMeta(d))
    this.metaKey = options.metaKey || DIFF_META_KEY
    this.arrayMeta = options.arrayMeta || false
  }

  public merge(): any {

  }

  private _formatMeta = (diff: Diff): MergedKeyMeta => {
    return { 
      type: diff.type,
      action: diff.action,
      ...diff.action === DiffAction.replace ? { replaced: diff.before } : {}
    } 
  }

  public compareResult(res: CompareResultDetails): Diff[] {
    this.mergeCompareResult(res)
    return super.compareResult(res)
  }

  public mergeCompareResult(res: CompareResultDetails) {
    let value = this.merged
    for (const key of res.path) {
      value = typeOf(value) === "array" ? value[+key] : value[key]
      if (value === undefined) {
        break
      }
      // value = dereference(value, obj, new Set(), cache)
    }
    return value
    // const item = getObjVa this.merged

    // let key = child.path[child.path.length - 1]
    // const array = typeof key === "number"
    // const value = parent.value ? parent.value : array ? [] : {}

    // key = key === -1 ? value.length : key

    // if (child.diff) {
    //   if (child.diff.action === DiffAction.remove) {
    //     value[key] = child.diff.before
    //   } else {
    //     value[key] = child.diff.after
    //   }
        
    //   const meta = this.formatMeta(child.diff)
    //   if (typeOf(value) === "array" && !this.arrayMeta) {
    //     parent.meta = { array: { ...parent.meta?.array, [key]: meta }}
    //   } else {
    //     value[this.metaKey] = { ...value[this.metaKey], [key]: meta }
    //   }
    // } else {
    //   value[key] = child.value
    //   if (child.meta) {
    //     value[this.metaKey] = { ...value[this.metaKey], [key]: child.meta }
    //   }
    // }

    // parent.value = value
    // parent.path = child.path.slice(0, -1)
  } 
}