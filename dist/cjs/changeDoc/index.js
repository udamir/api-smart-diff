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
exports.changeDoc = void 0;
const utils_1 = require("../utils");
const dereference = (node, source) => {
    if (Array.isArray(node)) {
        return node.map((item) => dereference(item, source));
    }
    else if (typeof node === "object" && node) {
        const { $ref } = node, rest = __rest(node, ["$ref"]);
        if ($ref) {
            const path = $ref.split("/").slice(1);
            return Object.assign(Object.assign({}, (0, utils_1.getValueByPath)(source, path)), rest);
        }
        else {
            return node;
        }
    }
    return node;
};
const resolve = (node, key, ctx) => {
    if (!node || key === undefined) {
        return;
    }
    if (key in node) {
        return node[key];
    }
    else if ("$ref" in node) {
        return resolve(dereference(node, ctx.source), key, ctx);
    }
};
const getChangeRule = (rules, ctx, index = 0) => {
    const { node, path, parent } = ctx;
    let key = path[index];
    if (index === path.length) {
        key = "";
    }
    else if (!(`/${key}` in rules) || typeof key === "number") {
        key = "*";
    }
    // check if rules have key
    if (`/${key}` in rules) {
        const rule = rules[`/${key}`];
        if (typeof rule === "string") {
            return rule;
        }
        const _ctx = index === path.length ? ctx : Object.assign(Object.assign({}, ctx), { key: path[index], node: dereference(resolve(node, path[index], ctx), ctx.source), parent: node });
        if (typeof rule === "function") {
            const _rule = rule(_ctx);
            if (typeof _rule === "string") {
                return _rule;
            }
            else {
                return getChangeRule(_rule, _ctx, index + 1);
            }
        }
        else {
            return getChangeRule(rule, _ctx, index + 1);
        }
    }
    return "";
};
const changeDoc = (diff, before, after, rules) => {
    if (diff.path.includes("allOf") || diff.path.includes("oneOf") || diff.path.includes("anyOf")) {
        return "";
    }
    if (diff.type === "annotation" || diff.type === "unclassified") {
        return "";
    }
    const source = diff.action === "add" ? after : before;
    try {
        return getChangeRule(rules, Object.assign(Object.assign({}, diff), { node: source, source, key: "" }));
    }
    catch (error) {
        return "";
    }
};
exports.changeDoc = changeDoc;
//# sourceMappingURL=index.js.map