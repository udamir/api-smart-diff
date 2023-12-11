import { 
  breaking, nonBreaking,allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated, allNonBreaking, addNonBreaking,
} from "../constants"
import { 
  annotationChange, exampleChange, keyChangeAnnotation, parentKeyChangeAnnotation,
  requiredChangeAnnotation, statusChange, validationChange
} from "./jsonSchema.annotate"
import { 
  booleanClassifier, exclusiveClassifier, maxClassifier, minClassifier, 
  multipleOfClassifier, requiredItemClassifyRule
} from "./jsonSchema.classify"
import { combinaryCompareResolver, createRefsCompareResolver } from "./jsonSchema.resolver"
import type { ChangeAnnotationResolver, ClassifyRule, CompareRules } from "../types"
import { enumMappingResolver, requiredMappingResolver } from "./jsonSchema.mapping"
import type { JsonSchemaRulesOptions } from "./jsonSchema.types"
import { jsonSchemaTransformers, transformMergeAllOf } from "./jsonSchema.transform"

const annotationRule: CompareRules = { $: allAnnotation, annotate: annotationChange }
const simpleRule = (classify: ClassifyRule, annotate: ChangeAnnotationResolver) => ({ $: classify, annotate })

const arrayItemsRules = (value: unknown, rules: CompareRules): CompareRules => {
  return Array.isArray(value) ? {
    "/*": () => ({ 
      ...rules,
      $: allBreaking,
      annotate: parentKeyChangeAnnotation
    }),  
  } : {
    ...rules,
    $: allNonBreaking,
    annotate: keyChangeAnnotation,
  }
}

export const jsonSchemaRules = ({ transform = [], draft = "draft-06", mergeAllOf = true }: JsonSchemaRulesOptions = {}): CompareRules => {
  const rules: CompareRules = {
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
      mapping: requiredMappingResolver,
      "/*": { 
        $: requiredItemClassifyRule,
        annotate: requiredChangeAnnotation
      },
    },
    "/enum": {
      $: [breaking, nonBreaking, breaking],
      mapping: enumMappingResolver,
      annotate: keyChangeAnnotation,
      "/*": { $: [nonBreaking, breaking, breaking], annotate: parentKeyChangeAnnotation },
    },
    "/const": {
      $: [breaking, nonBreaking, breaking],
      annotate: keyChangeAnnotation
    },
    "/type": {
      $: [breaking, nonBreaking, breaking],
      annotate: keyChangeAnnotation,
      "/*": { $: [nonBreaking, breaking, breaking] },
    },
    "/not": () => ({ ...rules, $: allBreaking }),
    "/allOf": {
      $: [breaking, nonBreaking, breaking],
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules,
        $: allBreaking,
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/oneOf": {
      $: [breaking, nonBreaking, breaking],
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules, 
        $: allNonBreaking,
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/anyOf": {
      $: [breaking, nonBreaking, breaking],
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules, 
        $: allNonBreaking,
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/items": ({ value }) => arrayItemsRules(value, rules),
    "/additionalItems": () => ({
      ...rules,
      $: allNonBreaking,
      annotate: keyChangeAnnotation,
    }),
    "/properties": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ 
        ...rules, 
        $: addNonBreaking,
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/additionalProperties": () => ({ ...rules, $: allNonBreaking, annotate: keyChangeAnnotation }),
    "/patternProperties": {
      $: [breaking, nonBreaking, breaking],
      "/*": () => ({ 
        ...rules, 
        $: addNonBreaking,
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/propertyNames": () => ({ ...rules, $: onlyAddBreaking, annotate: validationChange }),
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
      "/examples": {
        $: allAnnotation,
        annotate: annotationChange,
        "/*": { $: allAnnotation, annotate: exampleChange }
      }
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

  return mergeAllOf ? { 
    ...rules,
    transform: [...jsonSchemaTransformers, ...transform, transformMergeAllOf]
  } : rules
}
