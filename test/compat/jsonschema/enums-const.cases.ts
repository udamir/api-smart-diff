// JSON Schema enum (set / unset / value added / removed / replaced, object values, equality), const, default and the
// x-extensible-enum vendor extension.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type SchemaCase, risky } from "../../helpers/compat"
import { both, body, property, rr, seq } from "./kw"

const id = seq("ENUM")
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
const str = (extra: Record<string, unknown> = {}) => ({ type: "string", ...extra })

// POLICY-05 decided (b): a new value on the response side is risky (a client with an exhaustive switch over the old
// values may fail; fork risky, oasdiff ERR, openapi-diff); the request keeps its definite class (ISSUE-130 (fixed));
// ISSUE-57 (fixed) (P8a): the enum descriptions name the value with its action
// POLICY-23 decided (c): request add non-breaking, remove / replace breaking; response annotation (a response default
// carries no server-side behavior for the client)
export const cases: SchemaCase[] = [
  ...both(
    {
      id: id(2),
      title: "enum set (became enum)",
      before: "string",
      after: "string, enum [alpha, beta]",
      rationale:
        "request: any other string becomes invalid; response: clients receive a subset (oasdiff reports one became-enum, not one value-added per value)",
      annotation: "states that the value is restricted to a list (names the values) and the location",
      sources: [
        ...cs("add-enum"),
        oas("checker/check_request_body_enum_value_added_test.go TestRequestBodyEnumAddedIsNotEachValueAdded"),
      ],
      stems: ["became-enum"],
      covers: [],
      schema: [str(), str({ enum: ["alpha", "beta"] })],
      expect: [{ at: ["enum", "enum/*"], action: "add", type: rr(breaking, nonBreaking), mentions: ["alpha"] }],
      // ISSUE-87 (fixed): one `enum` keyword diff naming the values
    },
    { body: { covers: ["oasdiff:response-mediatype-became-enum"] } },
  ),
  ...both(
    {
      id: id(2),
      title: "enum unset (became not enum)",
      before: "string, enum [alpha, beta]",
      after: "string",
      rationale:
        "request: any string becomes acceptable; response: clients with an exhaustive switch receive other strings (fork risky, oasdiff ERR)",
      annotation: "states that the value list was removed and the location",
      sources: [
        ...cs("remove-enum"),
        oas(
          "checker/check_request_body_became_not_enum_test.go TestRequestBodyBecameNotEnum / checker/check_response_property_became_not_enum_test.go TestResponsePropertyBecameNotEnum",
        ),
      ],
      stems: ["became-not-enum"],
      schema: [str({ enum: ["alpha", "beta"] }), str()],
      expect: [{ at: ["enum", "enum/*"], action: "remove", type: rr(nonBreaking, risky), mentions: ["alpha"] }],
      // ISSUE-87 (fixed): one `enum` keyword diff naming the values (risky in a response, ISSUE-130 fixed)
    },
    { body: { covers: ["oasdiff:response-mediatype-became-not-enum"] } },
  ),
  ...both(
    {
      id: id(2),
      title: "enum value added",
      before: "enum [alpha, beta]",
      after: "enum [alpha, beta, gamma]",
      rationale:
        "request: accepts one more value; response: clients with an exhaustive switch receive an unknown value",
      annotation: "names the added value (gamma) and the location",
      sources: [
        ...cs("add-enum-value"),
        oas("checker/check_response_property_enum_value_added_test.go TestResponsePropertyEnumValueAdded"),
        od("EnumBCTest.java responseIncreased"),
      ],
      stems: ["enum-value-added"],
      schema: [str({ enum: ["alpha", "beta"] }), str({ enum: ["alpha", "beta", "gamma"] })],
      expect: [{ at: "enum/*", action: "add", type: rr(nonBreaking, risky), mentions: ["gamma"] }],
      // ISSUE-57 (fixed) (P8a): the value is named with its action
    },
    { body: { covers: ["oasdiff:response-mediatype-enum-value-added"] } },
  ),
  ...both(
    {
      id: id(2),
      title: "enum value removed",
      before: "enum [alpha, beta, gamma]",
      after: "enum [alpha, beta]",
      rationale: "request: clients sending gamma are rejected; response: clients receive a subset",
      annotation: "names the removed value (gamma) and the location",
      sources: [
        ...cs("remove-enum-value"),
        oas("checker/check_request_property_enum_value_updated_test.go TestRequestPropertyEnumValueRemovedCheck"),
        od("EnumBCTest.java requestDecreased"),
      ],
      stems: ["enum-value-removed"],
      schema: [str({ enum: ["alpha", "beta", "gamma"] }), str({ enum: ["alpha", "beta"] })],
      expect: [{ at: "enum/*", action: "remove", type: rr(breaking, nonBreaking), mentions: ["gamma"] }],
      // ISSUE-57 (fixed) (P8a)
    },
    { body: { covers: ["oasdiff:response-mediatype-enum-value-removed"] } },
  ),
  property({
    id: id(),
    title: "enum value replaced (beta -> gamma)",
    before: "name: enum [alpha, beta]",
    after: "name: enum [alpha, gamma]",
    rationale:
      "one value removed (request breaking) and one added (response: unknown value); a single replace diff is acceptable when it is breaking",
    annotation: "names the removed and the added value",
    sources: [...cs("update-enum-value"), { tool: "fork", ref: "test/json-schema.diff.test.ts simple enums" }],
    stems: ["enum-value-removed", "enum-value-added"],
    schema: [str({ enum: ["alpha", "beta"] }), str({ enum: ["alpha", "gamma"] })],
    expect: [
      { at: "enum/*", action: "remove", type: rr(breaking, nonBreaking), mentions: ["beta"], optional: true },
      { at: "enum/*", action: "add", type: rr(nonBreaking, risky), mentions: ["gamma"], optional: true },
      { at: "enum/*", action: "replace", type: rr(breaking, risky), mentions: ["beta", "gamma"], optional: true },
    ],
    // ISSUE-57 (fixed) (P8a): the value is named with its action
  }),
  body({
    id: id(),
    title: "enum values reordered",
    before: "enum [alpha, beta, gamma]",
    after: "enum [gamma, alpha, beta]",
    rationale: "`enum` is a set of values",
    annotation: "no diff",
    sources: [
      { tool: "bench", ref: "bench/fixtures/jsonschema.js J6 (reordered part)" },
      { tool: "fork", ref: "test/json-schema.diff.test.ts simple enums" },
    ],
    schema: [str({ enum: ["alpha", "beta", "gamma"] }), str({ enum: ["gamma", "alpha", "beta"] })],
    expect: [],
  }),
  body({
    id: id(),
    title: "enum value added while others are reordered (bench J6)",
    before: "enum [10, 20, 30]",
    after: "enum [10, 30, 20, 50]",
    rationale: "only the added value matters: request non-breaking, response unknown value",
    annotation: "names the added value (50)",
    sources: [{ tool: "bench", ref: "bench/fixtures/jsonschema.js J6" }],
    schema: [
      { type: "integer", enum: [10, 20, 30] },
      { type: "integer", enum: [10, 30, 20, 50] },
    ],
    expect: [{ at: "enum/*", action: "add", type: rr(nonBreaking, risky), mentions: ["50"] }],
    // ISSUE-57 (fixed) (P8a): the value is named with its action
  }),
  body({
    id: id(),
    title: "duplicate enum value removed",
    before: "enum [alpha, alpha, beta]",
    after: "enum [alpha, beta]",
    rationale: "duplicates do not change the set of values",
    annotation: "no diff",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.transform.ts (enum de-duplication)" }],
    schema: [str({ enum: ["alpha", "alpha", "beta"] }), str({ enum: ["alpha", "beta"] })],
    expect: [],
  }),
  body({
    id: id(),
    title: 'enum value of a different JSON type (1 -> "1")',
    before: "enum [1]",
    after: 'enum ["1"]',
    rationale:
      'the number 1 and the string "1" are different JSON values (libopenapi compares them as strings and reports nothing)',
    annotation: "names the removed and the added value",
    sources: [lib("TestCompareSchemas_EnumSimilar / CheckEnums", "no change")],
    schema: [{ enum: [1] }, { enum: ["1"] }],
    expect: [{ at: "enum/*", type: breaking, mentions: ["1"] }],
    // ISSUE-57 (fixed) (P8a)
  }),
  body({
    id: id(),
    title: "object enum value added",
    before: "enum [{ a: 1 }]",
    after: "enum [{ a: 1 }, { a: 2 }]",
    rationale: "values are compared by deep equality: one value is added",
    annotation: "names the added value",
    sources: [
      oas(
        "checker/check_request_parameter_enum_value_updated_test.go TestRequestParameterObjectEnumNoFalseBreakingChange",
      ),
      { tool: "fork", ref: "test/json-schema.diff.test.ts complex enums" },
    ],
    schema: [
      { type: "object", enum: [{ a: 1 }] },
      { type: "object", enum: [{ a: 1 }, { a: 2 }] },
    ],
    expect: [{ at: "enum/*", action: "add", type: rr(nonBreaking, risky), mentions: [/a.{0,4}2/] }],
    // ISSUE-57 (fixed) (P8a): the value is named with its action
  }),
  body({
    id: id(),
    title: "object enum values reordered with equal content",
    before: "enum [{ a: 1, b: 2 }, { a: 3 }]",
    after: "enum [{ a: 3 }, { b: 2, a: 1 }]",
    rationale: "deep-equal object values in a different order and with a different key order are the same set",
    annotation: "no diff",
    sources: [{ tool: "fork", ref: "test/json-schema.diff.test.ts complex enums" }],
    schema: [
      { type: "object", enum: [{ a: 1, b: 2 }, { a: 3 }] },
      { type: "object", enum: [{ a: 3 }, { b: 2, a: 1 }] },
    ],
    expect: [],
    // ISSUE-97 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "const added",
    before: "string",
    after: "string, const alpha",
    rationale: "request: any other value becomes invalid; response: clients receive a subset",
    annotation: "names the keyword or the constant value (alpha) and the location",
    sources: [
      oas("checker/check_request_property_const_changed_test.go TestRequestBodyConstAdded"),
      lib("rules: const"),
    ],
    stems: ["const-added"],
    scalar: false,
    schema: [str(), str({ const: "alpha" })],
    expect: [{ at: "const", action: "add", type: rr(breaking, nonBreaking), mentions: [/const|alpha/i] }],
    // ISSUE-57 (fixed) (P8a)
  }),
  ...both({
    id: id(2),
    title: "const removed",
    before: "string, const alpha",
    after: "string",
    rationale: "request: accepts any string; response: clients relying on the constant receive other values",
    annotation: "names the keyword or the constant value (alpha) and the location",
    sources: [
      oas(
        "checker/check_request_property_const_changed_test.go TestRequestBodyConstRemoved / checker/check_response_property_const_changed_test.go TestResponsePropertyConstRemoved",
      ),
    ],
    stems: ["const-removed"],
    scalar: false,
    schema: [str({ const: "alpha" }), str()],
    expect: [{ at: "const", action: "remove", type: rr(nonBreaking, breaking), mentions: [/const|alpha/i] }],
    // ISSUE-57 (fixed) (P8a)
  }),
  ...both({
    id: id(2),
    title: "const changed",
    before: "string, const alpha",
    after: "string, const beta",
    rationale: "no value is valid on both sides",
    annotation: "names both constant values and the location",
    sources: [
      oas(
        "checker/check_request_property_const_changed_test.go TestRequestBodyConstChanged / checker/check_response_property_const_changed_test.go TestResponsePropertyConstChanged",
      ),
    ],
    stems: ["const-changed"],
    scalar: false,
    schema: [str({ const: "alpha" }), str({ const: "beta" })],
    expect: [{ at: "const", action: "replace", type: breaking, mentions: ["beta"] }],
    // ISSUE-57 (fixed) (P8a)
  }),
  property({
    id: id(),
    title: "const replaced by the equivalent single-value enum",
    before: "name: const alpha",
    after: "name: enum [alpha]",
    rationale: "`const: x` and `enum: [x]` accept exactly the same value",
    annotation: "no diff",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.transform.ts (const -> enum)" }],
    schema: [str({ const: "alpha" }), str({ enum: ["alpha"] })],
    expect: [],
  }),
  property({
    id: id(),
    title: "const widened into an enum (const alpha -> enum [alpha, beta])",
    before: "name: const alpha",
    after: "name: enum [alpha, beta]",
    rationale: "one value added: request non-breaking, response unknown value",
    annotation: "names the added value (beta)",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.transform.ts (const -> enum)" }],
    schema: [str({ const: "alpha" }), str({ enum: ["alpha", "beta"] })],
    expect: [{ at: ["enum/*", "const", "enum"], type: rr(nonBreaking, risky), mentions: ["beta"] }],
    // ISSUE-57 (fixed) (P8a): the value is named with its action
  }),
  ...both({
    id: id(2),
    title: "default value added",
    before: "string",
    after: "string, default alpha",
    rationale:
      "request: clients that omit the value now get alpha (a server-side behavior); response: a default carries no behavior for the reader",
    annotation: "names the keyword (default) and the location",
    sources: [
      oas("checker/check_request_property_default_value_changed_test.go TestRequestBodyDefaultValueAdded", "INFO"),
    ],
    stems: ["default-value-added"],
    schema: [str(), str({ default: "alpha" })],
    expect: {
      request: [{ at: "default", action: "add", type: nonBreaking, mentions: ["default"] }],
      response: [{ at: "default", action: "add", type: annotation, mentions: ["default"] }],
    },
    // ISSUE-133 (fixed) (P5): POLICY-23 decided (c), a response default is an annotation
  }),
  ...both({
    id: id(2),
    title: "default value removed",
    before: "string, default alpha",
    after: "string",
    rationale: "request: clients that omit the value no longer get alpha; response: no behavior",
    annotation: "names the keyword (default) and the location",
    sources: [
      oas("checker/check_request_property_default_value_changed_test.go TestRequestBodyDefaultValueRemoving", "INFO"),
    ],
    stems: ["default-value-removed"],
    schema: [str({ default: "alpha" }), str()],
    expect: {
      request: [{ at: "default", action: "remove", type: breaking, mentions: ["default"] }],
      response: [{ at: "default", action: "remove", type: annotation, mentions: ["default"] }],
    },
    // ISSUE-133 (fixed) (P5): POLICY-23 decided (c), a response default is an annotation
  }),
  ...both({
    id: id(2),
    title: "default value changed",
    before: "string, default alpha",
    after: "string, default beta",
    rationale:
      "request: clients that omit the value get a different behavior; response: no behavior (bench J13 expects annotation)",
    annotation: "names the keyword (default) and the location",
    sources: [
      oas(
        "checker/check_request_property_default_value_changed_test.go TestRequestPropertyDefaultValueChanged",
        "INFO",
      ),
      { tool: "bench", ref: "bench/fixtures/jsonschema.js J13", verdict: "annotation" },
      lib("rules: default", "breaking"),
    ],
    stems: ["default-value-changed"],
    schema: [str({ default: "alpha" }), str({ default: "beta" })],
    expect: {
      request: [{ at: "default", action: "replace", type: breaking, mentions: ["default"] }],
      response: [{ at: "default", action: "replace", type: annotation, mentions: ["default"] }],
    },
    // ISSUE-133 (fixed) (P5): POLICY-23 decided (c), a response default is an annotation
  }),
  property({
    id: id(),
    title: "x-extensible-enum value removed",
    before: "name: string, x-extensible-enum [alpha, beta]",
    after: "name: string, x-extensible-enum [alpha]",
    rationale:
      "POLICY-06 (d): an x-* key no prefix rule configures is an annotation naming the key; x-extensible-enum gets keyword semantics only through a custom prefix rule (opt-in; oasdiff ERR in requests: clients sending the removed value are no longer understood)",
    annotation: "names the extension and the removed value",
    sources: [
      oas(
        "checker/check_request_property_x_extensible_enum_value_removed_test.go TestRequestPropertyXExtensibleEnumValueRemovedCheck / checker/check_request_parameter_x_extensible_enum_value_removed_test.go TestRequestParameterXExtensibleEnumValueRemoved",
        "request: ERR",
      ),
    ],
    covers: ["oasdiff:request-property-x-extensible-enum-value-removed"],
    placements: ["request", "response"],
    schema: [str({ "x-extensible-enum": ["alpha", "beta"] }), str({ "x-extensible-enum": ["alpha"] })],
    expect: [
      {
        at: ["x-extensible-enum", "x-extensible-enum/*"],
        action: "remove",
        type: annotation,
        mentions: ["x-extensible-enum", "beta"],
      },
    ],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  }),
  body({
    id: id(),
    title: "x-extensible-enum value removed from a query parameter",
    before: "p: string, x-extensible-enum [alpha, beta]",
    after: "p: string, x-extensible-enum [alpha]",
    rationale:
      "POLICY-06 (d): annotation naming the key unless a custom prefix rule configures x-extensible-enum (oasdiff ERR: clients sending beta are no longer understood)",
    annotation: "names the extension and the removed value",
    sources: [
      oas(
        "checker/check_request_parameter_x_extensible_enum_value_removed_test.go TestRequestParameterXExtensibleEnumValueRemoved",
        "ERR",
      ),
    ],
    covers: ["oasdiff:request-parameter-x-extensible-enum-value-removed"],
    placements: ["param"],
    schema: [str({ "x-extensible-enum": ["alpha", "beta"] }), str({ "x-extensible-enum": ["alpha"] })],
    expect: [
      {
        at: ["x-extensible-enum", "x-extensible-enum/*"],
        action: "remove",
        type: annotation,
        mentions: ["x-extensible-enum", "beta"],
      },
    ],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  }),
]
