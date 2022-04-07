import { Rule } from "./types"

export const RuleMetaKey = Symbol("rule")
export const DIFF_META_KEY = "$diff"

export enum DiffAction {
  add = "add",
  remove = "remove",
  replace = "replace",
}

export enum ClassifierType {
  breaking = "breaking",
  nonBreaking = "non-breaking",
  annotation = "annotation",
  unclassified = "unclassified"
}

export const { breaking, nonBreaking, unclassified, annotation } = ClassifierType

// predefined classifiers
export const allNonBreaking: Rule = [nonBreaking, nonBreaking, nonBreaking]
export const allBreaking: Rule = [breaking, breaking, breaking]
export const onlyAddBreaking: Rule = [breaking, nonBreaking, nonBreaking]
export const addNonBreaking: Rule = [nonBreaking, breaking, breaking]
export const allUnclassified: Rule = [unclassified, unclassified, unclassified]
export const allAnnotation: Rule = [annotation, annotation, annotation]
