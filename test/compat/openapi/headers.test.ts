import { annotation, breaking, deprecated, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const str = { type: "string" }
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
/** GET /a whose 200 response declares the given headers (no `headers` key when undefined) */
const hdrs = (headers?: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi?: string) =>
  oas({ "/a": { get: { responses: { 200: { description: "ok", ...(headers ? { headers } : {}) } } } } }, extra, openapi)
/** the X-Rate header with the given fields next to an unchanged X-Id header */
const rate = (header: Record<string, unknown> | undefined, openapi?: string) =>
  hdrs({ "X-Id": { schema: str }, ...(header ? { "X-Rate": header } : {}) }, {}, openapi)
const hRef = { $ref: "#/components/headers/RateLimit" }
const withH = (h: unknown, usage: unknown = hRef) =>
  hdrs({ "X-Rate": usage }, { components: { headers: { RateLimit: h } } })

const H = "paths/~1a/get/responses/200/headers"
const X = `${H}/X-Rate`
const site = ["X-Rate", "200"]

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-HDR-001",
    title: "response header added",
    before: "200 with header X-Id",
    after: "200 with headers X-Id and X-Rate",
    rationale: "clients ignore headers they do not know",
    annotation: "names the added header and the status code",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Response Object headers (add / remove only)" },
      { tool: "oasdiff", ref: "checker/check_response_header_added_test.go TestResponseHeaderAdded", verdict: "INFO" },
      { tool: "compat-suites", ref: "openapi/response add-response-header" },
      { tool: "bench", ref: "github G21" },
    ],
    covers: ["oasdiff:response-header-added"],
    docs: [rate(undefined), rate({ schema: str })],
    expect: [{ at: X, action: "add", type: nonBreaking, mentions: site }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-002",
    title: "first response header added (headers map created)",
    before: "200 without `headers`",
    after: "200 with header X-Rate",
    rationale: "clients ignore headers they do not know",
    annotation: "names the added header and the status code",
    sources: [
      { tool: "oasdiff", ref: "checker/check_response_header_added_test.go TestResponseHeaderAdded", verdict: "INFO" },
      { tool: "fork", ref: "test/human-readable/openapi/header-object.test.ts Header Inline" },
    ],
    covers: ["oasdiff:response-header-added"],
    docs: [hdrs(), hdrs({ "X-Rate": { schema: str } })],
    expect: [{ at: [H, X], action: "add", type: nonBreaking, mentions: site }],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-HDR-003",
    title: "required response header removed",
    before: "X-Rate required: true",
    after: "X-Rate removed",
    rationale: "clients that read the guaranteed header fail",
    annotation: "names the removed header and the status code",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Response Object headers (add / remove only)" },
      { tool: "oasdiff", ref: "checker/check_response_header_removed.go required-response-header-removed" },
      { tool: "openapi-diff", ref: "core/src/test/resources/bc_response_headers_decreased.yaml" },
      { tool: "compat-suites", ref: "openapi/response remove-response-header" },
    ],
    covers: ["oasdiff:required-response-header-removed"],
    docs: [rate({ schema: str, required: true }), rate(undefined)],
    expect: [{ at: X, action: "remove", type: breaking, mentions: site }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-004",
    title: "optional response header removed",
    before: "X-Rate (optional)",
    after: "X-Rate removed",
    rationale:
      "an optional header may be absent in any response, so a correct client already handles its absence (same convention as an optional response property, which ASD classifies non-breaking when removed)",
    annotation: "names the removed header and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_removed.go optional-response-header-removed",
        verdict: "INFO",
      },
      { tool: "compat-suites", ref: "openapi/response remove-response-header", verdict: "breaking" },
      {
        tool: "fork",
        ref: "test/compatibility-suites/openapi/response.test.ts Remove response header",
        verdict: "breaking",
      },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.8 (expects breaking)" },
    ],
    covers: ["oasdiff:optional-response-header-removed"],
    docs: [rate({ schema: str }), rate(undefined)],
    expect: [{ at: X, action: "remove", type: nonBreaking, mentions: site }],
    // ISSUE-61 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-005",
    title: "response header renamed",
    before: "header X-Rate-Limit-Limit (required)",
    after: "header X-Rate-Limit-Remaining (required)",
    rationale: "clients reading the old header no longer find it",
    annotation: "names the removed and the added header",
    sources: [{ tool: "compat-suites", ref: "openapi/response update-header-name" }],
    covers: ["oasdiff:required-response-header-removed", "oasdiff:response-header-added"],
    docs: [
      hdrs({ "X-Rate-Limit-Limit": { schema: str, required: true } }),
      hdrs({ "X-Rate-Limit-Remaining": { schema: str, required: true } }),
    ],
    expect: [
      { at: `${H}/X-Rate-Limit-Limit`, action: "remove", type: breaking, mentions: ["X-Rate-Limit-Limit", "200"] },
      {
        at: `${H}/X-Rate-Limit-Remaining`,
        action: "add",
        type: nonBreaking,
        mentions: ["X-Rate-Limit-Remaining", "200"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-HDR-006",
    title: "response header name changes case only",
    before: "header X-Rate",
    after: "header x-rate",
    rationale: "HTTP header names are case-insensitive (RFC 9110 §5.1), OAS says the headers map follows that",
    annotation: "an annotation rename naming the header, or no diff",
    sources: [
      { tool: "oasdiff", ref: "data/header-case (case-insensitive header names)" },
      { tool: "bench", ref: "oas-petstore P22" },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.10" },
    ],
    docs: [hdrs({ "X-Rate": { schema: str } }), hdrs({ "x-rate": { schema: str } })],
    expect: [{ at: [H, X, `${H}/x-rate`], action: "rename", type: annotation, optional: true, mentions: ["x-rate"] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-007",
    title: "response header became required",
    before: "X-Rate optional (required absent or false)",
    after: "X-Rate required: true",
    rationale: "the server now always sends the header: a stronger guarantee for clients",
    annotation: "names the required status of the header and the status code",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Header Object required (supported)" },
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_became_optional.go (only the opposite direction is an error)",
        verdict: "not reported",
      },
      {
        tool: "openapi-diff",
        ref: "core/src/test/.../backcompat/HeaderBCTest.java responseRequiredIncreased (TODO: document why)",
        verdict: "incompatible",
      },
      {
        tool: "fork",
        ref: "src/openapi/openapi3.rules.ts headers /required [breaking, nonBreaking, breakingIfAfterTrue]",
        verdict: "breaking",
      },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.8 (expects breaking)" },
    ],
    docs: {
      absent: [rate({ schema: str }), rate({ schema: str, required: true })],
      false: [rate({ schema: str, required: false }), rate({ schema: str, required: true })],
    },
    expect: [{ at: `${X}/required`, action: ["add", "replace"], type: nonBreaking, mentions: ["required", ...site] }],
    // ISSUE-61 (fixed): classified by direction; the description of `required` is ISSUE-86
    // ISSUE-86 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-HDR-008",
    title: "response header became optional",
    before: "X-Rate required: true",
    after: "required false or absent",
    rationale: "clients that rely on the guaranteed header may not receive it",
    annotation: "names the required status of the header and the status code",
    sources: [
      { tool: "oasdiff", ref: "checker/check_response_header_became_optional.go response-header-became-optional" },
      { tool: "openapi-diff", ref: "core/src/test/resources/bc_response_header_required_decreased.yaml" },
      {
        tool: "fork",
        ref: "test/human-readable/openapi/header-object.test.ts Required Inline",
        verdict: "non-breaking",
      },
    ],
    covers: ["oasdiff:response-header-became-optional"],
    docs: {
      false: [rate({ schema: str, required: true }), rate({ schema: str, required: false })],
      absent: [rate({ schema: str, required: true }), rate({ schema: str })],
    },
    expect: [{ at: `${X}/required`, action: ["remove", "replace"], type: breaking, mentions: ["required", ...site] }],
    // ISSUE-61 (fixed): classified by direction; the description of `required` is ISSUE-86
    // ISSUE-86 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-HDR-009",
    title: "explicit default values added to a response header",
    before: "X-Rate with schema only",
    after:
      "X-Rate with required: false / deprecated: false / allowEmptyValue: false / allowReserved: false / style: simple / explode: false",
    rationale: "each value is the Header Object default: the contract is unchanged",
    annotation: "no diff",
    sources: [
      { tool: "compat-suites", ref: "openapi/response add-required-attribute-with-default-value-for-header" },
      { tool: "compat-suites", ref: "openapi/response add-deprecated-attribute-with-default-value-for-header" },
      { tool: "compat-suites", ref: "openapi/response add-allowEmptyValue-attribute-with-default-value-for-header" },
      { tool: "compat-suites", ref: "openapi/response add-allowReserved-attribute-with-default-value-for-header" },
      { tool: "fork", ref: "test/compatibility-suites/openapi/response.test.ts Add/remove default values (expect [])" },
    ],
    docs: {
      required: [rate({ schema: str }), rate({ schema: str, required: false })],
      deprecated: [rate({ schema: str }), rate({ schema: str, deprecated: false })],
      allowEmptyValue: [rate({ schema: str }), rate({ schema: str, allowEmptyValue: false })],
      allowReserved: [rate({ schema: str }), rate({ schema: str, allowReserved: false })],
      style: [rate({ schema: str }), rate({ schema: str, style: "simple" })],
      explode: [rate({ schema: str }), rate({ schema: str, explode: false })],
    },
    expect: [],
    // ISSUE-70 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-010",
    title: "explicit default values removed from a response header",
    before:
      "X-Rate with required: false / deprecated: false / allowEmptyValue: false / allowReserved: false / style: simple / explode: false",
    after: "X-Rate with schema only",
    rationale: "each value is the Header Object default: the contract is unchanged",
    annotation: "no diff",
    sources: [
      { tool: "compat-suites", ref: "openapi/response remove-required-attribute-with-default-value-from-header" },
      { tool: "compat-suites", ref: "openapi/response remove-deprecated-attribute-with-default-value-from-header" },
      {
        tool: "compat-suites",
        ref: "openapi/response remove-allowEmptyValue-attribute-with-default-value-from-header",
      },
      { tool: "compat-suites", ref: "openapi/response remove-allowReserved-attribute-with-default-value-from-header" },
    ],
    docs: {
      required: [rate({ schema: str, required: false }), rate({ schema: str })],
      deprecated: [rate({ schema: str, deprecated: false }), rate({ schema: str })],
      allowEmptyValue: [rate({ schema: str, allowEmptyValue: false }), rate({ schema: str })],
      allowReserved: [rate({ schema: str, allowReserved: false }), rate({ schema: str })],
      style: [rate({ schema: str, style: "simple" }), rate({ schema: str })],
      explode: [rate({ schema: str, explode: false }), rate({ schema: str })],
    },
    expect: [],
    // ISSUE-70 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-011",
    title: "response header deprecated",
    before: "X-Rate",
    after: "X-Rate deprecated: true",
    rationale: "deprecation announces a future removal; nothing breaks yet",
    annotation: "names the deprecated status of the header and the status code",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/header-object.test.ts Deprecated Inline" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Header.Deprecated" },
    ],
    docs: [rate({ schema: str }), rate({ schema: str, deprecated: true })],
    expect: [{ at: `${X}/deprecated`, action: "add", type: deprecated, mentions: ["deprecated", ...site] }],
    // ISSUE-86 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-HDR-012",
    title: "response header deprecation withdrawn",
    before: "X-Rate deprecated: true",
    after: "X-Rate not deprecated",
    rationale: "withdrawing a deprecation keeps the header; ASD classifies every deprecation change as `deprecated`",
    annotation: "names the deprecated status of the header and the status code",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/header_test.go deprecated removed" }],
    docs: [rate({ schema: str, deprecated: true }), rate({ schema: str })],
    expect: [{ at: `${X}/deprecated`, action: "remove", type: deprecated, mentions: ["deprecated", ...site] }],
    // ISSUE-86 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-HDR-013",
    title: "response header description added, changed, removed",
    before: "description absent / `a`",
    after: "`a` / `b` / absent",
    rationale: "documentation only",
    annotation: "names the description, the header and the status code",
    sources: [
      {
        tool: "compat-suites",
        ref: "openapi/response add-header-description, update-header-description, remove-header-description",
      },
      { tool: "fork", ref: "test/human-readable/openapi/header-object.test.ts Description Inline" },
    ],
    docs: {
      add: [rate({ schema: str }), rate({ schema: str, description: "a" })],
      change: [rate({ schema: str, description: "a" }), rate({ schema: str, description: "b" })],
      remove: [rate({ schema: str, description: "a" }), rate({ schema: str })],
    },
    expect: [{ at: `${X}/description`, type: annotation, mentions: ["description", ...site] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-014",
    title: "response header type changed (string date-time -> integer)",
    before: "Retry-After: string, format date-time",
    after: "Retry-After: integer",
    rationale: "clients parsing an HTTP date get a number of seconds",
    annotation: "names the type (and format) change of the header and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_type_changed_test.go TestResponseHeaderTypeChanged_StringDateTimeToInteger",
      },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Schema.Type modified" },
    ],
    covers: ["oasdiff:response-header-type-changed"],
    docs: [
      hdrs({ "Retry-After": { schema: { type: "string", format: "date-time" } } }),
      hdrs({ "Retry-After": { schema: { type: "integer" } } }),
    ],
    expect: [
      { at: `${H}/Retry-After/schema/type`, type: breaking, mentions: ["type", "Retry-After", "200"] },
      { at: `${H}/Retry-After/schema/format`, type: breaking, mentions: ["format", "Retry-After", "200"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-HDR-015",
    title: "response header type widened (integer -> number)",
    before: "X-Rate: integer",
    after: "X-Rate: number",
    rationale: "the server may now send fractional values clients cannot parse as integers",
    annotation: "names the type change of the header and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_type_changed_test.go TestResponseHeaderTypeChanged_IntegerToNumberIsGeneralized",
      },
    ],
    covers: ["oasdiff:response-header-type-generalized"],
    docs: [rate({ schema: { type: "integer" } }), rate({ schema: { type: "number" } })],
    expect: [{ at: `${X}/schema/type`, type: breaking, mentions: ["type", ...site] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-016",
    title: "response header type narrowed (number -> integer)",
    before: "X-Rate: number",
    after: "X-Rate: integer",
    rationale: "every integer is a number: clients keep parsing the values",
    annotation: "names the type change of the header and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_type_changed_test.go TestResponseHeaderTypeChanged_NumberToIntegerIsSpecialized",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:response-header-type-specialized"],
    docs: [rate({ schema: { type: "number" } }), rate({ schema: { type: "integer" } })],
    expect: [{ at: `${X}/schema/type`, type: nonBreaking, mentions: ["type", ...site] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-017",
    title: "response header type changed string -> integer without format",
    before: "X-Rate: string",
    after: "X-Rate: integer",
    rationale:
      "proposed (a): the schema no longer admits the values clients were told to expect; under (b) a header value is text on the wire and `123` is still a valid string",
    annotation: "names the type change of the header and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_type_changed_test.go TestResponseHeaderTypeChanged_StringToIntegerIsCompatible",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Schema.Type modified", verdict: "breaking" },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.9" },
    ],
    covers: ["oasdiff:response-header-type-compatible"],
    docs: [rate({ schema: str }), rate({ schema: { type: "integer" } })],
    expect: [{ at: `${X}/schema/type`, type: breaking, mentions: ["type", ...site] }],
    // POLICY-16 decided (a)
  },
  {
    kind: "doc",
    id: "OAS-HDR-018",
    title: "response header became nullable",
    before: "X-Rate: string",
    after: "3.1 type [string, null] / 3.0 nullable: true",
    rationale: "clients that never expected null may receive it",
    annotation: "names the null type of the header and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_became_nullable_test.go TestResponseHeaderBecameNullable",
      },
    ],
    covers: ["oasdiff:response-header-became-nullable"],
    docs: {
      "3.1": [rate({ schema: str }), rate({ schema: { type: ["string", "null"] } })],
      "3.0": [rate({ schema: str }, "3.0.3"), rate({ schema: { type: "string", nullable: true } }, "3.0.3")],
    },
    expect: [
      {
        at: [`${X}/schema/type/**`, `${X}/schema/nullable`],
        action: "add",
        type: breaking,
        mentions: ["null", ...site],
      },
    ],
    // ISSUE-71 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-019",
    title: "response header became not nullable",
    before: "3.1 type [string, null] / 3.0 nullable: true",
    after: "X-Rate: string",
    rationale: "the server sends a subset of what it sent before",
    annotation: "names the null type of the header and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_became_nullable_test.go TestResponseHeaderBecameNotNullable",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:response-header-became-not-nullable"],
    docs: {
      "3.1": [rate({ schema: { type: ["string", "null"] } }), rate({ schema: str })],
      "3.0": [rate({ schema: { type: "string", nullable: true } }, "3.0.3"), rate({ schema: str }, "3.0.3")],
    },
    expect: [
      {
        at: [`${X}/schema/type/**`, `${X}/schema/nullable`],
        action: "remove",
        type: nonBreaking,
        mentions: ["null", ...site],
      },
    ],
    // ISSUE-71 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-020",
    title: "response header schema became `false`",
    before: "X-Rate schema string",
    after: "X-Rate schema false",
    rationale:
      "no value validates any more, so the server can no longer send the header: clients see fewer values (oasdiff INFO)",
    annotation: "names the schema of the header and the status code",
    sources: [{ tool: "oasdiff", ref: "checker/rules.go response-header-schema-became-false", verdict: "INFO" }],
    covers: ["oasdiff:response-header-schema-became-false"],
    docs: [rate({ schema: str }), rate({ schema: false })],
    expect: [{ at: `${X}/schema`, action: "replace", type: nonBreaking, mentions: ["schema", ...site] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-021",
    title: "response header schema `false` replaced by a real schema",
    before: "X-Rate schema false",
    after: "X-Rate schema string",
    rationale: "values the client was told cannot occur may now be sent",
    annotation: "names the schema of the header and the status code",
    sources: [{ tool: "oasdiff", ref: "checker/rules.go response-header-schema-became-not-false" }],
    covers: ["oasdiff:response-header-schema-became-not-false"],
    docs: [rate({ schema: false }), rate({ schema: str })],
    expect: [{ at: `${X}/schema`, action: "replace", type: breaking, mentions: ["schema", ...site] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-022",
    title: "response header schema keyword tightened and loosened",
    before: "X-Rate string maxLength 10",
    after: "maxLength 5 / maxLength 20",
    rationale: "response semantics: a lower maximum narrows the values clients receive, a higher one widens them",
    annotation: "names the keyword, the header and the status code",
    sources: [
      { tool: "asd", ref: "test/openapi/annotations-merged.test.ts C8.5" },
      {
        tool: "oasdiff",
        ref: "checker/check_response_header_type_changed.go (header schema walked by the response checks)",
      },
    ],
    docs: {
      tighter: [
        rate({ schema: { type: "string", maxLength: 10 } }),
        rate({ schema: { type: "string", maxLength: 5 } }),
      ],
      looser: [
        rate({ schema: { type: "string", maxLength: 10 } }),
        rate({ schema: { type: "string", maxLength: 20 } }),
      ],
    },
    expect: {
      tighter: [{ at: `${X}/schema/maxLength`, type: nonBreaking, mentions: ["maxLength", ...site] }],
      looser: [{ at: `${X}/schema/maxLength`, type: breaking, mentions: ["maxLength", ...site] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-HDR-023",
    title: "response header described with `content` instead of `schema`: inner schema changed",
    before: "X-Rate content text/plain schema string",
    after: "schema integer",
    rationale: "clients parsing the header as text of the old schema fail",
    annotation: "names the type change of the header and the status code",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/header_test.go content changed" }],
    docs: [
      rate({ content: { "text/plain": { schema: str } } }),
      rate({ content: { "text/plain": { schema: { type: "integer" } } } }),
    ],
    expect: [{ at: `${X}/content/text~1plain/schema/type`, type: breaking, mentions: ["type", ...site] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-024",
    title: "array response header explode changed",
    before: "X-Tags array, explode true",
    after: "explode false",
    rationale: "the serialization of the values changes, clients splitting the old form misread it",
    annotation: "names explode, the header and the status code",
    sources: [
      { tool: "openapi-diff", ref: "core/src/test/resources/bc_response_header_explode_changed.yaml" },
      { tool: "fork", ref: "test/human-readable/openapi/header-object.test.ts Explode Inline" },
    ],
    docs: [
      hdrs({ "X-Tags": { schema: { type: "array", items: str }, explode: true } }),
      hdrs({ "X-Tags": { schema: { type: "array", items: str }, explode: false } }),
    ],
    expect: [{ at: `${H}/X-Tags/explode`, type: breaking, mentions: ["explode", "X-Tags", "200"] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-025",
    title: "response header example and examples changed",
    before: "X-Rate example `1` / examples.a value `1`",
    after: "example `2` / examples.a value `2`",
    rationale: "examples are documentation only",
    annotation: "names the example, the header and the status code",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/header-object.test.ts Example Inline, Example Array Inline" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Header.Example, Header.Examples" },
    ],
    docs: {
      example: [rate({ schema: str, example: "1" }), rate({ schema: str, example: "2" })],
      examples: [
        rate({ schema: str, examples: { a: { value: "1" } } }),
        rate({ schema: str, examples: { a: { value: "2" } } }),
      ],
    },
    expect: [{ at: [`${X}/example`, `${X}/examples/**`], type: annotation, mentions: ["example", ...site] }],
  },
  {
    kind: "doc",
    id: "OAS-HDR-026",
    title: "$ref response header (components.headers) schema changed",
    before: "X-Rate $ref RateLimit (integer)",
    after: "RateLimit string",
    rationale: "clients parsing an integer fail; reported at the usage and in the component",
    annotation: "names the type change at the usage (header, status) and in component RateLimit",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/header-object.test.ts Header Ref" },
      { tool: "libopenapi", ref: "what-changed/model/header_test.go" },
    ],
    covers: ["oasdiff:response-header-type-changed"],
    docs: [withH({ schema: { type: "integer" } }), withH({ schema: str })],
    expect: [
      { at: `${X}/schema/type`, type: breaking, mentions: ["type", ...site] },
      { at: "components/headers/RateLimit/schema/type", type: breaking, mentions: ["type", "RateLimit"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-HDR-027",
    title: "$ref response header shared by two responses: schema changed",
    before: "200 and 429 reference RateLimit (integer)",
    after: "RateLimit string",
    rationale: "each usage must be described with its own status code",
    annotation: "names the header with the status code of each usage site",
    sources: [
      { tool: "asd", ref: "docs/ANALYSIS.md ISSUE-09 (cached $ref results re-annotated with the first usage)" },
    ],
    docs: [
      oas(
        {
          "/a": {
            get: {
              responses: {
                200: { description: "ok", headers: { "X-Rate": hRef } },
                429: { description: "slow", headers: { "X-Rate": hRef } },
              },
            },
          },
        },
        { components: { headers: { RateLimit: { schema: { type: "integer" } } } } },
      ),
      oas(
        {
          "/a": {
            get: {
              responses: {
                200: { description: "ok", headers: { "X-Rate": hRef } },
                429: { description: "slow", headers: { "X-Rate": hRef } },
              },
            },
          },
        },
        { components: { headers: { RateLimit: { schema: str } } } },
      ),
    ],
    expect: [
      { at: `${X}/schema/type`, type: breaking, mentions: ["X-Rate", "200"] },
      { at: "paths/~1a/get/responses/429/headers/X-Rate/schema/type", type: breaking, mentions: ["X-Rate", "429"] },
      { at: "components/headers/RateLimit/schema/type", type: breaking, mentions: ["RateLimit"] },
    ],
    // ISSUE-55 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-HDR-028",
    title: "3.1 reference object: overriding description added next to a header $ref",
    before: "X-Rate: { $ref: RateLimit }",
    after: "X-Rate: { $ref: RateLimit, description: `o` }",
    rationale: "OAS 3.1 Reference Object `description` overrides the referenced one; documentation only",
    annotation: "names the description of the header",
    sources: [
      { tool: "compat-suites", ref: "openapi/headers add-overriden-description" },
      { tool: "fork", ref: "test/compatibility-suites/openapi/headers.test.ts runRefObjectDescriptionTests" },
    ],
    docs: [
      withH({ schema: str, description: "c" }),
      withH({ schema: str, description: "c" }, { ...hRef, description: "o" }),
    ],
    expect: [
      { at: `${X}/description`, action: ["add", "replace"], type: annotation, mentions: ["description", ...site] },
    ],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-029",
    title: "3.1 reference object: overriding description removed from a header $ref",
    before: "X-Rate: { $ref: RateLimit, description: `o` }",
    after: "X-Rate: { $ref: RateLimit }",
    rationale: "documentation only",
    annotation: "names the description of the header",
    sources: [{ tool: "compat-suites", ref: "openapi/headers remove-overriden-description" }],
    docs: [
      withH({ schema: str, description: "c" }, { ...hRef, description: "o" }),
      withH({ schema: str, description: "c" }),
    ],
    expect: [
      { at: `${X}/description`, action: ["remove", "replace"], type: annotation, mentions: ["description", ...site] },
    ],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-030",
    title: "3.1 reference object: overriding description of a header $ref changed",
    before: "description `o1`",
    after: "description `o2`",
    rationale: "documentation only",
    annotation: "names the description of the header",
    sources: [{ tool: "compat-suites", ref: "openapi/headers change-overriden-description" }],
    docs: [
      withH({ schema: str, description: "c" }, { ...hRef, description: "o1" }),
      withH({ schema: str, description: "c" }, { ...hRef, description: "o2" }),
    ],
    expect: [{ at: `${X}/description`, action: "replace", type: annotation, mentions: ["description", ...site] }],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-031",
    title: "3.1 reference object: referenced header description changed while the usage overrides it",
    before: "X-Rate: { $ref: RateLimit, description: `o` }, RateLimit.description `c1`",
    after: "RateLimit.description `c2`",
    rationale: "the usage still shows `o`: only the component changed",
    annotation: "names the description of component RateLimit; nothing at the usage site",
    sources: [{ tool: "compat-suites", ref: "openapi/headers change-referenced-description-when-overridden-exists" }],
    docs: [
      withH({ schema: str, description: "c1" }, { ...hRef, description: "o" }),
      withH({ schema: str, description: "c2" }, { ...hRef, description: "o" }),
    ],
    expect: [
      {
        at: "components/headers/RateLimit/description",
        action: "replace",
        type: annotation,
        mentions: ["description", "RateLimit"],
      },
    ],
    // ISSUE-60 (fixed for this variant): the referenced description change is an annotation inside a component, reported
    // at the declaration only (POLICY-57, ISSUE-190), so the overridden usage site no longer repeats it
  },
  {
    kind: "doc",
    id: "OAS-HDR-032",
    title: "unreferenced components.headers entry changed",
    before: "components.headers.Unused integer (no usage)",
    after: "Unused string",
    rationale: "no response uses the header: decision §11.4 classifies unreferenced components as unclassified",
    annotation: "names component Unused and the type change",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §11.4" }],
    docs: [
      hdrs(undefined, { components: { headers: { Unused: { schema: { type: "integer" } } } } }),
      hdrs(undefined, { components: { headers: { Unused: { schema: str } } } }),
    ],
    expect: [{ at: "components/headers/Unused/schema/type", type: unclassified, mentions: ["type", "Unused"] }],
    // ISSUE-69 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-033",
    title: "Content-Type declared as a response header",
    before: "200 with header X-Id",
    after: "200 with headers X-Id and Content-Type",
    rationale:
      "OAS 3.x Response Object: a response header named Content-Type SHALL be ignored, so the contract is unchanged",
    annotation: "no diff, or an annotation naming the ignored header",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/response.go headers (no special case)", verdict: "non-breaking" },
    ],
    docs: [hdrs({ "X-Id": { schema: str } }), hdrs({ "X-Id": { schema: str }, "Content-Type": { schema: str } })],
    expect: [{ at: `${H}/Content-Type`, type: annotation, optional: true, mentions: ["Content-Type"] }],
    // ISSUE-76 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-HDR-034",
    title: "response header added to an error and to the default response",
    before: "404 / default without headers",
    after: "404 / default with header X-Request-Id",
    rationale: "clients ignore headers they do not know, whatever the status",
    annotation: "names the header and the status code",
    sources: [{ tool: "oasdiff", ref: "checker/check_response_header_added.go (all statuses)", verdict: "INFO" }],
    covers: ["oasdiff:response-header-added"],
    docs: {
      "404": [
        oas({ "/a": { get: { responses: { 404: { description: "nf", headers: { "X-Id": { schema: str } } } } } } }),
        oas({
          "/a": {
            get: {
              responses: {
                404: { description: "nf", headers: { "X-Id": { schema: str }, "X-Request-Id": { schema: str } } },
              },
            },
          },
        }),
      ],
      default: [
        oas({ "/a": { get: { responses: { default: { description: "e", headers: { "X-Id": { schema: str } } } } } } }),
        oas({
          "/a": {
            get: {
              responses: {
                default: { description: "e", headers: { "X-Id": { schema: str }, "X-Request-Id": { schema: str } } },
              },
            },
          },
        }),
      ],
    },
    expect: {
      "404": [
        {
          at: "paths/~1a/get/responses/404/headers/X-Request-Id",
          action: "add",
          type: nonBreaking,
          mentions: ["X-Request-Id", "404"],
        },
      ],
      default: [
        {
          at: "paths/~1a/get/responses/default/headers/X-Request-Id",
          action: "add",
          type: nonBreaking,
          mentions: ["X-Request-Id", "default"],
        },
      ],
    },
  },
]

runCases("openapi", "headers", cases, import.meta.filename)
