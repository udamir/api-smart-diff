// JSON Schema `$ref`: retargeting to equal / different components, inline <-> `$ref`, `$defs`, cycles, sibling
// keywords next to `$ref` (2020-12 / OpenAPI 3.1) and in OpenAPI 3.0 (siblings ignored). The components of a schema
// case are the same on both sides; changes inside a component are doc cases in refs.test.ts.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type SchemaCase, risky } from "../../helpers/compat"
import { body, property, rr, seq, withJsd } from "./kw"

const id = seq("REF")
const oasOnly = "test/compatibility-suites/schemas/schema-test-runner-openapi-only.ts"
const lib = (ref: string, verdict?: string) => ({
  tool: "libopenapi",
  ref: `what-changed/model/schema_test.go ${ref}`,
  ...(verdict ? { verdict } : {}),
})
const aj = (ref: string) => ({
  tool: "json-schema-diff",
  ref: `test/unit/json-schema-diff/diff-schemas-references.spec.ts ${ref}`,
})
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const s = { type: "string" }
const i = { type: "integer" }

const own: SchemaCase[] = [
  body({
    id: id(),
    title: "$ref retargeted to a component of a different type",
    before: "$ref A (string)",
    after: "$ref B (integer)",
    rationale:
      "the resolved schemas differ in type: breaking in both directions (libopenapi: $ref change NB plus the type change B)",
    annotation: "names the type change",
    sources: [
      lib("TestCompareSchemas_RefChanged"),
      aj("schema with string property reference to schema with inline number property"),
    ],
    covers: ["oasdiff:request-body-type-changed", "oasdiff:response-body-type-changed"],
    components: { A: s, B: i },
    schema: [ref("A"), ref("B")],
    expect: [{ at: "type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  body({
    id: id(),
    title: "$ref retargeted to an identical component",
    before: "$ref A (string)",
    after: "$ref B (string)",
    rationale:
      "the resolved schemas are equal: no change in the valid values (the fork reports a rename of the synthetic title)",
    annotation: "no diff (or an annotation)",
    sources: [
      { tool: "fork", ref: "test/json-schema.diff.test.ts rename ref" },
      lib("TestCompareSchemas_PropertyRefChange_Identical"),
    ],
    components: { A: s, B: s },
    schema: [ref("A"), ref("B")],
    expect: [{ at: ["", "$ref"], type: annotation, optional: true }],
  }),
  property({
    id: id(),
    title: "inline schema replaced by an equivalent $ref",
    before: "name: { type: string }",
    after: "name: $ref A (string)",
    rationale: "refactoring inline to $ref changes nothing",
    annotation: "no diff (or an annotation)",
    sources: [
      { tool: "fork", ref: "test/json-schema.diff.test.ts refactoring inline to ref" },
      lib("TestCompareSchemas_RefToInline_IdenticalCopy"),
    ],
    components: { A: s },
    schema: [s, ref("A")],
    expect: [{ at: ["", "$ref"], type: annotation, optional: true }],
  }),
  property({
    id: id(),
    title: "$ref replaced by an equivalent inline schema",
    before: "name: $ref A (string)",
    after: "name: { type: string }",
    rationale: "refactoring $ref to inline changes nothing",
    annotation: "no diff (or an annotation)",
    sources: [lib("TestCompareSchemas_PropertyRefChange_IdenticalReverse")],
    components: { A: s },
    schema: [ref("A"), s],
    expect: [{ at: ["", "$ref"], type: annotation, optional: true }],
  }),
  property({
    id: id(),
    title: "$ref replaced by an inline schema of a different type",
    before: "name: $ref A (integer)",
    after: "name: { type: string }",
    rationale: "the resolved type changes: breaking in both directions",
    annotation: "names the type change and the property",
    sources: [lib("TestCompareSchemas_PropertyRefChange_Fail")],
    covers: ["oasdiff:request-property-type-changed", "oasdiff:response-property-type-changed"],
    components: { A: i },
    schema: [ref("A"), s],
    expect: [{ at: "type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  body({
    id: id(),
    title: "$ref retargeted to a component with an additional required property",
    before: "$ref A { name }",
    after: "$ref B { name }, required [name]",
    rationale: "request: clients omitting name are rejected; response: name is guaranteed",
    annotation: "names the newly required property",
    sources: [lib("TestCompareSchemas_RefRetargeted_RequiredAdded")],
    covers: ["oasdiff:request-property-became-required", "oasdiff:response-property-became-required"],
    components: {
      A: { type: "object", properties: { name: s } },
      B: { type: "object", properties: { name: s }, required: ["name"] },
    },
    schema: [ref("A"), ref("B")],
    expect: [
      {
        at: ["required/*", "required"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["name", "required"],
      },
    ],
  }),
  body({
    id: id(),
    title: "$ref retargeted between two recursive components",
    before: "$ref NodeA { name: string, next: $ref NodeA }",
    after: "$ref NodeB { name: integer, next: $ref NodeB }",
    rationale:
      "the recursive structures differ in the type of name: breaking in both directions; the comparison must terminate",
    annotation: "names the type change of name",
    sources: [
      {
        tool: "openapi-diff",
        ref: "core/src/test/java/org/openapitools/openapidiff/core/RecursiveSchemaTest.java testDiffDifferentCyclic",
      },
      { tool: "fork", ref: "test/cycled-objects.test.ts" },
    ],
    components: {
      NodeA: { type: "object", properties: { name: s, next: ref("NodeA") } },
      NodeB: { type: "object", properties: { name: i, next: ref("NodeB") } },
    },
    schema: [ref("NodeA"), ref("NodeB")],
    expect: [
      {
        at: ["properties/name/type", "**/properties/name/type"],
        action: "replace",
        type: breaking,
        mentions: ["type"],
      },
    ],
    // ISSUE-99 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "3.1: description added next to $ref",
    before: "$ref A",
    after: "$ref A, description d",
    rationale: "in 2020-12 sibling keywords apply; a description is an annotation",
    annotation: "an annotation naming the keyword (description)",
    sources: [
      { tool: "compat-suites", ref: "schemas/json-schema add-sibling-description-for-ref" },
      { tool: "fork", ref: `${oasOnly} add-sibling-description-for-ref` },
    ],
    components: { A: s },
    schema: [ref("A"), { ...ref("A"), description: "d" }],
    expect: [{ at: "description", action: "add", type: annotation, mentions: ["description"] }],
  }),
  body({
    id: id(),
    title: "3.1: sibling enum next to $ref widened",
    before: "$ref A, enum [a]",
    after: "$ref A, enum [a, b]",
    rationale:
      "in 2020-12 the sibling enum applies together with the referenced schema: request non-breaking, response unknown value (POLICY-05: risky, as the fork)",
    annotation: "names the added value (b)",
    sources: [{ tool: "fork", ref: `${oasOnly} change-sibling-enum-for-ref` }],
    components: { A: s },
    schema: [
      { ...ref("A"), enum: ["alpha"] },
      { ...ref("A"), enum: ["alpha", "beta"] },
    ],
    expect: [{ at: "enum/*", action: "add", type: rr(nonBreaking, risky), mentions: ["beta"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b); the description of the added value is ISSUE-57 in both directions
    // ISSUE-57 (fixed) (P8a)
  }),
  body({
    id: id(),
    title: "3.1: sibling maxLength next to $ref decreased",
    before: "$ref A, maxLength 10",
    after: "$ref A, maxLength 5",
    rationale: "the sibling keyword applies: request breaking, response non-breaking",
    annotation: "names the keyword (maxLength)",
    sources: [{ tool: "fork", ref: `${oasOnly} (Reference Sibling Properties)` }],
    covers: ["oasdiff:request-body-max-length-decreased"],
    components: { A: s },
    schema: [
      { ...ref("A"), maxLength: 10 },
      { ...ref("A"), maxLength: 5 },
    ],
    expect: [{ at: "maxLength", action: "replace", type: rr(breaking, nonBreaking), mentions: ["maxLength"] }],
  }),
  body({
    id: id(),
    title: "OpenAPI 3.0: keyword added next to $ref applies",
    before: "$ref A",
    after: "$ref A, maxLength 5",
    rationale:
      "POLICY-25 (a): validation siblings of $ref apply in OpenAPI 3.0 as in 3.1 (tolerant of the common real-world practice, although the 3.0 specification says they SHALL be ignored): request breaking, response non-breaking",
    annotation: "names the keyword (maxLength)",
    sources: [
      { tool: "fork", ref: "test/oas-30-to-31.test.ts could compare overridden description via reference object" },
    ],
    dialect: "3.0",
    components: { A: s },
    schema: [ref("A"), { ...ref("A"), maxLength: 5 }],
    expect: [{ at: "maxLength", action: "add", type: rr(breaking, nonBreaking), mentions: ["maxLength"] }],
    // POLICY-25 decided (a)
  }),
  body({
    id: id(),
    title: "json: $defs reference retargeted",
    before: "$ref #/$defs/A (string)",
    after: "$ref #/$defs/B (integer)",
    rationale: "the resolved type changes: breaking",
    annotation: "names the type change",
    sources: [aj("schema with nested string reference to schema with nested number reference")],
    placements: ["json"],
    components: { A: s, B: i },
    schema: [{ $ref: "#/$defs/A" }, { $ref: "#/$defs/B" }],
    expect: [{ at: "type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  body({
    id: id(),
    title: "json: identical recursive schema",
    before: "$ref #/$defs/Node (recursive)",
    after: "the same",
    rationale: "identical cyclic documents produce no diff and terminate",
    annotation: "no diff",
    sources: [
      { tool: "fork", ref: "test/bugs.test.ts Identity Content With Cycled Ref Array" },
      {
        tool: "openapi-diff",
        ref: "core/src/test/java/org/openapitools/openapidiff/core/RecursiveSchemaTest.java testDiffSame",
      },
    ],
    placements: ["json"],
    components: {
      Node: { type: "object", properties: { children: { type: "array", items: { $ref: "#/$defs/Node" } } } },
    },
    schema: [{ $ref: "#/$defs/Node" }, { $ref: "#/$defs/Node" }],
    expect: [],
  }),
]

// Atlassian json-schema-diff test cases (checklist jsd) represented by the cases above
const R = "diff-schemas-references"
export const cases = withJsd(own, {
  "JS-REF-005": [[R, "schema with string property reference to schema with inline number property"]],
  "JS-REF-013": [
    [
      R,
      "should fail when schema contains circular references",
      "error: Circular $ref pointer found (the tool cannot compare recursive schemas)",
    ],
  ],
})
