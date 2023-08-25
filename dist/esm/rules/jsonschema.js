"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonSchemaRules = void 0;
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
const nonBreakingIfDefault = ({ after, up }) => { var _a, _b, _c; return ((_c = (_b = (_a = up(2).after) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b[after]) === null || _c === void 0 ? void 0 : _c.default) !== undefined ? constants_1.nonBreaking : constants_1.breaking; };
const jsonSchemaRules = (rootRule = constants_1.allUnclassified) => ({
    "/": rootRule,
    "/title": constants_1.allAnnotation,
    "/multipleOf": multipleOfClassifier,
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
    "/maxProperties": maxClassifier,
    "/minProperties": minClassifier,
    "/required": {
        "/": constants_1.onlyAddBreaking,
        "/*": [nonBreakingIfDefault, constants_1.nonBreaking, nonBreakingIfDefault],
    },
    "/enum": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    },
    "/type": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking]
    },
    "/not": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(constants_1.allBreaking),
    },
    "/allOf": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(constants_1.allBreaking),
    },
    "/oneOf": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(constants_1.addNonBreaking),
    },
    "/anyOf": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(constants_1.addNonBreaking),
    },
    "/items": () => (0, exports.jsonSchemaRules)(constants_1.addNonBreaking),
    "/properties": {
        "/": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(constants_1.addNonBreaking),
    },
    "/additionalProperties": () => (0, exports.jsonSchemaRules)([constants_1.breaking, constants_1.breaking, utils_1.breakingIfAfterTrue]),
    "/description": constants_1.allAnnotation,
    "/format": [constants_1.breaking, constants_1.nonBreaking, constants_1.breaking],
    "/default": [constants_1.nonBreaking, constants_1.breaking, constants_1.breaking],
    "/nullable": booleanClassifier,
    "/discriminator": {
        // TODO
        "/": constants_1.allUnclassified,
        "/propertyName": constants_1.allUnclassified,
        "/mapping": constants_1.allUnclassified,
    },
    "/readOnly": booleanClassifier,
    "/writeOnly": booleanClassifier,
    "/example": constants_1.allAnnotation,
    "/examples": constants_1.allAnnotation,
    "/externalDocs": constants_1.allAnnotation,
    "/deprecated": constants_1.allDeprecated,
    "/xml": {
        // TODO
        "/": constants_1.allUnclassified,
        "/name": constants_1.allUnclassified,
        "/namespace": constants_1.allUnclassified,
        "/prefix": constants_1.allUnclassified,
        "/attribute": constants_1.allUnclassified,
        "/wrapped": constants_1.allUnclassified,
    },
});
exports.jsonSchemaRules = jsonSchemaRules;
//# sourceMappingURL=jsonschema.js.map