import { syncClone } from "json-crawl"

import { 
  booleanClassifier, jsonSchemaAllowedSibling, jsonSchemaKeyChange, jsonSchemaRules, 
  schemaAnnotationChange, transformJsonSchema, transformJsonSchemaCombiners
} from "../jsonSchema"
import type { ClassifyRule, ComapreContext, CompareRules, DiffType, DiffTypeClassifier } from "../types"
import { allAnnotation, allUnclassified, breaking, nonBreaking } from "../constants"
import type { OpenApi3SchemaRulesOptions } from "./openapi3.types"
import { transformOpenApiSchema } from "./openapi3.transform"
import { openApiSchemaAnnotate } from "./openapi3.annotate"
import { isObject } from "../utils"

const reverseDiffType = (diffType: DiffType | DiffTypeClassifier): DiffType | DiffTypeClassifier => {
  if (typeof diffType === "function") {
    return ((ctx: ComapreContext) => reverseDiffType(diffType(ctx))) as DiffTypeClassifier
  } else {
    switch (diffType) {
      case breaking: return nonBreaking
      case nonBreaking: return breaking
      default: return diffType
    }
  }
}

export const reverseClassifyRule = ([add, remove, replace]: ClassifyRule): ClassifyRule => {
  return [reverseDiffType(add), reverseDiffType(remove), reverseDiffType(replace)]
}

export const convertJsonSchemaRules = (rules: CompareRules, response = false): CompareRules => {
  return syncClone(rules, ({ value }) => {
    if (typeof value === "function") {
      return { value: (...args: unknown[]) => convertJsonSchemaRules(value(...args), response) }
    } else if (!Array.isArray(value) && isObject(value)) {
      const _value = { ...value } as CompareRules
      // reverse classify rules
      if (response && "$" in _value && Array.isArray(_value.$)) {
        _value.$ = reverseClassifyRule(_value.$)
      }
      // convert annotations
      if ("annotate" in _value && _value.annotate) {
        _value.annotate = openApiSchemaAnnotate(_value.annotate)
      }

      return { value: _value }
    }
  })
}

export const openApiSchemaRules = (options: OpenApi3SchemaRulesOptions = {}): CompareRules => {
  const version = options.version === "3.0.x" ? "draft-04" : "2020-12"
  return convertJsonSchemaRules(jsonSchemaRules({ 
    baseRules: {
      transform: [
        transformJsonSchemaCombiners([...jsonSchemaAllowedSibling, "discriminator"]),
        transformJsonSchema(version),
        transformOpenApiSchema
      ],
      // openapi extentions
      "/nullable": { $: booleanClassifier, annotate: jsonSchemaKeyChange },
      "/discriminator": { $: allUnclassified, annotate: schemaAnnotationChange },
      "/example": { $: allAnnotation, annotate: schemaAnnotationChange },
      "/externalDocs": { 
        $: allAnnotation, 
        annotate: schemaAnnotationChange,
        "/*": { $: allAnnotation }
      },
      "/xml": {},
    },
    notMergeAllOf: options.notMergeAllOf, 
    version
  }), options.response)
}
