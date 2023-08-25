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
exports.JsonCompare = void 0;
const utils_1 = require("./utils");
const constants_1 = require("./constants");
class JsonCompare {
    get merged() { return this._merged.value; }
    constructor(before, after, options = {}) {
        this.before = before;
        this.after = after;
        this._merged = {};
        this._formatMergeMeta = (diff) => {
            return Object.assign({ action: diff.action }, diff.action === constants_1.DiffAction.replace || diff.action === constants_1.DiffAction.rename ? { replaced: diff.before } : {});
        };
        this.trimStrings = options.trimStrings;
        this.caseSensitive = options.caseSensitive;
        this.strictArrays = options.strictArrays;
        this.matchRules = options.matchRules || {};
        this.diffKey = options.metaKey || constants_1.DIFF_META_KEY;
        this.arrayMeta = options.arrayMeta;
        this.formatMergedMeta = options.formatMergedMeta || this._formatMergeMeta.bind(this);
    }
    setMeta(obj, key, meta) {
        if (obj[this.diffKey] === undefined) {
            obj[this.diffKey] = {};
        }
        obj[this.diffKey][key] = meta;
    }
    checkMatch(path, before, after, bKey, aKey) {
        const matchFunc = this.getMatchFunc(path);
        return matchFunc ? matchFunc({
            path: path.items,
            before: { key: bKey, value: before[bKey], parent: before, source: this.before },
            after: { key: aKey, value: after[aKey], parent: after, source: this.after }
        }) : false;
    }
    getMatchFunc(path) {
        // TODO: support masked path
        const strPath = path.ref; // buildPath(path)
        return this.matchRules[strPath];
    }
    compare() {
        return this.compareAny(this.before, this.after).diffs;
    }
    buildDiffTree() {
        return this.compareAny(this.before, this.after).diffTree;
    }
    merge() {
        this.compareAny(this.before, this.after);
        return this._merged.value;
    }
    normalizeString(value) {
        value = this.trimStrings ? value.trim() : value;
        value = this.caseSensitive ? value : value.toLowerCase();
        return value;
    }
    mergeResults(results, merged, array = false) {
        const res = { diffs: [], diffTree: {} };
        for (let key of Object.keys(results)) {
            const { diffs, diff, diffTree, parentMeta } = results[key];
            if (diff && diff.action !== constants_1.DiffAction.test) {
                const { path } = diff, rest = __rest(diff, ["path"]);
                const i = path[path.length - 1];
                this.setMeta(res.diffTree, i, rest);
                res.diffs.push(diff);
                if (array && !this.arrayMeta) {
                    if (res.parentMeta === undefined) {
                        res.parentMeta = {};
                    }
                    res.parentMeta[i] = this.formatMergedMeta(diff);
                }
                else {
                    if (diff.action === constants_1.DiffAction.rename) {
                        this.setMeta(merged, diff.after, this.formatMergedMeta(diff));
                    }
                    else {
                        this.setMeta(merged, i, this.formatMergedMeta(diff));
                    }
                }
                if (i !== (array ? +key : key)) {
                    continue;
                }
            }
            else {
                if (diffs.length) {
                    res.diffTree[key] = diffTree;
                    res.diffs.push(...diffs);
                }
                if (parentMeta) {
                    this.setMeta(merged, array ? +key : key, { array: parentMeta });
                }
            }
        }
        return res;
    }
    mergeValue({ action, before, after }) {
        return (action === constants_1.DiffAction.test || action === constants_1.DiffAction.remove) ? before : after;
    }
    compareResult(diff) {
        const res = diff.action === constants_1.DiffAction.test
            ? { diffs: [], diff }
            : { diffs: [diff], diff };
        return res;
    }
    compareAny(before, after, path = new utils_1.PathPointer(), merged = this._merged, key = "value") {
        if ((0, utils_1.typeOf)(before) !== (0, utils_1.typeOf)(after)) {
            merged[key] = after;
            return this.compareResult((0, utils_1.replaced)(path, before, after));
        }
        switch ((0, utils_1.typeOf)(before)) {
            case "object":
                merged[key] = {};
                return this.compareObjects(before, after, path, merged[key]);
            case "array":
                merged[key] = [];
                return this.compareArrays(before, after, path, merged[key]);
            default:
                const equal = typeof before === "string"
                    ? this.normalizeString(before) === this.normalizeString(after)
                    : before === after;
                const diff = equal ? (0, utils_1.unchanged)(path, before) : (0, utils_1.replaced)(path, before, after);
                merged[key] = this.mergeValue(diff);
                return this.compareResult(diff);
        }
    }
    compareObjects(before, after, path, merged) {
        const result = {};
        if ((0, utils_1.isEmptyObject)(before) && (0, utils_1.isEmptyObject)(after)) {
            return this.compareResult((0, utils_1.unchanged)(path, before));
        }
        const beforeKeys = Object.keys(before);
        const afterKeys = new Set(Object.keys(after));
        for (const key of beforeKeys) {
            const afterKey = [...afterKeys].find((k) => k === key || (this.checkMatch(path, before, after, key, k)));
            // renamed key 
            if (afterKey && afterKey !== key) {
                result[afterKey] = this.compareResult((0, utils_1.renamed)(path, key, afterKey));
            }
            if (afterKey === undefined) {
                // deleted key
                const diff = (0, utils_1.removed)(path.childPath(key), before[key]);
                merged[key] = this.mergeValue(diff);
                result[key] = this.compareResult(diff);
            }
            else {
                // updated key value
                result[key] = this.compareAny(before[key], after[afterKey], path.childPath(key), merged, afterKey);
                afterKeys.delete(afterKey);
            }
        }
        for (const key of afterKeys) {
            // added key
            const diff = (0, utils_1.added)(path.childPath(key), after[key]);
            merged[key] = this.mergeValue(diff);
            result[key] = this.compareResult(diff);
        }
        return this.mergeResults(result, merged);
    }
    compareArrays(before, after, path, merged) {
        if (before.length === 0 && after.length === 0) {
            return this.compareResult((0, utils_1.unchanged)(path, before));
        }
        const matchFunc = this.getMatchFunc(path);
        if (!this.strictArrays && !matchFunc) {
            return this.compareEnums(before, after, path, merged);
        }
        const result = {};
        const afterKeys = new Set(after.keys());
        const removedItems = [];
        for (const i of before.keys()) {
            const itemPath = path.childPath(i);
            const j = matchFunc ? [...afterKeys].find((k) => this.checkMatch(path, before, after, i, k)) : i;
            if (j === undefined || j >= after.length) {
                const diff = (0, utils_1.removed)(itemPath, before[i]);
                removedItems.push(i);
                merged[i] = this.mergeValue(diff);
                result[i] = this.compareResult(diff);
            }
            else {
                afterKeys.delete(j);
                result[i] = this.compareAny(before[i], after[j], itemPath, merged, i);
            }
        }
        let i = before.length;
        for (const key of afterKeys) {
            if (removedItems.length) {
                // replace removed
                const index = removedItems.splice(0, 1).pop();
                const diff = result[index].diff;
                diff.action = constants_1.DiffAction.replace;
                diff.after = after[key];
                merged[index] = this.mergeValue(diff);
                result[index] = this.compareResult(diff);
            }
            else {
                const diff = (0, utils_1.added)(path.childPath(i), after[key]);
                merged[i] = this.mergeValue(diff);
                result[i++] = this.compareResult(diff);
            }
        }
        return this.mergeResults(result, merged, true);
    }
    compareEnums(before, after, path, merged) {
        const result = {};
        const itemsDiffs = [];
        const beforeDiffs = [];
        const afterEquals = new Set();
        const beforeEquals = new Set();
        for (const i of before.keys()) {
            let afterDiffs = [];
            for (const j of after.keys()) {
                if (afterEquals.has(j)) {
                    continue;
                }
                const _merged = {};
                const res = this.compareAny(before[i], after[j], path.childPath(i), _merged);
                if (!res.diffs.length) {
                    afterEquals.add(j);
                    beforeEquals.add(i);
                    afterDiffs = { value: _merged.value, res };
                    break;
                }
                afterDiffs[j] = { value: _merged.value, res, diffs: typeof before[i] === typeof after[j] ? res.diffs.length : -1 };
            }
            beforeDiffs.push(afterDiffs);
        }
        for (const i of before.keys()) {
            const itemRes = beforeDiffs[i];
            if (!Array.isArray(itemRes)) {
                // after has equal item
                itemsDiffs[i] = [];
                merged[i] = itemRes.value;
                result[i] = itemRes.res;
            }
            else {
                // find item with min diff count
                const afterIndexes = [...Array(after.length).keys()].filter((a) => { var _a; return (((_a = itemRes[a]) === null || _a === void 0 ? void 0 : _a.diffs) || 0) >= 0; });
                const minDiffs = afterIndexes.sort((a, b) => { var _a, _b; return (((_a = itemRes[a]) === null || _a === void 0 ? void 0 : _a.diffs) || 0) - (((_b = itemRes[b]) === null || _b === void 0 ? void 0 : _b.diffs) || 0); });
                for (const j of after.keys()) {
                    let minDiffIndex = minDiffs[j];
                    if (afterEquals.has(minDiffIndex)) {
                        continue;
                    }
                    for (const k of before.keys()) {
                        const minDiffRes = beforeDiffs[k];
                        if (!Array.isArray(minDiffRes) || beforeEquals.has(k)) {
                            continue;
                        }
                        if (minDiffRes[minDiffIndex] < itemRes[minDiffIndex]) {
                            minDiffIndex = -1;
                            break;
                        }
                    }
                    if (minDiffIndex >= 0) {
                        const { value, res } = itemRes[minDiffIndex];
                        merged[i] = value;
                        result[i] = res;
                        beforeEquals.add(i);
                        afterEquals.add(minDiffIndex);
                        break;
                    }
                }
                if (!beforeEquals.has(i)) {
                    const diff = (0, utils_1.removed)(path.childPath(i), before[i]);
                    merged[i] = this.mergeValue(diff);
                    result[i] = this.compareResult(diff);
                }
            }
        }
        let i = before.length;
        for (let j of after.keys()) {
            if (!afterEquals.has(j)) {
                const diff = (0, utils_1.added)(path.childPath(i), after[j]);
                merged[i] = this.mergeValue(diff);
                result[i++] = this.compareResult(diff);
            }
        }
        return this.mergeResults(result, merged, true);
    }
}
exports.JsonCompare = JsonCompare;
//# sourceMappingURL=jsonCompare.js.map