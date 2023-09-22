"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdkRules = void 0;
const utils_1 = require("../utils");
const jsonschema_1 = require("./jsonschema");
const constants_1 = require("../constants");
const methodMatchRule = (rules) => (0, utils_1.matchRule)(rules, (data) => {
    if (data.before.key === data.after.key) {
        return true;
    }
    else {
        const beforePath = String(data.before.value.methodTypePlaceHolder.path + data.before.value.methodTypePlaceHolder.methodType).replace(new RegExp("\{.*?\}", "g"), "*");
        const afterPath = String(data.after.value.methodTypePlaceHolder.path + data.after.value.methodTypePlaceHolder.methodType).replace(new RegExp("\{.*?\}", "g"), "*");
        if (beforePath === afterPath) {
            return true;
        }
        else {
            return false;
        }
    }
});
const pathArrayRules = (rules) => (0, utils_1.matchRule)(rules, (data) => {
    console.log(data);
    const beforePath = String(data.before.key).replace(new RegExp("\{.*?\}", "g"), "*");
    const afterPath = String(data.after.key).replace(new RegExp("\{.*?\}", "g"), "*");
    return beforePath === afterPath;
});
const paramArrayRules = (rules) => (0, utils_1.matchRule)(rules, ({ before: { value: b }, after: { value: a } }) => {
    return b.in === a.in && (b.in === "path" || b.name === a.name);
});
const contentMediaTypeRules = (rules) => (0, utils_1.matchRule)(rules, ({ before, after }) => {
    const [afterMediaType = ""] = String(after.key).split(";");
    const [beforeMediaType = ""] = String(before.key).split(";");
    const [afterType, afterSubType] = afterMediaType.split("/");
    const [beforeType, beforeSubType] = beforeMediaType.split("/");
    if (afterType !== beforeType && afterType !== "*" && beforeType !== "*") {
        return false;
    }
    if (afterSubType !== beforeSubType && afterSubType !== "*" && beforeSubType !== "*") {
        return false;
    }
    return true;
});
const serversRules = {
    "/": constants_1.allAnnotation,
    "/*": {
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/url": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/description": constants_1.allAnnotation,
        "/variables": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            "/*": {
                "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
                "/enum": {
                    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
                    "/*": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
                },
                "/default": [constants_1.nonBreaking, constants_1.nonBreaking, constants_1.breaking],
                "/description": constants_1.allAnnotation,
            },
        },
    },
};
const paramSchemaRules = (param) => {
    if ((param === null || param === void 0 ? void 0 : param.in) === "query") {
        const { style = "form" } = param;
        if (style === "form") {
            return Object.assign(Object.assign({}, (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking)), { "/type": [constants_1.breaking, constants_1.nonBreaking, ({ before, after }) => before === "object" || before === "array" || after === "object" ? constants_1.breaking : constants_1.nonBreaking] });
        }
        return (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking);
    }
    else {
        return (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking);
    }
};
const parameterStyleRule = [
    ({ after }) => after === "form" ? constants_1.annotation : constants_1.breaking,
    ({ before }) => before === "form" ? constants_1.annotation : constants_1.breaking,
    constants_1.breaking
];
const parameterExplodeRule = (style = "form") => [
    ({ after }) => (after && style === "form") || (!after && style !== "form") ? constants_1.annotation : constants_1.breaking,
    ({ before }) => (before && style === "form") || (!before && style !== "form") ? constants_1.annotation : constants_1.breaking,
    constants_1.breaking
];
const parametersRules = paramArrayRules({
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/*": (param) => ({
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/name": [constants_1.breaking, constants_1.breaking, constants_1.breaking],
        "/in": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/schema": paramSchemaRules(param),
        "/explode": parameterExplodeRule(param === null || param === void 0 ? void 0 : param.style),
        "/style": parameterStyleRule,
        "/description": constants_1.allAnnotation,
        "/required": [constants_1.breaking, constants_1.nonBreaking, (ctx) => { var _a; return ((_a = ctx.up().after.schema) === null || _a === void 0 ? void 0 : _a.default) ? constants_1.nonBreaking : (0, utils_1.breakingIfAfterTrue)(ctx); }],
        "/deprecated": constants_1.allDeprecated,
    }),
});
const headersRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/*": {
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/description": constants_1.allAnnotation,
        "/required": [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
        "/deprecated": constants_1.allDeprecated,
    },
};
const encodingRules = {
    "/": [constants_1.nonBreaking, constants_1.nonBreaking, constants_1.nonBreaking],
    "/*": {
        "/contentType": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/headers": headersRules,
        "/style": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/explode": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/allowReserved": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    },
};
const contentRules = contentMediaTypeRules({
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/*": {
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.unclassified],
        "/schema": (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking),
        "/example": constants_1.allAnnotation,
        "/examples": constants_1.allAnnotation,
        "/encoding": encodingRules,
    },
});
const requestBodiesRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/description": constants_1.allAnnotation,
    "/content": contentRules,
    "/required": [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
};
const responsesRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/*": {
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/description": constants_1.allAnnotation,
        "/headers": headersRules,
        "/content": contentRules,
    },
};
const globalSecurityRules = {
    "/": [
        (ctx) => !(0, utils_1.emptySecurity)(ctx.after) ? constants_1.breaking : constants_1.nonBreaking,
        constants_1.nonBreaking,
        (ctx) => (0, utils_1.includeSecurity)(ctx.after, ctx.before) || (0, utils_1.emptySecurity)(ctx.after) ? constants_1.nonBreaking : constants_1.breaking
    ],
    "/*": [
        (ctx) => ctx.up().before.length ? constants_1.nonBreaking : constants_1.breaking,
        (ctx) => ctx.up().after.length ? constants_1.breaking : constants_1.nonBreaking,
        (ctx) => (0, utils_1.includeSecurity)(ctx.up().after, ctx.up().before) || (0, utils_1.emptySecurity)(ctx.after) ? constants_1.nonBreaking : constants_1.breaking
    ],
};
const operationSecurityRules = {
    "/": [
        (ctx) => (0, utils_1.emptySecurity)(ctx.after) || (0, utils_1.includeSecurity)(ctx.after, ctx.root.before.security) ? constants_1.nonBreaking : constants_1.breaking,
        (ctx) => (0, utils_1.includeSecurity)(ctx.root.after.security, ctx.before) ? constants_1.nonBreaking : constants_1.breaking,
        (ctx) => (0, utils_1.includeSecurity)(ctx.after, ctx.before) || (0, utils_1.emptySecurity)(ctx.after) ? constants_1.nonBreaking : constants_1.breaking
    ],
    "/*": [
        (ctx) => ctx.up().before.length ? constants_1.nonBreaking : constants_1.breaking,
        (ctx) => ctx.up().after.length ? constants_1.breaking : constants_1.nonBreaking,
        (ctx) => (0, utils_1.includeSecurity)(ctx.up().after, ctx.up().before) || (0, utils_1.emptySecurity)(ctx.after) ? constants_1.nonBreaking : constants_1.breaking
    ],
};
const operationRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/tags": constants_1.allAnnotation,
    "/summary": constants_1.allAnnotation,
    "/description": constants_1.allAnnotation,
    "/externalDocs": constants_1.allAnnotation,
    "/operationId": constants_1.allBreaking,
    "/path": constants_1.allNonBreaking,
    "/methodType": constants_1.allNonBreaking,
    "/parameters": parametersRules,
    "/requestBody": requestBodiesRules,
    "/responses": responsesRules,
    "/deprecated": constants_1.allDeprecated,
    "/security": operationSecurityRules,
    "/servers": serversRules,
};
const openapi3MethodRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/summary": constants_1.allAnnotation,
    "/description": constants_1.allAnnotation,
    "/*": operationRules,
    "/servers": serversRules,
    "/parameters": parametersRules,
};
exports.sdkRules = {
    "/openapi": constants_1.allAnnotation,
    "/info": {
        "/": constants_1.allAnnotation,
        "/title": constants_1.allAnnotation,
        "/description": constants_1.allAnnotation,
        "/termsOfService": constants_1.allAnnotation,
        "/contact": constants_1.allAnnotation,
        "/license": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            "/name": [constants_1.breaking, constants_1.breaking, constants_1.breaking],
            "/url": [constants_1.breaking, constants_1.nonBreaking, constants_1.nonBreaking],
        },
        "/version": constants_1.allAnnotation,
    },
    "/servers": serversRules,
    "/paths": methodMatchRule({
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/*": openapi3MethodRules,
    }),
    "/components": {
        "/": constants_1.allNonBreaking,
        "/schemas": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            "/*": (0, jsonschema_1.jsonSchemaRules)(constants_1.addNonBreaking),
        },
        "/responses": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            "/*": responsesRules,
        },
        "/parameters": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            "/*": parametersRules,
        },
        "/examples": constants_1.allAnnotation,
        "/requestBodies": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            "/*": requestBodiesRules,
        },
        "/headers": headersRules,
        "/securitySchemes": {
            "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
            "/*": {
                "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
                "/type": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
                "/description": constants_1.allAnnotation,
                "/name": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
                "/in": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
                "/scheme": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
                "/bearerFormat": constants_1.allAnnotation,
                "/flows": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
                "/openIdConnectUrl": constants_1.allAnnotation,
            },
        },
    },
    "/security": globalSecurityRules,
    "/tags": constants_1.allAnnotation,
    "/externalDocs": constants_1.allAnnotation,
};
//# sourceMappingURL=sdk.js.map