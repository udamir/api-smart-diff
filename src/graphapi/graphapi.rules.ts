import {
  graphApiMergeAllOf,
  transformGraphApiComponents,
  transformGraphApiDirective,
  transformGraphApiDocument,
} from "./graphapi.transform"
import { allAnnotation, addNonBreaking } from "../core/constants"
import { parentKeyChangeAnnotation } from "./graphapi.annotate"
import { graphApiSchemaRules } from "./graphapi.schema"
import { enumMappingResolver } from "../jsonSchema"
import type { CompareRules } from "../types"

export type GraphApiRulesOptions = {
  notMergeAllOf?: boolean
}

export const graphApiRules = ({ notMergeAllOf = false }: GraphApiRulesOptions = {}): CompareRules => {
  const argsSchemaRules = graphApiSchemaRules()
  const schemaRules = graphApiSchemaRules(true)

  return {
    transform: [...(notMergeAllOf ? [] : [graphApiMergeAllOf]), transformGraphApiDocument],

    "/queries": {
      "/*": schemaRules,
    },
    "/mutations": {
      "/*": schemaRules,
    },
    "/subscriptions": {
      "/*": schemaRules,
    },

    "/components": {
      transform: [transformGraphApiComponents],
      "/*": {
        "/*": schemaRules,
      },
      "/directives": {
        "/*": {
          annotate: parentKeyChangeAnnotation,
          transform: [transformGraphApiDirective],
          $: addNonBreaking,
          // TODO annotations
          "/title": { $: allAnnotation },
          "/description": { $: allAnnotation },
          "/locations": {
            mapping: enumMappingResolver,
            $: allAnnotation,
          },
          "/repeatable": { $: allAnnotation },
          "/args": argsSchemaRules,
        },
      },
    },
  }
}
