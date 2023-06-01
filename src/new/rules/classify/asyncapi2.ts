import { jsonSchemaRules } from "./jsonschema"
import { ClassifyRules } from "../types"
import { 
  addNonBreaking, allBreaking, allNonBreaking, 
  allUnclassified, onlyAddBreaking, allAnnotation
} from "../constants"

const correlationIdRules: ClassifyRules = {
  "/": addNonBreaking,
  "/location": addNonBreaking,
  "/description": allAnnotation,
}

const commonRules: ClassifyRules = {
  "/summary": allAnnotation,
  "/tags": allAnnotation,
  "/externalDocs": allAnnotation,
  "/bindings": allUnclassified,
}

const pubsubTraitsRules: ClassifyRules = {
  "/": addNonBreaking,
  "/*": addNonBreaking,
  "/operationId": addNonBreaking,
  "/description": allAnnotation,
  ...commonRules,
}

export const messageTraitsRules: ClassifyRules = {
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

export const messageRules: ClassifyRules = {
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

const pubsubRules: ClassifyRules = {
  "/": addNonBreaking,
  "/operationId": addNonBreaking,
  "/description": allAnnotation,
  "/traits": pubsubTraitsRules,
  "/message": messageRules,
  ...commonRules,
}

const infoRules: ClassifyRules = {
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

const serversRules: ClassifyRules = {
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

const channelRules: ClassifyRules = {
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

export const asyncApi2Rules: ClassifyRules = {
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
