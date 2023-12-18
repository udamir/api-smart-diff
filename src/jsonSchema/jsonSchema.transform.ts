import { jsonSchemaMergeRules, merge } from "allof-merge"

import { createEmptyCombiner, inferTypes, mergeAllOfSibling, mergeCombinarySibling, mergeRefSibling } from "./jsonSchema.utils"
import type { CompareTransformResolver, TransformResolver } from "../types"
import { jsonSchemaAllowedSibling } from "./jsonSchema.consts"
import { compareTransformationFactory } from "../core"
import { isArray, isObject, isString } from "../utils"

export const valuesTransformation = <T = unknown>(values: Record<"before" | "after", T>, resolver: TransformResolver<T>) => {
  values.before = resolver(values.before, values.after)
  values.after = resolver(values.after, values.before)
}

export const transformJsonSchemaCombiners = (allowedSibling = jsonSchemaAllowedSibling): CompareTransformResolver => (before, after) => {
  if (!isObject(before) || !isObject(after)) { return [before, after] }

  const values = { before, after }

  valuesTransformation(values, (value) => {
    if ("oneOf" in value) {
      return mergeCombinarySibling(value, "oneOf", allowedSibling)
    } else if ("anyOf" in value) {
      return mergeCombinarySibling(value, "anyOf", allowedSibling)
    } else if ("allOf" in value) {
      return mergeAllOfSibling(value, allowedSibling)
    } else if ("$ref" in value) {
      return mergeRefSibling(value, allowedSibling)
    }
    return value
  })

  for (const prop of ["oneOf", "anyOf"]) {
    if ((prop in values.before) && !("oneOf" in values.after || "anyOf" in values.after)) {
      return [values.before, createEmptyCombiner(values.after, prop, allowedSibling)]
    } else if (prop in values.after && !("oneOf" in values.before || "anyOf" in values.before)) {
      return [createEmptyCombiner(values.before, prop, allowedSibling), values.after]
    }
  }

  return [values.before, values.after]
}

export const transformJsonSchema = (version: "draft-04" | "2020-12" = "2020-12"): CompareTransformResolver => (before, after) => {
  if (!isObject(before) || !isObject(after)) {
    return [before, after]
  }
  const values = { before: { ...before }, after: { ...after } }
  
  // create missing properties: enum, required, properties, items, definitions
  valuesTransformation(values, (value, other) => {
    for (const prop of ["enum", "required", "properties", "patternProperties", "definitions", "examples"]) {
      if (prop in other && isObject(other[prop]) && !(prop in value)) {
        value[prop] = Array.isArray(other[prop]) ? [] : {}
      }
    }
    return value
  })

  valuesTransformation(values, (value, other) => {
    // transform const into enum
    if ("const" in value && "enum" in other) {
      const { const: v, ...rest } = value
      return { ...rest, enum: [v] }      
    }
    
    return value
  })

  valuesTransformation(values, (value) => {
    // remove not unique items from enum
    if (Array.isArray(value.enum)) {
      value.enum = value.enum.filter((v, i, arr) => arr.indexOf(v) === i)
    }
    return value
  })

  valuesTransformation(values, (value) => {
    // remove not unique items from required
    if ("required" in value && Array.isArray(value.required)) {
      const required = value.required.filter((v, i, arr) => isString(v) && arr.indexOf(v) === i)
      return { ...value, required }
    }

    return value
  })

  valuesTransformation(values, (value, other) => {
    // transform items
    if ("items" in other && isArray(other.items)) {
      if ("items" in value && typeof value.items === "object") {
        return isArray(value.items) ? value : {...value, items: other.items.map(() => value.items), additionalItems: value.items }
      } else {
        return { ...value, items: [] }
      }
    }
  
    return value
  })

  valuesTransformation(values, (value, other) => {
    if (!("type" in value) && "type" in other) {
      const types = inferTypes(value)
      if (types.length) {
        value.type = isString(other.type) && types.includes(other.type) ? other.type : types
      }
    }
    return value
  })

  valuesTransformation(values, (value) => {
    // 1. convert exclusiveMinimum from boolean to number
    // 2. remove minimum if exclusiveMinimum exists
    if ("exclusiveMinimum" in value && typeof value.exclusiveMinimum === "boolean" && "minimum" in value) {
      const { minimum, exclusiveMinimum, ...rest } = value
      return { ...rest, exclusiveMinimum: minimum }
    }
    return value
  })

  valuesTransformation(values, (value) => {
    // 1. convert exclusiveMaximum from boolean to number
    // 2. remove maximum if exclusiveMaximum exists
    if ("exclusiveMaximum" in value && typeof value.exclusiveMaximum === "boolean" && "maximum" in value) {
      const { maximum, exclusiveMaximum, ...rest } = value
      return { ...rest, exclusiveMaximum: maximum }
    }
    return value
  })

  valuesTransformation(values, (value, other) => {
    // convert example to array of examples
    if ("example" in value && "examples" in other) {
      const { example, ...rest } = value
      const examples = "examples" in value && Array.isArray(value.examples) ? value.examples : []
      return { ...rest, examples: [...examples, example] }
    }
    return value
  })
  
  return [values.before, values.after]
}

export const jsonSchemaMergeAllOf = (version: "draft-04" | "2020-12") => compareTransformationFactory((value) => {
  const draft = version === "draft-04" ? version : "draft-06"
  return merge(value, { rules: jsonSchemaMergeRules(draft), mergeCombinarySibling: true, mergeRefSibling: true })
})
