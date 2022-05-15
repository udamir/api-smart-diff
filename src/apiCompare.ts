import { Diff, ObjPath, BaseRulesType, Rules, ApiDiffOptions, JsonDiff, ApiMergedMeta, MatchFunc, CompareResult } from "./types"
import { buildPath, getPathMatchFunc, getPathRules, getValueByPath, isEmptyObject, mergeValues, parsePath } from "./utils"
import { asyncApi2Rules, jsonSchemaRules, openapi3Rules } from "./rules"
import { allUnclassified, DiffAction } from "./constants"
import { JsonCompare } from "./jsonCompare"

export class ApiCompare extends JsonCompare<Diff> {
  public rules: Rules

  public beforeRefs: Set<string> = new Set()
  public afterRefs: Set<string> = new Set()
  public beforeCache: Map<string, any> = new Map()
  public afterCache: Map<string, any> = new Map()
  public compareCache: Map<string, { result: CompareResult<Diff>, merged: any }> = new Map()

  constructor(public before: any, public after: any, options: ApiDiffOptions = {}) {
    super(before, after, options)
    this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules || {}
    this.formatMergedMeta = options.formatMergedMeta || this._formatMergeMeta.bind(this)
    
    const externalRefs = options.externalRefs || {}
    for (const ref of Object.keys(externalRefs)) {
      this.beforeCache.set(ref, externalRefs[ref])
      this.afterCache.set(ref, externalRefs[ref])
    }
  }

  protected getMatchFunc(path: ObjPath): MatchFunc | undefined {
    return getPathMatchFunc(this.rules, path, this.before) || super.getMatchFunc(path)
  }

  static apiDiff (before: any, after: any, options: ApiDiffOptions = {}): Diff[] {
    return new ApiCompare(before, after, options).compare()
  }
  
  static apiDiffTree (before: any, after: any, options: ApiDiffOptions = {}): any {
    return new ApiCompare(before, after, options).buildDiffTree()
  }
  
  static apiMerge (before: any, after: any, options: ApiDiffOptions = {}): any {
    return new ApiCompare(before, after, options).merge()
  }

  protected _formatMergeMeta = (diff: Diff): ApiMergedMeta => {
    return { 
      type: diff.type,
      action: diff.action,
      ...diff.action === DiffAction.replace || diff.action === DiffAction.rename ? { replaced: diff.before } : {},
    } 
  }

  public dereference(source: "before" | "after", value: any, objPath: ObjPath): [any, () => void] {
    const ref = "#" + buildPath(objPath)

    const [refs, cache] = source === "before" 
      ? [this.beforeRefs, this.beforeCache] 
      : [this.afterRefs, this.afterCache]
    

    const { $ref, ...rest } = value

    const clearCache = () => {
      // remove refs
      $ref && refs.delete($ref)
      refs.delete(ref)
    }

    if (refs.has($ref)) {
      return [value, clearCache]
    }

    refs.add(ref)

    if ($ref) {
      refs.add($ref)
      const [external, path] = $ref.split("#")
  
      // resolve external obj 
      if (external && !cache.has(external)) {
        return [value, clearCache]
      }

      const refValue = getValueByPath(external ? cache.get(external) : this[source], parsePath(path))
      return [!isEmptyObject(rest) ? mergeValues(refValue, rest) : refValue, clearCache]
    }

    return [value, clearCache]
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
    if (diff.action === "test") { 
      return _diff
    }
  
    const path = diff.action === "rename" ? [...diff.path, "*", ""] : [...diff.path, ""]
    const rule = getPathRules(this.rules, path, this.merged)
    const classifier = Array.isArray(rule) ? rule : allUnclassified
  
    const index = diff.action === "rename" ? 2 : ["add", "remove", "replace"].indexOf(diff.action)
    const changeType = classifier[index]
  
    const parentPath = diff.path.slice(0, diff.path.length - (diff.action === "add" || diff.action === "remove" ? 2 : 1))  
    const befor = getValueByPath(this.before, parentPath)
    // TODO: convert before path to after path in case of rename
    const after = getValueByPath(this.after, parentPath) 

    _diff.type = typeof changeType === "function" 
      ? changeType(diff.before, diff.after, befor, after)
      : changeType
  
    return _diff
  }
  
  public compareResult(diff: JsonDiff) {
    return super.compareResult(this.classifyDiff(diff))
  }

  public compareObjects(before: any, after: any, objPath: ObjPath, merged: any) {
    const { $ref: beforeRef, ...$before} = before
    const { $ref: afterRef, ...$after} = before
    const compareRefsId = beforeRef ? beforeRef === afterRef ? beforeRef : `${beforeRef}:${afterRef}` : "#" + buildPath(objPath)

    const compareCache = this.compareCache.get(compareRefsId)
    if (compareCache && (isEmptyObject($before) && isEmptyObject($after) || !beforeRef && !afterRef)) {
      mergeValues(merged, compareCache.merged)
      const diffs = compareCache.result.diffs.map((diff) => ({ ...diff, path: [...objPath, ...diff.path] }))
      return { ...compareCache.result, diffs }
    }

    const [_before, clearBeforeCache ] = this.dereference("before", before, objPath)
    const [_after, clearAfterCache] = this.dereference("after", after, objPath)

    // compare $before and $after
    const result = super.compareObjects(_before, _after, objPath, merged)

    if (beforeRef && afterRef && isEmptyObject($before) && isEmptyObject($after)) {
      const diffs = result.diffs.map((diff) => ({ ...diff, path: diff.path.slice(objPath.length) }))
      this.compareCache.set(compareRefsId, { result: { ...result, diffs }, merged })
    }

    clearAfterCache()
    clearBeforeCache()

    return result
  }
}
