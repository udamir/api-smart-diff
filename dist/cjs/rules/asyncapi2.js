"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncApi2Rules = exports.messageRules = exports.messageTraitsRules = void 0;
const jsonschema_1 = require("./jsonschema");
const constants_1 = require("../constants");
const correlationIdRules = {
    "/": constants_1.addNonBreaking,
    "/location": constants_1.addNonBreaking,
    "/description": constants_1.allAnnotation,
};
const commonRules = {
    "/summary": constants_1.allAnnotation,
    "/tags": constants_1.allAnnotation,
    "/externalDocs": constants_1.allAnnotation,
    "/bindings": constants_1.allUnclassified,
};
const pubsubTraitsRules = Object.assign({ "/": constants_1.addNonBreaking, "/*": constants_1.addNonBreaking, "/operationId": constants_1.addNonBreaking, "/description": constants_1.allAnnotation }, commonRules);
exports.messageTraitsRules = Object.assign({ "/": constants_1.addNonBreaking, "/*": constants_1.addNonBreaking, "/headers": constants_1.allUnclassified, "/correlationId": correlationIdRules, "/schemaFormat": constants_1.allBreaking, "/contentType": constants_1.addNonBreaking, "/name": constants_1.allNonBreaking, "/title": constants_1.allNonBreaking, "/examples": constants_1.allAnnotation }, commonRules);
exports.messageRules = Object.assign({ "/": constants_1.allBreaking, "/headers": constants_1.allUnclassified, "/correlationId": correlationIdRules, "/schemaFormat": constants_1.allBreaking, "/contentType": constants_1.addNonBreaking, "/name": constants_1.allNonBreaking, "/title": constants_1.allNonBreaking, "/description": constants_1.allNonBreaking, "/examples": constants_1.allAnnotation, "/traits": exports.messageTraitsRules, "/payload": (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking) }, commonRules);
const pubsubRules = Object.assign({ "/": constants_1.addNonBreaking, "/operationId": constants_1.addNonBreaking, "/description": constants_1.allAnnotation, "/traits": pubsubTraitsRules, "/message": exports.messageRules }, commonRules);
const infoRules = {
    "/": constants_1.addNonBreaking,
    "/version": constants_1.addNonBreaking,
    "/termsOfService": constants_1.addNonBreaking,
    "/license": {
        "/": constants_1.addNonBreaking,
        "/name": constants_1.allBreaking,
        "/url": constants_1.onlyAddBreaking,
    },
    "/title": constants_1.allAnnotation,
    "/description": constants_1.allAnnotation,
    "/contact": {
        "/": constants_1.allAnnotation,
        "/name": constants_1.allAnnotation,
        "/url": constants_1.allAnnotation,
        "/email": constants_1.allAnnotation,
    },
};
const serversRules = {
    "/": constants_1.addNonBreaking,
    "/*": {
        "/": constants_1.addNonBreaking,
        "/url": constants_1.addNonBreaking,
        "/description": constants_1.allAnnotation,
        "/protocol": constants_1.allBreaking,
        "/protocolVersion": constants_1.allBreaking,
        "/variables": {
            "/": constants_1.addNonBreaking,
            "/*": {
                "/": constants_1.addNonBreaking,
                "/enum": {
                    "/": constants_1.addNonBreaking,
                    "/*": constants_1.addNonBreaking,
                },
                "/default": constants_1.allBreaking,
                "/description": constants_1.allAnnotation,
                "/examples": constants_1.allAnnotation,
            },
        },
        "/security": {
            "/": constants_1.allBreaking,
            "/*": constants_1.allBreaking,
        },
        "/bindings": constants_1.allUnclassified,
    },
};
const channelRules = {
    "/": constants_1.addNonBreaking,
    "/description": constants_1.allNonBreaking,
    "/bindings": constants_1.allUnclassified,
    "/subscribe": pubsubRules,
    "/publish": pubsubRules,
    "/parameters": {
        "/": constants_1.allBreaking,
        "/*": {
            "/": constants_1.addNonBreaking,
            "/description": constants_1.allNonBreaking,
            "/schema": (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking),
            "/location": constants_1.allBreaking,
        },
    },
};
exports.asyncApi2Rules = {
    "/asyncapi": constants_1.addNonBreaking,
    "/id": constants_1.allAnnotation,
    "/defaultContentType": constants_1.allBreaking,
    "/info": infoRules,
    "/servers": serversRules,
    "/channels": {
        "/": constants_1.addNonBreaking,
        "/*": channelRules,
    },
    "/components": constants_1.allNonBreaking,
    "/tags": constants_1.allAnnotation,
    "/externalDocs": constants_1.allAnnotation,
};
//# sourceMappingURL=asyncapi2.js.map