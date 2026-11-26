// JSON Schema combinators: allOf (merged), oneOf / anyOf branches, oneOf <-> anyOf, wrapping in oneOf, not,
// if / then / else.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type SchemaCase, risky } from "../../helpers/compat"
import { anyType, body, both, property, rr, seq, withJsd } from "./kw"

const id = seq("CMB")
const general = "test/compatibility-suites/schemas/schema-test-runner-general.ts"
const cs = (name: string, verdict?: string) => [
  { tool: "compat-suites", ref: `schemas/json-schema/${name}` },
  { tool: "fork", ref: `${general} ${name}`, ...(verdict ? { verdict } : {}) },
]
const oas = (ref: string, verdict?: string) => ({ tool: "oasdiff", ref, ...(verdict ? { verdict } : {}) })
const lib = (ref: string, verdict?: string) => ({
  tool: "libopenapi",
  ref: `what-changed/model/schema_test.go ${ref}`,
  ...(verdict ? { verdict } : {}),
})
const od = (ref: string, verdict?: string) => ({
  tool: "openapi-diff",
  ref: `core/src/test/java/org/openapitools/openapidiff/core/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const aj = (file: string, ref: string) => ({
  tool: "json-schema-diff",
  ref: `test/unit/json-schema-diff/diff-schemas-${file}.spec.ts ${ref}`,
})

const s = { type: "string" }
const i = { type: "integer" }
const b = { type: "boolean" }
const obj = (properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: "object",
  properties,
  ...extra,
})

// if kind = <kind> then required [code] (else <otherwise>)
const cond = (kind: string, otherwise?: unknown) => ({
  if: { properties: { kind: { const: kind } } },
  // biome-ignore lint/suspicious/noThenProperty: `then` is a JSON Schema keyword
  then: { required: ["code"] },
  ...(otherwise ? { else: otherwise } : {}),
})

// POLICY-03 decided (c): removing a request property is risky (oasdiff WARN); the response keeps its definite class

const own: SchemaCase[] = [
  ...both({
    id: id(2),
    title: "allOf branch with an optional property added",
    before: "allOf [{ a }]",
    after: "allOf [{ a }, { b }]",
    rationale:
      "after merging, an optional property is added: harmless in both directions (oasdiff flags any added allOf subschema in a request as ERR without looking at its content)",
    annotation: "names the added property",
    sources: [
      ...cs("add-all-of"),
      ...cs("add-all-of-option"),
      oas("checker/check_request_property_all_of_updated_test.go TestRequestPropertyAllOfAdded", "request: ERR"),
    ],
    stems: ["all-of-added"],
    schema: [{ allOf: [obj({ a: s })] }, { allOf: [obj({ a: s }), obj({ b: s })] }],
    expect: [{ at: ["properties/b", "allOf/*/**", "allOf/*"], action: "add", type: nonBreaking, mentions: ["b"] }],
  }),
  ...both({
    id: id(2),
    title: "allOf branch with a constraint added (required)",
    before: "allOf [{ a, b }]",
    after: "allOf [{ a, b }, { required [b] }]",
    rationale: "the conjunction is narrower: request breaking, response non-breaking",
    annotation: "names the newly required property",
    sources: [oas("checker/check_request_property_all_of_updated_test.go TestRequestPropertyAllOfAdded")],
    stems: ["all-of-added"],
    schema: [{ allOf: [obj({ a: s, b: s })] }, { allOf: [obj({ a: s, b: s }), { required: ["b"] }] }],
    expect: [
      {
        at: ["required", "required/*", "allOf/*/**", "allOf/*"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["b"],
      },
    ],
    // ISSUE-91 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "allOf branch with an optional property removed",
    before: "allOf [{ a }, { b }]",
    after: "allOf [{ a }]",
    rationale:
      "after merging, an optional property is removed: response non-breaking (oasdiff ERR on any removed allOf subschema in a response); request: risky (POLICY-03)",
    annotation: "names the removed property",
    sources: [
      ...cs("remove-all-of", "request: breaking"),
      ...cs("remove-all-of-option", "request: breaking"),
      oas("checker/check_response_property_all_of_updated_test.go TestResponsePropertyAllOfRemoved", "response: ERR"),
    ],
    stems: ["all-of-removed"],
    schema: [{ allOf: [obj({ a: s }), obj({ b: s })] }, { allOf: [obj({ a: s })] }],
    expect: [
      {
        at: ["properties/b", "allOf/*/**", "allOf/*"],
        action: "remove",
        type: rr(risky, nonBreaking),
        mentions: ["b"],
      },
    ],
    // ISSUE-130 (fixed): POLICY-03 decided (c)
  }),
  ...both({
    id: id(2),
    title: "allOf branch with a constraint removed (required)",
    before: "allOf [{ a, b }, { required [b] }]",
    after: "allOf [{ a, b }]",
    rationale:
      "the conjunction is wider: request non-breaking, response: b may be missing (required -> optional in a response, POLICY-05 decided (b): risky)",
    annotation: "names the property that is no longer required",
    sources: [oas("checker/check_response_property_all_of_updated_test.go TestResponsePropertyAllOfRemoved")],
    stems: ["all-of-removed"],
    schema: [{ allOf: [obj({ a: s, b: s }), { required: ["b"] }] }, { allOf: [obj({ a: s, b: s })] }],
    // decision §11.14 (POLICY-05 decided (b)): required -> optional in a response is risky (the expectation read
    // breaking, hidden behind ISSUE-91 until the merged `required` was classified)
    expect: [
      {
        at: ["required", "required/*", "allOf/*/**", "allOf/*"],
        action: "remove",
        type: rr(nonBreaking, risky),
        mentions: ["b"],
      },
    ],
    // ISSUE-91 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "allOf branch with annotations only added",
    before: "allOf [{ a }]",
    after: "allOf [{ a }, { title: Pet }]",
    rationale:
      "a branch without assertions does not change the valid values (oasdiff all-of-added-annotation-only INFO, OAS discussion #3793)",
    annotation: "an annotation naming the keyword (title)",
    sources: [
      oas(
        "checker/check_request_property_all_of_updated_test.go TestRequestPropertyAllOfAdded_AnnotationOnly_EmitsInfo",
      ),
    ],
    stems: ["all-of-added-annotation-only"],
    schema: [{ allOf: [obj({ a: s })] }, { allOf: [obj({ a: s }), { title: "Pet" }] }],
    expect: [{ at: ["title", "allOf/*", "allOf/*/**"], action: "add", type: annotation, mentions: ["title"] }],
  }),
  ...both({
    id: id(2),
    title: "allOf branch with annotations only removed",
    before: "allOf [{ a }, { title: Pet }]",
    after: "allOf [{ a }]",
    rationale: "a branch without assertions does not change the valid values",
    annotation: "an annotation naming the keyword (title)",
    sources: [
      oas(
        "checker/check_response_property_all_of_updated_test.go TestResponsePropertyAllOfAdded_AnnotationOnly_EmitsInfoWithDistinctId",
      ),
    ],
    stems: ["all-of-removed-annotation-only"],
    schema: [{ allOf: [obj({ a: s }), { title: "Pet" }] }, { allOf: [obj({ a: s })] }],
    expect: [{ at: ["title", "allOf/*", "allOf/*/**"], action: "remove", type: annotation, mentions: ["title"] }],
  }),
  body({
    id: id(),
    title: "properties moved into an equivalent allOf",
    before: "object { a, b }, required [a, b]",
    after: "allOf [{ a, required [a] }, { b, required [b] }]",
    rationale: "the merged schema is identical: no change (libopenapi merge view, openapi-diff)",
    annotation: "no diff",
    sources: [
      lib("TestCompareSchemas_AllOfEquivalentObjectRewrite_NonBreaking"),
      od("AllOfDiffTest.java testDiffSameWithAllOf"),
      aj("allof", "multiple properties in single schema to equivalent allOf schemas of single properties"),
    ],
    schema: [
      obj({ a: s, b: s }, { required: ["a", "b"] }),
      { allOf: [obj({ a: s }, { required: ["a"] }), obj({ b: s }, { required: ["b"] })] },
    ],
    expect: [],
  }),
  body({
    id: id(),
    title: "type wrapped in an equivalent single-branch allOf",
    before: "type: string",
    after: "allOf [{ type: string }]",
    rationale: "the same schema",
    annotation: "no diff",
    sources: [aj("allof", "type to equivalent allOf that type")],
    schema: [s, { allOf: [s] }],
    expect: [],
  }),
  body({
    id: id(),
    title: "schema became unsatisfiable through a contradicting allOf",
    before: "type: string",
    after: "allOf [{ type: object }, { type: string }]",
    rationale: "no value satisfies both branches: request and response breaking",
    annotation: "states that the type changed to nothing / no value is valid",
    sources: [
      ...cs("update-schema-type-from-specific-type-to-nothing"),
      { tool: "fork", ref: "test/bugs.test.ts change type to nothing in response" },
      aj("allof", "allOf schemas of different types to equivalent false schema"),
    ],
    schema: [{ description: "x", type: "string" }, { allOf: [{ type: "object" }, { type: "string" }] }],
    expect: [{ at: ["", "type", "**"], type: breaking }],
    // POLICY-40 decided (a); ISSUE-89 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "unsatisfiable allOf replaced by a specific type",
    before: "allOf [{ type: object }, { type: string }]",
    after: "type: string",
    rationale: "nothing was valid before, so nothing can break",
    annotation: "states the new type",
    sources: cs("update-schema-type-from-nothing-to-specific-type"),
    schema: [{ allOf: [{ type: "object" }, { type: "string" }] }, { description: "x", type: "string" }],
    expect: [{ at: ["", "type", "**"], type: nonBreaking }],
    // POLICY-40 decided (a); ISSUE-89 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "oneOf branch added (disjoint)",
    before: "oneOf [string, integer]",
    after: "oneOf [string, integer, boolean]",
    rationale:
      "request: booleans become acceptable (no old value matches the new branch, so exclusivity holds); response: clients receive booleans",
    annotation: "names the added oneOf branch and the location",
    sources: [...cs("add-one-of-option"), od("OneOfBCTest.java responseIncreased")],
    stems: ["one-of-added"],
    schema: [{ oneOf: [s, i] }, { oneOf: [s, i, b] }],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], action: "add", type: rr(nonBreaking, breaking), mentions: ["oneOf"] }],
  }),
  ...both({
    id: id(2),
    title: "oneOf branch removed",
    before: "oneOf [string, integer, boolean]",
    after: "oneOf [string, integer]",
    rationale: "request: booleans become invalid; response: clients receive a subset",
    annotation: "names the removed oneOf branch and the location",
    sources: [...cs("remove-one-of-option"), od("OneOfBCTest.java requestDecreased")],
    stems: ["one-of-removed"],
    schema: [{ oneOf: [s, i, b] }, { oneOf: [s, i] }],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], action: "remove", type: rr(breaking, nonBreaking), mentions: ["oneOf"] }],
  }),
  property({
    id: id(),
    title: "oneOf branch added that overlaps an existing branch",
    before: "name: oneOf [string, integer]",
    after: "name: oneOf [string, integer, number]",
    rationale:
      "POLICY-24 (a): a branch addition widens, so the request is non-breaking (ASD, structural tools), although every integer now matches two branches and a strict `oneOf` validator rejects it; response: clients receive fractions",
    annotation: "names the added oneOf branch and the property",
    sources: [
      oas(
        "checker/check_response_required_property_updated_test.go TestResponsePropertyOneOfWrappedOriginalPreserved (overlap reasoning)",
        "WARN",
      ),
      aj("oneof", "duplicate oneOf schemas creating a contradiction"),
    ],
    stems: ["one-of-added"],
    schema: [{ oneOf: [s, i] }, { oneOf: [s, i, { type: "number" }] }],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], action: "add", type: rr(nonBreaking, breaking), mentions: ["oneOf"] }],
    // POLICY-24 decided (a)
  }),
  ...both({
    id: id(2),
    title: "anyOf branch added",
    before: "anyOf [string, integer]",
    after: "anyOf [string, integer, boolean]",
    rationale: "request: booleans become acceptable; response: clients receive booleans",
    annotation: "names the added anyOf branch and the location",
    sources: [
      ...cs("add-any-of-option"),
      oas("checker/check_request_property_any_of_updated_test.go TestRequestPropertyAnyOfAdded"),
    ],
    stems: ["any-of-added"],
    schema: [{ anyOf: [s, i] }, { anyOf: [s, i, b] }],
    expect: [{ at: ["anyOf/*", "anyOf/*/**"], action: "add", type: rr(nonBreaking, breaking), mentions: ["anyOf"] }],
  }),
  ...both({
    id: id(2),
    title: "anyOf branch removed",
    before: "anyOf [string, integer, boolean]",
    after: "anyOf [string, integer]",
    rationale: "request: booleans become invalid; response: clients receive a subset",
    annotation: "names the removed anyOf branch and the location",
    sources: [
      ...cs("remove-any-of-option"),
      oas("checker/check_request_property_any_of_updated_test.go TestRequestPropertyAnyOfRemoved"),
    ],
    stems: ["any-of-removed"],
    schema: [{ anyOf: [s, i, b] }, { anyOf: [s, i] }],
    expect: [{ at: ["anyOf/*", "anyOf/*/**"], action: "remove", type: rr(breaking, nonBreaking), mentions: ["anyOf"] }],
  }),
  body({
    id: id(),
    title: "oneOf introduced on an object schema (add-one-of)",
    before: "object { a }",
    after: "oneOf [{ object a }, { object b }]",
    rationale:
      "an alternative is added next to the original shape: request non-breaking, response: clients receive the new shape",
    annotation: "names the added oneOf branch",
    sources: [...cs("add-one-of"), ...cs("add-any-of")],
    covers: ["oasdiff:request-body-one-of-added", "oasdiff:response-body-one-of-added"],
    schema: [
      obj({ a: s }, { required: ["a"] }),
      { oneOf: [obj({ a: s }, { required: ["a"] }), obj({ b: s }, { required: ["b"] })] },
    ],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], action: "add", type: rr(nonBreaking, breaking), mentions: ["oneOf"] }],
  }),
  body({
    id: id(),
    title: "oneOf dissolved into one of its branches (remove-one-of)",
    before: "oneOf [{ object a }, { object b }]",
    after: "object { a }",
    rationale: "an alternative is removed: request breaking, response non-breaking",
    annotation: "names the removed oneOf branch",
    sources: [...cs("remove-one-of"), ...cs("remove-any-of")],
    covers: ["oasdiff:request-body-one-of-removed", "oasdiff:response-body-one-of-removed"],
    schema: [
      { oneOf: [obj({ a: s }, { required: ["a"] }), obj({ b: s }, { required: ["b"] })] },
      obj({ a: s }, { required: ["a"] }),
    ],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], action: "remove", type: rr(breaking, nonBreaking), mentions: ["oneOf"] }],
  }),
  body({
    id: id(),
    title: "oneOf branches reordered",
    before: "oneOf [string, integer]",
    after: "oneOf [integer, string]",
    rationale: "branch order has no meaning",
    annotation: "no diff",
    sources: [
      lib("TestCompareSchemas_OneOfReferencedReorderIsNoop"),
      od("OneOfDiffTest.java testOneOfDiscrimitatorMissingDifferentOrder"),
    ],
    schema: [{ oneOf: [s, i] }, { oneOf: [i, s] }],
    expect: [],
  }),
  body({
    id: id(),
    title: "oneOf branch modified (nested property type)",
    before: "oneOf [{ object a: string }, integer]",
    after: "oneOf [{ object a: integer }, integer]",
    rationale: "the matched branch changes a property type: breaking in both directions",
    annotation: "names the type change inside the branch",
    sources: [
      lib("TestCompareSchemas_AnyOfModified"),
      oas("checker/check_response_property_type_changed_test.go TestResponsePropertyAnyOfModified"),
    ],
    schema: [{ oneOf: [obj({ a: s }), i] }, { oneOf: [obj({ a: i }), i] }],
    expect: [{ at: "oneOf/*/properties/a/type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  body({
    id: id(),
    title: "oneOf branch description changed",
    before: "oneOf [{ string, description x }, integer]",
    after: "oneOf [{ string, description y }, integer]",
    rationale: "only an annotation changes (oasdiff reports nothing)",
    annotation: "an annotation naming the keyword",
    sources: [
      oas("checker/check_response_property_one_of_updated_test.go TestResponsePropertyOneOfDescriptionOnlyChange"),
    ],
    schema: [{ oneOf: [{ ...s, description: "x" }, i] }, { oneOf: [{ ...s, description: "y" }, i] }],
    expect: [{ at: "oneOf/*/description", action: "replace", type: annotation, mentions: ["description"] }],
  }),
  // POLICY-44 decided (b) (changed from the proposal): over disjoint branches oneOf and anyOf accept the same values, so
  // the switch is an annotation in both directions; keyword-level over overlapping branches (JS-CMB-054 / 055)
  ...both({
    id: id(2),
    title: "oneOf -> anyOf",
    before: "oneOf [string, integer]",
    after: "anyOf [string, integer]",
    rationale:
      "the branches are disjoint (different JSON types), so no value matches two of them and anyOf accepts exactly what oneOf accepted: an equivalent rewrite (POLICY-44 decided (b))",
    annotation: "names the combiner change (oneOf to anyOf) and the location",
    sources: [
      od("OneOfDiffTest.java testOneOfToAnyOfDoesNotThrow"),
      { tool: "asd", ref: "src/jsonSchema/jsonSchema.classify.ts combinerKeyClassifyRule" },
    ],
    schema: [{ oneOf: [s, i] }, { anyOf: [s, i] }],
    expect: [{ at: ["", "oneOf", "anyOf"], type: annotation, mentions: ["oneOf", "anyOf"] }],
  }),
  ...both({
    id: id(2),
    title: "anyOf -> oneOf",
    before: "anyOf [string, number]",
    after: "oneOf [string, number]",
    rationale:
      "the branches are disjoint (different JSON types): no value matches both, so oneOf accepts exactly what anyOf accepted (POLICY-44 decided (b))",
    annotation: "names the combiner change (anyOf to oneOf) and the location",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.classify.ts combinerKeyClassifyRule" }],
    schema: [{ anyOf: [s, { type: "number" }] }, { oneOf: [s, { type: "number" }] }],
    expect: [{ at: ["", "oneOf", "anyOf"], type: annotation, mentions: ["oneOf", "anyOf"] }],
  }),
  body({
    id: id(),
    title: "body wrapped in oneOf without the original shape",
    before: "object { id }, required [id]",
    after: "oneOf [{ object { code }, required [code] }, string]",
    rationale:
      "the original shape is gone: request and response breaking (oasdiff reports a single wrapped-in-one-of finding)",
    annotation: "names the replaced shape / the new alternatives",
    sources: [
      oas("checker/check_response_required_property_updated_test.go TestResponsePropertyOneOfWrappingIsBreaking"),
    ],
    covers: ["oasdiff:request-body-wrapped-in-one-of", "oasdiff:response-body-wrapped-in-one-of"],
    schema: [obj({ id: s }, { required: ["id"] }), { oneOf: [obj({ code: s }, { required: ["code"] }), s] }],
    // ISSUE-150 (fixed, P5): the original object is paired with the object branch (same type), not with the string
    // branch, so the breaking change is the replaced required property (was a `type` replace of the mis-paired branch)
    expect: {
      request: [
        { at: "oneOf/*/required/*", action: "add", type: breaking, mentions: ["code"] },
        { at: ["oneOf/*/**", "oneOf/*", "**"], type: anyType, optional: true },
      ],
      response: [
        { at: "oneOf/*/required/*", action: "remove", type: breaking, mentions: ["id"] },
        { at: ["oneOf/*/**", "oneOf/*", "**"], type: anyType, optional: true },
      ],
    },
  }),
  body({
    id: id(),
    title: "body wrapped in oneOf keeping the original shape",
    before: "object { id }",
    after: "oneOf [{ object { id } }, string]",
    rationale:
      "request: the original objects stay valid and the new string branch is disjoint (oasdiff WARN: overlap unknown in general); response: clients receive strings",
    annotation: "names the added oneOf alternative",
    sources: [
      oas(
        "checker/check_response_required_property_updated_test.go TestResponsePropertyOneOfWrappedOriginalPreserved",
        "WARN",
      ),
    ],
    covers: [
      "oasdiff:request-body-wrapped-in-one-of-original-preserved",
      "oasdiff:response-body-wrapped-in-one-of-original-preserved",
    ],
    schema: [obj({ id: s }, { required: ["id"] }), { oneOf: [obj({ id: s }, { required: ["id"] }), s] }],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], action: "add", type: rr(nonBreaking, breaking), mentions: ["oneOf"] }],
  }),
  ...both({
    id: id(2),
    title: "not added",
    before: "string",
    after: 'string, not: { const: "" }',
    rationale: "request: the empty string becomes invalid; response: clients receive a subset",
    annotation: "names the negated schema and the location",
    sources: [
      lib("TestCompareSchemas_NotAdded"),
      aj("not", "all types but string is changed to equivalent not string"),
    ],
    schema: [s, { ...s, not: { const: "" } }],
    expect: [{ at: ["not", "not/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/negated|not/i] }],
    // ISSUE-93 (fixed)
  }),
  ...both({
    id: id(2),
    title: "not removed",
    before: 'string, not: { const: "" }',
    after: "string",
    rationale: "request: the empty string becomes acceptable; response: clients can receive it",
    annotation: "names the negated schema and the location",
    sources: [lib("TestCompareSchemas_NotRemoved")],
    schema: [{ ...s, not: { const: "" } }, s],
    expect: [{ at: ["not", "not/**"], action: "remove", type: rr(nonBreaking, breaking), mentions: [/negated|not/i] }],
  }),
  property({
    id: id(),
    title: "not: excluded set widened (not enum [a] -> not enum [a, b])",
    before: "name: string, not enum [a]",
    after: "name: string, not enum [a, b]",
    rationale:
      "one more value is excluded: request breaking, response non-breaking (the polarity under `not` is inverted; libopenapi ignores it)",
    annotation: "names the change inside the negated schema and the property",
    sources: [
      lib("TestCompareSchemas_NotModifyAndAddItem", "breaking"),
      oas("checker/check_sub_schema_traversal_test.go TestNotSubSchemaTraversalModifiedProperty"),
    ],
    schema: [
      { ...s, not: { enum: ["a"] } },
      { ...s, not: { enum: ["a", "b"] } },
    ],
    expect: [{ at: ["not/enum/*", "not/enum"], type: rr(breaking, nonBreaking) }],
    // ISSUE-57 (fixed) (P8a)
  }),
  property({
    id: id(),
    title: "not: excluded set narrowed (not enum [a, b] -> not enum [a])",
    before: "name: string, not enum [a, b]",
    after: "name: string, not enum [a]",
    rationale: "b becomes valid: request non-breaking, response: clients can receive b",
    annotation: "names the change inside the negated schema and the property",
    sources: [aj("not", "double negation: nothing accepted to not not string")],
    schema: [
      { ...s, not: { enum: ["a", "b"] } },
      { ...s, not: { enum: ["a"] } },
    ],
    expect: [{ at: ["not/enum/*", "not/enum"], type: rr(nonBreaking, breaking) }],
    // ISSUE-57 (fixed) (P8a)
  }),
  ...both({
    id: id(2),
    title: "if / then added",
    before: "object { kind, code }",
    after: "object { kind, code }, if kind = a then required [code]",
    rationale:
      "request: objects with kind a and no code become invalid; response: clients receive a subset (oasdiff: if-added and then-added ERR)",
    annotation: "names the conditional schema and the location",
    sources: [
      oas("checker/check_request_property_if_updated_test.go TestRequestBodyIfAdded / TestRequestPropertyIfAdded"),
      lib("TestCompareSchemas_If_Added"),
    ],
    stems: ["if-added", "then-added"],
    schema: [obj({ kind: s, code: s }), obj({ kind: s, code: s }, cond("a"))],
    expect: [
      { at: ["then", "then/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/then|conditional/i] },
      { at: ["if", "if/**"], action: "add", type: anyType, optional: true },
    ],
    // ISSUE-100 (fixed) (P8a)
  }),
  ...both({
    id: id(2),
    title: "if / then removed",
    before: "object { kind, code }, if kind = a then required [code]",
    after: "object { kind, code }",
    rationale: "request: accepts more objects; response: clients relying on code when kind is a can fail",
    annotation: "names the conditional schema and the location",
    sources: [
      oas(
        "checker/check_request_property_if_updated_test.go TestRequestBodyIfRemoved / checker/check_response_property_if_updated_test.go TestResponseBodyIfRemoved",
      ),
      lib("TestCompareSchemas_If_Removed"),
    ],
    stems: ["if-removed", "then-removed"],
    schema: [obj({ kind: s, code: s }, cond("a")), obj({ kind: s, code: s })],
    expect: [
      { at: ["then", "then/**"], action: "remove", type: rr(nonBreaking, breaking), mentions: [/then|conditional/i] },
      { at: ["if", "if/**"], action: "remove", type: anyType, optional: true },
    ],
    // ISSUE-100 (fixed) (P8a)
  }),
  ...both({
    id: id(2),
    title: "else added",
    before: "if kind = a then required [code]",
    after: "if kind = a then required [code] else required [reason]",
    rationale: "request: objects with another kind and no reason become invalid; response: clients receive a subset",
    annotation: "names the else schema and the location",
    sources: [
      oas("checker/check_request_property_if_updated_test.go (else added)"),
      lib("TestCompareSchemas_Else_Added"),
    ],
    stems: ["else-added"],
    schema: [
      obj({ kind: s, code: s, reason: s }, cond("a")),
      obj({ kind: s, code: s, reason: s }, cond("a", { required: ["reason"] })),
    ],
    expect: [
      { at: ["else", "else/**"], action: "add", type: rr(breaking, nonBreaking), mentions: [/else|conditional/i] },
    ],
    // ISSUE-100 (fixed) (P8a)
  }),
  ...both({
    id: id(2),
    title: "else removed",
    before: "if kind = a then required [code] else required [reason]",
    after: "if kind = a then required [code]",
    rationale: "request: accepts more objects; response: reason may be missing",
    annotation: "names the else schema and the location",
    sources: [
      oas("checker/check_request_property_if_updated_test.go (else removed)"),
      lib("TestCompareSchemas_Else_Removed"),
    ],
    stems: ["else-removed"],
    schema: [
      obj({ kind: s, code: s, reason: s }, cond("a", { required: ["reason"] })),
      obj({ kind: s, code: s, reason: s }, cond("a")),
    ],
    expect: [
      { at: ["else", "else/**"], action: "remove", type: rr(nonBreaking, breaking), mentions: [/else|conditional/i] },
    ],
    // ISSUE-100 (fixed) (P8a)
  }),
  body({
    id: id(),
    title: "if condition changed",
    before: "if kind = a then required [code]",
    after: "if kind = b then required [code]",
    rationale:
      "objects with kind b must now carry code (request breaking) and objects with kind a no longer do (response breaking)",
    annotation: "names the change inside the condition",
    sources: [lib("TestCompareSchemas_If")],
    schema: [obj({ kind: s, code: s }, cond("a")), obj({ kind: s, code: s }, cond("b"))],
    expect: [{ at: ["if", "if/**"], type: breaking, mentions: [/conditional|if/i] }],
    // ISSUE-100 (fixed) (P8-rest)
  }),
  body({
    id: id(),
    title: "if added without then / else",
    before: "object { kind }",
    after: "object { kind }, if kind = a",
    rationale: "an `if` without `then` / `else` has no effect on validation (oasdiff still reports if-added ERR)",
    annotation: "an annotation (or no diff)",
    sources: [oas("checker/check_request_property_if_updated_test.go TestRequestBodyIfAdded", "ERR")],
    schema: [obj({ kind: s }), obj({ kind: s }, { if: { properties: { kind: { const: "a" } } } })],
    expect: [{ at: ["if", "if/**"], type: annotation, optional: true }],
    // ISSUE-90 (fixed) (P5)
  }),
  // POLICY-44 decided (b): keyword-level where the branches overlap (integer values match both branches)
  body({
    id: id(),
    title: "oneOf -> anyOf over overlapping branches",
    before: "oneOf [number, integer]",
    after: "anyOf [number, integer]",
    rationale:
      "an integer matches both branches: invalid under oneOf, valid under anyOf, so the request widens (non-breaking) and a response may now carry integers (breaking)",
    annotation: "names the combiner change (oneOf to anyOf) and the location",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.classify.ts combinerKeyClassifyRule" }],
    schema: [{ oneOf: [{ type: "number" }, i] }, { anyOf: [{ type: "number" }, i] }],
    expect: [{ at: ["", "oneOf", "anyOf"], type: rr(nonBreaking, breaking), mentions: ["oneOf", "anyOf"] }],
  }),
  body({
    id: id(),
    title: "anyOf -> oneOf over overlapping branches",
    before: "anyOf [number, integer]",
    after: "oneOf [number, integer]",
    rationale:
      "integers matched both branches: they become invalid (request breaking), a response no longer carries them (non-breaking)",
    annotation: "names the combiner change (anyOf to oneOf) and the location",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.classify.ts combinerKeyClassifyRule" }],
    schema: [{ anyOf: [{ type: "number" }, i] }, { oneOf: [{ type: "number" }, i] }],
    expect: [{ at: ["", "oneOf", "anyOf"], type: rr(breaking, nonBreaking), mentions: ["oneOf", "anyOf"] }],
  }),
]

// Atlassian json-schema-diff test cases (checklist jsd) represented by the cases above
const C = (file: string) => `diff-schemas-${file}`
export const cases = withJsd(own, {
  "JS-CMB-013": [[C("allof"), "multiple properties in single schema to equivalent allOf schemas of single properties"]],
  "JS-CMB-014": [[C("allof"), "type to equivalent allOf that type"]],
  "JS-CMB-017": [[C("oneof"), "adding a disjoint schema to oneOf"]],
  "JS-CMB-027": [[C("oneof"), "removing the oneOf keyword"]],
})
