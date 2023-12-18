import { booleanClassifier, jsonSchemaKeyChange, jsonSchemaRules, transformJsonSchema, transformJsonSchemaCombiners } from "../jsonSchema"
import { reverseClassifyRuleTransformer, transformComapreRules } from "../utils"
import { transformGraphSchema } from "./graphapi.transform"
import { allAnnotation, allDeprecated } from "../core"
import type { CompareRules } from "../types"

export const graphApiSchemaRules = (response = false): CompareRules => {

  const graphApiDirectiveRules: CompareRules = {
    "/*": { $: allAnnotation },
    "/meta": { $: allAnnotation }
  }

  const graphSchemaRules = jsonSchemaRules({ 
    notMergeAllOf: true,
    baseRules: {
      transform: [
        transformJsonSchemaCombiners(),
        transformJsonSchema(),
        transformGraphSchema
      ],
      // graphschema extentions
      "/nullable": { $: booleanClassifier, annotate: jsonSchemaKeyChange },
      "/specifiedByURL": { $: allAnnotation },
      "/args": () => ({
        ...transformComapreRules(graphSchemaRules, reverseClassifyRuleTransformer),
      }),
      "/values": {
        "/*": {
          "/description": { $: allAnnotation },
          "/deprecated": {
            $: allDeprecated,
            "/reason": { $: allDeprecated }
          }
        }
      },
      "/interfaces": {
        "/*": { $: allAnnotation }
      },
      "/directives": {
        "/*": () => graphApiDirectiveRules
      }
    },
  })

  return response 
    ? transformComapreRules(graphSchemaRules, reverseClassifyRuleTransformer)
    : graphSchemaRules
}
