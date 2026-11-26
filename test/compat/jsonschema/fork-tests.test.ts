// JSON Schema scenarios of the Netcracker fork tests (github.com/Netcracker/qubership-apihub-api-diff, test/) and of
// the compatibility suites (github.com/Netcracker/qubership-apihub-compatibility-suites) that the other jsonschema case
// tables do not hold: an equivalent rewrite of "any type", redundant and effective numeric bounds (OpenAPI 3.1
// unified specifications), bare OpenAPI 3.0 boolean exclusive bounds next to a type change and a 3.1 sibling keyword
// removed next to a `$ref`. The cases are defined here (not in a .cases.ts file), so payload-schemas.test.ts does not
// re-run them; the case that a fork AsyncAPI suite also exercises lists the AsyncAPI placements itself.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type CaseSource, type CompatCase, risky, runCases } from "../../helpers/compat"
import { body, kwRe, property, rr } from "./kw"

const bounds = "test/openapi.exclusive-bounds.test.ts"
const fork = (ref: string, verdict?: string): CaseSource => ({ tool: "fork", ref, ...(verdict ? { verdict } : {}) })
const suite = (ref: string, verdict?: string): CaseSource => ({
  tool: "compat-suites",
  ref,
  ...(verdict ? { verdict } : {}),
})
const num = (extra: Record<string, unknown> = {}) => ({ type: "number", ...extra })

// ISSUE-88: numeric bounds are classified per keyword, not by the effective bound
const EFF = "ISSUE-88"

const cases: CompatCase[] = [
  body({
    id: "JS-FRK-001",
    title: "anyOf of every JSON type replaced by the equivalent empty schema",
    before: "anyOf [string, number, integer, boolean, array (items {}), object, null], description",
    after: "{} with the same description",
    rationale:
      "both schemas accept every JSON value (the suite's OpenAPI 3.0 fixture omits null, which is a JSON type in 2020-12): no consumer is affected; the fork reports no diff",
    annotation: "no diff, or an annotation naming anyOf",
    sources: [
      suite("schemas/json-schema/update-schema-type-to-an-equivalent-value", "no diffs"),
      fork("test/compatibility-suites/schemas/schema-test-runner-general.ts update-schema-type-to-an-equivalent-value"),
    ],
    placements: ["request", "response", "aa2-pub", "aa2-sub", "aa3-receive", "aa3-send"],
    schema: [
      {
        description: "to an equivalent",
        anyOf: [
          { type: "string" },
          { type: "number" },
          { type: "integer" },
          { type: "boolean" },
          { type: "array", items: {} },
          { type: "object" },
          // phase H oracle: without `null` the anyOf rejects null, which 2020-12 `{}` accepts (the suite's fixture is
          // written for OpenAPI 3.0, where null is not a type); added so the pair is the equivalent rewrite it names
          { type: "null" },
        ],
      },
      { description: "to an equivalent" },
    ],
    expect: [{ at: ["anyOf", "anyOf/**"], type: annotation, optional: true, mentions: [/anyOf/i] }],
    // the same missing normalization of equivalent type unions as type [a, b] vs anyOf (JS-TYP-023)
    // ISSUE-98 (fixed) (P5)
  }),
  body({
    id: "JS-FRK-002",
    title: "3.1: sibling maxLength removed next to a $ref (the referenced maxLength applies again)",
    before: "$ref Color (string, maxLength 20), sibling maxLength 10",
    after: "$ref Color",
    rationale:
      "the effective limit grows from 10 to 20: a request accepts more values (non-breaking), a response can return longer values than before (breaking, as maxLength increased)",
    annotation: "names the keyword (maxLength)",
    sources: [
      suite("openapi/parameters-schema/remove-sibling-maxLength-for-ref"),
      suite("openapi/request-body-schema/remove-sibling-maxLength-for-ref"),
      suite("openapi/response-body-schema/remove-sibling-maxLength-for-ref"),
      suite("openapi/response-headers-schema/remove-sibling-maxLength-for-ref"),
      fork("test/compatibility-suites/schemas/schema-test-runner-openapi-only.ts remove-sibling-maxLength-for-ref"),
    ],
    components: { Color: { type: "string", maxLength: 20 } },
    schema: [{ $ref: "#/components/schemas/Color", maxLength: 10 }, { $ref: "#/components/schemas/Color" }],
    expect: [{ at: "maxLength", type: rr(nonBreaking, breaking), mentions: [kwRe("maxLength")] }],
  }),
  body({
    id: "JS-FRK-003",
    title: "OpenAPI 3.0: type changed to number together with bare boolean exclusive bounds",
    before: "string",
    after: "number, exclusiveMaximum true, exclusiveMinimum true (no maximum / minimum)",
    rationale:
      "the type change is breaking in both directions (ISSUE-39 convention); draft-04 boolean exclusive bounds only modify maximum / minimum, so without them they have no effect (POLICY-10 decided (a): annotation)",
    annotation: "names the type change; the exclusive flags, if reported, as annotations",
    sources: [
      suite("openapi/parameters-schema/update-specific-type-to-number-with-exclusive-value"),
      suite("openapi/request-body-schema/update-specific-type-to-number-with-exclusive-value"),
      fork(
        "test/compatibility-suites/schemas/schema-test-runner-openapi-only.ts update-specific-type-to-number-with-exclusive-value",
        "type breaking; exclusiveMaximum / exclusiveMinimum added breaking (send) / non-breaking (receive)",
      ),
    ],
    dialect: "3.0",
    schema: [{ type: "string" }, num({ exclusiveMaximum: true, exclusiveMinimum: true })],
    expect: [
      { at: "type", action: "replace", type: breaking, mentions: ["type"] },
      { at: ["exclusiveMaximum", "exclusiveMinimum"], action: "add", type: annotation, optional: true },
    ],
    // ISSUE-133 (fixed) (P5)
  }),
  body({
    id: "JS-FRK-004",
    title: "3.1: redundant exclusiveMinimum added below a tighter minimum",
    before: "number, minimum 1",
    after: "number, minimum 1, exclusiveMinimum 0",
    rationale: "the effective lower bound stays >= 1: the valid values do not change (fork: not reported)",
    annotation: "no diff (or an annotation)",
    sources: [fork(`${bounds} Redundant bounds changes are not reported add redundant lower-bound`, "no diffs")],
    schema: [num({ minimum: 1 }), num({ minimum: 1, exclusiveMinimum: 0 })],
    expect: [{ at: "exclusiveMinimum", type: annotation, optional: true, mentions: [kwRe("exclusiveMinimum")] }],
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: "JS-FRK-005",
    title: "3.1: redundant exclusiveMaximum added above a tighter maximum",
    before: "number, maximum 10",
    after: "number, maximum 10, exclusiveMaximum 11",
    rationale: "the effective upper bound stays <= 10: the valid values do not change (fork: not reported)",
    annotation: "no diff (or an annotation)",
    sources: [fork(`${bounds} Redundant bounds changes are not reported add redundant upper-bound`, "no diffs")],
    schema: [num({ maximum: 10 }), num({ maximum: 10, exclusiveMaximum: 11 })],
    expect: [{ at: "exclusiveMaximum", type: annotation, optional: true, mentions: [kwRe("exclusiveMaximum")] }],
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: "JS-FRK-006",
    title: "3.1: redundant exclusiveMaximum removed",
    before: "number, maximum 10, exclusiveMaximum 11",
    after: "number, maximum 10",
    rationale: "maximum 10 was already the effective bound: the valid values do not change (fork: not reported)",
    annotation: "no diff (or an annotation)",
    sources: [fork(`${bounds} Redundant bounds changes are not reported remove redundant upper-bound`, "no diffs")],
    schema: [num({ maximum: 10, exclusiveMaximum: 11 }), num({ maximum: 10 })],
    expect: [{ at: "exclusiveMaximum", type: annotation, optional: true, mentions: [kwRe("exclusiveMaximum")] }],
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: "JS-FRK-007",
    title: "3.1: redundant exclusiveMinimum removed",
    before: "number, minimum 1, exclusiveMinimum 0",
    after: "number, minimum 1",
    rationale: "minimum 1 was already the effective bound: the valid values do not change (fork: not reported)",
    annotation: "no diff (or an annotation)",
    sources: [fork(`${bounds} Redundant bounds changes are not reported remove redundant lower-bound`, "no diffs")],
    schema: [num({ minimum: 1, exclusiveMinimum: 0 }), num({ minimum: 1 })],
    expect: [{ at: "exclusiveMinimum", type: annotation, optional: true, mentions: [kwRe("exclusiveMinimum")] }],
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: "JS-FRK-008",
    title: "3.1: redundant maximum changed while a tighter exclusiveMaximum stays",
    before: "number, maximum 15, exclusiveMaximum 9",
    after: "number, maximum 10, exclusiveMaximum 9",
    rationale: "the effective upper bound stays < 9: the valid values do not change (fork: not reported)",
    annotation: "no diff (or an annotation)",
    sources: [fork(`${bounds} Redundant bounds changes are not reported change redundant upper bound`, "no diffs")],
    schema: [num({ maximum: 15, exclusiveMaximum: 9 }), num({ maximum: 10, exclusiveMaximum: 9 })],
    expect: [{ at: "maximum", type: annotation, optional: true, mentions: [kwRe("maximum")] }],
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: "JS-FRK-009",
    title: "3.1: redundant minimum changed while a tighter exclusiveMinimum stays",
    before: "number, minimum 1, exclusiveMinimum 5",
    after: "number, minimum 2, exclusiveMinimum 5",
    rationale: "the effective lower bound stays > 5: the valid values do not change (fork: not reported)",
    annotation: "no diff (or an annotation)",
    sources: [fork(`${bounds} Redundant bounds changes are not reported change redundant lower bound`, "no diffs")],
    schema: [num({ minimum: 1, exclusiveMinimum: 5 }), num({ minimum: 2, exclusiveMinimum: 5 })],
    expect: [{ at: "minimum", type: annotation, optional: true, mentions: [kwRe("minimum")] }],
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: "JS-FRK-010",
    title: "3.1: effective lower bound moves from minimum to a stricter exclusiveMinimum",
    before: "number, minimum 1, exclusiveMinimum 0 (effective >= 1)",
    after: "number, minimum 1, exclusiveMinimum 2 (effective > 2)",
    rationale: "request: values 1..2 become invalid (breaking); response: clients receive a subset (non-breaking)",
    annotation: "names the bound keyword (exclusiveMinimum)",
    sources: [
      fork(
        `${bounds} Effective bound defining property switch stricter lower effective bounds as breaking, redundant property diff non-breaking`,
      ),
    ],
    schema: [num({ minimum: 1, exclusiveMinimum: 0 }), num({ minimum: 1, exclusiveMinimum: 2 })],
    expect: [
      {
        at: ["exclusiveMinimum", "minimum"],
        type: rr(breaking, nonBreaking),
        mentions: [/minimum/i],
      },
    ],
  }),
  body({
    id: "JS-FRK-011",
    title: "3.1: effective lower bound moves from exclusiveMinimum back to a looser minimum",
    before: "number, minimum 1, exclusiveMinimum 2 (effective > 2)",
    after: "number, minimum 1, exclusiveMinimum 0 (effective >= 1)",
    rationale:
      "request: more values are accepted (non-breaking); response: values 1..2 can now be returned, a loosened response bound (POLICY-05 decided (b): risky; fork risky)",
    annotation: "names the bound keyword (exclusiveMinimum)",
    sources: [
      fork(
        `${bounds} Effective bound defining property switch looser lower effective bounds as non-breaking, redundant property diff non-breaking`,
      ),
      fork(
        `${bounds} Effective bound defining property switch looser lower effective bounds as risky, redundant property diff non-breaking`,
        "risky",
      ),
    ],
    schema: [num({ minimum: 1, exclusiveMinimum: 2 }), num({ minimum: 1, exclusiveMinimum: 0 })],
    expect: [{ at: ["exclusiveMinimum", "minimum"], type: rr(nonBreaking, risky), mentions: [/minimum/i] }],
  }),
  body({
    id: "JS-FRK-012",
    title: "3.1: effective upper bound moves from maximum to a stricter exclusiveMaximum",
    before: "number, maximum 10, exclusiveMaximum 11 (effective <= 10)",
    after: "number, maximum 10, exclusiveMaximum 9 (effective < 9)",
    rationale: "request: values 9..10 become invalid (breaking); response: clients receive a subset (non-breaking)",
    annotation: "names the bound keyword (exclusiveMaximum)",
    sources: [
      fork(
        `${bounds} Effective bound defining property switch stricter upper effective bounds as breaking, redundant property diff non-breaking`,
      ),
    ],
    schema: [num({ maximum: 10, exclusiveMaximum: 11 }), num({ maximum: 10, exclusiveMaximum: 9 })],
    expect: [{ at: ["exclusiveMaximum", "maximum"], type: rr(breaking, nonBreaking), mentions: [/maximum/i] }],
  }),
  body({
    id: "JS-FRK-013",
    title: "3.1: effective upper bound moves from exclusiveMaximum back to a looser maximum",
    before: "number, maximum 10, exclusiveMaximum 9 (effective < 9)",
    after: "number, maximum 10, exclusiveMaximum 11 (effective <= 10)",
    rationale:
      "request: more values are accepted (non-breaking); response: values 9..10 can now be returned, a loosened response bound (POLICY-05 decided (b): risky; fork risky)",
    annotation: "names the bound keyword (exclusiveMaximum)",
    sources: [
      fork(
        `${bounds} Effective bound defining property switch looser upper effective bounds as non-breaking, redundant property diff non-breaking`,
      ),
      fork(
        `${bounds} Effective bound defining property switch looser upper effective bounds as risky, redundant property diff non-breaking`,
        "risky",
      ),
    ],
    schema: [num({ maximum: 10, exclusiveMaximum: 9 }), num({ maximum: 10, exclusiveMaximum: 11 })],
    expect: [{ at: ["exclusiveMaximum", "maximum"], type: rr(nonBreaking, risky), mentions: [/maximum/i] }],
  }),
  property({
    id: "JS-FRK-014",
    title: "schema externalDocs description changed",
    before: "name: string, externalDocs { url, description Find more info }",
    after: "name: string, externalDocs { url, description More info }",
    rationale: "documentation only",
    annotation: "names externalDocs (description) and the property",
    sources: [
      fork("test/human-readable/openapi/schema-object.test.ts ExternalDocs Description Inline / Ref"),
      suite("openapi/human-readable/schema-object-external-docs-description-inline"),
    ],
    schema: [
      { type: "string", externalDocs: { url: "https://example.com/docs/pet", description: "Find more info" } },
      { type: "string", externalDocs: { url: "https://example.com/docs/pet", description: "More info" } },
    ],
    expect: [
      { at: "externalDocs/description", action: "replace", type: annotation, mentions: [/externalDocs|description/i] },
    ],
  }),
  property({
    id: "JS-FRK-015",
    title: "schema externalDocs url changed",
    before: "name: string, externalDocs { url https://example.com/docs/schema }",
    after: "name: string, externalDocs { url https://example.com/docs/pet-schema }",
    rationale: "documentation only",
    annotation: "names externalDocs (url) and the property",
    sources: [
      fork("test/human-readable/openapi/schema-object.test.ts ExternalDocs Url Inline / Ref"),
      suite("openapi/human-readable/schema-object-external-docs-url-inline"),
    ],
    schema: [
      { type: "string", externalDocs: { url: "https://example.com/docs/schema" } },
      { type: "string", externalDocs: { url: "https://example.com/docs/pet-schema" } },
    ],
    expect: [{ at: "externalDocs/url", action: "replace", type: annotation, mentions: [/externalDocs|url/i] }],
  }),
  body({
    id: "JS-FRK-016",
    title: "OpenAPI schema example added",
    before: "object { prop1: string }",
    after: "object { prop1: string }, example { prop1: dog }",
    rationale: "an example documents values; it does not validate (OAS Schema Object `example`)",
    annotation: "names the example",
    sources: [
      fork("test/human-readable/openapi/schema-object.test.ts Example Inline / Ref"),
      suite("openapi/human-readable/schema-object-example-inline"),
    ],
    schema: [
      { type: "object", properties: { prop1: { type: "string" } } },
      { type: "object", properties: { prop1: { type: "string" } }, example: { prop1: "dog" } },
    ],
    expect: [{ at: ["example", "example/**"], action: "add", type: annotation, mentions: [/example/i] }],
  }),
]

const areas: Record<string, string> = {
  "JS-FRK-001": "types",
  "JS-FRK-002": "refs",
  "JS-FRK-014": "oas-keywords",
  "JS-FRK-015": "oas-keywords",
  "JS-FRK-016": "oas-keywords",
}

runCases(
  "jsonschema",
  "numbers",
  cases.map((c) => ({ ...c, area: areas[c.id] ?? "numbers" })),
  import.meta.filename,
)
