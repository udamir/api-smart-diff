import { 
  addNonBreaking, allBreaking, allNonBreaking, allUnclassified, 
  onlyAddBreaking, Rules, allAnnotation
} from "../types"
import { jsonSchemaRules } from "./jsonschema"

const correlationIdRules: Rules = {
  "/": addNonBreaking,
  "/location": addNonBreaking,
  "/description": allAnnotation,
}

const commonRules: Rules = {
  "/summary": allAnnotation,
  "/tags": allAnnotation,
  "/externalDocs": allAnnotation,
  "/bindings": allUnclassified,
}

const pubsubTraitsRules: Rules = {
  "/": addNonBreaking,
  "/*": addNonBreaking,
  "/operationId": addNonBreaking,
  "/description": allAnnotation,
  ...commonRules,
}

export const messageTraitsRules: Rules = {
  "/": addNonBreaking,
  "/*": addNonBreaking,
  "/headers": allUnclassified,
  "/correlationId": correlationIdRules,
  "/schemaFormat": allBreaking,
  "/contentType": addNonBreaking,
  "/name": allNonBreaking,
  "/title": allNonBreaking,
  "/examples": allAnnotation,
  ...commonRules,
}

export const messageRules: Rules = {
  "/": allBreaking,
  "/headers": allUnclassified,
  "/correlationId": correlationIdRules,
  "/schemaFormat": allBreaking,
  "/contentType": addNonBreaking,
  "/name": allNonBreaking,
  "/title": allNonBreaking,
  "/description": allNonBreaking,
  "/examples": allAnnotation,
  "/traits": messageTraitsRules,
  "/payload": jsonSchemaRules(allBreaking),
  ...commonRules,
}

const pubsubRules: Rules = {
  "/": addNonBreaking,
  "/operationId": addNonBreaking,
  "/description": allAnnotation,
  "/traits": pubsubTraitsRules,
  "/message": messageRules,
  ...commonRules,
}

const infoRules: Rules = {
  "/": addNonBreaking,
  "/version": addNonBreaking,
  "/termsOfService": addNonBreaking,
  "/license": {
    "/": addNonBreaking,
    "/name": allBreaking,
    "/url": onlyAddBreaking,
  },
  "/title": allAnnotation,
  "/description": allAnnotation,
  "/contact": {
    "/": allAnnotation,
    "/name": allAnnotation,
    "/url": allAnnotation,
    "/email": allAnnotation,
  },
}

const serversRules: Rules = {
  "/": addNonBreaking,
  "/*": {
    "/": addNonBreaking,
    "/url": addNonBreaking,
    "/description": allAnnotation,
    "/protocol": allBreaking,
    "/protocolVersion": allBreaking,
    "/variables": {
      "/": addNonBreaking,
      "/*": {
        "/": addNonBreaking,
        "/enum": {
          "/": addNonBreaking,
          "/*": addNonBreaking,
        },
        "/default": allBreaking,
        "/description": allAnnotation,
        "/examples": allAnnotation,
      },
    },
    "/security": {
      "/": allBreaking,
      "/*": allBreaking,
    },
    "/bindings": allUnclassified,
  },
}

const channelRules: Rules = {
  "/": addNonBreaking,
  "/description": allNonBreaking,
  "/bindings": allUnclassified,
  "/subscribe": pubsubRules,
  "/publish": pubsubRules,
  "/parameters": {
    "/": allBreaking,
    "/*": {
      "/": addNonBreaking,
      "/description": allNonBreaking,
      "/schema": jsonSchemaRules(allBreaking),
      "/location": allBreaking,
    },
  },
}

export const asyncApi2Rules: Rules = {
  "/asyncapi": addNonBreaking,
  "/id": allAnnotation,
  "/defaultContentType": allBreaking,
  "/info": infoRules,
  "/servers": serversRules,
  "/channels": {
    "/": addNonBreaking,
    "/*": channelRules,
  },
  "/components": allNonBreaking,
  "/tags": allAnnotation,
  "/externalDocs": allAnnotation,
}
