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
exports.ApiCompare = void 0;
const utils_1 = require("./utils");
const rules_1 = require("./rules");
const constants_1 = require("./constants");
const jsonCompare_1 = require("./jsonCompare");
const changeContext_1 = require("./changeContext");
const $renamed = Symbol("renamed");
class ApiCompare extends jsonCompare_1.JsonCompare {
    constructor(before, after, options = {}) {
        super(before, after, options);
        this.before = before;
        this.after = after;
        this.beforeRefs = new Set();
        this.afterRefs = new Set();
        this.beforeCache = new Map();
        this.afterCache = new Map();
        this.compareCache = new Map();
        this.renamedPath = {};
        this._formatMergeMeta = (diff) => {
            return Object.assign({ type: diff.type, action: diff.action }, diff.action === constants_1.DiffAction.replace || diff.action === constants_1.DiffAction.rename ? { replaced: diff.before } : {});
        };
        this.resolvePath = (source, objPath) => {
            const cache = source === "before" ? this.beforeCache : this.afterCache;
            let value = this[source];
            for (const key of objPath) {
                const _value = Array.isArray(value) ? value[+key] : value[key];
                if (_value === undefined && value.$ref) {
                    value = (0, utils_1.resolveRef)(value, this[source], cache);
                    value = Array.isArray(value) ? value[+key] : value[key];
                }
                else {
                    value = _value;
                }
                if (value === undefined) {
                    break;
                }
            }
            return value.$ref ? (0, utils_1.resolveRef)(value, this[source], cache) : value;
        };
        this.rules = options.rules || this.calcApiRules(before);
        this.formatMergedMeta = options.formatMergedMeta || this._formatMergeMeta.bind(this);
        this.resolveUnchangedRefs = options.resolveUnchangedRefs || false;
        const externalRefs = options.externalRefs || {};
        for (const ref of Object.keys(externalRefs)) {
            this.beforeCache.set(ref, externalRefs[ref]);
            this.afterCache.set(ref, externalRefs[ref]);
        }
    }
    getMatchFunc(path) {
        return (0, utils_1.getPathMatchFunc)(this.rules, path, this.before) || super.getMatchFunc(path);
    }
    static apiDiff(before, after, options = {}) {
        return new ApiCompare(before, after, options).compare();
    }
    static apiDiffTree(before, after, options = {}) {
        return new ApiCompare(before, after, options).buildDiffTree();
    }
    static apiMerge(before, after, options = {}) {
        return new ApiCompare(before, after, options).merge();
    }
    dereference(source, value, objPath) {
        const ref = "#" + objPath.ref;
        const [refs, cache] = source === "before"
            ? [this.beforeRefs, this.beforeCache]
            : [this.afterRefs, this.afterCache];
        const clearCache = () => {
            // remove refs
            value.$ref && refs.delete(value.$ref);
            refs.delete(ref);
        };
        if (refs.has(value.$ref) || value.$ref === "#") {
            return [value, clearCache];
        }
        refs.add(ref);
        value.$ref && refs.add(value.$ref);
        return [(0, utils_1.resolveRef)(value, this[source], cache), clearCache];
    }
    calcApiRules(data) {
        if (typeof data !== "object" || !data) {
            return (0, rules_1.jsonSchemaRules)();
        }
        if (/3.+/.test((data === null || data === void 0 ? void 0 : data.openapi) || ""))
            return rules_1.openapi3Rules;
        if (/2.+/.test((data === null || data === void 0 ? void 0 : data.asyncapi) || ""))
            return rules_1.asyncApi2Rules;
        if (/2.+/.test((data === null || data === void 0 ? void 0 : data.swagger) || ""))
            return rules_1.swagger2Rules;
        if (data === null || data === void 0 ? void 0 : data.graphapi)
            return rules_1.graphapiRules;
        return (0, rules_1.jsonSchemaRules)();
    }
    classifyDiff(diff) {
        const _diff = diff;
        if (diff.action === "test") {
            return _diff;
        }
        const path = diff.action === "rename" ? [...diff.path, "*", ""] : [...diff.path, ""];
        const rule = (0, utils_1.getPathRules)(this.rules, path, this.merged);
        const classifier = Array.isArray(rule) ? rule : constants_1.allUnclassified;
        const index = diff.action === "rename" ? 2 : ["add", "remove", "replace"].indexOf(diff.action);
        const changeType = classifier[index];
        try {
            _diff.type = typeof changeType === "function"
                ? changeType(new changeContext_1.ChangeContext(this, diff.path))
                : changeType;
            return _diff;
        }
        catch (error) {
            _diff.type = constants_1.unclassified;
            return _diff;
        }
    }
    getRenamedPath(objPath) {
        const renamedPath = [...objPath];
        let _path = this.renamedPath;
        for (let i = 0; i < objPath.length; i++) {
            const key = objPath[i];
            if (_path[key] === undefined) {
                break;
            }
            _path = _path[key];
            if (_path[$renamed]) {
                renamedPath[i] = _path[$renamed];
            }
        }
        return renamedPath;
    }
    compareResult(diff) {
        if (diff.action === constants_1.DiffAction.rename) {
            (0, utils_1.setValueByPath)(this.renamedPath, [...diff.path, diff.before, $renamed], diff.after);
        }
        return super.compareResult(this.classifyDiff(diff));
    }
    compareObjects(before, after, objPath, merged) {
        const { $ref: beforeRef } = before, $before = __rest(before, ["$ref"]);
        const { $ref: afterRef } = after, $after = __rest(after, ["$ref"]);
        const compareRefsId = beforeRef ? beforeRef === afterRef ? beforeRef : `${beforeRef}:${afterRef}` : "#" + objPath.ref;
        const compareCache = this.compareCache.get(compareRefsId);
        if (compareCache && ((0, utils_1.isEmptyObject)($before) && (0, utils_1.isEmptyObject)($after) || !beforeRef && !afterRef)) {
            if (!compareCache.result.diffs.length && !this.resolveUnchangedRefs) {
                return super.compareObjects(before, after, objPath, merged);
            }
            (0, utils_1.mergeValues)(merged, compareCache.merged);
            const diffs = compareCache.result.diffs.map((diff) => (Object.assign(Object.assign({}, diff), { path: [...objPath, ...diff.path] })));
            return Object.assign(Object.assign({}, compareCache.result), { diffs });
        }
        const [_before, clearBeforeCache] = this.dereference("before", before, objPath);
        const [_after, clearAfterCache] = this.dereference("after", after, objPath);
        const _merged = Array.isArray(merged) ? [] : {};
        // compare $before and $after
        let result = super.compareObjects(_before, _after, objPath, merged);
        if (beforeRef && afterRef && (0, utils_1.isEmptyObject)($before) && (0, utils_1.isEmptyObject)($after)) {
            const diffs = result.diffs.map((diff) => (Object.assign(Object.assign({}, diff), { path: diff.path.slice(objPath.items.length) })));
            this.compareCache.set(compareRefsId, { result: Object.assign(Object.assign({}, result), { diffs }), merged });
        }
        clearAfterCache();
        clearBeforeCache();
        if (beforeRef && beforeRef === afterRef && !result.diffs.length && !this.resolveUnchangedRefs) {
            if (Array.isArray(merged)) {
                merged.length = 0;
            }
            else {
                Object.keys(merged).forEach(key => delete merged[key]);
            }
            result = super.compareObjects(before, after, objPath, merged);
        }
        else {
            (0, utils_1.mergeValues)(merged, _merged);
        }
        return result;
    }
}
exports.ApiCompare = ApiCompare;
//# sourceMappingURL=apiCompare.js.map