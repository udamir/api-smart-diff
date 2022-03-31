/*! api-smart-diff@0.2.6 */
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
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, "messageTraitsRules", function() { return /* reexport */ messageTraitsRules; });
__webpack_require__.d(__webpack_exports__, "messageRules", function() { return /* reexport */ messageRules; });
__webpack_require__.d(__webpack_exports__, "asyncApi2Rules", function() { return /* reexport */ asyncApi2Rules; });
__webpack_require__.d(__webpack_exports__, "openapi3Rules", function() { return /* reexport */ openapi3Rules; });
__webpack_require__.d(__webpack_exports__, "jsonSchemaRules", function() { return /* reexport */ jsonSchemaRules; });
__webpack_require__.d(__webpack_exports__, "DIFF_META_KEY", function() { return /* reexport */ DIFF_META_KEY; });
__webpack_require__.d(__webpack_exports__, "DiffAction", function() { return /* reexport */ DiffAction; });
__webpack_require__.d(__webpack_exports__, "ClassifierType", function() { return /* reexport */ ClassifierType; });
__webpack_require__.d(__webpack_exports__, "breaking", function() { return /* reexport */ breaking; });
__webpack_require__.d(__webpack_exports__, "nonBreaking", function() { return /* reexport */ nonBreaking; });
__webpack_require__.d(__webpack_exports__, "unclassified", function() { return /* reexport */ unclassified; });
__webpack_require__.d(__webpack_exports__, "annotation", function() { return /* reexport */ annotation; });
__webpack_require__.d(__webpack_exports__, "allNonBreaking", function() { return /* reexport */ allNonBreaking; });
__webpack_require__.d(__webpack_exports__, "allBreaking", function() { return /* reexport */ allBreaking; });
__webpack_require__.d(__webpack_exports__, "onlyAddBreaking", function() { return /* reexport */ onlyAddBreaking; });
__webpack_require__.d(__webpack_exports__, "addNonBreaking", function() { return /* reexport */ addNonBreaking; });
__webpack_require__.d(__webpack_exports__, "allUnclassified", function() { return /* reexport */ allUnclassified; });
__webpack_require__.d(__webpack_exports__, "allAnnotation", function() { return /* reexport */ allAnnotation; });
__webpack_require__.d(__webpack_exports__, "apiDiff", function() { return /* reexport */ apiDiff; });
__webpack_require__.d(__webpack_exports__, "apiMerge", function() { return /* reexport */ apiMerge; });
__webpack_require__.d(__webpack_exports__, "findExternalRefs", function() { return /* reexport */ findExternalRefs; });

// CONCATENATED MODULE: ./src/constants.ts
const DIFF_META_KEY = "$diff";
var DiffAction;
(function (DiffAction) {
    DiffAction["add"] = "add";
    DiffAction["remove"] = "remove";
    DiffAction["replace"] = "replace";
})(DiffAction || (DiffAction = {}));
var ClassifierType;
(function (ClassifierType) {
    ClassifierType["breaking"] = "breaking";
    ClassifierType["nonBreaking"] = "non-breaking";
    ClassifierType["annotation"] = "annotation";
    ClassifierType["unclassified"] = "unclassified";
})(ClassifierType || (ClassifierType = {}));
const { breaking, nonBreaking, unclassified, annotation } = ClassifierType;
// predefined classifiers
const allNonBreaking = [nonBreaking, nonBreaking, nonBreaking];
const allBreaking = [breaking, breaking, breaking];
const onlyAddBreaking = [breaking, nonBreaking, nonBreaking];
const addNonBreaking = [nonBreaking, breaking, breaking];
const allUnclassified = [unclassified, unclassified, unclassified];
const allAnnotation = [annotation, annotation, annotation];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbnN0YW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFBO0FBRXBDLE1BQU0sQ0FBTixJQUFZLFVBSVg7QUFKRCxXQUFZLFVBQVU7SUFDcEIseUJBQVcsQ0FBQTtJQUNYLCtCQUFpQixDQUFBO0lBQ2pCLGlDQUFtQixDQUFBO0FBQ3JCLENBQUMsRUFKVyxVQUFVLEtBQVYsVUFBVSxRQUlyQjtBQUVELE1BQU0sQ0FBTixJQUFZLGNBS1g7QUFMRCxXQUFZLGNBQWM7SUFDeEIsdUNBQXFCLENBQUE7SUFDckIsOENBQTRCLENBQUE7SUFDNUIsMkNBQXlCLENBQUE7SUFDekIsK0NBQTZCLENBQUE7QUFDL0IsQ0FBQyxFQUxXLGNBQWMsS0FBZCxjQUFjLFFBS3pCO0FBRUQsTUFBTSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsR0FBRyxjQUFjLENBQUE7QUFFakYseUJBQXlCO0FBQ3pCLE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBZSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUE7QUFDakYsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFlLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQTtBQUNyRSxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQWUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFBO0FBQy9FLE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBZSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUE7QUFDM0UsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFlLENBQUMsWUFBWSxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsQ0FBQTtBQUNyRixNQUFNLENBQUMsTUFBTSxhQUFhLEdBQWUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFBIn0=
// CONCATENATED MODULE: ./src/utils.ts

const breakingIf = (v) => (v ? breaking : nonBreaking);
const breakingIfAfterTrue = (_, a) => breakingIf(a);
const typeOf = (value) => {
    if (Array.isArray(value)) {
        return "array";
    }
    return typeof value == null ? "null" : typeof value;
};
const parsePath = (path) => {
    const [_, ...pathArr] = path.split("/").map((i) => i.replace(new RegExp("~1", "g"), "/"));
    return pathArr;
};
const buildPath = (path) => {
    return "/" + path.map((i) => String(i).replace(new RegExp("/", "g"), "~1")).join("/");
};
const findExternalRefs = (source) => {
    if (typeof source !== "object") {
        return [];
    }
    let refs = new Set();
    if (typeOf(source) === "array") {
        for (const item of source) {
            if (typeof item === "object") {
                refs = new Set([...refs, ...findExternalRefs(item)]);
            }
        }
    }
    else {
        for (const key of Object.keys(source)) {
            if (key === "$ref") {
                const [external] = source[key].split("#");
                external && refs.add(external);
            }
            else {
                if (typeof source[key] === "object") {
                    refs = new Set([...refs, ...findExternalRefs(source[key])]);
                }
            }
        }
    }
    return [...refs];
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFHbkQsTUFBTSxDQUFDLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBVSxFQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQTtBQUNoRixNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLENBQU0sRUFBRSxDQUFNLEVBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUU5RSxNQUFNLENBQUMsTUFBTSxNQUFNLEdBQUcsQ0FBQyxLQUFVLEVBQUUsRUFBRTtJQUNuQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDeEIsT0FBTyxPQUFPLENBQUE7S0FDZjtJQUNELE9BQU8sT0FBTyxLQUFLLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFBO0FBQ3JELENBQUMsQ0FBQTtBQUVELE1BQU0sQ0FBQyxNQUFNLFNBQVMsR0FBRyxDQUFDLElBQVksRUFBWSxFQUFFO0lBQ2xELE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQTtJQUN6RixPQUFPLE9BQU8sQ0FBQTtBQUNoQixDQUFDLENBQUE7QUFFRCxNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxJQUFjLEVBQVUsRUFBRTtJQUNsRCxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUN2RixDQUFDLENBQUE7QUFFRCxNQUFNLENBQUMsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLE1BQW1CLEVBQVksRUFBRTtJQUNoRSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtRQUM5QixPQUFPLEVBQUUsQ0FBQTtLQUNWO0lBQ0QsSUFBSSxJQUFJLEdBQWdCLElBQUksR0FBRyxFQUFFLENBQUE7SUFDakMsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssT0FBTyxFQUFFO1FBQzlCLEtBQUssTUFBTSxJQUFJLElBQUksTUFBTSxFQUFFO1lBQ3pCLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUM1QixJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTthQUNyRDtTQUNGO0tBQ0Y7U0FBTTtRQUNMLEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNyQyxJQUFJLEdBQUcsS0FBSyxNQUFNLEVBQUU7Z0JBQ2xCLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBO2dCQUN6QyxRQUFRLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQTthQUMvQjtpQkFBTTtnQkFDTCxJQUFJLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLFFBQVEsRUFBRTtvQkFDbkMsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7aUJBQzVEO2FBQ0Y7U0FDRjtLQUNGO0lBQ0QsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUE7QUFDbEIsQ0FBQyxDQUFBIn0=
// CONCATENATED MODULE: ./src/rules/jsonschema.ts


const maxClassifier = [
    breaking,
    nonBreaking,
    (b, a) => breakingIf(b > a)
];
const minClassifier = [
    breaking,
    nonBreaking,
    (b, a) => breakingIf(b < a)
];
const exclusiveClassifier = [
    breakingIfAfterTrue,
    nonBreaking,
    breakingIfAfterTrue
];
const booleanClassifier = [
    breakingIfAfterTrue,
    nonBreaking,
    breakingIfAfterTrue
];
const multipleOfClassifier = [
    breaking,
    nonBreaking,
    (b, a) => breakingIf(!!(b % a))
];
const jsonSchemaRules = (rootRule = allUnclassified) => ({
    "/": rootRule,
    "/title": allAnnotation,
    "/multipleOf": multipleOfClassifier,
    "/maximum": maxClassifier,
    "/exclusiveMaximum": exclusiveClassifier,
    "/minimum": minClassifier,
    "/exclusiveMinimum": exclusiveClassifier,
    "/maxLength": maxClassifier,
    "/minLength": minClassifier,
    "/pattern": [breaking, nonBreaking, breaking],
    "/maxItems": maxClassifier,
    "/minItems": minClassifier,
    "/uniqueItems": booleanClassifier,
    "/maxProperties": maxClassifier,
    "/minProperties": minClassifier,
    "/required": {
        "/": onlyAddBreaking,
        "/*": [breaking, nonBreaking, breaking],
    },
    "/enum": {
        "/": [breaking, nonBreaking, breaking],
        "/*": [nonBreaking, breaking, breaking],
    },
    "/type": [breaking, nonBreaking, breaking],
    "/not": {
        "/": [breaking, nonBreaking, breaking],
        "/*": () => jsonSchemaRules(allBreaking),
    },
    "/allOf": {
        "/": [breaking, nonBreaking, breaking],
        "/*": () => jsonSchemaRules(allBreaking),
    },
    "/oneOf": {
        "/": [breaking, nonBreaking, breaking],
        "/*": () => jsonSchemaRules(addNonBreaking),
    },
    "/anyOf": {
        "/": [breaking, nonBreaking, breaking],
        "/*": () => jsonSchemaRules(addNonBreaking),
    },
    "/items": () => jsonSchemaRules(addNonBreaking),
    "/properties": {
        "/": [breaking, nonBreaking, breaking],
        "/*": () => jsonSchemaRules(addNonBreaking),
    },
    "/additionalProperties": () => jsonSchemaRules([breaking, breaking, breakingIfAfterTrue]),
    "/description": allAnnotation,
    "/format": [breaking, nonBreaking, breaking],
    "/default": [nonBreaking, breaking, breaking],
    "/nullable": booleanClassifier,
    "/discriminator": {
        // TODO
        "/": allUnclassified,
        "/propertyName": allUnclassified,
        "/mapping": allUnclassified,
    },
    "/readOnly": booleanClassifier,
    "/writeOnly": booleanClassifier,
    "/example": allAnnotation,
    "/externalDocs": allAnnotation,
    "/deprecated": booleanClassifier,
    "/xml": {
        // TODO
        "/": allUnclassified,
        "/name": allUnclassified,
        "/namespace": allUnclassified,
        "/prefix": allUnclassified,
        "/attribute": allUnclassified,
        "/wrapped": allUnclassified,
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbnNjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9qc29uc2NoZW1hLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxVQUFVLENBQUE7QUFFMUQsT0FBTyxFQUNMLFFBQVEsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUNyQyxhQUFhLEVBQUUsV0FBVyxFQUFFLGVBQWUsRUFDM0MsZUFBZSxHQUNoQixNQUFNLGNBQWMsQ0FBQTtBQUVyQixNQUFNLGFBQWEsR0FBZTtJQUNoQyxRQUFRO0lBQ1IsV0FBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDNUIsQ0FBQTtBQUVELE1BQU0sYUFBYSxHQUFlO0lBQ2hDLFFBQVE7SUFDUixXQUFXO0lBQ1gsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1QixDQUFBO0FBRUQsTUFBTSxtQkFBbUIsR0FBZTtJQUN0QyxtQkFBbUI7SUFDbkIsV0FBVztJQUNYLG1CQUFtQjtDQUNwQixDQUFBO0FBRUQsTUFBTSxpQkFBaUIsR0FBZTtJQUNwQyxtQkFBbUI7SUFDbkIsV0FBVztJQUNYLG1CQUFtQjtDQUNwQixDQUFBO0FBRUQsTUFBTSxvQkFBb0IsR0FBZTtJQUN2QyxRQUFRO0lBQ1IsV0FBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNoQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFHLENBQUMsV0FBdUIsZUFBZSxFQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLEdBQUcsRUFBRSxRQUFRO0lBQ2IsUUFBUSxF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
// CONCATENATED MODULE: ./src/rules/asyncapi2.ts


const correlationIdRules = {
    "/": addNonBreaking,
    "/location": addNonBreaking,
    "/description": allAnnotation,
};
const commonRules = {
    "/summary": allAnnotation,
    "/tags": allAnnotation,
    "/externalDocs": allAnnotation,
    "/bindings": allUnclassified,
};
const pubsubTraitsRules = Object.assign({ "/": addNonBreaking, "/*": addNonBreaking, "/operationId": addNonBreaking, "/description": allAnnotation }, commonRules);
const messageTraitsRules = Object.assign({ "/": addNonBreaking, "/*": addNonBreaking, "/headers": allUnclassified, "/correlationId": correlationIdRules, "/schemaFormat": allBreaking, "/contentType": addNonBreaking, "/name": allNonBreaking, "/title": allNonBreaking, "/examples": allAnnotation }, commonRules);
const messageRules = Object.assign({ "/": allBreaking, "/headers": allUnclassified, "/correlationId": correlationIdRules, "/schemaFormat": allBreaking, "/contentType": addNonBreaking, "/name": allNonBreaking, "/title": allNonBreaking, "/description": allNonBreaking, "/examples": allAnnotation, "/traits": messageTraitsRules, "/payload": jsonSchemaRules(allBreaking) }, commonRules);
const pubsubRules = Object.assign({ "/": addNonBreaking, "/operationId": addNonBreaking, "/description": allAnnotation, "/traits": pubsubTraitsRules, "/message": messageRules }, commonRules);
const infoRules = {
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
};
const serversRules = {
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
};
const channelRules = {
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
};
const asyncApi2Rules = {
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
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNhcGkyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3J1bGVzL2FzeW5jYXBpMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sY0FBYyxDQUFBO0FBRTlDLE9BQU8sRUFDTCxjQUFjLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFDM0MsZUFBZSxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQ2hELE1BQU0sY0FBYyxDQUFBO0FBRXJCLE1BQU0sa0JBQWtCLEdBQVU7SUFDaEMsR0FBRyxFQUFFLGNBQWM7SUFDbkIsV0FBVyxFQUFFLGNBQWM7SUFDM0IsY0FBYyxFQUFFLGFBQWE7Q0FDOUIsQ0FBQTtBQUVELE1BQU0sV0FBVyxHQUFVO0lBQ3pCLFVBQVUsRUFBRSxhQUFhO0lBQ3pCLE9BQU8sRUFBRSxhQUFhO0lBQ3RCLGVBQWUsRUFBRSxhQUFhO0lBQzlCLFdBQVcsRUFBRSxlQUFlO0NBQzdCLENBQUE7QUFFRCxNQUFNLGlCQUFpQixtQkFDckIsR0FBRyxFQUFFLGNBQWMsRUFDbkIsSUFBSSxFQUFFLGNBQWMsRUFDcEIsY0FBYyxFQUFFLGNBQWMsRUFDOUIsY0FBYyxFQUFFLGFBQWEsSUFDMUIsV0FBVyxDQUNmLENBQUE7QUFFRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsbUJBQzdCLEdBQUcsRUFBRSxjQUFjLEVBQ25CLElBQUksRUFBRSxjQUFjLEVBQ3BCLFVBQVUsRUFBRSxlQUFlLEVBQzNCLGdCQUFnQixFQUFFLGtCQUFrQixFQUNwQyxlQUFlLEVBQUUsV0FBVyxFQUM1QixjQUFjLEVBQUUsY0FBYyxFQUM5QixPQUFPLEVBQUUsY0FBYyxFQUN2QixRQUFRLEVBQUUsY0FBYyxFQUN4QixXQUFXLEVBQUUsYUFBYSxJQUN2QixXQUFXLENBQ2YsQ0FBQTtBQUVELE1BQU0sQ0FBQyxNQUFNLFlBQVksbUJBQ3ZCLEdBQUcsRUFBRSxXQUFXLEVBQ2hCLFVBQVUsRUFBRSxlQUFlLEVBQzNC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
// CONCATENATED MODULE: ./src/rules/openapi3.ts



const openapi3_serversRules = {
    "/": [nonBreaking, breaking, breaking],
    "/*": {
        "/": [nonBreaking, breaking, breaking],
        "/url": [nonBreaking, breaking, breaking],
        "/description": allAnnotation,
        "/variables": {
            "/": [nonBreaking, breaking, breaking],
            "/*": {
                "/": [nonBreaking, breaking, breaking],
                "/enum": {
                    "/": [nonBreaking, breaking, breaking],
                    "/*": [nonBreaking, breaking, breaking],
                },
                "/default": [breaking, breaking, breaking],
                "/description": allAnnotation,
            },
        },
    },
};
const parametersRules = {
    "/": [nonBreaking, breaking, breaking],
    "/*": {
        "/": [nonBreaking, breaking, breaking],
        "/name": [nonBreaking, breaking, breaking],
        "/in": [nonBreaking, breaking, breaking],
        "/description": allAnnotation,
        "/required": [breaking, nonBreaking, breakingIfAfterTrue],
        "/deprecated": [breaking, nonBreaking, breakingIfAfterTrue],
    },
};
const headersRules = {
    "/": [nonBreaking, breaking, breaking],
    "/*": {
        "/": [nonBreaking, breaking, breaking],
        "/description": allAnnotation,
        "/required": [breaking, nonBreaking, breakingIfAfterTrue],
        "/deprecated": [breaking, nonBreaking, breakingIfAfterTrue],
    },
};
const encodingRules = {
    "/": [nonBreaking, nonBreaking, nonBreaking],
    "/*": {
        "/contentType": [nonBreaking, breaking, breaking],
        "/headers": headersRules,
        "/style": [nonBreaking, breaking, breaking],
        "/explode": [nonBreaking, breaking, breaking],
        "/allowReserved": [nonBreaking, breaking, breaking],
    },
};
const contentRules = {
    "/": [nonBreaking, breaking, breaking],
    "/*": {
        "/": [nonBreaking, breaking, breaking],
        "/schema": jsonSchemaRules(allBreaking),
        "/example": allAnnotation,
        "/examples": allAnnotation,
        "/encoding": encodingRules,
    },
};
const requestBodiesRules = {
    "/": [nonBreaking, breaking, breaking],
    "/*": {
        "/": [nonBreaking, breaking, breaking],
        "/description": allAnnotation,
        "/content": contentRules,
        "/required": [breaking, nonBreaking, (_, a) => (a ? breaking : nonBreaking)],
    },
};
const responsesRules = {
    "/": [nonBreaking, breaking, breaking],
    "/*": {
        "/": [nonBreaking, breaking, breaking],
        "/description": allAnnotation,
        "/headers": headersRules,
        "/content": contentRules,
    },
};
const securityRules = {
    "/": [breaking, nonBreaking, unclassified],
    "/*": [breaking, nonBreaking, unclassified],
};
const operationRules = {
    "/": [nonBreaking, breaking, breaking],
    "/tags": allAnnotation,
    "/summary": allAnnotation,
    "/description": allAnnotation,
    "/externalDocs": allAnnotation,
    "/operationId": [nonBreaking, breaking, breaking],
    "/parameters": parametersRules,
    "/requestBody": requestBodiesRules,
    "/responses": responsesRules,
    "/deprecated": [breaking, nonBreaking, breakingIfAfterTrue],
    "/security": securityRules,
    "/servers": openapi3_serversRules,
};
const openapi3Rules = {
    "/openapi": [nonBreaking, breaking, breaking],
    "/info": {
        "/": [nonBreaking, breaking, breaking],
        "/title": allAnnotation,
        "/description": allAnnotation,
        "/termsOfService": allAnnotation,
        "/contact": allAnnotation,
        "/licence": {
            "/": [nonBreaking, breaking, breaking],
            "/name": [breaking, breaking, breaking],
            "/url": [breaking, nonBreaking, nonBreaking],
        },
        "/version": allAnnotation,
    },
    "/servers": openapi3_serversRules,
    "/paths": {
        "/": [nonBreaking, breaking, breaking],
        "/*": {
            "/": [nonBreaking, breaking, breaking],
            "/summary": allAnnotation,
            "/description": allAnnotation,
            "/*": operationRules,
            "/servers": openapi3_serversRules,
            "/parameters": parametersRules,
        },
    },
    "/components": {
        "/": [nonBreaking, nonBreaking, nonBreaking],
        "/schemas": {
            "/": [nonBreaking, breaking, breaking],
            "/*": jsonSchemaRules(addNonBreaking),
        },
        "/responses": {
            "/": [nonBreaking, breaking, breaking],
            "/*": responsesRules,
        },
        "/parameters": {
            "/": [nonBreaking, breaking, breaking],
            "/*": parametersRules,
        },
        "/examples": allAnnotation,
        "/requestBodies": {
            "/": [nonBreaking, breaking, breaking],
            "/*": requestBodiesRules,
        },
        "/headers": headersRules,
        "/securitySchemes": {
            "/": [breaking, nonBreaking, breaking],
            "/*": {
                "/": [breaking, nonBreaking, breaking],
                "/type": [breaking, nonBreaking, breaking],
                "/description": allAnnotation,
                "/name": [breaking, nonBreaking, breaking],
                "/in": [breaking, nonBreaking, breaking],
                "/scheme": [breaking, nonBreaking, breaking],
                "/bearerFormat": allAnnotation,
                "/flows": [breaking, nonBreaking, breaking],
                "/openIdConnectUrl": allAnnotation,
            },
        },
    },
    "/security": securityRules,
    "/tags": allAnnotation,
    "/externalDocs": allAnnotation,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbmFwaTMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcnVsZXMvb3BlbmFwaTMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sVUFBVSxDQUFBO0FBQzlDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxjQUFjLENBQUE7QUFFOUMsT0FBTyxFQUNMLFFBQVEsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUNuQyxhQUFhLEVBQUUsY0FBYyxFQUM3QixXQUFXLEdBQ1osTUFBTSxjQUFjLENBQUE7QUFFckIsTUFBTSxZQUFZLEdBQVU7SUFDMUIsR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7SUFDdEMsSUFBSSxFQUFFO1FBQ0osR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDdEMsTUFBTSxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDekMsY0FBYyxFQUFFLGFBQWE7UUFDN0IsWUFBWSxFQUFFO1lBQ1osR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7WUFDdEMsSUFBSSxFQUFFO2dCQUNKLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO2dCQUN0QyxPQUFPLEVBQUU7b0JBQ1AsR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7b0JBQ3RDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO2lCQUN4QztnQkFDRCxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztnQkFDMUMsY0FBYyxFQUFFLGFBQWE7YUFDOUI7U0FDRjtLQUNGO0NBQ0YsQ0FBQTtBQUVELE1BQU0sZUFBZSxHQUFVO0lBQzdCLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO0lBQ3RDLElBQUksRUFBRTtRQUNKLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQ3RDLE9BQU8sRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQzFDLEtBQUssRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQ3hDLGNBQWMsRUFBRSxhQUFhO1FBQzdCLFdBQVcsRUFBRSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsbUJBQW1CLENBQUM7UUFDekQsYUFBYSxFQUFFLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQztLQUM1RDtDQUNGLENBQUE7QUFFRCxNQUFNLFlBQVksR0FBVTtJQUMxQixHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztJQUN0QyxJQUFJLEVBQUU7UUFDSixHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztRQUN0QyxjQUFjLEVBQUUsYUFBYTtRQUM3QixXQUFXLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixDQUFDO1FBQ3pELGFBQWEsRUFBRSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsbUJBQW1CLENBQUM7S0FDNUQ7Q0FDRixDQUFBO0FBRUQsTUFBTSxhQUFhLEdBQVU7SUFDM0IsR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLENBQUM7SUFDNUMsSUFBSSxFQUFFO1FBQ0osY0FBYyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDakQsVUFBVSxFQUFFLFlBQVk7UUFDeEIsUUFBUSxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDM0MsVUFBVSxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDN0MsZ0JBQWdCLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztLQUNwRDtDQUNGLENBQUE7QUFFRCxNQUFNLFlBQVksR0FBVTtJQUMxQixHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztJQUN0QyxJQUFJLEVBQUU7UUFDSixHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztRQUN0QyxTQUFTLEVBQUUsZUFBZSxDQUFDLFdBQVcsQ0FBQztRQUN2QyxVQUFVLEVBQUUsYUFBYTtRQUN6QixXQUFXLEVBQUUsYUFBYTtRQUMxQixXQUFXLEVBQUUsYUFBYTtLQUMzQjtDQUNGLENBQUE7QUFFRCxNQUFNLGtCQUFrQixHQUFVO0lBQ2hDLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO0lBQ3RDLElBQUksRUFBRTtRQUNKLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQ3RDLGNBQWMsRUFBRSxhQUFhO1FBQzdCLFVBQVUsRUFBRSxZQUFZO1FBQ3hCLFdBQVcsRUFBRSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztLQUM3RTtDQUNGLENBQUE7QUFFRCxNQUFNLGNBQWMsR0FBVTtJQUM1QixHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztJQUN0QyxJQUFJLEVBQUU7UUFDSixHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztRQUN0QyxjQUFjLEVBQUUsYUFBYTtRQUM3QixVQUFVLEVBQUUsWUFBWTtRQUN4QixVQUFVLEVBQUUsWUFBWTtLQUN6QjtDQUNGLENBQUE7QUFFRCxNQUFNLGFBQWEsR0FBVTtJQUMzQixHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFlBQVksQ0FBQztJQUMxQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFlBQVksQ0FBQztDQUM1QyxDQUFBO0FBRUQsTUFBTSxjQUFjLEdBQVU7SUFDNUIsR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7SUFDdEMsT0FBTyxFQUFFLGFBQWE7SUFDdEIsVUFBVSxFQUFFLGFBQWE7SUFDekIsY0FBYyxFQUFFLGFBQWE7SUFDN0IsZUFBZSxFQUFFLGFBQWE7SUFDOUIsY0FBYyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7SUFDakQsYUFBYSxFQUFFLGVBQWU7SUFDOUIsY0FBYyxFQUFFLGtCQUFrQjtJQUNsQyxZQUFZLEVBQUUsY0FBYztJQUM1QixhQUFhLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixDQUFDO0lBQzNELFdBQVcsRUFBRSxhQUFhO0lBQzFCLFVBQVUsRUFBRSxZQUFZO0NBQ3pCLENBQUE7QUFFRCxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQVU7SUFDbEMsVUFBVSxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7SUFDN0MsT0FBTyxFQUFFO1FBQ1AsR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDdEMsUUFBUSxFQUFFLGFBQWE7UUFDdkIsY0FBYyxFQUFFLGFBQWE7UUFDN0IsaUJBQWlCLEVBQUUsYUFBYTtRQUNoQyxVQUFVLEVBQUUsYUFBYTtRQUN6QixVQUFVLEVBQUU7WUFDVixHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztZQUN0QyxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztZQUN2QyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQztTQUM3QztRQUNELFVBQVUsRUFBRSxhQUFhO0tBQzFCO0lBQ0QsVUFBVSxFQUFFLFlBQVk7SUFDeEIsUUFBUSxFQUFFO1FBQ1IsR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDdEMsSUFBSSxFQUFFO1lBQ0osR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7WUFDdEMsVUFBVSxFQUFFLGFBQWE7WUFDekIsY0FBYyxFQUFFLGFBQWE7WUFDN0IsSUFBSSxFQUFFLGNBQWM7WUFDcEIsVUFBVSxFQUFFLFlBQVk7WUFDeEIsYUFBYSxFQUFFLGVBQWU7U0FDL0I7S0FDRjtJQUNELGFBQWEsRUFBRTtRQUNiLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDO1FBQzVDLFVBQVUsRUFBRTtZQUNWLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1lBQ3RDLElBQUksRUFBRSxlQUFlLENBQUMsY0FBYyxDQUFDO1NBQ3RDO1FBQ0QsWUFBWSxFQUFFO1lBQ1osR0FBRyxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7WUFDdEMsSUFBSSxFQUFFLGNBQWM7U0FDckI7UUFDRCxhQUFhLEVBQUU7WUFDYixHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztZQUN0QyxJQUFJLEVBQUUsZUFBZTtTQUN0QjtRQUNELFdBQVcsRUFBRSxhQUFhO1FBQzFCLGdCQUFnQixFQUFFO1lBQ2hCLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1lBQ3RDLElBQUksRUFBRSxrQkFBa0I7U0FDekI7UUFDRCxVQUFVLEVBQUUsWUFBWTtRQUN4QixrQkFBa0IsRUFBRTtZQUNsQixHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFFBQVEsQ0FBQztZQUN0QyxJQUFJLEVBQUU7Z0JBQ0osR0FBRyxFQUFFLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUM7Z0JBQ3RDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDO2dCQUMxQyxjQUFjLEVBQUUsYUFBYTtnQkFDN0IsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUM7Z0JBQzFDLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDO2dCQUN4QyxTQUFTLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFFBQVEsQ0FBQztnQkFDNUMsZUFBZSxFQUFFLGFBQWE7Z0JBQzlCLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDO2dCQUMzQyxtQkFBbUIsRUFBRSxhQUFhO2FBQ25DO1NBQ0Y7S0FDRjtJQUNELFdBQVcsRUFBRSxhQUFhO0lBQzFCLE9BQU8sRUFBRSxhQUFhO0lBQ3RCLGVBQWUsRUFBRSxhQUFhO0NBQy9CLENBQUEifQ==
// CONCATENATED MODULE: ./src/rules/index.ts



//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcnVsZXMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxhQUFhLENBQUE7QUFDM0IsY0FBYyxZQUFZLENBQUE7QUFDMUIsY0FBYyxjQUFjLENBQUEifQ==
// CONCATENATED MODULE: ./src/types.ts

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiJ9
// CONCATENATED MODULE: ./src/dereference.ts
var __rest = (undefined && undefined.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};

const resolveObjValue = (obj, path, cache = {}) => {
    let value = obj;
    cache = new Map(Object.entries(cache));
    for (const key of parsePath(path)) {
        value = typeOf(value) === "array" ? value[+key] : value[key];
        if (value === undefined) {
            break;
        }
        value = dereference(value, obj, new Set(), cache);
    }
    return value;
};
const dereference = (value, source, refs, cache) => {
    if (value.hasOwnProperty("$ref")) {
        const { $ref } = value, rest = __rest(value, ["$ref"]);
        if (refs.has($ref)) {
            // TODO: return { ...refObject, ...rest } if circularRefs === true
            return value;
        }
        const [external, path] = $ref.split("#");
        // resolve external obj 
        if (external) {
            if (!cache.has(external)) {
                return value;
            }
            source = cache.get(external);
        }
        value = Object.assign(Object.assign({}, rest), resolveObjValue(source, path, cache));
        refs.add($ref);
        cache.set($ref, value);
    }
    return value;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVyZWZlcmVuY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGVyZWZlcmVuY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUUzQyxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsQ0FBQyxHQUFRLEVBQUUsSUFBWSxFQUFFLFFBQWEsRUFBRSxFQUFFLEVBQUU7SUFDekUsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFBO0lBQ2YsS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtJQUN0QyxLQUFLLE1BQU0sR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNqQyxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUM1RCxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7WUFDdkIsTUFBSztTQUNOO1FBQ0QsS0FBSyxHQUFHLFdBQVcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUE7S0FDbEQ7SUFDRCxPQUFPLEtBQUssQ0FBQTtBQUNkLENBQUMsQ0FBQTtBQUVELE1BQU0sQ0FBQyxNQUFNLFdBQVcsR0FBRyxDQUFDLEtBQVUsRUFBRSxNQUFXLEVBQUUsSUFBaUIsRUFBRSxLQUF1QixFQUFPLEVBQUU7SUFDdEcsSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ2hDLE1BQU0sRUFBRSxJQUFJLEtBQWMsS0FBSyxFQUFkLElBQUksVUFBSyxLQUFLLEVBQXpCLFFBQWlCLENBQVEsQ0FBQTtRQUMvQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDbEIsa0VBQWtFO1lBQ2xFLE9BQU8sS0FBSyxDQUFBO1NBQ2I7UUFDRCxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUE7UUFFeEMsd0JBQXdCO1FBQ3hCLElBQUksUUFBUSxFQUFFO1lBQ1osSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQ3hCLE9BQU8sS0FBSyxDQUFBO2FBQ2I7WUFDRCxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQTtTQUM3QjtRQUVELEtBQUssbUNBQVEsSUFBSSxHQUFLLGVBQWUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFFLENBQUE7UUFDNUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNkLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFBO0tBQ3ZCO0lBQ0QsT0FBTyxLQUFLLENBQUE7QUFDZCxDQUFDLENBQUEifQ==
// CONCATENATED MODULE: ./src/classifier.ts

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
            return allUnclassified;
        }
    }
    return allUnclassified;
};
const classifyDiff = (diff, rules = {}) => {
    const _diff = diff;
    const classifier = findClassifier(rules, diff.path);
    const index = ["add", "remove", "replace"].indexOf(diff.action);
    const changeType = classifier[index];
    _diff.type = typeof changeType === "function"
        ? changeType(diff.before, diff.after)
        : changeType;
    return _diff;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NpZmllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGFzc2lmaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFFN0MsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLENBQUMsS0FBWSxFQUFFLElBQWMsRUFBYyxFQUFFO0lBQ3pFLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQTtJQUNsQixLQUFLLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUU7UUFDN0IscURBQXFEO1FBQ3JELElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUU7WUFDaEUsR0FBRyxHQUFHLEdBQUcsQ0FBQTtTQUNWO1FBRUQsMEJBQTBCO1FBQzFCLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLEVBQUU7WUFDcEMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQTtZQUM5QixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3ZCLE9BQU8sSUFBSSxDQUFBO2FBQ1o7WUFDRCxNQUFNLEdBQUcsT0FBTyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBO1NBQ3BEO2FBQU07WUFDTCxPQUFPLGVBQWUsQ0FBQTtTQUN2QjtLQUNGO0lBQ0QsT0FBTyxlQUFlLENBQUE7QUFDeEIsQ0FBQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBc0IsRUFBRSxRQUFlLEVBQUUsRUFBUSxFQUFFO0lBQzlFLE1BQU0sS0FBSyxHQUFHLElBQVksQ0FBQTtJQUUxQixNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUVuRCxNQUFNLEtBQUssR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtJQUMvRCxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUE7SUFFcEMsS0FBSyxDQUFDLElBQUksR0FBRyxPQUFPLFVBQVUsS0FBSyxVQUFVO1FBQzNDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxVQUFVLENBQUE7SUFFZCxPQUFPLEtBQUssQ0FBQTtBQUNkLENBQUMsQ0FBQSJ9
// CONCATENATED MODULE: ./src/context.ts


class context_DiffContext {
    constructor(before, after, options) {
        this.before = before;
        this.after = after;
        this.beforeRefs = new Set();
        this.afterRefs = new Set();
        this.beforeCache = new Map();
        this.afterCache = new Map();
        this.findFirstDiff = false;
        this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules;
        this.trimStrings = options.trimStrings;
        this.caseSensitive = options.caseSensitive;
        this.strictArrays = options.strictArrays;
        this.circularRef = options.circularRef || false;
        this.arrayMeta = options.arrayMeta || false;
        const externalRefs = options.externalRefs || {};
        for (const ref of Object.keys(externalRefs)) {
            this.beforeCache.set(ref, externalRefs[ref]);
            this.afterCache.set(ref, externalRefs[ref]);
        }
    }
    getBaseRules(name) {
        switch (name) {
            case "OpenApi3":
                return openapi3Rules;
            case "AsyncApi2":
                return asyncApi2Rules;
            case "JsonSchema":
                return jsonSchemaRules();
        }
    }
}
class context_MergeContext extends context_DiffContext {
    constructor(before, after, options) {
        super(before, after, options);
        this._formatMeta = (diff) => {
            return Object.assign({ type: diff.type, action: diff.action }, diff.action === DiffAction.replace ? { replaced: diff.before } : {});
        };
        this.formatMeta = options.formatMeta || ((d) => this._formatMeta(d));
        this.metaKey = options.metaKey || DIFF_META_KEY;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLGFBQWEsRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUN4RSxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsR0FBSSxNQUFNLGFBQWEsQ0FBQTtBQUV6RCxNQUFNLE9BQU8sV0FBVztJQWV0QixZQUFtQixNQUFXLEVBQVMsS0FBVSxFQUFFLE9BQW9CO1FBQXBELFdBQU0sR0FBTixNQUFNLENBQUs7UUFBUyxVQUFLLEdBQUwsS0FBSyxDQUFLO1FBWjFDLGVBQVUsR0FBZ0IsSUFBSSxHQUFHLEVBQUUsQ0FBQTtRQUNuQyxjQUFTLEdBQWdCLElBQUksR0FBRyxFQUFFLENBQUE7UUFDbEMsZ0JBQVcsR0FBcUIsSUFBSSxHQUFHLEVBQUUsQ0FBQTtRQUN6QyxlQUFVLEdBQXFCLElBQUksR0FBRyxFQUFFLENBQUE7UUFDeEMsa0JBQWEsR0FBRyxLQUFLLENBQUE7UUFTMUIsSUFBSSxDQUFDLEtBQUssR0FBRyxPQUFPLE9BQU8sQ0FBQyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQTtRQUNqRyxJQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUE7UUFDdEMsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFBO1FBQzFDLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQTtRQUN4QyxJQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFBO1FBQy9DLElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVMsSUFBSSxLQUFLLENBQUE7UUFFM0MsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUE7UUFDL0MsS0FBSyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQzNDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtZQUM1QyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7U0FDNUM7SUFDSCxDQUFDO0lBRU8sWUFBWSxDQUFFLElBQW1CO1FBQ3ZDLFFBQVEsSUFBSSxFQUFFO1lBQ1osS0FBSyxVQUFVO2dCQUNiLE9BQU8sYUFBYSxDQUFBO1lBQ3RCLEtBQUssV0FBVztnQkFDZCxPQUFPLGNBQWMsQ0FBQTtZQUN2QixLQUFLLFlBQVk7Z0JBQ2YsT0FBTyxlQUFlLEVBQUUsQ0FBQTtTQUMzQjtJQUNILENBQUM7Q0FFRjtBQUVELE1BQU0sT0FBTyxZQUFhLFNBQVEsV0FBVztJQUkzQyxZQUFZLE1BQVcsRUFBRSxLQUFVLEVBQUUsT0FBcUI7UUFDeEQsS0FBSyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUE7UUFLdkIsZ0JBQVcsR0FBRyxDQUFDLElBQVUsRUFBaUIsRUFBRTtZQUNsRCx1QkFDRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFDZixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sSUFDaEIsSUFBSSxDQUFDLE1BQU0sS0FBSyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFDdkU7UUFDSCxDQUFDLENBQUE7UUFWQyxJQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLENBQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQzFFLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sSUFBSSxhQUFhLENBQUE7SUFDakQsQ0FBQztDQVNGIn0=
// CONCATENATED MODULE: ./src/diff.ts





const apiDiff = (before, after, options) => {
    return findDiff(before, after, new context_DiffContext(before, after, options));
};
const findDiff = (before, after, ctx, path = []) => {
    if (typeOf(before) !== typeOf(after)) {
        const diff = { path: path, before, after, action: DiffAction.replace };
        return [classifyDiff(diff, ctx.rules)];
    }
    switch (typeOf(before)) {
        case "object":
            return objectsDiff(before, after, ctx, path);
        case "array":
            return arrayDiff(before, after, ctx, path);
        default:
            if (typeOf(before) === "string") {
                before = normalizeString(before, ctx);
                after = normalizeString(after, ctx);
            }
            const diff = { path, before, after, action: DiffAction.replace };
            return before !== after ? [classifyDiff(diff, ctx.rules)] : [];
    }
};
const normalizeString = (value, ctx) => {
    value = ctx.trimStrings ? value.trim() : value;
    value = ctx.caseSensitive ? value : value.toLowerCase();
    return value;
};
const objectsDiff = (before, after, ctx, path) => {
    const diffs = [];
    const ref = "#" + buildPath(path);
    ctx.beforeRefs.add(ref);
    ctx.afterRefs.add(ref);
    const _before = dereference(before, ctx.before, ctx.beforeRefs, ctx.beforeCache);
    const _after = dereference(after, ctx.after, ctx.afterRefs, ctx.afterCache);
    const keys = new Set([...Object.keys(_before), ...Object.keys(_after)]);
    for (const key of keys) {
        // skip symbol key
        if (typeof key === "symbol") {
            continue;
        }
        if (!_before.hasOwnProperty(key)) {
            // added key
            const diff = { path: [...path, key], after: _after[key], action: DiffAction.add };
            diffs.push(classifyDiff(diff, ctx.rules));
        }
        else if (!_after.hasOwnProperty(key)) {
            // deleted key
            const diff = { path: [...path, key], before: _before[key], action: DiffAction.remove };
            diffs.push(classifyDiff(diff, ctx.rules));
        }
        else {
            // updated value
            diffs.push(...findDiff(_before[key], _after[key], ctx, [...path, key]));
        }
        if (ctx.findFirstDiff && diffs.length) {
            break;
        }
    }
    // remove refs
    before.$ref && ctx.beforeRefs.delete(before.$ref);
    after.$ref && ctx.afterRefs.delete(after.$ref);
    ctx.beforeRefs.delete(ref);
    ctx.afterRefs.delete(ref);
    return diffs;
};
const findEqualItemIndex = (item, array, ctx) => {
    for (let j = 0; j < array.length; j++) {
        ctx.findFirstDiff = true;
        const diff = findDiff(item, array[j], ctx);
        ctx.findFirstDiff = false;
        if (!diff.length) {
            return j;
        }
    }
    return -1;
};
const arrayDiff = (before, after, ctx, path) => {
    const diffs = [];
    const _after = [...after];
    for (let i = 0; i < before.length; i++) {
        if (ctx.strictArrays) {
            if (i >= after.length) {
                const diff = { path: [...path, i], before: before[i], action: DiffAction.remove };
                diffs.push(classifyDiff(diff, ctx.rules));
            }
            else {
                diffs.push(...findDiff(before[i], after[i], ctx, [...path, i]));
            }
        }
        else {
            const index = findEqualItemIndex(before[i], _after, ctx);
            if (index >= 0) {
                _after.splice(index, 1);
            }
            else {
                const diff = { path: [...path, i], before: before[i], action: DiffAction.remove };
                diffs.push(classifyDiff(diff, ctx.rules));
            }
        }
        if (ctx.findFirstDiff && diffs.length) {
            break;
        }
    }
    if (ctx.strictArrays) {
        _after.splice(0, before.length);
    }
    for (let i = 0; i < _after.length; i++) {
        const diff = { path: [...path, before.length + i], after: _after[i], action: DiffAction.add };
        diffs.push(classifyDiff(diff, ctx.rules));
    }
    return diffs;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9kaWZmLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxlQUFlLENBQUE7QUFDM0MsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGNBQWMsQ0FBQTtBQUMzQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUMzQyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sV0FBVyxDQUFBO0FBQ3ZDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFFeEMsTUFBTSxDQUFDLE1BQU0sT0FBTyxHQUFHLENBQUMsTUFBVyxFQUFFLEtBQVUsRUFBRSxPQUFvQixFQUFVLEVBQUU7SUFDL0UsT0FBTyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUE7QUFDekUsQ0FBQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sUUFBUSxHQUFHLENBQUMsTUFBVyxFQUFFLEtBQVUsRUFBRSxHQUFnQixFQUFFLE9BQWlCLEVBQUUsRUFBVSxFQUFFO0lBQ2pHLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNwQyxNQUFNLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFBO1FBQ3RFLE9BQU8sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0tBQ3ZDO0lBRUQsUUFBUSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDdEIsS0FBSyxRQUFRO1lBQ1gsT0FBTyxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUE7UUFDOUMsS0FBSyxPQUFPO1lBQ1YsT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUE7UUFDNUM7WUFDRSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxRQUFRLEVBQUU7Z0JBQy9CLE1BQU0sR0FBRyxlQUFlLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFBO2dCQUNyQyxLQUFLLEdBQUcsZUFBZSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQTthQUNwQztZQUVELE1BQU0sSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQTtZQUNoRSxPQUFPLE1BQU0sS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBO0tBQ2pFO0FBQ0gsQ0FBQyxDQUFBO0FBRUQsTUFBTSxlQUFlLEdBQUcsQ0FBQyxLQUFhLEVBQUUsR0FBZ0IsRUFBRSxFQUFFO0lBQzFELEtBQUssR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtJQUM5QyxLQUFLLEdBQUcsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUE7SUFDdkQsT0FBTyxLQUFLLENBQUE7QUFDZCxDQUFDLENBQUE7QUFFRCxNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQVcsRUFBRSxLQUFVLEVBQUUsR0FBZ0IsRUFBRSxJQUFjLEVBQVUsRUFBRTtJQUN4RixNQUFNLEtBQUssR0FBVyxFQUFFLENBQUE7SUFDeEIsTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUVqQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUN2QixHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUV0QixNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUE7SUFDaEYsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFBO0lBRTNFLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFDdkUsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUU7UUFDdEIsa0JBQWtCO1FBQ2xCLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFO1lBQzNCLFNBQVE7U0FDVDtRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ2hDLFlBQVk7WUFDWixNQUFNLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQTtZQUNqRixLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7U0FDMUM7YUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN0QyxjQUFjO1lBQ2QsTUFBTSxJQUFJLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUE7WUFDdEYsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO1NBQzFDO2FBQU07WUFDTCxnQkFBZ0I7WUFDaEIsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtTQUN4RTtRQUVELElBQUksR0FBRyxDQUFDLGFBQWEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO1lBQ3JDLE1BQUs7U0FDTjtLQUNGO0lBRUQsY0FBYztJQUNkLE1BQU0sQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ2pELEtBQUssQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBRTlDLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQzFCLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBRXpCLE9BQU8sS0FBSyxDQUFBO0FBQ2QsQ0FBQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxJQUFTLEVBQUUsS0FBWSxFQUFFLEdBQWdCLEVBQVUsRUFBRTtJQUN0RixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNyQyxHQUFHLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQTtRQUN4QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQTtRQUMxQyxHQUFHLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQTtRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNoQixPQUFPLENBQUMsQ0FBQTtTQUNUO0tBQ0Y7SUFDRCxPQUFPLENBQUMsQ0FBQyxDQUFBO0FBQ1gsQ0FBQyxDQUFBO0FBRUQsTUFBTSxTQUFTLEdBQUcsQ0FBQyxNQUFhLEVBQUUsS0FBWSxFQUFFLEdBQWdCLEVBQUUsSUFBYyxFQUFVLEVBQUU7SUFDMUYsTUFBTSxLQUFLLEdBQVcsRUFBRSxDQUFBO0lBRXhCLE1BQU0sTUFBTSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQTtJQUN6QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN0QyxJQUFJLEdBQUcsQ0FBQyxZQUFZLEVBQUU7WUFDcEIsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtnQkFDckIsTUFBTSxJQUFJLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUE7Z0JBQ2pGLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTthQUMxQztpQkFBTTtnQkFDTCxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO2FBQ2hFO1NBQ0Y7YUFBTTtZQUNMLE1BQU0sS0FBSyxHQUFHLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUE7WUFDeEQsSUFBSSxLQUFLLElBQUksQ0FBQyxFQUFFO2dCQUNkLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFBO2FBQ3hCO2lCQUFNO2dCQUNMLE1BQU0sSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFBO2dCQUNqRixLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7YUFDMUM7U0FDRjtRQUNELElBQUksR0FBRyxDQUFDLGFBQWEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO1lBQ3JDLE1BQUs7U0FDTjtLQUNGO0lBRUQsSUFBSSxHQUFHLENBQUMsWUFBWSxFQUFFO1FBQ3BCLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQTtLQUNoQztJQUVELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ3RDLE1BQU0sSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUE7UUFDN0YsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0tBQzFDO0lBRUQsT0FBTyxLQUFLLENBQUE7QUFDZCxDQUFDLENBQUEifQ==
// CONCATENATED MODULE: ./src/merge.ts






const apiMerge = (before, after, options) => {
    const [value] = mergeChanges(before, after, new context_MergeContext(before, after, options), []);
    return value;
};
const mergeChanges = (before, after, ctx, path = []) => {
    if (typeOf(before) !== typeOf(after)) {
        const diff = { path, before, after, action: DiffAction.replace };
        return [after, ctx.formatMeta(classifyDiff(diff, ctx.rules))];
    }
    switch (typeOf(before)) {
        case "object":
            return mergeObjects(before, after, ctx, path);
        case "array":
            return mergeArrays(before, after, ctx, path);
        default:
            if (typeof before === "string") {
                before = merge_normalizeString(before, ctx);
                after = merge_normalizeString(after, ctx);
            }
            if (before !== after) {
                const diff = { path, before, after, action: DiffAction.replace };
                return [after, ctx.formatMeta(classifyDiff(diff, ctx.rules))];
            }
    }
    return [after];
};
const merge_normalizeString = (value, ctx) => {
    value = ctx.trimStrings ? value.trim() : value;
    value = ctx.caseSensitive ? value : value.toLowerCase();
    return value;
};
const mergeObjects = (before, after, ctx, path) => {
    const merged = {};
    const meta = {};
    const _before = dereference(before, ctx.before, ctx.beforeRefs, ctx.beforeCache);
    const _after = dereference(after, ctx.after, ctx.afterRefs, ctx.afterCache);
    const keys = new Set([...Object.keys(_before), ...Object.keys(_after)]);
    for (const key of keys) {
        // skip symbol key
        if (typeof key === "symbol") {
            continue;
        }
        if (!_before.hasOwnProperty(key)) {
            // added key
            const diff = { path: [...path, key], after: _after[key], action: DiffAction.add };
            merged[key] = _after[key];
            meta[key] = ctx.formatMeta(classifyDiff(diff, ctx.rules));
        }
        else if (!_after.hasOwnProperty(key)) {
            // deleted key
            const diff = { path: [...path, key], before: _before[key], action: DiffAction.remove };
            merged[key] = _before[key];
            meta[key] = ctx.formatMeta(classifyDiff(diff, ctx.rules));
        }
        else {
            // updated value
            const [value, m] = mergeChanges(_before[key], _after[key], ctx, [...path, key]);
            merged[key] = value;
            if (m) {
                meta[key] = m;
            }
        }
    }
    // remove refs
    before.$ref && ctx.beforeRefs.delete(before.$ref);
    after.$ref && ctx.afterRefs.delete(after.$ref);
    if (Object.keys(meta).length) {
        merged[ctx.metaKey] = meta;
    }
    return [merged];
};
const mergeArrays = (before, after, ctx, path) => {
    const arrMeta = {};
    const array = [];
    const _after = [...after];
    for (let i = 0; i < before.length; i++) {
        if (ctx.strictArrays) {
            if (i >= after.length) {
                const diff = { path: [...path, i], before: before[i], action: DiffAction.remove };
                array[i] = before[i];
                arrMeta[i] = ctx.formatMeta((classifyDiff(diff, ctx.rules)));
            }
            else {
                const [value, m] = mergeChanges(before[i], after[i], ctx, [...path, i]);
                array[i] = value;
                if (m) {
                    arrMeta[i] = m;
                }
            }
        }
        else {
            const index = findEqualItemIndex(before[i], _after, ctx);
            array[i] = before[i];
            if (index >= 0) {
                _after.splice(index, 1);
            }
            else {
                const diff = { path: [...path, i], before: before[i], action: DiffAction.remove };
                arrMeta[i] = ctx.formatMeta(classifyDiff(diff, ctx.rules));
            }
        }
    }
    if (ctx.strictArrays) {
        _after.splice(0, before.length);
    }
    for (let j = before.length, i = 0; j < before.length + _after.length; j++, i++) {
        array[j] = _after[i];
        const diff = { path: [...path, j], after: _after[i], action: DiffAction.add };
        arrMeta[j] = ctx.formatMeta(classifyDiff(diff, ctx.rules));
    }
    if (ctx.arrayMeta && Object.keys(arrMeta).length) {
        array[ctx.metaKey] = arrMeta;
    }
    if (ctx.arrayMeta || !Object.keys(array).length) {
        return [array];
    }
    else {
        return [array, { array: arrMeta }];
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvbWVyZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLFdBQVcsQ0FBQTtBQUNyRCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZUFBZSxDQUFBO0FBQzNDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxjQUFjLENBQUE7QUFDM0MsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sUUFBUSxDQUFBO0FBQzNDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFDeEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQU9oQyxNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxNQUFXLEVBQUUsS0FBVSxFQUFFLE9BQXFCLEVBQU8sRUFBRTtJQUM5RSxNQUFNLENBQUUsS0FBSyxDQUFFLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQTtJQUMzRixPQUFPLEtBQUssQ0FBQTtBQUNkLENBQUMsQ0FBQTtBQUVELE1BQU0sWUFBWSxHQUFHLENBQUMsTUFBVyxFQUFFLEtBQVUsRUFBRSxHQUFpQixFQUFFLE9BQWlCLEVBQUUsRUFBZSxFQUFFO0lBQ3BHLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNwQyxNQUFNLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUE7UUFDaEUsT0FBTyxDQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFD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
// CONCATENATED MODULE: ./src/index.ts






//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxlQUFlLENBQUE7QUFDN0IsY0FBYyxTQUFTLENBQUE7QUFDdkIsY0FBYyxhQUFhLENBQUE7QUFDM0IsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLFFBQVEsQ0FBQTtBQUNoQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sU0FBUyxDQUFBO0FBQ2xDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLFNBQVMsQ0FBQSJ9

/***/ })
/******/ ]);