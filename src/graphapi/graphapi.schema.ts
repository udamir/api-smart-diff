import { booleanClassifier, jsonSchemaKeyChange, jsonSchemaRules, transformJsonSchema, transformJsonSchemaCombiners } from "../jsonSchema"
import { reverseClassifyRule, transformComapreRules } from "../utils"
import type { CompareRules, CompareRulesTransformer } from "../types"
import { allAnnotation, allDeprecated } from "../constants"
import { transformGraphSchema } from "./graphapi.transform"

export const graphApiSchemaRules = (response = false): CompareRules => {

  const argsRuleTransformer: CompareRulesTransformer = (value) => {
    const _value = { ...value }
    
    // reverse classify rules
    if ("$" in _value && Array.isArray(_value.$)) {
      _value.$ = reverseClassifyRule(_value.$)
    }
    return _value
  }

  const jsonSchemaTransformer: CompareRulesTransformer = (value) => {
    const _value = { ...value }
    
    // reverse classify rules
    if (response && "$" in _value && Array.isArray(_value.$)) {
      _value.$ = reverseClassifyRule(_value.$)
    }
    // convert annotations
    // if ("annotate" in _value && _value.annotate) {
    //   _value.annotate = graphApiSchemaAnnotate(_value.annotate)
    // }
    return _value
  }

  const graphApiDirectiveRules: CompareRules = {
    "/*": { $: allAnnotation },
    "/meta": { $: allAnnotation }
  }

  const graphSchemaRules = jsonSchemaRules({ 
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
        ...transformComapreRules(graphSchemaRules, argsRuleTransformer),
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

  return transformComapreRules(graphSchemaRules, jsonSchemaTransformer)
}
