import { 
  breaking, nonBreaking,allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated, allNonBreaking, unclassified,
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
import { jsonSchemaTransformers, transformMergeAllOf } from "./jsonSchema.transform"
import { enumMappingResolver, requiredMappingResolver } from "./jsonSchema.mapping"
import type { JsonSchemaRulesOptions } from "./jsonSchema.types"

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

export const jsonSchemaRules = ({ notMergeAllOf }: JsonSchemaRulesOptions = {}): CompareRules => {
  const rules: CompareRules = {
    // important to createCompareRefResolver once for cycle refs cache
    compare: createRefsCompareResolver(),
    transform: jsonSchemaTransformers,

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
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules,
        $: allBreaking,
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/oneOf": {
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules, 
        $: [nonBreaking, breaking, breaking],
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/anyOf": {
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules, 
        $: [nonBreaking, breaking, breaking],
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/items": ({ value }) => arrayItemsRules(value, rules),
    "/additionalItems": () => ({
      ...rules,
      $: [nonBreaking, breaking, unclassified],
      annotate: keyChangeAnnotation,
    }),
    "/properties": {
      "/*": () => ({ 
        ...rules, 
        $: [nonBreaking, breaking, unclassified],
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/additionalProperties": () => ({ 
      ...rules, 
      $: allNonBreaking, 
      annotate: keyChangeAnnotation
    }),
    "/patternProperties": {
      "/*": () => ({ 
        ...rules, 
        $: [breaking, nonBreaking, unclassified],
        annotate: parentKeyChangeAnnotation
      }),
    },
    "/propertyNames": () => ({ ...rules, $: onlyAddBreaking, annotate: validationChange }),
    "/description": annotationRule,
    "/format": { $: [breaking, nonBreaking, breaking], annotate: keyChangeAnnotation },
    "/default": { $: [nonBreaking, breaking, breaking], annotate: keyChangeAnnotation },
    "/dependencies": {

    },    
    "/definitions": {
      "/*": () => ({
        ...rules, 
        $: allNonBreaking,
      })
    },
    "/$defs": {
      "/*": () => ({
        ...rules, 
        $: allNonBreaking,
      })
    },
    "/readOnly": { $: booleanClassifier, annotate: statusChange },
    "/writeOnly": { $: booleanClassifier, annotate: statusChange },
    "/deprecated": { $: allDeprecated, annotate: statusChange },
    "/examples": {
      $: allAnnotation,
      annotate: annotationChange,
      "/*": { $: allAnnotation, annotate: exampleChange }
    },
    
    // openapi extentions
    "/nullable": { $: booleanClassifier, annotate: keyChangeAnnotation },
    "/discriminator": { $: allUnclassified, annotate: annotationChange },
    "/example": annotationRule,
    "/externalDocs": annotationRule,
    "/xml": {},

    // unknown tags
    "/**": { $: allUnclassified }
  }

  return notMergeAllOf ? rules : { 
    ...rules,
    transform: [...jsonSchemaTransformers, transformMergeAllOf]
  }
}
