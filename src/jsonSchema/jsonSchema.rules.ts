import { 
  breaking, nonBreaking,allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated, allNonBreaking,
} from "../constants"
import { 
  booleanClassifier, exclusiveClassifier, maxClassifier, minClassifier, multipleOfClassifier
} from "./jsonSchema.utils"
import { annotationChange, customChangeAnnotation, statusChange, validationChange } from "./jsonSchema.annotate"
import { ChangeAnnotationResolver, ClassifyRule, CompareRules } from "../types/rules"
import { compareCombinary, createCompareRefsResolver } from "./jsonSchema.compare"
import type { JsonSchemaRulesOptions } from "./jsonSchema.types"
import { jsonSchemaTransformers } from "./jsonSchema.transform"
import { mapSimpleEnumItemsRule } from "../resolvers/enum"

const annotationRule: CompareRules = { $: allAnnotation, annotate: annotationChange }
const simpleRule = (classify: ClassifyRule, annotate: ChangeAnnotationResolver) => ({ $: classify, annotate })

export const jsonSchemaRules = ({ transform = [], draft = "draft-06", reversClassifier = false }: JsonSchemaRulesOptions = {}): CompareRules => {
  const rules = {
    // important to createCompareRefResolver once for cycle refs cache
    compare: createCompareRefsResolver(),
    transform: [...jsonSchemaTransformers, ...transform],

    "/title": annotationRule,
    "/multipleOf": simpleRule(multipleOfClassifier, validationChange),
    "/maximum": simpleRule(maxClassifier, validationChange),
    "/exclusiveMaximum": simpleRule(exclusiveClassifier, validationChange),
    "/minimum": simpleRule(minClassifier, validationChange),
    "/exclusiveMinimum": simpleRule(exclusiveClassifier, validationChange),
    "/maxLength": simpleRule(maxClassifier, validationChange),
    "/minLength": simpleRule(minClassifier, validationChange),
    "/pattern": simpleRule([breaking, nonBreaking, breaking], validationChange),
    "/maxItems": simpleRule(maxClassifier, validationChange),
    "/minItems": simpleRule(minClassifier, validationChange),
    "/uniqueItems": simpleRule(booleanClassifier, validationChange),
    "/maxProperties": simpleRule(maxClassifier, validationChange),
    "/minProperties": simpleRule(minClassifier, validationChange),
    "/required": {
      $: onlyAddBreaking,
      mapping: mapSimpleEnumItemsRule,
      // TODO: "/*": { $: [nonBreakingIfDefault, nonBreaking, nonBreakingIfDefault] },
    },
    "/enum": {
      "/*": { $: [nonBreaking, breaking, breaking] },
      $: [breaking, nonBreaking, breaking],
      mapping: mapSimpleEnumItemsRule,
      annotate: customChangeAnnotation("possbile values")
    },
    "/type": {
      $: [breaking, nonBreaking, breaking],
      "/*": { $: [nonBreaking, breaking, breaking] },
    },
    "/not": () => ({ ...rules, $: allBreaking }),
    "/allOf": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ ...rules, $: allBreaking }),
      compare: compareCombinary
    },
    "/oneOf": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ ...rules, $: allNonBreaking }),
      compare: compareCombinary
    },
    "/anyOf": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ ...rules, $: allNonBreaking }),
      compare: compareCombinary
    },
    "/items": () => ({ ...rules, $: allNonBreaking }),
    "/properties": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ ...rules, $: allNonBreaking }),
    },
    "/additionalProperties": () => ({ ...rules, $: allNonBreaking }),
    "/description": annotationRule,
    "/format": { $: [breaking, nonBreaking, breaking], annotate: customChangeAnnotation("value format") },
    "/default": { $: [nonBreaking, breaking, breaking], annotate: customChangeAnnotation("default value") },
    "/dependencies": {

    },
    
    ...["draft-00", "draft-04"].includes(draft) ? {
      "/definitions": {},
    } : {},

    ...["draft-06", "openapi31schema"].includes(draft) ? {
      "/readOnly": { $: booleanClassifier, annotate: statusChange },
      "/writeOnly": { $: booleanClassifier, annotate: statusChange },
      "/deprecated": { $: allDeprecated, annotate: statusChange },
      "/examples": annotationRule,
    } : {},
    
    ...["openapi30schema"].includes(draft) ? {
      "/readOnly": { $: booleanClassifier, annotate: statusChange },
      "/writeOnly": { $: booleanClassifier, annotate: statusChange },
      "/nullable": { $: booleanClassifier, annotate: customChangeAnnotation("possbile nullable value") },
      "/deprecated": { $: allDeprecated, annotate: statusChange },
    } : {},

    ...["openapi30schema", "openapi31schema"].includes(draft) ? {
      "/discriminator": { $: allUnclassified, annotate: annotationChange },
      "/example": annotationRule,
      "/externalDocs": annotationRule,
      "/xml": {},
    } : {},
    "/**": { $: allUnclassified }
  }

  return rules
}
