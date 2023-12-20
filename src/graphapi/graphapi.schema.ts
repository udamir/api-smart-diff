import { booleanClassifier, jsonSchemaKeyChange, jsonSchemaRules, transformJsonSchema, transformJsonSchemaCombiners } from "../jsonSchema"
import { reverseClassifyRuleTransformer, transformComapreRules, allAnnotation, allDeprecated, reverseClassifyRule, nonBreaking, breaking } from "../core"
import { transformGraphSchema, transfromGraphSchemaDirective } from "./graphapi.transform"
import type { CompareRules } from "../types"
import { directiveMetaChangeAnnotation, directiveChangeAnnotation } from "./graphapi.annotate"

export const graphApiSchemaRules = (response = false): CompareRules => {

  const graphSchemaRules = jsonSchemaRules({ 
    notMergeAllOf: true,
    baseRules: {
      transform: [
        transformJsonSchemaCombiners(),
        transformJsonSchema(),
        transformGraphSchema
      ],
      // graphschema extentions
      "/nullable": { $: [ nonBreaking, breaking, nonBreaking], annotate: jsonSchemaKeyChange },
      "/specifiedByURL": { $: allAnnotation },
      "/args": () => ({
        ...graphApiSchemaRules(),
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
        "/*": {
          annotate: directiveChangeAnnotation,
          transform: [transfromGraphSchemaDirective],
          "/meta": { 
            "/*": {
              annotate: directiveMetaChangeAnnotation,
              $: allAnnotation
            }
          }
        }
      }
    },
  })

  return response 
    ? transformComapreRules(graphSchemaRules, reverseClassifyRuleTransformer)
    : graphSchemaRules
}
