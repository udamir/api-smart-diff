// JSON Schema object keywords: properties (added / removed / renamed, optional / required), required,
// additionalProperties, patternProperties, propertyNames, minProperties / maxProperties, dependentRequired,
// dependentSchemas, unevaluatedProperties.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type SchemaCase, risky } from "../../helpers/compat"
import { body, both, kwRe, property, rr, seq, withJsd } from "./kw"

const id = seq("OBJ")
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

const obj = (properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: "object",
  properties,
  ...extra,
})
const s = { type: "string" }
const n = { type: "number" }

// POLICY-03 decided (c): removing a request property is risky (oasdiff WARN); the response keeps its definite class
// POLICY-05 decided (b): required -> optional in a response is risky (fork risky); the request keeps its definite class
// POLICY-22 decided (a): a required request property with a default is non-breaking (ASD, fork; B1.19)

const own: SchemaCase[] = [
  body({
    id: id(),
    title: "optional property added",
    before: "object { a }",
    after: "object { a, b }",
    rationale: "request: clients that do not send b keep working; response: tolerant readers ignore the new field",
    annotation: "names the added property",
    sources: [
      ...cs("add-new-property-compliance"),
      lib("TestCompareSchemas_PropertyAdded"),
      oas("checker/check_breaking_property_test.go new optional request property"),
    ],
    covers: ["oasdiff:new-optional-request-property", "oasdiff:response-optional-property-added"],
    schema: [obj({ a: s }), obj({ a: s, b: s })],
    expect: [{ at: "properties/b", action: "add", type: nonBreaking, mentions: ["`b`"] }],
  }),
  body({
    id: id(),
    title: "required property added",
    before: "object { a }",
    after: "object { a, b }, required [b]",
    rationale:
      "request: clients that do not send b are rejected; response: b is always delivered, clients that ignore it keep working",
    annotation: "names the added property and its required status",
    sources: [
      ...cs("add-required-property"),
      oas("checker/check_breaking_property_test.go new required request property"),
      od("RequiredBCTest.java requestRequiredIncreased"),
    ],
    covers: ["oasdiff:new-required-request-property", "oasdiff:response-required-property-added"],
    schema: [obj({ a: s }), obj({ a: s, b: s }, { required: ["b"] })],
    expect: [
      { at: "properties/b", action: "add", type: rr(breaking, nonBreaking), mentions: ["`b`"] },
      { at: "required/*", action: "add", type: rr(breaking, nonBreaking), mentions: ["b", "required"] },
    ],
  }),
  body({
    id: id(),
    title: "required property with a default added",
    before: "object { a }",
    after: "object { a, b (default x) }, required [b]",
    rationale:
      "POLICY-22 (a): a client omitting b gets the documented default (ASD, fork; oasdiff ERR because `required` is validated before defaults apply); response: b is always delivered",
    annotation: "names the added property and its required status",
    sources: [
      oas("checker/check_request_property_updated_test.go TestRequiredRequestPropertyAddedWithDefault", "request: ERR"),
      ...cs("add-required-property-with-default"),
    ],
    covers: ["oasdiff:new-required-request-property-with-default", "oasdiff:response-required-property-added"],
    schema: [obj({ a: s }), obj({ a: s, b: { type: "string", default: "x" } }, { required: ["b"] })],
    expect: [
      { at: "properties/b", action: "add", type: nonBreaking, mentions: ["`b`"] },
      { at: "required/*", action: "add", type: nonBreaking, mentions: ["b", "required"] },
    ],
  }),
  body({
    id: id(),
    title: "existing property became required",
    before: "object { a, b }",
    after: "object { a, b }, required [b]",
    rationale: "request: clients that omit b are rejected; response: b is now guaranteed, clients are unaffected",
    annotation: "names the property and its required status",
    sources: [
      oas("checker/check_request_property_required_updated_test.go TestRequestPropertyMarkedRequired"),
      oas("checker/check_response_property_became_required_test.go TestResponsePropertyBecameRequiredlCheck"),
      od("SchemaDiffTest.java requiredPropertyChangedTest", "response: incompatible"),
    ],
    covers: ["oasdiff:request-property-became-required", "oasdiff:response-property-became-required"],
    schema: [obj({ a: s, b: s }), obj({ a: s, b: s }, { required: ["b"] })],
    expect: [{ at: "required/*", action: "add", type: rr(breaking, nonBreaking), mentions: ["b", "required"] }],
  }),
  body({
    id: id(),
    title: "existing property with a default became required",
    before: "object { a, b (default x) }",
    after: "object { a, b (default x) }, required [b]",
    rationale:
      "POLICY-22 (a): a client omitting b gets the documented default (ASD, fork; oasdiff ERR because `required` is validated before defaults apply); response unaffected",
    annotation: "names the property and its required status",
    sources: [
      oas(
        "checker/check_request_property_required_updated_test.go TestRequestPropertyWithDefaultMarkedRequired",
        "request: ERR",
      ),
      ...cs("add-required-property-with-default"),
    ],
    covers: ["oasdiff:request-property-became-required-with-default", "oasdiff:response-property-became-required"],
    schema: [
      obj({ a: s, b: { type: "string", default: "x" } }),
      obj({ a: s, b: { type: "string", default: "x" } }, { required: ["b"] }),
    ],
    expect: [{ at: "required/*", action: "add", type: nonBreaking, mentions: ["b", "required"] }],
  }),
  body({
    id: id(),
    title: "required property became optional",
    before: "object { a, b }, required [a, b]",
    after: "object { a, b }, required [b]",
    rationale:
      "request: clients may omit a; response: clients relying on a being present can fail (POLICY-05: risky, as the fork; oasdiff ERR)",
    annotation: "names the property and its required status",
    sources: [
      ...cs("remove-required-property"),
      oas("checker/check_response_property_became_optional_test.go TestResponsePropertyBecameOptionalCheck", "ERR"),
      od("RequiredBCTest.java responseRequiredDecreased"),
    ],
    covers: ["oasdiff:request-property-became-optional", "oasdiff:response-property-became-optional"],
    schema: [obj({ a: s, b: s }, { required: ["a", "b"] }), obj({ a: s, b: s }, { required: ["b"] })],
    expect: [{ at: "required/*", action: "remove", type: rr(nonBreaking, risky), mentions: ["a", "required"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  body({
    id: id(),
    title: "required set swapped (required [a] -> [b])",
    before: "required [a]",
    after: "required [b]",
    rationale:
      "request: clients that omit b are rejected (breaking); response: a may be missing (POLICY-05: risky, as the fork)",
    annotation: "names both properties and their required status",
    sources: cs("update-required-property"),
    covers: [
      "oasdiff:request-property-became-required",
      "oasdiff:request-property-became-optional",
      "oasdiff:response-property-became-optional",
      "oasdiff:response-property-became-required",
    ],
    schema: [obj({ a: s, b: n }, { required: ["a"] }), obj({ a: s, b: n }, { required: ["b"] })],
    expect: [
      { at: "required/*", action: "add", type: rr(breaking, nonBreaking), mentions: ["b"] },
      { at: "required/*", action: "remove", type: rr(nonBreaking, risky), mentions: ["a"] },
      { at: "required/*", action: "replace", type: rr(breaking, risky), mentions: ["required"], optional: true },
    ],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  body({
    id: id(),
    title: "required entries reordered",
    before: "required [a, b]",
    after: "required [b, a]",
    rationale: "`required` is a set",
    annotation: "no diff",
    sources: [lib("TestCompareSchemas_CheckRequiredOrdering")],
    schema: [obj({ a: s, b: s }, { required: ["a", "b"] }), obj({ a: s, b: s }, { required: ["b", "a"] })],
    expect: [],
  }),
  body({
    id: id(),
    title: "required name without a declared property added",
    before: "object { a }",
    after: "object { a }, required [z]",
    rationale:
      "JSON Schema requires z to be present even when it is not declared in properties: requests without z are rejected (oasdiff reports nothing)",
    annotation: "names the required property",
    sources: [oas("checker/check_breaking_property_test.go adding a non-existent name to required", "not reported")],
    schema: [obj({ a: s }), obj({ a: s }, { required: ["z"] })],
    expect: [{ at: "required/*", action: "add", type: rr(breaking, nonBreaking), mentions: ["z", "required"] }],
  }),
  body({
    id: id(),
    title: "optional property removed",
    before: "object { a, b }",
    after: "object { a }",
    rationale:
      "response: b was optional, clients cannot rely on it (oasdiff INFO); request: clients still sending b may have it silently dropped (POLICY-03: risky, oasdiff WARN)",
    annotation: "names the removed property",
    sources: [
      ...cs("remove-property-compliance", "request: breaking"),
      oas("checker/check_breaking_property_test.go delete optional request property"),
      lib("TestCompareSchemas_PropertyRemoved", "breaking"),
    ],
    covers: ["oasdiff:request-property-removed", "oasdiff:response-optional-property-removed"],
    schema: [obj({ a: s, b: n }), obj({ a: s })],
    expect: [{ at: "properties/b", action: "remove", type: rr(risky, nonBreaking), mentions: ["`b`"] }],
    // ISSUE-130 (fixed): POLICY-03 decided (c)
  }),
  body({
    id: id(),
    title: "required property removed",
    before: "object { a, b }, required [a, b]",
    after: "object { a }, required [a]",
    rationale:
      "response: clients reading b fail (oasdiff ERR); request: clients still send b, the server ignores it (POLICY-03: the property removal is risky, oasdiff WARN; dropping its required status alone is non-breaking)",
    annotation: "names the removed property",
    sources: [
      oas("checker/check_response_required_property_updated_test.go TestResponseRequiredPropertyRemoved"),
      oas("checker/check_breaking_property_test.go delete required request property"),
    ],
    covers: ["oasdiff:request-property-removed", "oasdiff:response-required-property-removed"],
    schema: [obj({ a: s, b: n }, { required: ["a", "b"] }), obj({ a: s }, { required: ["a"] })],
    expect: [
      { at: "properties/b", action: "remove", type: rr(risky, breaking), mentions: ["`b`"] },
      { at: "required/*", action: "remove", type: rr(nonBreaking, breaking), mentions: ["b"] },
    ],
    // ISSUE-130 (fixed): POLICY-03 decided (c)
  }),
  body({
    id: id(),
    title: "nested required property removed (a.b)",
    before: "object { a: object { b }, required [b] }",
    after: "object { a: object {} }",
    rationale: "response: clients reading a.b fail",
    annotation: "names the removed property with its path (a.b)",
    sources: [
      oas("checker/check_response_required_property_updated_test.go TestResponseRequiredPropertyRemoved (embedded)"),
    ],
    covers: ["oasdiff:response-required-property-removed"],
    placements: ["response"],
    schema: [obj({ a: obj({ b: s }, { required: ["b"] }) }), obj({ a: obj({}) })],
    expect: [
      {
        at: ["properties/a/properties/b", "properties/a/required/*"],
        action: "remove",
        type: breaking,
        mentions: [/`a\.b`|property `b` (of|from) `a`/],
      },
    ],
  }),
  body({
    id: id(),
    title: "nested required property added in a request (a.b)",
    before: "object { a: object {} }",
    after: "object { a: object { b }, required [b] }",
    rationale: "request: clients sending a without b are rejected",
    annotation: "names the added property with its path",
    sources: [oas("checker/check_breaking_property_test.go property in items / nested property made required")],
    covers: ["oasdiff:new-required-request-property"],
    placements: ["request"],
    schema: [obj({ a: obj({}) }), obj({ a: obj({ b: s }, { required: ["b"] }) })],
    expect: [
      { at: ["properties/a/properties/b", "properties/a/required/*"], action: "add", type: breaking, mentions: ["b"] },
    ],
  }),
  body({
    id: id(),
    title: "property renamed (bench J18: ids -> ids12)",
    before: "object { ids }",
    after: "object { ids12 }",
    rationale:
      "a rename is an optional property removed plus one added: response non-breaking (both optional); request: the removal is risky (POLICY-03)",
    annotation: "names the removed and the added property",
    sources: [{ tool: "bench", ref: "bench/fixtures/jsonschema.js J18" }, lib("TestCompareSchemas_PropertySwap")],
    schema: [obj({ ids: { type: "array", items: s } }), obj({ ids12: { type: "array", items: s } })],
    expect: [
      { at: "properties/ids", action: ["remove", "rename"], type: rr(risky, nonBreaking), mentions: ["ids"] },
      { at: "properties/ids12", action: "add", type: nonBreaking, mentions: ["ids12"] },
    ],
    // ISSUE-130 (fixed): POLICY-03 decided (c)
  }),
  ...both({
    id: id(2),
    title: "additionalProperties: true -> false",
    before: "object { a }, additionalProperties true",
    after: "object { a }, additionalProperties false",
    rationale: "request: clients sending extra properties are rejected; response: clients receive a subset",
    annotation: "names the additional-properties schema and the location",
    sources: [
      { tool: "fork", ref: "test/corner-cases.test.ts additionalProperties:true <-> additionalProperties:false" },
      lib("TestCompareSchemas_AdditionalProperties_Boolean"),
    ],
    schema: [obj({ a: s }, { additionalProperties: true }), obj({ a: s }, { additionalProperties: false })],
    expect: [{ at: "additionalProperties", type: rr(breaking, nonBreaking), mentions: [/additional/i] }],
  }),
  ...both({
    id: id(2),
    title: "additionalProperties: false -> true",
    before: "object { a }, additionalProperties false",
    after: "object { a }, additionalProperties true",
    rationale:
      "request: accepts extra properties; response: clients that reject unknown fields (the before contract forbade them) receive extras",
    annotation: "names the additional-properties schema and the location",
    sources: [lib("TestCompareSchemas_AdditionalProperties_Boolean")],
    schema: [obj({ a: s }, { additionalProperties: false }), obj({ a: s }, { additionalProperties: true })],
    expect: [{ at: "additionalProperties", type: rr(nonBreaking, breaking), mentions: [/additional/i] }],
  }),
  ...both({
    id: id(2),
    title: "additionalProperties schema added",
    before: "object",
    after: "object, additionalProperties: string",
    rationale: "request: non-string extra properties become invalid; response: clients receive a subset",
    annotation: "names the additional-properties schema and the location",
    sources: [...cs("add-non-boolean-additional-properties"), lib("TestCompareSchemas_AdditionalProperties_Added")],
    schema: [{ type: "object" }, { type: "object", additionalProperties: s }],
    expect: [
      {
        at: ["additionalProperties", "additionalProperties/**"],
        type: rr(breaking, nonBreaking),
        mentions: [/additional/i],
      },
    ],
  }),
  ...both({
    id: id(2),
    title: "additionalProperties schema removed",
    before: "object, additionalProperties: string",
    after: "object",
    rationale:
      "request: accepts any extra property; response: clients typed as map<string, string> receive other values",
    annotation: "names the additional-properties schema and the location",
    sources: [...cs("remove-additional-properties"), lib("TestCompareSchemas_AdditionalProperties_Removed")],
    schema: [{ type: "object", additionalProperties: s }, { type: "object" }],
    expect: [
      {
        at: ["additionalProperties", "additionalProperties/**"],
        type: rr(nonBreaking, breaking),
        mentions: [/additional/i],
      },
    ],
  }),
  ...both({
    id: id(2),
    title: "additionalProperties schema type replaced",
    before: "object, additionalProperties: integer",
    after: "object, additionalProperties: string",
    rationale: "map values change type: breaking in both directions",
    annotation: "names the type change under additionalProperties",
    sources: [
      ...cs("update-type-of-additional-properties"),
      oas("checker/check_response_property_type_changed_test.go TestResponseAdditionalPropertyTypeChangedCheck"),
    ],
    stems: ["type-changed"],
    scalar: false,
    schema: [
      { type: "object", additionalProperties: { type: "integer" } },
      { type: "object", additionalProperties: s },
    ],
    expect: [{ at: "additionalProperties/type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  body({
    id: id(),
    title: "free-form object written as additionalProperties true / {}",
    before: "object { a: object }",
    after: "object { a: object, additionalProperties true }, b additionalProperties {}",
    rationale: "an absent additionalProperties, `true` and `{}` all allow any extra property",
    annotation: "no diff (or annotations)",
    sources: cs("update-definition-of-free-form-object"),
    schema: [
      obj({ a: { type: "object" }, b: { type: "object" } }),
      obj({ a: { type: "object", additionalProperties: true }, b: { type: "object", additionalProperties: {} } }),
    ],
    expect: [{ at: "properties/*/additionalProperties", type: annotation, optional: true }],
    // ISSUE-70 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "required property removed inside an additionalProperties schema (map values)",
    before: "map<string, { id, required [id] }>",
    after: "map<string, {}>",
    rationale: "response: clients reading value.id fail",
    annotation: "names the removed property under additional properties",
    sources: [
      oas("checker/check_sub_schema_traversal_test.go TestAdditionalPropertiesTraversalDeletedRequiredProperty"),
    ],
    covers: ["oasdiff:response-required-property-removed"],
    placements: ["response"],
    schema: [
      { type: "object", additionalProperties: obj({ id: s }, { required: ["id"] }) },
      { type: "object", additionalProperties: obj({}) },
    ],
    expect: [
      {
        at: ["additionalProperties/properties/id", "additionalProperties/required/*"],
        action: "remove",
        type: breaking,
        mentions: ["id"],
      },
    ],
  }),
  ...both({
    id: id(2),
    title: "patternProperties entry added",
    before: "object",
    after: "object, patternProperties ^x-: string",
    rationale: "request: x-* properties with non-string values become invalid; response: clients receive a subset",
    annotation: "names the key pattern and the location",
    sources: [
      oas("checker/check_request_property_pattern_properties_updated_test.go TestRequestBodyPatternPropertyAdded"),
    ],
    stems: ["pattern-property-added"],
    schema: [{ type: "object" }, { type: "object", patternProperties: { "^x-": s } }],
    expect: [
      {
        at: ["patternProperties/*", "patternProperties/*/**"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["^x-"],
      },
    ],
  }),
  ...both({
    id: id(2),
    title: "patternProperties entry removed",
    before: "object, patternProperties ^x-: string",
    after: "object",
    rationale: "request: accepts more objects; response: clients receive x-* values of any type",
    annotation: "names the key pattern and the location",
    sources: [
      oas("checker/check_request_property_pattern_properties_updated_test.go TestRequestBodyPatternPropertyRemoved"),
    ],
    stems: ["pattern-property-removed"],
    schema: [{ type: "object", patternProperties: { "^x-": s } }, { type: "object" }],
    expect: [
      {
        at: ["patternProperties/*", "patternProperties/*/**"],
        action: "remove",
        type: rr(nonBreaking, breaking),
        mentions: ["^x-"],
      },
    ],
  }),
  body({
    id: id(),
    title: "patternProperties value type replaced (bench J19)",
    before: "patternProperties _name$: string",
    after: "patternProperties _name$: number",
    rationale: "values of matching keys change type: breaking in both directions",
    annotation: "names the type change under the key pattern",
    sources: [{ tool: "bench", ref: "bench/fixtures/jsonschema.js J19" }, lib("TestCompareSchemas_PatternProperties")],
    schema: [
      { type: "object", patternProperties: { _name$: s } },
      { type: "object", patternProperties: { _name$: n } },
    ],
    expect: [{ at: "patternProperties/*/type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  ...both({
    id: id(2),
    title: "propertyNames added",
    before: "object",
    after: "object, propertyNames: { pattern: ^[a-z]+$ }",
    rationale: "request: objects with other keys become invalid; response: clients receive a subset",
    annotation: "names the property names schema and the location",
    sources: [
      oas("checker/check_request_property_property_names_updated_test.go TestRequestBodyPropertyNamesAdded"),
      lib("TestCompareSchemas_PropertyNames_Added"),
    ],
    stems: ["property-names-added"],
    schema: [{ type: "object" }, { type: "object", propertyNames: { pattern: "^[a-z]+$" } }],
    expect: [
      {
        at: ["propertyNames", "propertyNames/**"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: [/property ?names/i],
      },
    ],
  }),
  ...both({
    id: id(2),
    title: "propertyNames removed",
    before: "object, propertyNames: { pattern: ^[a-z]+$ }",
    after: "object",
    rationale: "request: accepts more keys; response: clients receive keys of any shape",
    annotation: "names the property names schema and the location",
    sources: [
      oas("checker/check_request_property_property_names_updated_test.go TestRequestBodyPropertyNamesRemoved"),
      lib("TestCompareSchemas_PropertyNames_Removed"),
    ],
    stems: ["property-names-removed"],
    schema: [{ type: "object", propertyNames: { pattern: "^[a-z]+$" } }, { type: "object" }],
    expect: [
      {
        at: ["propertyNames", "propertyNames/**"],
        action: "remove",
        type: rr(nonBreaking, breaking),
        mentions: [/property ?names/i],
      },
    ],
  }),
  property({
    id: id(),
    title: "propertyNames maxLength decreased",
    before: "name: object, propertyNames: { maxLength: 10 }",
    after: "name: object, propertyNames: { maxLength: 5 }",
    rationale: "request: longer keys become invalid; response: clients receive a subset",
    annotation: "names the keyword under propertyNames and the property",
    sources: [
      lib("TestCompareSchemas_PropertyNames"),
      oas("checker/check_sub_schema_traversal_test.go TestSubSchemaTraversalMinLengthChanged"),
    ],
    schema: [
      { type: "object", propertyNames: { maxLength: 10 } },
      { type: "object", propertyNames: { maxLength: 5 } },
    ],
    expect: [
      {
        at: "propertyNames/maxLength",
        action: "replace",
        type: rr(breaking, nonBreaking),
        mentions: [kwRe("maxLength")],
      },
    ],
  }),
  ...both({
    id: id(2),
    title: "minProperties set",
    before: "object",
    after: "object, minProperties 1",
    rationale:
      "request: empty objects become invalid (oasdiff: min-properties-increased from 0); response: clients receive a subset",
    annotation: "names the keyword (minProperties) and the location",
    sources: [...cs("add-min-properties-for-object-property"), od("SchemaBCTest.java minPropertiesAdded")],
    stems: ["min-properties-increased"],
    schema: [{ type: "object" }, { type: "object", minProperties: 1 }],
    expect: [
      { at: "minProperties", action: "add", type: rr(breaking, nonBreaking), mentions: [kwRe("minProperties")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "minProperties unset",
    before: "object, minProperties 1",
    after: "object",
    rationale: "request: accepts empty objects; response: clients can receive empty objects",
    annotation: "names the keyword (minProperties) and the location",
    sources: cs("remove-min-properties-for-object-property"),
    stems: ["min-properties-decreased"],
    schema: [{ type: "object", minProperties: 1 }, { type: "object" }],
    expect: [
      { at: "minProperties", action: "remove", type: rr(nonBreaking, breaking), mentions: [kwRe("minProperties")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "minProperties increased",
    before: "object, minProperties 1",
    after: "object, minProperties 2",
    rationale: "request: objects with a single property become invalid; response: clients receive a subset",
    annotation: "names the keyword (minProperties) and the location",
    sources: [...cs("increase-min-properties-for-object-property"), od("SchemaBCTest.java minPropertiesIncreased")],
    stems: ["min-properties-increased"],
    schema: [
      { type: "object", minProperties: 1 },
      { type: "object", minProperties: 2 },
    ],
    expect: [
      { at: "minProperties", action: "replace", type: rr(breaking, nonBreaking), mentions: [kwRe("minProperties")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "minProperties decreased",
    before: "object, minProperties 2",
    after: "object, minProperties 1",
    rationale: "request: accepts more objects; response: clients can receive smaller objects",
    annotation: "names the keyword (minProperties) and the location",
    sources: cs("decrease-min-properties-for-object-property"),
    stems: ["min-properties-decreased"],
    schema: [
      { type: "object", minProperties: 2 },
      { type: "object", minProperties: 1 },
    ],
    expect: [
      { at: "minProperties", action: "replace", type: rr(nonBreaking, breaking), mentions: [kwRe("minProperties")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "maxProperties set",
    before: "object",
    after: "object, maxProperties 5",
    rationale: "request: objects with more than 5 properties become invalid; response: clients receive a subset",
    annotation: "names the keyword (maxProperties) and the location",
    sources: [...cs("add-max-properties-for-object-property"), od("SchemaBCTest.java maxPropertiesAdded")],
    stems: ["max-properties-set"],
    schema: [{ type: "object" }, { type: "object", maxProperties: 5 }],
    expect: [
      { at: "maxProperties", action: "add", type: rr(breaking, nonBreaking), mentions: [kwRe("maxProperties")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "maxProperties unset",
    before: "object, maxProperties 5",
    after: "object",
    rationale: "request: accepts larger objects; response: clients can receive more properties",
    annotation: "names the keyword (maxProperties) and the location",
    sources: cs("remove-max-properties-for-object-property"),
    schema: [{ type: "object", maxProperties: 5 }, { type: "object" }],
    expect: [
      { at: "maxProperties", action: "remove", type: rr(nonBreaking, breaking), mentions: [kwRe("maxProperties")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "maxProperties increased",
    before: "object, maxProperties 5",
    after: "object, maxProperties 10",
    rationale: "request: accepts larger objects; response: clients can receive more properties",
    annotation: "names the keyword (maxProperties) and the location",
    sources: cs("increase-max-properties-for-object-property"),
    stems: ["max-properties-increased"],
    schema: [
      { type: "object", maxProperties: 5 },
      { type: "object", maxProperties: 10 },
    ],
    expect: [
      { at: "maxProperties", action: "replace", type: rr(nonBreaking, breaking), mentions: [kwRe("maxProperties")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "maxProperties decreased",
    before: "object, maxProperties 10",
    after: "object, maxProperties 5",
    rationale: "request: objects with 6..10 properties become invalid; response: clients receive a subset",
    annotation: "names the keyword (maxProperties) and the location",
    sources: [...cs("decrease-max-properties-for-object-property"), od("SchemaBCTest.java maxPropertiesDecreased")],
    stems: ["max-properties-decreased"],
    schema: [
      { type: "object", maxProperties: 10 },
      { type: "object", maxProperties: 5 },
    ],
    expect: [
      { at: "maxProperties", action: "replace", type: rr(breaking, nonBreaking), mentions: [kwRe("maxProperties")] },
    ],
  }),
  property({
    id: id(),
    title: "minProperties: 0 added (the default value)",
    before: "name: object",
    after: "name: object, minProperties 0",
    rationale: "`minProperties: 0` is the default: the set of valid values does not change",
    annotation: "no diff (or an annotation)",
    sources: cs("add-minProperties-with-default-value-for-object-property"),
    schema: [{ type: "object" }, { type: "object", minProperties: 0 }],
    expect: [{ at: "minProperties", type: annotation, optional: true }],
    // ISSUE-70 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "minProperties: 0 removed (the default value)",
    before: "name: object, minProperties 0",
    after: "name: object",
    rationale: "`minProperties: 0` is the default: the set of valid values does not change",
    annotation: "no diff (or an annotation)",
    sources: cs("remove-minProperties-with-default-value-for-object-property"),
    schema: [{ type: "object", minProperties: 0 }, { type: "object" }],
    expect: [{ at: "minProperties", type: annotation, optional: true }],
    // ISSUE-70 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "dependentRequired added",
    before: "object { card, billing }",
    after: "object { card, billing }, dependentRequired { card: [billing] }",
    rationale: "request: objects with card but without billing become invalid; response: clients receive a subset",
    annotation: "names the dependent required properties and the location",
    sources: [
      oas("checker/check_request_property_dependent_required_changed_test.go TestRequestBodyDependentRequiredAdded"),
      lib("TestCompareSchemas_DependentRequired_Added", "non-breaking"),
    ],
    stems: ["dependent-required-added"],
    schema: [obj({ card: s, billing: s }), obj({ card: s, billing: s }, { dependentRequired: { card: ["billing"] } })],
    expect: [
      {
        at: ["dependentRequired/*", "dependentRequired/*/*", "dependentRequired"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: [/dependent/i, "card"],
      },
    ],
    // ISSUE-90 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "dependentRequired removed",
    before: "object, dependentRequired { card: [billing] }",
    after: "object",
    rationale: "request: accepts more objects; response: clients relying on billing whenever card is present can fail",
    annotation: "names the dependent required properties and the location",
    sources: [
      oas("checker/check_request_property_dependent_required_changed_test.go TestRequestBodyDependentRequiredRemoved"),
      lib("TestCompareSchemas_DependentRequired_Removed"),
    ],
    stems: ["dependent-required-removed"],
    schema: [obj({ card: s, billing: s }, { dependentRequired: { card: ["billing"] } }), obj({ card: s, billing: s })],
    expect: [
      {
        at: ["dependentRequired/*", "dependentRequired/*/*", "dependentRequired"],
        action: "remove",
        type: rr(nonBreaking, breaking),
        mentions: [/dependent/i, "card"],
      },
    ],
    // ISSUE-90 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "dependentRequired list extended",
    before: "dependentRequired { card: [billing] }",
    after: "dependentRequired { card: [billing, cvc] }",
    rationale:
      "request: objects with card but without cvc become invalid; response: clients receive a subset (oasdiff changed: ERR in both directions)",
    annotation: "names the dependent required property (cvc), its trigger (card) and the location",
    sources: [
      oas(
        "checker/check_request_property_dependent_required_changed_test.go TestRequestBodyDependentRequiredChanged / checker/check_response_property_dependent_required_changed_test.go TestResponseBodyDependentRequiredChanged",
      ),
      lib("TestCompareSchemas_DependentRequired_Modified"),
    ],
    stems: ["dependent-required-changed"],
    schema: [
      obj({ card: s, billing: s, cvc: s }, { dependentRequired: { card: ["billing"] } }),
      obj({ card: s, billing: s, cvc: s }, { dependentRequired: { card: ["billing", "cvc"] } }),
    ],
    expect: [{ at: "dependentRequired/card/*", action: "add", type: rr(breaking, nonBreaking), mentions: ["cvc"] }],
    // ISSUE-100 (fixed) (P8a)
  }),
  body({
    id: id(),
    title: "dependentRequired list reordered",
    before: "dependentRequired { card: [billing, cvc] }",
    after: "dependentRequired { card: [cvc, billing] }",
    rationale: "the dependent required list is a set (libopenapi reports a breaking modification)",
    annotation: "no diff",
    sources: [lib("TestCompareSchemas_DependentRequired_OrderMatters", "breaking")],
    schema: [
      obj({ card: s, billing: s, cvc: s }, { dependentRequired: { card: ["billing", "cvc"] } }),
      obj({ card: s, billing: s, cvc: s }, { dependentRequired: { card: ["cvc", "billing"] } }),
    ],
    expect: [],
  }),
  ...both({
    id: id(2),
    title: "dependentSchemas entry added",
    before: "object { card }",
    after: "object { card }, dependentSchemas { card: { required: [billing] } }",
    rationale: "request: objects with card but without billing become invalid; response: clients receive a subset",
    annotation: "names the dependent schema and the location",
    sources: [
      oas("checker/check_request_property_dependent_schemas_updated_test.go TestRequestBodyDependentSchemaAdded"),
    ],
    stems: ["dependent-schema-added"],
    schema: [obj({ card: s }), obj({ card: s }, { dependentSchemas: { card: { required: ["billing"] } } })],
    expect: [
      {
        at: ["dependentSchemas", "dependentSchemas/*", "dependentSchemas/*/**"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: [/dependent/i],
      },
    ],
    // ISSUE-90 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "dependentSchemas entry removed",
    before: "object { card }, dependentSchemas { card: { required: [billing] } }",
    after: "object { card }",
    rationale: "request: accepts more objects; response: clients relying on billing can fail",
    annotation: "names the dependent schema and the location",
    sources: [
      oas("checker/check_request_property_dependent_schemas_updated_test.go TestRequestBodyDependentSchemaRemoved"),
    ],
    stems: ["dependent-schema-removed"],
    schema: [obj({ card: s }, { dependentSchemas: { card: { required: ["billing"] } } }), obj({ card: s })],
    expect: [
      {
        at: ["dependentSchemas", "dependentSchemas/*", "dependentSchemas/*/**"],
        action: "remove",
        type: rr(nonBreaking, breaking),
        mentions: [/dependent/i],
      },
    ],
    // ISSUE-90 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "unevaluatedProperties: false added",
    before: "object { a }",
    after: "object { a }, unevaluatedProperties false",
    rationale: "request: objects with undeclared properties become invalid; response: clients receive a subset",
    annotation: "names the keyword (unevaluated properties) and the location",
    sources: [
      oas("checker/check_request_property_unevaluated_updated_test.go TestRequestBodyUnevaluatedAdded"),
      lib("TestCompareSchemas_UnevaluatedProperties_Added"),
    ],
    stems: ["unevaluated-properties-added"],
    schema: [obj({ a: s }), obj({ a: s }, { unevaluatedProperties: false })],
    expect: [
      {
        at: ["unevaluatedProperties", "unevaluatedProperties/**"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: [kwRe("unevaluatedProperties")],
      },
    ],
  }),
  ...both({
    id: id(2),
    title: "unevaluatedProperties: false removed",
    before: "object { a }, unevaluatedProperties false",
    after: "object { a }",
    rationale: "request: accepts undeclared properties; response: clients receive undeclared properties",
    annotation: "names the keyword (unevaluated properties) and the location",
    sources: [
      oas("checker/check_request_property_unevaluated_updated_test.go TestRequestBodyUnevaluatedRemoved"),
      lib("TestCompareSchemas_UnevaluatedProperties_Removed"),
    ],
    stems: ["unevaluated-properties-removed"],
    schema: [obj({ a: s }, { unevaluatedProperties: false }), obj({ a: s })],
    expect: [
      {
        at: ["unevaluatedProperties", "unevaluatedProperties/**"],
        action: "remove",
        type: rr(nonBreaking, breaking),
        mentions: [kwRe("unevaluatedProperties")],
      },
    ],
  }),
  body({
    id: id(),
    title: "unevaluatedProperties: false -> string schema",
    before: "object { a }, unevaluatedProperties false",
    after: "object { a }, unevaluatedProperties: string",
    rationale:
      "request: undeclared string properties become acceptable; response: clients receive undeclared properties",
    annotation: "names the keyword (unevaluated properties) and the location",
    sources: [lib("TestCompareSchemas_UnevaluatedProperties_Bool_Schema")],
    schema: [obj({ a: s }, { unevaluatedProperties: false }), obj({ a: s }, { unevaluatedProperties: s })],
    expect: [
      {
        at: ["unevaluatedProperties", "unevaluatedProperties/**"],
        type: rr(nonBreaking, breaking),
        mentions: [kwRe("unevaluatedProperties")],
      },
    ],
  }),
]

// Atlassian json-schema-diff test cases (checklist jsd) represented by the cases above
const O = "diff-schemas-type-object"
export const cases = withJsd(own, {
  "JS-OBJ-001": [[O, "object with no constraints gets a property constrained to some types"]],
  "JS-OBJ-004": [[O, "adding a required property with a changed schema"]],
  "JS-OBJ-006": [
    [O, "object with required property constraint is relaxed to support all objects"],
    [O, "(no description) required [first, last] -> [last]"],
  ],
  "JS-OBJ-015": [[O, "object additionalProperties constrained to accept nothing"]],
  "JS-OBJ-037": [
    [O, "objects gets a minProperties constraint"],
    [O, "objects get constrained to have at least one property"],
  ],
  "JS-OBJ-039": [[O, "object with minProperties and maxProperties contradiction"]],
  "JS-OBJ-041": [[O, "objects with minProperties constraint gets minProperties made more restrictive"]],
  "JS-OBJ-045": [[O, "objects gets a maxProperties constraint"]],
  "JS-OBJ-047": [[O, "object with minProperties and maxProperties contradiction"]],
  "JS-OBJ-051": [[O, "objects with a maxProperties constraint gets maxProperties made more restrictive"]],
})
