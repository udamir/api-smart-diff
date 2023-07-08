import { ClassifyRule } from "./rules/types"


export const DIFF_META_KEY = "$diff"

export const DiffAction = {
  add: "add",
  remove: "remove",
  replace: "replace",
  rename: "rename",
  test: "test"
} as const

export const ClassifierType = {
  breaking: "breaking",
  nonBreaking: "non-breaking",
  annotation: "annotation",
  unclassified: "unclassified",
  deprecated: "deprecated"
} as const

export const { breaking, nonBreaking, unclassified, annotation, deprecated } = ClassifierType

// predefined classifiers
export const allNonBreaking: ClassifyRule = [nonBreaking, nonBreaking, nonBreaking]
export const allBreaking: ClassifyRule = [breaking, breaking, breaking]
export const onlyAddBreaking: ClassifyRule = [breaking, nonBreaking, nonBreaking]
export const addNonBreaking: ClassifyRule = [nonBreaking, breaking, breaking]
export const allUnclassified: ClassifyRule = [unclassified, unclassified, unclassified]
export const allAnnotation: ClassifyRule = [annotation, annotation, annotation]
export const allDeprecated: ClassifyRule = [deprecated, deprecated, deprecated]
