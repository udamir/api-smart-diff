# API reference

The package exports the names on this page, from `api-smart-diff` (and on the `ApiSmartDiff` global of the browser build). Nothing else is part of the public API: the helpers the built-in engines are made of are internal and can change in any release.

## Comparison

### apiCompare

```ts
apiCompare(before: unknown, after: unknown, options?: CompareOptions): CompareResult
```

Detects the specification of both documents, compares them with the matching engine and classifies and describes every change. Throws `UnsupportedSpecError` for Swagger 2, OpenAPI 4+, unknown AsyncAPI / GraphApi versions and two documents of different specifications; every other problem is reported in `result.errors` or through `options.onError`. See [Usage](./usage), [Options](./options) and [Result](./result).

### compareOpenApi, compareAsyncApi, compareJsonSchema, compareGraphApi

```ts
compareOpenApi(before: unknown, after: unknown, options?: OpenApiCompareOptions, context?: SourceContext): CompareResult
compareAsyncApi(before: unknown, after: unknown, options?: AsyncApiCompareOptions, context?: SourceContext): CompareResult
compareJsonSchema(before: unknown, after: unknown, options?: JsonSchemaCompareOptions, context?: SourceContext): CompareResult
compareGraphApi(before: unknown, after: unknown, options?: CompareOptions, context?: SourceContext): CompareResult
```

The engines behind `apiCompare` — `compareOpenApi`, `compareAsyncApi`, `compareJsonSchema` and `compareGraphApi`; call one directly to skip the detection. See [Specifications and engines](./engines).

### detectSpec

```ts
detectSpec(document: unknown): DetectedSpec // { engine: CompareEngineName; version?: string }
```

The engine `apiCompare` would use for a document, and the specification version as written in it. Throws `UnsupportedSpecError` for recognized but unsupported documents.

### UnsupportedSpecError

```ts
class UnsupportedSpecError extends Error {
  name: "UnsupportedSpecError"
  readonly before?: string // the version (or engine) of the before document
  readonly after?: string // the version (or engine) of the after document
}
```

Thrown by `apiCompare`, `detectSpec` and the engines for documents they do not support.

## Constants

| Name | Value |
| --- | --- |
| `DiffAction` | `{ add, remove, replace, rename }`: the values of `Diff.action` |
| `ClassifierType` | `{ breaking, risky, nonBreaking, annotation, unclassified, deprecated }`: the values of `Diff.type` |
| `CompareScopes` | the built-in scope names (`root`, `request`, `response`, `components`, `args`, `output`, `publish`, `subscribe`, `send`, `receive`, …): the values of `Diff.scope` |
| `DIFF_META_KEY` | `"$diff"`, the default `metaKey` of the change metadata in `merged` |

## Result types

```ts
interface CompareResult {
  diffs: Diff[]
  merged: any
  rootMergeMeta?: MergeMeta
  errors?: CompareError[]
}

type Diff = {
  type: DiffType
  action: ActionType
  path: JsonPath // Array<string | number>, in the before document (after path for added nodes)
  before?: any
  after?: any
  description?: string
  scope: CompareScope
  origin?: { before: JsonPath; after: JsonPath }
}

type ActionType = "add" | "remove" | "replace" | "rename"
type DiffType = "breaking" | "risky" | "non-breaking" | "deprecated" | "annotation" | "unclassified"
type CompareScope = string // built-in names in CompareScopes

type DiffMeta = { action: ActionType; type: DiffType; replaced?: any }
type MergeMeta = DiffMeta | MergeArrayMeta
type MergeArrayMeta = { array: Record<number, MergeMeta> }

interface CompareError {
  kind: CompareErrorKind
  message: string
  path: JsonPath
  scope: CompareScope
  error?: unknown
}
type CompareErrorKind = "classify" | "annotate" | "ref" | "transform" | "mapping" | "compare"
```

See [Result](./result).

## Option types

| Type | Purpose |
| --- | --- |
| `CompareOptions` | the options of `apiCompare`, `compare` and every engine, described field by field in [Options](./options) |
| `CompareEngineName` | `"openapi" \| "asyncapi" \| "graphapi" \| "jsonschema"`: `options.engine` and `DetectedSpec.engine` |
| `DetectedSpec` | the result of `detectSpec` |
| `SourceContext` | the optional last argument of the engines: the root documents and paths of a sub-node being compared |
| `CompareEngine` | `(before, after, options?, context?) => CompareResult`, the signature of `compare` and of every engine |
| `OpenApiCompareOptions` | `CompareOptions` plus `notMergeAllOf` and `extensions` |
| `AsyncApiCompareOptions` | `CompareOptions` plus `notMergeAllOf` and `extensions` |
| `JsonSchemaCompareOptions` | `CompareOptions` plus `notMergeAllOf` and `version` (a `JsonSchemaDraft`) |
| `JsonSchemaDraft` | `"draft-04" \| "draft-06" \| "draft-07" \| "2020-12"` |
| `OpenApiVersion` | `"3.0" \| "3.1" \| "3.2"` |
| `OpenApi3RulesOptions`, `OpenApi3SchemaRulesOptions` | the options of `openapi3Rules` and `openApiSchemaRules` |
| `AsyncApiRulesOptions` | the options of `asyncApi2Rules` and `asyncApi3Rules` |
| `JsonSchemaRulesOptions` | the options of `jsonSchemaRules` |
| `GraphApiRulesOptions` | the options of `graphApiRules` |
| `JsonSchemaCompareCache` | the legacy `cache` argument of `createRefsCompareResolver` and `jsonSchemaRules` (accepted and ignored) |

## Custom rules

The building blocks for [custom rules](./custom-rules) and [specification extensions](./extensions).

### compare

```ts
compare(before: unknown, after: unknown, options?: CompareOptions, context?: SourceContext): CompareResult
```

The generic engine every specification engine delegates to: it walks both documents with `options.rules` and describes changes with `options.annotateHook`. See [Comparing your own format](./custom-rules#comparing-your-own-format).

### Rule sets

```ts
openapi3Rules(options?: OpenApi3RulesOptions): CompareRules // { version?, notMergeAllOf?, extensions? }
openApiSchemaRules(options?: OpenApi3SchemaRulesOptions): CompareRules
asyncApi2Rules(options?: AsyncApiRulesOptions): CompareRules // { notMergeAllOf?, extensions? }
asyncApi3Rules(options?: AsyncApiRulesOptions): CompareRules
jsonSchemaRules(options?: JsonSchemaRulesOptions): CompareRules // { version?, notMergeAllOf?, extensions?, baseRules? }
graphApiRules(options?: GraphApiRulesOptions): CompareRules // { notMergeAllOf? }
graphApi10Rules(): CompareRules
```

The rule trees of the built-in engines: OpenAPI 3.x (`openapi3Rules`, generated for `version`, default `"3.0"`), the OpenAPI schema object (`openApiSchemaRules`), AsyncAPI 2.x and 3.0 (`asyncApi2Rules`, `asyncApi3Rules`), JSON Schema (`jsonSchemaRules`, for a draft, default `"2020-12"`), GraphApi 0.1.2 (`graphApiRules`) and GraphApi 1.0 (`graphApi10Rules`). Spread one to change a node and keep the rest (see [Changing a built-in rule tree](./custom-rules#changing-a-built-in-rule-tree)).

### Annotate hooks

```ts
openApi3AnnotateHook: AnnotateHook
asyncApiAnnotateHook: AnnotateHook
jsonSchemaAnnotationHook: AnnotateHook
graphApiAnnotateHook: AnnotateHook
```

The description hooks of the built-in engines (`openApi3AnnotateHook`, `asyncApiAnnotateHook`, `jsonSchemaAnnotationHook`, `graphApiAnnotateHook`); call one from a custom `annotateHook` to keep the built-in descriptions for the changes you do not describe yourself (see [Custom descriptions](./descriptions#custom-descriptions)).

### Classifier shorthands

```ts
breaking, risky, nonBreaking, deprecated, annotation, unclassified: DiffType
allBreaking, allNonBreaking, allRisky, allDeprecated, allAnnotation, allUnclassified: ClassifyRule
addNonBreaking: ClassifyRule // [nonBreaking, breaking, breaking]
onlyAddBreaking: ClassifyRule // [breaking, nonBreaking, nonBreaking]
nonDirectional(tuple: ClassifyTuple): ClassifyRule // { default: tuple }
fixed(tuple: ClassifyTuple): ClassifyRule // the same as nonDirectional
```

The diff types (`breaking`, `risky`, `nonBreaking`, `deprecated`, `annotation`, `unclassified`), the tuples with the same type in every slot (`allBreaking`, `allNonBreaking`, `allRisky`, `allDeprecated`, `allAnnotation`, `allUnclassified`), the add-only tuples (`addNonBreaking`, `onlyAddBreaking`), and the builders of rules that mean the same in every scope (`nonDirectional`, `fixed`); see [Classifiers](./custom-rules#classifiers).

### Mapping resolvers

```ts
objectMappingResolver: MappingResolver<string>
arrayMappingResolver: MappingResolver<number>
caseInsensitiveKeyMappingResolver: MappingResolver<string>
createKeyMappingResolver(normalize: (key: string) => string): MappingResolver<string>
enumMappingResolver: MappingResolver<number>
```

How the keys or items of the two sides are matched: by key (`objectMappingResolver`, the default for objects), by index (`arrayMappingResolver`, the default for arrays), by key ignoring case (`caseInsensitiveKeyMappingResolver`), by a normalized key (`createKeyMappingResolver`), and array items as a set of values (`enumMappingResolver`).

### Specification extensions

```ts
EXTENSION_PREFIX: "x-"
isExtensionKey(key: unknown): boolean
extensionRule(annotate: ExtensionAnnotationResolver): CompareRules
extensionRules(annotate: ExtensionAnnotationResolver, custom?: CompareExtensionRules): CompareRules
excludeExtensions(resolver?: MappingResolver<string>): MappingResolver<string>
```

The prefix of extension keys (`EXTENSION_PREFIX`) and its test (`isExtensionKey`); the built-in rule of an `x-*` key (`extensionRule`); the `"/x-*"` rule merged with custom extension rules, to spread into an object node that allows extensions (`extensionRules`); a mapping resolver wrapper that matches `x-*` keys by name only (`excludeExtensions`). See [Specification extensions](./extensions).

### Resolvers and rule transformations

```ts
createRefsCompareResolver(cache?: JsonSchemaCompareCache): CompareResolver
transformCompareRules(rules: CompareRules, transformer: CompareRulesTransformer): CompareRules
reverseClassifyRuleTransformer: CompareRulesTransformer
```

The `$ref` resolver of the JSON Schema rules (`createRefsCompareResolver`; the argument is legacy and ignored); a copy of a rule tree with every rule node transformed (`transformCompareRules`); the transformer (`reverseClassifyRuleTransformer`) that replaces every tuple with its reversed form (the reversed slots of a 6-tuple, otherwise breaking and non-breaking swapped), which 1.x used to derive response rules from request rules (see [Legacy helpers](./custom-rules#legacy-helpers)).

### Rule types

```ts
type CompareRules = CrawlRules<CompareRule> // json-crawl rule tree, keyed by "/key", "/*", "/**", "/prefix*"
type CompareRulesFunc = CrawlRulesFunc<CompareRule> // a lazy node: ({ key, path, value }) => CompareRules
type CompareExtensionRules = { [key: `/${string}`]: CompareRules | CompareRulesFunc } // options.extensions

type CompareRule = {
  $?: ClassifyRule
  compare?: CompareResolver
  transform?: CompareTransformResolver[]
  mapping?: MappingResolver<string | number>
  annotate?: ChangeAnnotationResolver
  skip?: boolean
  scope?: CompareScope | ScopeResolver
  kind?: string
  // also: inheritUsage, unreferencedScopes, referenceRenames, impliedReferences (used by the built-in rule sets)
}

type ClassifyRule = ClassifyTuple | ClassifyTuple6 | ScopedClassifyRule
type ClassifyTuple = [add: RuleDiffType, remove: RuleDiffType, replace: RuleDiffType]
type ClassifyTuple6 = [...ClassifyTuple, reversedAdd: RuleDiffType, reversedRemove: RuleDiffType, reversedReplace: RuleDiffType]
type ScopedClassifyRule = { [scope: string]: ClassifyTuple | undefined; default?: ClassifyTuple }
type RuleDiffType = DiffType | DiffTypeClassifier
type DiffTypeClassifier = (ctx: CompareContext) => DiffType

type CompareContext = {
  before: NodeContext
  after: NodeContext
  rules: CompareRules
  options: CompareOptions
  scope: CompareScope
  session: object // per-call state of the engine ($ref resolution, caches, errors)
}
type NodeContext = { path; key; value; parent?; root; up?: NodeContext; origin?; scope?; source?; kind? }

type CompareResolver = (ctx: CompareContext) => CompareResult | undefined
type CompareTransformResolver<T = unknown> = (before: T, after: T, ctx?: CompareContext) => [T, T]
type MappingResolver<T extends string | number> = T extends string ? MappingObjectResolver : MappingArrayResolver
type MappingObjectResolver = (before: Record<string, unknown>, after: Record<string, unknown>, ctx: CompareContext) => MapKeysResult<string>
type MappingArrayResolver = (before: unknown[], after: unknown[], ctx: CompareContext) => MapKeysResult<number>
interface MapKeysResult<T extends string | number> { added: T[]; removed: T[]; mapped: Record<T, T> }
type ScopeResolver = (ctx: ScopeContext) => CompareScope
type ScopeContext = { scope: CompareScope; key: string | number; path: JsonPath; value: unknown }
type CompareRulesTransformer = (rules: CompareRules) => CompareRules

type AnnotateHook = (diff: Diff, ctx: CompareContext) => string
type ChangeAnnotationResolver = (diff: Diff, ctx: CompareContext) => AnnotateTemplate | undefined
type ExtensionAnnotationResolver = (diff: Diff, ctx: CompareContext, extension: number) => AnnotateTemplate | undefined
interface AnnotateTemplate { template: string; params?: { [key: string]: AnnotateTemplate | string | number | undefined } }
```

The types of a rule tree and of the functions it holds; [Custom rules](./custom-rules) explains each field.
