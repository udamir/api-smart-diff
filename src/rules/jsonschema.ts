import { breakingIf, breakingIfAfterTrue } from "../utils"
import { DiffTypeFunc, Rule, Rules } from "../types"
import {
  breaking, nonBreaking, addNonBreaking,
  allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated, JsonSchemaLocation,
} from '../constants'

const maxClassifier: Rule = [
  breaking, 
  nonBreaking, 
  ({ before, after }) => breakingIf(before > after)
]

const minClassifier: Rule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(before < after)
]

const exclusiveClassifier: Rule = [
  breakingIfAfterTrue, 
  nonBreaking, 
  breakingIfAfterTrue
]

const booleanClassifier: Rule = [
  breakingIfAfterTrue,
  nonBreaking,
  breakingIfAfterTrue
]

const multipleOfClassifier: Rule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(!!(before % after))
]

const additionalPropertiesClassifier = (location?: JsonSchemaLocation): Rule => [
  breaking,
  breaking,
  ({ after }) => (after === true && location === JsonSchemaLocation.requestBody ? nonBreaking : breakingIf(after)),
]

const nonBreakingIfDefault: DiffTypeFunc = ({ after, up }) => up(2).after?.properties?.[after]?.default !== undefined ? nonBreaking : breaking

export const jsonSchemaRules = (rootRule: Rule = allUnclassified, location?: JsonSchemaLocation): Rules => ({
  "/": rootRule,
  "/title": allAnnotation,
  "/multipleOf": multipleOfClassifier,
  "/maximum": maxClassifier,
  "/exclusiveMaximum": exclusiveClassifier,
  "/minimum": minClassifier,
  "/exclusiveMinimum": exclusiveClassifier,
  "/maxLength": maxClassifier,
  "/minLength": minClassifier,
  "/pattern": [breaking, nonBreaking, breaking], // TODO: Compare Regex before vs after
  "/maxItems": maxClassifier,
  "/minItems": minClassifier,
  "/uniqueItems": booleanClassifier,
  "/maxProperties": maxClassifier,
  "/minProperties": minClassifier,
  "/required": {
    "/": onlyAddBreaking,
    "/*": [nonBreakingIfDefault, nonBreaking, nonBreakingIfDefault],
  },
  "/enum": {
    "/": [breaking, nonBreaking, breaking],
    "/*": [nonBreaking, breaking, breaking],
  },
  "/type": {
    "/": [breaking, nonBreaking, breaking],
    "/*": [nonBreaking, breaking, breaking]
  },
  "/not": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(allBreaking, location),
  },
  "/allOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(allBreaking, location),
  },
  "/oneOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(addNonBreaking, location),
  },
  "/anyOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(addNonBreaking, location),
  },
  "/items": () => jsonSchemaRules(addNonBreaking, location),
  "/properties": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(addNonBreaking, location),
  },
  "/additionalProperties": () => jsonSchemaRules(additionalPropertiesClassifier(location), location),
  "/description": allAnnotation,
  "/format": [breaking, nonBreaking, breaking],
  "/default": [nonBreaking, breaking, breaking],
  "/nullable": booleanClassifier,
  "/discriminator": {
    // TODO
    "/": allUnclassified,
    "/propertyName": allUnclassified,
    "/mapping": allUnclassified,
  },
  "/readOnly": booleanClassifier,
  "/writeOnly": booleanClassifier,
  "/example": allAnnotation,
  "/examples": allAnnotation,
  "/externalDocs": allAnnotation,
  "/deprecated": allDeprecated,
  "/xml": {
    // TODO
    "/": allUnclassified,
    "/name": allUnclassified,
    "/namespace": allUnclassified,
    "/prefix": allUnclassified,
    "/attribute": allUnclassified,
    "/wrapped": allUnclassified,
  },
})
