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
exports.apiDiffTree = exports.apiMerge = exports.apiDiff = exports.JsonCompare = exports.ApiCompare = void 0;
const apiCompare_1 = require("./apiCompare");
__exportStar(require("./rules/index"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./constants"), exports);
__exportStar(require("./utils"), exports);
__exportStar(require("./changeDoc"), exports);
__exportStar(require("./changeDoc/rules"), exports);
var apiCompare_2 = require("./apiCompare");
Object.defineProperty(exports, "ApiCompare", { enumerable: true, get: function () { return apiCompare_2.ApiCompare; } });
var jsonCompare_1 = require("./jsonCompare");
Object.defineProperty(exports, "JsonCompare", { enumerable: true, get: function () { return jsonCompare_1.JsonCompare; } });
exports.apiDiff = apiCompare_1.ApiCompare.apiDiff;
exports.apiMerge = apiCompare_1.ApiCompare.apiMerge;
exports.apiDiffTree = apiCompare_1.ApiCompare.apiDiffTree;
//# sourceMappingURL=index.js.map