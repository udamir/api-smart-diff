import { 
  breaking, nonBreaking,allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated, allNonBreaking, unclassified,
} from "../constants"
import { 
  schemaAnnotationChange, schemaExampleChange, jsonSchemaKeyChange, schemaParentKeyChange,
  schemaRequiredChange, schemaStatusChange, schemaValidationChange
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

const annotationRule: CompareRules = { $: allAnnotation, annotate: schemaAnnotationChange }
const simpleRule = (classify: ClassifyRule, annotate: ChangeAnnotationResolver) => ({ $: classify, annotate })

const arrayItemsRules = (value: unknown, rules: CompareRules): CompareRules => {
  return Array.isArray(value) ? {
    "/*": () => ({ 
      ...rules,
      $: allBreaking,
      annotate: schemaParentKeyChange
    }),  
  } : {
    ...rules,
    $: allNonBreaking,
    annotate: jsonSchemaKeyChange,
  }
}

export const jsonSchemaRules = ({ notMergeAllOf }: JsonSchemaRulesOptions = {}): CompareRules => {
  const rules: CompareRules = {
    // important to createCompareRefResolver once for cycle refs cache
    compare: createRefsCompareResolver(),
    transform: jsonSchemaTransformers,

    "/title": annotationRule,
    "/multipleOf": simpleRule(multipleOfClassifier, schemaValidationChange),
    "/maximum": simpleRule(maxClassifier, schemaValidationChange),
    "/exclusiveMaximum": simpleRule(exclusiveClassifier, schemaValidationChange),
    "/minimum": simpleRule(minClassifier, schemaValidationChange),
    "/exclusiveMinimum": simpleRule(exclusiveClassifier, schemaValidationChange),
    "/maxLength": simpleRule(maxClassifier, schemaValidationChange),
    "/minLength": simpleRule(minClassifier, schemaValidationChange),
    "/pattern": simpleRule([breaking, nonBreaking, breaking], schemaValidationChange),
    "/maxItems": simpleRule(maxClassifier, schemaValidationChange),
    "/minItems": simpleRule(minClassifier, schemaValidationChange),
    "/uniqueItems": simpleRule(booleanClassifier, schemaValidationChange),
    "/maxProperties": simpleRule(maxClassifier, schemaValidationChange),
    "/minProperties": simpleRule(minClassifier, schemaValidationChange),
    "/required": {
      $: onlyAddBreaking,
      mapping: requiredMappingResolver,
      "/*": { 
        $: requiredItemClassifyRule,
        annotate: schemaRequiredChange
      },
    },
    "/enum": {
      $: [breaking, nonBreaking, breaking],
      mapping: enumMappingResolver,
      annotate: jsonSchemaKeyChange,
      "/*": { $: [nonBreaking, breaking, breaking], annotate: schemaParentKeyChange },
    },
    "/const": {
      $: [breaking, nonBreaking, breaking],
      annotate: jsonSchemaKeyChange
    },
    "/type": {
      $: [breaking, nonBreaking, breaking],
      annotate: jsonSchemaKeyChange,
      "/*": { $: [nonBreaking, breaking, breaking] },
    },
    "/not": () => ({ ...rules, $: allBreaking }),
    "/allOf": {
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules,
        $: allBreaking,
        annotate: schemaParentKeyChange
      }),
    },
    "/oneOf": {
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules, 
        $: [nonBreaking, breaking, breaking],
        annotate: schemaParentKeyChange
      }),
    },
    "/anyOf": {
      compare: combinaryCompareResolver,
      "/*": () => ({ 
        ...rules, 
        $: [nonBreaking, breaking, breaking],
        annotate: schemaParentKeyChange
      }),
    },
    "/items": ({ value }) => arrayItemsRules(value, rules),
    "/additionalItems": () => ({
      ...rules,
      $: [nonBreaking, breaking, unclassified],
      annotate: jsonSchemaKeyChange,
    }),
    "/properties": {
      "/*": () => ({ 
        ...rules, 
        $: [nonBreaking, breaking, unclassified],
        annotate: schemaParentKeyChange
      }),
    },
    "/additionalProperties": () => ({ 
      ...rules, 
      $: allNonBreaking, 
      annotate: jsonSchemaKeyChange
    }),
    "/patternProperties": {
      "/*": () => ({ 
        ...rules, 
        $: [breaking, nonBreaking, unclassified],
        annotate: schemaParentKeyChange
      }),
    },
    "/propertyNames": () => ({ ...rules, $: onlyAddBreaking, annotate: schemaValidationChange }),
    "/description": annotationRule,
    "/format": { $: [breaking, nonBreaking, breaking], annotate: jsonSchemaKeyChange },
    "/default": { $: [nonBreaking, breaking, breaking], annotate: jsonSchemaKeyChange },
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
    "/readOnly": { $: booleanClassifier, annotate: schemaStatusChange },
    "/writeOnly": { $: booleanClassifier, annotate: schemaStatusChange },
    "/deprecated": { $: allDeprecated, annotate: schemaStatusChange },
    "/examples": {
      $: allAnnotation,
      annotate: schemaAnnotationChange,
      "/*": { $: allAnnotation, annotate: schemaExampleChange }
    },
    
    // openapi extentions
    "/nullable": { $: booleanClassifier, annotate: jsonSchemaKeyChange },
    "/discriminator": { $: allUnclassified, annotate: schemaAnnotationChange },
    "/example": annotationRule,
    "/externalDocs": annotationRule,
    "/xml": {},

    // unknown tags
    "/**": { 
      annotate: schemaAnnotationChange,
      $: allUnclassified
    }
  }

  return notMergeAllOf ? rules : { 
    ...rules,
    transform: [...jsonSchemaTransformers, transformMergeAllOf]
  }
}
