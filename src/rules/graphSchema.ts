import { breakingIfAfterTrue } from "../utils"
import { DiffTypeFunc, Rule, Rules } from "../types"
import {
  breaking, nonBreaking, addNonBreaking, 
  allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated,
} from "../constants"

const booleanClassifier: Rule = [
  breakingIfAfterTrue,
  nonBreaking,
  breakingIfAfterTrue
]

const nonBreakingIfDefault: DiffTypeFunc = ({ after, up }) => up(2).after?.properties?.[after]?.default !== undefined ? nonBreaking : breaking

const graphApiDirectiveRules = (rootRule: Rule = allUnclassified): Rules => ({
  "/": rootRule,
  "/meta": allAnnotation,
})

const graphEnumValueRules = (rootRule: Rule = allUnclassified): Rules => ({
  "/": rootRule,
  "/description": allAnnotation,
  "/deprecationReason": allDeprecated,
})

export const graphSchemaRules = (rootRule: Rule = allUnclassified): Rules => ({
  "/": rootRule,
  "/title": allAnnotation,
  "/type": {
    "/": [breaking, nonBreaking, breaking],
    "/*": [nonBreaking, breaking, breaking]
  },
  "/description": allAnnotation,
  "/required": {
    "/": onlyAddBreaking,
    "/*": [nonBreakingIfDefault, nonBreaking, nonBreakingIfDefault],
  },
  "/enum": {
    "/": [breaking, nonBreaking, breaking],
    "/*": [nonBreaking, breaking, breaking],
  },
  "/allOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => graphSchemaRules(allBreaking),
  },
  "/oneOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => graphSchemaRules(addNonBreaking),
  },
  "/items": () => graphSchemaRules(addNonBreaking),
  "/properties": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => graphSchemaRules(addNonBreaking),
  },
  "/format": [breaking, nonBreaking, breaking],
  "/default": [nonBreaking, breaking, breaking],
  "/nullable": booleanClassifier,
  "/example": allAnnotation,
  "/deprecated": allDeprecated,

  "/directives": {
    "/*": graphApiDirectiveRules(addNonBreaking),
  },
  // Custom field for args
  "/args": () => graphSchemaRules(addNonBreaking),
  // Custom field for interfaces (for object type only)
  "/interfaces": allAnnotation,
  // Custom field for enum with description or deprecation
  "/values": {
    "/*": graphEnumValueRules(allAnnotation),
  },
  // Custom field for scalar types
  "/specifiedByURL": allAnnotation
})
