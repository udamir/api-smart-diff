import { ClassifyRule } from "./types"

export enum ClassifyType {
  breaking = "breaking",
  nonBreaking = "non-breaking",
  annotation = "annotation",
  unclassified = "unclassified",
  deprecated = "deprecated"
}

export const { breaking, nonBreaking, unclassified, annotation, deprecated } = ClassifyType

// predefined classifiers
export const allNonBreaking: ClassifyRule = [nonBreaking, nonBreaking, nonBreaking]
export const allBreaking: ClassifyRule = [breaking, breaking, breaking]
export const onlyAddBreaking: ClassifyRule = [breaking, nonBreaking, nonBreaking]
export const addNonBreaking: ClassifyRule = [nonBreaking, breaking, breaking]
export const allUnclassified: ClassifyRule = [unclassified, unclassified, unclassified]
export const allAnnotation: ClassifyRule = [annotation, annotation, annotation]
export const allDeprecated: ClassifyRule = [deprecated, deprecated, deprecated]
