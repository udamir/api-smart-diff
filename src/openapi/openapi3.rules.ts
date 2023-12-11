import { 
  globalSecurityClassifyRule, globalSecurityItemClassifyRule, operationSecurityClassifyRule, 
  operationSecurityItemClassifyRule, paramSchemaTypeClassifyRule, parameterExplodeClassifyRule, 
  parameterNameClassifyRule, parameterRequiredClassifyRule, parameterStyleClassifyRule
} from "./openapi3.classify"
import { addNonBreaking, allAnnotation, allBreaking, allDeprecated, allNonBreaking, breaking, nonBreaking, unclassified } from "../constants"
import { contentMediaTypeMappingResolver, paramMappingResolver, pathMappingResolver } from "./openapi3.mapping"
import { breakingIfAfterTrue, jsonSchemaRules } from "../jsonSchema"
import type { OpenApi3RulesOptions } from "./openapi3.types"
import { transformPathItems } from "./openapi3.transform"
import { reverseRules } from "./openapi3.utils"
import type { CompareRules } from "../types"

export const openapi3Rules = ({ notMergeAllOf = false }: OpenApi3RulesOptions = {}): CompareRules => {

  const requestSchema = jsonSchemaRules({ notMergeAllOf })
  const responseSchema = reverseRules(jsonSchemaRules({ notMergeAllOf }))

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
      $: [nonBreaking, breaking, breaking],
      "/name": { $: parameterNameClassifyRule },
      "/in": { $: [nonBreaking, breaking, breaking] },
      "/schema": () => ({
        ...requestSchema,
        $: allBreaking,
        "/type": { $: paramSchemaTypeClassifyRule }
      }),
      "/explode": { $: parameterExplodeClassifyRule },
      "/style": { $: parameterStyleClassifyRule },
      "/description": { $: allAnnotation },
      "/required": { $: parameterRequiredClassifyRule },
      "/deprecated": { $: allDeprecated },
    },
  }
  
  const headersRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    "/*": {
      $: [nonBreaking, breaking, breaking],
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
  
  const contentRules = (response = false): CompareRules => ({
    $: [nonBreaking, breaking, breaking],
    mapping: contentMediaTypeMappingResolver,
    "/*": {
      $: [nonBreaking, breaking, unclassified],
      "/schema": () => ({
        ...response ? responseSchema : requestSchema,
        $: allBreaking
      }),
      "/example": { $: allAnnotation },
      "/examples": { $: allAnnotation },
      "/encoding": encodingRules,
    },
  })
  
  const requestBodiesRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    "/description": { $: allAnnotation },
    "/content": contentRules(),
    "/required": { $: [breaking, nonBreaking, breakingIfAfterTrue] },
  }
  
  const responsesRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    "/*": {
      $: [nonBreaking, breaking, breaking],
      "/description": { $: allAnnotation },
      "/headers": headersRules,
      "/content": contentRules(true),
    },
  }  

  const rules = {
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
          ...requestSchema,
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
