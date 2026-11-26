// JSON Schema `type` (scalar, integer / number lattice, type arrays, 3.1 `null` member, type added / removed),
// `format`, single-type oneOf lists (oasdiff list-of-types) and boolean schemas (`true` / `false`).

import { annotation, breaking, nonBreaking } from "../../../src"
import type { SchemaCase } from "../../helpers/compat"
import { anyType, body, both, property, rr, seq, withJsd } from "./kw"

const id = seq("TYP")
const general = "test/compatibility-suites/schemas/schema-test-runner-general.ts"
const cs = (name: string, verdict?: string) => [
  { tool: "compat-suites", ref: `schemas/json-schema/${name}` },
  { tool: "fork", ref: `${general} ${name}`, ...(verdict ? { verdict } : {}) },
]
const oas = (ref: string, verdict?: string) => ({ tool: "oasdiff", ref, ...(verdict ? { verdict } : {}) })
const ISSUE39 = "ASD convention (ISSUE-39): a replaced type / format is breaking in both directions"

const own: SchemaCase[] = [
  ...both({
    id: id(2),
    title: "type replaced (boolean -> integer)",
    before: "boolean",
    after: "integer",
    rationale: "no value is valid on both sides: clients sending or reading booleans fail",
    annotation: "names the type change and the location",
    sources: [
      ...cs("update-schema-type"),
      oas(
        "checker/check_breaking_request_type_changed_test.go TestBreaking_ReqTypeStringToNumber RespTypeStringToNumber",
      ),
    ],
    stems: ["type-changed"],
    schema: [{ type: "boolean" }, { type: "integer" }],
    expect: [{ at: "type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  ...both({
    id: id(2),
    title: "type replaced (number -> string, bench J2)",
    before: "number",
    after: "string",
    rationale: ISSUE39,
    annotation: "names the type change and the location",
    sources: [
      { tool: "bench", ref: "bench/fixtures/jsonschema.js J2" },
      oas("checker/check_breaking_request_type_changed_test.go TestBreaking_ReqTypeNumberToString"),
    ],
    stems: ["type-changed"],
    scalar: false,
    schema: [{ type: "number" }, { type: "string" }],
    expect: [{ at: "type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  ...both(
    {
      id: id(2),
      title: "type widened integer -> number",
      before: "integer",
      after: "number",
      rationale:
        "every integer is a number: request non-breaking; response: clients typed for integers receive fractions (oasdiff response-*-type-generalized ERR)",
      annotation: "names the type change and the location",
      sources: [
        oas(
          "checker/check_breaking_request_type_changed_test.go TestBreaking_ReqTypeIntegerToNumber RespTypeIntegerToNumber",
        ),
        oas(
          "checker/check_response_header_type_changed_test.go TestResponseHeaderTypeChanged_IntegerToNumberIsGeneralized",
        ),
      ],
      stems: ["type-generalized"],
      schema: [{ type: "integer" }, { type: "number" }],
      expect: [{ at: "type", action: "replace", type: rr(nonBreaking, breaking), mentions: ["type"] }],
    },
    // ISSUE-94 (fixed): integer -> number on a query parameter schema root is non-breaking since P4
  ),
  ...both(
    {
      id: id(2),
      title: "type narrowed number -> integer",
      before: "number",
      after: "integer",
      rationale:
        "request: fractional values become invalid; response: clients receive a subset (oasdiff response-*-type-specialized INFO)",
      annotation: "names the type change and the location",
      sources: [
        oas(
          "checker/check_breaking_request_type_changed_test.go TestBreaking_ReqTypeNumberToInteger RespTypeNumberToInteger",
        ),
      ],
      stems: ["type-specialized"],
      schema: [{ type: "number" }, { type: "integer" }],
      expect: [{ at: "type", action: "replace", type: rr(breaking, nonBreaking), mentions: ["type"] }],
    },
    {
      body: { covers: ["oasdiff:request-body-type-changed", "oasdiff:request-parameter-type-changed"] },
      property: {
        covers: ["oasdiff:request-property-type-changed", "oasdiff:request-parameter-property-type-specialized"],
      },
    },
  ),
  body({
    id: id(),
    title: "response header type string -> integer (headers are text)",
    before: "X-Rate: string",
    after: "X-Rate: integer",
    rationale:
      "oasdiff treats header values as loosely typed text (string -> anything is compatible for a reader); ASD follows its convention ISSUE-39 and the JSON Schema contract, under which no former value stays valid",
    annotation: "names the type change and the header",
    sources: [
      oas(
        "checker/check_response_header_type_changed_test.go TestResponseHeaderTypeChanged_StringToIntegerIsCompatible",
        "INFO",
      ),
    ],
    covers: ["oasdiff:response-header-type-compatible"],
    placements: ["header"],
    schema: [{ type: "string" }, { type: "integer" }],
    expect: [{ at: "type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  body({
    id: id(),
    title: "response header type string/date-time -> integer",
    before: "X-Rate: string, format date-time",
    after: "X-Rate: integer",
    rationale: "clients parsing a timestamp receive a number",
    annotation: "names the type change and the header",
    sources: [
      oas("checker/check_response_header_type_changed_test.go TestResponseHeaderTypeChanged_StringDateTimeToInteger"),
    ],
    covers: ["oasdiff:response-header-type-changed"],
    placements: ["header"],
    schema: [{ type: "string", format: "date-time" }, { type: "integer" }],
    expect: [
      { at: "type", action: "replace", type: breaking, mentions: ["type"] },
      { at: "format", action: "remove", type: breaking, mentions: ["format"] },
    ],
  }),
  ...both({
    id: id(2),
    title: "type removed (specific type -> any)",
    before: "string",
    after: "{} (any type)",
    rationale:
      "request: every former value stays valid; response: clients receive values of any type (oasdiff: request generalized INFO, response ERR)",
    annotation: "names the removed type and the location",
    sources: [
      ...cs("update-schema-type-from-specific-type-to-any-type"),
      oas(
        "checker/check_request_property_type_changed_test.go TestRequestBodyTypeRemovedNotBreaking / checker/check_response_property_type_changed_test.go TestResponseBodyTypeRemovedStillBreaking",
      ),
    ],
    stems: ["type-generalized"],
    schema: [{ type: "string", description: "x" }, { description: "x" }],
    expect: [{ at: "type", action: "remove", type: rr(nonBreaking, breaking), mentions: ["type"] }],
  }),
  ...both(
    {
      id: id(2),
      title: "type added (any -> specific type)",
      before: "{} (any type)",
      after: "string",
      rationale:
        "request: non-string values become invalid; response: clients receive a subset (oasdiff response specialized INFO)",
      annotation: "names the added type and the location",
      sources: [
        ...cs("update-schema-type-from-any-type-to-specific-type"),
        oas(
          "checker/check_request_property_type_changed_test.go TestRequestBodyTypeAddedFromUntypedStillBreaking / checker/check_response_property_type_changed_test.go TestResponseBodyTypeAddedFromUntypedNotBreaking",
        ),
      ],
      stems: ["type-specialized"],
      schema: [{ description: "x" }, { type: "string", description: "x" }],
      expect: [{ at: "type", action: "add", type: rr(breaking, nonBreaking), mentions: ["type"] }],
    },
    {
      body: { covers: ["oasdiff:request-body-type-changed", "oasdiff:request-parameter-type-changed"] },
      property: { covers: ["oasdiff:request-property-type-changed"] },
    },
  ),
  property({
    id: id(),
    title: "type removed while a type-specific keyword stays (maxLength)",
    before: "name: string, maxLength 3",
    after: "name: maxLength 3 (any type)",
    rationale:
      "`{ maxLength: 3 }` accepts numbers, objects, ... (maxLength only constrains strings), so removing the type widens the schema exactly like removing it from a bare schema; a type inferred from the sibling keyword hides the change today",
    annotation: "names the removed type and the property",
    sources: [{ tool: "fork", ref: "test/corner-cases.test.ts default to default / non default to default" }],
    stems: ["type-generalized"],
    schema: [{ type: "string", maxLength: 3 }, { maxLength: 3 }],
    expect: [{ at: "type", action: "remove", type: rr(nonBreaking, breaking), mentions: ["type"] }],
    // ISSUE-136 (fixed) (P5) POLICY-21 decided (b)
  }),
  property({
    id: id(),
    title: "type added while a type-specific keyword exists (maxLength)",
    before: "name: maxLength 3 (any type)",
    after: "name: string, maxLength 3",
    rationale: "non-string values that were valid become invalid: request breaking, response non-breaking",
    annotation: "names the added type and the property",
    sources: [{ tool: "fork", ref: "test/corner-cases.test.ts default to non default" }],
    stems: ["type-specialized"],
    covers: ["oasdiff:request-property-type-changed"],
    schema: [{ maxLength: 3 }, { type: "string", maxLength: 3 }],
    expect: [{ at: "type", action: "add", type: rr(breaking, nonBreaking), mentions: ["type"] }],
    // ISSUE-136 (fixed) (P5) POLICY-21 decided (b)
  }),
  body({
    id: id(),
    title: "type: T and type: [T] are the same schema",
    before: "type: string",
    after: "type: [string]",
    rationale: "a one-element type array is equivalent to the scalar form",
    annotation: "no diff (or an annotation)",
    sources: [{ tool: "fork", ref: "test/json-schema.array-of-types.test.ts" }],
    schema: [{ type: "string" }, { type: ["string"] }],
    expect: [{ at: "type", type: annotation, optional: true }],
  }),
  ...both({
    id: id(2),
    title: "type array widened (string -> [string, integer])",
    before: "type: [string]",
    after: "type: [string, integer]",
    rationale: "request: accepts more values; response: clients receive integers they never handled",
    annotation: "names the added type member (integer) and the location",
    sources: [
      ...cs("add-union-type"),
      oas(
        "checker/check_request_property_type_changed_test.go TestRequestBodyTypeWideningMultiTypeNotBreaking / checker/check_response_property_type_changed_test.go TestResponseBodyTypeWideningStillBreaking",
      ),
    ],
    stems: ["type-generalized"],
    schema: [{ type: ["string"] }, { type: ["string", "integer"] }],
    expect: [{ at: "type/*", action: "add", type: rr(nonBreaking, breaking), mentions: ["integer"] }],
  }),
  ...both(
    {
      id: id(2),
      title: "type array narrowed ([string, integer] -> [string])",
      before: "type: [string, integer]",
      after: "type: [string]",
      rationale: "request: integers become invalid; response: clients receive a subset",
      annotation: "names the removed type member (integer) and the location",
      sources: [
        ...cs("remove-union-type"),
        oas(
          "checker/check_breaking_request_type_changed_test.go TestBreaking_ReqTypeUnionNarrowed / checker/check_response_property_type_changed_test.go TestResponseBodyTypeNarrowingMultiTypeNotBreaking",
        ),
      ],
      stems: ["type-specialized"],
      schema: [{ type: ["string", "integer"] }, { type: ["string"] }],
      expect: [{ at: "type/*", action: "remove", type: rr(breaking, nonBreaking), mentions: ["integer"] }],
    },
    {
      body: { covers: ["oasdiff:request-body-type-changed", "oasdiff:request-parameter-type-changed"] },
      property: { covers: ["oasdiff:request-property-type-changed"] },
    },
  ),
  body({
    id: id(),
    title: "type array members reordered",
    before: "type: [string, integer]",
    after: "type: [integer, string]",
    rationale: "`type` is a set: the order of its members has no meaning",
    annotation: "no diff",
    sources: cs("reorder-types-in-union-type"),
    schema: [{ type: ["string", "integer"] }, { type: ["integer", "string"] }],
    expect: [],
  }),
  body({
    id: id(),
    title: "type array replaced by the equivalent anyOf of single types",
    before: "type: [string, number]",
    after: "anyOf: [{ type: string }, { type: number }]",
    rationale: "both forms accept exactly the same values",
    annotation: "no diff (or annotations)",
    sources: [
      ...cs("union-type-equivalent-to-any-of"),
      { tool: "fork", ref: "test/json-schema.array-of-types.test.ts array of type is equivalent to anyOf" },
    ],
    schema: [{ type: ["string", "number"] }, { anyOf: [{ type: "string" }, { type: "number" }] }],
    expect: [{ at: "**", type: annotation, optional: true }],
    // ISSUE-98 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "3.1: null added to the type (string -> [string, null])",
    before: "type: string",
    after: "type: [string, null]",
    rationale: "request: null becomes acceptable; response: clients that never handled null receive it",
    annotation: "names the null type and the location",
    sources: [
      ...cs("add-null-to-union-type"),
      oas("checker/check_request_property_became_not_nuallable_test.go (3.1 type arrays)"),
    ],
    stems: ["became-nullable"],
    schema: [{ type: "string" }, { type: ["string", "null"] }],
    expect: [{ at: "type/*", action: "add", type: rr(nonBreaking, breaking), mentions: ["null"] }],
  }),
  ...both({
    id: id(2),
    title: "3.1: null removed from the type ([string, null] -> string)",
    before: "type: [string, null]",
    after: "type: string",
    rationale: "request: clients sending null fail; response: clients receive a subset",
    annotation: "names the null type and the location",
    sources: [
      ...cs("remove-null-from-union-type"),
      oas("checker/nullable_type_utils_test.go TestResponseTypeArrayBecameNotNullable"),
    ],
    stems: ["became-not-nullable"],
    schema: [{ type: ["string", "null"] }, { type: "string" }],
    expect: [{ at: "type/*", action: "remove", type: rr(breaking, nonBreaking), mentions: ["null"] }],
  }),
  body({
    id: id(),
    title: "3.1: nullable via oneOf wrapping (X -> oneOf [X, { type: null }])",
    before: "type: string",
    after: "oneOf: [{ type: string }, { type: null }]",
    rationale:
      "the same widening as adding null to the type: request non-breaking, response breaking; oasdiff reports a single became-nullable finding (#1088)",
    annotation: "names the added null alternative and the location",
    sources: [oas("checker/nullable_wrapping_test.go TestNullableWrapping_RequestProperties ResponseProperty")],
    covers: ["oasdiff:request-body-became-nullable", "oasdiff:response-body-became-nullable"],
    schema: [{ type: "string" }, { oneOf: [{ type: "string" }, { type: "null" }] }],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], action: "add", type: rr(nonBreaking, breaking) }],
  }),
  ...both({
    id: id(2),
    title: "scalar became array (string -> array of string)",
    before: "type: string",
    after: "type: array, items: string",
    rationale: "a single string is not an array: senders and readers of the scalar fail",
    annotation: "names the type change and the location",
    sources: [
      oas(
        "checker/check_request_property_type_changed_test.go TestRequestBodyAndPropertyTypesChangedCheckArrayToObject",
      ),
    ],
    stems: ["type-changed"],
    scalar: false,
    schema: [{ type: "string" }, { type: "array", items: { type: "string" } }],
    expect: [
      { at: "type", action: "replace", type: breaking, mentions: ["type"] },
      { at: "items", action: "add", type: anyType, optional: true },
    ],
  }),
  property({
    id: id(),
    title: "type changed array -> object",
    before: "name: array of string",
    after: "name: object with property a",
    rationale: "the shapes are disjoint",
    annotation: "names the type change and the property",
    sources: [
      oas(
        "checker/check_request_property_type_changed_test.go TestRequestBodyAndPropertyTypesChangedCheckArrayToObject ObjectToArray",
      ),
      { tool: "fork", ref: "test/corner-cases.test.ts array to object" },
    ],
    stems: ["type-changed"],
    scalar: false,
    schema: [
      { type: "array", items: { type: "string" } },
      { type: "object", properties: { a: { type: "string" } } },
    ],
    expect: [
      { at: "type", action: "replace", type: breaking, mentions: ["type"] },
      { at: ["items", "properties/**", "properties"], type: anyType, optional: true },
    ],
  }),
  property({
    id: id(),
    title: "type replaced makes the old type's bounds inert (bench J2-J4)",
    before: "name: number, minimum 10",
    after: "name: string, minimum 20",
    rationale:
      "the type replacement is breaking; `minimum` does not constrain strings, so its change has no effect on the valid values (bench accepts annotation)",
    annotation: "the type change and the inert keyword change are both described",
    sources: [{ tool: "bench", ref: "bench/fixtures/jsonschema.js J2, J3, J4" }],
    schema: [
      { type: "number", minimum: 10 },
      { type: "string", minimum: 20 },
    ],
    expect: [
      { at: "type", action: "replace", type: breaking, mentions: ["type"] },
      { at: "minimum", action: "replace", type: annotation, mentions: ["minimum"] },
    ],
    // ISSUE-133 (fixed) (P5) POLICY-10 decided (a)
  }),
  ...both(
    {
      id: id(2),
      title: "format added (string -> string/date)",
      before: "string",
      after: "string, format date",
      rationale:
        "request: arbitrary strings become invalid; response: clients receive a subset (oasdiff: request type-changed on the format axis)",
      annotation: "names the keyword (format) and the location",
      sources: [...cs("add-format-for-string-property"), oas("checker/check_types_test.go TestFormatAdded")],
      covers: [],
      schema: [{ type: "string" }, { type: "string", format: "date" }],
      expect: [{ at: "format", action: "add", type: rr(breaking, nonBreaking), mentions: ["format"] }],
    },
    {
      body: { covers: ["oasdiff:request-body-type-changed"] },
      property: { covers: ["oasdiff:request-property-type-changed"] },
    },
  ),
  ...both(
    {
      id: id(2),
      title: "format removed (string/date-time -> string)",
      before: "string, format date-time",
      after: "string",
      rationale: "request: accepts more values; response: clients that parse timestamps receive arbitrary strings",
      annotation: "names the keyword (format) and the location",
      sources: [
        ...cs("remove-format-for-string-property"),
        oas("checker/check_request_parameters_type_changed_test.go TestResponsePropertyFormatRemovedCheck"),
      ],
      stems: ["type-generalized"],
      schema: [{ type: "string", format: "date-time" }, { type: "string" }],
      expect: [{ at: "format", action: "remove", type: rr(nonBreaking, breaking), mentions: ["format"] }],
    },
    {
      body: { covers: ["oasdiff:response-body-type-changed"] },
      property: { covers: ["oasdiff:response-property-type-changed"] },
    },
  ),
  ...both({
    id: id(2),
    title: "format replaced (date -> date-time)",
    before: "string, format date",
    after: "string, format date-time",
    rationale: "the value sets are disjoint",
    annotation: "names the keyword (format) and the location",
    sources: [
      ...cs("update-format-for-string-property"),
      oas("checker/check_types_test.go TestStringFormatToDateTimeBreaking"),
      { tool: "bench", ref: "bench/fixtures/jsonschema.js J8" },
    ],
    stems: ["type-changed"],
    schema: [
      { type: "string", format: "date" },
      { type: "string", format: "date-time" },
    ],
    expect: [{ at: "format", action: "replace", type: breaking, mentions: ["format"] }],
  }),
  ...both({
    id: id(2),
    title: "integer format widened (int32 -> int64)",
    before: "integer, format int32",
    after: "integer, format int64",
    rationale:
      "every int32 is an int64: the request side is generalized (oasdiff INFO, set inclusion, POLICY-41 decided (b)); a response client typed for int32 overflows (breaking, the fork agrees)",
    annotation: "names the keyword (format) and the location",
    sources: [
      ...cs("update-format-for-number-property"),
      oas("checker/check_types.go isFormatContained (int32 -> int64)", "request: INFO"),
    ],
    stems: ["type-generalized"],
    schema: [
      { type: "integer", format: "int32" },
      { type: "integer", format: "int64" },
    ],
    // POLICY-41 decided (b) (changed from the proposal): a provable generalization is non-breaking in a request
    expect: [{ at: "format", action: "replace", type: rr(nonBreaking, breaking), mentions: ["format"] }],
  }),
  property({
    id: id(),
    title: "number format widened (float -> double)",
    before: "name: number, format float",
    after: "name: number, format double",
    rationale:
      "every float is a double: the request side is generalized (oasdiff INFO, POLICY-41 decided (b)); a response client reading floats loses precision (breaking)",
    annotation: "names the keyword (format) and the property",
    sources: [oas("checker/check_types.go isFormatContained (float -> double)", "request: INFO")],
    stems: ["type-generalized"],
    schema: [
      { type: "number", format: "float" },
      { type: "number", format: "double" },
    ],
    // POLICY-41 decided (b) (changed from the proposal): a provable generalization is non-breaking in a request
    expect: [{ at: "format", action: "replace", type: rr(nonBreaking, breaking), mentions: ["format"] }],
  }),
  property({
    id: id(),
    title: "format added to a number property (number -> number/float)",
    before: "name: number",
    after: "name: number, format float",
    rationale: "request: values outside the float range become invalid; response: clients receive a subset",
    annotation: "names the keyword (format) and the property",
    sources: cs("add-format-for-number-property"),
    covers: ["oasdiff:request-property-type-changed"],
    schema: [{ type: "number" }, { type: "number", format: "float" }],
    expect: [{ at: "format", action: "add", type: rr(breaking, nonBreaking), mentions: ["format"] }],
  }),
  property({
    id: id(),
    title: "format removed from a number property (number/float -> number)",
    before: "name: number, format float",
    after: "name: number",
    rationale: "request: accepts more values; response: clients typed for float can receive doubles",
    annotation: "names the keyword (format) and the property",
    sources: cs("remove-format-for-number-property"),
    stems: ["type-generalized"],
    schema: [{ type: "number", format: "float" }, { type: "number" }],
    expect: [{ at: "format", action: "remove", type: rr(nonBreaking, breaking), mentions: ["format"] }],
    covers: ["oasdiff:response-property-type-changed"],
  }),
  property({
    id: id(),
    title: "type and format widened together (integer/int64 -> number)",
    before: "name: integer, format int64",
    after: "name: number",
    rationale:
      "request: every former value stays valid (oasdiff TestFormatRemovedWithTypeChangeNotBreaking); response: clients typed for int64 receive fractions",
    annotation: "names the type change, the removed format and the property",
    sources: [oas("checker/check_types_test.go TestFormatRemovedWithTypeChangeNotBreaking")],
    stems: ["type-generalized"],
    schema: [{ type: "integer", format: "int64" }, { type: "number" }],
    expect: [
      { at: "type", action: "replace", type: rr(nonBreaking, breaking), mentions: ["type"] },
      { at: "format", action: "remove", type: rr(nonBreaking, breaking), mentions: ["format"] },
    ],
  }),
  property({
    id: id(),
    title: "type widened but format added (number -> integer/int32 in a request)",
    before: "name: number",
    after: "name: integer, format int32",
    rationale:
      "both axes narrow the request: fractions and large integers become invalid; response: clients receive a subset",
    annotation: "names the type change, the added format and the property",
    sources: [
      oas(
        "checker/check_breaking_request_type_changed_test.go TestBreaking_ReqTypeNumberToInt32 RespTypeNumberToInt32",
      ),
    ],
    stems: ["type-specialized"],
    covers: ["oasdiff:request-property-type-changed"],
    schema: [{ type: "number" }, { type: "integer", format: "int32" }],
    expect: [
      { at: "type", action: "replace", type: rr(breaking, nonBreaking), mentions: ["type"] },
      { at: "format", action: "add", type: rr(breaking, nonBreaking), mentions: ["format"] },
    ],
  }),
  ...both({
    id: id(2),
    title: "single type -> list of types (string -> oneOf [string, integer])",
    before: "type: string",
    after: "oneOf: [{ type: string }, { type: integer }]",
    rationale:
      "request: integers become acceptable; response: clients receive integers they never handled (oasdiff list-of-types widened)",
    annotation: "names the added alternative and the location",
    sources: [oas("checker/list_of_types_core_test.go TestListOfTypesIntegration_SingleToList")],
    stems: ["list-of-types-widened"],
    schema: [{ type: "string" }, { oneOf: [{ type: "string" }, { type: "integer" }] }],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], action: "add", type: rr(nonBreaking, breaking), mentions: ["oneOf"] }],
  }),
  ...both({
    id: id(2),
    title: "list of types -> single type (anyOf [string, integer] -> string)",
    before: "anyOf: [{ type: string }, { type: integer }]",
    after: "type: string",
    rationale: "request: integers become invalid; response: clients receive a subset (oasdiff list-of-types narrowed)",
    annotation: "names the removed alternative and the location",
    sources: [oas("checker/list_of_types_core_test.go TestListOfTypesIntegration_ListToSingle")],
    stems: ["list-of-types-narrowed"],
    schema: [{ anyOf: [{ type: "string" }, { type: "integer" }] }, { type: "string" }],
    expect: [{ at: ["anyOf/*", "anyOf/*/**"], action: "remove", type: rr(breaking, nonBreaking), mentions: ["anyOf"] }],
  }),
  body({
    id: id(),
    title: "list of types narrowed (anyOf [string, integer, boolean] -> anyOf [string, integer])",
    before: "anyOf: string | integer | boolean",
    after: "anyOf: string | integer",
    rationale: "request: booleans become invalid; response: clients receive a subset",
    annotation: "names the removed alternative and the location",
    sources: [oas("checker/list_of_types_core_test.go TestListOfTypesIntegration_ListToList")],
    stems: ["list-of-types-narrowed"],
    schema: [
      { anyOf: [{ type: "string" }, { type: "integer" }, { type: "boolean" }] },
      { anyOf: [{ type: "string" }, { type: "integer" }] },
    ],
    expect: [{ at: ["anyOf/*", "anyOf/*/**"], action: "remove", type: rr(breaking, nonBreaking), mentions: ["anyOf"] }],
  }),
  ...both(
    {
      id: id(2),
      title: "schema became false",
      before: "string",
      after: "false",
      rationale:
        "no value passes validation any more: request breaking; response: for the body, no valid response exists (breaking); for an optional property, it can no longer be present, like removing an optional response property (oasdiff INFO)",
      annotation: "states that the schema became false (nothing is allowed) and names the location",
      sources: [oas("checker/check_schema_became_false_test.go TestSchemaBecameFalse")],
      stems: ["schema-became-false"],
      schema: [{ type: "string" }, false],
      expect: [{ at: "", action: "replace", type: breaking, mentions: [/false|nothing|no value/i] }],
    },
    {
      body: {
        // POLICY-40 decided (a): a response body becoming unsatisfiable is breaking, leaving that state non-breaking
        placements: ["request", "response", "param"],
      },
      // ISSUE-89 (fixed) (P5)
      property: {
        expect: [{ at: "", action: "replace", type: rr(breaking, nonBreaking), mentions: [/false|nothing|no value/i] }],
      },
    },
  ),
  ...both(
    {
      id: id(2),
      title: "schema became not false",
      before: "false",
      after: "string",
      rationale:
        "request: values become acceptable again; response: values appear where clients relied on none (oasdiff: property ERR, body INFO); for the body there was no valid response before",
      annotation: "states that the schema is no longer false and names the location",
      sources: [oas("checker/check_schema_became_false_test.go TestSchemaBecameNotFalse")],
      stems: ["schema-became-not-false"],
      schema: [false, { type: "string" }],
      expect: [{ at: "", action: "replace", type: rr(nonBreaking, breaking), mentions: [/false/i] }],
    },
    {
      body: {
        // POLICY-40 decided (a): a response body becoming unsatisfiable is breaking, leaving that state non-breaking
        expect: [{ at: "", action: "replace", type: nonBreaking, mentions: [/false/i] }],
        placements: ["request", "response", "param"],
      },
      // ISSUE-89 (fixed) (P5)
      property: {},
    },
  ),
  body({
    id: id(),
    title: "response header schema became false",
    before: "X-Rate: string",
    after: "X-Rate: false",
    rationale:
      "the header can no longer carry a valid value, i.e. it can no longer be sent: like removing an optional response header (oasdiff INFO)",
    annotation: "states that the header schema became false",
    sources: [oas("checker/check_schema_became_false_test.go TestSchemaBecameFalse (header)")],
    covers: ["oasdiff:response-header-schema-became-false"],
    placements: ["header"],
    schema: [{ type: "string" }, false],
    expect: [{ at: "", action: "replace", type: nonBreaking, mentions: [/false/i] }],
    // ISSUE-89 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "response header schema became not false",
    before: "X-Rate: false",
    after: "X-Rate: string",
    rationale:
      "the header can carry values again that the client was told cannot occur: like a subschema leaving false, breaking (POLICY-65 decided (b), consistent with POLICY-40 and OAS-HDR-021; oasdiff response-header-schema-became-not-false ERR)",
    annotation: "states that the header schema is no longer false",
    sources: [oas("checker/check_schema_became_false_test.go TestSchemaBecameNotFalse (header)", "ERR")],
    covers: ["oasdiff:response-header-schema-became-not-false"],
    placements: ["header"],
    schema: [false, { type: "string" }],
    expect: [{ at: "", action: "replace", type: breaking, mentions: [/false/i] }],
    // ISSUE-89 (fixed) (P5) for the description; POLICY-65 decided (b) (P5b): breaking, like a subschema leaving
    // false (the expectation encoded option (a), non-breaking, and was rewritten to the decision)
  }),
  property({
    id: id(),
    title: "schema true replaced by the equivalent {}",
    before: "name: true",
    after: "name: {}",
    rationale: "`true` and `{}` accept every value",
    annotation: "no diff (or an annotation)",
    sources: [{ tool: "json-schema-diff", ref: "test/unit/json-schema-diff/diff-schemas-boolean-schemas.spec.ts" }],
    schema: [true, {}],
    expect: [{ at: "", type: annotation, optional: true }],
    // ISSUE-89 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "schema true -> string",
    before: "true",
    after: "type: string",
    rationale: "request: non-strings become invalid; response: clients receive a subset",
    annotation: "names the constraint that was introduced (type) and the location",
    sources: [{ tool: "json-schema-diff", ref: "test/unit/json-schema-diff/diff-schemas-boolean-schemas.spec.ts" }],
    schema: [true, { type: "string" }],
    expect: [{ at: ["", "type"], type: rr(breaking, nonBreaking), mentions: ["type"] }],
    // ISSUE-89 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "boolean false schema for a property kept, sibling property changed",
    before: "name: false, other: string",
    after: "name: false, other: integer",
    rationale: "an unchanged boolean schema produces no diff; only the sibling change is reported",
    annotation: "names the changed sibling",
    sources: [{ tool: "json-schema-diff", ref: "test/unit/json-schema-diff/diff-schemas-boolean-schemas.spec.ts" }],
    schema: [
      { type: "object", properties: { name: false, other: { type: "string" } } },
      { type: "object", properties: { name: false, other: { type: "integer" } } },
    ],
    expect: [{ at: "properties/other/type", action: "replace", type: breaking, mentions: ["`other`"] }],
  }),
]

// Atlassian json-schema-diff test cases (checklist jsd) represented by the cases above
const T = "diff-schemas-type"
const B = "diff-schemas-boolean-schemas"
export const cases = withJsd(own, {
  "JS-TYP-003": [
    [T, "type added and removed"],
    ["diff-schemas", "should return additions and removals found", null],
  ],
  "JS-TYP-004": [
    [
      "diff-schemas-type-object",
      "object property constrained to a type is changed to be constrained to a different type",
    ],
  ],
  "JS-TYP-005": [["diff-schemas-type-number", "from integer to number"]],
  "JS-TYP-013": [[T, "empty schema vs list of types"]],
  "JS-TYP-017": [[T, "type as array vs single type that are the same"]],
  "JS-TYP-020": [
    [T, "type number is changed"],
    [T, "type array is changed"],
    [T, "type boolean is changed"],
    [T, "type integer is changed"],
    [T, "type object is changed"],
    [T, "type string is changed"],
    [T, "multiple types added and removed"],
  ],
  "JS-TYP-026": [[T, "type null is changed"]],
  "JS-TYP-051": [
    ["diff-schemas-type-number", "numbers with maximum constraint to false"],
    ["diff-schemas-type-number", "numbers with minimum constraint to false"],
    ["diff-schemas-type-number", "numbers with exclusiveMaximum constraint to false"],
    ["diff-schemas-type-number", "numbers with exclusiveMinimum constraint to false"],
    ["diff-schemas-type-number", "minimum equal than maximum not a contradiction since both are inclusive"],
    ["diff-schemas-type-string", "string with minLength constraint removed"],
    ["diff-schemas-type-string", "string with maxLength constraint removed"],
    ["diff-schemas-type-array", "remove array with items constraint"],
    ["diff-schemas-type-array", "array with minItems constraint removed"],
    ["diff-schemas-type-array", "array with maxItems constraint removed altogether"],
    ["diff-schemas-type-object", "object with maxProperties=0 constraint gets constrained to accept nothing"],
    [B, "single type schema to false"],
    ["diff-schemas-anyof", "union of all types"],
    ["diff-schemas-oneof", "oneOf containing partial array schemas that partially intersect"],
  ],
  "JS-TYP-053": [
    ["diff-schemas-type-string", "empty string not confused with no string"],
    ["diff-schemas-type-string", "intersecting string min and max length in allOf are merged"],
    [B, "false schema to true schema"],
    ["diff-schemas-not", "double negation: nothing accepted to not not string"],
  ],
  "JS-TYP-059": [[B, "true schema to true schema", null]],
})
