import {
  allAnnotation,
  allBreaking,
  allDeprecated,
  allNonBreaking,
  allUnclassified,
  breaking,
  nonBreaking,
  onlyAddBreaking,
  reverseClassifyRuleTransformer,
  transformComapreRules,
  unclassified,
} from "../core"
import type {
  ChangeAnnotationResolver,
  ClassifyRule,
  CompareRules,
} from "../types"
import {
  jsonSchemaKeyChange,
  schemaAnnotationChange,
  schemaExampleChange,
  schemaKeyItemChange,
  schemaStatusChange,
  schemaValidationChange,
} from "./jsonSchema.annotate"
import {
  booleanClassifier,
  exclusiveClassifier,
  maxClassifier,
  minClassifier,
  multipleOfClassifier,
  propertyClassifyRule,
  requiredItemClassifyRule,
  typeClassifier,
} from "./jsonSchema.classify"
import {
  enumMappingResolver,
  jsonSchemaMappingResolver,
  requiredMappingResolver,
} from "./jsonSchema.mapping"
import {
  combinaryCompareResolver,
  createRefsCompareResolver,
} from "./jsonSchema.resolver"
import {
  jsonSchemaMergeAllOf,
  transformJsonSchema,
  transformJsonSchemaCombiners,
} from "./jsonSchema.transform"
import type { JsonSchemaRulesOptions } from "./jsonSchema.types"

const annotationRule: CompareRules = {
  $: allAnnotation,
  annotate: schemaAnnotationChange,
}
const simpleRule = (
  classify: ClassifyRule,
  annotate: ChangeAnnotationResolver,
) => ({ $: classify, annotate })

const arrayItemsRules = (value: unknown, rules: CompareRules): CompareRules => {
  return Array.isArray(value)
    ? {
        "/*": () => ({
          ...rules,
          $: allBreaking,
          annotate: schemaKeyItemChange,
        }),
      }
    : {
        ...rules,
        $: allNonBreaking,
        annotate: jsonSchemaKeyChange,
      }
}

export const jsonSchemaRules = ({
  baseRules = {},
  notMergeAllOf,
  version = "draft-04",
  cache = {},
}: JsonSchemaRulesOptions = {}): CompareRules => {
  const rules: CompareRules = {
    // important to createCompareRefResolver once for cycle refs cache
    compare: createRefsCompareResolver(cache),
    transform: [transformJsonSchemaCombiners(), transformJsonSchema(version)],
    mapping: jsonSchemaMappingResolver,

    "/title": annotationRule,
    "/multipleOf": simpleRule(
      typeClassifier("number", multipleOfClassifier),
      schemaValidationChange,
    ),
    "/maximum": simpleRule(
      typeClassifier("number", maxClassifier),
      schemaValidationChange,
    ),
    "/minimum": simpleRule(
      typeClassifier("number", minClassifier),
      schemaValidationChange,
    ),
    ...(version === "draft-04"
      ? {
          "/exclusiveMaximum": simpleRule(
            typeClassifier("number", exclusiveClassifier),
            schemaValidationChange,
          ),
          "/exclusiveMinimum": simpleRule(
            typeClassifier("number", exclusiveClassifier),
            schemaValidationChange,
          ),
        }
      : {
          "/exclusiveMaximum": simpleRule(
            typeClassifier("number", maxClassifier),
            schemaValidationChange,
          ),
          "/exclusiveMinimum": simpleRule(
            typeClassifier("number", minClassifier),
            schemaValidationChange,
          ),
        }),
    "/maxLength": simpleRule(
      typeClassifier("string", maxClassifier),
      schemaValidationChange,
    ),
    "/minLength": simpleRule(
      typeClassifier("string", minClassifier),
      schemaValidationChange,
    ),
    "/pattern": simpleRule(
      typeClassifier("string", [breaking, nonBreaking, breaking]),
      schemaValidationChange,
    ),
    "/maxItems": simpleRule(
      typeClassifier("array", maxClassifier),
      schemaValidationChange,
    ),
    "/minItems": simpleRule(
      typeClassifier("array", minClassifier),
      schemaValidationChange,
    ),
    "/uniqueItems": simpleRule(
      typeClassifier("array", booleanClassifier),
      schemaValidationChange,
    ),
    "/maxProperties": simpleRule(
      typeClassifier("object", maxClassifier),
      schemaValidationChange,
    ),
    "/minProperties": simpleRule(
      typeClassifier("object", minClassifier),
      schemaValidationChange,
    ),
    "/required": {
      mapping: requiredMappingResolver,
      "/*": simpleRule(requiredItemClassifyRule, schemaKeyItemChange),
    },
    "/enum": {
      mapping: enumMappingResolver,
      annotate: jsonSchemaKeyChange,
      "/*": {
        $: [nonBreaking, breaking, breaking],
        annotate: schemaKeyItemChange,
      },
    },
    "/const": simpleRule(
      [breaking, nonBreaking, breaking],
      jsonSchemaKeyChange,
    ),
    "/type": {
      $: [breaking, nonBreaking, breaking],
      annotate: jsonSchemaKeyChange,
      "/*": { $: [nonBreaking, breaking, breaking] },
    },
    "/not": () => ({
      // TODO check
      ...transformComapreRules(rules, reverseClassifyRuleTransformer),
      $: allBreaking,
    }),
    "/allOf": {
      compare: combinaryCompareResolver,
      "/*": () => ({
        ...rules,
        $: allBreaking,
        annotate: schemaKeyItemChange,
      }),
    },
    "/oneOf": {
      compare: combinaryCompareResolver,
      "/*": () => ({
        ...rules,
        $: [nonBreaking, breaking, breaking],
        annotate: schemaKeyItemChange,
      }),
    },
    "/anyOf": {
      compare: combinaryCompareResolver,
      "/*": () => ({
        ...rules,
        $: [nonBreaking, breaking, breaking],
        annotate: schemaKeyItemChange,
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
        $: propertyClassifyRule,
        annotate: schemaKeyItemChange,
      }),
    },
    "/additionalProperties": () => ({
      ...rules,
      $: allNonBreaking,
      annotate: jsonSchemaKeyChange,
    }),
    "/patternProperties": {
      "/*": () => ({
        ...rules,
        $: [breaking, nonBreaking, unclassified],
        annotate: schemaKeyItemChange,
      }),
    },
    "/propertyNames": () => ({
      ...rules,
      $: onlyAddBreaking,
      annotate: schemaValidationChange,
    }),
    "/description": annotationRule,
    "/format": {
      $: [breaking, nonBreaking, breaking],
      annotate: jsonSchemaKeyChange,
    },
    "/default": {
      $: [nonBreaking, breaking, breaking],
      annotate: jsonSchemaKeyChange,
    },
    // TODO "/dependencies": {},
    "/definitions": {
      "/*": () => ({
        ...rules,
        $: allNonBreaking,
      }),
    },
    "/$defs": {
      "/*": () => ({
        ...rules,
        $: allNonBreaking,
      }),
    },
    "/readOnly": { $: booleanClassifier, annotate: schemaStatusChange },
    "/writeOnly": { $: booleanClassifier, annotate: schemaStatusChange },
    "/deprecated": { $: allDeprecated, annotate: schemaStatusChange },
    "/examples": {
      $: allAnnotation,
      annotate: schemaAnnotationChange,
      "/*": { $: allAnnotation, annotate: schemaExampleChange },
    },

    // unknown tags
    "/**": {
      annotate: schemaAnnotationChange,
      $: allUnclassified,
    },
    ...baseRules,
  }

  return notMergeAllOf
    ? rules
    : {
        ...rules,
        transform: [...(rules.transform ?? []), jsonSchemaMergeAllOf(version)],
      }
}
