import { 
  globalSecurityClassifyRule, globalSecurityItemClassifyRule, operationSecurityClassifyRule, 
  operationSecurityItemClassifyRule, paramClassifyRule, paramSchemaTypeClassifyRule, parameterExplodeClassifyRule, 
  parameterNameClassifyRule, parameterRequiredClassifyRule, parameterStyleClassifyRule
} from "./openapi3.classify"
import { 
  addNonBreaking, allAnnotation, allBreaking, allDeprecated, allNonBreaking, breaking, 
  nonBreaking, unclassified
} from "../constants"
import { 
  contentChangeAnnotation,
  documentChangeAnnotation, encodingChangeAnnotation, operationChangeAnnotation, operationSecurityChangeAnnotation, parameterChangeAnnotation, 
  pathMethodChangeAnnotation, 
  requestBodyChangeAnnotation,
  responseChangeAnnotation
} from "./openapi3.annotate"
import { transformOperation, transformParameterItem, transformPathItems, transformPaths } from "./openapi3.transform"
import { contentMediaTypeMappingResolver, paramMappingResolver, pathMappingResolver } from "./openapi3.mapping"
import { breakingIfAfterTrue, createRefsCompareResolver } from "../jsonSchema"
import type { OpenApi3RulesOptions } from "./openapi3.types"
import type { ClassifyRule, CompareRules } from "../types"
import { openApiSchemaRules } from "./openapi3.schema"
import { enumMappingResolver } from "../jsonSchema"
import { isResponsePath } from "./openapi3.utils"

const paramRule = (classify: ClassifyRule) => ({ $: classify, annotate: parameterChangeAnnotation })
const documentAnnotationRule: CompareRules = { $: allAnnotation, annotate: documentChangeAnnotation }
const operationAnnotationRule: CompareRules = { $: allAnnotation, annotate: operationChangeAnnotation }

export const openapi3Rules = (options: OpenApi3RulesOptions = {}): CompareRules => {
  const requestSchemaRules = openApiSchemaRules(options)
  const responseSchemaRules = openApiSchemaRules({ ...options, response: true })

  const refsCompareResolver = createRefsCompareResolver()

  const serversRules: CompareRules = {
    $: allAnnotation,
    "/**": {
      $: allAnnotation,
    },
    "/*": {
      "/variables": {
        "/*": {
          "/enum": {
            mapping: enumMappingResolver,
          },
        },
      },
    },
  }
  
  const parametersRules: CompareRules = {
    "/*": {
      annotate: parameterChangeAnnotation,
      compare: refsCompareResolver,
      transform: [transformParameterItem],
      $: paramClassifyRule,
      "/name": paramRule(parameterNameClassifyRule),
      "/in": paramRule([nonBreaking, breaking, breaking]),
      "/schema": () => ({
        ...requestSchemaRules,
        $: allBreaking,
        "/type": { 
          ...requestSchemaRules["/type"],
          $: paramSchemaTypeClassifyRule
        }
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
    annotate: encodingChangeAnnotation,
    $: [breaking, nonBreaking, breaking],
    "/*": {
      "/contentType": { $: [nonBreaking, breaking, breaking] },
      "/headers": headersRules,
      "/style": { $: [nonBreaking, breaking, breaking] },
      "/explode": { $: [nonBreaking, breaking, breaking] },
      "/allowReserved": { $: [nonBreaking, breaking, breaking] },
    },
    "/**": {
      annotate: encodingChangeAnnotation,
    }
  }
  
  const contentRules: CompareRules = {
    annotate: contentChangeAnnotation,
    $: [nonBreaking, breaking, breaking],
    mapping: contentMediaTypeMappingResolver,
    "/*": {
      annotate: contentChangeAnnotation,
      "/*": {
        annotate: contentChangeAnnotation,
      },
      $: [nonBreaking, breaking, nonBreaking],
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
    "/*": {
      annotate: requestBodyChangeAnnotation,
    },
    $: [nonBreaking, breaking, breaking],
    compare: refsCompareResolver,
    "/description": { $: allAnnotation },
    "/content": contentRules,
    "/required": { $: [breaking, nonBreaking, breakingIfAfterTrue] },
  }
  
  const responsesRules: CompareRules = {
    $: [nonBreaking, breaking, breaking],
    "/*": {
      annotate: responseChangeAnnotation,
      "/*": {
        annotate: responseChangeAnnotation,
      },
      $: [nonBreaking, breaking, breaking],
      compare: refsCompareResolver,
      "/description": { $: allAnnotation },
      "/headers": headersRules,
      "/content": contentRules,
    },
  }  

  const rules: CompareRules = {
    "/openapi": documentAnnotationRule, 
    "/info": {
      ...documentAnnotationRule,
      "/**": documentAnnotationRule
    },
    "/servers": serversRules,
    "/paths": {
      transform: [transformPaths],
      mapping: pathMappingResolver,
      "/*": {
        $: [unclassified, unclassified, nonBreaking],
        transform: [transformPathItems],
        compare: refsCompareResolver,
        "/summary": { $: allAnnotation },
        "/description": { $: allAnnotation },
        "/*": {
          annotate: pathMethodChangeAnnotation,
          $: [nonBreaking, breaking, unclassified],
          transform: [transformOperation],
          "/*": operationAnnotationRule,
          "/tags": {
            ...operationAnnotationRule,
            mapping: enumMappingResolver,
            "/*": operationAnnotationRule
          },
          "/parameters": {
            ...parametersRules,
            $: [nonBreaking, breaking, breaking],
            mapping: paramMappingResolver,
          },
          "/requestBody": requestBodiesRules,
          "/callbacks": {
            "/*": {
              compare: refsCompareResolver,
            }
          },
          "/responses": responsesRules,
          "/deprecated": { $: allDeprecated },
          "/security": {
            "/**": {
              annotate: operationSecurityChangeAnnotation,
            },
            $: operationSecurityClassifyRule,
            "/*": { 
              $: operationSecurityItemClassifyRule,
              "/*": {
                $: addNonBreaking,
                mapping: enumMappingResolver,
                "/*": { $: addNonBreaking }
              }
            },
          },
          "/servers": serversRules,
        },
        "/servers": serversRules,
        "/parameters": {
          ...parametersRules,
          $: [nonBreaking, breaking, breaking],
          mapping: paramMappingResolver,
        }
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
