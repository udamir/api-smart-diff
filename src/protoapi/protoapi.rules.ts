import {
  allAnnotation,
  allDeprecated,
  allUnclassified,
  breaking,
  risky,
  unclassified,
  CompareScopes,
  deepEqualsUniqueItemsMappingResolver,
  excludeExtensions,
  extensionChangeAnnotation,
  extensionRules,
  keepOriginalMerged,
  mergeExtensionRules,
} from "../core"
import {
  booleanClassifier,
  constraintGeneralizationClassifyRule,
  constraintValueClassifyRule,
  countMaxClassifier,
  createFields,
  enumItemClassifyRule,
  enumKeywordClassifyRule,
  enumMappingResolver,
  exposedOnly,
  maxClassifier,
  minClassifier,
  nonDirectional,
  typeClassifier,
  valueCompareResolver,
} from "../jsonSchema"
import type {
  ClassifyRule,
  CompareExtensionRules,
  CompareResolver,
  CompareRule,
  CompareRules,
  DiffType,
  DiffTypeClassifier,
  NodeContext,
} from "../types"
import { deepCopy, getKeyValue, isObject } from "../utils"
import {
  defaultClassifier,
  defaultVisibilityClassifier,
  enumValueRecordClassifier,
  fieldRecordClassifier,
  fieldRenameClassifier,
  fieldShapeClassifier,
  httpBindingClassifier,
  idempotencyClassifier,
  immutableFlagRule,
  int64BoundClassifyRule,
  int64MultipleOfClassifier,
  jsonNameClassifier,
  languageOptionRule,
  levelCell,
  methodMessageClassifier,
  oneofMembershipClassifier,
  presenceClassifier,
  protoFormatGeneralizationClassifyRule,
  scalarTypeClassifier,
  readOnlyFlagRule,
  repeatedValueCompare,
  protoRequiredFlagClassifyRule,
  reservedNameAdded,
  reservedNameRemovedClassifier,
  reservedNumbersRemovedClassifier,
  visibilityClassifier,
  writeOnlyFlagRule,
} from "./protoapi.classify"
import {
  declarationMappingResolver,
  enumValueMappingResolver,
  extensionMappingResolver,
  fieldNumberMappingResolver,
  fileMappingResolver,
  oneofMappingResolver,
  rangeOptionsMappingResolver,
} from "./protoapi.mapping"
import {
  httpBindingCompareResolver,
  methodMessageCompareResolver,
  rangeCoverageCompareResolver,
} from "./protoapi.resolver"
import {
  extensionRangeTransform,
  extensionRenameTransform,
  fieldShapeTransform,
  messageSetMaxTransform,
  fileRenameTransform,
  groupRenameTransform,
  boundPairTransform,
  importFlagsTransform,
  liftedSourceFoldTransform,
  numericSpellingTransform,
  oneofEntryTransform,
  oneofPresenceTransform,
  packageRenameTransform,
  renameCascadeTransform,
} from "./protoapi.transform"
import {
  PROTOAPI_DEFAULT_COMPATIBILITY,
  PROTOAPI_GOOGLE_API_PREFIX,
  protoApiAnnotationOptions,
  protoApiComponentKinds,
  protoApiEnumFields,
  protoApiFileFields,
  protoApiGoogleApiExceptions,
  protoApiKnownFeatures,
  protoApiLanguageFeatures,
  protoApiLanguageOptionKeys,
  protoApiMessageFields,
  type ProtoApiMatrixRow,
  protoApiReservedFields,
  protoApiRootFields,
} from "./protoapi.const"
import type { ProtoApiCompatibility, ProtoApiRulesOptions } from "./protoapi.types"

// Rule tree of ProtoApi 0.1 documents (PROTOAPI_DESIGN §4.3 … §4.5). The tree does not use `jsonSchemaRules`
// (DG-01): references are nominal and compared as strings, never expanded; a change inside a message is reported once,
// at the component, and classified through the usage index (R11, §4.4).
//
// Q1 skeleton: containers, scopes, element add / remove rows, annotation and deprecation keywords, `file` keywords,
// the `options` node with `optionRules`, `x-*` keys. Q2: pairing resolvers (§4.6), compare resolvers of values
// compared as a whole (S5, S6, Q12), the shadow transforms (§4.7) and the implied extension references (§4.4). Q3: the
// classification matrix §6.1 … §6.7 at the four levels, every cell read from `protoApiMatrix`, with the built-in
// options of §4.10 (the R-G and googleapis family, L-1 … L-4). The keyword rows of §6.8 and descriptions are Q4; until
// then keys without a rule are unclassified (D-3).

// a structural rule keeps its meaning in every scope (AD-05): a removed field is breaking in a response too
const fixed = (tuple: [DiffType | DiffTypeClassifier, DiffType | DiffTypeClassifier, DiffType | DiffTypeClassifier]) =>
  nonDirectional(tuple)

// the cell of a matrix row for a level (columns FILE, PACKAGE, WIRE_JSON, WIRE), resolved when the tree is built (§4.5)
const cell = (compatibility: ProtoApiCompatibility, row: ProtoApiMatrixRow): DiffType => levelCell(compatibility, row)

const annotationTree: CompareRules = { $: allAnnotation, "/**": { $: allAnnotation } }
const deprecationTree: CompareRules = { $: allDeprecated, "/**": { $: allDeprecated } }
const unclassifiedTree: CompareRules = { $: allUnclassified, "/**": { $: allUnclassified } }

// an option value: a repeated value (an array at any depth) is compared as one value (PD-26, ISSUE-375), so a changed
// list is one record
const optionTree = (classify: ClassifyRule): CompareRules => ({
  $: classify,
  compare: repeatedValueCompare,
  "/**": { $: classify, compare: repeatedValueCompare },
})
const unknownOptionTree = optionTree(allUnclassified)
const annotationOptionTree = optionTree(allAnnotation)

// a custom option rule of `optionRules` compares a repeated value as one value too (ISSUE-375), unless it sets its own
// `compare`
const withRepeatedValues = (rules: CompareRules): CompareRules => {
  const result: Record<string, unknown> = { ...rules }
  for (const key of Object.keys(result)) {
    const rule = result[key]
    if (key.startsWith("/") && isObject(rule) && !Array.isArray(rule) && !("compare" in rule)) {
      result[key] = { ...rule, compare: repeatedValueCompare }
    }
  }
  return result as CompareRules
}

// §6.8 (K-1 … K-13, K-18): the validator keywords of one scalar position (the field, `items`, `propertyNames`,
// `additionalProperties`), JSON Schema rows that invert in the response scope (request / response cells), wrapped by
// `exposedOnly` (a breaking or risky change inside a field hidden in the direction reads non-breaking) and by
// `scalarTypeClassifier` (a validator of another scalar type is an annotation, POLICY-10); 64-bit bounds and steps through the
// BigInt wrappers (S3)
const x6 = exposedOnly
const minBound: CompareRules = { $: x6(scalarTypeClassifier("number", int64BoundClassifyRule("min"))) }
const maxBound: CompareRules = { $: x6(scalarTypeClassifier("number", int64BoundClassifyRule("max"))) }
const positionKeywordRules: CompareRules = {
  "/minimum": minBound,
  "/exclusiveMinimum": minBound,
  "/maximum": maxBound,
  "/exclusiveMaximum": maxBound,
  "/multipleOf": { $: x6(scalarTypeClassifier("number", int64MultipleOfClassifier)) },
  "/minLength": { $: x6(scalarTypeClassifier("string", minClassifier)) },
  "/maxLength": { $: x6(scalarTypeClassifier("string", maxClassifier)) },
  "/pattern": { $: x6(scalarTypeClassifier("string", constraintGeneralizationClassifyRule)) },
  "/format": { $: x6(protoFormatGeneralizationClassifyRule) },
  "/enum": {
    $: x6(enumKeywordClassifyRule),
    mapping: enumMappingResolver,
    "/*": { $: x6(enumItemClassifyRule), compare: valueCompareResolver },
  },
  "/const": { $: x6(constraintValueClassifyRule), compare: valueCompareResolver },
  // K-18: examples and the documented default are annotations; an aggregate value (a message example or default) is
  // one value
  "/examples": { $: allAnnotation, "/*": { $: allAnnotation, compare: valueCompareResolver } },
  "/x-default": { $: allAnnotation, compare: valueCompareResolver },
}

// the keywords of the field itself (K-6 … K-8, K-14 … K-17): item and entry counts, unique elements, the required
// constraint (S1) and the field behaviours of AIP-203 (PD-12, scoped cells, not inverted)
const fieldOnlyKeywordRules: CompareRules = {
  "/minItems": { $: x6(typeClassifier("array", minClassifier)) },
  "/maxItems": { $: x6(typeClassifier("array", countMaxClassifier("array"))) },
  "/uniqueItems": { $: x6(typeClassifier("array", booleanClassifier)) },
  "/minProperties": { $: x6(typeClassifier("object", minClassifier)) },
  "/maxProperties": { $: x6(typeClassifier("object", countMaxClassifier("object"))) },
  "/required": { $: x6(protoRequiredFlagClassifyRule) },
  "/readOnly": { $: readOnlyFlagRule },
  "/writeOnly": { $: writeOnlyFlagRule },
  "/immutable": { $: immutableFlagRule },
}

// a file entry marked `bundled` (U3): a file of protoapi's bundle that contributes referenced declarations only
const isBundledFile = (value: unknown): boolean => getKeyValue(value, "bundled") === true

// a declaration of a bundled file (U3): its `file` keyword names a file marked `bundled` in the same document
const isBundledDeclaration = (node: NodeContext): boolean => {
  const file = getKeyValue(node.value, "file")
  if (typeof file !== "string") {
    return false
  }
  const files = getKeyValue(node.root, "files")
  return isObject(files) && isBundledFile(getKeyValue(files, file))
}

// add / remove of a declaration: bundled declarations appearing or disappearing are annotations (U3); `renamed` is the
// class of a rename diff (the replace slot, DG-03), where the container pairs renamed entries
const declarationRule = (
  added: DiffType,
  removed: DiffType,
  renamed: DiffType | DiffTypeClassifier,
  bundled: DiffType,
): ClassifyRule =>
  fixed([
    ({ after }) => (isBundledDeclaration(after) ? bundled : added),
    ({ before }) => (isBundledDeclaration(before) ? bundled : removed),
    renamed,
  ])

// a value whose changes are carried by another record (the range of an extension range's options: the coverage record,
// POLICY-136): no diff, the after value merged
const noDiffCompare: CompareResolver = (ctx) => ({
  diffs: [],
  merged: deepCopy(ctx.after.source !== undefined ? ctx.after.source : ctx.after.value),
})

// §4.4: an extension names its extendee by full name, not by `$ref`; the implied reference makes the extension a user
// of its extendee (with `inheritUsage` on `extendee`, the extension inherits the extendee's usage scopes)
const impliedExtendeeReferences: CompareRule["impliedReferences"] = (root) => {
  const extensions = getKeyValue(root, "components", "extensions")
  if (!isObject(extensions)) {
    return []
  }
  const result: { path: (string | number)[]; ref: string }[] = []
  for (const key of Object.keys(extensions)) {
    const extendee = getKeyValue(extensions[key], "extendee")
    if (typeof extendee === "string") {
      result.push({ path: ["components", "extensions", key, "extendee"], ref: `#/components/messages/${extendee}` })
    }
  }
  return result
}

// the built-in options of every element (§4.10, §6): keys without parentheses, exact keys winning over prefixes; the
// R-G language options and the googleapis options share the generic `languageOptionRule` (L-1 … L-4)
const builtInOptionRules = (compatibility: ProtoApiCompatibility): CompareRules => {
  const at = (row: ProtoApiMatrixRow) => cell(compatibility, row)
  const all = (row: ProtoApiMatrixRow): CompareRules => {
    const type = at(row)
    const rule = fixed([type, type, type])
    return { $: rule, "/**": { $: rule } }
  }
  const rules: Record<string, CompareRules> = {}
  for (const key of protoApiLanguageOptionKeys) {
    const row = key === "ctype" || key === "jstype" ? "L-2" : key.startsWith("features.") ? "L-3" : "L-1"
    rules[`/${key}`] = languageOptionRule(compatibility, row)
  }
  // googleapis options (PD-13, PD-26): the prefix, except the keys lifted into keywords
  rules[`/${PROTOAPI_GOOGLE_API_PREFIX}*`] = languageOptionRule(compatibility, "L-4")
  for (const key of protoApiGoogleApiExceptions) {
    rules[`/${key}`] = unknownOptionTree
  }
  // options without an API or wire effect, and the remainders of lifted options (F-42, F-43, V-9, E-6, M-26, R-16)
  for (const key of protoApiAnnotationOptions) {
    rules[`/${key}`] = annotationOptionTree
  }
  // file deprecation (P-12; other elements carry `deprecation`)
  rules["/deprecated"] = deprecationTree
  // M-23: the wire format of a message set
  rules["/message_set_wire_format"] = all("M-23")
  // M-24 / M-25 (U1 G0): the standard descriptor accessor removed is build-only, restored non-breaking F / P
  const accessorRemoved = at("M-24")
  const accessorRestored = at("M-25")
  rules["/no_standard_descriptor_accessor"] = {
    $: fixed([
      ({ after }) => (after.value === false ? accessorRestored : accessorRemoved),
      ({ before }) => (before.value === false ? accessorRemoved : accessorRestored),
      ({ after }) => (after.value === false ? accessorRestored : accessorRemoved),
    ]),
  }
  // F-38 (U1 G0): the targets of an option definition
  rules["/targets"] = { ...all("F-38"), compare: valueCompareResolver }
  // M-19, M-20, E-10 (C6): visibility by its effective value
  const visibility = visibilityClassifier(compatibility)
  rules["/visibility"] = { $: fixed([visibility, visibility, visibility]) }
  // features (rule D): the language-independent features are annotations (P-14, F-42), their effects arrive on the
  // elements as resolved keywords (A4); `default_symbol_visibility` by the effective visibility (P-15, C6); the
  // language feature sets are R-G options (L-3); unknown features unclassified (C7)
  const features: CompareRules = {
    $: allUnclassified,
    transform: [createFields(...protoApiLanguageFeatures)],
    "/*": unclassifiedTree,
  }
  for (const feature of protoApiKnownFeatures) {
    features[`/${feature}`] = annotationTree
  }
  const defaultVisibility = defaultVisibilityClassifier(compatibility)
  features["/default_symbol_visibility"] = { $: fixed([defaultVisibility, defaultVisibility, defaultVisibility]) }
  for (const feature of protoApiLanguageFeatures) {
    features[`/${feature}`] = { ...languageOptionRule(compatibility, "L-3"), $: allUnclassified }
  }
  rules["/features"] = features
  return rules
}

export const protoApiRules = (options: ProtoApiRulesOptions = {}): CompareRules => {
  const compatibility = options.compatibility ?? PROTOAPI_DEFAULT_COMPATIBILITY
  const ignoreFiles = options.files === "ignore"
  const at = (row: ProtoApiMatrixRow) => cell(compatibility, row)
  const fixedRow = (row: ProtoApiMatrixRow): ClassifyRule => {
    const type = at(row)
    return fixed([type, type, type])
  }

  // `x-*` keys of an element (`x-default`, `x-annotation-conflicts`, hand-made extensions): annotations (§4.3)
  const x = extensionRules(extensionChangeAnnotation(), options.extensions)

  // options of an element (§4.10): the built-in options of §6, then `optionRules` merged key-wise over them (an exact
  // user key overrides a built-in key, a shorter user prefix never shadows a longer built-in one); unknown and custom
  // options are unclassified (C3, C7). Option keys are written without parentheses, so custom keys are plain
  // (`"/mycompany.audit"`) or prefix (`"/mycompany.*"`) rule keys. `features` always exists on both sides, so every
  // feature is a record of its own
  const optionsRules: CompareRules = {
    $: allUnclassified,
    transform: [createFields("features")],
    "/*": unknownOptionTree,
    ...(mergeExtensionRules(
      builtInOptionRules(compatibility) as CompareExtensionRules,
      options.optionRules
        ? (withRepeatedValues(options.optionRules as CompareRules) as CompareExtensionRules)
        : undefined,
    ) as CompareRules),
  }

  // keywords every element shares (§6.8): title and description are annotations, a deprecation is `deprecated`. The
  // `options` object of an element always exists on both sides (`createFields("options")` in the element's
  // transforms), so every option is a record of its own (R-G)
  const elementKeywords: CompareRules = {
    "/title": { $: allAnnotation },
    "/description": { $: allAnnotation },
    "/deprecation": deprecationTree,
    "/options": optionsRules,
    "/**": { $: allUnclassified },
    ...x,
  }
  const withOptions = createFields("options")

  // the declaring file of a service or component (P-18): a move is build-only, risky in FILE, annotation otherwise;
  // annotation with `files: "ignore"` (P-19)
  const fileKeyword: CompareRules = {
    $: ignoreFiles ? allAnnotation : fixed([unclassified, unclassified, at("P-18")]),
  }

  // §6.1: a file added (P-1) or removed (P-2); bundled files are annotations (U3); everything is an annotation with
  // `files: "ignore"` except the package (P-19, PD-21)
  const packageRule: CompareRules = { $: fixedRow("P-5") }
  // P-6 … P-9 (POLICY-137): a plain import added or removed is an annotation; with its modifier folded into it, an
  // `import public` added is non-breaking F/P (P-8) and removed risky F/P (P-7), other modifiers annotations (P-9)
  const publicAdded = at("P-8")
  const publicRemoved = at("P-7")
  const otherModifier = at("P-9")
  const importFlag = (side: NodeContext): unknown =>
    getKeyValue(side.up?.up?.source ?? side.up?.up?.value, "importFlags", String(side.value))
  const importRule = fixed([
    ({ after }) => (importFlag(after) === "public" ? publicAdded : at("P-6")),
    ({ before }) => (importFlag(before) === "public" ? publicRemoved : at("P-6")),
    at("P-6"),
  ])
  // P-7 … P-9: the modifier of an import that stays: `public` removed or replaced by another modifier (P-7), added
  // (P-8), `weak` / `option` (P-9)
  const importFlagRule = fixed([
    ({ after }) => (after.value === "public" ? publicAdded : otherModifier),
    ({ before }) => (before.value === "public" ? publicRemoved : otherModifier),
    ({ before, after }) =>
      before.value === "public" ? publicRemoved : after.value === "public" ? publicAdded : otherModifier,
  ])
  const fileRules: CompareRules = ignoreFiles
    ? { ...annotationTree, "/package": packageRule }
    : {
        $: fixed([
          ({ after }) => (isBundledFile(after.value) ? at("U3") : at("P-1")),
          ({ before }) => (isBundledFile(before.value) ? at("U3") : at("P-2")),
          // a file renamed with unchanged content (P-20, A5): one rename record, build-only
          at("P-20"),
        ]),
        // an import added or removed with its modifier is one record (POLICY-137)
        transform: [createFields(...protoApiFileFields), importFlagsTransform],
        "/bundled": { $: fixedRow("P-3") },
        // P-4 (U1): the runtime effects arrive as resolved keywords, one merged record per affected element (A4)
        "/syntax": { $: fixedRow("P-4") },
        "/package": packageRule,
        // plain imports are annotations, compared as a set (P-6)
        "/imports": { mapping: deepEqualsUniqueItemsMappingResolver, "/*": { $: importRule } },
        "/importFlags": { "/*": { $: importFlagRule } },
        "/description": { $: fixedRow("P-10") },
        "/options": optionsRules,
        "/**": { $: allUnclassified },
      }

  // §6.2: one side of an rpc; the scope makes the usage index record the referenced message in the request or
  // response scope (§4.4). Each side is compared as one value (S5, `methodMessageCompareResolver`): a retarget is
  // risky (TC-2, R-3 / R-4), a streaming toggle breaking (R-5 / R-6), one record per side; the `schema.$ref` child
  // keeps its rule for the usage index
  const methodSide = (scope: string): CompareRules => ({
    scope,
    compare: methodMessageCompareResolver,
    $: fixed([breaking, breaking, methodMessageClassifier]),
    "/schema": {
      $: fixed([breaking, breaking, breaking]),
      "/$ref": { $: fixed([risky, risky, risky]) },
    },
    "/stream": { $: fixed([breaking, breaking, breaking]) },
    "/**": { $: allUnclassified },
  })

  // R-9 … R-13, R-19 (PD-2): HTTP/JSON transcoding clients are JSON clients, WIRE is annotation; each binding is one
  // value (S6), additional bindings pair by method + path, then by position (S7)
  const httpRules: CompareRules = {
    compare: httpBindingCompareResolver,
    $: httpBindingClassifier(compatibility, true),
    "/additionalBindings": { "/*": { $: httpBindingClassifier(compatibility, false) } },
    "/**": { $: allUnclassified },
  }

  const idempotency = idempotencyClassifier(compatibility)
  const methodRules: CompareRules = {
    ...elementKeywords,
    // an rpc added is non-breaking (R-1), removed breaking at every level (R-2, PD-1)
    $: fixed([at("R-1"), at("R-2"), unclassified]),
    transform: [withOptions, liftedSourceFoldTransform],
    "/request": methodSide(CompareScopes.request),
    "/response": methodSide(CompareScopes.response),
    // R-7 / R-8 (G5)
    "/idempotency": { $: fixed([idempotency, idempotency, idempotency]) },
    "/http": httpRules,
  }

  const serviceRules: CompareRules = {
    ...elementKeywords,
    // a service added is non-breaking (S-1), removed breaking at every level (S-2, PD-1)
    $: fixed([at("S-1"), at("S-2"), unclassified]),
    transform: [createFields("methods", "options"), liftedSourceFoldTransform],
    "/file": fileKeyword,
    "/methods": { "/*": methodRules },
  }

  // a scalar position inside a field (`items`, `propertyNames`, `additionalProperties`): its shape keys are folded
  // into the field's carrier (DG-01); `utf8Validation` is F-36; the validator keywords are Q4 (§6.8)
  const utf8Validation: CompareRules = { $: fixedRow("F-36") }
  const innerPosition: CompareRules = {
    ...positionKeywordRules,
    "/utf8Validation": utf8Validation,
    "/**": { $: allUnclassified },
    ...x,
  }

  // the keywords of a field and of the field-shaped body of an extension (§6.4, X-5)
  const shape = fieldShapeClassifier(compatibility)
  const presence = presenceClassifier(compatibility)
  const jsonName = jsonNameClassifier(compatibility)
  const defaultValue = defaultClassifier(compatibility)
  const fieldKeywords: CompareRules = {
    // F-11 … F-21: the shape carrier of `fieldShapeTransform`, by the type and cardinality groups (§5.3)
    "/type": { $: fixed([shape, shape, shape]) },
    "/$ref": { $: fixed([shape, shape, shape]) },
    "/delimited": { $: fixedRow("F-22") },
    "/presence": { $: fixed([presence, presence, presence]) },
    "/jsonName": { $: fixed([jsonName, jsonName, jsonName]) },
    "/default": { $: fixed([defaultValue, defaultValue, defaultValue]) },
    "/packed": { $: fixedRow("F-35") },
    "/utf8Validation": utf8Validation,
    ...positionKeywordRules,
    ...fieldOnlyKeywordRules,
    "/items": innerPosition,
    "/propertyNames": innerPosition,
    "/additionalProperties": innerPosition,
  }

  // §6.4: a field. The shape is one value (`fieldShapeTransform`, DG-01); a field joining or leaving a oneof keeps its
  // presence (`oneofPresenceTransform`, DG-23)
  const fieldRenamed = fieldRenameClassifier(at("F-8"), at("F-9"))
  const fieldRules: CompareRules = {
    ...elementKeywords,
    // added F-1, F-2, F-46; removed F-3 … F-7, F-47 (S1, PD-3, PD-28); renamed with the same number (the replace slot,
    // DG-03): F-8 / F-9 by the effective JSON names (U2, PD-10)
    $: fieldRecordClassifier(compatibility, fieldRenamed),
    transform: [
      withOptions,
      fieldShapeTransform,
      oneofPresenceTransform,
      numericSpellingTransform,
      boundPairTransform,
      liftedSourceFoldTransform,
    ],
    ...fieldKeywords,
    "/oneof": { $: fixed(oneofMembershipClassifier(compatibility)) },
  }

  // components are classified in the scopes of their usages, the most severe class winning; a component nothing
  // references is classified as used both ways (§4.4, as POLICY-02 does for GraphQL)
  const componentRules = (added: ProtoApiMatrixRow, removed: ProtoApiMatrixRow, rules: CompareRules): CompareRules => ({
    ...elementKeywords,
    scope: CompareScopes.components,
    unreferencedScopes: [CompareScopes.request, CompareScopes.response],
    // a message, enum or extension added is non-breaking (M-1, E-1, X-1), removed risky at every level (M-2, E-2, X-2,
    // G1, PD-5); bundled declarations are annotations (U3)
    $: declarationRule(at(added), at(removed), unclassified, at("U3")),
    "/file": fileKeyword,
    ...rules,
  })

  // reserved numbers and names (Q12, PD-4, PD-29): numbers compared by coverage, names as a set; coverage gained and
  // names added are non-breaking (names: annotation in WIRE), lost coverage and removed names breaking when the after
  // element reuses them, else risky
  const wire = compatibility === "WIRE"
  const reservedRules: CompareRules = {
    transform: [createFields(...protoApiReservedFields)],
    "/numbers": {
      compare: rangeCoverageCompareResolver,
      "/*": { $: fixed([at("M-11"), reservedNumbersRemovedClassifier, unclassified]) },
    },
    "/names": {
      mapping: deepEqualsUniqueItemsMappingResolver,
      "/*": { $: fixed([reservedNameAdded(wire), reservedNameRemovedClassifier(wire), unclassified]) },
    },
  }

  // M-15 / M-16 (PD-15): extension range coverage gained is non-breaking, lost build-only
  const extensionRanges: CompareRules = {
    compare: rangeCoverageCompareResolver,
    "/*": { $: fixed([at("M-16"), at("M-15"), unclassified]) },
  }

  // the options of an extension range, paired by range (POLICY-136); the range itself is the coverage record's
  const rangeOptionsChanged = at("M-17")
  const extensionRangeOptions: CompareRules = {
    mapping: rangeOptionsMappingResolver,
    "/*": {
      // the options of a range added to or removed from a range that stays (M-17, U1 G0)
      $: fixed([rangeOptionsChanged, rangeOptionsChanged, rangeOptionsChanged]),
      transform: [withOptions],
      "/range": { compare: noDiffCompare },
      "/options": {
        ...optionsRules,
        // M-17 (U1 G0)
        "/verification": { $: fixedRow("M-17") },
      },
      "/**": { $: allUnclassified },
    },
  }

  // M-18 (PD-15): extension declarations of a range (`options.extension_declarations["<lo>-<hi>"]`), paired by number
  const declarationChanged = at("M-18.change")
  const declarationRules: CompareRules = {
    $: fixed([at("M-18.add"), declarationChanged, declarationChanged]),
    "/**": { $: fixed([declarationChanged, declarationChanged, declarationChanged]) },
  }
  const messageOptions: CompareRules = {
    ...optionsRules,
    // declarations are paired by number, so the repeated-value comparison of options (ISSUE-375) does not apply
    "/extension_declarations": {
      compare: undefined,
      "/*": {
        compare: undefined,
        mapping: declarationMappingResolver,
        "/*": { ...declarationRules, compare: undefined },
      },
    },
  }

  // M-5 … M-8 (S8, G3): a oneof added is non-breaking, removed or renamed with the same members build-only
  const oneofRules: CompareRules = {
    ...elementKeywords,
    $: fixed([at("M-5"), at("M-6"), at("M-7")]),
    transform: [withOptions, liftedSourceFoldTransform],
  }

  // M-21 / M-22, E-9 (C7): the legacy JSON format added is build-only, removed non-breaking
  const jsonFormatAdded = at("M-21")
  const jsonFormatRule: CompareRules = { $: fixed([jsonFormatAdded, at("M-22"), jsonFormatAdded]) }

  const messageRules = componentRules("M-1", "M-2", {
    // the oneof and field renames cascade (G3, S9), bare oneof entries follow their members (S8), the options of an
    // extension range follow the range (POLICY-136)
    transform: [
      createFields(...protoApiMessageFields, "options"),
      renameCascadeTransform,
      oneofEntryTransform,
      messageSetMaxTransform,
      extensionRangeTransform,
      liftedSourceFoldTransform,
    ],
    // fields pair by number (R4); `x-*` keys of a hand-made document pair by name and are annotations
    "/properties": { mapping: excludeExtensions(fieldNumberMappingResolver), "/*": fieldRules, ...x },
    "/oneofs": { mapping: oneofMappingResolver, "/*": oneofRules },
    "/reserved": reservedRules,
    "/extensions": extensionRanges,
    "/extensionOptions": extensionRangeOptions,
    "/jsonFormat": jsonFormatRule,
    "/options": messageOptions,
  })

  const enumValueRules: CompareRules = {
    ...elementKeywords,
    // V-1 … V-8: added (PD-11, alias V-2), removed (alias V-3, reservations V-4 … V-7), renamed (V-8)
    $: enumValueRecordClassifier(compatibility),
    transform: [withOptions, liftedSourceFoldTransform],
  }

  const enumRules = componentRules("E-1", "E-2", {
    transform: [createFields(...protoApiEnumFields, "options"), liftedSourceFoldTransform],
    // values pair per number: equal names, then renames positionally (V-2, V-3, V-8)
    "/values": { mapping: enumValueMappingResolver, "/*": enumValueRules },
    "/reserved": reservedRules,
    // E-4 / E-5 (G4, §10 Q1): open → closed risky, closed → open non-breaking
    "/closed": { $: fixed([at("E-4"), at("E-5"), at("E-4")]) },
    "/jsonFormat": { $: fixed([at("E-9.add"), at("E-9.remove"), at("E-9.add")]) },
  })

  const extensionRulesTree: CompareRules = {
    ...componentRules("X-1", "X-2", {
      // the extension body is field-shaped: its type is one value (X-5, DG-01)
      transform: [
        withOptions,
        fieldShapeTransform,
        numericSpellingTransform,
        boundPairTransform,
        liftedSourceFoldTransform,
      ],
      ...fieldKeywords,
      // the field number of an extension replaced under the same key (X-3)
      "/number": { $: fixedRow("X-3") },
      // the extendee replaced (X-4); the extension inherits the extendee's usage scopes (§4.4)
      "/extendee": { inheritUsage: true, $: fixedRow("X-4") },
    }),
    // renamed with the same extendee and number (A3, X-6, PD-22)
    $: declarationRule(at("X-1"), at("X-2"), at("X-6"), at("U3")),
  }

  // the merged document holds the original after values: the transforms write carrier keys that are not protobuf
  return keepOriginalMerged({
    // A2, A5, A6: package, file and group renames re-key the before shadow, in this order, before any element
    transform: [createFields(...protoApiRootFields), packageRenameTransform, fileRenameTransform, groupRenameTransform],
    impliedReferences: impliedExtendeeReferences,
    // different format versions are rejected before the walk (D-1, AD-11); a respelled version is an annotation
    "/protoapi": { $: allAnnotation },
    // files pair by path, then a renamed file by its declared element set (A5)
    "/files": { mapping: fileMappingResolver, "/*": fileRules },
    "/services": { "/*": serviceRules },
    "/components": {
      transform: [createFields(...protoApiComponentKinds)],
      "/messages": { "/*": messageRules },
      "/enums": { "/*": enumRules },
      // extensions pair by key, then by extendee + number (A3)
      "/extensions": {
        mapping: extensionMappingResolver,
        transform: [extensionRenameTransform],
        "/*": extensionRulesTree,
      },
      "/**": { $: allUnclassified },
    },
    "/**": { $: allUnclassified },
  })
}
