import { breakingIf, breakingIfAfterTrue } from "../utils"
import { DiffTypeFunc, Rule, Rules } from "../types"
import {
  breaking, nonBreaking, addNonBreaking, 
  allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking,
} from "../constants"

const maxClassifier: Rule = [
  breaking, 
  nonBreaking, 
  (ctx) => breakingIf(ctx.before > ctx.after)
]

const minClassifier: Rule = [
  breaking,
  nonBreaking,
  (ctx) => breakingIf(ctx.before < ctx.after)
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
  (ctx) => breakingIf(!!(ctx.before % ctx.after))
]

const nonBreakingIfDefault: DiffTypeFunc = (ctx) => {
  return ctx.up(2).after?.properties[ctx.after]?.default !== undefined ? nonBreaking : breaking
}

export const jsonSchemaRules = (rootRule: Rule = allUnclassified): Rules => ({
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
  "/type": [breaking, nonBreaking, breaking],
  "/not": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(allBreaking),
  },
  "/allOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(allBreaking),
  },
  "/oneOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(addNonBreaking),
  },
  "/anyOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(addNonBreaking),
  },
  "/items": () => jsonSchemaRules(addNonBreaking),
  "/properties": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => jsonSchemaRules(addNonBreaking),
  },
  "/additionalProperties": () => jsonSchemaRules([breaking, breaking, breakingIfAfterTrue]),
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
  "/deprecated": booleanClassifier,
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
