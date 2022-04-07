/*! api-smart-diff@0.2.15 */
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
__webpack_require__.d(__webpack_exports__, "serviceNodeRules", function() { return /* reexport */ serviceNodeRules; });
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
__webpack_require__.d(__webpack_exports__, "breakingIf", function() { return /* reexport */ breakingIf; });
__webpack_require__.d(__webpack_exports__, "breakingIfAfterTrue", function() { return /* reexport */ breakingIfAfterTrue; });
__webpack_require__.d(__webpack_exports__, "typeOf", function() { return /* reexport */ typeOf; });
__webpack_require__.d(__webpack_exports__, "parsePath", function() { return /* reexport */ parsePath; });
__webpack_require__.d(__webpack_exports__, "buildPath", function() { return /* reexport */ buildPath; });
__webpack_require__.d(__webpack_exports__, "getRules", function() { return /* reexport */ getRules; });
__webpack_require__.d(__webpack_exports__, "getPathRuleMeta", function() { return /* reexport */ getPathRuleMeta; });
__webpack_require__.d(__webpack_exports__, "findExternalRefs", function() { return /* reexport */ findExternalRefs; });
__webpack_require__.d(__webpack_exports__, "enumRules", function() { return /* reexport */ enumRules; });
__webpack_require__.d(__webpack_exports__, "objArray", function() { return /* reexport */ objArray; });
__webpack_require__.d(__webpack_exports__, "mapRules", function() { return /* reexport */ mapRules; });

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnN0YW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFBO0FBQ3pDLE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUE7QUFFcEMsTUFBTSxDQUFOLElBQVksVUFJWDtBQUpELFdBQVksVUFBVTtJQUNwQix5QkFBVyxDQUFBO0lBQ1gsK0JBQWlCLENBQUE7SUFDakIsaUNBQW1CLENBQUE7QUFDckIsQ0FBQyxFQUpXLFVBQVUsS0FBVixVQUFVLFFBSXJCO0FBRUQsTUFBTSxDQUFOLElBQVksY0FLWDtBQUxELFdBQVksY0FBYztJQUN4Qix1Q0FBcUIsQ0FBQTtJQUNyQiw4Q0FBNEIsQ0FBQTtJQUM1QiwyQ0FBeUIsQ0FBQTtJQUN6QiwrQ0FBNkIsQ0FBQTtBQUMvQixDQUFDLEVBTFcsY0FBYyxLQUFkLGNBQWMsUUFLekI7QUFFRCxNQUFNLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxHQUFHLGNBQWMsQ0FBQTtBQUVqRix5QkFBeUI7QUFDekIsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFTLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQTtBQUMzRSxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQVMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFBO0FBQy9ELE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBUyxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUE7QUFDekUsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFTLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQTtBQUNyRSxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQVMsQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFBO0FBQy9FLE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBUyxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUEifQ==
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
const getRules = (rules, path, source) => {
    let _rules = rules;
    let value = source;
    for (let key of [...path]) {
        value = (key !== undefined && value !== undefined) ? value[key] : undefined;
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
            _rules = typeof rule === "function" ? rule(value) : rule;
        }
        else {
            return undefined;
        }
    }
    return _rules;
};
const getPathRuleMeta = (rules, path, source) => {
    const _rules = getRules(rules, path, source);
    if (_rules && !Array.isArray(_rules) && RuleMetaKey in _rules) {
        return _rules[RuleMetaKey];
    }
    return undefined;
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
const objArray = (key, rules) => {
    rules[RuleMetaKey] = { matchItemsFunc: (b, a) => a[key] === b[key] };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbnNjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9ydWxlcy9qc29uc2NoZW1hLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxVQUFVLENBQUE7QUFFMUQsT0FBTyxFQUNMLFFBQVEsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUNyQyxhQUFhLEVBQUUsV0FBVyxFQUFFLGVBQWUsRUFDM0MsZUFBZSxHQUNoQixNQUFNLGNBQWMsQ0FBQTtBQUVyQixNQUFNLGFBQWEsR0FBUztJQUMxQixRQUFRO0lBQ1IsV0FBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDNUIsQ0FBQTtBQUVELE1BQU0sYUFBYSxHQUFTO0lBQzFCLFFBQVE7SUFDUixXQUFXO0lBQ1gsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1QixDQUFBO0FBRUQsTUFBTSxtQkFBbUIsR0FBUztJQUNoQyxtQkFBbUI7SUFDbkIsV0FBVztJQUNYLG1CQUFtQjtDQUNwQixDQUFBO0FBRUQsTUFBTSxpQkFBaUIsR0FBUztJQUM5QixtQkFBbUI7SUFDbkIsV0FBVztJQUNYLG1CQUFtQjtDQUNwQixDQUFBO0FBRUQsTUFBTSxvQkFBb0IsR0FBUztJQUNqQyxRQUFRO0lBQ1IsV0FBVztJQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNoQyxDQUFBO0FBRUQsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFHLENBQUMsV0FBaUIsZUFBZSxFQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQzNFLEdBQUcsRUFBRSxRQUFRO0lBQ2IsUUFB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
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
// CONCATENATED MODULE: ./src/rules/servicenode.ts



const childrenArray = (rules) => enumRules(rules, (b, a) => {
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
const paramRules = {
    '/name': [nonBreaking, breaking, breaking],
    '/style': allUnclassified,
    '/description': allAnnotation,
    '/explode': allUnclassified,
    '/required': [breaking, nonBreaking, breakingIfAfterTrue],
    '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
};
const paramsRules = {
    '/': [nonBreaking, breaking, breaking],
    '/*': paramRules
};
const contentsRules = {
    '/': addNonBreaking,
    '/*': {
        '/': [nonBreaking, breaking, breaking],
        '/mediaType': [nonBreaking, breaking, breaking],
        '/schema': jsonSchemaRules(allBreaking),
        '/examples': objArray("key", {
            "/": allAnnotation,
            "/*": allAnnotation,
        }),
        '/encodings': [nonBreaking, breaking, breaking],
    }
};
const requestRules = {
    '/path': objArray("name", paramsRules),
    '/query': objArray("name", {
        '/': [nonBreaking, breaking, breaking],
        '/*': Object.assign(Object.assign({}, paramRules), { '/allowEmptyValue': [breaking, nonBreaking, breakingIfAfterTrue], '/allowReserved': [breaking, nonBreaking, breakingIfAfterTrue] }),
    }),
    '/headers': objArray("name", paramsRules),
    '/cookie': objArray("name", paramsRules),
    '/body': {
        '/': [nonBreaking, breaking, breaking],
        '/contents': objArray("mediaType", contentsRules),
        '/required': [breaking, nonBreaking, breakingIfAfterTrue],
        '/description': allAnnotation
    },
};
const servicenode_headersRules = {
    '/': allUnclassified,
    '/*': {
        '/name': [nonBreaking, breaking, breaking],
        '/style': allUnclassified,
        '/description': allAnnotation,
        '/explode': allUnclassified,
        '/required': [breaking, nonBreaking, breakingIfAfterTrue],
        '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
    }
};
const servicenode_responsesRules = {
    "/": addNonBreaking,
    "/*": {
        "/": addNonBreaking,
        '/code': allUnclassified,
        '/contents': objArray("mediaType", contentsRules),
        '/headers': objArray("name", servicenode_headersRules),
        '/description': allAnnotation
    }
};
const serverRules = {
    '/': [nonBreaking, breaking, breaking],
    '/url': [nonBreaking, breaking, breaking],
    '/name': allAnnotation,
    '/description': allAnnotation,
    '/variables': [nonBreaking, breaking, breaking],
};
const servicenode_securityRules = {
    "/": [breaking, nonBreaking, unclassified],
    "/*": [breaking, nonBreaking, unclassified],
};
const modelRules = {
    '/': [nonBreaking, breaking, breaking],
    '/data': () => jsonSchemaRules(addNonBreaking),
    '/*': allAnnotation,
};
const servicenode_operationRules = {
    '/': [nonBreaking, breaking, breaking],
    '/data': {
        // Node common
        '/id': allAnnotation,
        '/iid': allAnnotation,
        '/tags': allAnnotation,
        '/summary': allAnnotation,
        '/description': allAnnotation,
        // Operation
        '/method': [nonBreaking, breaking, breaking],
        '/path': [nonBreaking, breaking, breaking],
        '/request': requestRules,
        '/responses': objArray("code", servicenode_responsesRules),
        '/servers': {
            '/': allUnclassified,
            '/*': serverRules
        },
        '/callbacks': childrenArray({
            '/callbackName': allAnnotation,
            '/method': [nonBreaking, breaking, breaking],
            '/path': [nonBreaking, breaking, breaking],
            '/request': requestRules,
            '/responses': objArray("code", servicenode_responsesRules),
            '/deprecated': allUnclassified,
            '/internal': allUnclassified,
            '/extensions': allUnclassified,
        }),
        '/security': servicenode_securityRules,
        '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
        '/internal': allUnclassified,
        '/extensions': allUnclassified
    },
    '/*': allAnnotation,
};
const serviceRules = {
    // Node common
    '/id': allAnnotation,
    '/iid': allAnnotation,
    '/tags': allAnnotation,
    '/summary': allAnnotation,
    '/description': allAnnotation,
    // service rules
    '/name': allAnnotation,
    '/version': allAnnotation,
    '/servers': {
        '/': [nonBreaking, breaking, breaking],
        '/*': serverRules
    },
    '/security': servicenode_securityRules,
    '/securitySchemes': objArray("name", {
        '/': addNonBreaking,
        '/*': {
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
    }),
    '/termsOfService': allAnnotation,
    '/contact': allAnnotation,
    '/license': [breaking, breaking, breaking],
    '/logo': allAnnotation
};
const serviceNodeRules = {
    '/*': allAnnotation,
    '/data': serviceRules,
    '/children': childrenArray({
        '/': [nonBreaking, breaking, breaking],
        '/*': ({ type }) => type === "model" ? modelRules : servicenode_operationRules,
    }),
    "/components": {
        "/": [nonBreaking, nonBreaking, nonBreaking],
        "/schemas": {
            "/": [nonBreaking, breaking, breaking],
            "/*": jsonSchemaRules(addNonBreaking),
        },
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZW5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVsZXMvc2VydmljZW5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLGFBQWEsRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUMzQyxZQUFZLEVBQUUsY0FBYyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQ3BELE1BQU0sY0FBYyxDQUFBO0FBQ3JCLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sVUFBVSxDQUFBO0FBQ25FLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxHQUFHLENBQUE7QUFHbkMsTUFBTSxhQUFhLEdBQUcsQ0FBQyxLQUFZLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7O0lBQ2hFLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFO1FBQ3JCLE9BQU8sS0FBSyxDQUFBO0tBQ2I7SUFDRCxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFO1FBQ3RCLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFBO0tBQ3pCO1NBQU07UUFDTCxNQUFNLFVBQVUsR0FBRyxNQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSwwQ0FBRSxPQUFPLENBQUMsSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBQ3hFLE1BQU0sU0FBUyxHQUFHLE1BQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLDBDQUFFLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFDdkUsT0FBTyxVQUFVLEtBQUssU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMs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
// CONCATENATED MODULE: ./src/rules/index.ts




//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcnVsZXMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxhQUFhLENBQUE7QUFDM0IsY0FBYyxZQUFZLENBQUE7QUFDMUIsY0FBYyxjQUFjLENBQUE7QUFDNUIsY0FBYyxlQUFlLENBQUEifQ==
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


const classifyDiff = (diff, source, rules = {}) => {
    const _diff = diff;
    const rule = getRules(rules, [...diff.path, ""], source);
    const classifier = Array.isArray(rule) ? rule : allUnclassified;
    const index = ["add", "remove", "replace"].indexOf(diff.action);
    const changeType = classifier[index];
    _diff.type = typeof changeType === "function"
        ? changeType(diff.before, diff.after)
        : changeType;
    return _diff;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NpZmllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jbGFzc2lmaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFDN0MsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUVsQyxNQUFNLENBQUMsTUFBTSxZQUFZLEdBQUcsQ0FBQyxJQUFzQixFQUFFLE1BQVcsRUFBRSxRQUFlLEVBQUUsRUFBUSxFQUFFO0lBQzNGLE1BQU0sS0FBSyxHQUFHLElBQVksQ0FBQTtJQUUxQixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFBO0lBQ3hELE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFBO0lBRS9ELE1BQU0sS0FBSyxHQUFHLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO0lBQy9ELE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUVwQyxLQUFLLENBQUMsSUFBSSxHQUFHLE9BQU8sVUFBVSxLQUFLLFVBQVU7UUFDM0MsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDckMsQ0FBQyxDQUFDLFVBQVUsQ0FBQTtJQUVkLE9BQU8sS0FBSyxDQUFBO0FBQ2QsQ0FBQyxDQUFBIn0=
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
        this.rules = typeof options.rules === "string" ? this.getBaseRules(options.rules) : options.rules || {};
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
    getPathRuleMeta(path) {
        return getPathRuleMeta(this.rules, path, this.before);
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
            diffs: [classifyDiff(diff, this.before, this.rules)]
        };
        return result;
    }
    mergeResult(res1, res2) {
        res1.diffs = [...res1.diffs, ...res2.diffs];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLGFBQWEsRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUN4RSxPQUFPLEVBQUUsU0FBUyxFQUFFLGVBQWUsRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUNwRCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZUFBZSxDQUFBO0FBQzNDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxjQUFjLENBQUE7QUFNM0MsTUFBTSxPQUFPLGNBQWM7SUFZekIsK0JBQStCO0lBRS9CLFlBQW1CLE1BQVcsRUFBUyxLQUFVLEVBQUUsT0FBdUI7UUFBdkQsV0FBTSxHQUFOLE1BQU0sQ0FBSztRQUFTLFVBQUssR0FBTCxLQUFLLENBQUs7UUFYMUMsZUFBVSxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFBO1FBQ25DLGNBQVMsR0FBZ0IsSUFBSSxHQUFHLEVBQUUsQ0FBQTtRQUNsQyxnQkFBVyxHQUFxQixJQUFJLEdBQUcsRUFBRSxDQUFBO1FBQ3pDLGVBQVUsR0FBcUIsSUFBSSxHQUFHLEVBQUUsQ0FBQTtRQVM3QyxJQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sT0FBTyxDQUFDLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQTtRQUN2RyxJQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUE7UUFDdEMsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFBO1FBQzFDLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQTtRQUN4QyxrREFBa0Q7UUFFbEQsTUFBTSxZQUFZLEdBQUcs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
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
    if (Object.keys(_before).length === 0 && Object.keys(_after).length === 0) {
        return ctx.equalResult(before, objPath);
    }
    const beforeKeys = Object.keys(_before);
    const afterKeys = new Set(Object.keys(_after));
    const meta = ctx.getPathRuleMeta(objPath);
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
    if (before.length === 0 && after.length === 0) {
        return ctx.equalResult(before, objPath);
    }
    const meta = ctx.getPathRuleMeta(objPath);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGFyZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21wYXJlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxjQUFjLEVBQWlCLE1BQU0sV0FBVyxDQUFBO0FBRXpELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFDeEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUVoQyxNQUFNLENBQUMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxNQUFXLEVBQUUsS0FBVSxFQUFFLE9BQXVCLEVBQVUsRUFBRTtJQUNsRixNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLGNBQWMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUE7SUFDOUUsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFBO0FBQ2xCLENBQUMsQ0FBQTtBQUVELE1BQU0sQ0FBQyxNQUFNLE9BQU8sR0FBRyxDQUEwQixNQUFXLEVBQUUsS0FBVSxFQUFFLEdBQXNCLEVBQUUsT0FBZ0IsRUFBRSxFQUFLLEVBQUU7SUFDekgsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3BDLE9BQU8sR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQTtLQUMzRTtJQUVELFFBQVEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3RCLEtBQUssUUFBUSxDQUFDLENBQUMsT0FBTyxjQUFjLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUE7UUFDOUQsS0FBSyxPQUFPLENBQUMsQ0FBQyxPQUFPLGFBQWEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdB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
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
            diffs: [classifyDiff(diff, this.before, this.rules)],
            diff: classifyDiff(diff, this.before, this.rules),
            path: diff.path
        };
        return result;
    }
    mergeResult(parent, child) {
        var _a;
        if (!child) {
            // TODO: fix error
            return;
        }
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






//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxlQUFlLENBQUE7QUFDN0IsY0FBYyxTQUFTLENBQUE7QUFDdkIsY0FBYyxhQUFhLENBQUE7QUFDM0IsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUE7QUFDNUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLFNBQVMsQ0FBQTtBQUNsQyxjQUFjLFNBQVMsQ0FBQSJ9

/***/ })
/******/ ]);