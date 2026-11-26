import {
  extensionRules,
  breaking,
  nonBreaking,
  allAnnotation,
  allBreaking,
  allUnclassified,
  onlyAddBreaking,
  allDeprecated,
  allNonBreaking,
  unclassified,
  oppositeScopes,
  CompareScopes,
  staticRules,
} from "../core"
import {
  dependentKeywordChange,
  enumKeywordChange,
  schemaAnnotationChange,
  schemaExampleChange,
  schemaExtensionChange,
  jsonSchemaKeyChange,
  schemaKeyItemChange,
  schemaStatusChange,
  schemaValidationChange,
} from "./jsonSchema.annotate"
import {
  booleanClassifier,
  branchClassifyRule,
  combinerKeyClassifyRule,
  countMaxClassifier,
  constraintValueClassifyRule,
  enumItemClassifyRule,
  enumKeywordClassifyRule,
  exposedOnly,
  itemsSchemaClassifyRule,
  readOnlyClassifyRule,
  requiredItemRule,
  writeOnlyClassifyRule,
  boundClassifyRule,
  constraintGeneralizationClassifyRule,
  defaultClassifyRule,
  ifClassifyRule,
  maxClassifier,
  minClassifier,
  multipleOfClassifier,
  prefixItemsKeywordRule,
  tupleEntryClassifyRule,
  permissivenessClassifyRule,
  propertyClassifyRule,
  requiredItemClassifyRule,
  typeChangeClassifyRule,
  typeClassifier,
  typeItemClassifyRule,
} from "./jsonSchema.classify"
import { transformJsonSchema, transformJsonSchemaCombiners, jsonSchemaMergeAllOf } from "./jsonSchema.transform"
import { enumMappingResolver, jsonSchemaMappingResolver, requiredMappingResolver } from "./jsonSchema.mapping"
import { combinaryCompareResolver, schemaCompareResolver, valueCompareResolver } from "./jsonSchema.resolver"
import type { ChangeAnnotationResolver, ClassifyRule, CompareRules } from "../types"
import type { JsonSchemaRulesOptions } from "./jsonSchema.types"

const annotationRule: CompareRules = { $: allAnnotation, annotate: schemaAnnotationChange }
// every JSON Schema classifier is wrapped by `exposedOnly`: inside a property hidden in the direction (readOnly in a
// request, writeOnly in a response) a breaking or risky change reads non-breaking (ISSUE-72 (fixed)); the wrapped
// rules are created once (memoized per rule object), never per node
const x = exposedOnly
const simpleRule = (classify: ClassifyRule, annotate: ChangeAnnotationResolver) => ({ $: x(classify), annotate })

const patternPropertyRule: ClassifyRule = [breaking, nonBreaking, unclassified]
const dependentRequiredRule: ClassifyRule = [breaking, nonBreaking, breaking]
// `dependentRequired` / `dependentSchemas` / `dependencies` as a whole
const dependentKeywordRule: ClassifyRule = [breaking, nonBreaking, breaking]

// the two `items` rule sets of a schema rule set (tuple form / single schema), built once per rule set
const itemsRulesCache = new WeakMap<CompareRules, { tuple?: CompareRules; single?: CompareRules }>()

const arrayItemsRules = (value: unknown, rules: CompareRules): CompareRules => {
  let cached = itemsRulesCache.get(rules)
  if (!cached) {
    cached = {}
    itemsRulesCache.set(rules, cached)
  }
  const form = Array.isArray(value) ? "tuple" : "single"
  let result = cached[form]
  if (!result) {
    result = buildArrayItemsRules(value, rules)
    cached[form] = result
  }
  return result
}

const buildArrayItemsRules = (value: unknown, rules: CompareRules): CompareRules => {
  return Array.isArray(value)
    ? {
        "/*": staticRules(() => ({
          ...rules,
          $: x(allBreaking),
          annotate: schemaKeyItemChange,
        })),
      }
    : {
        // an `items` schema added constrains every item: breaking for a request, a guarantee for a response
        // (ISSUE-92 (fixed)); removing it is the reverse
        ...rules,
        $: x(itemsSchemaClassifyRule),
        annotate: jsonSchemaKeyChange,
      }
}

// `not` added / removed, read in the opposite scope of its parent: narrowing in the enclosing direction
const notClassifyRule: ClassifyRule = [nonBreaking, breaking, breaking, breaking, nonBreaking, breaking]

// the applicator inverts the direction of its subtree
const invertScope: CompareRules["scope"] = ({ scope }) => oppositeScopes[scope] ?? CompareScopes.response

export const jsonSchemaRules = ({
  baseRules = {},
  notMergeAllOf,
  version = "2020-12",
  extensions,
}: JsonSchemaRulesOptions = {}): CompareRules => {
  // OpenAPI 3.0 (draft-04 rule set): `required` of a read-only property applies to responses only
  const requiredRule = x(requiredItemRule(version === "draft-04"))

  // every schema node (the nested function rules spread this object) normalizes and merges its own allOf; a custom
  // `baseRules.transform` replaces the normalization but keeps the merge step
  const normalize = baseRules.transform ?? [transformJsonSchemaCombiners(), transformJsonSchema(version)]
  const transform = notMergeAllOf ? normalize : [...normalize, jsonSchemaMergeAllOf(version, undefined, normalize)]

  const maxBound = simpleRule(typeClassifier("number", boundClassifyRule("max")), schemaValidationChange)
  const minBound = simpleRule(typeClassifier("number", boundClassifyRule("min")), schemaValidationChange)

  const rules: CompareRules = {
    compare: schemaCompareResolver,
    mapping: jsonSchemaMappingResolver,

    "/title": annotationRule,
    "/multipleOf": simpleRule(typeClassifier("number", multipleOfClassifier), schemaValidationChange),
    // numeric bounds by the effective bound of the schema (ISSUE-88): the draft-04 boolean exclusive form is rewritten
    // to the numeric one by the normalization, so every draft reads the same rule
    "/maximum": maxBound,
    "/minimum": minBound,
    "/exclusiveMaximum": maxBound,
    "/exclusiveMinimum": minBound,
    "/maxLength": simpleRule(typeClassifier("string", maxClassifier), schemaValidationChange),
    "/minLength": simpleRule(typeClassifier("string", minClassifier), schemaValidationChange),
    "/pattern": simpleRule(typeClassifier("string", constraintGeneralizationClassifyRule), schemaValidationChange),
    "/maxItems": simpleRule(typeClassifier("array", countMaxClassifier("array")), schemaValidationChange),
    "/minItems": simpleRule(typeClassifier("array", minClassifier), schemaValidationChange),
    "/uniqueItems": simpleRule(typeClassifier("array", booleanClassifier), schemaValidationChange),
    "/maxContains": simpleRule(typeClassifier("array", maxClassifier), schemaValidationChange),
    "/minContains": simpleRule(typeClassifier("array", minClassifier), schemaValidationChange),
    "/maxProperties": simpleRule(typeClassifier("object", countMaxClassifier("object")), schemaValidationChange),
    "/minProperties": simpleRule(typeClassifier("object", minClassifier), schemaValidationChange),
    "/required": {
      mapping: requiredMappingResolver,
      "/*": { $: requiredRule, annotate: schemaKeyItemChange },
    },
    "/dependentRequired": {
      // the keyword as a whole (ISSUE-90): a new dependency narrows a request, a removed one widens it
      $: x(dependentKeywordRule),
      annotate: dependentKeywordChange,
      "/*": {
        $: x(dependentRequiredRule),
        annotate: schemaValidationChange,
        mapping: requiredMappingResolver,
        "/*": simpleRule(requiredItemClassifyRule, schemaKeyItemChange),
      },
    },
    "/enum": {
      // the schema became an enum (request: every other value is rejected) or stopped being one (response: a client
      // with an exhaustive switch may receive other values, POLICY-05 risky): one keyword diff (ISSUE-87 (fixed))
      $: x(enumKeywordClassifyRule),
      mapping: enumMappingResolver,
      annotate: enumKeywordChange,
      "/*": { $: x(enumItemClassifyRule), annotate: schemaKeyItemChange, compare: valueCompareResolver },
    },
    "/const": simpleRule(constraintValueClassifyRule, jsonSchemaKeyChange),
    "/type": {
      $: x(typeChangeClassifyRule),
      annotate: jsonSchemaKeyChange,
      mapping: enumMappingResolver,
      "/*": { $: x(typeItemClassifyRule), annotate: schemaKeyItemChange },
    },
    // the subtree of `not` is read in the opposite direction; the `not` node itself is classified in the enclosing
    // direction (it is read in the opposite scope, hence the reversed slots): adding a negation narrows the schema
    // (ISSUE-93 (fixed))
    "/not": staticRules(() => ({
      ...rules,
      scope: invertScope,
      $: x(notClassifyRule),
      annotate: jsonSchemaKeyChange,
    })),
    "/allOf": {
      compare: combinaryCompareResolver,
      "/*": staticRules(() => ({
        ...rules,
        $: x(allBreaking),
        annotate: schemaKeyItemChange,
      })),
    },
    "/oneOf": {
      $: x(combinerKeyClassifyRule),
      annotate: jsonSchemaKeyChange,
      compare: combinaryCompareResolver,
      "/*": staticRules(() => ({
        ...rules,
        $: x(branchClassifyRule),
        annotate: schemaKeyItemChange,
      })),
    },
    "/anyOf": {
      $: x(combinerKeyClassifyRule),
      annotate: jsonSchemaKeyChange,
      compare: combinaryCompareResolver,
      "/*": staticRules(() => ({
        ...rules,
        $: x(branchClassifyRule),
        annotate: schemaKeyItemChange,
      })),
    },
    "/items": ({ value }) => arrayItemsRules(value, rules),
    // the tuple as a whole (ISSUE-90) and its entries (ISSUE-96), read against the `items` schema that governs the
    // positions after the tuple
    "/prefixItems": {
      $: x(prefixItemsKeywordRule),
      annotate: jsonSchemaKeyChange,
      "/*": staticRules(() => ({
        ...rules,
        $: x(tupleEntryClassifyRule),
        annotate: schemaKeyItemChange,
      })),
    },
    "/contains": staticRules(() => ({ ...rules, $: x(onlyAddBreaking), annotate: jsonSchemaKeyChange })),
    "/additionalItems": staticRules(() => ({
      ...rules,
      $: x(permissivenessClassifyRule),
      annotate: jsonSchemaKeyChange,
    })),
    "/unevaluatedItems": staticRules(() => ({
      ...rules,
      $: x(permissivenessClassifyRule),
      annotate: jsonSchemaKeyChange,
    })),
    "/properties": {
      "/*": staticRules(() => ({
        ...rules,
        $: x(propertyClassifyRule),
        annotate: schemaKeyItemChange,
      })),
    },
    "/additionalProperties": staticRules(() => ({
      ...rules,
      $: x(permissivenessClassifyRule),
      annotate: jsonSchemaKeyChange,
    })),
    "/unevaluatedProperties": staticRules(() => ({
      ...rules,
      $: x(permissivenessClassifyRule),
      annotate: jsonSchemaKeyChange,
    })),
    "/patternProperties": {
      "/*": staticRules(() => ({
        ...rules,
        $: x(patternPropertyRule),
        annotate: schemaKeyItemChange,
      })),
    },
    "/propertyNames": staticRules(() => ({ ...rules, $: x(onlyAddBreaking), annotate: schemaValidationChange })),
    "/dependentSchemas": {
      $: x(dependentKeywordRule),
      annotate: dependentKeywordChange,
      "/*": staticRules(() => ({ ...rules, $: x(onlyAddBreaking), annotate: schemaKeyItemChange })),
    },
    // `if` without `then` / `else` has no effect (ISSUE-90)
    "/if": staticRules(() => ({ ...rules, $: x(ifClassifyRule), annotate: jsonSchemaKeyChange })),
    "/then": staticRules(() => ({ ...rules, $: x(onlyAddBreaking), annotate: jsonSchemaKeyChange })),
    "/else": staticRules(() => ({ ...rules, $: x(onlyAddBreaking), annotate: jsonSchemaKeyChange })),
    "/contentSchema": staticRules(() => ({ ...rules, $: x(onlyAddBreaking), annotate: jsonSchemaKeyChange })),
    "/contentMediaType": simpleRule(constraintValueClassifyRule, schemaValidationChange),
    "/contentEncoding": simpleRule(constraintValueClassifyRule, schemaValidationChange),
    "/description": annotationRule,
    "/format": { $: x(constraintGeneralizationClassifyRule), annotate: jsonSchemaKeyChange },
    "/default": { $: x(defaultClassifyRule), annotate: jsonSchemaKeyChange, compare: valueCompareResolver },
    "/definitions": {
      "/*": staticRules(() => ({
        ...rules,
        $: allNonBreaking,
        annotate: schemaKeyItemChange,
      })),
    },
    "/$defs": {
      "/*": staticRules(() => ({
        ...rules,
        $: allNonBreaking,
        annotate: schemaKeyItemChange,
      })),
    },
    // the flags follow the direction (ISSUE-72 (fixed)): readOnly hides a property from requests, writeOnly from
    // responses
    "/readOnly": { $: x(readOnlyClassifyRule(version === "draft-04")), annotate: schemaStatusChange },
    "/writeOnly": { $: x(writeOnlyClassifyRule), annotate: schemaStatusChange },
    "/deprecated": { $: allDeprecated, annotate: schemaStatusChange },
    "/examples": {
      $: allAnnotation,
      annotate: schemaAnnotationChange,
      mapping: enumMappingResolver,
      "/*": { $: allAnnotation, annotate: schemaExampleChange, compare: valueCompareResolver },
    },

    // unknown tags
    "/**": {
      annotate: schemaAnnotationChange,
      $: allUnclassified,
    },
    // `x-*` keywords: annotations naming the keyword (POLICY-06), custom extension rules merged over the built-in one
    ...extensionRules(schemaExtensionChange, {
      "/$schema": annotationRule,
      "/$id": annotationRule,
      "/$anchor": annotationRule,
      // keywords without a rule of their own before P5 (ISSUE-90, ISSUE-148)
      "/$comment": annotationRule,
      "/$dynamicAnchor": annotationRule,
      "/$vocabulary": { ...annotationRule, "/**": annotationRule },
      // a retargeted dynamic reference changes the schema it resolves to
      "/$dynamicRef": { $: x(constraintValueClassifyRule), annotate: jsonSchemaKeyChange },
      // draft-07 `dependencies`: entries are `dependentRequired` lists or `dependentSchemas` schemas
      "/dependencies": {
        $: x(dependentKeywordRule),
        annotate: dependentKeywordChange,
        "/*": ({ value }) => (Array.isArray(value) ? dependentRequiredEntry : dependentSchemaEntry),
      },
      ...extensions,
    }),
    ...baseRules,
    transform,
  }

  const dependentRequiredEntry: CompareRules = {
    $: x(dependentRequiredRule),
    annotate: schemaValidationChange,
    mapping: requiredMappingResolver,
    "/*": simpleRule(requiredItemClassifyRule, schemaKeyItemChange),
  }
  const dependentSchemaEntry: CompareRules = { ...rules, $: x(onlyAddBreaking), annotate: schemaKeyItemChange }

  return rules
}
