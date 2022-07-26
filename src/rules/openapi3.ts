import { breakingIfAfterTrue, matchRule } from "../utils"
import { jsonSchemaRules } from "./jsonschema"
import { Rules } from "../types"
import { 
  breaking, nonBreaking, unclassified, 
  allAnnotation, addNonBreaking, 
  allBreaking,
} from "../constants"

const pathArrayRules = (rules: Rules) => matchRule(rules, ({ before, after }) => {
  const beforePath = String(before.key).replace(new RegExp("\{.*?\}", "g"), "*")
  const afterPath = String(after.key).replace(new RegExp("\{.*?\}", "g"), "*")
  return beforePath === afterPath
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
  "/": [nonBreaking, breaking, breaking],
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
        "/default": [breaking, breaking, breaking],
        "/description": allAnnotation,
      },
    },
  },
}

const parametersRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/*": {
    "/": [nonBreaking, breaking, breaking],
    "/name": [nonBreaking, breaking, (ctx) => ctx.up().before?.in === "path" ? nonBreaking : breaking ],
    "/in": [nonBreaking, breaking, breaking],
    "/schema": jsonSchemaRules(allBreaking),
    "/description": allAnnotation,
    "/required": [breaking, nonBreaking, breakingIfAfterTrue],
    "/deprecated": [breaking, nonBreaking, breakingIfAfterTrue],
  },
}

const headersRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/*": {
    "/": [nonBreaking, breaking, breaking],
    "/description": allAnnotation,
    "/required": [breaking, nonBreaking, breakingIfAfterTrue],
    "/deprecated": [breaking, nonBreaking, breakingIfAfterTrue],
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
  "/required": [breaking, nonBreaking, (ctx) => (ctx.after ? breaking : nonBreaking)],
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

const securityRules: Rules = {
  "/": [breaking, nonBreaking, unclassified],
  "/*": [breaking, nonBreaking, unclassified],
}

const operationRules: Rules = {
  "/": [nonBreaking, breaking, breaking],
  "/tags": allAnnotation,
  "/summary": allAnnotation,
  "/description": allAnnotation,
  "/externalDocs": allAnnotation,
  "/operationId": [nonBreaking, breaking, breaking],
  "/parameters": parametersRules,
  "/requestBody": requestBodiesRules,
  "/responses": responsesRules,
  "/deprecated": [breaking, nonBreaking, breakingIfAfterTrue],
  "/security": securityRules,
  "/servers": serversRules,
}

export const openapi3Rules: Rules = {
  "/openapi": [nonBreaking, breaking, breaking],
  "/info": {
    "/": [nonBreaking, breaking, breaking],
    "/title": allAnnotation,
    "/description": allAnnotation,
    "/termsOfService": allAnnotation,
    "/contact": allAnnotation,
    "/licence": {
      "/": [nonBreaking, breaking, breaking],
      "/name": [breaking, breaking, breaking],
      "/url": [breaking, nonBreaking, nonBreaking],
    },
    "/version": allAnnotation,
  },
  "/servers": serversRules,
  "/paths": pathArrayRules({
    "/": [nonBreaking, breaking, breaking],
    "/*": {
      "/": [nonBreaking, breaking, nonBreaking],
      "/summary": allAnnotation,
      "/description": allAnnotation,
      "/*": operationRules,
      "/servers": serversRules,
      "/parameters": parametersRules,
    },
  }),
  "/components": {
    "/": [nonBreaking, nonBreaking, nonBreaking],
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
  "/security": securityRules,
  "/tags": allAnnotation,
  "/externalDocs": allAnnotation,
}
