/*! api-smart-diff@0.1.0 */
var ApiSmartDiff =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 3);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.breakingIfAfterTrue = exports.breakingIf = exports.allAnnotation = exports.allUnclassified = exports.addNonBreaking = exports.onlyAddBreaking = exports.allBreaking = exports.allNonBreaking = exports.unclassified = exports.annotation = exports.nonBreaking = exports.breaking = exports.ActionType = void 0;
var ActionType;
(function (ActionType) {
    ActionType["add"] = "add";
    ActionType["remove"] = "remove";
    ActionType["replace"] = "replace";
})(ActionType = exports.ActionType || (exports.ActionType = {}));
exports.breaking = "breaking";
exports.nonBreaking = "non-breaking";
exports.annotation = "annotation";
exports.unclassified = "unclassified";
// predefined classifiers
exports.allNonBreaking = [exports.nonBreaking, exports.nonBreaking, exports.nonBreaking];
exports.allBreaking = [exports.breaking, exports.breaking, exports.breaking];
exports.onlyAddBreaking = [exports.breaking, exports.nonBreaking, exports.nonBreaking];
exports.addNonBreaking = [exports.nonBreaking, exports.breaking, exports.breaking];
exports.allUnclassified = [exports.unclassified, exports.unclassified, exports.unclassified];
exports.allAnnotation = [exports.annotation, exports.annotation, exports.annotation];
// helpers
const breakingIf = (v) => v ? exports.breaking : exports.nonBreaking;
exports.breakingIf = breakingIf;
const breakingIfAfterTrue = (_, a) => (0, exports.breakingIf)(a);
exports.breakingIfAfterTrue = breakingIfAfterTrue;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsSUFBWSxVQUlYO0FBSkQsV0FBWSxVQUFVO0lBQ3BCLHlCQUFXLENBQUE7SUFDWCwrQkFBaUIsQ0FBQTtJQUNqQixpQ0FBbUIsQ0FBQTtBQUNyQixDQUFDLEVBSlcsVUFBVSxHQUFWLGtCQUFVLEtBQVYsa0JBQVUsUUFJckI7QUFhWSxRQUFBLFFBQVEsR0FBRyxVQUFVLENBQUE7QUFDckIsUUFBQSxXQUFXLEdBQUcsY0FBYyxDQUFBO0FBQzVCLFFBQUEsVUFBVSxHQUFHLFlBQVksQ0FBQTtBQUN6QixRQUFBLFlBQVksR0FBRyxjQUFjLENBQUE7QUFxQjFDLHlCQUF5QjtBQUNaLFFBQUEsY0FBYyxHQUFlLENBQUMsbUJBQVcsRUFBRSxtQkFBVyxFQUFFLG1CQUFXLENBQUMsQ0FBQTtBQUNwRSxRQUFBLFdBQVcsR0FBZSxDQUFDLGdCQUFRLEVBQUUsZ0JBQVEsRUFBRSxnQkFBUSxDQUFDLENBQUE7QUFDeEQsUUFBQSxlQUFlLEdBQWUsQ0FBQyxnQkFBUSxFQUFFLG1CQUFXLEVBQUUsbUJBQVcsQ0FBQyxDQUFBO0FBQ2xFLFFBQUEsY0FBYyxHQUFlLENBQUMsbUJBQVcsRUFBRSxnQkFBUSxFQUFFLGdCQUFRLENBQUMsQ0FBQTtBQUM5RCxRQUFBLGVBQWUsR0FBZSxDQUFDLG9CQUFZLEVBQUUsb0JBQVksRUFBRSxvQkFBWSxDQUFDLENBQUE7QUFDeEUsUUFBQSxhQUFhLEdBQWUsQ0FBQyxrQkFBVSxFQUFFLGtCQUFVLEVBQUUsa0JBQVUsQ0FBQyxDQUFBO0FBRTdFLFVBQVU7QUFDSCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQVUsRUFBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxnQkFBUSxDQUFDLENBQUMsQ0FBQyxtQkFBVyxDQUFBO0FBQW5FLFFBQUEsVUFBVSxjQUF5RDtBQUN6RSxNQUFNLG1CQUFtQixHQUFHLENBQUMsQ0FBTSxFQUFFLENBQU0sRUFBYyxFQUFFLENBQUMsSUFBQSxrQkFBVSxFQUFDLENBQUMsQ0FBQyxDQUFBO0FBQW5FLFFBQUEsbUJBQW1CLHVCQUFnRCJ9

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonSchemaRules = void 0;
const types_1 = __webpack_require__(0);
const maxClassifier = [
    types_1.breaking,
    types_1.nonBreaking,
    (b, a) => (0, types_1.breakingIf)(b < a)
];
const minClassifier = [
    types_1.breaking,
    types_1.nonBreaking,
    (b, a) => (0, types_1.breakingIf)(b > a)
];
const exclusiveClassifier = [
    types_1.breakingIfAfterTrue,
    types_1.nonBreaking,
    (b, a) => (0, types_1.breakingIf)(b < a)
];
const booleanClassifier = [
    types_1.breakingIfAfterTrue,
    types_1.nonBreaking,
    types_1.breakingIfAfterTrue
];
const multipleOfClassifier = [
    types_1.breaking,
    types_1.nonBreaking,
    (b, a) => (0, types_1.breakingIf)(!!(b % a))
];
const jsonSchemaRules = (rootRule = types_1.allUnclassified) => ({
    "/": rootRule,
    "/title": types_1.allAnnotation,
    "/multipleOf": multipleOfClassifier,
    "/maximum": maxClassifier,
    "/exclusiveMaximum": exclusiveClassifier,
    "/minimum": minClassifier,
    "/exclusiveMinimum": exclusiveClassifier,
    "/maxLength": maxClassifier,
    "/minLength": minClassifier,
    "/pattern": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
    "/maxItems": maxClassifier,
    "/minItems": minClassifier,
    "/uniqueItems": booleanClassifier,
    "/maxProperties": maxClassifier,
    "/minProperties": minClassifier,
    "/required": {
        '/': types_1.onlyAddBreaking,
        '/*': [types_1.breaking, types_1.nonBreaking, types_1.breaking]
    },
    "/enum": {
        "/": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
        "/*": [types_1.nonBreaking, types_1.breaking, types_1.breaking]
    },
    "/type": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
    "/not": {
        '/': [types_1.breaking, types_1.nonBreaking, types_1.breaking],
        '/*': () => (0, exports.jsonSchemaRules)(types_1.allBreaking)
    },
    "/allOf": {
        '/': [types_1.breaking, types_1.nonBreaking, types_1.breaking],
        '/*': () => (0, exports.jsonSchemaRules)(types_1.allBreaking)
    },
    "/oneOf": {
        '/': [types_1.breaking, types_1.nonBreaking, types_1.breaking],
        '/*': () => (0, exports.jsonSchemaRules)(types_1.addNonBreaking)
    },
    "/anyOf": {
        '/': [types_1.breaking, types_1.nonBreaking, types_1.breaking],
        '/*': () => (0, exports.jsonSchemaRules)(types_1.addNonBreaking)
    },
    "/items": () => (0, exports.jsonSchemaRules)(),
    "/properties": {
        "/": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(),
    },
    "/additionalProperties": {
        "/": [types_1.breaking, types_1.breaking, types_1.breakingIfAfterTrue],
        '/*': () => (0, exports.jsonSchemaRules)(types_1.addNonBreaking)
    },
    "/description": types_1.allAnnotation,
    "/format": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
    "/default": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/nullable": booleanClassifier,
    "/discriminator": {
        '/': types_1.allUnclassified,
        '/propertyName': types_1.allUnclassified,
        '/mapping': types_1.allUnclassified
    },
    "/readOnly": booleanClassifier,
    "/writeOnly": booleanClassifier,
    "/example": types_1.allAnnotation,
    "/externalDocs": types_1.allAnnotation,
    "/deprecated": booleanClassifier,
    "/xml": {
        '/': types_1.allUnclassified,
        "/name": types_1.allUnclassified,
        "/namespace": types_1.allUnclassified,
        "/prefix": types_1.allUnclassified,
        "/attribute": types_1.allUnclassified,
        "/wrapped": types_1.allUnclassified,
    },
});
exports.jsonSchemaRules = jsonSchemaRules;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbnNjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9ydWxlcy9qc29uc2NoZW1hLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUdpQjtBQUVqQixNQUFNLGFBQWEsR0FBZTtJQUNoQyxnQkFBUTtJQUNSLG1CQUFXO0lBQ1gsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLGtCQUFVLEVBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1QixDQUFBO0FBRUQsTUFBTSxhQUFhLEdBQWU7SUFDaEMsZ0JBQVE7SUFDUixtQkFBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSxrQkFBVSxFQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDNUIsQ0FBQTtBQUVELE1BQU0sbUJBQW1CLEdBQWU7SUFDdEMsMkJBQW1CO0lBQ25CLG1CQUFXO0lBQ1gsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLGtCQUFVLEVBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1QixDQUFBO0FBRUQsTUFBTSxpQkFBaUIsR0FBZTtJQUNwQywyQkFBbUI7SUFDbkIsbUJBQVc7SUFDWCwyQkFBbUI7Q0FDcEIsQ0FBQTtBQUVELE1BQU0sb0JBQW9CLEdBQWU7SUFDdkMsZ0JBQVE7SUFDUixtQkFBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSxrQkFBVSxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNoQyxDQUFBO0FBRU0sTUFBTSxlQUFlLEdBQUcsQ0FBQyxXQUF1Qix1QkFBZSxFQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLEdBQUcsRUFBRSxRQUFRO0lBQ2IsUUFBUSxFQUFFLHFCQUFhO0lBQ3ZCLGFBQWEsRUFBRSxvQkFBb0I7SUFDbkMsVUFBVSxFQUFFLGFBQWE7SUFD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

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(__webpack_require__(7), exports);
__exportStar(__webpack_require__(8), exports);
__exportStar(__webpack_require__(1), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVsZXMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhDQUEyQjtBQUMzQiw2Q0FBMEI7QUFDMUIsK0NBQTRCIn0=

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(__webpack_require__(4), exports);
__exportStar(__webpack_require__(2), exports);
__exportStar(__webpack_require__(0), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZDQUEwQjtBQUMxQiwwQ0FBdUI7QUFDdkIsMENBQXVCIn0=

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.apiDiff = exports.syncApiDiff = void 0;
const classifier_1 = __webpack_require__(5);
const json_diff_1 = __webpack_require__(6);
const rules_1 = __webpack_require__(2);
const getBaseRules = (name) => {
    switch (name) {
        case "OpenApi3": return rules_1.openapi3Rules;
        case "AsyncApi2": return rules_1.asyncApi2Rules;
        case "JsonSchema": return (0, rules_1.jsonSchemaRules)();
    }
};
const syncApiDiff = (before, after, rules) => {
    rules = typeof rules === "string" ? getBaseRules(rules) : rules;
    const diff = (0, json_diff_1.jsonDiff)(before, after);
    return (0, classifier_1.classifyDiff)(rules, diff);
};
exports.syncApiDiff = syncApiDiff;
const apiDiff = (before, after, rules) => {
    return new Promise((resolve, reject) => {
        try {
            resolve((0, exports.syncApiDiff)(before, after, rules));
        }
        catch (error) {
            reject(error);
        }
    });
};
exports.apiDiff = apiDiff;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWRpZmYuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYXBpLWRpZmYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsNkNBQTJDO0FBQzNDLDJDQUFzQztBQUN0QyxtQ0FBd0U7QUFHeEUsTUFBTSxZQUFZLEdBQUcsQ0FBQyxJQUFtQixFQUFTLEVBQUU7SUFDbEQsUUFBUSxJQUFJLEVBQUU7UUFDWixLQUFLLFVBQVUsQ0FBQyxDQUFDLE9BQU8scUJBQWEsQ0FBQTtRQUNyQyxLQUFLLFdBQVcsQ0FBQyxDQUFDLE9BQU8sc0JBQWMsQ0FBQTtRQUN2QyxLQUFLLFlBQVksQ0FBQyxDQUFDLE9BQU8sSUFBQSx1QkFBZSxHQUFFLENBQUE7S0FDNUM7QUFDSCxDQUFDLENBQUE7QUFFTSxNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQVcsRUFBRSxLQUFVLEVBQUUsS0FBNEIsRUFBcUIsRUFBRTtJQUN0RyxLQUFLLEdBQUcsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtJQUMvRCxNQUFNLElBQUksR0FBRyxJQUFBLG9CQUFRLEVBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFBO0lBQ3BDLE9BQU8sSUFBQSx5QkFBWSxFQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNsQyxDQUFDLENBQUE7QUFKWSxRQUFBLFdBQVcsZUFJdkI7QUFFTSxNQUFNLE9BQU8sR0FBRyxDQUFDLE1BQVcsRUFBRSxLQUFVLEVBQUUsS0FBNEIsRUFBOEIsRUFBRTtJQUMzRyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQ3JDLElBQUk7WUFDRixPQUFPLENBQUMsSUFBQSxtQkFBVyxFQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQTtTQUMzQztRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2QsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO1NBQ2Q7SUFDSCxDQUFDLENBQUMsQ0FBQTtBQUNKLENBQUMsQ0FBQTtBQVJZLFFBQUEsT0FBTyxXQVFuQiJ9

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyDiff = exports.findClassifier = void 0;
const types_1 = __webpack_require__(0);
const findClassifier = (rules, path) => {
    let _rules = rules;
    for (let key of [...path, ""]) {
        // check if rules dont have key of key is array index
        if (!_rules.hasOwnProperty(`/${key}`) || typeof key === "number") {
            key = "*";
        }
        // check if rules have key
        if (_rules.hasOwnProperty(`/${key}`)) {
            const rule = _rules[`/${key}`];
            if (Array.isArray(rule)) {
                return rule;
            }
            _rules = typeof rule === "function" ? rule() : rule;
        }
        else {
            return types_1.allUnclassified;
        }
    }
    return types_1.allUnclassified;
};
exports.findClassifier = findClassifier;
const classifyDiff = (rules, diff) => {
    const _diff = diff;
    for (const item of _diff) {
        const classifier = (0, exports.findClassifier)(rules, item.path);
        const index = ["add", "remove", "replace"].indexOf(item.action);
        const changeType = classifier[index];
        if (typeof changeType === "function") {
            item.type = changeType(item.before, item.after);
        }
        else {
            item.type = changeType;
        }
    }
    return _diff;
};
exports.classifyDiff = classifyDiff;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NpZmllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jbGFzc2lmaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUErRjtBQUV4RixNQUFNLGNBQWMsR0FBRyxDQUFDLEtBQVksRUFBRSxJQUFlLEVBQWMsRUFBRTtJQUMxRSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUE7SUFDbEIsS0FBSyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFO1FBQzdCLHFEQUFxRDtRQUNyRCxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFO1lBQ2hFLEdBQUcsR0FBRyxHQUFHLENBQUE7U0FDVjtRQUVELDBCQUEwQjtRQUMxQixJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxFQUFFO1lBQ3BDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUE7WUFDOUIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN2QixPQUFPLElBQUksQ0FBQTthQUNaO1lBQ0QsTUFBTSxHQUFHLE9BQU8sSUFBSSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQTtTQUNwRDthQUFNO1lBQ0wsT0FBTyx1QkFBZSxDQUFBO1NBQ3ZCO0tBQ0Y7SUFDRCxPQUFPLHVCQUFlLENBQUE7QUFDeEIsQ0FBQyxDQUFBO0FBcEJZLFFBQUEsY0FBYyxrQkFvQjFCO0FBRU0sTUFBTSxZQUFZLEdBQUcsQ0FBQyxLQUFZLEVBQUUsSUFBYSxFQUFxQixFQUFFO0lBQzdFLE1BQU0sS0FBSyxHQUFHLElBQXlCLENBQUE7SUFFdkMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7UUFDeEIsTUFBTSxVQUFVLEdBQUcsSUFBQSxzQkFBYyxFQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDbkQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDL0QsTUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQ3BDLElBQUksT0FBTyxVQUFVLEtBQUssVUFBVSxFQUFFO1lBQ3BDLElBQUksQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBO1NBQ2hEO2FBQU07WUFDTCxJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQTtTQUN2QjtLQUNGO0lBRUQsT0FBTyxLQUFLLENBQUE7QUFDZCxDQUFDLENBQUE7QUFmWSxRQUFBLFlBQVksZ0JBZXhCIn0=

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonDiff = void 0;
const types_1 = __webpack_require__(0);
const typeOf = (value) => {
    if (Array.isArray(value)) {
        return "array";
    }
    return typeof value == null ? "null" : typeof value;
};
const jsonDiff = (before, after, options, path = []) => {
    if (typeOf(before) !== typeOf(after)) {
        return [{ path, before, after, action: types_1.ActionType.replace }];
    }
    switch (typeOf(before)) {
        case "string":
            return stringsDiff(before, after, options, path);
        case "object":
            return objectsDiff(before, after, options, path);
        case "array":
            return arrayDiff(before, after, options, path);
        default:
            return before !== after ? [{ path, before, after, action: types_1.ActionType.replace }] : [];
    }
};
exports.jsonDiff = jsonDiff;
const stringsDiff = (before, after, options, path = []) => {
    const a = normalizeString(before, options);
    const b = normalizeString(after, options);
    return a !== b ? [{ path, before, after, action: types_1.ActionType.replace }] : [];
};
const normalizeString = (value, options) => {
    value = (options === null || options === void 0 ? void 0 : options.trimStrings) ? value.trim() : value;
    value = (options === null || options === void 0 ? void 0 : options.caseSensitive) ? value : value.toLowerCase();
    return value;
};
const objectsDiff = (before, after, options, path = []) => {
    const diffs = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
        // skip symbol key
        if (typeof key === "symbol") {
            continue;
        }
        if (!before.hasOwnProperty(key)) {
            // added key
            diffs.push({
                path: [...path, key],
                before: undefined,
                after: after[key],
                action: types_1.ActionType.add,
            });
        }
        else if (!after.hasOwnProperty(key)) {
            // deleted key
            diffs.push({
                path: [...path, key],
                before: before[key],
                after: undefined,
                action: types_1.ActionType.remove,
            });
        }
        else {
            // updated value
            diffs.push(...(0, exports.jsonDiff)(before[key], after[key], options, [...path, key]));
        }
        if ((options === null || options === void 0 ? void 0 : options.findFirstDiff) && diffs.length) {
            break;
        }
    }
    return diffs;
};
const findEqualItemIndex = (item, array, options) => {
    for (let j = 0; j < array.length; j++) {
        if (!(0, exports.jsonDiff)(item, array[j], Object.assign(Object.assign({}, options), { findFirstDiff: true })).length) {
            return j;
        }
    }
    return -1;
};
const arrayDiff = (before, after, options, path = []) => {
    const diffs = [];
    const _after = [...after];
    for (let i = 0; i < before.length; i++) {
        if (options === null || options === void 0 ? void 0 : options.strictArrays) {
            if (i >= after.length) {
                diffs.push({
                    path: [...path, i],
                    before: before[i],
                    after: undefined,
                    action: types_1.ActionType.remove,
                });
            }
            else {
                diffs.push(...(0, exports.jsonDiff)(before[i], after[i], options, [...path, i]));
            }
        }
        else {
            const index = findEqualItemIndex(before[i], _after, options);
            if (index >= 0) {
                _after.splice(index, 1);
            }
            else {
                diffs.push({
                    path: [...path, i],
                    before: before[i],
                    after: undefined,
                    action: types_1.ActionType.remove,
                });
            }
        }
        if ((options === null || options === void 0 ? void 0 : options.findFirstDiff) && diffs.length) {
            break;
        }
    }
    if (options === null || options === void 0 ? void 0 : options.strictArrays) {
        _after.splice(0, before.length);
    }
    for (let i = 0; i < _after.length; i++) {
        diffs.push({
            path: [...path, before.length + i],
            before: undefined,
            after: _after[i],
            action: types_1.ActionType.add,
        });
    }
    return diffs;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbi1kaWZmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2pzb24tZGlmZi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBc0Q7QUFTdEQsTUFBTSxNQUFNLEdBQUcsQ0FBQyxLQUFVLEVBQUUsRUFBRTtJQUM1QixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDeEIsT0FBTyxPQUFPLENBQUE7S0FDZjtJQUNELE9BQU8sT0FBTyxLQUFLLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFBO0FBQ3JELENBQUMsQ0FBQTtBQUVNLE1BQU0sUUFBUSxHQUFHLENBQUMsTUFBVyxFQUFFLEtBQVUsRUFBRSxPQUEwQixFQUFFLE9BQWtCLEVBQUUsRUFBVyxFQUFFO0lBQzdHLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNwQyxPQUFPLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsa0JBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFBO0tBQzdEO0lBRUQsUUFBUSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDdEIsS0FBSyxRQUFRO1lBQ1gsT0FBTyxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUE7UUFDbEQsS0FBSyxRQUFRO1lBQ1gsT0FBTyxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUE7UUFDbEQsS0FBSyxPQUFPO1lBQ1YsT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUE7UUFDaEQ7WUFDRSxPQUFPLE1BQU0sS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsa0JBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUE7S0FDdkY7QUFDSCxDQUFDLENBQUE7QUFmWSxRQUFBLFFBQVEsWUFlcEI7QUFFRCxNQUFNLFdBQVcsR0FBRyxDQUNsQixNQUFjLEVBQ2QsS0FBYSxFQUNiLE9BQTBCLEVBQzFCLE9BQWtCLEVBQUUsRUFDWCxFQUFFO0lBQ1gsTUFBTSxDQUFDLEdBQUcsZUFBZSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQTtJQUMxQyxNQUFNLENBQUMsR0FBRyxlQUFlLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFBO0lBQ3pDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxrQkFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQTtBQUM3RSxDQUFDLENBQUE7QUFFRCxNQUFNLGVBQWUsR0FBRyxDQUFDLEtBQWEsRUFBRSxPQUEwQixFQUFFLEVBQUU7SUFDcEUsS0FBSyxHQUFHLENBQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLFdBQVcsRUFBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7SUFDbkQsS0FBSyxHQUFHLENBQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLGFBQWEsRUFBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUE7SUFDNUQsT0FBTyxLQUFLLENBQUE7QUFDZCxDQUFDLENBQUE7QUFFRCxNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQVcsRUFBRSxLQUFVLEVBQUUsT0FBMEIsRUFBRSxPQUFrQixFQUFFLEVBQVcsRUFBRTtJQUN6RyxNQUFNLEtBQUssR0FBWSxFQUFFLENBQUE7SUFDekIsTUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUNyRSxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtRQUN0QixrQkFBa0I7UUFDbEIsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUU7WUFDM0IsU0FBUTtTQUNUO1FBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDL0IsWUFBWTtZQUNaLEtBQUssQ0FBQyxJQUFJLENBQUM7Z0JBQ1QsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxDQUFDO2dCQUNwQixNQUFNLEVBQUUsU0FBUztnQkFDakIsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUM7Z0JBQ2pCLE1BQU0sRUFBRSxrQkFBVSxDQUFDLEdBQUc7YUFDdkIsQ0FBQyxDQUFBO1NBQ0g7YUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNyQyxjQUFjO1lBQ2QsS0FBSyxDQUFDLElBQUksQ0FBQztnQkFDVCxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxHQUFHLENBQUM7Z0JBQ3BCLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDO2dCQUNuQixLQUFLLEVBQUUsU0FBUztnQkFDaEIsTUFBTSxFQUFFLGtCQUFVLENBQUMsTUFBTTthQUMxQixDQUFDLENBQUE7U0FDSDthQUFNO1lBQ0wsZ0JBQWdCO1lBQ2hCLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7U0FDMUU7UUFFRCxJQUFJLENBQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLGFBQWEsS0FBSSxLQUFLLENBQUMsTUFBTSxFQUFFO1lBQzFDLE1BQUs7U0FDTjtLQUNGO0lBQ0QsT0FBTyxLQUFLLENBQUE7QUFDZCxDQUFDLENBQUE7QUFFRCxNQUFNLGtCQUFrQixHQUFHLENBQUMsSUFBUyxFQUFFLEtBQVksRUFBRSxPQUEwQixFQUFVLEVBQUU7SUFDekYsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDckMsSUFBSSxDQUFDLElBQUEsZ0JBQVEsRUFBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxrQ0FBTyxPQUFPLEtBQUUsYUFBYSxFQUFFLElBQUksSUFBRyxDQUFDLE1BQU0sRUFBRTtZQUN6RSxPQUFPLENBQUMsQ0FBQTtTQUNUO0tBQ0Y7SUFDRCxPQUFPLENBQUMsQ0FBQyxDQUFBO0FBQ1gsQ0FBQyxDQUFBO0FBRUQsTUFBTSxTQUFTLEdBQUcsQ0FBQyxNQUFhLEVBQUUsS0FBWSxFQUFFLE9BQTBCLEVBQUUsT0FBa0IsRUFBRSxFQUFXLEVBQUU7SUFDM0csTUFBTSxLQUFLLEdBQVksRUFBRSxDQUFBO0lBRXpCLE1BQU0sTUFBTSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQTtJQUN6QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN0QyxJQUFJLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxZQUFZLEVBQUU7WUFDekIsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtnQkFDckIsS0FBSyxDQUFDLElBQUksQ0FBQztvQkFDVCxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUM7b0JBQ2xCLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUNqQixLQUFLLEVBQUUsU0FBUztvQkFDaEIsTUFBTSxFQUFFLGtCQUFVLENBQUMsTUFBTTtpQkFDMUIsQ0FBQyxDQUFBO2FBQ0g7aUJBQU07Z0JBQ0wsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTthQUNwRTtTQUNGO2FBQU07WUFDTCxNQUFNLEtBQUssR0FBRyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFBO1lBQzVELElBQUksS0FBSyxJQUFJLENBQUMsRUFBRTtnQkFDZCxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQTthQUN4QjtpQkFBTTtnQkFDTCxLQUFLLENBQUMsSUFBSSxDQUFDO29CQUNULElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQztvQkFDbEIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQ2pCLEtBQUssRUFBRSxTQUFTO29CQUNoQixNQUFNLEVBQUUsa0JBQVUsQ0FBQyxNQUFNO2lCQUMxQixDQUFDLENBQUE7YUFDSDtTQUNGO1FBQ0QsSUFBSSxDQUFBLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxhQUFhLEtBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUMxQyxNQUFLO1NBQ047S0FDRjtJQUVELElBQUksT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLFlBQVksRUFBRTtRQUN6QixNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUE7S0FDaEM7SUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN0QyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ1QsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDbEMsTUFBTSxFQUFFLFNBQVM7WUFDakIsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDaEIsTUFBTSxFQUFFLGtCQUFVLENBQUMsR0FBRztTQUN2QixDQUFDLENBQUE7S0FDSDtJQUVELE9BQU8sS0FBSyxDQUFBO0FBQ2QsQ0FBQyxDQUFBIn0=

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncApi2Rules = exports.messageRules = exports.messageTraitsRules = void 0;
const types_1 = __webpack_require__(0);
const jsonschema_1 = __webpack_require__(1);
const correlationIdRules = {
    "/": types_1.addNonBreaking,
    "/location": types_1.addNonBreaking,
    "/description": types_1.allAnnotation,
};
const commonRules = {
    "/summary": types_1.allAnnotation,
    "/tags": types_1.allAnnotation,
    "/externalDocs": types_1.allAnnotation,
    "/bindings": types_1.allUnclassified,
};
const pubsubTraitsRules = Object.assign({ "/": types_1.addNonBreaking, "/*": types_1.addNonBreaking, "/operationId": types_1.addNonBreaking, "/description": types_1.allAnnotation }, commonRules);
exports.messageTraitsRules = Object.assign({ "/": types_1.addNonBreaking, "/*": types_1.addNonBreaking, "/headers": types_1.allUnclassified, "/correlationId": correlationIdRules, "/schemaFormat": types_1.allBreaking, "/contentType": types_1.addNonBreaking, "/name": types_1.allNonBreaking, "/title": types_1.allNonBreaking, "/examples": types_1.allAnnotation }, commonRules);
exports.messageRules = Object.assign({ "/": types_1.allBreaking, "/headers": types_1.allUnclassified, "/correlationId": correlationIdRules, "/schemaFormat": types_1.allBreaking, "/contentType": types_1.addNonBreaking, "/name": types_1.allNonBreaking, "/title": types_1.allNonBreaking, "/description": types_1.allNonBreaking, "/examples": types_1.allAnnotation, "/traits": exports.messageTraitsRules, "/payload": (0, jsonschema_1.jsonSchemaRules)(types_1.allBreaking) }, commonRules);
const pubsubRules = Object.assign({ "/": types_1.addNonBreaking, "/operationId": types_1.addNonBreaking, "/description": types_1.allAnnotation, "/traits": pubsubTraitsRules, "/message": exports.messageRules }, commonRules);
const infoRules = {
    "/": types_1.addNonBreaking,
    "/version": types_1.addNonBreaking,
    "/termsOfService": types_1.addNonBreaking,
    "/license": {
        "/": types_1.addNonBreaking,
        "/name": types_1.allBreaking,
        "/url": types_1.onlyAddBreaking,
    },
    "/title": types_1.allAnnotation,
    "/description": types_1.allAnnotation,
    "/contact": {
        "/": types_1.allAnnotation,
        "/name": types_1.allAnnotation,
        "/url": types_1.allAnnotation,
        "/email": types_1.allAnnotation,
    },
};
const serversRules = {
    "/": types_1.addNonBreaking,
    "/*": {
        "/": types_1.addNonBreaking,
        "/url": types_1.addNonBreaking,
        "/description": types_1.allAnnotation,
        "/protocol": types_1.allBreaking,
        "/protocolVersion": types_1.allBreaking,
        "/variables": {
            "/": types_1.addNonBreaking,
            "/*": {
                "/": types_1.addNonBreaking,
                "/enum": {
                    "/": types_1.addNonBreaking,
                    "/*": types_1.addNonBreaking,
                },
                "/default": types_1.allBreaking,
                "/description": types_1.allAnnotation,
                "/examples": types_1.allAnnotation,
            },
        },
        "/security": {
            "/": types_1.allBreaking,
            "/*": types_1.allBreaking,
        },
        "/bindings": types_1.allUnclassified,
    },
};
const channelRules = {
    "/": types_1.addNonBreaking,
    "/description": types_1.allNonBreaking,
    "/bindings": types_1.allUnclassified,
    "/subscribe": pubsubRules,
    "/publish": pubsubRules,
    "/parameters": {
        "/": types_1.allBreaking,
        "/*": {
            "/": types_1.addNonBreaking,
            "/description": types_1.allNonBreaking,
            "/schema": (0, jsonschema_1.jsonSchemaRules)(types_1.allBreaking),
            "/location": types_1.allBreaking,
        },
    },
};
exports.asyncApi2Rules = {
    "/asyncapi": types_1.addNonBreaking,
    "/id": types_1.allAnnotation,
    "/defaultContentType": types_1.allBreaking,
    "/info": infoRules,
    "/servers": serversRules,
    "/channels": {
        "/": types_1.addNonBreaking,
        "/*": channelRules,
    },
    "/components": types_1.allNonBreaking,
    "/tags": types_1.allAnnotation,
    "/externalDocs": types_1.allAnnotation,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNhcGkyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3J1bGVzL2FzeW5jYXBpMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxvQ0FHaUI7QUFDakIsNkNBQThDO0FBRTlDLE1BQU0sa0JBQWtCLEdBQVU7SUFDaEMsR0FBRyxFQUFFLHNCQUFjO0lBQ25CLFdBQVcsRUFBRSxzQkFBYztJQUMzQixjQUFjLEVBQUUscUJBQWE7Q0FDOUIsQ0FBQTtBQUVELE1BQU0sV0FBVyxHQUFVO0lBQ3pCLFVBQVUsRUFBRSxxQkFBYTtJQUN6QixPQUFPLEVBQUUscUJBQWE7SUFDdEIsZUFBZSxFQUFFLHFCQUFhO0lBQzlCLFdBQVcsRUFBRSx1QkFBZTtDQUM3QixDQUFBO0FBRUQsTUFBTSxpQkFBaUIsbUJBQ3JCLEdBQUcsRUFBRSxzQkFBYyxFQUNuQixJQUFJLEVBQUUsc0JBQWMsRUFDcEIsY0FBYyxFQUFFLHNCQUFjLEVBQzlCLGNBQWMsRUFBRSxxQkFBYSxJQUMxQixXQUFXLENBQ2YsQ0FBQTtBQUVZLFFBQUEsa0JBQWtCLG1CQUM3QixHQUFHLEVBQUUsc0JBQWMsRUFDbkIsSUFBSSxFQUFFLHNCQUFjLEVBQ3BCLFVBQVUsRUFBRSx1QkFBZSxFQUMzQixnQkFBZ0IsRUFBRSxrQkFBa0IsRUFDcEMsZUFBZSxFQUFFLG1CQUFXLEVBQzVCLGNBQWMsRUFBRSxzQkFBYyxFQUM5QixPQUFPLEVBQUUsc0JBQWMsRUFDdkIsUUFBUSxFQUFFLHNCQUFjLEVBQ3hCLFdBQVcsRUFBRSxxQkFBYSxJQUN2QixXQUFXLEVBQ2Y7QUFFWSxRQUFBLFlBQVksbUJBQ3ZCLEdBQUcsRUFBRSxtQkFBVyxFQUNoQixVQUFVLEVBQUUsdUJBQWUsRUFDM0IsZ0JBQWdCLEVBQUUsa0JBQWtCLEVBQ3BDLGVBQWUsRUFBRSxtQkFBVyxFQUM1QixjQUFjLEVBQUUsc0JBQWMsRUFDOUIsT0FBTyxFQUFFLHNCQUFjLEVBQ3ZCLFFBQVEsRUFBRSxzQkFB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

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.openapi3Rules = void 0;
const types_1 = __webpack_require__(0);
const jsonschema_1 = __webpack_require__(1);
const serversRules = {
    "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/*": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/url": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/description": types_1.allAnnotation,
        "/variables": {
            "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
            "/*": {
                "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
                "/enum": {
                    "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
                    "/*": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
                },
                "/default": [types_1.breaking, types_1.breaking, types_1.breaking],
                "/description": types_1.allAnnotation,
            },
        },
    },
};
const parametersRules = {
    "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/*": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/name": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/in": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/description": types_1.allAnnotation,
        "/required": [types_1.breaking, types_1.nonBreaking, types_1.breakingIfAfterTrue],
        "/deprecated": [types_1.breaking, types_1.nonBreaking, types_1.breakingIfAfterTrue],
    },
};
const headersRules = {
    "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/*": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/description": types_1.allAnnotation,
        "/required": [types_1.breaking, types_1.nonBreaking, types_1.breakingIfAfterTrue],
        "/deprecated": [types_1.breaking, types_1.nonBreaking, types_1.breakingIfAfterTrue],
    },
};
const encodingRules = {
    "/": [types_1.nonBreaking, types_1.nonBreaking, types_1.nonBreaking],
    "/*": {
        "/contentType": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/headers": headersRules,
        "/style": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/explode": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/allowReserved": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    },
};
const contentRules = {
    "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/*": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "*": {
            "/schema": (0, jsonschema_1.jsonSchemaRules)(types_1.allBreaking),
            "/example": types_1.allAnnotation,
            "/examples": types_1.allAnnotation,
            "/encoding": encodingRules,
        },
    },
};
const requestBodiesRules = {
    "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/*": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/description": types_1.allAnnotation,
        "/content": contentRules,
        "/required": [types_1.breaking, types_1.nonBreaking, (_, a) => a ? types_1.breaking : types_1.nonBreaking],
    },
};
const responsesRules = {
    "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/*": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/description": types_1.allAnnotation,
        "/headers": headersRules,
        "/content": contentRules,
    },
};
const securityRules = {
    "/": [types_1.breaking, types_1.nonBreaking, types_1.unclassified],
    "/*": [types_1.breaking, types_1.nonBreaking, types_1.unclassified],
};
const operationRules = {
    "/tags": types_1.allAnnotation,
    "/summary": types_1.allAnnotation,
    "/description": types_1.allAnnotation,
    "/externalDocs": types_1.allAnnotation,
    "/operationId": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/parameters": parametersRules,
    "/requestBody": requestBodiesRules,
    "/responses": responsesRules,
    "/deprecated": [types_1.breaking, types_1.nonBreaking, types_1.breakingIfAfterTrue],
    "/security": securityRules,
    "/servers": serversRules,
};
exports.openapi3Rules = {
    "/openapi": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
    "/info": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/title": types_1.allAnnotation,
        "/description": types_1.allAnnotation,
        "/termsOfService": types_1.allAnnotation,
        "/contact": types_1.allAnnotation,
        "/licence": {
            "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
            "/name": [types_1.breaking, types_1.breaking, types_1.breaking],
            "/url": [types_1.breaking, types_1.nonBreaking, types_1.nonBreaking],
        },
        "/version": types_1.allAnnotation,
    },
    "/servers": serversRules,
    "/paths": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/*": {
            "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
            "/summary": types_1.allAnnotation,
            "/description": types_1.allAnnotation,
            "/*": {
                "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
                "/*": operationRules,
            },
            "/servers": serversRules,
            "/parameters": parametersRules,
        },
    },
    "/components": {
        "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
        "/schemas": {
            "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
            "/*": (0, jsonschema_1.jsonSchemaRules)(types_1.addNonBreaking),
        },
        "/responses": responsesRules,
        "/parameters": parametersRules,
        "/examples": types_1.allAnnotation,
        "/requestBodies": {
            "/": [types_1.nonBreaking, types_1.breaking, types_1.breaking],
            "/*": requestBodiesRules,
        },
        "/headers": headersRules,
        "/securitySchemes": {
            "/": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
            "/*": {
                "/": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
                "/type": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
                "/description": types_1.allAnnotation,
                "/name": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
                "/in": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
                "/scheme": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
                "/bearerFormat": types_1.allAnnotation,
                "/flows": [types_1.breaking, types_1.nonBreaking, types_1.breaking],
                "/openIdConnectUrl": types_1.allAnnotation,
            },
        },
    },
    "/security": securityRules,
    "/tags": types_1.allAnnotation,
    "/externalDocs": types_1.allAnnotation,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbmFwaTMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVsZXMvb3BlbmFwaTMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsb0NBR2lCO0FBQ2pCLDZDQUE4QztBQUU5QyxNQUFNLFlBQVksR0FBVTtJQUMxQixHQUFHLEVBQUUsQ0FBQyxtQkFBVyxFQUFFLGdCQUFRLEVBQUUsZ0JBQVEsQ0FBQztJQUN0QyxJQUFJLEVBQUU7UUFDSixHQUFHLEVBQUUsQ0FBQyxtQkFBVyxFQUFFLGdCQUFRLEVBQUUsZ0JBQVEsQ0FBQztRQUN0QyxNQUFNLEVBQUUsQ0FBQyxtQkFBVyxFQUFFLGdCQUFRLEVBQUUsZ0JBQVEsQ0FBQztRQUN6QyxjQUFjLEVBQUUscUJBQWE7UUFDN0IsWUFBWSxFQUFFO1lBQ1osR0FBRyxFQUFFLENBQUMsbUJBQVcsRUFBRSxnQkFBUSxFQUFFLGdCQUFRLENBQUM7WUFDdEMsSUFBSSxFQUFFO2dCQUNKLEdBQUcsRUFBRSxDQUFDLG1CQUFXLEVBQUUsZ0JBQVEsRUFBRSxnQkFBUSxDQUFDO2dCQUN0QyxPQUFPLEVBQUU7b0JBQ1AsR0FBRyxFQUFFLENBQUMsbUJBQVcsRUFBRSxnQkFBUSxFQUFFLGdCQUFRLENBQUM7b0JBQ3RDLElBQUksRUFBRSxDQUFDLG1CQUFXLEVBQUUsZ0JBQVEsRUFBRSxnQkFBUSxDQUFDO2lCQUN4QztnQkFDRCxVQUFVLEVBQUUsQ0FBQyxnQkFBUSxFQUFFLGdCQUFRLEVBQUUsZ0JBQVEsQ0FBQztnQkFDMUMsY0FBYyxFQUFFLHFCQUFhO2FBQzlCO1NBQ0Y7S0FDRjtDQUNGLENBQUE7QUFFRCxNQUFNLGVBQWUsR0FBVTtJQUM3QixHQUFHLEVBQUUsQ0FBQyxtQkFBVyxFQUFFLGdCQUFRLEVBQUUsZ0JBQVEsQ0FBQztJQUN0QyxJQUFJLEVBQUU7UUFDSixHQUFHLEVBQUUsQ0FBQyxtQkFBVyxFQUFFLGdCQUFRLEVBQUUsZ0JBQVEsQ0FBQztRQUN0QyxPQUFPLEVBQUUs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

/***/ })
/******/ ]);