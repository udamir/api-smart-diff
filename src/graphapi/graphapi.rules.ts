import {
  graphApiMergeAllOf,
  transformGraphApiComponents,
  transformGraphApiDirective,
  transformGraphApiDocument,
} from "./graphapi.transform"
import { allAnnotation, breaking, nonBreaking, CompareScopes } from "../core/constants"
import { deepEqualsUniqueItemsMappingResolver } from "../core"
import { directiveLocationAnnotation, parentKeyChangeAnnotation, rootTypeNameAnnotation } from "./graphapi.annotate"
import { graphApiSchemaRules, graphDirectiveUsagesRules, graphInterfacesRules } from "./graphapi.schema"
import { directiveLocationClassifyRule, repeatableClassifyRule, rootTypeNameClassifyRule } from "./graphapi.classify"
import { createFields, nonDirectional } from "../jsonSchema"
import type { CompareRules, CompareScope } from "../types"

export type GraphApiRulesOptions = {
  notMergeAllOf?: boolean
}

export const graphApiRules = ({ notMergeAllOf = false }: GraphApiRulesOptions = {}): CompareRules => {
  const schemaRules = graphApiSchemaRules()

  // an operation (query / mutation / subscription): its result is an output, its arguments are inputs
  const operationRules: CompareRules = {
    ...schemaRules,
    scope: CompareScopes.output,
    $: nonDirectional([nonBreaking, breaking, breaking]),
    annotate: parentKeyChangeAnnotation,
  }

  const operationsRules: CompareRules = {
    $: nonDirectional([nonBreaking, breaking, breaking]),
    "/*": operationRules,
  }

  // a named type: classified by the scopes that reference it
  const componentRules: CompareRules = {
    ...schemaRules,
    scope: CompareScopes.components,
    $: nonDirectional([nonBreaking, breaking, breaking]),
  }

  // description, directives and implemented interfaces of the root operation types (gqlapi 0.6, ISSUE-141); a root
  // type implementing an interface is returned wherever the interface is (the output scope)
  const rootTypeRules: CompareRules = {
    $: allAnnotation,
    transform: [createFields("interfaces", "directives")],
    "/description": { $: allAnnotation },
    "/directives": graphDirectiveUsagesRules,
    "/interfaces": graphInterfacesRules,
  }

  const componentsOf = (unreferencedScopes: CompareScope[]): CompareRules => ({
    $: nonDirectional([nonBreaking, breaking, breaking]),
    "/*": { ...componentRules, unreferencedScopes },
  })

  return {
    transform: [...(notMergeAllOf ? [] : [graphApiMergeAllOf]), transformGraphApiDocument, createFields("rootTypes")],

    "/graphapi": { $: allAnnotation },
    "/description": { $: allAnnotation },
    "/queryTypeName": { $: rootTypeNameClassifyRule("query"), annotate: rootTypeNameAnnotation },
    "/mutationTypeName": { $: rootTypeNameClassifyRule("mutation"), annotate: rootTypeNameAnnotation },
    "/subscriptionTypeName": { $: rootTypeNameClassifyRule("subscription"), annotate: rootTypeNameAnnotation },
    "/rootTypes": {
      $: allAnnotation,
      scope: CompareScopes.output,
      transform: [createFields("query", "mutation", "subscription")],
      "/*": rootTypeRules,
    },
    "/directives": { $: allAnnotation, "/**": { $: allAnnotation } },
    "/queries": operationsRules,
    "/mutations": operationsRules,
    "/subscriptions": operationsRules,

    "/components": {
      transform: [transformGraphApiComponents],
      $: nonDirectional([nonBreaking, breaking, breaking]),
      "/*": {
        $: nonDirectional([nonBreaking, breaking, breaking]),
        "/*": componentRules,
      },
      // types no root operation type reaches are classified as if reachable (POLICY-02 decided (a), ISSUE-132)
      "/objects": componentsOf([CompareScopes.output]),
      "/interfaces": componentsOf([CompareScopes.output]),
      "/unions": componentsOf([CompareScopes.output]),
      "/inputObjects": componentsOf([CompareScopes.args]),
      "/enums": componentsOf([CompareScopes.args, CompareScopes.output]),
      // custom scalars are used through `format`, not `$ref`, so they cannot be classified by usage
      "/scalars": {
        $: nonDirectional([nonBreaking, breaking, breaking]),
        "/*": { ...schemaRules, $: nonDirectional([nonBreaking, breaking, breaking]) },
      },
      "/directives": {
        $: nonDirectional([nonBreaking, breaking, breaking]),
        "/*": {
          annotate: parentKeyChangeAnnotation,
          transform: [transformGraphApiDirective],
          $: nonDirectional([nonBreaking, breaking, breaking]),
          "/title": { $: allAnnotation },
          "/description": { $: allAnnotation },
          "/locations": {
            mapping: deepEqualsUniqueItemsMappingResolver,
            $: directiveLocationClassifyRule,
            annotate: directiveLocationAnnotation,
            "/*": { $: directiveLocationClassifyRule, annotate: directiveLocationAnnotation },
          },
          "/repeatable": { $: repeatableClassifyRule, annotate: parentKeyChangeAnnotation },
          "/args": {
            ...schemaRules,
            scope: CompareScopes.args,
            $: nonDirectional([nonBreaking, breaking, breaking]),
          },
        },
      },
    },
  }
}
