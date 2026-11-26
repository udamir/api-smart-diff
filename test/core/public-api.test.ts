// The package entry exports a curated API: the everyday comparison functions, the constants and result types, and the
// building blocks of custom rule sets. This test pins the exact runtime export list (a new export, or one removed, is a
// public API change that must be made on purpose and documented in docs/guide/api.md) and checks at type level that
// every public type can be imported from the entry.

import { buildFromProto } from "protoapi"

import * as api from "../../src"
import type {
  ActionType,
  AnnotateHook,
  AnnotateTemplate,
  AsyncApiCompareOptions,
  AsyncApiRulesOptions,
  ChangeAnnotationResolver,
  ClassifyRule,
  ClassifyTuple,
  ClassifyTuple6,
  CompareContext,
  CompareEngine,
  CompareEngineName,
  CompareError,
  CompareErrorKind,
  CompareExtensionRules,
  CompareOptions,
  CompareResolver,
  CompareResult,
  CompareRule,
  CompareRules,
  CompareRulesFunc,
  CompareRulesTransformer,
  CompareScope,
  CompareTransformResolver,
  DetectedSpec,
  Diff,
  DiffMeta,
  DiffType,
  DiffTypeClassifier,
  ExtensionAnnotationResolver,
  JsonSchemaCompareCache,
  JsonSchemaCompareOptions,
  JsonSchemaDraft,
  JsonSchemaRulesOptions,
  MapKeysResult,
  MappingArrayResolver,
  MappingObjectResolver,
  MappingResolver,
  MergeArrayMeta,
  MergeMeta,
  NodeContext,
  OpenApi3RulesOptions,
  OpenApi3SchemaRulesOptions,
  OpenApiCompareOptions,
  OpenApiVersion,
  ProtoApiCompareOptions,
  ProtoApiCompatibility,
  ProtoApiDocument,
  ProtoApiRulesOptions,
  RuleDiffType,
  ScopeContext,
  ScopedClassifyRule,
  ScopeResolver,
  SourceContext,
} from "../../src"

const PUBLIC_RUNTIME_EXPORTS = [
  // comparison
  "apiCompare",
  "compareAsyncApi",
  "compareGraphApi",
  "compareJsonSchema",
  "compareOpenApi",
  "compareProtoApi",
  "detectSpec",
  "UnsupportedSpecError",
  // constants
  "ClassifierType",
  "CompareScopes",
  "DIFF_META_KEY",
  "DiffAction",
  // custom rules: engine, rule sets, description hooks
  "compare",
  "asyncApi2Rules",
  "asyncApi3Rules",
  "graphApiRules",
  "jsonSchemaRules",
  "openApiSchemaRules",
  "openapi3Rules",
  "protoApiRules",
  "asyncApiAnnotateHook",
  "graphApiAnnotateHook",
  "jsonSchemaAnnotationHook",
  "openApi3AnnotateHook",
  "protoApiAnnotateHook",
  // classifier shorthands
  "addNonBreaking",
  "allAnnotation",
  "allBreaking",
  "allDeprecated",
  "allNonBreaking",
  "allRisky",
  "allUnclassified",
  "annotation",
  "breaking",
  "deprecated",
  "fixed",
  "nonBreaking",
  "nonDirectional",
  "onlyAddBreaking",
  "risky",
  "unclassified",
  // mapping resolvers
  "arrayMappingResolver",
  "caseInsensitiveKeyMappingResolver",
  "createKeyMappingResolver",
  "enumMappingResolver",
  "objectMappingResolver",
  // specification extensions
  "EXTENSION_PREFIX",
  "excludeExtensions",
  "extensionRule",
  "extensionRules",
  "isExtensionKey",
  // resolvers and rule transformations
  "createRefsCompareResolver",
  "reverseClassifyRuleTransformer",
  "transformCompareRules",
]

const sorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b))

describe("public API of the package entry", () => {
  it("API-1 exports exactly the documented runtime names", () => {
    expect(sorted(Object.keys(api))).toEqual(sorted(PUBLIC_RUNTIME_EXPORTS))
  })

  it("API-2 internal helpers are not exported", () => {
    for (const name of [
      "discoverCompareEngine",
      "compareNested",
      "openApiProfile",
      "locateOpenApiContainer",
      "locateAsyncApiContainer",
      "locateGraphApiContainer",
      "fallbackAnnotation",
      "getParentContext",
      "createRootContext",
      "invertedScopes",
      "oppositeScopes",
      "getKeyValue",
      "isObject",
      "createProtoApiAnnotateHook",
      "describeProtoDiff",
      "getProtoApiVersion",
      "locateProtoApiContainer",
      "mergeElementDiffs",
      "protoApiMatrix",
    ]) {
      expect(name in api).toBe(false)
    }
  })

  it("API-3 every public type is importable from the entry", () => {
    // compile-time check: each type is named once; the runtime assertion only keeps the block from being empty
    type PublicTypes = [
      ActionType,
      AnnotateHook,
      AnnotateTemplate,
      AsyncApiCompareOptions,
      AsyncApiRulesOptions,
      ChangeAnnotationResolver,
      ClassifyRule,
      ClassifyTuple,
      ClassifyTuple6,
      CompareContext,
      CompareEngine,
      CompareEngineName,
      CompareError,
      CompareErrorKind,
      CompareExtensionRules,
      CompareOptions,
      CompareResolver,
      CompareResult,
      CompareRule,
      CompareRules,
      CompareRulesFunc,
      CompareRulesTransformer,
      CompareScope,
      CompareTransformResolver,
      DetectedSpec,
      Diff,
      DiffMeta,
      DiffType,
      DiffTypeClassifier,
      ExtensionAnnotationResolver,
      JsonSchemaCompareCache,
      JsonSchemaCompareOptions,
      JsonSchemaDraft,
      JsonSchemaRulesOptions,
      MapKeysResult<string>,
      MappingArrayResolver,
      MappingObjectResolver,
      MappingResolver<string>,
      MergeArrayMeta,
      MergeMeta,
      NodeContext,
      OpenApi3RulesOptions,
      OpenApi3SchemaRulesOptions,
      OpenApiCompareOptions,
      OpenApiVersion,
      ProtoApiCompareOptions,
      ProtoApiCompatibility,
      ProtoApiDocument,
      ProtoApiRulesOptions,
      RuleDiffType,
      ScopeContext,
      ScopedClassifyRule,
      ScopeResolver,
      SourceContext,
    ]
    expectTypeOf<PublicTypes["length"]>().toEqualTypeOf<54>()

    // the types fit the values they describe
    const rule: CompareRule = { $: api.allBreaking, mapping: api.objectMappingResolver }
    const options: CompareOptions = { rules: { "/**": rule }, annotateHook: api.jsonSchemaAnnotationHook }
    const engine: CompareEngine = api.compare
    const draft: JsonSchemaDraft = "2020-12"
    const version: OpenApiVersion = "3.1"
    const detected: DetectedSpec = api.detectSpec({ openapi: "3.1.0" })
    expect(detected).toEqual({ engine: "openapi", version: "3.1.0" })
    expect(engine({ a: 1 }, { a: 2 }, options).diffs).toHaveLength(1)
    expect(api.jsonSchemaRules({ version: draft })).toBeTypeOf("object")
    expect(api.openapi3Rules({ version })).toBeTypeOf("object")
    const level: ProtoApiCompatibility = "WIRE"
    const protoDocument: ProtoApiDocument = { protoapi: "0.1", services: {} }
    // the document protoapi builds fits the type (its own types have no index signatures)
    const built: ProtoApiDocument = buildFromProto({
      "a.proto": 'syntax = "proto3"; package p; message M { int64 id = 1; }',
    }).document
    expect(api.compareProtoApi(built, built).diffs).toHaveLength(0)
    const protoOptions: ProtoApiCompareOptions = { compatibility: level, files: "ignore" }
    const protoRulesOptions: ProtoApiRulesOptions = { compatibility: level, optionRules: { "/acme.*": rule } }
    expect(api.compareProtoApi(protoDocument, protoDocument, protoOptions).diffs).toHaveLength(0)
    expect(api.protoApiRules(protoRulesOptions)).toBeTypeOf("object")
  })
})
