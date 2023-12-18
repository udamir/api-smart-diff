import { 
  booleanClassifier, jsonSchemaAllowedSibling, jsonSchemaKeyChange, jsonSchemaRules, 
  schemaAnnotationChange, transformJsonSchema, transformJsonSchemaCombiners
} from "../jsonSchema"
import { reverseClassifyRuleTransformer, transformComapreRules, allAnnotation, allUnclassified } from "../core"
import type { OpenApi3SchemaRulesOptions } from "./openapi3.types"
import { transformOpenApiSchema } from "./openapi3.transform"
import type { CompareRules } from "../types"

export const openApiSchemaRules = (options: OpenApi3SchemaRulesOptions = {}): CompareRules => {
  const version = options.version === "3.0.x" ? "draft-04" : "2020-12"

  const schemaRules = jsonSchemaRules({ 
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
  })

  return options.response 
    ? transformComapreRules(schemaRules, reverseClassifyRuleTransformer) 
    : schemaRules
}
