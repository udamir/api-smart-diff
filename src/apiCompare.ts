import { Diff, ObjPath, BaseRulesType, Rules, ApiDiffOptions, JsonDiff, ApiMergedMeta, MatchFunc, CompareResult } from "./types"
import { getPathMatchFunc, getPathRules, isEmptyObject, mergeValues, PathPointer, resolveRef, setValueByPath } from "./utils"
import { asyncApi2Rules, jsonSchemaRules, openapi3Rules } from "./rules"
import { allUnclassified, DiffAction, unclassified } from "./constants"
import { JsonCompare } from "./jsonCompare"
import { ChangeContext } from "./changeContext"

const $renamed = Symbol("renamed")

export class ApiCompare extends JsonCompare<Diff> {
  public rules: Rules

  public beforeRefs: Set<string> = new Set()
  public afterRefs: Set<string> = new Set()
  public beforeCache: Map<string, any> = new Map()
  public afterCache: Map<string, any> = new Map()
  public compareCache: Map<string, { result: CompareResult<Diff>, merged: any }> = new Map()
  public renamedPath: any = {}
  public resolveUnchangedRefs: boolean

  constructor(public before: any, public after: any, options: ApiDiffOptions = {}) {
    super(before, after, options)
    this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules || {}
    this.formatMergedMeta = options.formatMergedMeta || this._formatMergeMeta.bind(this)
    this.resolveUnchangedRefs = options.resolveUnchangedRefs || false
    
    const externalRefs = options.externalRefs || {}
    for (const ref of Object.keys(externalRefs)) {
      this.beforeCache.set(ref, externalRefs[ref])
      this.afterCache.set(ref, externalRefs[ref])
    }
  }

  protected getMatchFunc(path: PathPointer): MatchFunc | undefined {
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

  public dereference(source: "before" | "after", value: any, objPath: PathPointer): [any, () => void] {
    const ref = "#" + objPath.ref

    const [refs, cache] = source === "before" 
      ? [this.beforeRefs, this.beforeCache] 
      : [this.afterRefs, this.afterCache]
    
    
    const clearCache = () => {
      // remove refs
      value.$ref && refs.delete(value.$ref)
      refs.delete(ref)
    }

    if (refs.has(value.$ref)) {
      return [value, clearCache]
    }

    refs.add(ref)
          
    value.$ref && refs.add(value.$ref)
    return [resolveRef(value, this[source], cache), clearCache]
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

    try {
      _diff.type = typeof changeType === "function" 
        ? changeType(new ChangeContext(this, diff.path))
        : changeType
    
      return _diff      
    } catch (error) {
      _diff.type = unclassified
      return _diff
    }
  }

  public resolvePath = (source: "before" | "after", objPath: ObjPath) => {
    const cache = source === "before" ? this.beforeCache : this.afterCache

    let value = this[source]
    for (const key of objPath) {
      const _value = Array.isArray(value) ? value[+key] : value[key]
      if (_value === undefined && value.$ref) {
        value = resolveRef(value, this[source], cache)
        value = Array.isArray(value) ? value[+key] : value[key]
      } else {
        value = _value
      }
      if (value === undefined) {
        break
      }
    }

    return value.$ref ? resolveRef(value, this[source], cache) : value
  }
  
  public getRenamedPath (objPath: ObjPath) {
    const renamedPath = [...objPath]
    let _path = this.renamedPath
    for (let i = 0; i < objPath.length; i++) {
      const key = objPath[i]
      if (_path[key] === undefined) { break }
      _path = _path[key]
      if (_path[$renamed]) {
        renamedPath[i] = _path[$renamed]
      }
    }
    return renamedPath
  }
  
  public compareResult(diff: JsonDiff) {
    if (diff.action === DiffAction.rename) {
      setValueByPath(this.renamedPath, [ ...diff.path, diff.before, $renamed], diff.after)
    }
    return super.compareResult(this.classifyDiff(diff))
  }

  public compareObjects(before: any, after: any, objPath: PathPointer, merged: any) {
    const { $ref: beforeRef, ...$before} = before
    const { $ref: afterRef, ...$after} = before
    const compareRefsId = beforeRef ? beforeRef === afterRef ? beforeRef : `${beforeRef}:${afterRef}` : "#" + objPath.ref

    const compareCache = this.compareCache.get(compareRefsId)
    if (compareCache && (isEmptyObject($before) && isEmptyObject($after) || !beforeRef && !afterRef)) {
      if (!compareCache.result.diffs.length && !this.resolveUnchangedRefs) {
        return super.compareObjects(before, after, objPath, merged)
      } 
      mergeValues(merged, compareCache.merged)
      const diffs = compareCache.result.diffs.map((diff) => ({ ...diff, path: [...objPath, ...diff.path] }))
      return { ...compareCache.result, diffs }
    }

    const [_before, clearBeforeCache ] = this.dereference("before", before, objPath)
    const [_after, clearAfterCache] = this.dereference("after", after, objPath)

    const _merged = Array.isArray(merged) ? [] : {}

    // compare $before and $after
    let result = super.compareObjects(_before, _after, objPath, merged)

    if (beforeRef && afterRef && isEmptyObject($before) && isEmptyObject($after)) {
      const diffs = result.diffs.map((diff) => ({ ...diff, path: diff.path.slice(objPath.items.length) }))
      this.compareCache.set(compareRefsId, { result: { ...result, diffs }, merged })
    }

    clearAfterCache()
    clearBeforeCache()

    if (beforeRef && beforeRef === afterRef && !result.diffs.length && !this.resolveUnchangedRefs) {
      if (Array.isArray(merged)) {
        merged.length = 0
      } else {
        Object.keys(merged).forEach(key => delete merged[key]);
      }
      result = super.compareObjects(before, after, objPath, merged)
    } else {
      mergeValues(merged, _merged)
    }

    return result
  }
}
