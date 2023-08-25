"use strict";
var __rest = (this && this.__rest) || function (s, e) {
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.includeSecurity = exports.emptySecurity = exports.mergeValues = exports.setValueByPath = exports.getValueByPath = exports.resolveRef = exports.objArray = exports.matchRule = exports.findExternalRefs = exports.getPathMatchFunc = exports.getPathRules = exports.buildPath = exports.parsePath = exports.typeOf = exports.isEmptyObject = exports.unchanged = exports.renamed = exports.replaced = exports.removed = exports.added = exports.breakingIfAfterTrue = exports.breakingIf = exports.PathPointer = void 0;
const constants_1 = require("./constants");
class PathPointer {
    get ref() {
        return this.parent ? this.parent.ref + "/" + this.escapedKey : this.escapedKey;
    }
    [Symbol.iterator]() {
        let i = 0;
        return {
            next: () => ({
                done: !(i < this.items.length),
                value: this.items[i++]
            })
        };
    }
    constructor(key, parent) {
        this.key = key;
        this.parent = parent;
        this.items = [];
        if (key === undefined) {
            this.escapedKey = "";
        }
        else {
            this.escapedKey = typeof key === "string" ? key.replace(new RegExp("~1", "g"), "/") : String(key);
            this.items = parent ? [...parent.items, key] : [key];
        }
    }
    childPath(key) {
        return new PathPointer(key, this);
    }
}
exports.PathPointer = PathPointer;
const breakingIf = (v) => (v ? constants_1.breaking : constants_1.nonBreaking);
exports.breakingIf = breakingIf;
const breakingIfAfterTrue = ({ after }) => (0, exports.breakingIf)(after);
exports.breakingIfAfterTrue = breakingIfAfterTrue;
const added = (path, after) => ({ path: path.items, after, action: constants_1.DiffAction.add });
exports.added = added;
const removed = (path, before) => ({ path: path.items, before, action: constants_1.DiffAction.remove });
exports.removed = removed;
const replaced = (path, before, after) => ({ path: path.items, before, after, action: constants_1.DiffAction.replace });
exports.replaced = replaced;
const renamed = (path, before, after) => ({ path: path.items, before, after, action: constants_1.DiffAction.rename });
exports.renamed = renamed;
const unchanged = (path, before) => ({ path: path.items, before, action: constants_1.DiffAction.test });
exports.unchanged = unchanged;
const isEmptyObject = (obj) => {
    for (const key in obj)
        return false;
    return true;
};
exports.isEmptyObject = isEmptyObject;
const typeOf = (value) => {
    if (Array.isArray(value)) {
        return "array";
    }
    return value == null ? "null" : typeof value;
};
exports.typeOf = typeOf;
const parsePath = (path) => {
    const [_, ...pathArr] = path.split("/").map((i) => i.replace(new RegExp("~1", "g"), "/"));
    return pathArr;
};
exports.parsePath = parsePath;
const buildPath = (path) => {
    return "/" + path.map((i) => String(i).replace(new RegExp("/", "g"), "~1")).join("/");
};
exports.buildPath = buildPath;
const getPathRules = (rules, path, source) => {
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
exports.getPathRules = getPathRules;
const getPathMatchFunc = (rules, path, source) => {
    const _rules = (0, exports.getPathRules)(rules, path.items, source);
    return (_rules && !Array.isArray(_rules)) ? _rules["#"] : undefined;
};
exports.getPathMatchFunc = getPathMatchFunc;
const findExternalRefs = (source) => {
    if (typeof source !== "object") {
        return [];
    }
    let refs = new Set();
    if ((0, exports.typeOf)(source) === "array") {
        for (const item of source) {
            if (typeof item === "object") {
                refs = new Set([...refs, ...(0, exports.findExternalRefs)(item)]);
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
                    refs = new Set([...refs, ...(0, exports.findExternalRefs)(source[key])]);
                }
            }
        }
    }
    return [...refs];
};
exports.findExternalRefs = findExternalRefs;
const matchRule = (rules, matchFunc) => {
    rules["#"] = matchFunc;
    return rules;
};
exports.matchRule = matchRule;
const objArray = (key, rules) => {
    return (0, exports.matchRule)(rules, ({ before, after }) => after.value[key] === before.value[key]);
};
exports.objArray = objArray;
const resolveRef = (val, source, cache) => {
    const { $ref } = val, rest = __rest(val, ["$ref"]);
    if ($ref) {
        const [external, path] = $ref.split("#");
        if (external && !cache.has(external)) {
            return val;
        }
        const value = (0, exports.getValueByPath)(external ? cache.get(external) : source, (0, exports.parsePath)(path));
        if (value === undefined) {
            return val;
        }
        else {
            return !(0, exports.isEmptyObject)(rest) ? (0, exports.mergeValues)(value, rest) : value;
        }
    }
    else {
        return val;
    }
};
exports.resolveRef = resolveRef;
const getValueByPath = (obj, objPath) => {
    let value = obj;
    for (const key of objPath) {
        value = (0, exports.typeOf)(value) === "array" ? value[+key] : value[key];
        if (value === undefined) {
            break;
        }
    }
    return value;
};
exports.getValueByPath = getValueByPath;
const setValueByPath = (obj, objPath, value, i = 0) => {
    if (i >= objPath.length) {
        return;
    }
    const key = objPath[i];
    if (typeof obj[key] !== "object") {
        obj[key] = {};
    }
    if (i === objPath.length - 1) {
        obj[key] = value;
    }
    else {
        (0, exports.setValueByPath)(obj[key], objPath, value, i + 1);
    }
};
exports.setValueByPath = setValueByPath;
const mergeValues = (value, patch) => {
    if (!Array.isArray(value) && typeof value === "object" && typeof patch === "object" && patch) {
        for (const key of Reflect.ownKeys(patch)) {
            value[key] = (0, exports.mergeValues)(value[key], patch[key]);
        }
        return value;
    }
    else {
        return patch;
    }
};
exports.mergeValues = mergeValues;
const emptySecurity = (value) => {
    return !!value && (value.length === 0 || (value.length === 1 && Object.keys(value[0]).length === 0));
};
exports.emptySecurity = emptySecurity;
const includeSecurity = (value = [], items = []) => {
    // TODO match security schema
    const valueSet = new Set(value.map((item) => Object.keys(item)[0]));
    for (const item of items) {
        if (!valueSet.has(Object.keys(item)[0])) {
            return false;
        }
    }
    return true;
};
exports.includeSecurity = includeSecurity;
//# sourceMappingURL=utils.js.map