import type { ClassifyRule, CompareScope } from "../types"

export const DIFF_META_KEY = "$diff"

export const DiffAction = {
  add: "add",
  remove: "remove",
  replace: "replace",
  rename: "rename",
} as const

export const ClassifierType = {
  breaking: "breaking",
  // valid for most clients but can break some (decision §11.14); never inverted between directions
  risky: "risky",
  nonBreaking: "non-breaking",
  annotation: "annotation",
  unclassified: "unclassified",
  deprecated: "deprecated",
} as const

export const { breaking, risky, nonBreaking, unclassified, annotation, deprecated } = ClassifierType

// built-in compare scopes
export const CompareScopes = {
  root: "root",
  request: "request",
  response: "response",
  components: "components",
  // a component subtree read in the opposite direction of the component's usages (inside `not`, ISSUE-93)
  negatedComponents: "components-negated",
  args: "args",
  output: "output",
  publish: "publish",
  subscribe: "subscribe",
  send: "send",
  receive: "receive",
} as const

// scopes in which a plain 3-tuple classifier is read with breaking and non-breaking swapped: the produced side of
// the API (consumer viewpoint, decision §11.17 / POLICY-01): responses, GraphQL output, AsyncAPI 2.x `subscribe` and
// 3.0 `send` (the application sends, its clients read); 3.0 `receive` takes request semantics like 2.x `publish`
// (ISSUE-52 (fixed))
export const invertedScopes = new Set<CompareScope>([
  CompareScopes.response,
  CompareScopes.output,
  CompareScopes.subscribe,
  CompareScopes.send,
])

// the scope with the opposite direction (used by `not` and other inverting applicators)
export const oppositeScopes: Record<string, CompareScope> = {
  [CompareScopes.root]: CompareScopes.response,
  [CompareScopes.request]: CompareScopes.response,
  [CompareScopes.response]: CompareScopes.request,
  [CompareScopes.args]: CompareScopes.output,
  [CompareScopes.output]: CompareScopes.args,
  [CompareScopes.publish]: CompareScopes.subscribe,
  [CompareScopes.subscribe]: CompareScopes.publish,
  [CompareScopes.send]: CompareScopes.receive,
  [CompareScopes.receive]: CompareScopes.send,
  [CompareScopes.components]: CompareScopes.negatedComponents,
  [CompareScopes.negatedComponents]: CompareScopes.components,
}

/** Scopes classified by the usages of the enclosing component (decision §11.4). */
export const isComponentsScope = (scope: CompareScope | undefined): boolean =>
  scope === CompareScopes.components || scope === CompareScopes.negatedComponents

// predefined classifiers
export const allNonBreaking: ClassifyRule = [nonBreaking, nonBreaking, nonBreaking]
export const allBreaking: ClassifyRule = [breaking, breaking, breaking]
export const onlyAddBreaking: ClassifyRule = [breaking, nonBreaking, nonBreaking]
export const addNonBreaking: ClassifyRule = [nonBreaking, breaking, breaking]
export const allUnclassified: ClassifyRule = [unclassified, unclassified, unclassified]
export const allAnnotation: ClassifyRule = [annotation, annotation, annotation]
export const allDeprecated: ClassifyRule = [deprecated, deprecated, deprecated]
export const allRisky: ClassifyRule = [risky, risky, risky]
