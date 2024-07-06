import { graphapiMergeRules, merge } from "allof-merge"

import { graphApiComponents, graphApiOperations, graphSchemaCustomProps } from "./graphapi.const"
import { compareTransformationFactory } from "../core"

export const transformGraphApiComponents = compareTransformationFactory((value, other) => {
  if (typeof value !== 'object' || !value || typeof other !== 'object' || !other) { return value }
  const result: any = { ...value }
  
  for (const comp of Object.values(graphApiComponents)) {
    // add empty component
    if (!(comp in value) && (comp in other)) {
      result[comp] = {}
    }
  }
  
  return result
})

export const transformGraphSchema = compareTransformationFactory((value, other) => {
  if (typeof value !== 'object' || !value || typeof other !== 'object' || !other) { return value }
  const { nullable, ...result}: any = { ...value }
  
  for (const comp of graphSchemaCustomProps) {
    // add empty component
    if (!(comp in value) && (comp in other)) {
      result[comp] = {}
    }

    // add empty values items
    if (comp === "values" && comp in other) {
      const items = other[comp] as object
      for (const item of Object.keys(items)) {
        if (item in result[comp]) { continue }
        result[comp][item] = {}
      }
    }
  }

  if (nullable) {
    result.nullable = nullable
  }
  
  return result
})

export const transfromGraphSchemaDirective = compareTransformationFactory((value, other) => {
  if (typeof value !== 'object' || !value || typeof other !== 'object' || !other ) { return value }

  if ("meta" in value) {
    const { meta, ...rest } = value
    return { meta }
  } 
  if ("meta" in other) {
    return { meta: {} }
  }

  return {}
})

export const transformGraphApiDocument = compareTransformationFactory((value, other) => {
  if (typeof value !== 'object' || !value || typeof other !== 'object' || !other) { return value }
  const result: any = { ...value }
  
  for (const comp of Object.values(graphApiOperations)) {
    // add empty component
    if (!(comp in value) && (comp in other)) {
      result[comp] = {}
    }
  }

  return result
})

export const transformGraphApiDirective = compareTransformationFactory((value, other) => {
  if (typeof value !== 'object' || !value || typeof other !== 'object' || !other) { return value }
  const result: any = { ...value }
  
  // add empty args object
  if (!("args" in value) && ("args" in other)) {
    result.args = {
      type: "object",
      properties: {}
    }
  }

  // add empty location array
  if (!("locations" in value) && ("locations" in other)) {
    result.locations = []
  }

  return result
})

export const graphApiMergeAllOf = compareTransformationFactory((value) => {
  return merge(value, { rules: graphapiMergeRules, mergeCombinarySibling: true, mergeRefSibling: true })
})
