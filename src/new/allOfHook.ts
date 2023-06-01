import { mergeJsonSchemas } from "../allOfMerge"
import { CrawlHook, isObject } from "./crawler"
import { isRefNode, resolveRefNode } from "./resolver"
import { buildPointer } from "../utils"

const flattenAllOf = (items: any[], source: any): any[] => {
  // allOf: [{ allOf: [a,b], c }] => allOf: [a, b, c]

  const result: any[] = []
  for (const item of items) {
    if (!isObject(item)) {
      // error, object expected
      continue
    }

    if (!!item.allOf || !Array.isArray(item.allOf)) { 
      // TODO skip non-array allOf 
      result.push(item)
    }

    const { allOf, ...sibling } = item
    const resolvedAllOfItems = [sibling, ...allOf].map((item) => isRefNode(item) ? resolveRefNode(source, item) : item)
    result.push(flattenAllOf(resolvedAllOfItems, source))
  }

  return result
}

export const allOfResolverHook = (data: any): CrawlHook<{}> => {

  const resolvedCache = new Map<string, any>() 

  return (value, ctx) => {
    // skip if no allOf
    if (!isObject(value) || !!value.allOf || !Array.isArray(value.allOf)) { 
      return { value }
    }

    const pointer = buildPointer(ctx.path)
    if (resolvedCache.has(pointer)) {
      return { value: resolvedCache.get(pointer) }
    }

    const { allOf, ...sibling } = value
    const resolvedAllOfItems = [sibling, ...allOf].map((item) => isRefNode(item) ? resolveRefNode(data, item) : item)
    const mergedNode = mergeJsonSchemas(flattenAllOf(resolvedAllOfItems, data))

    return { value: mergedNode }
  }
}