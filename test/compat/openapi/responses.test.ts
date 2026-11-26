import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const str = { type: "string" }
const json = (schema: unknown = str) => ({ "application/json": { schema } })
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
/** GET /a with the given responses */
const get = (responses: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi?: string) =>
  oas({ "/a": { get: { responses } } }, extra, openapi)
const r = (extra: Record<string, unknown> = {}) => ({ description: "ok", ...extra })
const rRef = { $ref: "#/components/responses/NotFound" }
const withR = (nf: unknown, usage: unknown = rRef) =>
  get({ 200: r(), 404: usage }, { components: { responses: { NotFound: nf } } })

const RS = "paths/~1a/get/responses"

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-RS-001",
    title: "success status added next to an existing success status",
    before: "GET /a responses 200",
    after: "responses 200 and 201",
    rationale: "documenting an additional success response is reported as compatible by every tool",
    annotation: "names the added status code",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Responses Object ({http status code} supported)" },
      {
        tool: "oasdiff",
        ref: "checker/check_response_status_updated_test.go TestResponseSuccessStatusAdded",
        verdict: "INFO",
      },
      { tool: "compat-suites", ref: "openapi/response add-new-response" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Responses.Codes added" },
    ],
    covers: ["oasdiff:response-success-status-added"],
    docs: [get({ 200: r() }), get({ 200: r(), 201: r() })],
    expect: [{ at: `${RS}/201`, action: "add", type: nonBreaking, mentions: ["201"] }],
  },
  {
    kind: "doc",
    id: "OAS-RS-002",
    title: "success status removed",
    before: "responses 200 and 202",
    after: "responses 200",
    rationale: "clients that rely on the documented 202 outcome no longer get it",
    annotation: "names the removed status code",
    sources: [
      {
        tool: "optic",
        ref: "projects/standard-rulesets/src/breaking-changes/__tests__/response-status-code-removal.test.ts status code removal",
      },
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Responses Object ({http status code} supported)" },
      { tool: "oasdiff", ref: "checker/check_response_status_updated_test.go TestResponseSuccessStatusRemoved" },
      { tool: "compat-suites", ref: "openapi/response remove-response" },
      { tool: "openapi-diff", ref: "core/src/test/.../backcompat/ApiResponseBCTest.java decreased" },
    ],
    covers: [
      "oasdiff:response-success-status-removed",
      "optic:response-status-code-removal::breaking changes ruleset - response status code removal > status code removal",
    ],
    docs: [get({ 200: r(), 202: r() }), get({ 200: r() })],
    expect: [{ at: `${RS}/202`, action: "remove", type: breaking, mentions: ["202"] }],
  },
  {
    kind: "doc",
    id: "OAS-RS-003",
    title: "success status changed (200 -> 201)",
    before: "responses 200",
    after: "responses 201",
    rationale: "clients that check for 200 no longer receive it",
    annotation: "names the removed 200 and the added 201",
    sources: [{ tool: "oasdiff", ref: "checker/check_response_status_updated.go (removed + added)" }],
    covers: ["oasdiff:response-success-status-removed", "oasdiff:response-success-status-added"],
    docs: [get({ 200: r() }), get({ 201: r() })],
    expect: [
      { at: `${RS}/200`, action: "remove", type: breaking, mentions: ["200"] },
      { at: `${RS}/201`, action: "add", type: nonBreaking, mentions: ["201"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-RS-004",
    title: "non-success status added",
    before: "responses 200",
    after: "responses 200 and 404",
    rationale: "documenting an error response that may already have happened does not change the success path",
    annotation: "names the added status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_status_updated_test.go TestResponseNonSuccessStatusAdded",
        verdict: "INFO",
      },
      { tool: "bench", ref: "oas-petstore P21 (429 added)" },
      { tool: "fork", ref: "test/human-readable/openapi/response-object.test.ts Response Inline" },
    ],
    covers: ["oasdiff:response-non-success-status-added"],
    docs: {
      "404": [get({ 200: r() }), get({ 200: r(), 404: r({ description: "nf" }) })],
      "429": [get({ 200: r() }), get({ 200: r(), 429: r({ description: "slow" }) })],
    },
    expect: {
      "404": [{ at: `${RS}/404`, action: "add", type: nonBreaking, mentions: ["404"] }],
      "429": [{ at: `${RS}/429`, action: "add", type: nonBreaking, mentions: ["429"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-RS-005",
    title: "non-success status removed",
    before: "responses 200 and 404",
    after: "responses 200",
    rationale:
      "POLICY-13 (b): clients never fail because an error outcome stops happening (oasdiff INFO); the server may still answer with an undocumented error, which clients handle generically",
    annotation: "names the removed status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_status_updated_test.go TestResponseNonSuccessStatusRemoved",
        verdict: "INFO",
      },
      { tool: "fork", ref: "test/compatibility-suites/openapi/response.test.ts Remove response", verdict: "breaking" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Responses.Codes removed", verdict: "breaking" },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.1" },
    ],
    covers: ["oasdiff:response-non-success-status-removed"],
    docs: [get({ 200: r(), 404: r({ description: "nf" }) }), get({ 200: r() })],
    expect: [{ at: `${RS}/404`, action: "remove", type: nonBreaking, mentions: ["404"] }],
    // ISSUE-134 (fixed); POLICY-13 decided (b)
  },
  {
    kind: "doc",
    id: "OAS-RS-006",
    title: "default response added",
    before: "responses 200",
    after: "responses 200 and default",
    rationale: "documenting the catch-all response adds information only",
    annotation: "names the default response",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/responses_test.go default added" },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.2" },
    ],
    docs: [get({ 200: r() }), get({ 200: r(), default: r({ description: "error" }) })],
    expect: [{ at: `${RS}/default`, action: "add", type: nonBreaking, mentions: ["default"] }],
  },
  {
    kind: "doc",
    id: "OAS-RS-007",
    title: "default response removed",
    before: "responses 200 and default (error schema)",
    after: "responses 200",
    rationale:
      "POLICY-13 (b): a removed catch-all error response removes no outcome a client relies on to succeed (clients handle undocumented errors generically)",
    annotation: "names the default response",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Responses.Default removed" },
      {
        tool: "oasdiff",
        ref: "checker/check_response_status_updated.go (non-numeric statuses are skipped)",
        verdict: "not reported",
      },
    ],
    docs: [get({ 200: r(), default: r({ description: "error", content: json() }) }), get({ 200: r() })],
    expect: [{ at: `${RS}/default`, action: "remove", type: nonBreaking, mentions: ["default"] }],
    // ISSUE-134 (fixed); POLICY-13 decided (b)
  },
  {
    kind: "doc",
    id: "OAS-RS-008",
    title: "status range response added (2XX / 4XX / 5XX)",
    before: "responses 200",
    after: "responses 200 and 5XX",
    rationale: "documenting a range of error responses adds information only",
    annotation: "names the added status range",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/responses_test.go codes added" }],
    docs: [get({ 200: r() }), get({ 200: r(), "5XX": r({ description: "server error" }) })],
    expect: [{ at: `${RS}/5XX`, action: "add", type: nonBreaking, mentions: ["5XX"] }],
  },
  {
    kind: "doc",
    id: "OAS-RS-009",
    title: "status range response removed",
    before: "responses 200 and 4XX",
    after: "responses 200",
    rationale: "POLICY-13 (b): as for an explicit error status",
    annotation: "names the removed status range",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Responses Object (ranges not supported)" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Responses.Codes removed" },
    ],
    docs: [get({ 200: r(), "4XX": r({ description: "client error" }) }), get({ 200: r() })],
    expect: [{ at: `${RS}/4XX`, action: "remove", type: nonBreaking, mentions: ["4XX"] }],
    // ISSUE-134 (fixed); POLICY-13 decided (b)
  },
  {
    kind: "doc",
    id: "OAS-RS-010",
    title: "status range spelled in another case (5XX -> 5xx, 2XX -> 2xx)",
    before: "responses 5XX / 2XX",
    after: "responses 5xx / 2xx",
    rationale:
      "OAS 3.x: range codes are case-insensitive in practice (the spec uses uppercase X); the response is the same",
    annotation: "an annotation rename naming the response, or no diff",
    sources: [
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.5" },
      { tool: "bench", ref: "oas-petstore P7 (5xx usage site)" },
    ],
    docs: {
      "5XX": [get({ 200: r(), "5XX": r({ description: "e" }) }), get({ 200: r(), "5xx": r({ description: "e" }) })],
      "2XX": [get({ "2XX": r() }), get({ "2xx": r() })],
    },
    expect: {
      "5XX": [{ at: [RS, `${RS}/*`], action: "rename", type: annotation, optional: true, mentions: ["5XX"] }],
      "2XX": [{ at: [RS, `${RS}/*`], action: "rename", type: annotation, optional: true, mentions: ["2XX"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-RS-011",
    title: "explicit success code replaced by its range (200 -> 2XX)",
    before: "responses 200",
    after: "responses 2XX",
    rationale:
      "POLICY-14 (b): the range and the code are one response; the server may now answer 201..299, which clients written for 200 do not expect",
    annotation: "names the response 200 and the range 2XX",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_status_updated.go (range codes are not numeric: not reported)",
        verdict: "not reported",
      },
      { tool: "libopenapi", ref: "what-changed/model/responses.go codes removed + added" },
    ],
    docs: [get({ 200: r() }), get({ "2XX": r() })],
    expect: [{ at: [RS, `${RS}/*`], action: "rename", type: breaking, mentions: ["200", "2XX"] }],
    // ISSUE-134 (fixed); POLICY-14 decided (b)
  },
  {
    kind: "doc",
    id: "OAS-RS-012",
    title: "status range replaced by an explicit code (2XX -> 200)",
    before: "responses 2XX",
    after: "responses 200",
    rationale: "POLICY-14 (b): the range and the code are one response; the server narrows what it may answer",
    annotation: "names the range 2XX and the response 200",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/responses.go codes removed + added" }],
    docs: [get({ "2XX": r() }), get({ 200: r() })],
    expect: [{ at: [RS, `${RS}/*`], action: "rename", type: nonBreaking, mentions: ["2XX", "200"] }],
    // ISSUE-134 (fixed); POLICY-14 decided (b)
  },
  {
    kind: "doc",
    id: "OAS-RS-013",
    title: "response description added, changed, removed",
    before: "response description absent / `a`",
    after: "`a` / `b` / absent",
    rationale: "documentation only (OAS requires `description`, adding a missing one fixes the document)",
    annotation: "names the description and the status code",
    sources: [
      {
        tool: "compat-suites",
        ref: "openapi/response add-response-description, update-response-description, remove-response-description",
      },
      {
        tool: "fork",
        ref: "test/openapi.add-required-fields.test.ts adding description to response at operation is not breaking",
      },
      { tool: "fork", ref: "test/human-readable/openapi/response-object.test.ts Description Inline" },
    ],
    docs: {
      add: [get({ 200: {} }), get({ 200: r() })],
      change: [get({ 200: r({ description: "a" }) }), get({ 200: r({ description: "b" }) })],
      remove: [get({ 200: r() }), get({ 200: {} })],
    },
    expect: [{ at: `${RS}/200/description`, type: annotation, mentions: ["description", "200"] }],
  },
  {
    kind: "doc",
    id: "OAS-RS-014",
    title: "3.2 response summary added and changed",
    before: "response without summary / summary `a`",
    after: "summary `a` / `b`",
    rationale: "OAS 3.2 Response `summary` is documentation only",
    annotation: "names the summary and the status code",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Response.Summary" },
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §7.2 Responses summary" },
    ],
    docs: {
      add: [get({ 200: r() }, {}, "3.2.0"), get({ 200: r({ summary: "a" }) }, {}, "3.2.0")],
      change: [get({ 200: r({ summary: "a" }) }, {}, "3.2.0"), get({ 200: r({ summary: "b" }) }, {}, "3.2.0")],
    },
    expect: [{ at: `${RS}/200/summary`, type: annotation, mentions: ["summary", "200"] }],
  },
  {
    kind: "doc",
    id: "OAS-RS-015",
    title: "responses reordered",
    before: "responses 200, 404",
    after: "responses 404, 200",
    rationale: "the Responses Object is a map: order is not significant",
    annotation: "no diff",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/responses_test.go TestCompareResponses_V3_Identical (reordered)" },
    ],
    docs: [get({ 200: r(), 404: r({ description: "nf" }) }), get({ 404: r({ description: "nf" }), 200: r() })],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-RS-016",
    title: "response body added to a response without content",
    before: "200 without content",
    after: "200 with application/json content",
    rationale: "clients that ignored the empty body keep working",
    annotation: "names the added media type and the status code",
    sources: [
      { tool: "openapi-diff", ref: "core/src/test/.../ContentDiffTest.java / content_type_response_add_1.yaml" },
      { tool: "oasdiff", ref: "checker/check_response_mediatype_updated_test.go TestAddNewMediaType", verdict: "INFO" },
    ],
    covers: ["oasdiff:response-media-type-added"],
    docs: [get({ 200: r() }), get({ 200: r({ content: json() }) })],
    expect: [
      {
        at: [`${RS}/200/content`, `${RS}/200/content/application~1json`],
        action: "add",
        type: nonBreaking,
        mentions: ["application/json", "200"],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-RS-017",
    title: "response body removed",
    before: "200 with application/json content",
    after: "200 without content",
    rationale: "clients that parse the documented body get none",
    annotation: "names the removed media type and the status code",
    sources: [
      { tool: "openapi-diff", ref: "core/src/test/resources/bc_response_content_decreased.yaml" },
      { tool: "oasdiff", ref: "checker/check_response_mediatype_updated_test.go TestDeleteNewMediaType" },
    ],
    covers: ["oasdiff:response-media-type-removed"],
    docs: [get({ 200: r({ content: json() }) }), get({ 200: r() })],
    expect: [
      {
        at: [`${RS}/200/content`, `${RS}/200/content/application~1json`],
        action: "remove",
        type: breaking,
        mentions: ["application/json", "200"],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-RS-018",
    title: "schema change inside a status range response (5XX)",
    before: "5XX body { errorCode: integer }",
    after: "{ errorCode: string }",
    rationale: "clients parsing errorCode as a number fail; range responses are compared like explicit codes",
    annotation: "names the property and the 5XX response",
    sources: [
      { tool: "bench", ref: "oas-petstore P7" },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.3, C5.4" },
    ],
    docs: {
      "5XX": [
        get({
          200: r(),
          "5XX": r({ content: json({ type: "object", properties: { errorCode: { type: "integer" } } }) }),
        }),
        get({ 200: r(), "5XX": r({ content: json({ type: "object", properties: { errorCode: str } }) }) }),
      ],
      default: [
        get({
          200: r(),
          default: r({ content: json({ type: "object", properties: { errorCode: { type: "integer" } } }) }),
        }),
        get({ 200: r(), default: r({ content: json({ type: "object", properties: { errorCode: str } }) }) }),
      ],
    },
    expect: {
      "5XX": [
        {
          at: `${RS}/5XX/content/application~1json/schema/properties/errorCode/type`,
          type: breaking,
          mentions: ["errorCode", "5XX", "application/json"],
        },
      ],
      default: [
        {
          at: `${RS}/default/content/application~1json/schema/properties/errorCode/type`,
          type: breaking,
          mentions: ["errorCode", "default", "application/json"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-RS-019",
    title: "$ref response (components.responses) schema changed",
    before: "404 $ref NotFound with string body",
    after: "NotFound body integer",
    rationale: "clients parsing the 404 body as a string fail; reported at the usage and in the component",
    annotation: "names the type change with the 404 usage site and the NotFound component",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/response-object.test.ts Content Example Ref" },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.12, C5.13" },
    ],
    docs: [withR(r({ content: json() })), withR(r({ content: json({ type: "integer" }) }))],
    expect: [
      {
        at: `${RS}/404/content/application~1json/schema/type`,
        type: breaking,
        mentions: ["type", "404", "application/json"],
      },
      {
        at: "components/responses/NotFound/content/application~1json/schema/type",
        type: breaking,
        mentions: ["type", "NotFound", "application/json"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-RS-020",
    title: "$ref response description changed in the component",
    before: "404 $ref NotFound (description `a`)",
    after: "NotFound description `b`",
    rationale:
      "documentation only; POLICY-57 (decided after P3): an annotation-only change inside a component is reported at its declaration only, not at the 404 usage",
    annotation: "names the description and the NotFound component",
    sources: [{ tool: "fork", ref: "test/human-readable/openapi/response-object.test.ts Description Ref" }],
    docs: [withR(r({ description: "a" })), withR(r({ description: "b" }))],
    // ISSUE-190 (fixed): the usage-site diff (`responses/404/description`) is no longer reported
    expect: [
      { at: "components/responses/NotFound/description", type: annotation, mentions: ["description", "NotFound"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-RS-021",
    title: "$ref response shared by two operations: body schema changed",
    before: "GET /a 200 and GET /b 404 reference R with a string body",
    after: "R body integer",
    rationale: "clients of either usage parsing a string fail; each usage must be described with its own status code",
    annotation: "names the type change with the status code of each usage site and the component R",
    sources: [
      { tool: "asd", ref: "docs/ANALYSIS.md ISSUE-09 (cached $ref results re-annotated with the first usage)" },
      { tool: "fork", ref: "test/human-readable/openapi/response-object.test.ts Content Example Ref" },
    ],
    docs: [
      oas(
        {
          "/a": { get: { responses: { 200: { $ref: "#/components/responses/R" } } } },
          "/b": { get: { responses: { 200: r(), 404: { $ref: "#/components/responses/R" } } } },
        },
        { components: { responses: { R: r({ content: json() }) } } },
      ),
      oas(
        {
          "/a": { get: { responses: { 200: { $ref: "#/components/responses/R" } } } },
          "/b": { get: { responses: { 200: r(), 404: { $ref: "#/components/responses/R" } } } },
        },
        { components: { responses: { R: r({ content: json({ type: "integer" }) }) } } },
      ),
    ],
    expect: [
      {
        at: "paths/~1a/get/responses/200/content/application~1json/schema/type",
        type: breaking,
        mentions: ["type", "200"],
      },
      {
        at: "paths/~1b/get/responses/404/content/application~1json/schema/type",
        type: breaking,
        mentions: ["type", "404"],
      },
      {
        at: "components/responses/R/content/application~1json/schema/type",
        type: breaking,
        mentions: ["type", "Response R"],
      },
    ],
    // ISSUE-55 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-RS-022",
    title: "inline response moved to components.responses unchanged",
    before: "inline 404; components.responses.NotFound already identical",
    after: "404 $ref NotFound",
    rationale: "the resolved response is identical",
    annotation: "no diff",
    sources: [{ tool: "fork", ref: "test/human-readable/openapi/response-object.test.ts Response Ref vs Inline" }],
    docs: [withR(r({ description: "nf" }), r({ description: "nf" })), withR(r({ description: "nf" }))],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-RS-023",
    title: "3.1 reference object: overriding description added next to a response $ref",
    before: "404: { $ref: NotFound }",
    after: "404: { $ref: NotFound, description: `o` }",
    rationale: "OAS 3.1 Reference Object `description` overrides the referenced one; documentation only",
    annotation: "names the description of the 404 response",
    sources: [
      { tool: "compat-suites", ref: "openapi/response add-overriden-description" },
      { tool: "fork", ref: "test/compatibility-suites/openapi/response.test.ts runRefObjectDescriptionTests" },
    ],
    docs: [withR(r({ description: "c" })), withR(r({ description: "c" }), { ...rRef, description: "o" })],
    expect: [
      { at: `${RS}/404/description`, action: ["add", "replace"], type: annotation, mentions: ["description", "404"] },
    ],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RS-024",
    title: "3.1 reference object: overriding description removed from a response $ref",
    before: "404: { $ref: NotFound, description: `o` }",
    after: "404: { $ref: NotFound }",
    rationale: "the referenced description is shown again; documentation only",
    annotation: "names the description of the 404 response",
    sources: [{ tool: "compat-suites", ref: "openapi/response remove-overriden-description" }],
    docs: [withR(r({ description: "c" }), { ...rRef, description: "o" }), withR(r({ description: "c" }))],
    expect: [
      {
        at: `${RS}/404/description`,
        action: ["remove", "replace"],
        type: annotation,
        mentions: ["description", "404"],
      },
    ],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RS-025",
    title: "3.1 reference object: overriding description of a response $ref changed",
    before: "404: { $ref: NotFound, description: `o1` }",
    after: "description `o2`",
    rationale: "documentation only",
    annotation: "names the description of the 404 response",
    sources: [{ tool: "compat-suites", ref: "openapi/response change-overriden-description" }],
    docs: [
      withR(r({ description: "c" }), { ...rRef, description: "o1" }),
      withR(r({ description: "c" }), { ...rRef, description: "o2" }),
    ],
    expect: [{ at: `${RS}/404/description`, action: "replace", type: annotation, mentions: ["description", "404"] }],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RS-026",
    title: "3.1 reference object: referenced response description changed while the usage overrides it",
    before: "404: { $ref: NotFound, description: `o` }, NotFound.description `c1`",
    after: "NotFound.description `c2`",
    rationale: "the 404 usage still shows `o`: only the component changed",
    annotation: "names the description of component NotFound; nothing at the usage site",
    sources: [{ tool: "compat-suites", ref: "openapi/response change-referenced-description-when-overridden-exists" }],
    docs: [
      withR(r({ description: "c1" }), { ...rRef, description: "o" }),
      withR(r({ description: "c2" }), { ...rRef, description: "o" }),
    ],
    expect: [
      {
        at: "components/responses/NotFound/description",
        action: "replace",
        type: annotation,
        mentions: ["description", "NotFound"],
      },
    ],
    // ISSUE-60 (fixed for this variant): the referenced description change is an annotation inside a component, reported
    // at the declaration only (POLICY-57, ISSUE-190), so the overridden usage site no longer repeats it
  },
  {
    kind: "doc",
    id: "OAS-RS-027",
    title: "unreferenced components.responses entry changed",
    before: "components.responses.Unused with string body (no usage)",
    after: "body integer",
    rationale: "no operation uses the response: decision §11.4 classifies unreferenced components as unclassified",
    annotation: "names the component and the type change",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §11.4" }],
    docs: [
      get({ 200: r() }, { components: { responses: { Unused: r({ content: json() }) } } }),
      get({ 200: r() }, { components: { responses: { Unused: r({ content: json({ type: "integer" }) }) } } }),
    ],
    expect: [
      {
        at: "components/responses/Unused/content/application~1json/schema/type",
        type: unclassified,
        mentions: ["type", "Unused"],
      },
    ],
    // ISSUE-69 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RS-028",
    title: "responses added to an operation that had none",
    before: "GET /a without `responses`",
    after: "GET /a with responses 200",
    rationale: "fixing a missing required field documents what the operation returned anyway",
    annotation: "names the added 200 response",
    sources: [
      { tool: "fork", ref: "test/openapi.add-required-fields.test.ts adding responses to operation is not breaking" },
    ],
    docs: [oas({ "/a": { get: {} } }), get({ 200: r() })],
    expect: [{ at: [RS, `${RS}/200`], action: "add", type: nonBreaking, mentions: ["200"] }],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-RS-029",
    title: "response vendor extension added",
    before: "200 without extensions",
    after: "200 with `x-cacheable: true`",
    rationale: "vendor extensions carry no wire contract",
    annotation: "names the extension key and the status code",
    sources: [
      { tool: "compat-suites", ref: "openapi/response add-custom-property" },
      {
        tool: "fork",
        ref: "test/compatibility-suites/openapi/response.test.ts Add custom property (skipped, expects non-breaking)",
        verdict: "non-breaking",
      },
    ],
    docs: [get({ 200: r() }), get({ 200: r({ "x-cacheable": true }) })],
    expect: [{ at: `${RS}/200/x-cacheable`, action: "add", type: annotation, mentions: ["x-cacheable", "200"] }],
    // POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "OAS-RS-030",
    title: "writeOnly property no longer required in a response (3.0)",
    before: "response schema with writeOnly `password` in `required`",
    after: "`password` not required",
    rationale:
      "OAS 3.0 Schema Object: a writeOnly property listed in `required` is required in requests only, so responses never carried it",
    annotation: "names the required status of `password` in the 200 response",
    sources: [
      {
        tool: "openapi-diff",
        ref: "core/src/test/resources/bc_response_writeonly_required_decreased.yaml",
        verdict: "compatible",
      },
      { tool: "oasdiff", ref: "checker/check_response_optional_property_write_only_read_only_test.go" },
    ],
    docs: [
      get(
        {
          200: r({
            content: json({
              type: "object",
              properties: { password: { type: "string", writeOnly: true } },
              required: ["password"],
            }),
          }),
        },
        {},
        "3.0.3",
      ),
      get(
        {
          200: r({ content: json({ type: "object", properties: { password: { type: "string", writeOnly: true } } }) }),
        },
        {},
        "3.0.3",
      ),
    ],
    expect: [
      {
        at: `${RS}/200/content/application~1json/schema/required/**`,
        action: "remove",
        type: nonBreaking,
        mentions: ["required", "`password`", "200"],
      },
    ],
    // ISSUE-72 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RS-031",
    title: "writeOnly property added to a response (3.0)",
    before: "response schema without `password`",
    after: "writeOnly `password` property",
    rationale: "a writeOnly property is never sent in a response: clients see no change",
    annotation: "names the property `password` in the 200 response",
    sources: [
      {
        tool: "openapi-diff",
        ref: "core/src/test/resources/bc_response_writeonly_increased.yaml",
        verdict: "compatible",
      },
    ],
    docs: [
      get({ 200: r({ content: json({ type: "object", properties: {} }) }) }, {}, "3.0.3"),
      get(
        {
          200: r({ content: json({ type: "object", properties: { password: { type: "string", writeOnly: true } } }) }),
        },
        {},
        "3.0.3",
      ),
    ],
    expect: [
      {
        at: `${RS}/200/content/application~1json/schema/properties/password`,
        action: "add",
        type: nonBreaking,
        mentions: ["`password`", "200"],
      },
    ],
  },
]

runCases("openapi", "responses", cases, import.meta.filename)
