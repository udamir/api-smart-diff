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
/******/ 	return __webpack_require__(__webpack_require__.s = 4);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.breakingIfAfterTrue = exports.breakingIf = exports.allAnnotation = exports.allUnclassified = exports.addNonBreaking = exports.onlyAddBreaking = exports.allBreaking = exports.allNonBreaking = exports.unclassified = exports.annotation = exports.nonBreaking = exports.breaking = void 0;
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
const breakingIf = (v) => (v ? exports.breaking : exports.nonBreaking);
exports.breakingIf = breakingIf;
const breakingIfAfterTrue = (_, a) => (0, exports.breakingIf)(a);
exports.breakingIfAfterTrue = breakingIfAfterTrue;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcnVsZXMvaGVscGVycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFYSxRQUFBLFFBQVEsR0FBRyxVQUFVLENBQUE7QUFDckIsUUFBQSxXQUFXLEdBQUcsY0FBYyxDQUFBO0FBQzVCLFFBQUEsVUFBVSxHQUFHLFlBQVksQ0FBQTtBQUN6QixRQUFBLFlBQVksR0FBRyxjQUFjLENBQUE7QUFFMUMseUJBQXlCO0FBQ1osUUFBQSxjQUFjLEdBQWUsQ0FBQyxtQkFBVyxFQUFFLG1CQUFXLEVBQUUsbUJBQVcsQ0FBQyxDQUFBO0FBQ3BFLFFBQUEsV0FBVyxHQUFlLENBQUMsZ0JBQVEsRUFBRSxnQkFBUSxFQUFFLGdCQUFRLENBQUMsQ0FBQTtBQUN4RCxRQUFBLGVBQWUsR0FBZSxDQUFDLGdCQUFRLEVBQUUsbUJBQVcsRUFBRSxtQkFBVyxDQUFDLENBQUE7QUFDbEUsUUFBQSxjQUFjLEdBQWUsQ0FBQyxtQkFBVyxFQUFFLGdCQUFRLEVBQUUsZ0JBQVEsQ0FBQyxDQUFBO0FBQzlELFFBQUEsZUFBZSxHQUFlLENBQUMsb0JBQVksRUFBRSxvQkFBWSxFQUFFLG9CQUFZLENBQUMsQ0FBQTtBQUN4RSxRQUFBLGFBQWEsR0FBZSxDQUFDLGtCQUFVLEVBQUUsa0JBQVUsRUFBRSxrQkFBVSxDQUFDLENBQUE7QUFFN0UsVUFBVTtBQUNILE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBVSxFQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZ0JBQVEsQ0FBQyxDQUFDLENBQUMsbUJBQVcsQ0FBQyxDQUFBO0FBQXJFLFFBQUEsVUFBVSxjQUEyRDtBQUMzRSxNQUFNLG1CQUFtQixHQUFHLENBQUMsQ0FBTSxFQUFFLENBQU0sRUFBYyxFQUFFLENBQUMsSUFBQSxrQkFBVSxFQUFDLENBQUMsQ0FBQyxDQUFBO0FBQW5FLFFBQUEsbUJBQW1CLHVCQUFnRCJ9

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonSchemaRules = void 0;
const helpers_1 = __webpack_require__(0);
const maxClassifier = [
    helpers_1.breaking,
    helpers_1.nonBreaking,
    (b, a) => (0, helpers_1.breakingIf)(b < a)
];
const minClassifier = [
    helpers_1.breaking,
    helpers_1.nonBreaking,
    (b, a) => (0, helpers_1.breakingIf)(b > a)
];
const exclusiveClassifier = [
    helpers_1.breakingIfAfterTrue,
    helpers_1.nonBreaking,
    (b, a) => (0, helpers_1.breakingIf)(b < a)
];
const booleanClassifier = [
    helpers_1.breakingIfAfterTrue,
    helpers_1.nonBreaking,
    helpers_1.breakingIfAfterTrue
];
const multipleOfClassifier = [
    helpers_1.breaking,
    helpers_1.nonBreaking,
    (b, a) => (0, helpers_1.breakingIf)(!!(b % a))
];
const jsonSchemaRules = (rootRule = helpers_1.allUnclassified) => ({
    "/": rootRule,
    "/title": helpers_1.allAnnotation,
    "/multipleOf": multipleOfClassifier,
    "/maximum": maxClassifier,
    "/exclusiveMaximum": exclusiveClassifier,
    "/minimum": minClassifier,
    "/exclusiveMinimum": exclusiveClassifier,
    "/maxLength": maxClassifier,
    "/minLength": minClassifier,
    "/pattern": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
    "/maxItems": maxClassifier,
    "/minItems": minClassifier,
    "/uniqueItems": booleanClassifier,
    "/maxProperties": maxClassifier,
    "/minProperties": minClassifier,
    "/required": {
        "/": helpers_1.onlyAddBreaking,
        "/*": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
    },
    "/enum": {
        "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
        "/*": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    },
    "/type": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
    "/not": {
        "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(helpers_1.allBreaking),
    },
    "/allOf": {
        "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(helpers_1.allBreaking),
    },
    "/oneOf": {
        "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(helpers_1.addNonBreaking),
    },
    "/anyOf": {
        "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(helpers_1.addNonBreaking),
    },
    "/items": () => (0, exports.jsonSchemaRules)(),
    "/properties": {
        "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
        "/*": () => (0, exports.jsonSchemaRules)(),
    },
    "/additionalProperties": {
        "/": [helpers_1.breaking, helpers_1.breaking, helpers_1.breakingIfAfterTrue],
        "/*": () => (0, exports.jsonSchemaRules)(helpers_1.addNonBreaking),
    },
    "/description": helpers_1.allAnnotation,
    "/format": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
    "/default": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/nullable": booleanClassifier,
    "/discriminator": {
        // TODO
        "/": helpers_1.allUnclassified,
        "/propertyName": helpers_1.allUnclassified,
        "/mapping": helpers_1.allUnclassified,
    },
    "/readOnly": booleanClassifier,
    "/writeOnly": booleanClassifier,
    "/example": helpers_1.allAnnotation,
    "/externalDocs": helpers_1.allAnnotation,
    "/deprecated": booleanClassifier,
    "/xml": {
        // TODO
        "/": helpers_1.allUnclassified,
        "/name": helpers_1.allUnclassified,
        "/namespace": helpers_1.allUnclassified,
        "/prefix": helpers_1.allUnclassified,
        "/attribute": helpers_1.allUnclassified,
        "/wrapped": helpers_1.allUnclassified,
    },
});
exports.jsonSchemaRules = jsonSchemaRules;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbnNjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9ydWxlcy9qc29uc2NoZW1hLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHVDQUlrQjtBQUVsQixNQUFNLGFBQWEsR0FBZTtJQUNoQyxrQkFBUTtJQUNSLHFCQUFXO0lBQ1gsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLG9CQUFVLEVBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1QixDQUFBO0FBRUQsTUFBTSxhQUFhLEdBQWU7SUFDaEMsa0JBQVE7SUFDUixxQkFBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSxvQkFBVSxFQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDNUIsQ0FBQTtBQUVELE1BQU0sbUJBQW1CLEdBQWU7SUFDdEMsNkJBQW1CO0lBQ25CLHFCQUFXO0lBQ1gsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLG9CQUFVLEVBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1QixDQUFBO0FBRUQsTUFBTSxpQkFBaUIsR0FBZTtJQUNwQyw2QkFBbUI7SUFDbkIscUJBQVc7SUFDWCw2QkFBbUI7Q0FDcEIsQ0FBQTtBQUVELE1BQU0sb0JBQW9CLEdBQWU7SUFDdkMsa0JBQVE7SUFDUixxQkFBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSxvQkFBVSxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNoQyxDQUFBO0FBRU0sTUFBTSxlQUFlLEdBQUcsQ0FBQyxXQUF1Qix5QkFBZSxFQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLEdBQUcsRUFBRSxRQUFRO0lBQ2IsUUFBUSxFQUFFLHVCQUFhO0lBQ3ZCLGFBQWEsRUFBRSxvQkFBb0I7SUFDbkMsVUFBVSxFQUFFLGFBQWE7SUFD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

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
__exportStar(__webpack_require__(6), exports);
__exportStar(__webpack_require__(7), exports);
__exportStar(__webpack_require__(1), exports);
__exportStar(__webpack_require__(0), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVsZXMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhDQUEyQjtBQUMzQiw2Q0FBMEI7QUFDMUIsK0NBQTRCO0FBQzVCLDRDQUF5QiJ9

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionType = void 0;
var ActionType;
(function (ActionType) {
    ActionType["add"] = "add";
    ActionType["remove"] = "remove";
    ActionType["replace"] = "replace";
})(ActionType = exports.ActionType || (exports.ActionType = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsSUFBWSxVQUlYO0FBSkQsV0FBWSxVQUFVO0lBQ3BCLHlCQUFXLENBQUE7SUFDWCwrQkFBaUIsQ0FBQTtJQUNqQixpQ0FBbUIsQ0FBQTtBQUNyQixDQUFDLEVBSlcsVUFBVSxHQUFWLGtCQUFVLEtBQVYsa0JBQVUsUUFJckIifQ==

/***/ }),
/* 4 */
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
__exportStar(__webpack_require__(5), exports);
__exportStar(__webpack_require__(2), exports);
__exportStar(__webpack_require__(3), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZDQUEwQjtBQUMxQiwwQ0FBdUI7QUFDdkIsMENBQXVCIn0=

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.apiDiff = exports.syncApiDiff = void 0;
const rules_1 = __webpack_require__(2);
const json_diff_1 = __webpack_require__(8);
const getBaseRules = (name) => {
    switch (name) {
        case "OpenApi3":
            return rules_1.openapi3Rules;
        case "AsyncApi2":
            return rules_1.asyncApi2Rules;
        case "JsonSchema":
            return (0, rules_1.jsonSchemaRules)();
    }
};
const syncApiDiff = (before, after, rules) => {
    rules = typeof rules === "string" ? getBaseRules(rules) : rules;
    return (0, json_diff_1.jsonDiff)(before, after, { rules });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWRpZmYuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYXBpLWRpZmYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQXdFO0FBRXhFLDJDQUFzQztBQUd0QyxNQUFNLFlBQVksR0FBRyxDQUFDLElBQW1CLEVBQVMsRUFBRTtJQUNsRCxRQUFRLElBQUksRUFBRTtRQUNaLEtBQUssVUFBVTtZQUNiLE9BQU8scUJBQWEsQ0FBQTtRQUN0QixLQUFLLFdBQVc7WUFDZCxPQUFPLHNCQUFjLENBQUE7UUFDdkIsS0FBSyxZQUFZO1lBQ2YsT0FBTyxJQUFBLHVCQUFlLEdBQUUsQ0FBQTtLQUMzQjtBQUNILENBQUMsQ0FBQTtBQUVNLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBVyxFQUFFLEtBQVUsRUFBRSxLQUE0QixFQUFxQixFQUFFO0lBQ3RHLEtBQUssR0FBRyxPQUFPLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFBO0lBQy9ELE9BQU8sSUFBQSxvQkFBUSxFQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFBO0FBQzNDLENBQUMsQ0FBQTtBQUhZLFFBQUEsV0FBVyxlQUd2QjtBQUVNLE1BQU0sT0FBTyxHQUFHLENBQUMsTUFBVyxFQUFFLEtBQVUsRUFBRSxLQUE0QixFQUE4QixFQUFFO0lBQzNHLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDckMsSUFBSTtZQUNGLE9BQU8sQ0FBQyxJQUFBLG1CQUFXLEVBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFBO1NBQzNDO1FBQUMsT0FBTyxLQUFLLEVBQUU7WUFDZCxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7U0FDZDtJQUNILENBQUMsQ0FBQyxDQUFBO0FBQ0osQ0FBQyxDQUFBO0FBUlksUUFBQSxPQUFPLFdBUW5CIn0=

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncApi2Rules = exports.messageRules = exports.messageTraitsRules = void 0;
const jsonschema_1 = __webpack_require__(1);
const helpers_1 = __webpack_require__(0);
const correlationIdRules = {
    "/": helpers_1.addNonBreaking,
    "/location": helpers_1.addNonBreaking,
    "/description": helpers_1.allAnnotation,
};
const commonRules = {
    "/summary": helpers_1.allAnnotation,
    "/tags": helpers_1.allAnnotation,
    "/externalDocs": helpers_1.allAnnotation,
    "/bindings": helpers_1.allUnclassified,
};
const pubsubTraitsRules = Object.assign({ "/": helpers_1.addNonBreaking, "/*": helpers_1.addNonBreaking, "/operationId": helpers_1.addNonBreaking, "/description": helpers_1.allAnnotation }, commonRules);
exports.messageTraitsRules = Object.assign({ "/": helpers_1.addNonBreaking, "/*": helpers_1.addNonBreaking, "/headers": helpers_1.allUnclassified, "/correlationId": correlationIdRules, "/schemaFormat": helpers_1.allBreaking, "/contentType": helpers_1.addNonBreaking, "/name": helpers_1.allNonBreaking, "/title": helpers_1.allNonBreaking, "/examples": helpers_1.allAnnotation }, commonRules);
exports.messageRules = Object.assign({ "/": helpers_1.allBreaking, "/headers": helpers_1.allUnclassified, "/correlationId": correlationIdRules, "/schemaFormat": helpers_1.allBreaking, "/contentType": helpers_1.addNonBreaking, "/name": helpers_1.allNonBreaking, "/title": helpers_1.allNonBreaking, "/description": helpers_1.allNonBreaking, "/examples": helpers_1.allAnnotation, "/traits": exports.messageTraitsRules, "/payload": (0, jsonschema_1.jsonSchemaRules)(helpers_1.allBreaking) }, commonRules);
const pubsubRules = Object.assign({ "/": helpers_1.addNonBreaking, "/operationId": helpers_1.addNonBreaking, "/description": helpers_1.allAnnotation, "/traits": pubsubTraitsRules, "/message": exports.messageRules }, commonRules);
const infoRules = {
    "/": helpers_1.addNonBreaking,
    "/version": helpers_1.addNonBreaking,
    "/termsOfService": helpers_1.addNonBreaking,
    "/license": {
        "/": helpers_1.addNonBreaking,
        "/name": helpers_1.allBreaking,
        "/url": helpers_1.onlyAddBreaking,
    },
    "/title": helpers_1.allAnnotation,
    "/description": helpers_1.allAnnotation,
    "/contact": {
        "/": helpers_1.allAnnotation,
        "/name": helpers_1.allAnnotation,
        "/url": helpers_1.allAnnotation,
        "/email": helpers_1.allAnnotation,
    },
};
const serversRules = {
    "/": helpers_1.addNonBreaking,
    "/*": {
        "/": helpers_1.addNonBreaking,
        "/url": helpers_1.addNonBreaking,
        "/description": helpers_1.allAnnotation,
        "/protocol": helpers_1.allBreaking,
        "/protocolVersion": helpers_1.allBreaking,
        "/variables": {
            "/": helpers_1.addNonBreaking,
            "/*": {
                "/": helpers_1.addNonBreaking,
                "/enum": {
                    "/": helpers_1.addNonBreaking,
                    "/*": helpers_1.addNonBreaking,
                },
                "/default": helpers_1.allBreaking,
                "/description": helpers_1.allAnnotation,
                "/examples": helpers_1.allAnnotation,
            },
        },
        "/security": {
            "/": helpers_1.allBreaking,
            "/*": helpers_1.allBreaking,
        },
        "/bindings": helpers_1.allUnclassified,
    },
};
const channelRules = {
    "/": helpers_1.addNonBreaking,
    "/description": helpers_1.allNonBreaking,
    "/bindings": helpers_1.allUnclassified,
    "/subscribe": pubsubRules,
    "/publish": pubsubRules,
    "/parameters": {
        "/": helpers_1.allBreaking,
        "/*": {
            "/": helpers_1.addNonBreaking,
            "/description": helpers_1.allNonBreaking,
            "/schema": (0, jsonschema_1.jsonSchemaRules)(helpers_1.allBreaking),
            "/location": helpers_1.allBreaking,
        },
    },
};
exports.asyncApi2Rules = {
    "/asyncapi": helpers_1.addNonBreaking,
    "/id": helpers_1.allAnnotation,
    "/defaultContentType": helpers_1.allBreaking,
    "/info": infoRules,
    "/servers": serversRules,
    "/channels": {
        "/": helpers_1.addNonBreaking,
        "/*": channelRules,
    },
    "/components": helpers_1.allNonBreaking,
    "/tags": helpers_1.allAnnotation,
    "/externalDocs": helpers_1.allAnnotation,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNhcGkyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3J1bGVzL2FzeW5jYXBpMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBOEM7QUFFOUMsdUNBR2tCO0FBRWxCLE1BQU0sa0JBQWtCLEdBQVU7SUFDaEMsR0FBRyxFQUFFLHdCQUFjO0lBQ25CLFdBQVcsRUFBRSx3QkFBYztJQUMzQixjQUFjLEVBQUUsdUJBQWE7Q0FDOUIsQ0FBQTtBQUVELE1BQU0sV0FBVyxHQUFVO0lBQ3pCLFVBQVUsRUFBRSx1QkFBYTtJQUN6QixPQUFPLEVBQUUsdUJBQWE7SUFDdEIsZUFBZSxFQUFFLHVCQUFhO0lBQzlCLFdBQVcsRUFBRSx5QkFBZTtDQUM3QixDQUFBO0FBRUQsTUFBTSxpQkFBaUIsbUJBQ3JCLEdBQUcsRUFBRSx3QkFBYyxFQUNuQixJQUFJLEVBQUUsd0JBQWMsRUFDcEIsY0FBYyxFQUFFLHdCQUFjLEVBQzlCLGNBQWMsRUFBRSx1QkFBYSxJQUMxQixXQUFXLENBQ2YsQ0FBQTtBQUVZLFFBQUEsa0JBQWtCLG1CQUM3QixHQUFHLEVBQUUsd0JBQWMsRUFDbkIsSUFBSSxFQUFFLHdCQUFjLEVBQ3BCLFVBQVUsRUFBRSx5QkFBZSxFQUMzQixnQkFBZ0IsRUFBRSxrQkFBa0IsRUFDcEMsZUFBZSxFQUFFLHFCQUFXLEVBQzVCLGNBQWMsRUFBRSx3QkFBYyxFQUM5QixPQUFPLEVBQUUsd0JBQWMsRUFDdkIsUUFBUSxFQUFFLHdCQUFjLEVBQ3hCLFdBQVcsRUFBRSx1QkFBYSxJQUN2QixXQUFXLEVBQ2Y7QUFFWSxRQUFBLFlBQVksbUJBQ3ZCLEdBQUcsRUFBRSxxQkFBVyxFQUNoQixVQUFVLEVBQUUseUJBQWUsRUFDM0IsZ0JBQWdCLEVBQUUsa0JBQWtCLEVBQ3BDLGVBQWUsRUFBRSxxQkFBVyxFQUM1QixjQUFjLEVBQUUsd0JBQWMsRUFDOUIsT0FBTyxFQUFFLHdCQUFjLEVBQ3ZCLFFBQVEsRUFBRSx3QkFB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

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.openapi3Rules = void 0;
const jsonschema_1 = __webpack_require__(1);
const helpers_1 = __webpack_require__(0);
const serversRules = {
    "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/*": {
        "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/url": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/description": helpers_1.allAnnotation,
        "/variables": {
            "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
            "/*": {
                "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
                "/enum": {
                    "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
                    "/*": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
                },
                "/default": [helpers_1.breaking, helpers_1.breaking, helpers_1.breaking],
                "/description": helpers_1.allAnnotation,
            },
        },
    },
};
const parametersRules = {
    "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/*": {
        "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/name": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/in": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/description": helpers_1.allAnnotation,
        "/required": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breakingIfAfterTrue],
        "/deprecated": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breakingIfAfterTrue],
    },
};
const headersRules = {
    "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/*": {
        "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/description": helpers_1.allAnnotation,
        "/required": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breakingIfAfterTrue],
        "/deprecated": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breakingIfAfterTrue],
    },
};
const encodingRules = {
    "/": [helpers_1.nonBreaking, helpers_1.nonBreaking, helpers_1.nonBreaking],
    "/*": {
        "/contentType": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/headers": headersRules,
        "/style": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/explode": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/allowReserved": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    },
};
const contentRules = {
    "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/*": {
        "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "*": {
            "/schema": (0, jsonschema_1.jsonSchemaRules)(helpers_1.allBreaking),
            "/example": helpers_1.allAnnotation,
            "/examples": helpers_1.allAnnotation,
            "/encoding": encodingRules,
        },
    },
};
const requestBodiesRules = {
    "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/*": {
        "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/description": helpers_1.allAnnotation,
        "/content": contentRules,
        "/required": [helpers_1.breaking, helpers_1.nonBreaking, (_, a) => (a ? helpers_1.breaking : helpers_1.nonBreaking)],
    },
};
const responsesRules = {
    "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/*": {
        "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/description": helpers_1.allAnnotation,
        "/headers": headersRules,
        "/content": contentRules,
    },
};
const securityRules = {
    "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.unclassified],
    "/*": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.unclassified],
};
const operationRules = {
    "/tags": helpers_1.allAnnotation,
    "/summary": helpers_1.allAnnotation,
    "/description": helpers_1.allAnnotation,
    "/externalDocs": helpers_1.allAnnotation,
    "/operationId": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/parameters": parametersRules,
    "/requestBody": requestBodiesRules,
    "/responses": responsesRules,
    "/deprecated": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breakingIfAfterTrue],
    "/security": securityRules,
    "/servers": serversRules,
};
exports.openapi3Rules = {
    "/openapi": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
    "/info": {
        "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/title": helpers_1.allAnnotation,
        "/description": helpers_1.allAnnotation,
        "/termsOfService": helpers_1.allAnnotation,
        "/contact": helpers_1.allAnnotation,
        "/licence": {
            "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
            "/name": [helpers_1.breaking, helpers_1.breaking, helpers_1.breaking],
            "/url": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.nonBreaking],
        },
        "/version": helpers_1.allAnnotation,
    },
    "/servers": serversRules,
    "/paths": {
        "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
        "/*": {
            "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
            "/summary": helpers_1.allAnnotation,
            "/description": helpers_1.allAnnotation,
            "/*": {
                "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
                "/*": operationRules,
            },
            "/servers": serversRules,
            "/parameters": parametersRules,
        },
    },
    "/components": {
        "/": [helpers_1.nonBreaking, helpers_1.nonBreaking, helpers_1.nonBreaking],
        "/schemas": {
            "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
            "/*": (0, jsonschema_1.jsonSchemaRules)(helpers_1.addNonBreaking),
        },
        "/responses": responsesRules,
        "/parameters": parametersRules,
        "/examples": helpers_1.allAnnotation,
        "/requestBodies": {
            "/": [helpers_1.nonBreaking, helpers_1.breaking, helpers_1.breaking],
            "/*": requestBodiesRules,
        },
        "/headers": headersRules,
        "/securitySchemes": {
            "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
            "/*": {
                "/": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
                "/type": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
                "/description": helpers_1.allAnnotation,
                "/name": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
                "/in": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
                "/scheme": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
                "/bearerFormat": helpers_1.allAnnotation,
                "/flows": [helpers_1.breaking, helpers_1.nonBreaking, helpers_1.breaking],
                "/openIdConnectUrl": helpers_1.allAnnotation,
            },
        },
    },
    "/security": securityRules,
    "/tags": helpers_1.allAnnotation,
    "/externalDocs": helpers_1.allAnnotation,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbmFwaTMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVsZXMvb3BlbmFwaTMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkNBQThDO0FBRTlDLHVDQUlrQjtBQUVsQixNQUFNLFlBQVksR0FBVTtJQUMxQixHQUFHLEVBQUUsQ0FBQyxxQkFBVyxFQUFFLGtCQUFRLEVBQUUsa0JBQVEsQ0FBQztJQUN0QyxJQUFJLEVBQUU7UUFDSixHQUFHLEVBQUUsQ0FBQyxxQkFBVyxFQUFFLGtCQUFRLEVBQUUsa0JBQVEsQ0FBQztRQUN0QyxNQUFNLEVBQUUsQ0FBQyxxQkFBVyxFQUFFLGtCQUFRLEVBQUUsa0JBQVEsQ0FBQztRQUN6QyxjQUFjLEVBQUUsdUJBQWE7UUFDN0IsWUFBWSxFQUFFO1lBQ1osR0FBRyxFQUFFLENBQUMscUJBQVcsRUFBRSxrQkFBUSxFQUFFLGtCQUFRLENBQUM7WUFDdEMsSUFBSSxFQUFFO2dCQUNKLEdBQUcsRUFBRSxDQUFDLHFCQUFXLEVBQUUsa0JBQVEsRUFBRSxrQkFBUSxDQUFDO2dCQUN0QyxPQUFPLEVBQUU7b0JBQ1AsR0FBRyxFQUFFLENBQUMscUJBQVcsRUFBRSxrQkFBUSxFQUFFLGtCQUFRLENBQUM7b0JBQ3RDLElBQUksRUFBRSxDQUFDLHFCQUFXLEVBQUUsa0JBQVEsRUFBRSxrQkFBUSxDQUFDO2lCQUN4QztnQkFDRCxVQUFVLEVBQUUsQ0FBQyxrQkFBUSxFQUFFLGtCQUFRLEVBQUUsa0JBQVEsQ0FBQztnQkFDMUMsY0FBYyxFQUFFLHVCQUFhO2FBQzlCO1NBQ0Y7S0FDRjtDQUNGLENBQUE7QUFFRCxNQUFNLGVBQWUsR0FBVTtJQUM3QixHQUFHLEVBQUUsQ0FBQyxxQkFBVyxFQUFFLGtCQUFRLEVBQUUsa0JBQVEsQ0FBQztJQUN0QyxJQUFJLEVBQUU7UUFDSixHQUFHLEVBQUUsQ0FBQyxxQkFBVyxFQUFFLGtCQUFRLEVBQUUsa0JBQVEsQ0FBQztRQUN0QyxPQUFPLEVBQUUs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

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonDiff = void 0;
const types_1 = __webpack_require__(3);
const classifier_1 = __webpack_require__(9);
const typeOf = (value) => {
    if (Array.isArray(value)) {
        return "array";
    }
    return typeof value == null ? "null" : typeof value;
};
const jsonDiff = (before, after, options, path = []) => {
    if (typeOf(before) !== typeOf(after)) {
        return [(0, classifier_1.classifyDiff)({ path, before, after, action: types_1.ActionType.replace }, options === null || options === void 0 ? void 0 : options.rules)];
    }
    switch (typeOf(before)) {
        case "string":
            return stringsDiff(before, after, options, path);
        case "object":
            return objectsDiff(before, after, options, path);
        case "array":
            return arrayDiff(before, after, options, path);
        default:
            return before !== after ? [(0, classifier_1.classifyDiff)({ path, before, after, action: types_1.ActionType.replace }, options === null || options === void 0 ? void 0 : options.rules)] : [];
    }
};
exports.jsonDiff = jsonDiff;
const stringsDiff = (before, after, options, path = []) => {
    const a = normalizeString(before, options);
    const b = normalizeString(after, options);
    return a !== b ? [(0, classifier_1.classifyDiff)({ path, before, after, action: types_1.ActionType.replace }, options === null || options === void 0 ? void 0 : options.rules)] : [];
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
            diffs.push((0, classifier_1.classifyDiff)({
                path: [...path, key],
                after: after[key],
                action: types_1.ActionType.add,
            }, options === null || options === void 0 ? void 0 : options.rules));
        }
        else if (!after.hasOwnProperty(key)) {
            // deleted key
            diffs.push((0, classifier_1.classifyDiff)({
                path: [...path, key],
                before: before[key],
                action: types_1.ActionType.remove,
            }, options === null || options === void 0 ? void 0 : options.rules));
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
                diffs.push((0, classifier_1.classifyDiff)({
                    path: [...path, i],
                    before: before[i],
                    action: types_1.ActionType.remove,
                }, options === null || options === void 0 ? void 0 : options.rules));
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
                diffs.push((0, classifier_1.classifyDiff)({
                    path: [...path, i],
                    before: before[i],
                    action: types_1.ActionType.remove,
                }, options === null || options === void 0 ? void 0 : options.rules));
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
        diffs.push((0, classifier_1.classifyDiff)({
            path: [...path, before.length + i],
            after: _after[i],
            action: types_1.ActionType.add,
        }, options === null || options === void 0 ? void 0 : options.rules));
    }
    return diffs;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbi1kaWZmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2pzb24tZGlmZi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBK0M7QUFDL0MsNkNBQTJDO0FBVzNDLE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBVSxFQUFFLEVBQUU7SUFDNUIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3hCLE9BQU8sT0FBTyxDQUFBO0tBQ2Y7SUFDRCxPQUFPLE9BQU8sS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQTtBQUNyRCxDQUFDLENBQUE7QUFFTSxNQUFNLFFBQVEsR0FBRyxDQUN0QixNQUFXLEVBQ1gsS0FBVSxFQUNWLE9BQTBCLEVBQzFCLE9BQWtCLEVBQUUsRUFDRCxFQUFFO0lBQ3JCLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNwQyxPQUFPLENBQUMsSUFBQSx5QkFBWSxFQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLGtCQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLEtBQUssQ0FBQyxDQUFDLENBQUE7S0FDM0Y7SUFFRCxRQUFRLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUN0QixLQUFLLFFBQVE7WUFDWCxPQUFPLFdBQVcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQTtRQUNsRCxLQUFLLFFBQVE7WUFDWCxPQUFPLFdBQVcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQTtRQUNsRCxLQUFLLE9BQU87WUFDVixPQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFF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

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyDiff = exports.findClassifier = void 0;
const helpers_1 = __webpack_require__(0);
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
            return helpers_1.allUnclassified;
        }
    }
    return helpers_1.allUnclassified;
};
exports.findClassifier = findClassifier;
const classifyDiff = (diff, rules = {}) => {
    const _diff = diff;
    const classifier = (0, exports.findClassifier)(rules, diff.path);
    const index = ["add", "remove", "replace"].indexOf(diff.action);
    const changeType = classifier[index];
    _diff.type = typeof changeType === "function"
        ? changeType(diff.before, diff.after)
        : changeType;
    return _diff;
};
exports.classifyDiff = classifyDiff;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NpZmllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jbGFzc2lmaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDZDQUFpRDtBQUcxQyxNQUFNLGNBQWMsR0FBRyxDQUFDLEtBQVksRUFBRSxJQUFlLEVBQWMsRUFBRTtJQUMxRSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUE7SUFDbEIsS0FBSyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFO1FBQzdCLHFEQUFxRDtRQUNyRCxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFO1lBQ2hFLEdBQUcsR0FBRyxHQUFHLENBQUE7U0FDVjtRQUVELDBCQUEwQjtRQUMxQixJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxFQUFFO1lBQ3BDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUE7WUFDOUIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN2QixPQUFPLElBQUksQ0FBQTthQUNaO1lBQ0QsTUFBTSxHQUFHLE9BQU8sSUFBSSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQTtTQUNwRDthQUFNO1lBQ0wsT0FBTyx5QkFBZSxDQUFBO1NBQ3ZCO0tBQ0Y7SUFDRCxPQUFPLHlCQUFlLENBQUE7QUFDeEIsQ0FBQyxDQUFBO0FBcEJZLFFBQUEsY0FBYyxrQkFvQjFCO0FBRU0sTUFBTSxZQUFZLEdBQUcsQ0FBQyxJQUFXLEVBQUUsUUFBZSxFQUFFLEVBQW1CLEVBQUU7SUFDOUUsTUFBTSxLQUFLLEdBQUcsSUFBdUIsQ0FBQTtJQUVyQyxNQUFNLFVBQVUsR0FBRyxJQUFBLHNCQUFjLEVBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUVuRCxNQUFNLEtBQUssR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtJQUMvRCxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUE7SUFFcEMsS0FBSyxDQUFDLElBQUksR0FBRyxPQUFPLFVBQVUsS0FBSyxVQUFVO1FBQzNDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxVQUFVLENBQUE7SUFFZCxPQUFPLEtBQUssQ0FBQTtBQUNkLENBQUMsQ0FBQTtBQWJZLFFBQUEsWUFBWSxnQkFheEIifQ==

/***/ })
/******/ ]);