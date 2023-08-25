"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphapiRules = exports.graphApiTypesRules = exports.graphApiOperationRules = void 0;
const constants_1 = require("../constants");
const jsonschema_1 = require("./jsonschema");
const utils_1 = require("../utils");
exports.graphApiOperationRules = {
    "/title": constants_1.allAnnotation,
    "/description": constants_1.allAnnotation,
    "/args": {
        "/*": () => graphApiInputValueRules
    },
    "/response": () => exports.graphApiTypesRules,
    "/directives": {
        "/*": () => graphApiDirectiveRules
    }
};
const graphApiDirectiveRules = {
    "/meta": constants_1.allAnnotation
};
// Base Type
const graphApiBaseTypeRules = Object.assign(Object.assign({}, (0, jsonschema_1.jsonSchemaRules)(constants_1.addNonBreaking)), { "/description": constants_1.allAnnotation, "/directives": {
        "/*": () => graphApiDirectiveRules
    } });
// Named Type
const graphApiNamedTypeRules = Object.assign(Object.assign({}, graphApiBaseTypeRules), { "/title": constants_1.allAnnotation });
// SCALAR
const graphApiScalarRules = Object.assign(Object.assign({}, graphApiNamedTypeRules), { "/specifiedByURL": constants_1.allAnnotation });
const graphApiObjectRules = Object.assign(Object.assign({}, graphApiNamedTypeRules), { "/properties": {
        "/*": () => graphApiFieldRules
    } });
const graphApiUnionRules = Object.assign(Object.assign({}, graphApiNamedTypeRules), { "/oneOf": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => graphApiObjectRules,
    } });
const graphApiEnumRules = Object.assign(Object.assign({}, graphApiNamedTypeRules), { "/oneOf": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => graphApiScalarRules,
    } });
const graphApiInputValueRules = {
    "/title": constants_1.allAnnotation,
    "/description": constants_1.allAnnotation,
    "/required": [constants_1.breaking, constants_1.nonBreaking, utils_1.breakingIfAfterTrue],
    "/schema": () => exports.graphApiTypesRules,
    "/default": constants_1.addNonBreaking,
    "/directives": {
        "/*": () => graphApiDirectiveRules
    }
};
const graphApiInputObjectRules = Object.assign(Object.assign({}, graphApiNamedTypeRules), { "/inputFields": {
        "/*": graphApiInputValueRules
    } });
const graphApiListRules = Object.assign(Object.assign({}, graphApiNamedTypeRules), { "/items": () => exports.graphApiTypesRules });
const graphApiFieldRules = Object.assign(Object.assign({}, graphApiBaseTypeRules), { "/args": {
        "/*": () => graphApiInputValueRules
    } });
exports.graphApiTypesRules = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, graphApiScalarRules), graphApiObjectRules), graphApiUnionRules), graphApiListRules), graphApiInputObjectRules);
exports.graphapiRules = {
    "/queries": {
        "/*": exports.graphApiOperationRules
    },
    "/mutations": {
        "/*": exports.graphApiOperationRules
    },
    "/subscriptions": {
        "/*": exports.graphApiOperationRules
    },
    "/components": {
        "/scalars": {
            "/*": graphApiScalarRules,
        },
        "/objects": {
            "/*": graphApiObjectRules,
        },
        "/interfaces": {
            "/*": graphApiObjectRules,
        },
        "/unions": {
            "/*": graphApiUnionRules,
        },
        "/enums": {
            "/*": graphApiEnumRules,
        },
        "/inputObjects": {
            "/*": graphApiInputObjectRules,
        },
        "/directives": {
            "/*": {
                "/": constants_1.addNonBreaking,
                "/title": constants_1.allAnnotation,
                "/description": constants_1.allAnnotation,
                "/locations": constants_1.allAnnotation,
                "/repeatable": constants_1.allUnclassified,
                "/args": {
                    "/": constants_1.addNonBreaking,
                    "/*": graphApiInputValueRules,
                },
            },
        },
    }
};
//# sourceMappingURL=graphapi.js.map