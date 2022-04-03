import { Diff, ObjPath, UnclassifiedDiff, BaseRulesType, CompareOptions, Rules } from "./types"
import { asyncApi2Rules, jsonSchemaRules, openapi3Rules } from "./rules"
import { dereference } from "./dereference"
import { classifyDiff } from "./classifier"
import { buildPath } from "./utils"

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

  public normalizeString(value: string) {
    value = this.trimStrings ? value.trim() : value
    value = this.caseSensitive ? value : value.toLowerCase()
    return value
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

  public equalResult(value: any, path: ObjPath) {
    const result: CompareResult = {
      diffs: []
    }
    return result as T
  }

  public diffResult (diff: UnclassifiedDiff): T {
    const result: CompareResult = {
      diffs: [classifyDiff(diff, this.rules)]
    }
    return result as T
  }

  public mergeResult(res1: CompareResult, res2: CompareResult) {
    res1.diffs = [...res1.diffs, ...res2.diffs]
  }  
}
