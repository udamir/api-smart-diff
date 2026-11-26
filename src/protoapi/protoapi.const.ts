import { annotation, breaking, deprecated, nonBreaking, risky, unclassified } from "../core/constants"
import type { DiffType } from "../types"
import type { ProtoApiCompatibility } from "./protoapi.types"

/** Compatibility levels from the strictest to the most lenient (PROTOAPI_DESIGN §5.1, §5.4). */
export const protoApiCompatibilityLevels: readonly ProtoApiCompatibility[] = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]

/** Default compatibility level (U4). */
export const PROTOAPI_DEFAULT_COMPATIBILITY: ProtoApiCompatibility = "FILE"

/** Value of the `protoapi` field accepted by `detectSpec`: `0.<minor>` with an optional patch (DG-40). */
export const PROTOAPI_VERSION_PATTERN = /^0\.\d+(\.\d+)?$/

/** Containers of a ProtoApi document (PROTOAPI_DESIGN §4.3): created on the other side so they never yield a diff. */
export const protoApiRootFields = ["files", "services", "components"] as const
export const protoApiFileFields = ["imports", "importFlags", "options"] as const
export const protoApiComponentKinds = ["messages", "enums", "extensions"] as const
export const protoApiMessageFields = ["properties", "oneofs", "reserved", "extensions", "extensionOptions"] as const
export const protoApiEnumFields = ["values", "reserved"] as const
export const protoApiReservedFields = ["numbers", "names"] as const

/** Session cache key of the renamed files of a comparison (A5), shared by `fileRenameTransform` and `/files`. */
export const PROTOAPI_FILE_PAIRS_CACHE_KEY = "protoapi-file-pairs"

/**
 * Keywords a feature or a syntax resolves on an element (A4, rule D): diffs of these keywords that one cause (a
 * `syntax` change of the declaring file, or a feature option set at the element or an enclosing one) produced at the
 * same element are merged into one record by `mergeElementDiffs`. Feature name → resolved keyword.
 */
export const protoApiResolvedFeatures: Readonly<Record<string, string>> = {
  field_presence: "presence",
  enum_type: "closed",
  utf8_validation: "utf8Validation",
  json_format: "jsonFormat",
  repeated_field_encoding: "packed",
  message_encoding: "delimited",
}

/** Resolved keywords (A4): the keywords of `protoApiResolvedFeatures`. */
export const protoApiResolvedKeywords: ReadonlySet<string> = new Set(Object.values(protoApiResolvedFeatures))

/** Scalar positions of a field (PD-27): the field itself and its `items`, `propertyNames`, `additionalProperties`. */
export const protoApiInnerPositions: ReadonlySet<string> = new Set(["items", "propertyNames", "additionalProperties"])

/**
 * Validator keywords K-1 … K-14 folded into a field's shape record when the shape changes (PD-16, PD-27): bounds,
 * lengths, item and entry counts, `uniqueItems`, `pattern`, `format`, allowed values, constant value, multiple-of and
 * the required constraint.
 */
export const protoApiFoldedValidators: ReadonlySet<string> = new Set([
  "minimum",
  "exclusiveMinimum",
  "maximum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minProperties",
  "maxProperties",
  "uniqueItems",
  "pattern",
  "format",
  "enum",
  "const",
  "required",
])

// ---- classification matrix (PROTOAPI_DESIGN §6, phase Q3)

/** The cells of a matrix row at the four levels, in the order of `protoApiCompatibilityLevels`. */
export type ProtoApiLevelCells = readonly [DiffType, DiffType, DiffType, DiffType]

const B = breaking
const R = risky
const N = nonBreaking
const D = deprecated
const A = annotation
const U = unclassified
const all = (type: DiffType): ProtoApiLevelCells => [type, type, type, type]
// build-only (U1): risky where generated code is covered, annotation for runtime-only levels
const buildOnly: ProtoApiLevelCells = [R, R, A, A]

/**
 * The level cells of every row of the classification matrix (PROTOAPI_DESIGN §6.1 … §6.7), keyed by row id; a row
 * whose cell depends on the scope or on the change has one entry per variant (`V-1.request`, `F-18.packed`). The rule
 * tree reads its cells from this table when it is built (§4.5), and J6 checks the level order invariant over it
 * (§5.4: a row's severity never increases from FILE to WIRE). Rows without a class of their own (D-1, D-2, F-10,
 * F-21, F-28, F-29, X-5) are not listed.
 */
export const protoApiMatrix = {
  "D-3": all(U),
  // §6.1 document and files
  "P-1": [N, N, A, A],
  "P-2": [R, A, A, A],
  "P-3": all(A),
  "P-4": buildOnly,
  "P-5": all(B),
  "P-6": all(A),
  "P-7": buildOnly,
  "P-8": [N, N, A, A],
  "P-9": all(A),
  "P-10": all(A),
  "P-12": all(D),
  "P-14": all(A),
  "P-15.narrowed": buildOnly,
  "P-15.widened": [N, N, A, A],
  "P-15.unchanged": all(A),
  "P-17": all(U),
  "P-18": [R, A, A, A],
  "P-19": all(A),
  "P-20": [R, A, A, A],
  // §6.2 services and methods
  "S-1": all(N),
  "S-2": all(B),
  "S-3": all(A),
  "S-4": all(D),
  "S-9": all(U),
  "R-1": all(N),
  "R-2": all(B),
  "R-3": all(R),
  "R-4": all(R),
  "R-5": all(B),
  "R-6": all(B),
  "R-7": all(N),
  "R-8": all(R),
  "R-9": [N, N, N, A],
  "R-10": [B, B, B, A],
  "R-11": [B, B, B, A],
  "R-12": [N, N, N, A],
  "R-13": [B, B, B, A],
  "R-19": [B, B, B, A],
  "R-16": all(A),
  "R-17": all(U),
  "R-18.annotation": all(A),
  "R-18.deprecation": all(D),
  // §6.3 messages
  "M-1": all(N),
  "M-2": all(R),
  "M-3": all(A),
  "M-4": all(D),
  "M-5": all(N),
  "M-6": buildOnly,
  "M-7": buildOnly,
  "M-8.annotation": all(A),
  "M-8.deprecation": all(D),
  "M-8.option": all(U),
  "M-9": all(B),
  "M-10": all(R),
  "M-11": all(N),
  "M-12": [B, B, B, A],
  "M-13": [R, R, R, A],
  "M-14": [N, N, N, A],
  "M-15": buildOnly,
  "M-16": all(N),
  "M-17": buildOnly,
  "M-18.add": all(N),
  "M-18.change": buildOnly,
  "M-19": buildOnly,
  "M-20": [N, N, A, A],
  "M-21": buildOnly,
  "M-22": all(N),
  "M-23": all(B),
  "M-24": buildOnly,
  "M-25": [N, N, A, A],
  "M-26": all(A),
  "M-27": all(U),
  // §6.4 fields
  "F-1": all(N),
  "F-2": all(B),
  "F-3": all(B),
  "F-4": [B, B, B, R],
  "F-5": all(B),
  "F-6": buildOnly,
  "F-7": all(B),
  "F-8": [B, B, B, N],
  "F-9": [R, R, N, N],
  "F-11": all(R),
  "F-12": [B, B, B, R],
  "F-13": [B, B, B, R],
  "F-14": all(B),
  "F-15": all(R),
  "F-17": all(R),
  "F-18.lengthDelimited": [B, B, B, R],
  "F-18.packed": all(B),
  "F-19": [B, B, B, R],
  "F-20": all(B),
  "F-22": all(B),
  "F-23": buildOnly,
  "F-24": all(B),
  "F-25": all(B),
  "F-26": buildOnly,
  "F-27": all(B),
  "F-30": [B, B, B, A],
  "F-31": all(A),
  "F-32": all(B),
  "F-33": all(A),
  "F-34": all(A),
  "F-35": all(A),
  "F-36": buildOnly,
  "F-38": buildOnly,
  "F-42": all(A),
  "F-43": all(A),
  "F-44": all(U),
  "F-45.annotation": all(A),
  "F-45.deprecation": all(D),
  "F-46.request": all(B),
  "F-46.response": all(N),
  "F-47.response": all(R),
  // §6.5 enums and values
  "E-1": all(N),
  "E-2": all(R),
  "E-3.annotation": all(A),
  "E-3.deprecation": all(D),
  "E-4": all(R),
  "E-5": all(N),
  "E-6": all(A),
  "E-7.reused": all(B),
  "E-7.lost": all(R),
  "E-7.gained": all(N),
  "E-8.reused": [B, B, B, A],
  "E-8.removed": [R, R, R, A],
  "E-8.added": [N, N, N, A],
  "E-9.add": buildOnly,
  "E-9.remove": all(N),
  "E-11": all(U),
  "V-1.request": all(N),
  "V-1.response": all(R),
  "V-2": all(N),
  "V-3": [B, B, B, N],
  "V-4": all(B),
  "V-5": [B, B, B, R],
  "V-6": all(B),
  "V-7": buildOnly,
  "V-8": [B, B, B, N],
  "V-9.annotation": all(A),
  "V-9.deprecation": all(D),
  "V-9.option": all(U),
  // §6.6 extensions
  "X-1": all(N),
  "X-2": all(R),
  "X-3": all(B),
  "X-4": all(B),
  "X-6": [B, B, B, N],
  // §6.7 language-specific and googleapis options (R-G, PD-13), bundled declarations (U3)
  "L-1": buildOnly,
  "L-2": buildOnly,
  "L-3": buildOnly,
  "L-4": buildOnly,
  U3: all(A),
} as const satisfies Record<string, ProtoApiLevelCells>

/** A row id of the classification matrix. */
export type ProtoApiMatrixRow = keyof typeof protoApiMatrix

// ---- type groups and cardinality groups (§5.3, buf `breaking_util.go`)

/** WIRE compatibility groups of scalar types; a type not listed is alone. */
export const protoApiWireGroups: readonly (readonly string[])[] = [
  ["int32", "int64", "uint32", "uint64", "bool"],
  ["sint32", "sint64"],
  ["fixed32", "sfixed32"],
  ["fixed64", "sfixed64"],
]

/** WIRE_JSON compatibility groups of scalar types (each lies inside a WIRE group); a type not listed is alone. */
export const protoApiWireJsonGroups: readonly (readonly string[])[] = [
  ["int32", "uint32"],
  ["int64", "uint64"],
  ["fixed32", "sfixed32"],
  ["fixed64", "sfixed64"],
]

/** Scalar types whose repeated values are length-delimited on the wire (never packed, PD-7). */
export const protoApiLengthDelimitedScalars: ReadonlySet<string> = new Set(["string", "bytes"])

// ---- options (§4.10, §6.7)

/**
 * Language-specific option keys (R-G, rows L-1 … L-3): exact keys and prefixes (a trailing `*`), compared by one
 * generic rule (`languageOptionRule`) at any element.
 */
export const protoApiLanguageOptionKeys: readonly string[] = [
  "go_package",
  "optimize_for",
  "java_*",
  "cc_*",
  "csharp_*",
  "objc_*",
  "php_*",
  "py_*",
  "ruby_*",
  "swift_*",
  "ctype",
  "jstype",
  // a language feature written as an unresolved option key (its feature file not imported)
  "features.pb.cpp.*",
  "features.pb.java.*",
  "features.pb.go.*",
]

/** Language feature sets under `options.features` (R-G, row L-3). */
export const protoApiLanguageFeatures: readonly string[] = ["pb.cpp", "pb.java", "pb.go"]

/** Prefix of the googleapis options (PD-13, PD-26, row L-4). */
export const PROTOAPI_GOOGLE_API_PREFIX = "google.api."

/** googleapis options with their own handling that the prefix does not catch (lifted into keywords, PD-26). */
export const protoApiGoogleApiExceptions: readonly string[] = [
  "google.api.http",
  "google.api.field_behavior",
  "google.api.field_info",
]

/**
 * Protobuf features of the language-independent feature set (`google.protobuf.FeatureSet`); their effects arrive as
 * resolved keywords on the elements (rule D), so the feature options themselves are annotations (P-14, F-42), except
 * `default_symbol_visibility` (P-15, C6).
 */
export const protoApiKnownFeatures: readonly string[] = [
  "field_presence",
  "enum_type",
  "repeated_field_encoding",
  "utf8_validation",
  "message_encoding",
  "json_format",
  "enforce_naming_style",
  "default_symbol_visibility",
]

/** Built-in options without an API or wire effect (F-42, V-9, E-6, M-26, R-16, F-43 remainders): annotations. */
export const protoApiAnnotationOptions: readonly string[] = [
  "lazy",
  "unverified_lazy",
  "weak",
  "debug_redact",
  "retention",
  "allow_alias",
  "deprecated_legacy_json_field_conflicts",
  "google.api.field_behavior",
  "google.api.field_info",
  "grpc.gateway.protoc_gen_openapiv2.options.openapiv2_operation",
  "grpc.gateway.protoc_gen_openapiv2.options.openapiv2_schema",
  "grpc.gateway.protoc_gen_openapiv2.options.openapiv2_field",
]

/** Idempotency levels of an rpc from the lowest (unknown, not written) to the highest (G5, R-7 / R-8). */
export const protoApiIdempotencyLevels: readonly string[] = ["IDEMPOTENCY_UNKNOWN", "IDEMPOTENT", "NO_SIDE_EFFECTS"]
