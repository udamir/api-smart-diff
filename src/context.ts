import { Diff, BaseRulesType, DiffOptions, Rules, MergedKeyMeta, MergeOptions } from "./types"
import { asyncApi2Rules, jsonSchemaRules, openapi3Rules } from "./rules"
import { DiffAction, DIFF_META_KEY,  } from "./constants"

export class DiffContext implements DiffOptions {
  public rules?: Rules

  public beforeRefs: Set<string> = new Set()
  public afterRefs: Set<string> = new Set()
  public beforeCache: Map<string, any> = new Map()
  public afterCache: Map<string, any> = new Map()

  public trimStrings?: boolean
  public caseSensitive?: boolean
  public strictArrays?: boolean
  public arrayMeta?: boolean
  public circularRef?: boolean

  constructor(public before: any, public after: any, options: DiffOptions) {
    this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules
    this.trimStrings = options.trimStrings 
    this.caseSensitive = options.caseSensitive 
    this.strictArrays = options.strictArrays
    // this.circularRef = options.circularRef || false
    this.arrayMeta = options.arrayMeta || false

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
  
}

export class MergeContext extends DiffContext {
  public formatMeta: (diff: Diff) => MergedKeyMeta
  public metaKey: string | symbol

  constructor(before: any, after: any, options: MergeOptions) {
    super(before, after, options)
    this.formatMeta = options.formatMeta || ((d: Diff) => this._formatMeta(d))
    this.metaKey = options.metaKey || DIFF_META_KEY
  }

  private _formatMeta = (diff: Diff): MergedKeyMeta => {
    return { 
      type: diff.type,
      action: diff.action,
      ...diff.action === DiffAction.replace ? { replaced: diff.before } : {}
    } 
  }
}
