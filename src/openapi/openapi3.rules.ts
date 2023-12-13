import { 
  globalSecurityClassifyRule, globalSecurityItemClassifyRule, operationSecurityClassifyRule, 
  operationSecurityItemClassifyRule, paramClassifyRule, paramSchemaTypeClassifyRule, parameterExplodeClassifyRule, 
  parameterNameClassifyRule, parameterRequiredClassifyRule, parameterStyleClassifyRule
} from "./openapi3.classify"
import { 
  addNonBreaking, allAnnotation, allBreaking, allDeprecated, allNonBreaking, breaking, 
  nonBreaking, unclassified
} from "../constants"
import { contentMediaTypeMappingResolver, paramMappingResolver, pathMappingResolver } from "./openapi3.mapping"
import { breakingIfAfterTrue, createRefsCompareResolver, jsonSchemaRules } from "../jsonSchema"
import { transformParameterItems, transformPathItems } from "./openapi3.transform"
import { parameterChangeAnnotation } from "./openapi3.annotate"
import type { OpenApi3RulesOptions } from "./openapi3.types"
import type { ClassifyRule, CompareRules } from "../types"
import { openApiSchemaRules } from "./openapi3.schema"
import { isResponsePath } from "./openapi3.utils"

const paramRule = (classify: ClassifyRule) => ({ $: classify, annotate: parameterChangeAnnotation })


export const openapi3Rules = ({ notMergeAllOf = false }: OpenApi3RulesOptions = {}): CompareRules => {
  const requestSchemaRules = openApiSchemaRules(jsonSchemaRules({ notMergeAllOf }))
  const responseSchemaRules = openApiSchemaRules(jsonSchemaRules({ notMergeAllOf }), true)
  const refsCompareResolver = createRefsCompareResolver()

  const serversRules: CompareRules = {
    $: allAnnotation,
    "/*": {
      $: [nonBreaking, breaking, breaking],
      "/url": { $: [nonBreaking, breaking, breaking] },
      "/description": { $: allAnnotation },
      "/variables": {
        $: [nonBreaking, breaking, breaking],
        "/*": {
          $: [nonBreaking, breaking, breaking],
          "/enum": {
            $: [nonBreaking, breaking, breaking],
            "/*": { $: [nonBreaking, breaking, breaking] },
          },
          "/default": { $: [nonBreaking, nonBreaking, breaking] },
          "/description": { $: allAnnotation },
        },
      },
    },
  }
  
  const parametersRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    mapping: paramMappingResolver,
    "/*": {
      annotate: parameterChangeAnnotation,
      compare: refsCompareResolver,
      transform: [transformParameterItems],
      $: paramClassifyRule,
      "/name": paramRule(parameterNameClassifyRule),
      "/in": paramRule([nonBreaking, breaking, breaking]),
      "/schema": () => ({
        ...requestSchemaRules,
        $: allBreaking,
        "/type": { $: paramSchemaTypeClassifyRule }
      }),
      "/explode": paramRule(parameterExplodeClassifyRule),
      "/style": paramRule(parameterStyleClassifyRule),
      "/description": paramRule(allAnnotation),
      "/required": paramRule(parameterRequiredClassifyRule),
      "/deprecated": paramRule(allDeprecated),
    },
  }
  
  const headersRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    "/*": {
      $: [nonBreaking, breaking, breaking],
      compare: refsCompareResolver,
      "/description": { $: allAnnotation },
      "/required": { $: [breaking, nonBreaking, breakingIfAfterTrue] },
      "/deprecated": { $: allDeprecated },
    },
  }
  
  const encodingRules: CompareRules = {
    $: [nonBreaking, nonBreaking, nonBreaking],
    "/*": {
      "/contentType": { $: [nonBreaking, breaking, breaking] },
      "/headers": headersRules,
      "/style": { $: [nonBreaking, breaking, breaking] },
      "/explode": { $: [nonBreaking, breaking, breaking] },
      "/allowReserved": { $: [nonBreaking, breaking, breaking] },
    },
  }
  
  const contentRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    mapping: contentMediaTypeMappingResolver,
    "/*": {
      $: [nonBreaking, breaking, unclassified],
      "/schema": ({ path }) => ({
        ...isResponsePath(path) ? responseSchemaRules : requestSchemaRules,
        $: allBreaking
      }),
      "/example": { $: allAnnotation },
      "/examples": { 
        $: allAnnotation,
        compare: refsCompareResolver,
      },
      "/encoding": encodingRules,
    },
  }
  
  const requestBodiesRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    compare: refsCompareResolver,
    "/description": { $: allAnnotation },
    "/content": contentRules,
    "/required": { $: [breaking, nonBreaking, breakingIfAfterTrue] },
  }
  
  const responsesRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    "/*": {
      $: [nonBreaking, breaking, breaking],
      compare: refsCompareResolver,
      "/description": { $: allAnnotation },
      "/headers": headersRules,
      "/content": contentRules,
    },
  }  

  const rules: CompareRules = {
    "/openapi": { $: allAnnotation }, 
    "/info": {
      $: allAnnotation,
      "/title": { $: allAnnotation },
      "/description": { $: allAnnotation },
      "/termsOfService": { $: allAnnotation },
      "/contact": { $: allAnnotation },
      "/licence": {
        $: [nonBreaking, breaking, breaking],
        "/name": { $: [breaking, breaking, breaking] },
        "/url": { $: [breaking, nonBreaking, nonBreaking] },
      },
      "/version": { $: allAnnotation },
    },
    "/servers": serversRules,
    "/paths": {
      $: [nonBreaking, breaking, breaking],
      mapping: pathMappingResolver,
      "/*": {
        $: [nonBreaking, breaking, nonBreaking],
        transform: [transformPathItems],
        compare: refsCompareResolver,
        "/summary": { $: allAnnotation },
        "/description": { $: allAnnotation },
        "/*": {
          $: [nonBreaking, breaking, breaking],
          "/tags": { $: allAnnotation },
          "/summary": { $: allAnnotation },
          "/description": { $: allAnnotation },
          "/externalDocs": { $: allAnnotation },
          "/operationId": { $: allAnnotation },
          "/parameters": parametersRules,
          "/requestBody": requestBodiesRules,
          "/callbacks": {
            "/*": {
              compare: refsCompareResolver,
            }
          },
          "/responses": responsesRules,
          "/deprecated": { $: allDeprecated },
          "/security": {
            $: operationSecurityClassifyRule,
            "/*": { $: operationSecurityItemClassifyRule },
          },
          "/servers": serversRules,
        },
        "/servers": serversRules,
        "/parameters": parametersRules,
      },
    },
    "/components": {
      $: allNonBreaking,
      "/schemas": {
        $: [nonBreaking, breaking, breaking],
        "/*": () => ({
          ...requestSchemaRules,
          $: addNonBreaking
        })
      },
      "/responses": {
        $: [nonBreaking, breaking, breaking],
        "/*": responsesRules,
      },
      "/parameters": {
        $: [nonBreaking, breaking, breaking],
        "/*": parametersRules,
      },
      "/examples": { $: allAnnotation },
      "/requestBodies": {
        $: [nonBreaking, breaking, breaking],
        "/*": requestBodiesRules,
      },
      "/headers": headersRules,
      "/securitySchemes": {
        $: [breaking, nonBreaking, breaking],
        "/*": {
          $: [breaking, nonBreaking, breaking],
          "/type": { $: [breaking, nonBreaking, breaking] },
          "/description": { $: allAnnotation },
          "/name": { $: [breaking, nonBreaking, breaking] },
          "/in": { $: [breaking, nonBreaking, breaking] },
          "/scheme": { $: [breaking, nonBreaking, breaking] },
          "/bearerFormat": { $: allAnnotation },
          "/flows": { $: [breaking, nonBreaking, breaking] },
          "/openIdConnectUrl": { $: allAnnotation },
        },
      },
    },
    "/security": {
      $: globalSecurityClassifyRule,
      "/*": { $: globalSecurityItemClassifyRule },
    },
    "/tags": { $: allAnnotation },
    "/externalDocs": { $: allAnnotation },
  }
  return rules
}
