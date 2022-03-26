import { ChangeType, Classifier } from "../.."

export const breaking = "breaking"
export const nonBreaking = "non-breaking"
export const annotation = "annotation"
export const unclassified = "unclassified"

// predefined classifiers
export const allNonBreaking: Classifier = [nonBreaking, nonBreaking, nonBreaking]
export const allBreaking: Classifier = [breaking, breaking, breaking]
export const onlyAddBreaking: Classifier = [breaking, nonBreaking, nonBreaking]
export const addNonBreaking: Classifier = [nonBreaking, breaking, breaking]
export const allUnclassified: Classifier = [unclassified, unclassified, unclassified]
export const allAnnotation: Classifier = [annotation, annotation, annotation]

// helpers
export const breakingIf = (v: boolean): ChangeType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue = (_: any, a: any): ChangeType => breakingIf(a)
