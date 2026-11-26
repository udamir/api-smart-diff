// Draft-specific JSON Schema keywords on standalone schemas (placement `json`, request semantics): draft-04 boolean
// exclusive bounds, draft-06 / 07 numeric exclusive bounds, `definitions`, tuple `items` arrays, `dependencies`,
// `$schema` changes and cross-draft rewrites.

import { annotation, breaking, nonBreaking } from "../../../src"
import type { SchemaCase } from "../../helpers/compat"
import { body, kwRe, seq, withJsd } from "./kw"

const id = seq("DRF")
const D4 = "http://json-schema.org/draft-04/schema#"
const D6 = "http://json-schema.org/draft-06/schema#"
const D7 = "http://json-schema.org/draft-07/schema#"
const D2019 = "https://json-schema.org/draft/2019-09/schema"
const D2020 = "https://json-schema.org/draft/2020-12/schema"
const aj = (ref: string) => ({ tool: "json-schema-diff", ref })
const json = { placements: ["json" as const] }
const n = { type: "number" }

const own: SchemaCase[] = [
  body({
    id: id(),
    title: "draft-04: exclusiveMinimum: true added",
    before: "number, minimum 5",
    after: "number, minimum 5, exclusiveMinimum true",
    rationale:
      "draft-04 boolean form: 5 becomes invalid (request breaking); the inclusive keyword only carries the change",
    annotation: "names the exclusive bound",
    sources: [
      { tool: "fork", ref: "test/openapi.exclusive-bounds.test.ts" },
      {
        tool: "openapi-diff",
        ref: "core/src/test/java/org/openapitools/openapidiff/core/NumericRangeBCTest.java requestExclusiveMinSet",
      },
    ],
    ...json,
    draft: D4,
    schema: [
      { ...n, minimum: 5 },
      { ...n, minimum: 5, exclusiveMinimum: true },
    ],
    expect: [
      { at: "minimum", action: "remove", type: nonBreaking, optional: true },
      { at: "exclusiveMinimum", type: breaking, mentions: [kwRe("exclusiveMinimum")] },
    ],
  }),
  body({
    id: id(),
    title: "draft-04: exclusiveMaximum: true removed",
    before: "number, maximum 5, exclusiveMaximum true",
    after: "number, maximum 5",
    rationale: "draft-04 boolean form: 5 becomes valid, every old value stays valid (request non-breaking)",
    annotation: "names the exclusive bound",
    sources: [
      {
        tool: "openapi-diff",
        ref: "core/src/test/java/org/openapitools/openapidiff/core/NumericRangeBCTest.java changedButCompatible",
      },
    ],
    ...json,
    draft: D4,
    schema: [
      { ...n, maximum: 5, exclusiveMaximum: true },
      { ...n, maximum: 5 },
    ],
    expect: [
      { at: "exclusiveMaximum", type: nonBreaking, mentions: [kwRe("exclusiveMaximum")] },
      { at: "maximum", action: "add", type: nonBreaking, optional: true },
    ],
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "draft-04: exclusive minimum value raised",
    before: "number, minimum 5, exclusiveMinimum true",
    after: "number, minimum 7, exclusiveMinimum true",
    rationale: "the exclusive lower bound moves up: request breaking",
    annotation: "names the bound",
    sources: [{ tool: "fork", ref: "test/oas-30-to-31.test.ts origins (exclMin)" }],
    ...json,
    draft: D4,
    schema: [
      { ...n, minimum: 5, exclusiveMinimum: true },
      { ...n, minimum: 7, exclusiveMinimum: true },
    ],
    expect: [{ at: ["minimum", "exclusiveMinimum"], action: "replace", type: breaking, mentions: [/minimum/i] }],
  }),
  body({
    id: id(),
    title: "draft-06: numeric exclusiveMinimum set",
    before: "number",
    after: "number, exclusiveMinimum 0",
    rationale: "draft-06+ numeric form: values <= 0 become invalid",
    annotation: "names the exclusive bound",
    sources: [aj("test/unit/json-schema-diff/diff-schemas-type-number.spec.ts exclusiveMinimum")],
    ...json,
    draft: D6,
    schema: [n, { ...n, exclusiveMinimum: 0 }],
    expect: [{ at: "exclusiveMinimum", action: "add", type: breaking, mentions: [kwRe("exclusiveMinimum")] }],
  }),
  body({
    id: id(),
    title: "draft-07: redundant inclusive bound added next to a tighter exclusive bound",
    before: "number, exclusiveMinimum 5",
    after: "number, exclusiveMinimum 5, minimum 1",
    rationale:
      "the effective lower bound is still > 5: the valid values do not change (fork: redundant bounds changes are not reported)",
    annotation: "no diff (or an annotation)",
    sources: [
      { tool: "fork", ref: "test/openapi.exclusive-bounds.test.ts Redundant bounds changes are not reported" },
      aj(
        "test/unit/json-schema-diff/diff-schemas-type-number.spec.ts simplified to exclusiveMinimum when exclusiveMinimum is greater than minimum",
      ),
    ],
    ...json,
    draft: D7,
    schema: [
      { ...n, exclusiveMinimum: 5 },
      { ...n, exclusiveMinimum: 5, minimum: 1 },
    ],
    expect: [{ at: "minimum", type: annotation, optional: true }],
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "draft-07: definitions reference retargeted",
    before: "$ref #/definitions/A (string)",
    after: "$ref #/definitions/B (integer)",
    rationale: "the resolved type changes: breaking",
    annotation: "names the type change",
    sources: [
      aj(
        "test/unit/json-schema-diff/diff-schemas-references.spec.ts schema with nested string reference to schema with nested number reference",
      ),
    ],
    ...json,
    draft: D7,
    schema: [
      { definitions: { A: { type: "string" }, B: { type: "integer" } }, $ref: "#/definitions/A" },
      { definitions: { A: { type: "string" }, B: { type: "integer" } }, $ref: "#/definitions/B" },
    ],
    expect: [{ at: "type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  body({
    id: id(),
    title: "draft-07: unused definition added",
    before: "string, definitions {}",
    after: "string, definitions { Extra }",
    rationale: "a definition that nothing references does not change the valid values",
    annotation: "names the added definition",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.rules.ts /definitions (non-breaking)" }],
    ...json,
    draft: D7,
    schema: [
      { type: "string", definitions: {} },
      { type: "string", definitions: { Extra: { type: "integer" } } },
    ],
    expect: [{ at: ["definitions/Extra", "definitions/*"], action: "add", type: nonBreaking, mentions: ["Extra"] }],
    // ISSUE-100 (fixed) (P8-rest)
  }),
  body({
    id: id(),
    title: "draft-07: tuple items entry type replaced",
    before: "items [string, integer]",
    after: "items [string, boolean]",
    rationale: "position 1 changes type: breaking",
    annotation: "names the change at the tuple position",
    sources: [
      aj("KEYWORDS.md items tuple (not supported)"),
      { tool: "libopenapi", ref: "what-changed/model/schema_test.go TestCompareSchemas_ItemsModifyAndAddItemArray" },
    ],
    ...json,
    draft: D7,
    schema: [
      { type: "array", items: [{ type: "string" }, { type: "integer" }] },
      { type: "array", items: [{ type: "string" }, { type: "boolean" }] },
    ],
    expect: [{ at: "items/1/type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  body({
    id: id(),
    title: "draft-07: tuple items replaced by a single items schema",
    before: "items [string]",
    after: "items: string",
    rationale: "positions beyond the tuple were unconstrained and must now be strings: breaking",
    annotation: "names the items change",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.transform.ts (items array normalization)" }],
    ...json,
    draft: D7,
    schema: [
      { type: "array", items: [{ type: "string" }] },
      { type: "array", items: { type: "string" } },
    ],
    expect: [{ at: ["items", "items/**", "additionalItems", "additionalItems/**"], type: breaking }],
  }),
  body({
    id: id(),
    title: "draft-07: dependencies (property form) added",
    before: "object { card, billing }",
    after: "object { card, billing }, dependencies { card: [billing] }",
    rationale:
      "objects with card but without billing become invalid: breaking (the draft-07 spelling of dependentRequired)",
    annotation: "names the dependency and its trigger (card)",
    sources: [
      aj("KEYWORDS.md dependencies (not supported)"),
      { tool: "oasdiff", ref: "checker/check_request_property_dependent_required_changed_test.go (2019-09 spelling)" },
    ],
    ...json,
    draft: D7,
    schema: [
      { type: "object", properties: { card: { type: "string" }, billing: { type: "string" } } },
      {
        type: "object",
        properties: { card: { type: "string" }, billing: { type: "string" } },
        dependencies: { card: ["billing"] },
      },
    ],
    expect: [
      { at: ["dependencies", "dependencies/**"], action: "add", type: breaking, mentions: [/dependen/i, "card"] },
    ],
    // ISSUE-90 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "draft-07: dependencies (schema form) removed",
    before: "object { card }, dependencies { card: { required: [billing] } }",
    after: "object { card }",
    rationale: "request: accepts more objects (non-breaking)",
    annotation: "names the dependency",
    sources: [aj("KEYWORDS.md dependencies (not supported)")],
    ...json,
    draft: D7,
    schema: [
      { type: "object", properties: { card: { type: "string" } }, dependencies: { card: { required: ["billing"] } } },
      { type: "object", properties: { card: { type: "string" } } },
    ],
    expect: [{ at: ["dependencies", "dependencies/**"], action: "remove", type: nonBreaking, mentions: [/dependen/i] }],
    // ISSUE-90 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "2019-09: dependentRequired added",
    before: "object { card, billing }",
    after: "object { card, billing }, dependentRequired { card: [billing] }",
    rationale: "objects with card but without billing become invalid: breaking",
    annotation: "names the dependent required properties",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_property_dependent_required_changed_test.go TestRequestBodyDependentRequiredAdded",
      },
    ],
    ...json,
    draft: D2019,
    schema: [
      { type: "object", properties: { card: { type: "string" }, billing: { type: "string" } } },
      {
        type: "object",
        properties: { card: { type: "string" }, billing: { type: "string" } },
        dependentRequired: { card: ["billing"] },
      },
    ],
    expect: [
      {
        at: ["dependentRequired", "dependentRequired/**"],
        action: "add",
        type: breaking,
        mentions: [/dependent/i, "card"],
      },
    ],
    // ISSUE-90 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "$schema changed with identical content (draft-07 -> 2020-12)",
    before: "$schema draft-07, string maxLength 3",
    after: "$schema 2020-12, string maxLength 3",
    rationale: "the keywords used mean the same in both drafts",
    annotation: "an annotation naming $schema",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/breaking_rules.go $schema", verdict: "breaking" }],
    ...json,
    schema: [
      { $schema: D7, type: "string", maxLength: 3 },
      { $schema: D2020, type: "string", maxLength: 3 },
    ],
    expect: [{ at: "$schema", action: "replace", type: annotation, mentions: ["$schema"] }],
  }),
  body({
    id: id(),
    title: "tuple rewritten from draft-07 items array to 2020-12 prefixItems with the $schema change",
    before: "$schema draft-07, items [string], additionalItems false",
    after: "$schema 2020-12, prefixItems [string], items false",
    rationale: "both documents accept exactly the one-string arrays; only the draft spelling changes",
    annotation: "an annotation naming $schema (and nothing else breaking)",
    sources: [{ tool: "fork", ref: "test/oas-30-to-31.test.ts (version equivalences)" }],
    ...json,
    schema: [
      { $schema: D7, type: "array", items: [{ type: "string" }], additionalItems: false },
      { $schema: D2020, type: "array", prefixItems: [{ type: "string" }], items: false },
    ],
    expect: [
      { at: "$schema", action: "replace", type: annotation, mentions: ["$schema"] },
      {
        at: ["items", "items/**", "prefixItems", "prefixItems/**", "additionalItems", "additionalItems/**"],
        type: annotation,
        optional: true,
      },
    ],
    // ISSUE-138 (fixed) (P5) POLICY-28 decided (b)
  }),
]

// Atlassian json-schema-diff test cases (checklist jsd) represented by the cases above
const N = "diff-schemas-type-number"
export const cases = withJsd(own, {
  "JS-DRF-005": [[N, "simplified to exclusiveMinimum when exclusiveMinimum is greater than minimum", null]],
})
