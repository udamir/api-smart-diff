import {
  breakingIf,
  breakingIfAfterTrue,
  emptySecurity,
  getFirstKey,
  includeSecurity,
  matchRule,
  toLowerCase,
} from '../utils'
import { jsonSchemaRules } from './jsonschema'
import { Rule, Rules } from '../types'
import {
  addNonBreaking,
  allAnnotation,
  allBreaking,
  allDeprecated,
  allNonBreaking,
  annotation,
  breaking,
  JsonSchemaLocation,
  nonBreaking,
  unclassified,
} from '../constants'

const pathArrayRules = (rules: Rules) => matchRule(rules, ({ before, after }) => {
  const beforePath: string = String(before.key).replace(new RegExp("\{.*?\}", "g"), "*")
  const afterPath: string = String(after.key).replace(new RegExp("\{.*?\}", "g"), "*")
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

const NON_BREAKING_HEADERS = ["Accept", "Content-Type", "Authorization", "authorization"]
const isNonBreakingParamRemoval = (param: any): boolean => {
  return param.in === "header" && NON_BREAKING_HEADERS.includes(param.name)
}

const parameterClassifierRule: Rule = [
  nonBreaking,
  ({ before }) => {
    if (!Array.isArray(before)) {
      return breaking
    }

    return before.every(isNonBreakingParamRemoval)
      ? nonBreaking
      : breaking
  },
  breaking,
]

const parameterItemClassifierRule: Rule = [
  nonBreaking,
  ({ before }) => (isNonBreakingParamRemoval(before) ? nonBreaking : breaking),
  breaking,
]

const parametersRules: Rules = paramArrayRules({
  "/": parameterClassifierRule,
  "/*": (param) => ({
    "/": parameterItemClassifierRule,
    "/name": [nonBreaking, breaking, (ctx) => ctx.up().before?.in === "path" ? nonBreaking : breaking ],
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

const contentRules = (location?: JsonSchemaLocation): Rules => contentMediaTypeRules({
  "/": [nonBreaking, breaking, breaking],
  "/*": {
    "/": [nonBreaking, breaking, unclassified],
    "/schema": jsonSchemaRules(allBreaking, location),
    "/example": allAnnotation,
    "/examples": allAnnotation,
    "/encoding": encodingRules,
  },
})

const requestBodiesRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/description": allAnnotation,
  "/content": contentRules(JsonSchemaLocation.requestBody),
  "/required": [breaking, nonBreaking, breakingIfAfterTrue],
}

const responsesRules: Rules = matchRule({
  "/": [nonBreaking, breaking, breaking],
  "/*": {
    "/": [
      nonBreaking,
      breaking,
      ({ before, after }) => breakingIf(toLowerCase(getFirstKey(before)) !== toLowerCase(getFirstKey(after)))],
    "/description": allAnnotation,
    "/headers": headersRules,
    "/content": contentRules,
  },
}, ({ before, after }) => toLowerCase(before.key) === toLowerCase(after.key))

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
  "/operationId": allAnnotation,
  "/parameters": parametersRules,
  "/requestBody": requestBodiesRules,
  "/responses": responsesRules,
  "/deprecated": allDeprecated,
  "/security": operationSecurityRules,
  "/servers": serversRules,
}

export const openapi3MethodRules: Rules = {
  "/": [nonBreaking, breaking, nonBreaking],
  "/summary": allAnnotation,
  "/description": allAnnotation,
  "/*": operationRules,
  "/servers": serversRules,
  "/parameters": parametersRules,
}

export const openapi3Rules: Rules = {
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
  "/paths": pathArrayRules({
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
