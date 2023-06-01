import { DiffTypeFunc, ClassifyRule, ClassifyRules, DiffType } from "../types"
import {
  breaking, nonBreaking, addNonBreaking, 
  allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated,
} from "../constants"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue: DiffTypeFunc = ({ after }): DiffType => breakingIf(after)


const maxClassifier: ClassifyRule = [
  breaking, 
  nonBreaking, 
  ({ before, after }) => breakingIf(before > after)
]

const minClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(before < after)
]

const exclusiveClassifier: ClassifyRule = [
  breakingIfAfterTrue, 
  nonBreaking, 
  breakingIfAfterTrue
]

const booleanClassifier: ClassifyRule = [
  breakingIfAfterTrue,
  nonBreaking,
  breakingIfAfterTrue
]

const multipleOfClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(!!(before % after))
]

const nonBreakingIfDefault: DiffTypeFunc = ({ after, up }) => up(2).after?.properties?.[after]?.default !== undefined ? nonBreaking : breaking

export const jsonSchemaRules = (rootRule: ClassifyRule = allUnclassified): ClassifyRules => ({
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
