// The public API of api-smart-diff: only the names below are exported from the package (and the `ApiSmartDiff` global
// of the browser build). Everything else in `src/` is internal and may change in any release; internal modules import
// each other directly, never through this file. The exact list is pinned by `test/core/public-api.test.ts` and
// documented in `docs/guide/api.md`.

// --- comparison ---------------------------------------------------------------------------------------------------

export { apiCompare, detectSpec } from "./api"
export { compareOpenApi } from "./openapi/openapi3.compare"
export { compareAsyncApi } from "./asyncapi/asyncapi.compare"
export { compareJsonSchema } from "./jsonSchema/jsonSchema.compare"
export { compareGraphApi } from "./graphapi/graphapi.compare"
export { UnsupportedSpecError } from "./core/errors"

// --- constants ----------------------------------------------------------------------------------------------------

export { ClassifierType, CompareScopes, DIFF_META_KEY, DiffAction } from "./core/constants"

// --- custom rules: the generic engine -----------------------------------------------------------------------------

export { compare } from "./core/compare"

// --- custom rules: built-in rule sets and description hooks -------------------------------------------------------

export { jsonSchemaRules } from "./jsonSchema/jsonSchema.rules"
export { openapi3Rules } from "./openapi/openapi3.rules"
export { openApiSchemaRules } from "./openapi/openapi3.schema"
export { asyncApi2Rules } from "./asyncapi/asyncapi2.rules"
export { asyncApi3Rules } from "./asyncapi/asyncapi3.rules"
export { graphApiRules } from "./graphapi/graphapi.rules"
export { graphApi10Rules } from "./graphapi/graphapi10.rules"

export { jsonSchemaAnnotationHook } from "./jsonSchema/jsonSchema.annotate"
export { openApi3AnnotateHook } from "./openapi/openapi3.annotate"
export { asyncApiAnnotateHook } from "./asyncapi/asyncapi.annotate"
export { graphApiAnnotateHook } from "./graphapi/graphapi.annotate"

// --- custom rules: classifier shorthands --------------------------------------------------------------------------

export {
  addNonBreaking,
  allAnnotation,
  allBreaking,
  allDeprecated,
  allNonBreaking,
  allRisky,
  allUnclassified,
  annotation,
  breaking,
  deprecated,
  nonBreaking,
  onlyAddBreaking,
  risky,
  unclassified,
} from "./core/constants"
export { nonDirectional } from "./jsonSchema/jsonSchema.classify"
export { fixed } from "./asyncapi/asyncapi.classify"

// --- custom rules: mapping resolvers ------------------------------------------------------------------------------

export {
  arrayMappingResolver,
  caseInsensitiveKeyMappingResolver,
  createKeyMappingResolver,
  objectMappingResolver,
} from "./core/mapping"
export { enumMappingResolver } from "./jsonSchema/jsonSchema.mapping"

// --- custom rules: specification extensions -----------------------------------------------------------------------

export { EXTENSION_PREFIX, excludeExtensions, extensionRule, extensionRules, isExtensionKey } from "./core/extensions"

// --- custom rules: resolvers and rule transformations -------------------------------------------------------------

export { createRefsCompareResolver } from "./jsonSchema/jsonSchema.resolver"
export { reverseClassifyRuleTransformer, transformCompareRules } from "./core/rules"

// --- types: results -----------------------------------------------------------------------------------------------

export type {
  ActionType,
  CompareError,
  CompareErrorKind,
  CompareResult,
  CompareScope,
  Diff,
  DiffMeta,
  DiffType,
  MergeArrayMeta,
  MergeMeta,
} from "./types/compare"

// --- types: options -----------------------------------------------------------------------------------------------

export type { CompareEngine, CompareEngineName, CompareOptions, SourceContext } from "./types/compare"
export type { DetectedSpec } from "./api"
export type {
  OpenApi3RulesOptions,
  OpenApi3SchemaRulesOptions,
  OpenApiCompareOptions,
  OpenApiVersion,
} from "./openapi/openapi3.types"
export type { AsyncApiCompareOptions, AsyncApiRulesOptions } from "./asyncapi/asyncapi.types"
export type {
  JsonSchemaCompareCache,
  JsonSchemaCompareOptions,
  JsonSchemaDraft,
  JsonSchemaRulesOptions,
} from "./jsonSchema/jsonSchema.types"
export type { GraphApiRulesOptions } from "./graphapi/graphapi.rules"

// --- types: custom rules ------------------------------------------------------------------------------------------

export type { AnnotateHook } from "./types/compare"
export type {
  AnnotateTemplate,
  ChangeAnnotationResolver,
  ClassifyRule,
  ClassifyTuple,
  ClassifyTuple6,
  CompareContext,
  CompareExtensionRules,
  CompareResolver,
  CompareRule,
  CompareRules,
  CompareRulesFunc,
  CompareRulesTransformer,
  CompareTransformResolver,
  DiffTypeClassifier,
  MapKeysResult,
  MappingArrayResolver,
  MappingObjectResolver,
  MappingResolver,
  NodeContext,
  RuleDiffType,
  ScopeContext,
  ScopeResolver,
  ScopedClassifyRule,
} from "./types/rules"
export type { ExtensionAnnotationResolver } from "./core/extensions"
