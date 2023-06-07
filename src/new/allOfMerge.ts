
import { CloneHook, clone, isObject } from "./crawler"
import { isRefNode, resolveRefNode } from "./resolver"
import { buildPointer } from "../utils"
import { jsonSchemaMergeRules, mergeJsonSchema } from "./rules/merge/jsonschema"
import { ObjPath } from "../types"

const flattenAllOf = (items: any[], source: any): any[] => {
  // allOf: [{ allOf: [a,b], c }] => allOf: [a, b, c]

  const result: any[] = []
  for (const item of items) {
    if (!isObject(item)) {
      // error, object expected
      continue
    }

    if (!item.allOf || !Array.isArray(item.allOf)) { 
      // TODO skip non-array allOf 
      result.push(item)
      continue
    }

    const { allOf, ...sibling } = item
    const allOfItems = Object.keys(sibling).length ? [sibling, ...allOf] : allOf
    const resolvedAllOfItems = allOfItems.map((item) => isRefNode(item) ? resolveRefNode(source, item) : item)
    result.push(...flattenAllOf(resolvedAllOfItems, source))
  }

  return result
}

export const allOfResolverHook = (source: any): CloneHook<{}> => {

  const resolvedCache = new Map<string, any>() 

  const getAllOfRule = (path: ObjPath) => {
    let rules: any = jsonSchemaMergeRules

    for (const key of path) {
      let _key = `/${key}`
      if (!(_key in rules)) {
        _key = "/*"
      }

      rules = rules[_key]
      rules = typeof rules === "function" ? rules() : rules
      
      if (!rules) { return }
    }

    if ("/" in rules) {
      rules = rules["/"]
      rules = typeof rules === "function" ? rules() : rules
    }

    return rules["/allOf"]
  } 

  return (value, ctx) => {
    // check if current node is JsonSchema 
    
    const rules = getAllOfRule(ctx.path)

    // console.log(ctx.path, `JsonSchema: ${!!rules}`)

    if (!rules) { return { value } }

    // skip if no allOf
    if (!isObject(value) || !value.allOf || !Array.isArray(value.allOf)) { 
      return { value }
    }

    const pointer = buildPointer(ctx.path)
    if (resolvedCache.has(pointer)) {
      return { value: resolvedCache.get(pointer) }
    }

    const { allOf, ...sibling } = value
    const allOfItems = Object.keys(sibling).length ? [sibling, ...allOf] : allOf
    const resolvedAllOfItems = allOfItems.map((item) => isRefNode(item) ? resolveRefNode(source, item) : item)
    const mergedNode = mergeJsonSchema(...flattenAllOf(resolvedAllOfItems, source))

    return { value: mergedNode }
  }
}

export const merge = (value: any, source?: any) => {

  const hook = allOfResolverHook(source)

  return clone(value, hook, {})
}