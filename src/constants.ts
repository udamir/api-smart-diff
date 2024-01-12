import { Rule } from "./types"

export const DIFF_META_KEY = "$diff"

export enum DiffAction {
  add = "add",
  remove = "remove",
  replace = "replace",
  rename = "rename",
  test = "test"
}

export enum ClassifierType {
  breaking = "breaking",
  nonBreaking = "non-breaking",
  annotation = "annotation",
  unclassified = "unclassified",
  deprecated = "deprecated"
}

export enum JsonSchemaLocation {
  requestBody = "requestBody",
}

export const { breaking, nonBreaking, unclassified, annotation, deprecated } = ClassifierType

// predefined classifiers
export const allNonBreaking: Rule = [nonBreaking, nonBreaking, nonBreaking]
export const allBreaking: Rule = [breaking, breaking, breaking]
export const onlyAddBreaking: Rule = [breaking, nonBreaking, nonBreaking]
export const addNonBreaking: Rule = [nonBreaking, breaking, breaking]
export const allUnclassified: Rule = [unclassified, unclassified, unclassified]
export const allAnnotation: Rule = [annotation, annotation, annotation]
export const allDeprecated: Rule = [deprecated, deprecated, deprecated]
