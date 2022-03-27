import { asyncApi2Rules, jsonSchemaRules, openapi3Rules } from "./rules"
import { BaseRulesType, DiffOptions, Rules } from "./types"

export class DiffContext implements DiffOptions {
  public rules?: Rules

  public beforeRefs: Set<string> = new Set()
  public afterRefs: Set<string> = new Set()
  public cache: Map<string, any> = new Map()
  public findFirstDiff = false

  public trimStrings?: boolean
  public caseSensitive?: boolean
  public strictArrays?: boolean

  constructor(public before: any, public after: any, options: DiffOptions) {
    this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules
    this.trimStrings = options.trimStrings 
    this.caseSensitive = options.caseSensitive 
    this.strictArrays = options.strictArrays 

    const externalRefs = options.externalRefs || {}
    for (const ref of Object.keys(externalRefs)) {
      this.cache.set(ref, externalRefs[ref])
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
