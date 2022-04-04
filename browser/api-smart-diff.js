/*! api-smart-diff@0.2.12 */
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
__webpack_require__.d(__webpack_exports__, "RuleMetaKey", function() { return /* reexport */ RuleMetaKey; });
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
__webpack_require__.d(__webpack_exports__, "compare", function() { return /* reexport */ compare; });
__webpack_require__.d(__webpack_exports__, "apiMerge", function() { return /* reexport */ apiMerge; });
__webpack_require__.d(__webpack_exports__, "findExternalRefs", function() { return /* reexport */ findExternalRefs; });

// CONCATENATED MODULE: ./src/constants.ts
const RuleMetaKey = Symbol("rule");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnN0YW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFBO0FBQ3pDLE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUE7QUFFcEMsTUFBTSxDQUFOLElBQVksVUFJWDtBQUpELFdBQVksVUFBVTtJQUNwQix5QkFBVyxDQUFBO0lBQ1gsK0JBQWlCLENBQUE7SUFDakIsaUNBQW1CLENBQUE7QUFDckIsQ0FBQyxFQUpXLFVBQVUsS0FBVixVQUFVLFFBSXJCO0FBRUQsTUFBTSxDQUFOLElBQVksY0FLWDtBQUxELFdBQVksY0FBYztJQUN4Qix1Q0FBcUIsQ0FBQTtJQUNyQiw4Q0FBNEIsQ0FBQTtJQUM1QiwyQ0FBeUIsQ0FBQTtJQUN6QiwrQ0FBNkIsQ0FBQTtBQUMvQixDQUFDLEVBTFcsY0FBYyxLQUFkLGNBQWMsUUFLekI7QUFFRCxNQUFNLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxHQUFHLGNBQWMsQ0FBQTtBQUVqRix5QkFBeUI7QUFDekIsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFlLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQTtBQUNqRixNQUFNLENBQUMsTUFBTSxXQUFXLEdBQWUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFBO0FBQ3JFLE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBZSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUE7QUFDL0UsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFlLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQTtBQUMzRSxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQWUsQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFBO0FBQ3JGLE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBZSxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUEifQ==
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
const getPathRuleMeta = (rules, path) => {
    let _rules = rules;
    for (let key of [...path]) {
        // check if rules dont have key of key is array index
        if (!_rules.hasOwnProperty(`/${key}`) || typeof key === "number") {
            key = "*";
        }
        // check if rules have key
        if (_rules.hasOwnProperty(`/${key}`)) {
            const rule = _rules[`/${key}`];
            if (Array.isArray(rule)) {
                return undefined;
            }
            _rules = typeof rule === "function" ? rule() : rule;
        }
        else {
            return undefined;
        }
    }
    return _rules[RuleMetaKey];
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
const enumRules = (rules, matchItemsFunc) => {
    rules[RuleMetaKey] = { matchItemsFunc };
    return rules;
};
const mapRules = (rules, matchKeysFunc) => {
    rules[RuleMetaKey] = { matchKeysFunc };
    return rules;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLE1BQU0sYUFBYSxDQUFBO0FBRWhFLE1BQU0sQ0FBQyxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQVUsRUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUE7QUFDaEYsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxDQUFNLEVBQUUsQ0FBTSxFQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFOUUsTUFBTSxDQUFDLE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBVSxFQUFFLEVBQUU7SUFDbkMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3hCLE9BQU8sT0FBTyxDQUFBO0tBQ2Y7SUFDRCxPQUFPLE9BQU8sS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQTtBQUNyRCxDQUFDLENBQUE7QUFFRCxNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxJQUFZLEVBQVksRUFBRTtJQUNsRCxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFDekYsT0FBTyxPQUFPLENBQUE7QUFDaEIsQ0FBQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sU0FBUyxH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
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
    "/examples": allAnnotation,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbnNjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9ydWxlcy9qc29uc2NoZW1hLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxVQUFVLENBQUE7QUFFMUQsT0FBTyxFQUNMLFFBQVEsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUNyQyxhQUFhLEVBQUUsV0FBVyxFQUFFLGVBQWUsRUFDM0MsZUFBZSxHQUNoQixNQUFNLGNBQWMsQ0FBQTtBQUVyQixNQUFNLGFBQWEsR0FBZTtJQUNoQyxRQUFRO0lBQ1IsV0FBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDNUIsQ0FBQTtBQUVELE1BQU0sYUFBYSxHQUFlO0lBQ2hDLFFBQVE7SUFDUixXQUFXO0lBQ1gsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1QixDQUFBO0FBRUQsTUFBTSxtQkFBbUIsR0FBZTtJQUN0QyxtQkFBbUI7SUFDbkIsV0FBVztJQUNYLG1CQUFtQjtDQUNwQixDQUFBO0FBRUQsTUFBTSxpQkFBaUIsR0FBZTtJQUNwQyxtQkFBbUI7SUFDbkIsV0FBVztJQUNYLG1CQUFtQjtDQUNwQixDQUFBO0FBRUQsTUFBTSxvQkFBb0IsR0FBZTtJQUN2QyxRQUFRO0lBQ1IsV0FBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNoQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFHLENBQUMsV0FBdUIsZUFBZSxFQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLEdBQUcsRUFBRSxRQUFRO0lBQ2IsUUFB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
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNhcGkyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3J1bGVzL2FzeW5jYXBpMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sY0FBYyxDQUFBO0FBRTlDLE9BQU8sRUFDTCxjQUFjLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFDM0MsZUFBZSxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQ2hELE1BQU0sY0FBYyxDQUFBO0FBRXJCLE1BQU0sa0JBQWtCLEdBQVU7SUFDaEMsR0FBRyxFQUFFLGNBQWM7SUFDbkIsV0FBVyxFQUFFLGNBQWM7SUFDM0IsY0FBYyxFQUFFLGFBQWE7Q0FDOUIsQ0FBQTtBQUVELE1BQU0sV0FBVyxHQUFVO0lBQ3pCLFVBQVUsRUFBRSxhQUFhO0lBQ3pCLE9BQU8sRUFBRSxhQUFhO0lBQ3RCLGVBQWUsRUFBRSxhQUFhO0lBQzlCLFdBQVcsRUFBRSxlQUFlO0NBQzdCLENBQUE7QUFFRCxNQUFNLGlCQUFpQixtQkFDckIsR0FBRyxFQUFFLGNBQWMsRUFDbkIsSUFBSSxFQUFFLGNBQWMsRUFDcEIsY0FBYyxFQUFFLGNBQWMsRUFDOUIsY0FBYyxFQUFFLGFBQWEsSUFDMUIsV0FBVyxDQUNmLENBQUE7QUFFRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsbUJBQzdCLEdBQUcsRUFBRSxjQUFjLEVBQ25CLElBQUksRUFBRSxjQUFjLEVBQ3BCLFVBQVUsRUFBRSxlQUFlLEVBQzNCLGdCQUFnQixFQUFFLGtCQUFrQixFQUNwQyxlQUFlLEVBQUUsV0FBVyxFQUM1QixjQUFjLEVBQUUsY0FBYyxFQUM5QixPQUFPLEVBQUUsY0FBYyxFQUN2QixRQUFRLEVBQUUsY0FBYyxFQUN4QixXQUFXLEVBQUUsYUFBYSxJQUN2QixXQUFXLENBQ2YsQ0FBQTtBQUVELE1BQU0sQ0FBQyxNQUFNLFlBQVksbUJBQ3ZCLEdBQUcsRUFBRSxXQUFXLEVBQ2hCLFVBQVUsRUFBRSxlQUFlLEVB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
// CONCATENATED MODULE: ./src/rules/openapi3.ts



const pathArrayRules = (rules) => mapRules(rules, (b, a) => {
    const beforePath = b.replace(new RegExp("\{.*?\}", "g"), "*");
    const afterPath = a.replace(new RegExp("\{.*?\}", "g"), "*");
    return beforePath === afterPath;
});
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
    "/paths": pathArrayRules({
        "/": [nonBreaking, breaking, breaking],
        "/*": {
            "/": [nonBreaking, breaking, nonBreaking],
            "/summary": allAnnotation,
            "/description": allAnnotation,
            "/*": operationRules,
            "/servers": openapi3_serversRules,
            "/parameters": parametersRules,
        },
    }),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbmFwaTMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVsZXMvb3BlbmFwaTMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxNQUFNLFVBQVUsQ0FBQTtBQUN4RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sY0FBYyxDQUFBO0FBRTlDLE9BQU8sRUFDTCxRQUFRLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFDbkMsYUFBYSxFQUFFLGNBQWMsRUFDN0IsV0FBVyxHQUNaLE1BQU0sY0FBYyxDQUFBO0FBRXJCLE1BQU0sY0FBYyxHQUFHLENBQUMsS0FBWSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBUyxFQUFFLENBQVMsRUFBRSxFQUFFO0lBQ2hGLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0lBQzdELE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0lBQzVELE9BQU8sVUFBVSxLQUFLLFNBQVMsQ0FBQTtBQUNqQyxDQUFDLENBQUMsQ0FBQTtBQUVGLE1BQU0sWUFBWSxHQUFVO0lBQzFCLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO0lBQ3RDLElBQUksRUFBRTtRQUNKLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQ3RDLE1BQU0sRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQ3pDLGNBQWMsRUFBRSxhQUFhO1FBQzdCLFlBQVksRUFBRTtZQUNaLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxR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
// CONCATENATED MODULE: ./src/rules/index.ts



//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVsZXMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxhQUFhLENBQUE7QUFDM0IsY0FBYyxZQUFZLENBQUE7QUFDMUIsY0FBYyxjQUFjLENBQUEifQ==
// CONCATENATED MODULE: ./src/types.ts

// export type MergeResult = [any, (MergedKeyMeta | MergedArrayMeta)?]
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQWdGQSxzRUFBc0UifQ==
// CONCATENATED MODULE: ./node_modules/tslib/tslib.es6.js
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    }
    return __assign.apply(this, arguments);
}

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

function __param(paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
}

function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

function __createBinding(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}

function __exportStar(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) exports[p] = m[p];
}

function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}

function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
        ar = ar.concat(__read(arguments[i]));
    return ar;
}

function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};

function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}

function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

function __asyncDelegator(o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
}

function __asyncValues(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
}

function __makeTemplateObject(cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};

function __importStar(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result.default = mod;
    return result;
}

function __importDefault(mod) {
    return (mod && mod.__esModule) ? mod : { default: mod };
}

function __classPrivateFieldGet(receiver, privateMap) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to get private field on non-instance");
    }
    return privateMap.get(receiver);
}

function __classPrivateFieldSet(receiver, privateMap, value) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to set private field on non-instance");
    }
    privateMap.set(receiver, value);
    return value;
}

// CONCATENATED MODULE: ./src/dereference.ts


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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVyZWZlcmVuY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvZGVyZWZlcmVuY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0sU0FBUyxDQUFBO0FBRTNDLE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBRyxDQUFDLEdBQVEsRUFBRSxJQUFZLEVBQUUsUUFBYSxFQUFFLEVBQUUsRUFBRTtJQUN6RSxJQUFJLEtBQUssR0FBRyxHQUFHLENBQUE7SUFDZixLQUFLLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0lBQ3RDLEtBQUssTUFBTSxHQUFHLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ2pDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQzVELElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtZQUN2QixNQUFLO1NBQ047UUFDRCxLQUFLLEdBQUcsV0FBVyxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxHQUFHLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQTtLQUNsRDtJQUNELE9BQU8sS0FBSyxDQUFBO0FBQ2QsQ0FBQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHLENBQUMsS0FBVSxFQUFFLE1BQVcsRUFBRSxJQUFpQixFQUFFLEtBQXVCLEVBQU8sRUFBRTtJQUN0RyxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDaEMsTUFBTSxFQUFFLElBQUksS0FBYyxLQUFLLEVBQWQsSUFBSSxVQUFLLEtBQUssRUFBekIsUUFBaUIsQ0FBUSxDQUFBO1FBQy9CLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNsQixrRUFBa0U7WUFDbEUsT0FBTyxLQUFLLENBQUE7U0FDYjtRQUNELE1BQU0sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUV4Qyx3QkFBd0I7UUFDeEIsSUFBSSxRQUFRLEVBQUU7WUFDWixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDeEIsT0FBTyxLQUFLLENBQUE7YUFDYjtZQUNELE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1NBQzdCO1FBRUQsS0FBSyxtQ0FBUSxJQUFJLEdBQUssZUFBZSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUUsQ0FBQTtRQUM1RCxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ2QsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUE7S0FDdkI7SUFDRCxPQUFPLEtBQUssQ0FBQTtBQUNkLENBQUMsQ0FBQSJ9
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NpZmllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jbGFzc2lmaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFFN0MsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLENBQUMsS0FBWSxFQUFFLElBQWEsRUFBYyxFQUFFO0lBQ3hFLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQTtJQUNsQixLQUFLLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUU7UUFDN0IscURBQXFEO1FBQ3JELElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUU7WUFDaEUsR0FBRyxHQUFHLEdBQUcsQ0FBQTtTQUNWO1FBRUQsMEJBQTBCO1FBQzFCLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLEVBQUU7WUFDcEMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQTtZQUM5QixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3ZCLE9BQU8sSUFBSSxDQUFBO2FBQ1o7WUFDRCxNQUFNLEdBQUcsT0FBTyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBO1NBQ3BEO2FBQU07WUFDTCxPQUFPLGVBQWUsQ0FBQTtTQUN2QjtLQUNGO0lBQ0QsT0FBTyxlQUFlLENBQUE7QUFDeEIsQ0FBQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBc0IsRUFBRSxRQUFlLEVBQUUsRUFBUSxFQUFFO0lBQzlFLE1BQU0sS0FBSyxHQUFHLElBQVksQ0FBQTtJQUUxQixNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUVuRCxNQUFNLEtBQUssR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtJQUMvRCxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUE7SUFFcEMsS0FBSyxDQUFDLElBQUksR0FBRyxPQUFPLFVBQVUsS0FBSyxVQUFVO1FBQzNDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxVQUFVLENBQUE7SUFFZCxPQUFPLEtBQUssQ0FBQTtBQUNkLENBQUMsQ0FBQSJ9
// CONCATENATED MODULE: ./src/context.ts




class context_CompareContext {
    // public circularRef?: boolean
    constructor(before, after, options) {
        this.before = before;
        this.after = after;
        this.beforeRefs = new Set();
        this.afterRefs = new Set();
        this.beforeCache = new Map();
        this.afterCache = new Map();
        this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules;
        this.trimStrings = options.trimStrings;
        this.caseSensitive = options.caseSensitive;
        this.strictArrays = options.strictArrays;
        // this.circularRef = options.circularRef || false
        const externalRefs = options.externalRefs || {};
        for (const ref of Object.keys(externalRefs)) {
            this.beforeCache.set(ref, externalRefs[ref]);
            this.afterCache.set(ref, externalRefs[ref]);
        }
    }
    normalizeString(value) {
        value = this.trimStrings ? value.trim() : value;
        value = this.caseSensitive ? value : value.toLowerCase();
        return value;
    }
    dereference(before, after, objPath) {
        const ref = "#" + buildPath(objPath);
        this.beforeRefs.add(ref);
        this.afterRefs.add(ref);
        const _before = dereference(before, this.before, this.beforeRefs, this.beforeCache);
        const _after = dereference(after, this.after, this.afterRefs, this.afterCache);
        const clearCache = () => {
            // remove refs
            before.$ref && this.beforeRefs.delete(before.$ref);
            after.$ref && this.afterRefs.delete(after.$ref);
            this.beforeRefs.delete(ref);
            this.afterRefs.delete(ref);
        };
        return [_before, _after, clearCache];
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
    equalResult(value, path) {
        const result = {
            diffs: []
        };
        return result;
    }
    diffResult(diff) {
        const result = {
            diffs: [classifyDiff(diff, this.rules)]
        };
        return result;
    }
    mergeResult(res1, res2) {
        res1.diffs = [...res1.diffs, ...res2.diffs];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLGFBQWEsRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUN4RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZUFBZSxDQUFBO0FBQzNDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxjQUFjLENBQUE7QUFDM0MsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQU1uQyxNQUFNLE9BQU8sY0FBYztJQVl6QiwrQkFBK0I7SUFFL0IsWUFBbUIsTUFBVyxFQUFTLEtBQVUsRUFBRSxPQUF1QjtRQUF2RCxXQUFNLEdBQU4sTUFBTSxDQUFLO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBSztRQVgxQyxlQUFVLEdBQWdCLElBQUksR0FBRyxFQUFFLENBQUE7UUFDbkMsY0FBUyxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFBO1FBQ2xDLGdCQUFXLEdBQXFCLElBQUksR0FBRyxFQUFFLENBQUE7UUFDekMsZUFBVSxHQUFxQixJQUFJLEdBQUcsRUFBRSxDQUFBO1FBUzdDLElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxPQUFPLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUE7UUFDakcsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFBO1FBQ3RDLElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQTtRQUMxQyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUE7UUFDeEMsa0RBQWtEO1FBRWxELE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLElBQUks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
// CONCATENATED MODULE: ./src/compare.ts



const apiDiff = (before, after, options) => {
    const res = compare(before, after, new context_CompareContext(before, after, options));
    return res.diffs;
};
const compare = (before, after, ctx, path = []) => {
    if (typeOf(before) !== typeOf(after)) {
        return ctx.diffResult({ path, before, after, action: DiffAction.replace });
    }
    switch (typeOf(before)) {
        case "object": return compareObjects(before, after, ctx, path);
        case "array": return compareArrays(before, after, ctx, path);
        default:
            if (typeof before === "string") {
                before = ctx.normalizeString(before);
                after = ctx.normalizeString(after);
            }
            if (before !== after) {
                return ctx.diffResult({ path, before, after, action: DiffAction.replace });
            }
            else {
                return ctx.equalResult(before, path);
            }
    }
};
const compareObjects = (before, after, ctx, objPath) => {
    const result = { diffs: [] };
    const [_before, _after, clearCache] = ctx.dereference(before, after, objPath);
    const beforeKeys = Object.keys(_before);
    const afterKeys = new Set(Object.keys(_after));
    const meta = ctx.rules && getPathRuleMeta(ctx.rules, objPath);
    for (const key of beforeKeys) {
        const afterKey = [...afterKeys].find((k) => k === key || ((meta === null || meta === void 0 ? void 0 : meta.matchKeysFunc) && meta.matchKeysFunc(key, k)));
        const path = [...objPath, key];
        if (afterKey !== key) {
            const diff = { path, before: key, after: afterKey, action: DiffAction.replace };
            ctx.mergeResult(result, ctx.diffResult(diff));
        }
        if (!afterKey) {
            // deleted key
            const diff = { path, before: _before[key], action: DiffAction.remove };
            ctx.mergeResult(result, ctx.diffResult(diff));
        }
        else {
            // updated value
            ctx.mergeResult(result, compare(_before[key], _after[afterKey], ctx, path));
            afterKeys.delete(afterKey);
        }
    }
    for (const key of afterKeys) {
        // added key
        const diff = { path: [...objPath, key], after: _after[key], action: DiffAction.add };
        ctx.mergeResult(result, ctx.diffResult(diff));
    }
    clearCache();
    return result;
};
const compareArrays = (before, after, ctx, objPath) => {
    const meta = ctx.rules && getPathRuleMeta(ctx.rules, objPath);
    if (!ctx.strictArrays && !(meta === null || meta === void 0 ? void 0 : meta.matchItemsFunc)) {
        return compareEnums(before, after, ctx, objPath);
    }
    const result = { diffs: [] };
    const afterKeys = new Set(after.keys());
    for (const i of before.keys()) {
        const path = [...objPath, i];
        if (meta === null || meta === void 0 ? void 0 : meta.matchItemsFunc) {
            const j = (meta === null || meta === void 0 ? void 0 : meta.matchItemsFunc) && [...afterKeys].find((j) => meta.matchItemsFunc(before[i], after[j]));
            if (j === undefined) {
                ctx.mergeResult(result, ctx.diffResult({ path, before: before[i], action: DiffAction.remove }));
            }
            else {
                afterKeys.delete(j);
                ctx.mergeResult(result, compare(before[i], after[j], ctx, path));
            }
        }
        else {
            if (i >= after.length) {
                ctx.mergeResult(result, ctx.diffResult({ path, before: before[i], action: DiffAction.remove }));
            }
            else {
                afterKeys.delete(i);
                ctx.mergeResult(result, compare(before[i], after[i], ctx, path));
            }
        }
    }
    for (const key of afterKeys) {
        ctx.mergeResult(result, ctx.diffResult({ path: [...objPath, -1], after: after[key], action: DiffAction.add }));
    }
    return result;
};
const compareEnums = (before, after, ctx, path) => {
    const result = { diffs: [] };
    const itemsDiffs = [];
    const beforeDiffs = [];
    const afterEquals = new Set();
    const beforeEquals = new Set();
    for (let i = 0; i < before.length; i++) {
        let afterDiffs = [];
        for (let j = 0; j < after.length; j++) {
            if (afterEquals.has(j)) {
                continue;
            }
            const res = compare(before[i], after[j], ctx, [...path, i]);
            if (!res.diffs.length) {
                afterEquals.add(j);
                beforeEquals.add(i);
                afterDiffs = res;
                break;
            }
            afterDiffs.push(res);
        }
        beforeDiffs.push(afterDiffs);
    }
    for (let i = 0; i < before.length; i++) {
        const itemDiff = beforeDiffs[i];
        if (beforeEquals.has(i)) {
            // after has equal item
            itemsDiffs[i] = [];
            ctx.mergeResult(result, itemDiff);
        }
        else {
            // find item with min diff count
            const afterIndexes = [...Array(after.length).keys()];
            const minDiffs = afterIndexes.sort((a, b) => { var _a, _b; return (((_a = itemDiff[a]) === null || _a === void 0 ? void 0 : _a.length) || 0) - (((_b = itemDiff[b]) === null || _b === void 0 ? void 0 : _b.length) || 0); });
            for (let j = 0; j < after.length; j++) {
                let minDiffIndex = minDiffs[j];
                if (afterEquals.has(minDiffIndex)) {
                    continue;
                }
                for (let k = 0; k < before.length; k++) {
                    if (beforeEquals.has(k)) {
                        continue;
                    }
                    if (beforeDiffs[k][minDiffIndex] < beforeDiffs[i][minDiffIndex]) {
                        minDiffIndex = -1;
                        break;
                    }
                }
                if (minDiffIndex >= 0) {
                    // merge before[i] with beforeDiffs[i][minDiffIndex]
                    ctx.mergeResult(result, itemDiff[minDiffIndex]);
                    beforeEquals.add(i);
                    afterEquals.add(minDiffIndex);
                    break;
                }
            }
            if (!beforeEquals.has(i)) {
                const diff = { path: [...path, i], before: before[i], action: DiffAction.remove };
                ctx.mergeResult(result, ctx.diffResult(diff));
            }
        }
    }
    for (let j = 0; j < after.length; j++) {
        if (!afterEquals.has(j)) {
            const diff = { path: [...path, -1], after: after[j], action: DiffAction.add };
            ctx.mergeResult(result, ctx.diffResult(diff));
        }
    }
    return result;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGFyZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21wYXJlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxjQUFjLEVBQWlCLE1BQU0sV0FBVyxDQUFBO0FBRXpELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLE1BQU0sU0FBUyxDQUFBO0FBQ2pELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFFeEMsTUFBTSxDQUFDLE1BQU0sT0FBTyxHQUFHLENBQUMsTUFBVyxFQUFFLEtBQVUsRUFBRSxPQUF1QixFQUFVLEVBQUU7SUFDbEYsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxjQUFjLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFBO0lBQzlFLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQTtBQUNsQixDQUFDLENBQUE7QUFFRCxNQUFNLENBQUMsTUFBTSxPQUFPLEdBQUcsQ0FBMEIsTUFBVyxFQUFFLEtBQVUsRUFBRSxHQUFzQixFQUFFLE9BQWdCLEVBQUUsRUFBSyxFQUFFO0lBQ3pILElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNwQyxPQUFPLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUE7S0FDM0U7SUFFRCxRQUFRLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUN0QixLQUFLLFFBQVEsQ0FBQyxDQUFDLE9BQU8sY0FBYyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFBO1FBQzlELEtBQUssT0FBTyxDQUFDLENBQUUsT0FBTyxhQUFhLENBQUMsTUFBTSxFQUFFLEtB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
// CONCATENATED MODULE: ./src/merge.ts





const apiMerge = (before, after, options) => {
    const { value } = compare(before, after, new merge_MergeContext(before, after, options));
    return value;
};
class merge_MergeContext extends context_CompareContext {
    constructor(before, after, options) {
        super(before, after, options);
        this._formatMeta = (diff) => {
            return Object.assign({ type: diff.type, action: diff.action }, diff.action === DiffAction.replace ? { replaced: diff.before } : {});
        };
        this.formatMeta = options.formatMeta || ((d) => this._formatMeta(d));
        this.metaKey = options.metaKey || DIFF_META_KEY;
        this.arrayMeta = options.arrayMeta || false;
    }
    equalResult(value, path) {
        const result = {
            diffs: [],
            value,
            path
        };
        return result;
    }
    diffResult(diff) {
        const result = {
            diffs: [classifyDiff(diff, this.rules)],
            diff: classifyDiff(diff, this.rules),
            path: diff.path
        };
        return result;
    }
    mergeResult(parent, child) {
        var _a;
        // merge object properties or array items
        parent.diffs = [...parent.diffs, ...child.diffs];
        let key = child.path[child.path.length - 1];
        const array = typeof key === "number";
        const value = parent.value ? parent.value : array ? [] : {};
        key = key === -1 ? value.length : key;
        if (child.diff) {
            if (child.diff.action === DiffAction.remove) {
                value[key] = child.diff.before;
            }
            else {
                value[key] = child.diff.after;
            }
            const meta = this.formatMeta(child.diff);
            if (typeOf(value) === "array" && !this.arrayMeta) {
                parent.meta = { array: Object.assign(Object.assign({}, (_a = parent.meta) === null || _a === void 0 ? void 0 : _a.array), { [key]: meta }) };
            }
            else {
                value[this.metaKey] = Object.assign(Object.assign({}, value[this.metaKey]), { [key]: meta });
            }
        }
        else {
            value[key] = child.value;
            if (child.meta) {
                value[this.metaKey] = { [key]: child.meta };
            }
        }
        parent.value = value;
        parent.path = child.path.slice(0, -1);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWVyZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLGNBQWMsRUFBaUIsTUFBTSxXQUFXLENBQUE7QUFDekQsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFDdkQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGNBQWMsQ0FBQTtBQUMzQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sV0FBVyxDQUFBO0FBQ25DLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxTQUFTLENBQUE7QUFFaEMsTUFBTSxDQUFDLE1BQU0sUUFBUSxHQUFHLENBQUMsTUFBVyxFQUFFLEtBQVUsRUFBRSxPQUFxQixFQUFPLEVBQUU7SUFDOUUsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQTtJQUNsRixPQUFPLEtBQUssQ0FBQTtBQUNkLENBQUMsQ0FBQTtBQVNELE1BQU0sT0FBTyxZQUFhLFNBQVEsY0FBMkI7SUFNM0QsWUFBWSxNQUFXLEVBQUUsS0FBVSxFQUFFLE9BQXFCO1FBQ3hELEtBQUssQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFBO1FBTXZCLGdCQUFXLEdBQUcsQ0FBQyxJQUFVLEVBQWlCLEVBQUU7WUFDbEQsdUJBQ0UsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQ2YsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLElBQ2hCLElBQUksQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQ3ZFO1FBQ0gsQ0FBQyxDQUFBO1FB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
// CONCATENATED MODULE: ./src/index.ts






//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxlQUFlLENBQUE7QUFDN0IsY0FBYyxTQUFTLENBQUE7QUFDdkIsY0FBYyxhQUFhLENBQUE7QUFDM0IsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUE7QUFDNUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUNsQyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxTQUFTLENBQUEifQ==

/***/ })
/******/ ]);