export type IJsonPath = Array<string | number>

export enum ActionType {
  add = "add",
  remove = "remove",
  replace = "replace",
}

export interface IDiff {
  action: ActionType
  path: IJsonPath
  before?: any
  after?: any
}

export interface IClassifiedDiff extends IDiff {
  type: ChangeType
}

export const breaking = "breaking"
export const nonBreaking = "non-breaking"
export const annotation = "annotation"
export const unclassified = "unclassified"

export type ChangeType = typeof breaking | typeof nonBreaking | typeof unclassified | typeof annotation 

export type AddChangeType = ChangeType | ChangeTypeFunc
export type RemoveChangeType = ChangeType | ChangeTypeFunc
export type EditChangeType = ChangeType | ChangeTypeFunc

export type ChangeTypeFunc = (before: any, after: any) => ChangeType

export type Classifier = [AddChangeType, RemoveChangeType, EditChangeType]
export type RulesRef = () => Rules

export type Rules = {
  [key: `/${string}`]: Classifier | Rules | RulesRef
} & {
  '/'?: Classifier
}

export type BaseRulesType = "OpenApi3" | "AsyncApi2" | "JsonSchema"

// predefined classifiers
export const allNonBreaking: Classifier = [nonBreaking, nonBreaking, nonBreaking]
export const allBreaking: Classifier = [breaking, breaking, breaking]
export const onlyAddBreaking: Classifier = [breaking, nonBreaking, nonBreaking]
export const addNonBreaking: Classifier = [nonBreaking, breaking, breaking]
export const allUnclassified: Classifier = [unclassified, unclassified, unclassified]
export const allAnnotation: Classifier = [annotation, annotation, annotation]

// helpers
export const breakingIf = (v: boolean): ChangeType => v ? breaking : nonBreaking
export const breakingIfAfterTrue = (_: any, a: any): ChangeType => breakingIf(a)