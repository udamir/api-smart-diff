import { breakingIfAfterTrue, emptySecurity, includeSecurity, matchRule } from "../utils"
import { jsonSchemaRules } from "./jsonschema"
import { Rules, Rule } from "../types"
import {
  breaking, nonBreaking, unclassified,
  allAnnotation, addNonBreaking,
  allBreaking, allNonBreaking, allDeprecated, annotation,
} from "../constants"
import fs from "fs"

const methodMatchRule = (rules: Rules) => matchRule(rules, (data) => {
  if(data.before.key === data.after.key){
    return true;
  }
  else{
    const beforePath: string = String(data.before.value.methodTypePlaceHolder.path).replace(new RegExp("\{.*?\}", "g"), "*")
    const afterPath: string = String(data.after.value.methodTypePlaceHolder.path).replace(new RegExp("\{.*?\}", "g"), "*")

    if(beforePath === afterPath){
      return true;
    }
    else{
      return false;
    }
  }

})

const pathArrayRules = (rules: Rules) => matchRule(rules, (data) => {
  console.log(data)
  const beforePath: string = String(data.before.key).replace(new RegExp("\{.*?\}", "g"), "*")
  const afterPath: string = String(data.after.key).replace(new RegExp("\{.*?\}", "g"), "*")
  return beforePath === afterPath
})

const paramArrayRules = (rules: Rules) => matchRule(rules, ({ before: { value: b }, after: { value: a } }) => {
  return b.in === a.in && (b.in === "path" || b.name === a.name)
})

const contentMediaTypeRules = (rules: Rules) => matchRule(rules, ({ before, after }) => {  
  const [ afterMediaType = "" ] = String(after.key).split(";")
  const [ beforeMediaType = "" ] = String(before.key).split(";")

  const [ afterType, afterSubType ] = afterMediaType.split("/")
  const [ beforeType, beforeSubType ] = beforeMediaType.split("/")

  if (afterType !== beforeType && afterType !== "*" && beforeType !== "*") { return false }
  if (afterSubType !== beforeSubType && afterSubType !== "*" && beforeSubType !== "*") { return false }

  return true
})

const serversRules: Rules = {
  "/": allAnnotation,
  "/*": {
    "/": [nonBreaking, breaking, breaking],
    "/url": [nonBreaking, breaking, breaking],
    "/description": allAnnotation,
    "/variables": {
      "/": [nonBreaking, breaking, breaking],
      "/*": {
        "/": [nonBreaking, breaking, breaking],
        "/enum": {
          "/": [nonBreaking, breaking, breaking],
          "/*": [nonBreaking, breaking, breaking],
        },
        "/default": [nonBreaking, nonBreaking, breaking],
        "/description": allAnnotation,
      },
    },
  },
}

const paramSchemaRules = (param: any): Rules => {
  if (param?.in === "query") {
    const { style = "form" } = param
    if (style === "form") {
      return {
        ...jsonSchemaRules(allBreaking),
        "/type": [breaking, nonBreaking, ({ before, after }) => before === "object" || before === "array" || after === "object" ? breaking : nonBreaking ]
      }
    }
    return jsonSchemaRules(allBreaking)
  } else {
    return jsonSchemaRules(allBreaking)
  }
}

const parameterStyleRule: Rule = [
  ({ after }) => after === "form" ? annotation : breaking, 
  ({ before }) => before === "form" ? annotation : breaking,
  breaking
]

const parameterExplodeRule = (style = "form"): Rule => [
  ({ after }) => (after && style === "form") || (!after && style !== "form") ? annotation : breaking, 
  ({ before }) => (before && style === "form") || (!before && style !== "form") ? annotation : breaking,
  breaking
]

const parametersRules: Rules = paramArrayRules({
  "/": [nonBreaking, breaking, breaking],
  "/*": (param) => ({
    "/": [nonBreaking, breaking, breaking],
    "/name": [breaking, breaking, breaking ],
    "/in": [nonBreaking, breaking, breaking],
    "/schema": paramSchemaRules(param),
    "/explode": parameterExplodeRule(param?.style),
    "/style": parameterStyleRule,
    "/description": allAnnotation,
    "/required": [breaking, nonBreaking, (ctx) => ctx.up().after.schema?.default ? nonBreaking : breakingIfAfterTrue(ctx)],
    "/deprecated": allDeprecated,
  }),
})

const headersRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/*": {
    "/": [nonBreaking, breaking, breaking],
    "/description": allAnnotation,
    "/required": [breaking, nonBreaking, breakingIfAfterTrue],
    "/deprecated": allDeprecated,
  },
}

const encodingRules: Rules = {
  "/": [nonBreaking, nonBreaking, nonBreaking],
  "/*": {
    "/contentType": [nonBreaking, breaking, breaking],
    "/headers": headersRules,
    "/style": [nonBreaking, breaking, breaking],
    "/explode": [nonBreaking, breaking, breaking],
    "/allowReserved": [nonBreaking, breaking, breaking],
  },
}

const contentRules: Rules = contentMediaTypeRules({
  "/": [nonBreaking, breaking, breaking],
  "/*": {
    "/": [nonBreaking, breaking, unclassified],
    "/schema": jsonSchemaRules(allBreaking),
    "/example": allAnnotation,
    "/examples": allAnnotation,
    "/encoding": encodingRules,
  },
})

const requestBodiesRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/description": allAnnotation,
  "/content": contentRules,
  "/required": [breaking, nonBreaking, breakingIfAfterTrue],
}

const responsesRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/*": {
    "/": [nonBreaking, breaking, breaking],
    "/description": allAnnotation,
    "/headers": headersRules,
    "/content": contentRules,
  },
}

const globalSecurityRules: Rules = {
  "/": [
    (ctx) => !emptySecurity(ctx.after) ? breaking : nonBreaking,
    nonBreaking,
    (ctx) => includeSecurity(ctx.after, ctx.before) || emptySecurity(ctx.after) ? nonBreaking : breaking
  ],
  "/*": [
    (ctx) => ctx.up().before.length ? nonBreaking : breaking,
    (ctx) => ctx.up().after.length ? breaking : nonBreaking,
    (ctx) => includeSecurity(ctx.up().after, ctx.up().before) || emptySecurity(ctx.after) ? nonBreaking : breaking
  ],
}

const operationSecurityRules: Rules = {
  "/": [
    (ctx) => emptySecurity(ctx.after) || includeSecurity(ctx.after, ctx.root.before.security) ? nonBreaking : breaking,
    (ctx) => includeSecurity(ctx.root.after.security, ctx.before) ? nonBreaking : breaking,
    (ctx) => includeSecurity(ctx.after, ctx.before) || emptySecurity(ctx.after) ? nonBreaking : breaking
  ],
  "/*": [
    (ctx) => ctx.up().before.length ? nonBreaking : breaking,
    (ctx) => ctx.up().after.length ? breaking : nonBreaking,
    (ctx) => includeSecurity(ctx.up().after, ctx.up().before) || emptySecurity(ctx.after) ? nonBreaking : breaking
  ],
}

const operationRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/tags": allAnnotation,
  "/summary": allAnnotation,
  "/description": allAnnotation,
  "/externalDocs": allAnnotation,
  "/operationId": allBreaking,
  "/path": allNonBreaking,
  "/methodType": allNonBreaking,
  "/parameters": parametersRules,
  "/requestBody": requestBodiesRules,
  "/responses": responsesRules,
  "/deprecated": allDeprecated,
  "/security": operationSecurityRules,
  "/servers": serversRules,
}

const openapi3MethodRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/summary": allAnnotation,
  "/description": allAnnotation,
  "/*": operationRules,
  "/servers": serversRules,
  "/parameters": parametersRules,
}

export const sdkRules: Rules = {
  "/openapi": allAnnotation,
  "/info": {
    "/": allAnnotation,
    "/title": allAnnotation,
    "/description": allAnnotation,
    "/termsOfService": allAnnotation,
    "/contact": allAnnotation,
    "/license": {
      "/": [nonBreaking, breaking, breaking],
      "/name": [breaking, breaking, breaking],
      "/url": [breaking, nonBreaking, nonBreaking],
    },
    "/version": allAnnotation,
  },
  "/servers": serversRules,
  "/paths": methodMatchRule({
    "/": [nonBreaking, breaking, breaking],
    "/*": openapi3MethodRules,
  }),
  "/components": {
    "/": allNonBreaking,
    "/schemas": {
      "/": [nonBreaking, breaking, breaking],
      "/*": jsonSchemaRules(addNonBreaking),
    },
    "/responses": {
      "/": [nonBreaking, breaking, breaking],
      "/*": responsesRules,
    },
    "/parameters": {
      "/": [nonBreaking, breaking, breaking],
      "/*": parametersRules,
    },
    "/examples": allAnnotation,
    "/requestBodies": {
      "/": [nonBreaking, breaking, breaking],
      "/*": requestBodiesRules,
    },
    "/headers": headersRules,
    "/securitySchemes": {
      "/": [breaking, nonBreaking, breaking],
      "/*": {
        "/": [breaking, nonBreaking, breaking],
        "/type": [breaking, nonBreaking, breaking],
        "/description": allAnnotation,
        "/name": [breaking, nonBreaking, breaking],
        "/in": [breaking, nonBreaking, breaking],
        "/scheme": [breaking, nonBreaking, breaking],
        "/bearerFormat": allAnnotation,
        "/flows": [breaking, nonBreaking, breaking],
        "/openIdConnectUrl": allAnnotation,
      },
    },
  },
  "/security": globalSecurityRules,
  "/tags": allAnnotation,
  "/externalDocs": allAnnotation,
}
