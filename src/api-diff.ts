import { IClassifiedDiff, Rules } from "./types"
import { classifyDiff } from "./classifier"
import { jsonDiff } from "./json-diff"
import { openapi3Rules, asyncApi2Rules, jsonSchemaRules } from "./rules"
import { BaseRulesType } from "."

const getBaseRules = (name: BaseRulesType): Rules => {
  switch (name) {
    case "OpenApi3": return openapi3Rules
    case "AsyncApi2": return asyncApi2Rules
    case "JsonSchema": return jsonSchemaRules()
  }
}

export const syncApiDiff = (before: any, after: any, rules: Rules | BaseRulesType): IClassifiedDiff[] => {
  rules = typeof rules === "string" ? getBaseRules(rules) : rules
  const diff = jsonDiff(before, after)
  return classifyDiff(rules, diff)
}

export const apiDiff = (before: any, after: any, rules: Rules | BaseRulesType): Promise<IClassifiedDiff[]> => {
  return new Promise((resolve, reject) => {
    try {
      resolve(syncApiDiff(before, after, rules))
    } catch (error) {
      reject(error)
    }
  })
}
