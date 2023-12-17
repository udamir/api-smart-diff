import { transformGraphApiComponents, transformGraphApiDirective, transformGraphApiDocument } from "./graphapi.transform"
import { allAnnotation, addNonBreaking } from "../constants"
import { graphApiSchemaRules } from "./graphapi.schema"
import type { CompareRules } from "../types"

export const graphApiRules = (): CompareRules => {  
  const argsSchemaRules = graphApiSchemaRules()
  const schemaRules = graphApiSchemaRules(true)

  return {
    transform: [transformGraphApiDocument],

    "/queries": {
      "/*": graphApiSchemaRules(true)
    },
    "/mutations": {
      "/*": schemaRules
    },
    "/subscriptions": {
      "/*": schemaRules
    },

    "/components": {
      transform: [transformGraphApiComponents],
      "/*": {
        "/*": schemaRules,
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
