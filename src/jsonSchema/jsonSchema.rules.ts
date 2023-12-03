import { 
  breaking, nonBreaking,allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated, allNonBreaking,
} from "../constants"
import { booleanClassifier, exclusiveClassifier, maxClassifier, minClassifier, multipleOfClassifier, requiredItemClassifyRule } from "./jsonSchema.classify"
import { annotationChange, keyChangeAnnotation, parentKeyChangeAnnotation, statusChange, validationChange } from "./jsonSchema.annotate"
import { combinaryCompareResolver, createRefsCompareResolver } from "./jsonSchema.resolver"
import { ChangeAnnotationResolver, ClassifyRule, CompareRules } from "../types/rules"
import type { JsonSchemaRulesOptions } from "./jsonSchema.types"
import { jsonSchemaTransformers } from "./jsonSchema.transform"
import { mapSimpleEnumItemsRule } from "../resolvers/enum"

const annotationRule: CompareRules = { $: allAnnotation, annotate: annotationChange }
const simpleRule = (classify: ClassifyRule, annotate: ChangeAnnotationResolver) => ({ $: classify, annotate })

export const jsonSchemaRules = ({ transform = [], draft = "draft-06", writer = false }: JsonSchemaRulesOptions = {}): CompareRules => {
  const rules = {
    // important to createCompareRefResolver once for cycle refs cache
    compare: createRefsCompareResolver(),
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
      "/*": { $: requiredItemClassifyRule },
    },
    "/enum": {
      "/*": { $: [nonBreaking, breaking, breaking], annotate: parentKeyChangeAnnotation },
      $: [breaking, nonBreaking, breaking],
      mapping: mapSimpleEnumItemsRule,
      annotate: keyChangeAnnotation
    },
    "/type": {
      $: [breaking, nonBreaking, breaking],
      "/*": { $: [nonBreaking, breaking, breaking] },
    },
    "/not": () => ({ ...rules, $: allBreaking }),
    "/allOf": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ ...rules, $: allBreaking }),
      compare: combinaryCompareResolver
    },
    "/oneOf": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ ...rules, $: allNonBreaking }),
      compare: combinaryCompareResolver
    },
    "/anyOf": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ ...rules, $: allNonBreaking }),
      compare: combinaryCompareResolver
    },
    "/items": () => ({ ...rules, $: allNonBreaking }),
    "/properties": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ ...rules, $: allNonBreaking }),
    },
    "/additionalProperties": () => ({ ...rules, $: allNonBreaking }),
    "/description": annotationRule,
    "/format": { $: [breaking, nonBreaking, breaking], annotate: keyChangeAnnotation },
    "/default": { $: [nonBreaking, breaking, breaking], annotate: keyChangeAnnotation },
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
      "/nullable": { $: booleanClassifier, annotate: keyChangeAnnotation },
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
