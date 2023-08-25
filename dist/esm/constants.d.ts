import { Rule } from "./types";
export declare const DIFF_META_KEY = "$diff";
export declare enum DiffAction {
    add = "add",
    remove = "remove",
    replace = "replace",
    rename = "rename",
    test = "test"
}
export declare enum ClassifierType {
    breaking = "breaking",
    nonBreaking = "non-breaking",
    annotation = "annotation",
    unclassified = "unclassified",
    deprecated = "deprecated"
}
export declare const breaking: ClassifierType, nonBreaking: ClassifierType, unclassified: ClassifierType, annotation: ClassifierType, deprecated: ClassifierType;
export declare const allNonBreaking: Rule;
export declare const allBreaking: Rule;
export declare const onlyAddBreaking: Rule;
export declare const addNonBreaking: Rule;
export declare const allUnclassified: Rule;
export declare const allAnnotation: Rule;
export declare const allDeprecated: Rule;
