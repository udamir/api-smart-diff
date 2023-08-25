"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceNodeRules = exports.contentMediaTypeRules = void 0;
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const jsonschema_1 = require("./jsonschema");
const childrenArray = (rules) => (0, utils_1.matchRule)(rules, ({ before: { value: b }, after: { value: a } }) => {
    var _a, _b;
    if (a.type !== b.type) {
        return false;
    }
    if (a.type === "model") {
        return a.name === b.name;
    }
    else {
        const beforePath = (_a = b.data.path) === null || _a === void 0 ? void 0 : _a.replace(new RegExp("\{.*?\}", "g"), "*");
        const afterPath = (_b = a.data.path) === null || _b === void 0 ? void 0 : _b.replace(new RegExp("\{.*?\}", "g"), "*");
        return beforePath === afterPath && b.data.method === a.data.method;
    }
});
const contentMediaTypeRules = (rules) => (0, utils_1.matchRule)(rules, ({ before, after }) => {
    const [afterMediaType = ""] = String(after.value.mediaType).split(";");
    const [beforeMediaType = ""] = String(before.value.mediaType).split(";");
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
exports.contentMediaTypeRules = contentMediaTypeRules;
const paramRules = {
    '/': constants_1.addNonBreaking,
    '/name': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    '/style': constants_1.allUnclassified,
    '/description': constants_1.allAnnotation,
    '/examples': constants_1.allAnnotation,
    '/schema': (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking),
    '/explode': constants_1.allUnclassified,
    '/required': [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
    '/deprecated': [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
};
const paramsRules = {
    '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    '/*': paramRules
};
const contentsRules = (0, exports.contentMediaTypeRules)({
    '/': constants_1.addNonBreaking,
    '/*': {
        '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.unclassified],
        '/mediaType': [constants_1.nonBreaking, constants_1.breaking, constants_1.unclassified],
        '/schema': (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking),
        '/examples': (0, utils_1.objArray)("key", {
            "/": constants_1.allAnnotation,
            "/*": constants_1.allAnnotation,
        }),
        '/encodings': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    }
});
const requestRules = {
    '/path': (0, utils_1.objArray)("name", paramsRules),
    '/query': (0, utils_1.objArray)("name", {
        '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        '/*': Object.assign(Object.assign({}, paramRules), { '/allowEmptyValue': [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue], '/allowReserved': [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue] }),
    }),
    '/headers': (0, utils_1.objArray)("name", paramsRules),
    '/cookie': (0, utils_1.objArray)("name", paramsRules),
    '/body': {
        '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        '/contents': contentsRules,
        '/required': [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
        '/description': constants_1.allAnnotation
    },
};
const headersRules = {
    '/': constants_1.allUnclassified,
    '/*': {
        "/": constants_1.addNonBreaking,
        '/name': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        '/style': constants_1.allUnclassified,
        '/description': constants_1.allAnnotation,
        '/schema': (0, jsonschema_1.jsonSchemaRules)(constants_1.allBreaking),
        '/explode': constants_1.allUnclassified,
        '/required': [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
        '/deprecated': [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
    }
};
const responsesRules = {
    "/": constants_1.addNonBreaking,
    "/*": {
        "/": constants_1.addNonBreaking,
        '/code': constants_1.allUnclassified,
        '/contents': contentsRules,
        '/headers': (0, utils_1.objArray)("name", headersRules),
        '/description': constants_1.allAnnotation
    }
};
const serverRules = {
    '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    '/url': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    '/name': constants_1.allAnnotation,
    '/description': constants_1.allAnnotation,
    '/variables': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
};
const securityRules = {
    "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.unclassified],
    "/*": [constants_1.breaking, constants_1.nonBreaking, constants_1.unclassified],
};
const modelRules = {
    '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    '/data': () => (0, jsonschema_1.jsonSchemaRules)(constants_1.addNonBreaking),
    '/*': constants_1.allAnnotation,
};
const operationRules = {
    '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    '/data': {
        // Node common
        '/id': constants_1.allAnnotation,
        '/iid': constants_1.allAnnotation,
        '/tags': constants_1.allAnnotation,
        '/summary': constants_1.allAnnotation,
        '/description': constants_1.allAnnotation,
        // Operation
        '/method': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        '/path': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        '/request': requestRules,
        '/responses': (0, utils_1.objArray)("code", responsesRules),
        '/servers': {
            '/': constants_1.allUnclassified,
            '/*': serverRules
        },
        '/callbacks': childrenArray({
            '/callbackName': constants_1.allAnnotation,
            '/method': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            '/path': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            '/request': requestRules,
            '/responses': (0, utils_1.objArray)("code", responsesRules),
            '/deprecated': constants_1.allUnclassified,
            '/internal': constants_1.allUnclassified,
            '/extensions': constants_1.allUnclassified,
        }),
        '/security': securityRules,
        '/deprecated': [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
        '/internal': constants_1.allUnclassified,
        '/extensions': constants_1.allUnclassified
    },
    '/*': constants_1.allAnnotation,
};
const serviceRules = {
    // Node common
    '/id': constants_1.allAnnotation,
    '/iid': constants_1.allAnnotation,
    '/tags': constants_1.allAnnotation,
    '/summary': constants_1.allAnnotation,
    '/description': constants_1.allAnnotation,
    // service rules
    '/name': constants_1.allAnnotation,
    '/version': constants_1.allAnnotation,
    '/servers': {
        '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        '/*': serverRules
    },
    '/security': securityRules,
    '/securitySchemes': (0, utils_1.objArray)("name", {
        '/': constants_1.addNonBreaking,
        '/*': {
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
    }),
    '/termsOfService': constants_1.allAnnotation,
    '/contact': constants_1.allAnnotation,
    '/license': [constants_1.breaking, constants_1.breaking, constants_1.breaking],
    '/logo': constants_1.allAnnotation
};
exports.serviceNodeRules = {
    '/*': constants_1.allAnnotation,
    '/data': serviceRules,
    '/children': childrenArray({
        '/': [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
        '/*': ({ type }) => type === "model" ? modelRules : operationRules,
    }),
    "/components": {
        "/": [constants_1.nonBreaking, constants_1.nonBreaking, constants_1.nonBreaking],
        "/schemas": {
            "/": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
            "/*": (0, jsonschema_1.jsonSchemaRules)(constants_1.addNonBreaking),
        },
    },
};
//# sourceMappingURL=servicenode.js.map