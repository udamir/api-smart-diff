import { transformGraphApiComponents, transformGraphApiDirective, transformGraphApiDocument, transformGraphSchema } from "./graphapi.transform"
import { allAnnotation, addNonBreaking, allDeprecated } from "../constants"
import { graphApiSchemaRules } from "./graphapi.schema"
import { jsonSchemaRules } from "../jsonSchema"
import type { CompareRules } from "../types"

export const graphApiRules = (): CompareRules => {
  const graphSchemaRules = (): CompareRules => {
    const schemaRules = jsonSchemaRules()
    return {
      ...schemaRules,
      transform: [...schemaRules.transform ?? [], transformGraphSchema],
      "/specifiedByURL": { $: allAnnotation },
      "/args": () => ({
        ...argsSchemaRules
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
    }
  }
  
  const argsSchemaRules = graphApiSchemaRules(graphSchemaRules())
  const resultSchemaRules = graphApiSchemaRules(graphSchemaRules(), true)

  const graphApiDirectiveRules: CompareRules = {
    "/*": { $: allAnnotation },
    "/meta": { $: allAnnotation }
  }
  
  return {
    transform: [transformGraphApiDocument],

    "/queries": {
      "/*": resultSchemaRules
    },
    "/mutations": {
      "/*": resultSchemaRules
    },
    "/subscriptions": {
      "/*": resultSchemaRules
    },

    "/components": {
      transform: [transformGraphApiComponents],
      "/*": {
        "/*": resultSchemaRules,
      },
      "/directives": {
        "/*": {
          transform: [transformGraphApiDirective],
          $: addNonBreaking,
          "/title": { $: allAnnotation },
          "/description": { $: allAnnotation },
          "/locations": { $: allAnnotation },
          "/repeatable": { $: allAnnotation }, 
          "/args": argsSchemaRules,
        },
      },
    }
  }
}
