import { 
  booleanClassifier, jsonSchemaAllowedSibling, jsonSchemaKeyChange, jsonSchemaRules, 
  schemaAnnotationChange, transformJsonSchema, transformJsonSchemaCombiners
} from "../jsonSchema"
import { reverseClassifyRule, transformComapreRules } from "../utils"
import type { CompareRules, CompareRulesTransformer } from "../types"
import type { OpenApi3SchemaRulesOptions } from "./openapi3.types"
import { transformOpenApiSchema } from "./openapi3.transform"
import { allAnnotation, allUnclassified } from "../constants"

export const openApiSchemaRules = (options: OpenApi3SchemaRulesOptions = {}): CompareRules => {
  const version = options.version === "3.0.x" ? "draft-04" : "2020-12"

  const jsonSchemaTransformer: CompareRulesTransformer = (value) => {
    const _value = { ...value }
    
    // reverse classify rules
    if (options.response && "$" in _value && Array.isArray(_value.$)) {
      _value.$ = reverseClassifyRule(_value.$)
    }
    // convert annotations
    // if ("annotate" in _value && _value.annotate) {
    //   _value.annotate = openApiSchemaAnnotate(_value.annotate)
    // }
    return _value
  }

  return transformComapreRules(jsonSchemaRules({ 
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
  }), jsonSchemaTransformer)
}
