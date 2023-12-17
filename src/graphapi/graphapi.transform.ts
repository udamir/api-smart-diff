import { graphapiMergeRules, merge } from "allof-merge"

import { graphApiComponents, graphApiOperations, graphSchemaCustomProps } from "./graphapi.const"
import { compareTransformationFactory } from "../utils"

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
  const result: any = { ...value }
  
  for (const comp of graphSchemaCustomProps) {
    // add empty component
    if (!(comp in value) && (comp in other)) {
      result[comp] = {}
    }
  }
  
  return result
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
