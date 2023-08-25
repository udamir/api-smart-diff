"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allDeprecated = exports.allAnnotation = exports.allUnclassified = exports.addNonBreaking = exports.onlyAddBreaking = exports.allBreaking = exports.allNonBreaking = exports.deprecated = exports.annotation = exports.unclassified = exports.nonBreaking = exports.breaking = exports.ClassifierType = exports.DiffAction = exports.DIFF_META_KEY = void 0;
exports.DIFF_META_KEY = "$diff";
var DiffAction;
(function (DiffAction) {
    DiffAction["add"] = "add";
    DiffAction["remove"] = "remove";
    DiffAction["replace"] = "replace";
    DiffAction["rename"] = "rename";
    DiffAction["test"] = "test";
})(DiffAction = exports.DiffAction || (exports.DiffAction = {}));
var ClassifierType;
(function (ClassifierType) {
    ClassifierType["breaking"] = "breaking";
    ClassifierType["nonBreaking"] = "non-breaking";
    ClassifierType["annotation"] = "annotation";
    ClassifierType["unclassified"] = "unclassified";
    ClassifierType["deprecated"] = "deprecated";
})(ClassifierType = exports.ClassifierType || (exports.ClassifierType = {}));
exports.breaking = ClassifierType.breaking, exports.nonBreaking = ClassifierType.nonBreaking, exports.unclassified = ClassifierType.unclassified, exports.annotation = ClassifierType.annotation, exports.deprecated = ClassifierType.deprecated;
// predefined classifiers
exports.allNonBreaking = [exports.nonBreaking, exports.nonBreaking, exports.nonBreaking];
exports.allBreaking = [exports.breaking, exports.breaking, exports.breaking];
exports.onlyAddBreaking = [exports.breaking, exports.nonBreaking, exports.nonBreaking];
exports.addNonBreaking = [exports.nonBreaking, exports.breaking, exports.breaking];
exports.allUnclassified = [exports.unclassified, exports.unclassified, exports.unclassified];
exports.allAnnotation = [exports.annotation, exports.annotation, exports.annotation];
exports.allDeprecated = [exports.deprecated, exports.deprecated, exports.deprecated];
//# sourceMappingURL=constants.js.map