import { Diff, ObjPath, BaseRulesType, Rules, ApiDiffOptions, JsonDiff, ApiMergedMeta } from "./types"
import { asyncApi2Rules, jsonSchemaRules, openapi3Rules } from "./rules"
import { buildPath, getPathMatchFunc, getPathRules } from "./utils"
import { allUnclassified, DiffAction } from "./constants"
import { dereference } from "./dereference"
import { JsonMerge } from "./jsonMerge"

export class ApiDiff extends JsonMerge<Diff> {
  public rules: Rules

  public beforeRefs: Set<string> = new Set()
  public afterRefs: Set<string> = new Set()
  public beforeCache: Map<string, any> = new Map()
  public afterCache: Map<string, any> = new Map()

  constructor(public before: any, public after: any, options: ApiDiffOptions) {
    super(before, after, options)
    this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules || {}
    
    const externalRefs = options.externalRefs || {}
    for (const ref of Object.keys(externalRefs)) {
      this.beforeCache.set(ref, externalRefs[ref])
      this.afterCache.set(ref, externalRefs[ref])
    }
  }

  static apiDiff (before: any, after: any, options: ApiDiffOptions = {}): Diff[] {
    const apiDiff = new ApiDiff(before, after, options)
    return apiDiff.compare()
  }
  
  static apiDiffTree (before: any, after: any, options: ApiDiffOptions = {}): any {
    const apiDiff = new ApiDiff(before, after, options)
    return apiDiff.buildDiffTree()
  }
  
  static apiMerge (before: any, after: any, options: ApiDiffOptions = {}): any {
    const apiDiff = new ApiDiff(before, after, options)
    return apiDiff.merge()
  }

  protected _formatMergeMeta = (diff: Diff): ApiMergedMeta => {
    return { 
      type: diff.type,
      action: diff.action,
      ...diff.action === DiffAction.replace ? { replaced: diff.before } : {}
    } 
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

  public classifyDiff (diff: JsonDiff): Diff {
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
  
  public compareResult(diff: JsonDiff) {
    return super.compareResult(this.classifyDiff(diff))
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
