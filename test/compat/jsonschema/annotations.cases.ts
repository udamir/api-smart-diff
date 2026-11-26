// JSON Schema annotations: title, description, examples, $comment, $id / $anchor, deprecated (and oasdiff's
// sunset / stability lifecycle rules on properties), x-* vendor extensions inside schemas.

import { annotation, breaking, deprecated, nonBreaking } from "../../../src"
import { type SchemaCase, risky } from "../../helpers/compat"
import { body, property, seq } from "./kw"

const id = seq("ANN")
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
const bench = (j: string, verdict?: string) => ({
  tool: "bench",
  ref: `bench/fixtures/jsonschema.js ${j}`,
  ...(verdict ? { verdict } : {}),
})
const s = { type: "string" }

// POLICY-07 decided (a): lifecycle extensions (x-sunset, x-stability-level) are annotations (decision §11.15)
// POLICY-06 decided (d): an x-* key no prefix rule configures is an annotation naming the key (decision §11.15)
// POLICY-04 decided (a): a removal is classified as without the prior deprecation

export const cases: SchemaCase[] = [
  body({
    id: id(),
    title: "title added",
    before: "string",
    after: "string, title Name",
    rationale: "an annotation only",
    annotation: "an annotation naming the keyword (title)",
    sources: cs("add-schema-title"),
    schema: [s, { ...s, title: "Name" }],
    expect: [{ at: "title", action: "add", type: annotation, mentions: ["title"] }],
  }),
  body({
    id: id(),
    title: "title changed",
    before: "string, title Name",
    after: "string, title Full name",
    rationale: "an annotation only",
    annotation: "an annotation naming the keyword (title)",
    sources: [...cs("update-schema-title"), lib("TestCompareSchemas_PropertyModification")],
    schema: [
      { ...s, title: "Name" },
      { ...s, title: "Full name" },
    ],
    expect: [{ at: "title", action: "replace", type: annotation, mentions: ["title"] }],
  }),
  body({
    id: id(),
    title: "title removed",
    before: "string, title Name",
    after: "string",
    rationale: "an annotation only",
    annotation: "an annotation naming the keyword (title)",
    sources: cs("remove-schema-title"),
    schema: [{ ...s, title: "Name" }, s],
    expect: [{ at: "title", action: "remove", type: annotation, mentions: ["title"] }],
  }),
  property({
    id: id(),
    title: "description added",
    before: "name: string",
    after: "name: string, description d",
    rationale: "an annotation only",
    annotation: "an annotation naming the keyword (description) and the property",
    sources: [lib("TestCompareSchemas_PropertyAdd")],
    schema: [s, { ...s, description: "d" }],
    expect: [{ at: "description", action: "add", type: annotation, mentions: ["description"] }],
  }),
  property({
    id: id(),
    title: "description changed (bench J10)",
    before: "name: string, description old",
    after: "name: string, description new",
    rationale: "an annotation only",
    annotation: "an annotation naming the keyword (description) and the property",
    sources: [bench("J10"), bench("J11")],
    schema: [
      { ...s, description: "old" },
      { ...s, description: "new" },
    ],
    expect: [{ at: "description", action: "replace", type: annotation, mentions: ["description"] }],
  }),
  property({
    id: id(),
    title: "description removed",
    before: "name: string, description d",
    after: "name: string",
    rationale: "an annotation only",
    annotation: "an annotation naming the keyword (description) and the property",
    sources: [lib("TestCompareSchemas_PropertyRemove")],
    schema: [{ ...s, description: "d" }, s],
    expect: [{ at: "description", action: "remove", type: annotation, mentions: ["description"] }],
  }),
  property({
    id: id(),
    title: "examples item removed (bench J1)",
    before: "name: string, examples [a, b]",
    after: "name: string, examples [a]",
    rationale: "examples are annotations",
    annotation: "an annotation naming the example and the property",
    sources: [bench("J1"), lib("TestCompareSchemas_Examples")],
    schema: [
      { ...s, examples: ["a", "b"] },
      { ...s, examples: ["a"] },
    ],
    expect: [{ at: ["examples/*", "examples"], action: "remove", type: annotation, mentions: ["example"] }],
  }),
  property({
    id: id(),
    title: "examples added",
    before: "name: string",
    after: "name: string, examples [a]",
    rationale: "examples are annotations",
    annotation: "an annotation naming the example and the property",
    sources: [lib("TestCompareSchemas_Schema_AddExamples")],
    schema: [s, { ...s, examples: ["a"] }],
    expect: [{ at: ["examples/*", "examples"], action: "add", type: annotation, mentions: ["example"] }],
  }),
  property({
    id: id(),
    title: "$comment changed",
    before: "name: string, $comment a",
    after: "name: string, $comment b",
    rationale: "`$comment` is for schema maintainers and has no effect on validation",
    annotation: "an annotation naming the keyword ($comment) and the property",
    sources: [lib("TestCompareSchemas_Comment_Modified", "non-breaking")],
    schema: [
      { ...s, $comment: "a" },
      { ...s, $comment: "b" },
    ],
    expect: [{ at: "$comment", action: "replace", type: annotation, mentions: ["$comment"] }],
    // ISSUE-90 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "$id changed",
    before: "$id urn:a",
    after: "$id urn:b",
    rationale:
      "an identifier change does not change the valid values of a self-contained schema (libopenapi: breaking)",
    annotation: "an annotation naming the keyword ($id)",
    sources: [lib("TestCompareSchemas_Id_Modified", "breaking")],
    placements: ["json"],
    schema: [
      { $id: "urn:a", type: "string" },
      { $id: "urn:b", type: "string" },
    ],
    expect: [{ at: "$id", action: "replace", type: annotation, mentions: ["$id"] }],
  }),
  property({
    id: id(),
    title: "property deprecated",
    before: "name: string",
    after: "name: string, deprecated true",
    rationale: "nothing changes for existing clients; the property is announced for removal",
    annotation: "states that the property became deprecated",
    sources: [
      oas("checker/check_request_property_deprecation_test.go / check_response_property_deprecation_test.go"),
      {
        tool: "openapi-diff",
        ref: "core/src/test/java/org/openapitools/openapidiff/core/SchemaDiffTest.java schemaBecomesDeprecatedTest",
      },
    ],
    covers: ["oasdiff:request-property-deprecated", "oasdiff:response-property-deprecated"],
    schema: [s, { ...s, deprecated: true }],
    expect: [{ at: "deprecated", action: "add", type: deprecated, mentions: ["deprecated"] }],
  }),
  property({
    id: id(),
    title: "property reactivated (deprecated true -> false, bench J12)",
    before: "name: string, deprecated true",
    after: "name: string, deprecated false",
    rationale: "`deprecated: false` equals an absent keyword; the deprecation is withdrawn (bench accepts deprecated)",
    annotation: "states that the deprecated status was removed",
    sources: [
      bench("J12"),
      oas("checker/check_request_property_deprecation_test.go (reactivated)"),
      {
        tool: "openapi-diff",
        ref: "core/src/test/java/org/openapitools/openapidiff/core/SchemaDiffTest.java schemaBecomesNotDeprecatedTest",
      },
    ],
    covers: ["oasdiff:request-property-reactivated", "oasdiff:response-property-reactivated"],
    schema: [
      { ...s, deprecated: true },
      { ...s, deprecated: false },
    ],
    expect: [{ at: "deprecated", type: deprecated, mentions: ["deprecated"] }],
  }),
  property({
    id: id(),
    title: "deprecated false added (the default value)",
    before: "name: string",
    after: "name: string, deprecated false",
    rationale: "`deprecated: false` is the default",
    annotation: "no diff",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.transform.ts (deprecated: false normalized)" }],
    schema: [s, { ...s, deprecated: false }],
    expect: [],
  }),
  property({
    id: id(),
    title: "property deprecated with a sunset date (x-sunset)",
    before: "name: string",
    after: "name: string, deprecated true, x-sunset 2030-01-01",
    rationale: "the deprecation is a lifecycle annotation; x-sunset is an oasdiff lifecycle extension",
    annotation: "states the deprecation; the sunset extension is described",
    sources: [oas("checker/check_request_property_deprecation_test.go (with sunset)")],
    covers: ["oasdiff:request-property-deprecated-with-sunset", "oasdiff:response-property-deprecated-with-sunset"],
    schema: [s, { ...s, deprecated: true, "x-sunset": "2030-01-01" }],
    expect: [
      { at: "deprecated", action: "add", type: deprecated, mentions: ["deprecated"] },
      { at: "x-sunset", action: "add", type: annotation, mentions: ["x-sunset"] },
    ],
    // ISSUE-131 (fixed): POLICY-07 decided (a), lifecycle extensions are annotations
  }),
  property({
    id: id(),
    title: "sunset date of a deprecated property deleted",
    before: "name: deprecated true, x-sunset 2030-01-01",
    after: "name: deprecated true",
    rationale: "the announced removal date disappears while the property stays deprecated (oasdiff ERR)",
    annotation: "names the removed sunset extension",
    sources: [oas("checker/check_request_property_sunset_changed_test.go (sunset deleted)")],
    covers: ["oasdiff:request-property-sunset-deleted", "oasdiff:response-property-sunset-deleted"],
    schema: [
      { ...s, deprecated: true, "x-sunset": "2030-01-01" },
      { ...s, deprecated: true },
    ],
    expect: [{ at: "x-sunset", action: "remove", type: annotation, mentions: ["x-sunset"] }],
    // ISSUE-131 (fixed): POLICY-07 decided (a), lifecycle extensions are annotations
  }),
  property({
    id: id(),
    title: "sunset date of a deprecated property moved earlier",
    before: "name: deprecated true, x-sunset 2031-01-01",
    after: "name: deprecated true, x-sunset 2030-01-01",
    rationale: "clients planned for the later date (oasdiff ERR)",
    annotation: "names the changed sunset extension",
    sources: [oas("checker/check_request_property_sunset_changed_test.go (moved earlier)")],
    covers: [
      "oasdiff:request-property-sunset-date-changed-earlier",
      "oasdiff:response-property-sunset-date-changed-earlier",
    ],
    schema: [
      { ...s, deprecated: true, "x-sunset": "2031-01-01" },
      { ...s, deprecated: true, "x-sunset": "2030-01-01" },
    ],
    expect: [{ at: "x-sunset", action: "replace", type: annotation, mentions: ["x-sunset"] }],
    // ISSUE-131 (fixed): POLICY-07 decided (a), lifecycle extensions are annotations
  }),
  property({
    id: id(),
    title: "property stability level decreased (x-stability-level stable -> draft)",
    before: "name: x-stability-level stable",
    after: "name: x-stability-level draft",
    rationale: "an oasdiff lifecycle extension; the valid values do not change",
    annotation: "names the stability extension",
    sources: [oas("checker/check_property_stability_level_test.go")],
    covers: ["oasdiff:request-property-stability-decreased", "oasdiff:response-property-stability-decreased"],
    schema: [
      { ...s, "x-stability-level": "stable" },
      { ...s, "x-stability-level": "draft" },
    ],
    expect: [{ at: "x-stability-level", action: "replace", type: annotation, mentions: ["x-stability-level"] }],
    // ISSUE-131 (fixed): POLICY-07 decided (a), lifecycle extensions are annotations
  }),
  property({
    id: id(),
    title: "property stability level increased (x-stability-level beta -> stable)",
    before: "name: x-stability-level beta",
    after: "name: x-stability-level stable",
    rationale: "an oasdiff lifecycle extension; the valid values do not change",
    annotation: "names the stability extension",
    sources: [oas("checker/check_property_stability_level_test.go")],
    covers: ["oasdiff:request-property-stability-increased", "oasdiff:response-property-stability-increased"],
    schema: [
      { ...s, "x-stability-level": "beta" },
      { ...s, "x-stability-level": "stable" },
    ],
    expect: [{ at: "x-stability-level", action: "replace", type: annotation, mentions: ["x-stability-level"] }],
    // ISSUE-131 (fixed): POLICY-07 decided (a), lifecycle extensions are annotations
  }),
  body({
    id: id(),
    title: "deprecated optional request property removed",
    before: "object { a, b (deprecated) }",
    after: "object { a }",
    rationale:
      "the removal was announced, but a prior deprecation does not change the class (POLICY-04 (a)): removing a request property is risky (POLICY-03 (c), oasdiff WARN, INFO after deprecation)",
    annotation: "names the removed property",
    sources: [oas("checker/check_breaking_property_test.go deprecated property deleted (no sunset)", "INFO")],
    covers: ["oasdiff:request-property-removed-with-deprecation", "oasdiff:request-property-removed-before-sunset"],
    placements: ["request"],
    schema: [
      { type: "object", properties: { a: s, b: { ...s, deprecated: true } } },
      { type: "object", properties: { a: s } },
    ],
    expect: [{ at: "properties/b", action: "remove", type: risky, mentions: ["`b`"] }],
    // ISSUE-130 (fixed): POLICY-03 decided (c)
  }),
  body({
    id: id(),
    title: "deprecated required response property removed",
    before: "object { a, b (deprecated) }, required [a, b]",
    after: "object { a }, required [a]",
    rationale:
      "clients still reading b fail even though it was deprecated (oasdiff: INFO with deprecation, ERR before the sunset date)",
    annotation: "names the removed property",
    sources: [
      oas("checker/check_response_required_property_updated_test.go (with deprecation / before sunset)", "INFO"),
    ],
    covers: [
      "oasdiff:response-required-property-removed-with-deprecation",
      "oasdiff:response-required-property-removed-before-sunset",
    ],
    placements: ["response"],
    schema: [
      { type: "object", properties: { a: s, b: { ...s, deprecated: true } }, required: ["a", "b"] },
      { type: "object", properties: { a: s }, required: ["a"] },
    ],
    expect: [{ at: ["properties/b", "required/*"], action: "remove", type: breaking, mentions: ["b"] }],
  }),
  property({
    id: id(),
    title: "x-* extension removed inside a schema (bench J5)",
    before: "name: string, x-param p",
    after: "name: string",
    rationale: "vendor extensions do not change the valid values",
    annotation: "names the extension key",
    sources: [
      bench("J5", "annotation / unclassified / non-breaking accepted"),
      lib("TestCompareSchemas_AddExtension", "non-breaking"),
      oas("checker/check_not_breaking_test.go changing extensions is not breaking", "INFO"),
    ],
    schema: [{ ...s, "x-param": "p" }, s],
    expect: [{ at: "x-param", action: "remove", type: annotation, mentions: ["x-param"] }],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  }),
  property({
    id: id(),
    title: "x-* extension value changed inside a schema",
    before: "name: string, x-entity a",
    after: "name: string, x-entity b",
    rationale: "vendor extensions do not change the valid values (fork: unclassified)",
    annotation: "names the extension key",
    sources: [{ tool: "fork", ref: "test/bugs.test.ts Ref with array to self - cycled path", verdict: "unclassified" }],
    schema: [
      { ...s, "x-entity": "a" },
      { ...s, "x-entity": "b" },
    ],
    expect: [{ at: "x-entity", action: "replace", type: annotation, mentions: ["x-entity"] }],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  }),
]
