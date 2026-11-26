// Atlassian json-schema-diff 1.0.0 test cases (npm tarball `json-schema-diff`, test/unit/json-schema-diff/*.spec.ts,
// `registerDiffTestCases`) that no other JSON Schema case represents. The tool computes the set difference of the
// accepted values: `removed` ≠ false (an instance valid before is invalid after) is breaking in a request, `added` ≠
// false (an instance valid after was invalid before) is breaking in a response. Most of its tests check that two
// schemas written differently accept the same values (contradictions ≡ false, redundant bounds, complements, unions
// that partition a type); here they are equivalent rewrites, expected as no diff or annotations. Rows covered by
// existing cases are listed at the end of the other *.cases.ts files (`withJsd`); the checklist is
// test/compat/coverage/json-schema-diff-tests.json.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type ExpectedChange, type SchemaCase, risky } from "../../helpers/compat"
import { body, type JsdRow, type KwSpec, rr, withJsdRows } from "./kw"

let n = 0
const nextId = () => `JS-JSD-${String(++n).padStart(3, "0")}`

type Spec = Omit<KwSpec, "id" | "sources" | "expect"> & {
  expect: ExpectedChange[] | Partial<Record<string, ExpectedChange[]>>
  sources?: KwSpec["sources"]
}

/** a case built from json-schema-diff rows, filed under an existing JSON Schema area */
const jsd = (area: string, rows: JsdRow[], spec: Spec): SchemaCase =>
  withJsdRows({ ...body({ ...spec, id: nextId(), sources: spec.sources ?? [] }), area }, rows)

const F = {
  allof: "diff-schemas-allof",
  anyof: "diff-schemas-anyof",
  bool: "diff-schemas-boolean-schemas",
  not: "diff-schemas-not",
  oneof: "diff-schemas-oneof",
  refs: "diff-schemas-references",
  regression: "diff-schemas-regression",
  array: "diff-schemas-type-array",
  num: "diff-schemas-type-number",
  obj: "diff-schemas-type-object",
  str: "diff-schemas-type-string",
  type: "diff-schemas-type",
  main: "diff-schemas",
}

// the tool's test compares X with false and asserts that the removed schema is the simplified X: the case compares X
// with the simplified X, which the tool considers equal
const AS_ASSERTED = null

/** an equivalent rewrite: no diff, or annotations only */
const EQUIV: ExpectedChange[] = [{ at: "**", type: annotation, optional: true }]
const SAME = "both schemas accept exactly the same values (json-schema-diff: added = removed = false)"
const NONE = "no diff (or annotations only)"

// root causes (temp/ANALYSIS.md §2.11)
const EFF = "ISSUE-88" // numeric bounds classified per keyword, not by the effective bound
const SET = "ISSUE-153" // no set-semantic normalization: contradictions and equivalent rewrites are compared keyword by keyword
const INT = "ISSUE-154" // integer ⊂ number not applied to type arrays

const num = (extra: Record<string, unknown> = {}) => ({ type: "number", ...extra })
const int = (extra: Record<string, unknown> = {}) => ({ type: "integer", ...extra })
const str = (extra: Record<string, unknown> = {}) => ({ type: "string", ...extra })
const arr = (extra: Record<string, unknown> = {}) => ({ type: "array", ...extra })
const obj = (extra: Record<string, unknown> = {}) => ({ type: "object", ...extra })

export const cases: SchemaCase[] = [
  // ---- types and boolean schemas ----------------------------------------------------------------------------
  jsd("types", [[F.num, "considers integer as a subset of number"]], {
    title: "integer dropped from a type array that keeps number",
    before: "type: [number, integer]",
    after: "type: number",
    rationale: `every integer is a number (JSON Schema validation §6.1.1): ${SAME}`,
    annotation: NONE,
    schema: [{ type: ["number", "integer"] }, num()],
    expect: EQUIV,
    // ISSUE-154 (fixed) (P5)
  }),
  jsd("types", [[F.bool, "all but one type schema to true schema"]], {
    title: "type list of every type but object replaced by true",
    before: "type: [string, array, number, integer, boolean, null]",
    after: "true",
    rationale: "objects become valid: request non-breaking; response: clients receive objects they never handled",
    annotation: "states that the schema now accepts any value and names the location",
    schema: [{ type: ["string", "array", "number", "integer", "boolean", "null"] }, true],
    expect: [{ at: "", action: "replace", type: rr(nonBreaking, breaking) }],
    // ISSUE-89 (fixed) (P5)
  }),
  jsd("types", [[F.bool, "all types schema to true schema"]], {
    title: "type list of all seven types replaced by true",
    before: "type: [string, array, number, integer, boolean, null, object]",
    after: "true",
    rationale: `a type list naming every JSON type accepts every value: ${SAME}`,
    annotation: NONE,
    schema: [{ type: ["string", "array", "number", "integer", "boolean", "null", "object"] }, true],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd("types", [[F.bool, "all types schema (not specifying integer) to true schema"]], {
    title: "type list of every type except integer replaced by true",
    before: "type: [string, array, number, boolean, null, object]",
    after: "true",
    rationale: `integer is a subset of number, so the list already accepts every value: ${SAME}`,
    annotation: NONE,
    schema: [{ type: ["string", "array", "number", "boolean", "null", "object"] }, true],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd(
    "types",
    [
      [F.type, "types are the same"],
      [F.type, "empty schemas"],
      [F.main, "should return no additions or removals found", null],
    ],
    {
      title: "identical schemas",
      before: "type: string",
      after: "type: string",
      rationale: "nothing changes: no diff (the identical-document check of every case covers `{}` as well)",
      annotation: "no diff",
      schema: [str(), str()],
      expect: [],
    },
  ),
  jsd(
    "objects",
    [[F.regression, "should not raise errors for a schema with property names matching Object.prototype properties"]],
    {
      title: "identical object with property names of Object.prototype members",
      before: "object { hasOwnProperty, toString, valueOf, __lookupGetter__ }, additionalProperties false",
      after: "the same object",
      rationale: "property names such as `toString` are ordinary keys: identical schemas yield no diff",
      annotation: "no diff",
      schema: [
        obj({
          properties: { hasOwnProperty: str(), toString: str(), valueOf: str(), __lookupGetter__: str() },
          additionalProperties: false,
        }),
        obj({
          properties: { hasOwnProperty: str(), toString: str(), valueOf: str(), __lookupGetter__: str() },
          additionalProperties: false,
        }),
      ],
      expect: [],
    },
  ),
  jsd("objects", [], {
    title: "type of a property named like an Object.prototype member replaced",
    before: "object { toString: string }",
    after: "object { toString: integer }",
    rationale:
      "a property named `toString` is compared like any other: a replaced type is breaking in both directions (ISSUE-39 convention)",
    annotation: "names the type change and the property `toString`",
    sources: [
      {
        tool: "json-schema-diff",
        ref: "test/unit/json-schema-diff/diff-schemas-regression.spec.ts should not raise errors for a schema with property names matching Object.prototype properties (derived: a change)",
      },
    ],
    schema: [obj({ properties: { toString: str() } }), obj({ properties: { toString: int() } })],
    expect: [{ at: "properties/toString/type", action: "replace", type: breaking, mentions: ["toString"] }],
  }),

  // ---- numbers ----------------------------------------------------------------------------------------------
  jsd(
    "numbers",
    [
      [F.num, "minimum and exclusiveMaximum contradiction"],
      [F.num, "maximum and exclusiveMinimum contradiction"],
      [F.num, "exclusiveMinimum greater than exclusiveMaximum contradiction"],
      [F.num, "exclusiveMinimum equal than exclusiveMaximum contradiction"],
    ],
    {
      title: "contradicting numeric bounds replaced by false",
      before: "number, minimum 4, exclusiveMaximum 2",
      after: "false",
      rationale: `no number is >= 4 and < 2, the before schema already accepts nothing: ${SAME}`,
      annotation: NONE,
      schema: [num({ minimum: 4, exclusiveMaximum: 2 }), false],
      expect: EQUIV,
      // ISSUE-88 (fixed) (P5)
    },
  ),
  jsd(
    "numbers",
    [
      [F.num, "contradiction when no integer exists in minimum/maximum range"],
      [F.num, "contradiction when no integer exists in exclusiveMinimum/exclusiveMaximum range"],
    ],
    {
      title: "integer range without an integer replaced by false",
      before: "integer, minimum 1.3, maximum 1.8",
      after: "false",
      rationale: `no integer lies in [1.3, 1.8]: ${SAME}`,
      annotation: NONE,
      schema: [int({ minimum: 1.3, maximum: 1.8 }), false],
      expect: EQUIV,
      // ISSUE-88 (fixed) (P5)
    },
  ),
  jsd("numbers", [[F.num, "simplified to minimum when minimum is greater than exclusiveMinimum", AS_ASSERTED]], {
    title: "redundant looser exclusiveMinimum removed next to minimum",
    before: "number, minimum 3, exclusiveMinimum 1",
    after: "number, minimum 3",
    rationale: `the effective lower bound is >= 3 on both sides: ${SAME}`,
    annotation: NONE,
    schema: [num({ minimum: 3, exclusiveMinimum: 1 }), num({ minimum: 3 })],
    expect: EQUIV,
    // ISSUE-88 (fixed) (P5)
  }),
  jsd(
    "numbers",
    [[F.num, "simplified to just exclusiveMinimum when exclusiveMinimum and minimum are equal", AS_ASSERTED]],
    {
      title: "minimum equal to exclusiveMinimum removed",
      before: "number, minimum 3, exclusiveMinimum 3",
      after: "number, exclusiveMinimum 3",
      rationale: `the exclusive bound already excludes 3: ${SAME}`,
      annotation: NONE,
      schema: [num({ minimum: 3, exclusiveMinimum: 3 }), num({ exclusiveMinimum: 3 })],
      expect: EQUIV,
      // ISSUE-88 (fixed) (P5)
    },
  ),
  jsd("numbers", [[F.num, "simplified to maximum when maximum is lower than exclusiveMaximum", AS_ASSERTED]], {
    title: "redundant looser exclusiveMaximum removed next to maximum",
    before: "number, maximum 1, exclusiveMaximum 3",
    after: "number, maximum 1",
    rationale: `the effective upper bound is <= 1 on both sides: ${SAME}`,
    annotation: NONE,
    schema: [num({ maximum: 1, exclusiveMaximum: 3 }), num({ maximum: 1 })],
    expect: EQUIV,
    // ISSUE-88 (fixed) (P5)
  }),
  jsd("numbers", [[F.num, "simplified to exclusiveMaximum when exclusiveMaximum is lower than maximum", AS_ASSERTED]], {
    title: "redundant looser maximum removed next to exclusiveMaximum",
    before: "number, maximum 3, exclusiveMaximum 1",
    after: "number, exclusiveMaximum 1",
    rationale: `the effective upper bound is < 1 on both sides: ${SAME}`,
    annotation: NONE,
    schema: [num({ maximum: 3, exclusiveMaximum: 1 }), num({ exclusiveMaximum: 1 })],
    expect: EQUIV,
    // ISSUE-88 (fixed) (P5)
  }),
  jsd(
    "numbers",
    [[F.num, "simplified to just exclusiveMaximum when exclusiveMaximum and maximum are equal", AS_ASSERTED]],
    {
      title: "maximum equal to exclusiveMaximum removed",
      before: "number, maximum 3, exclusiveMaximum 3",
      after: "number, exclusiveMaximum 3",
      rationale: `the exclusive bound already excludes 3: ${SAME}`,
      annotation: NONE,
      schema: [num({ maximum: 3, exclusiveMaximum: 3 }), num({ exclusiveMaximum: 3 })],
      expect: EQUIV,
      // ISSUE-88 (fixed) (P5)
    },
  ),
  jsd("numbers", [[F.num, "integer with decimal minimum simplified by applying ceil function", AS_ASSERTED]], {
    title: "integer minimum 0.8 rewritten as 1",
    before: "integer, minimum 0.8",
    after: "integer, minimum 1",
    rationale: `the smallest valid integer is 1 on both sides: ${SAME}`,
    annotation: NONE,
    schema: [int({ minimum: 0.8 }), int({ minimum: 1 })],
    expect: EQUIV,
    // ISSUE-88 (fixed) (P5)
  }),
  jsd(
    "numbers",
    [[F.num, "integer with decimal exclusiveMinimum simplified by applying floor function", AS_ASSERTED]],
    {
      title: "integer exclusiveMinimum 1.8 rewritten as 1",
      before: "integer, exclusiveMinimum 1.8",
      after: "integer, exclusiveMinimum 1",
      rationale: `the smallest valid integer is 2 on both sides: ${SAME}`,
      annotation: NONE,
      schema: [int({ exclusiveMinimum: 1.8 }), int({ exclusiveMinimum: 1 })],
      expect: EQUIV,
      // ISSUE-88 (fixed) (P5)
    },
  ),
  jsd("numbers", [[F.num, "integer with decimal maximum simplified by applying floor function", AS_ASSERTED]], {
    title: "integer maximum 1.8 rewritten as 1",
    before: "integer, maximum 1.8",
    after: "integer, maximum 1",
    rationale: `the largest valid integer is 1 on both sides: ${SAME}`,
    annotation: NONE,
    schema: [int({ maximum: 1.8 }), int({ maximum: 1 })],
    expect: EQUIV,
    // ISSUE-88 (fixed) (P5)
  }),
  jsd("numbers", [[F.num, "integer with decimal exclusiveMaximum simplified by applying ceil function", AS_ASSERTED]], {
    title: "integer exclusiveMaximum 1.8 rewritten as 2",
    before: "integer, exclusiveMaximum 1.8",
    after: "integer, exclusiveMaximum 2",
    rationale: `the largest valid integer is 1 on both sides: ${SAME}`,
    annotation: NONE,
    schema: [int({ exclusiveMaximum: 1.8 }), int({ exclusiveMaximum: 2 })],
    expect: EQUIV,
    // ISSUE-88 (fixed) (P5)
  }),
  jsd("numbers", [[F.num, "number with minimum and maximum constraints to integer"]], {
    title: "bounded number replaced by an unbounded integer",
    before: "number, minimum -5, maximum 5",
    after: "integer",
    rationale:
      "request: non-integers in [-5, 5] become invalid (type narrowed); response: integers outside [-5, 5] can be returned (loosened response bounds are risky, POLICY-05)",
    annotation: "names the type change and each removed bound",
    schema: [num({ minimum: -5, maximum: 5 }), int()],
    expect: [
      { at: "type", action: "replace", type: rr(breaking, nonBreaking), mentions: ["type"] },
      { at: "minimum", action: "remove", type: rr(nonBreaking, risky), mentions: ["minimum"] },
      { at: "maximum", action: "remove", type: rr(nonBreaking, risky), mentions: ["maximum"] },
    ],
    // ISSUE-130 (fixed): passes since P1 added the risky DiffType
  }),
  jsd("numbers", [[F.num, "number with min/max constraint to integer with partially overlapping min/max constraint"]], {
    title: "bounded number replaced by an integer with a shifted range",
    before: "number, minimum -5, maximum 5",
    after: "integer, minimum 1, maximum 7",
    rationale:
      "request: non-integers and values below 1 become invalid; response: 6 and 7 can be returned (a loosened response bound is risky, POLICY-05)",
    annotation: "names the type change and each changed bound",
    schema: [num({ minimum: -5, maximum: 5 }), int({ minimum: 1, maximum: 7 })],
    expect: [
      { at: "type", action: "replace", type: rr(breaking, nonBreaking), mentions: ["type"] },
      { at: "minimum", action: "replace", type: rr(breaking, nonBreaking), mentions: ["minimum"] },
      { at: "maximum", action: "replace", type: rr(nonBreaking, risky), mentions: ["maximum"] },
    ],
    // ISSUE-130 (fixed): passes since P1 added the risky DiffType
  }),

  // ---- strings ----------------------------------------------------------------------------------------------
  jsd("strings", [[F.str, "string with minLength 0 is all strings"]], {
    title: "minLength: 0 removed (the default value)",
    before: "string, minLength 0",
    after: "string",
    rationale: `\`minLength: 0\` is the default: ${SAME}`,
    annotation: NONE,
    schema: [str({ minLength: 0 }), str()],
    expect: [{ at: "minLength", type: annotation, optional: true }],
    // ISSUE-70 (fixed) (P5)
  }),
  jsd("strings", [[F.str, "string with maxLength and minLength contradict each other"]], {
    title: "contradicting string length bounds replaced by false",
    before: "string, minLength 3, maxLength 1",
    after: "false",
    rationale: `no string is at least 3 and at most 1 characters long: ${SAME}`,
    annotation: NONE,
    schema: [str({ maxLength: 1, minLength: 3 }), false],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd("strings", [[F.str, "adding anyOf two string length ranges to existing range"]], {
    title: "string length range replaced by an anyOf of two ranges",
    before: "string, minLength 2, maxLength 7",
    after: "anyOf [string 6..8, string 0..3]",
    rationale:
      "request: lengths 4..5 become invalid; response: lengths 0, 1 and 8 can be returned (json-schema-diff: added and removed); ASD matches the old schema to the first branch",
    annotation: "names the changed length bounds and the added anyOf branch",
    schema: [
      str({ maxLength: 7, minLength: 2 }),
      { anyOf: [str({ maxLength: 8, minLength: 6 }), str({ maxLength: 3, minLength: 0 })] },
    ],
    expect: [
      { at: ["anyOf/*/maxLength", "maxLength"], type: rr(nonBreaking, breaking), mentions: ["maxLength"] },
      { at: ["anyOf/*/minLength", "minLength"], type: rr(breaking, nonBreaking), mentions: ["minLength"] },
      { at: ["anyOf/*", "anyOf/*/**", "anyOf"], action: "add", type: rr(nonBreaking, breaking), mentions: ["anyOf"] },
    ],
  }),
  jsd("strings", [[F.str, "adding oneOf string length ranges to existing range"]], {
    title: "string length range replaced by a oneOf of two overlapping ranges",
    before: "string, minLength 2, maxLength 7",
    after: "oneOf [string 4..8, string 0..5]",
    rationale:
      "request: lengths 4..5 match both branches and become invalid; response: lengths 0, 1 and 8 can be returned; the overlapping branch added is non-breaking by itself (POLICY-24)",
    annotation: "names the changed length bounds and the added oneOf branch",
    schema: [
      str({ maxLength: 7, minLength: 2 }),
      { oneOf: [str({ maxLength: 8, minLength: 4 }), str({ maxLength: 5, minLength: 0 })] },
    ],
    expect: [
      { at: ["oneOf/*/maxLength", "maxLength"], type: rr(nonBreaking, breaking), mentions: ["maxLength"] },
      { at: ["oneOf/*/minLength", "minLength"], type: rr(breaking, nonBreaking), mentions: ["minLength"] },
      { at: ["oneOf/*", "oneOf/*/**", "oneOf"], action: "add", type: rr(nonBreaking, breaking), mentions: ["oneOf"] },
    ],
  }),
  jsd("strings", [[F.str, "non overlapping string length ranges in allOf are ignored"]], {
    title: "false replaced by an allOf of disjoint string length ranges",
    before: "false",
    after: "allOf [string 5..7, string 2..4]",
    rationale: `no string satisfies both branches, the after schema still accepts nothing: ${SAME}`,
    annotation: NONE,
    schema: [false, { allOf: [str({ maxLength: 7, minLength: 5 }), str({ maxLength: 4, minLength: 2 })] }],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),

  // ---- arrays -----------------------------------------------------------------------------------------------
  jsd(
    "arrays",
    [
      [F.array, "array with items constraint has items constraint made more restrictive"],
      [F.array, "array constrained with items and minItems has the items constraint made less restrictive"],
    ],
    {
      title: "items type array narrowed ([string, number] -> number)",
      before: "array of [string, number]",
      after: "array of number",
      rationale: "request: arrays containing strings become invalid; response: clients receive a subset",
      annotation: "names the type removed from the items schema",
      schema: [arr({ items: { type: ["string", "number"] } }), arr({ items: num() })],
      expect: [{ at: ["items/type", "items/type/*"], type: rr(breaking, nonBreaking), mentions: ["type"] }],
    },
  ),
  jsd("arrays", [[F.array, "numbers and array gets numbers constrained and items constraint"]], {
    title: "type [array, number] narrowed to an array of numbers",
    before: "type: [array, number]",
    after: "array of number",
    rationale: "request: numbers and arrays with non-number items become invalid; response: clients receive a subset",
    annotation: "names the removed type and the added items schema",
    schema: [{ type: ["array", "number"] }, arr({ items: num() })],
    expect: [
      { at: ["type", "type/*"], type: rr(breaking, nonBreaking), mentions: ["type"] },
      { at: ["items", "items/**"], action: "add", type: rr(breaking, nonBreaking), mentions: ["items"] },
    ],
    // ISSUE-92 (fixed)
  }),
  jsd("arrays", [[F.array, "array constrained with contradicting minItems and items"]], {
    title: "array requiring an item while forbidding items replaced by false",
    before: "array, items false, minItems 1",
    after: "false",
    rationale: `only the empty array satisfies items: false, and minItems 1 excludes it: ${SAME}`,
    annotation: NONE,
    schema: [arr({ items: false, minItems: 1 }), false],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd("arrays", [[F.array, "different ways of representing arrays with no items"]], {
    title: "maxItems: 0 rewritten as items: false",
    before: "array, maxItems 0",
    after: "array, items false",
    rationale: `both accept only the empty array: ${SAME}`,
    annotation: NONE,
    schema: [arr({ maxItems: 0 }), arr({ items: false })],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5b)
  }),
  jsd(
    "arrays",
    [[F.array, "array with no items has items constraint relaxed and the maxItems constraint restricted"]],
    {
      title: "empty-only array (items false) relaxed to at most 3 items",
      before: "array, items false",
      after: "array, maxItems 3",
      rationale:
        "request: the empty array stays valid and arrays of 1..3 items become valid, so the added maxItems rejects nothing that was valid; response: clients receive non-empty arrays",
      annotation: "names the removed items schema and the added maxItems",
      schema: [arr({ items: false }), arr({ maxItems: 3 })],
      expect: [
        { at: ["items", "items/**"], action: "remove", type: rr(nonBreaking, breaking), mentions: ["items"] },
        { at: "maxItems", action: "add", type: nonBreaking, mentions: [/max ?items/i] },
      ],
      // ISSUE-153 (fixed) (P5b)
    },
  ),
  jsd("arrays", [[F.array, "array range is expanded in both directions along with a simple object schema change"]], {
    title: "array-or-object schema: item count range widened and a property type replaced",
    before: "type [array, object], minItems 3, maxItems 5, name: string, additionalProperties false",
    after: "type [array, object], minItems 1, maxItems 7, name: number, additionalProperties false",
    rationale:
      "each keyword applies to its own instance type: the widened item count range is non-breaking in a request and breaking in a response, the replaced property type is breaking in both directions",
    annotation: "names minItems, maxItems and the type change of `name`",
    schema: [
      {
        type: ["array", "object"],
        minItems: 3,
        maxItems: 5,
        properties: { name: str() },
        additionalProperties: false,
      },
      {
        type: ["array", "object"],
        minItems: 1,
        maxItems: 7,
        properties: { name: num() },
        additionalProperties: false,
      },
    ],
    expect: [
      { at: "maxItems", action: "replace", type: rr(nonBreaking, breaking), mentions: [/max ?items/i] },
      { at: "minItems", action: "replace", type: rr(nonBreaking, breaking), mentions: [/min ?items/i] },
      { at: "properties/name/type", action: "replace", type: breaking, mentions: ["`name`"] },
    ],
  }),
  jsd("arrays", [[F.main, "additionalProperties and items constraints get relaxed to support a new type"]], {
    title: "array-or-object schema: items and additionalProperties type arrays widened",
    before: "type [array, object], items number, additionalProperties number",
    after: "type [array, object], items [number, string], additionalProperties [number, string]",
    rationale: "request: strings become valid items and property values; response: clients receive them",
    annotation: "names the type added to the items schema and to the additionalProperties schema",
    schema: [
      { type: ["array", "object"], items: num(), additionalProperties: num() },
      {
        type: ["array", "object"],
        items: { type: ["number", "string"] },
        additionalProperties: { type: ["number", "string"] },
      },
    ],
    expect: [
      { at: ["items/type", "items/type/*"], type: rr(nonBreaking, breaking), mentions: ["type"] },
      { at: ["additionalProperties/type", "additionalProperties/type/*"], type: rr(nonBreaking, breaking) },
    ],
  }),

  // ---- objects ----------------------------------------------------------------------------------------------
  jsd("objects", [[F.obj, "additionalProperties constrained to one type gets relaxed with support for another type"]], {
    title: "additionalProperties type array widened (number -> [number, string])",
    before: "object, additionalProperties number",
    after: "object, additionalProperties [number, string]",
    rationale: "request: string values of extra properties become valid; response: clients receive them",
    annotation: "names the type added to the additionalProperties schema",
    schema: [obj({ additionalProperties: num() }), obj({ additionalProperties: { type: ["number", "string"] } })],
    expect: [{ at: ["additionalProperties/type", "additionalProperties/type/*"], type: rr(nonBreaking, breaking) }],
  }),
  jsd("objects", [[F.obj, "objects with 2 property constraints has additionalProperties constrained"]], {
    title: "additionalProperties type array narrowed ([boolean, number] -> number)",
    before: "object { first, last }, additionalProperties [boolean, number]",
    after: "object { first, last }, additionalProperties number",
    rationale: "request: boolean extra properties become invalid; response: clients receive a subset",
    annotation: "names the type removed from the additionalProperties schema",
    schema: [
      obj({ properties: { first: str(), last: str() }, additionalProperties: { type: ["boolean", "number"] } }),
      obj({ properties: { first: str(), last: str() }, additionalProperties: num() }),
    ],
    expect: [{ at: ["additionalProperties/type", "additionalProperties/type/*"], type: rr(breaking, nonBreaking) }],
  }),
  jsd("objects", [[F.obj, "objects get a hard constraint on a property"]], {
    title: "property declared false (forbidden) added to an open object",
    before: "object",
    after: "object { first: true, last: false }",
    rationale:
      "`first: true` accepts any value (no change); `last: false` forbids a property every client could send before: request breaking, response non-breaking",
    annotation: "names the forbidden property `last`",
    schema: [obj(), obj({ properties: { first: true, last: false } })],
    expect: [
      { at: ["properties/first", "properties/first/**"], action: "add", type: nonBreaking, mentions: ["first"] },
      {
        at: ["properties/last", "properties/last/**"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["last"],
      },
    ],
    // POLICY-42 decided (a): compared with the governing schema where `additionalProperties` is an explicit schema
  }),
  jsd("objects", [[F.obj, "redundant property constraint matching additionalProperties constraint is removed"]], {
    title: "property declaration identical to additionalProperties removed",
    before: "object { name: string }, additionalProperties string",
    after: "object, additionalProperties string",
    rationale: `\`name\` stays governed by the identical additionalProperties schema: ${SAME}`,
    annotation: NONE,
    schema: [obj({ properties: { name: str() }, additionalProperties: str() }), obj({ additionalProperties: str() })],
    expect: [{ at: ["properties/name", "properties/name/**"], type: annotation, optional: true }],
    // POLICY-42 decided (a): compared with the governing schema where `additionalProperties` is an explicit schema
  }),
  jsd("objects", [[F.obj, "object with additionalProperties constraint gets a more restrictive property constraint"]], {
    title: "property declared narrower than the additionalProperties schema that governed it",
    before: "object, additionalProperties [string, number]",
    after: "object { name: string }, additionalProperties [string, number]",
    rationale:
      "before, `name` was validated by additionalProperties and could be a number; after, only strings: request breaking, response non-breaking",
    annotation: "names the declared property `name`",
    schema: [
      obj({ additionalProperties: { type: ["string", "number"] } }),
      obj({ properties: { name: str() }, additionalProperties: { type: ["string", "number"] } }),
    ],
    expect: [
      {
        at: ["properties/name", "properties/name/**"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["name"],
      },
    ],
    // POLICY-42 decided (a): compared with the governing schema where `additionalProperties` is an explicit schema
  }),
  jsd(
    "objects",
    [[F.obj, "hard additionalProperties constraint replaced with equivalent maxProperties=0 constraint"]],
    {
      title: "additionalProperties: false rewritten as maxProperties: 0",
      before: "object, additionalProperties false",
      after: "object, maxProperties 0",
      rationale: `both accept only the empty object: ${SAME}`,
      annotation: NONE,
      schema: [obj({ additionalProperties: false }), obj({ maxProperties: 0 })],
      expect: EQUIV,
      // ISSUE-153 (fixed) (P5b)
    },
  ),
  jsd("objects", [[F.obj, "objects with contradicting additionalProperties and minProperties is considered false"]], {
    title: "object forbidding every property while requiring one replaced by false",
    before: "object, additionalProperties false, minProperties 1",
    after: "false",
    rationale: `no object has a property when none is allowed: ${SAME}`,
    annotation: NONE,
    schema: [obj({ additionalProperties: false, minProperties: 1 }), false],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd("objects", [[F.obj, "object with redundant relaxed property constraint gets additionalProperties constraint"]], {
    title: "permissive property declaration removed and additionalProperties: false added",
    before: "object { name: true }",
    after: "object, additionalProperties false",
    rationale:
      "request: every non-empty object becomes invalid (additionalProperties false breaking; removing the declaration is POLICY-03 risky); response: clients receive a subset",
    annotation: "names the removed property and the additionalProperties schema",
    schema: [obj({ properties: { name: true } }), obj({ additionalProperties: false })],
    expect: [
      {
        at: ["properties/name", "properties/name/**"],
        action: "remove",
        type: rr(risky, nonBreaking),
        mentions: ["name"],
      },
      { at: "additionalProperties", action: "add", type: rr(breaking, nonBreaking), mentions: [/additional/i] },
    ],
    // ISSUE-130 (fixed): passes since P1 added the risky DiffType
  }),
  jsd(
    "objects",
    [
      [F.obj, "object with property constraint gets a fully restrictive additionalProperties constraint"],
      [F.obj, "objects with 2 property constraints get additionalProperties that accepts nothing"],
    ],
    {
      title: "additionalProperties: false added next to declared properties",
      before: "object { first, last }",
      after: "object { first, last }, additionalProperties false",
      rationale: "request: objects with extra properties become invalid; response: clients receive a subset",
      annotation: "names the additionalProperties schema",
      schema: [
        obj({ properties: { first: str(), last: str() } }),
        obj({ properties: { first: str(), last: str() }, additionalProperties: false }),
      ],
      expect: [
        { at: "additionalProperties", action: "add", type: rr(breaking, nonBreaking), mentions: [/additional/i] },
      ],
    },
  ),
  jsd(
    "objects",
    [[F.obj, "numbers and property-constrained object gets numbers constrained and additionalProperties constraint"]],
    {
      title: "type [object, number] narrowed to a closed object",
      before: "type [object, number], { name: string }",
      after: "object { name: string }, additionalProperties false",
      rationale:
        "request: numbers and objects with extra properties become invalid; response: clients receive a subset",
      annotation: "names the removed type and the additionalProperties schema",
      schema: [
        { type: ["object", "number"], properties: { name: str() } },
        obj({ properties: { name: str() }, additionalProperties: false }),
      ],
      expect: [
        { at: ["type", "type/*"], type: rr(breaking, nonBreaking), mentions: ["type"] },
        { at: "additionalProperties", action: "add", type: rr(breaking, nonBreaking), mentions: [/additional/i] },
      ],
    },
  ),
  jsd("objects", [[F.obj, "object with required and maxProperties contradiction"]], {
    title: "object requiring two properties with maxProperties 1 replaced by false",
    before: "object, required [first, last], maxProperties 1",
    after: "false",
    rationale: `an object with both required properties has two properties: ${SAME}`,
    annotation: NONE,
    schema: [obj({ maxProperties: 1, required: ["first", "last"] }), false],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd("objects", [[F.obj, "comparing object contradictions at different layers"]], {
    title: "unsatisfiable object replaced by another unsatisfiable object",
    before: "object, required [name], name: false",
    after: "object, required [address], address: { required [street], street: false }",
    rationale: `a required property declared false can never be present, on both sides: ${SAME}`,
    annotation: NONE,
    schema: [
      obj({ properties: { name: false }, required: ["name"] }),
      obj({
        properties: { address: obj({ properties: { street: false }, required: ["street"] }) },
        required: ["address"],
      }),
    ],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5b)
  }),
  jsd("objects", [[F.obj, "object containing a contradiction has all constraints relaxed"]], {
    title: "unsatisfiable object relaxed to any object",
    before: "object, required [name], name: false, additionalProperties false",
    after: "object",
    rationale:
      "request: every object becomes valid (nothing was valid before); response: clients receive objects the before contract excluded (required -> optional in a response is risky, POLICY-05)",
    annotation: "names the removed additionalProperties, property and required entry",
    schema: [obj({ additionalProperties: false, properties: { name: false }, required: ["name"] }), obj()],
    expect: [
      { at: "additionalProperties", action: "remove", type: rr(nonBreaking, breaking), mentions: [/additional/i] },
      {
        at: ["properties/name", "properties/name/**"],
        action: "remove",
        type: rr(nonBreaking, breaking),
        mentions: ["name"],
      },
      { at: ["required", "required/*"], action: "remove", type: rr(nonBreaking, risky), mentions: ["name"] },
    ],
    // ISSUE-130 (fixed): a required entry of a forbidden (`false`) property removed is risky in a response
  }),

  // ---- combinators ------------------------------------------------------------------------------------------
  jsd("combinators", [[F.allof, "allOf restricting top level types to equivalent schema with the type intersection"]], {
    title: "type list restricted by an allOf rewritten as the intersection",
    before: "type [number, string], allOf [number]",
    after: "type: number",
    rationale: `the allOf branch removes strings: ${SAME}`,
    annotation: NONE,
    schema: [{ type: ["number", "string"], allOf: [num()] }, num()],
    expect: EQUIV,
  }),
  jsd("combinators", [[F.allof, "nested allOf schemas to equivalent single type schema"]], {
    title: "nested allOf of type lists rewritten as their intersection",
    before:
      "allOf [allOf [[number, string, boolean], [number, string]], allOf [[number, string, boolean, array], [string]]]",
    after: "type: string",
    rationale: `the intersection of the type lists is string: ${SAME}`,
    annotation: NONE,
    schema: [
      {
        allOf: [
          { allOf: [{ type: ["number", "string", "boolean"] }, { type: ["number", "string"] }] },
          { allOf: [{ type: ["number", "string", "boolean", "array"] }, str()] },
        ],
      },
      str(),
    ],
    expect: EQUIV,
  }),
  jsd("combinators", [[F.allof, "allOf schemas of different types to equivalent false schema"]], {
    title: "allOf of disjoint types rewritten as false",
    before: "allOf [number, string]",
    after: "false",
    rationale: `no value is both a number and a string: ${SAME}`,
    annotation: NONE,
    schema: [{ allOf: [num(), str()] }, false],
    expect: EQUIV,
  }),
  jsd("combinators", [[F.anyof, 'anyOf two "true" schemas to equivalent single "true" schema']], {
    title: "anyOf [true, true] rewritten as true",
    before: "anyOf [true, true]",
    after: "true",
    rationale: `both accept every value: ${SAME}`,
    annotation: NONE,
    schema: [{ anyOf: [true, true] }, true],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd("combinators", [[F.anyof, 'anyOf two "false" schemas to equivalent single "false" schema']], {
    title: "anyOf [false, false] rewritten as false",
    before: "anyOf [false, false]",
    after: "false",
    rationale: `both accept nothing: ${SAME}`,
    annotation: NONE,
    schema: [{ anyOf: [false, false] }, false],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd(
    "combinators",
    [
      [F.anyof, 'anyOf of "false" and "true" to equivalent anyOf "true" and "false"'],
      [F.anyof, 'anyOf of "true" and single-type to equivalent anyOf single-type and "true"'],
      [F.anyof, 'anyOf of "false" and single-type to equivalent anyOf single-type and "false"'],
    ],
    {
      title: "anyOf branches with boolean schemas reordered",
      before: "anyOf [string, true]",
      after: "anyOf [true, string]",
      rationale: "branch order has no meaning",
      annotation: "no diff",
      schema: [{ anyOf: [str(), true] }, { anyOf: [true, str()] }],
      expect: [],
    },
  ),
  jsd(
    "combinators",
    [
      [F.anyof, "union of two disjoint sets using minItems and maxItems representing all arrays"],
      [F.anyof, "all arrays vs union of two disjoint sets using minItems and maxItems representing all arrays"],
    ],
    {
      title: "anyOf partitioning arrays by length rewritten as all arrays",
      before: "anyOf [array minItems 3, array maxItems 2]",
      after: "type: [array]",
      rationale: `every array has at least 3 or at most 2 items: ${SAME}`,
      annotation: NONE,
      schema: [{ anyOf: [arr({ minItems: 3 }), arr({ maxItems: 2 })] }, { type: ["array"] }],
      expect: EQUIV,
      // ISSUE-153 (fixed) (P5b)
    },
  ),
  jsd(
    "combinators",
    [[F.anyof, "removing anyOf and replacing with items, resulting in a contradiction in the removed schema"]],
    {
      title: "anyOf of homogeneous arrays merged into one array of mixed items",
      before: "anyOf [array of string, array of number]",
      after: "array of [string, number]",
      rationale:
        "request: every array valid before stays valid (the removed branch is contained in the widened one), mixed arrays become valid; response: clients receive mixed arrays",
      annotation: "names the type added to the items schema and the removed anyOf branch",
      schema: [
        { anyOf: [arr({ items: str() }), arr({ items: num() })] },
        arr({ items: { type: ["string", "number"] } }),
      ],
      expect: [
        { at: ["anyOf/*/items/**", "items/**"], action: "add", type: rr(nonBreaking, breaking), mentions: ["type"] },
        { at: ["anyOf/*", "anyOf/*/**", "anyOf"], action: "remove", type: nonBreaking, mentions: ["anyOf"] },
      ],
      // ISSUE-153 (fixed) (P5b)
    },
  ),
  jsd("combinators", [[F.anyof, "any of not integers or integers to numbers"]], {
    title: "anyOf [non-integer numbers, integers] rewritten as number",
    before: "anyOf [number not integer, integer]",
    after: "type: number",
    rationale: `every number is an integer or not: ${SAME}`,
    annotation: NONE,
    schema: [{ anyOf: [num({ not: int() }), int()] }, num()],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5b)
  }),
  jsd("combinators", [[F.not, "all types but string is changed to equivalent not string"]], {
    title: "type list of every type but string rewritten as not string",
    before: "type [array, boolean, integer, null, number, object]",
    after: "not: { type: string }",
    rationale: `both accept every non-string value: ${SAME}`,
    annotation: NONE,
    schema: [{ type: ["array", "boolean", "integer", "null", "number", "object"] }, { not: str() }],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5b)
  }),
  jsd("combinators", [[F.not, "from array with minItems constraint to array with the complement of that constraint"]], {
    title: "minItems replaced by its complement (not minItems)",
    before: "array, minItems 2",
    after: "array, not { minItems 2 }",
    rationale:
      "the accepted arrays are swapped (length >= 2 -> length <= 1): removing minItems is non-breaking in a request and breaking in a response, adding not is breaking in a request and non-breaking in a response",
    annotation: "names the removed minItems and the added negated schema",
    schema: [arr({ minItems: 2 }), arr({ not: { minItems: 2 } })],
    expect: [
      { at: "minItems", action: "remove", type: rr(nonBreaking, breaking), mentions: [/min ?items/i] },
      { at: ["not", "not/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/negated|not/i] },
    ],
    // ISSUE-93 (fixed)
  }),
  jsd("combinators", [[F.not, "from array with items constraint to array with the complement of that constraint"]], {
    title: "items schema replaced by its complement (not items)",
    before: "array of string",
    after: "array, not { items: string }",
    rationale:
      "arrays of strings become invalid and arrays with a non-string item valid: the removed items schema is non-breaking in a request and breaking in a response, the added not the reverse",
    annotation: "names the removed items schema and the added negated schema",
    schema: [arr({ items: str() }), arr({ not: { items: str() } })],
    expect: [
      { at: ["items", "items/**"], action: "remove", type: rr(nonBreaking, breaking), mentions: ["items"] },
      { at: ["not", "not/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/negated|not/i] },
    ],
    // ISSUE-93 (fixed)
  }),
  jsd("combinators", [[F.not, "from array with minItems constraint to complement of entire schema"]], {
    title: "array schema replaced by its complement (not { array, minItems })",
    before: "array, minItems 2",
    after: "not { array, minItems 2 }",
    rationale:
      "every value the before schema accepted is rejected and every other value accepted: the removed type and minItems are non-breaking in a request and breaking in a response, the added not the reverse",
    annotation: "names the removed type and minItems and the added negated schema",
    schema: [arr({ minItems: 2 }), { not: arr({ minItems: 2 }) }],
    expect: [
      { at: "type", action: "remove", type: rr(nonBreaking, breaking), mentions: ["type"] },
      { at: "minItems", action: "remove", type: rr(nonBreaking, breaking), mentions: [/min ?items/i] },
      { at: ["not", "not/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/negated|not/i] },
    ],
    // ISSUE-93 (fixed)
  }),
  jsd(
    "combinators",
    [
      [F.not, "two schemas containing different complemented partial arrays"],
      [F.not, "two schemas containing different complemented partial objects"],
    ],
    {
      title: "type replaced inside a negated items schema",
      before: "array, not { items: string }",
      after: "array, not { items: number }",
      rationale:
        "the excluded set changes from all-string arrays to all-number arrays: neither contains the other, breaking in both directions",
      annotation: "names the type change inside the negated schema",
      schema: [arr({ not: { items: str() } }), arr({ not: { items: num() } })],
      expect: [{ at: "not/items/type", action: "replace", type: breaking, mentions: ["type"] }],
    },
  ),
  jsd("combinators", [[F.not, "array with items constraint changed to all types and a not constraint in arrays"]], {
    title: "array of [string, number] replaced by anything but an array of booleans",
    before: "array of [string, number]",
    after: "not { array of boolean }",
    rationale:
      "request: the empty array becomes invalid (it is also an array of booleans); response: clients receive non-arrays and mixed arrays",
    annotation: "names the removed type and items schema and the added negated schema",
    schema: [arr({ items: { type: ["string", "number"] } }), { not: arr({ items: { type: "boolean" } }) }],
    expect: [
      { at: "type", action: "remove", type: rr(nonBreaking, breaking), mentions: ["type"] },
      { at: ["items", "items/**"], action: "remove", type: rr(nonBreaking, breaking), mentions: ["items"] },
      { at: ["not", "not/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/negated|not/i] },
    ],
    // ISSUE-93 (fixed)
  }),
  jsd(
    "combinators",
    [
      [F.not, "DeMorgans with all and some arrays"],
      [F.not, "DeMorgans with some and some arrays"],
    ],
    {
      title: "negated allOf rewritten as anyOf of negations (De Morgan)",
      before: "not { allOf [array of string, array of number] }",
      after: "anyOf [not array of string, not array of number]",
      rationale: `not (A and B) = (not A) or (not B): ${SAME}`,
      annotation: NONE,
      schema: [
        { not: { allOf: [arr({ items: str() }), arr({ items: num() })] } },
        { anyOf: [{ not: arr({ items: str() }) }, { not: arr({ items: num() }) }] },
      ],
      expect: EQUIV,
      // ISSUE-153 (fixed) (P5b)
    },
  ),
  jsd(
    "combinators",
    [[F.not, "from object with minProperties constraint to object with complement of that constraint"]],
    {
      title: "minProperties replaced by its complement (not minProperties)",
      before: "object, minProperties 2",
      after: "object, not { minProperties 2 }",
      rationale:
        "the accepted objects are swapped (>= 2 properties -> <= 1): removing minProperties is non-breaking in a request and breaking in a response, adding not the reverse",
      annotation: "names the removed minProperties and the added negated schema",
      schema: [obj({ minProperties: 2 }), obj({ not: { minProperties: 2 } })],
      expect: [
        { at: "minProperties", action: "remove", type: rr(nonBreaking, breaking), mentions: [/min ?properties/i] },
        { at: ["not", "not/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/negated|not/i] },
      ],
      // ISSUE-93 (fixed)
    },
  ),
  jsd("combinators", [[F.not, "from object with additionalProperties to object with complement of that constraint"]], {
    title: "additionalProperties schema replaced by its complement",
    before: "object, additionalProperties string",
    after: "object, not { additionalProperties string }",
    rationale:
      "objects whose values are all strings become invalid and objects with a non-string value valid: the removed additionalProperties is non-breaking in a request and breaking in a response, the added not the reverse",
    annotation: "names the removed additionalProperties schema and the added negated schema",
    schema: [obj({ additionalProperties: str() }), obj({ not: { additionalProperties: str() } })],
    expect: [
      {
        at: ["additionalProperties", "additionalProperties/**"],
        action: "remove",
        type: rr(nonBreaking, breaking),
        mentions: [/additional/i],
      },
      { at: ["not", "not/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/negated|not/i] },
    ],
    // ISSUE-93 (fixed)
  }),
  jsd(
    "combinators",
    [[F.not, "a schema containing a contradiction between additionalProperties involving not + anyOf"]],
    {
      title: "object contradicting its own negated anyOf replaced by false",
      before:
        "object, additionalProperties string, not anyOf [{ additionalProperties string }, { additionalProperties number }]",
      after: "false",
      rationale: `every object of the before schema matches the first negated branch: ${SAME}`,
      annotation: NONE,
      schema: [
        obj({
          additionalProperties: str(),
          not: { anyOf: [{ additionalProperties: str() }, { additionalProperties: num() }] },
        }),
        false,
      ],
      expect: EQUIV,
      // ISSUE-153 (fixed) (P5b)
    },
  ),
  jsd(
    "combinators",
    [[F.not, "from numbers with integer constraint to numbers with the complement of that constraint"]],
    {
      title: "integer replaced by non-integer numbers (number, not integer)",
      before: "integer",
      after: "number, not integer",
      rationale:
        "integers become invalid and fractions valid: the widened type is non-breaking in a request and breaking in a response, the added not the reverse",
      annotation: "names the type change and the added negated schema",
      schema: [int(), num({ not: int() })],
      expect: [
        { at: "type", action: "replace", type: rr(nonBreaking, breaking), mentions: ["type"] },
        { at: ["not", "not/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/negated|not/i] },
      ],
      // ISSUE-93 (fixed)
    },
  ),
  jsd("combinators", [[F.not, "from numbers with integer to double negation of integer"]], {
    title: "integer rewritten as number, not not integer",
    before: "integer",
    after: "number, not { not integer }",
    rationale: `a double negation cancels out: ${SAME}`,
    annotation: NONE,
    schema: [int(), num({ not: { not: int() } })],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5b)
  }),
  jsd("combinators", [[F.oneof, "type to equivalent oneOf for that type"]], {
    title: "type wrapped in an equivalent single-branch oneOf",
    before: "type: string",
    after: "oneOf [string]",
    rationale: `a one-branch oneOf is its branch: ${SAME}`,
    annotation: NONE,
    schema: [str(), { oneOf: [str()] }],
    expect: EQUIV,
  }),
  jsd("combinators", [[F.oneof, "duplicate oneOf schemas creating a contradiction"]], {
    title: "oneOf of two identical branches rewritten as false",
    before: "oneOf [number, number]",
    after: "false",
    rationale: `every number matches both branches, so oneOf accepts nothing: ${SAME}`,
    annotation: NONE,
    schema: [{ oneOf: [num(), num()] }, false],
    expect: EQUIV,
    // ISSUE-153 (fixed) (P5)
  }),
  jsd(
    "combinators",
    [[F.oneof, "oneOf containing partial array schemas that are equivalent to all arrays of numbers"]],
    {
      title: "oneOf partitioning arrays of numbers by length rewritten as all arrays of numbers",
      before: "oneOf [array of number maxItems 1, array of number minItems 2]",
      after: "array of number",
      rationale: `the branches are disjoint and together cover every array of numbers: ${SAME}`,
      annotation: NONE,
      schema: [
        { oneOf: [arr({ items: num(), maxItems: 1 }), arr({ items: num(), minItems: 2 })] },
        arr({ items: num() }),
      ],
      expect: EQUIV,
      // ISSUE-153 (fixed) (P5b)
    },
  ),

  // ---- refs -------------------------------------------------------------------------------------------------
  jsd("refs", [[F.refs, "schema with nested string reference to schema with nested number reference"]], {
    title: "draft-07: type of a definition reached through a nested $ref replaced",
    before: "id: $ref basic_object { content: $ref basic_type (string) }",
    after: "id: $ref basic_object { content: $ref basic_type (number) }",
    rationale: "the resolved type of `id.content` changes: breaking in both directions (ISSUE-39 convention)",
    annotation: "names the type change",
    placements: ["json"],
    draft: "http://json-schema.org/draft-07/schema#",
    schema: [
      obj({
        definitions: {
          basic_object: obj({ properties: { content: { $ref: "#/definitions/basic_type" } } }),
          basic_type: str(),
        },
        properties: { id: { $ref: "#/definitions/basic_object" } },
      }),
      obj({
        definitions: {
          basic_object: obj({ properties: { content: { $ref: "#/definitions/basic_type" } } }),
          basic_type: num(),
        },
        properties: { id: { $ref: "#/definitions/basic_object" } },
      }),
    ],
    expect: [
      {
        at: ["definitions/**/type", "properties/id/**/type"],
        action: "replace",
        type: breaking,
        mentions: ["type"],
      },
    ],
  }),
]
