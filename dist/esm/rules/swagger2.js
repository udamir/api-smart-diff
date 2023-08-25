"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swagger2Rules = void 0;
const utils_1 = require("../utils");
const constants_1 = require("../constants");
const maxClassifier = [
    constants_1.breaking,
    constants_1.nonBreaking,
    ({ before, after }) => (0, utils_1.breakingIf)(before > after)
];
const minClassifier = [
    constants_1.breaking,
    constants_1.nonBreaking,
    ({ before, after }) => (0, utils_1.breakingIf)(before < after)
];
const exclusiveClassifier = [
    utils_1.breakingIfAfterTrue,
    constants_1.nonBreaking,
    utils_1.breakingIfAfterTrue
];
const booleanClassifier = [
    utils_1.breakingIfAfterTrue,
    constants_1.nonBreaking,
    utils_1.breakingIfAfterTrue
];
const multipleOfClassifier = [
    constants_1.breaking,
    constants_1.nonBreaking,
    ({ before, after }) => (0, utils_1.breakingIf)(!!(before % after))
];
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
        (ctx) => (0, utils_1.includeSecurity)(ctx.after, ctx.root.before.security) ? constants_1.nonBreaking : constants_1.breaking,
        (ctx) => (0, utils_1.includeSecurity)(ctx.root.after.security, ctx.before) ? constants_1.nonBreaking : constants_1.breaking,
        (ctx) => (0, utils_1.includeSecurity)(ctx.after, ctx.before) || (0, utils_1.emptySecurity)(ctx.after) ? constants_1.nonBreaking : constants_1.breaking
    ],
    "/*": [
        (ctx) => ctx.up().before.length ? constants_1.nonBreaking : constants_1.breaking,
        (ctx) => ctx.up().after.length ? constants_1.breaking : constants_1.nonBreaking,
        (ctx) => (0, utils_1.includeSecurity)(ctx.up().after, ctx.up().before) || (0, utils_1.emptySecurity)(ctx.after) ? constants_1.nonBreaking : constants_1.breaking
    ],
};
const nonBreakingIfDefault = ({ after, up }) => { var _a, _b, _c; return ((_c = (_b = (_a = up(2).after) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b[after]) === null || _c === void 0 ? void 0 : _c.default) !== undefined ? constants_1.nonBreaking : constants_1.breaking; };
const pathArrayRules = (rules) => (0, utils_1.matchRule)(rules, ({ before, after }) => {
    const beforePath = String(before.key).replace(new RegExp("\{.*?\}", "g"), "*");
    const afterPath = String(after.key).replace(new RegExp("\{.*?\}", "g"), "*");
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
const inlineJsonSchemaRules = () => ({
    "/type": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
    "/format": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
    "/items": () => jsonSchemaRules(constants_1.allBreaking),
    "/default": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/maximum": maxClassifier,
    "/exclusiveMaximum": exclusiveClassifier,
    "/minimum": minClassifier,
    "/exclusiveMinimum": exclusiveClassifier,
    "/maxLength": maxClassifier,
    "/minLength": minClassifier,
    "/pattern": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
    "/maxItems": maxClassifier,
    "/minItems": minClassifier,
    "/uniqueItems": booleanClassifier,
    "/enum": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    },
    "/multipleOf": multipleOfClassifier,
});
const jsonSchemaRules = (rootRule = constants_1.allUnclassified) => (Object.assign(Object.assign({ "/": rootRule }, inlineJsonSchemaRules()), { "/title": constants_1.allAnnotation, "/description": constants_1.allAnnotation, "/items": () => jsonSchemaRules(constants_1.allBreaking), "/maxProperties": maxClassifier, "/minProperties": minClassifier, "/required": {
        "/": constants_1.onlyAddBreaking,
        "/*": [nonBreakingIfDefault, constants_1.nonBreaking, nonBreakingIfDefault],
    }, "/properties": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => jsonSchemaRules(constants_1.addNonBreaking),
    }, "/allOf": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => jsonSchemaRules(constants_1.allBreaking),
    }, "/readOnly": booleanClassifier, "/discriminator": constants_1.allAnnotation, "/additionalProperties": () => jsonSchemaRules([constants_1.breaking, constants_1.breaking, utils_1.breakingIfAfterTrue]), "/example": constants_1.allAnnotation, "/externalDocs": constants_1.allAnnotation, "/xml": constants_1.allUnclassified }));
const serversRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
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
                "/default": [constants_1.breaking, constants_1.breaking, constants_1.breaking],
                "/description": constants_1.allAnnotation,
            },
        },
    },
};
const parametersRules = paramArrayRules({
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/*": Object.assign(Object.assign({ "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking], "/name": [constants_1.nonBreaking, constants_1.breaking, (ctx) => { var _a; return ((_a = ctx.up().before) === null || _a === void 0 ? void 0 : _a.in) === "path" ? constants_1.nonBreaking : constants_1.breaking; }], "/in": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking], "/schema": () => jsonSchemaRules(constants_1.allBreaking), "/description": constants_1.allAnnotation, "/required": [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue] }, jsonSchemaRules()), { "/allowEmptyValue": [constants_1.nonBreaking, ({ before }) => before, ({ before }) => before], "/collectionFormat": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking] }),
});
const headersRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/*": Object.assign(Object.assign({ "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking], "/description": constants_1.allAnnotation }, jsonSchemaRules()), { "/allowEmptyValue": [constants_1.nonBreaking, ({ before }) => before, ({ before }) => before], "/collectionFormat": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking] }),
};
const responsesRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/*": {
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/description": constants_1.allAnnotation,
        "/headers": headersRules,
        "/schema": () => jsonSchemaRules(constants_1.allBreaking),
        "/examples": constants_1.allAnnotation,
    },
};
const operationRules = {
    "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/tags": constants_1.allAnnotation,
    "/summary": constants_1.allAnnotation,
    "/description": constants_1.allAnnotation,
    "/externalDocs": constants_1.allAnnotation,
    "/operationId": constants_1.allAnnotation,
    "/consumes": contentMediaTypeRules({
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/*": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    }),
    "/produces": contentMediaTypeRules({
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/*": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    }),
    "/parameters": parametersRules,
    "/responses": responsesRules,
    "/deprecated": constants_1.allDeprecated,
    "/security": operationSecurityRules
};
exports.swagger2Rules = {
    "/swagger": constants_1.allAnnotation,
    "/info": {
        "/": constants_1.allAnnotation,
        "/title": constants_1.allAnnotation,
        "/description": constants_1.allAnnotation,
        "/termsOfService": constants_1.allAnnotation,
        "/contact": constants_1.allAnnotation,
        "/licence": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            "/name": [constants_1.breaking, constants_1.breaking, constants_1.breaking],
            "/url": [constants_1.breaking, constants_1.nonBreaking, constants_1.nonBreaking],
        },
        "/version": constants_1.allAnnotation,
    },
    "/servers": serversRules,
    "/paths": pathArrayRules({
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/*": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.nonBreaking],
            "/*": operationRules,
            "/parameters": parametersRules,
        },
    }),
    "/definitions": {
        "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        "/*": () => jsonSchemaRules(constants_1.addNonBreaking),
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
    "/securityDefinitions": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": {
            "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
            "/type": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
            "/description": constants_1.allAnnotation,
            "/name": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
            "/in": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
            "/flow": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
            "/authorizationUrl": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
            "/tokenUrl": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
            "/scopes": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        },
    },
    "/security": globalSecurityRules,
    "/tags": constants_1.allAnnotation,
    "/externalDocs": constants_1.allAnnotation,
};
//# sourceMappingURL=swagger2.js.map