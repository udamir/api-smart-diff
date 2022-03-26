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

export type ChangeType = "breaking" | "non-breaking" | "annotation" | "unclassified"

export type AddChangeType = ChangeType | ChangeTypeFunc
export type RemoveChangeType = ChangeType | ChangeTypeFunc
export type EditChangeType = ChangeType | ChangeTypeFunc

export type ChangeTypeFunc = (before: any, after: any) => ChangeType

export type Classifier = [AddChangeType, RemoveChangeType, EditChangeType]
export type RulesRef = () => Rules

export type Rules = {
  [key: `/${string}`]: Classifier | Rules | RulesRef
} & {
  "/"?: Classifier
}

export type BaseRulesType = "OpenApi3" | "AsyncApi2" | "JsonSchema"
