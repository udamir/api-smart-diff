import { graphApiMergeAllOf, transformGraphApiComponents, transformGraphApiDirective, transformGraphApiDocument } from "./graphapi.transform"
import { allAnnotation, addNonBreaking } from "../core/constants"
import { graphApiSchemaRules } from "./graphapi.schema"
import type { CompareRules } from "../types"

export type GraphApiRulesOptions = {
  notMergeAllOf?: boolean
}

export const graphApiRules = ({ notMergeAllOf = false }: GraphApiRulesOptions = {}): CompareRules => {  
  const argsSchemaRules = graphApiSchemaRules()
  const schemaRules = graphApiSchemaRules(true)

  return {
    transform: [...notMergeAllOf ? [] : [graphApiMergeAllOf], transformGraphApiDocument],

    "/queries": {
      "/*": schemaRules
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
