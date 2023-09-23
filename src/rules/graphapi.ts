import { addNonBreaking, allAnnotation, allUnclassified } from "../constants"
import { graphSchemaRules } from "./graphSchema"
import { Rules } from "../types"

export const graphapiRules: Rules = {
  "/queries": {
    "/*": graphSchemaRules(addNonBreaking)
  },
  "/mutations": {
    "/*": graphSchemaRules(addNonBreaking)
  },
  "/subscriptions": {
    "/*": graphSchemaRules(addNonBreaking)
  },

  "/components": {
    "/scalars": {
      "/*": graphSchemaRules(addNonBreaking),
    },
    "/objects": {
      "/*": graphSchemaRules(addNonBreaking),
    },
    "/interfaces": {
      "/*": graphSchemaRules(addNonBreaking),
    },
    "/unions": {
      "/*": graphSchemaRules(addNonBreaking),
    },
    "/enums": {
      "/*": graphSchemaRules(addNonBreaking),
    },
    "/inputObjects": {
      "/*": graphSchemaRules(addNonBreaking),
    },
    "/directives": {
      "/*": {
        "/": addNonBreaking,
        "/title": allAnnotation,
        "/description": allAnnotation,
        "/locations": allAnnotation,
        "/repeatable": allUnclassified,  
        "/args": graphSchemaRules(addNonBreaking), // TODO breaking if required args without default value
      },
    },
  }
}
