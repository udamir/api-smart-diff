import { Classifier } from "./types"

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
export const allNonBreaking: Classifier = [nonBreaking, nonBreaking, nonBreaking]
export const allBreaking: Classifier = [breaking, breaking, breaking]
export const onlyAddBreaking: Classifier = [breaking, nonBreaking, nonBreaking]
export const addNonBreaking: Classifier = [nonBreaking, breaking, breaking]
export const allUnclassified: Classifier = [unclassified, unclassified, unclassified]
export const allAnnotation: Classifier = [annotation, annotation, annotation]
