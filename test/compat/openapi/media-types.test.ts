import { annotation, breaking, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const item = { type: "object", properties: { id: { type: "integer" } } }
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
/** POST /a with the given request body content */
const req = (content: Record<string, unknown>, openapi?: string, extra: Record<string, unknown> = {}) =>
  oas({ "/a": { post: { requestBody: { content }, responses: ok } } }, extra, openapi)
/** GET /a whose 200 response has the given content */
const res = (content: Record<string, unknown>, openapi?: string, extra: Record<string, unknown> = {}) =>
  oas({ "/a": { get: { responses: { 200: { description: "ok", content } } } } }, extra, openapi)

const RQ = "paths/~1a/post/requestBody/content"
const RS = "paths/~1a/get/responses/200/content"
const reqBody = /request body/i
const mt = (name: string) => name.replace(/\//g, "~1")

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-MT-001",
    title: "media type added to the request body",
    before: "request body application/json",
    after: "application/json and application/xml",
    rationale: "callers keep sending json, which is still accepted",
    annotation: "names the added media type and the request body",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_body_mediatype_updated_test.go TestRequestBodyMediaTypeAdded",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "core/src/test/resources/content_type_request_add_1.yaml" },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.4" },
    ],
    covers: ["oasdiff:request-body-media-type-added"],
    docs: [
      req({ "application/json": { schema: str } }),
      req({ "application/json": { schema: str }, "application/xml": { schema: str } }),
    ],
    expect: [
      {
        at: `${RQ}/${mt("application/xml")}`,
        action: "add",
        type: nonBreaking,
        mentions: ["application/xml", reqBody],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-002",
    title: "media type removed from the request body",
    before: "application/json and application/xml",
    after: "application/json",
    rationale: "callers sending xml are rejected",
    annotation: "names the removed media type and the request body",
    sources: [
      { tool: "oasdiff", ref: "checker/check_request_body_mediatype_updated_test.go TestRequestBodyMediaTypeRemoved" },
      { tool: "openapi-diff", ref: "core/src/test/resources/bc_request_content_decreased.yaml" },
      { tool: "fork", ref: "test/human-readable/openapi/request-body-object.test.ts Content Media Type Inline" },
    ],
    covers: ["oasdiff:request-body-media-type-removed"],
    docs: [
      req({ "application/json": { schema: str }, "application/xml": { schema: str } }),
      req({ "application/json": { schema: str } }),
    ],
    expect: [
      {
        at: `${RQ}/${mt("application/xml")}`,
        action: "remove",
        type: breaking,
        mentions: ["application/xml", reqBody],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-003",
    title: "media type added to a response",
    before: "200 application/json",
    after: "200 application/json and text/plain",
    rationale: "clients negotiating json still get json",
    annotation: "names the added media type and the status code",
    sources: [
      { tool: "oasdiff", ref: "checker/check_response_mediatype_updated_test.go TestAddNewMediaType", verdict: "INFO" },
      { tool: "openapi-diff", ref: "core/src/test/resources/content_type_response_add_1.yaml" },
      { tool: "asd", ref: "test/openapi/responses-edge-cases.test.ts C5.11" },
    ],
    covers: ["oasdiff:response-media-type-added"],
    docs: [
      res({ "application/json": { schema: str } }),
      res({ "application/json": { schema: str }, "text/plain": { schema: str } }),
    ],
    expect: [{ at: `${RS}/${mt("text/plain")}`, action: "add", type: nonBreaking, mentions: ["text/plain", "200"] }],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-004",
    title: "media type removed from a response",
    before: "200 application/json and application/xml",
    after: "200 application/json",
    rationale: "clients negotiating xml get 406 or an unexpected format",
    annotation: "names the removed media type and the status code",
    sources: [
      { tool: "oasdiff", ref: "checker/check_response_mediatype_updated_test.go TestDeleteNewMediaType" },
      { tool: "bench", ref: "oas-petstore P20" },
      { tool: "openapi-diff", ref: "core/src/test/resources/bc_response_content_decreased.yaml" },
      { tool: "fork", ref: "test/human-readable/openapi/response-object.test.ts Content Media Type Inline" },
    ],
    covers: ["oasdiff:response-media-type-removed"],
    docs: [
      res({ "application/json": { schema: str }, "application/xml": { schema: str } }),
      res({ "application/json": { schema: str } }),
    ],
    expect: [
      { at: `${RS}/${mt("application/xml")}`, action: "remove", type: breaking, mentions: ["application/xml", "200"] },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-005",
    title: "schema added to an existing request media type",
    before: "request application/json without schema",
    after: "with a string schema",
    rationale: "the body was unconstrained; payloads that are not strings are now rejected",
    annotation: "names the added schema, the media type and the request body",
    sources: [
      {
        tool: "atlassian-openapi-diff",
        ref: "docs/OPENAPI3.md Media Type Object schema (supported for application/json)",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_media_type_schema_existence_test.go TestMediaTypeSchemaExistence (request schema added)",
      },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go MediaType.Schema added" },
    ],
    covers: ["oasdiff:request-body-media-type-schema-added"],
    docs: [req({ "application/json": {} }), req({ "application/json": { schema: str } })],
    expect: [
      {
        at: `${RQ}/${mt("application/json")}/schema`,
        action: "add",
        type: breaking,
        mentions: ["schema", "application/json", reqBody],
      },
    ],
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-006",
    title: "schema removed from a request media type",
    before: "request application/json with a string schema",
    after: "without schema",
    rationale: "the body becomes unconstrained: every payload accepted before is still accepted",
    annotation: "names the removed schema, the media type and the request body",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_media_type_schema_existence_test.go TestMediaTypeSchemaExistence (request schema removed)",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go MediaType.Schema removed", verdict: "breaking" },
      { tool: "fork", ref: "src/openapi/openapi3.rules.ts content /schema allBreaking", verdict: "breaking" },
    ],
    covers: ["oasdiff:request-body-media-type-schema-removed"],
    docs: [req({ "application/json": { schema: str } }), req({ "application/json": {} })],
    expect: [
      {
        at: `${RQ}/${mt("application/json")}/schema`,
        action: "remove",
        type: nonBreaking,
        mentions: ["schema", "application/json", reqBody],
      },
    ],
    // ISSUE-62 (fixed): classified by direction; the "annotation (schema)" description is ISSUE-85
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-007",
    title: "schema added to an existing response media type",
    before: "200 application/json without schema",
    after: "with a string schema",
    rationale: "the response was unconstrained; describing it more precisely cannot break clients",
    annotation: "names the added schema, the media type and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_media_type_schema_existence_test.go TestMediaTypeSchemaExistence (response schema added)",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "core/src/test/.../ResponseAddedContentSchemaTest.java" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go MediaType.Schema added", verdict: "breaking" },
    ],
    covers: ["oasdiff:response-body-media-type-schema-added"],
    docs: [res({ "application/json": {} }), res({ "application/json": { schema: str } })],
    expect: [
      {
        at: `${RS}/${mt("application/json")}/schema`,
        action: "add",
        type: nonBreaking,
        mentions: ["schema", "application/json", "200"],
      },
    ],
    // ISSUE-62 (fixed): classified by direction; the "annotation (schema)" description is ISSUE-85
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-008",
    title: "schema removed from a response media type",
    before: "200 application/json with a string schema",
    after: "without schema",
    rationale: "clients lose the guarantee on the body shape",
    annotation: "names the removed schema, the media type and the status code",
    sources: [
      { tool: "oasdiff", ref: "checker/check_media_type_schema_existence_test.go TestResponseSchemaRemoved_IsAnError" },
    ],
    covers: ["oasdiff:response-body-media-type-schema-removed"],
    docs: [res({ "application/json": { schema: str } }), res({ "application/json": {} })],
    expect: [
      {
        at: `${RS}/${mt("application/json")}/schema`,
        action: "remove",
        type: breaking,
        mentions: ["schema", "application/json", "200"],
      },
    ],
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-009",
    title: "3.2 itemSchema added to a streamed request media type",
    before: "request application/jsonl without itemSchema",
    after: "with itemSchema",
    rationale: "each streamed item is now constrained: producers sending other items are rejected",
    annotation: "names the item schema, the media type and the request body",
    sources: [
      { tool: "oasdiff", ref: "checker/item_schema_test.go TestItemSchema_ExistenceIsClassifiedByContravariance" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go MediaType.ItemSchema added" },
    ],
    covers: ["oasdiff:request-body-media-type-item-schema-added"],
    docs: [req({ "application/jsonl": {} }, "3.2.0"), req({ "application/jsonl": { itemSchema: item } }, "3.2.0")],
    expect: [
      {
        at: `${RQ}/${mt("application/jsonl")}/itemSchema`,
        action: "add",
        type: breaking,
        mentions: [/item ?schema/i, "application/jsonl", reqBody],
      },
    ],
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-010",
    title: "3.2 itemSchema removed from a streamed request media type",
    before: "request application/jsonl with itemSchema",
    after: "without itemSchema",
    rationale: "streamed items become unconstrained: every stream accepted before is still accepted",
    annotation: "names the item schema, the media type and the request body",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/item_schema_test.go TestItemSchema_ExistenceIsClassifiedByContravariance",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:request-body-media-type-item-schema-removed"],
    docs: [req({ "application/jsonl": { itemSchema: item } }, "3.2.0"), req({ "application/jsonl": {} }, "3.2.0")],
    expect: [
      {
        at: `${RQ}/${mt("application/jsonl")}/itemSchema`,
        action: "remove",
        type: nonBreaking,
        mentions: [/item ?schema/i, "application/jsonl", reqBody],
      },
    ],
    // ISSUE-62 (fixed): classified by direction; the "annotation (schema)" description is ISSUE-85
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-011",
    title: "3.2 itemSchema added to a streamed response media type",
    before: "200 text/event-stream without itemSchema",
    after: "with itemSchema",
    rationale: "describing the streamed events more precisely cannot break consumers",
    annotation: "names the item schema, the media type and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/item_schema_test.go TestItemSchema_ExistenceIsClassifiedByContravariance",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:response-body-media-type-item-schema-added"],
    docs: [res({ "text/event-stream": {} }, "3.2.0"), res({ "text/event-stream": { itemSchema: item } }, "3.2.0")],
    expect: [
      {
        at: `${RS}/${mt("text/event-stream")}/itemSchema`,
        action: "add",
        type: nonBreaking,
        mentions: [/item ?schema/i, "text/event-stream", "200"],
      },
    ],
    // ISSUE-62 (fixed): classified by direction; the "annotation (schema)" description is ISSUE-85
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-012",
    title: "3.2 itemSchema removed from a streamed response media type",
    before: "200 text/event-stream with itemSchema (and optionally a body schema)",
    after: "without itemSchema",
    rationale: "consumers lose the guarantee on each event; a remaining whole-body schema says nothing about one item",
    annotation: "names the item schema, the media type and the status code",
    sources: [
      { tool: "oasdiff", ref: "checker/item_schema_test.go TestItemSchema_ExistenceIsClassifiedByContravariance" },
      {
        tool: "oasdiff",
        ref: "checker/item_schema_test.go TestItemSchema_RemovedWhileBodySchemaRemainsIsStillAnError",
      },
    ],
    covers: [
      "oasdiff:response-body-media-type-item-schema-removed",
      "oasdiff:response-body-media-type-item-schema-removed-untyped",
    ],
    docs: {
      untyped: [res({ "text/event-stream": { itemSchema: item } }, "3.2.0"), res({ "text/event-stream": {} }, "3.2.0")],
      "with-schema": [
        res({ "text/event-stream": { schema: str, itemSchema: item } }, "3.2.0"),
        res({ "text/event-stream": { schema: str } }, "3.2.0"),
      ],
    },
    expect: [
      {
        at: `${RS}/${mt("text/event-stream")}/itemSchema`,
        action: "remove",
        type: breaking,
        mentions: [/item ?schema/i, "text/event-stream", "200"],
      },
    ],
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-013",
    title: "3.2 streamed request item gains a required property",
    before: "request application/jsonl itemSchema { id }",
    after: "itemSchema requires `id`",
    rationale: "producers whose items lack `id` are rejected",
    annotation: "names the required status of `id`, the media type and the request body",
    sources: [
      { tool: "oasdiff", ref: "checker/item_schema_test.go TestItemSchema_RequestPropertyBecameRequiredIsBreaking" },
    ],
    docs: [
      req({ "application/jsonl": { itemSchema: item } }, "3.2.0"),
      req({ "application/jsonl": { itemSchema: { ...item, required: ["id"] } } }, "3.2.0"),
    ],
    expect: [
      {
        at: `${RQ}/${mt("application/jsonl")}/itemSchema/required/**`,
        action: "add",
        type: breaking,
        mentions: ["required", "`id`", "application/jsonl", reqBody],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-MT-014",
    title: "3.2 streamed response item property type changed",
    before: "200 text/event-stream itemSchema { id: integer }",
    after: "{ id: string }",
    rationale: "consumers parsing `id` as a number fail on every event",
    annotation: "names the type change of `id`, the media type and the status code",
    sources: [{ tool: "oasdiff", ref: "checker/item_schema_test.go TestItemSchema_ResponsePropertyChangeIsReported" }],
    docs: [
      res({ "text/event-stream": { itemSchema: item } }, "3.2.0"),
      res({ "text/event-stream": { itemSchema: { type: "object", properties: { id: str } } } }, "3.2.0"),
    ],
    expect: [
      {
        at: `${RS}/${mt("text/event-stream")}/itemSchema/properties/id/type`,
        type: breaking,
        mentions: ["type", "`id`", "text/event-stream", "200"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-MT-015",
    title: "request media type narrowed from a wildcard (*/* -> application/json)",
    before: "request body */*",
    after: "request body application/json",
    rationale: "callers sending any other media type are now rejected",
    annotation: "names the old and the new media type of the request body",
    sources: [
      {
        tool: "fork",
        ref: "test/openapi.contentMediaTypeMapping.test.ts should map wildcard to specific when exactly one unmapped item on each side",
      },
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §4.6 (one wildcard pair is mapped)" },
    ],
    docs: {
      "*/*": [req({ "*/*": { schema: str } }), req({ "application/json": { schema: str } })],
      "application/*": [req({ "application/*": { schema: str } }), req({ "application/json": { schema: str } })],
    },
    expect: [{ at: [RQ, `${RQ}/*`], type: breaking, mentions: ["application/json", reqBody] }],
    // ISSUE-85 (fixed) (P8a); ISSUE-63 (fixed): detection and classification pass; the description remains (ISSUE-85)
  },
  {
    kind: "doc",
    id: "OAS-MT-016",
    title: "request media type widened to a wildcard (application/json -> */*)",
    before: "request body application/json",
    after: "request body */* / application/*",
    rationale: "json payloads are still accepted",
    annotation: "names the old and the new media type of the request body",
    sources: [{ tool: "fork", ref: "test/openapi.contentMediaTypeMapping.test.ts should map partial wildcards" }],
    docs: {
      "*/*": [req({ "application/json": { schema: str } }), req({ "*/*": { schema: str } })],
      "application/*": [req({ "application/json": { schema: str } }), req({ "application/*": { schema: str } })],
    },
    expect: {
      "*/*": [{ at: [RQ, `${RQ}/*`], type: nonBreaking, mentions: ["application/json", "*/*", reqBody] }],
      "application/*": [
        { at: [RQ, `${RQ}/*`], type: nonBreaking, mentions: ["application/json", "application/*", reqBody] },
      ],
    },
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-017",
    title: "response media type generalized to a wildcard (application/json -> */*)",
    before: "200 application/json",
    after: "200 */* / application/*",
    rationale: "the server may now answer with media types clients cannot parse",
    annotation: "names the old and the new media type and the status code",
    sources: [
      { tool: "oasdiff", ref: "checker/check_response_mediatype_name_updated_test.go TestGeneralizeMediaTypeName" },
      { tool: "fork", ref: "test/openapi.contentMediaTypeMapping.test.ts should map wildcard to specific" },
    ],
    covers: ["oasdiff:response-media-type-name-generalized"],
    docs: {
      "*/*": [res({ "application/json": { schema: str } }), res({ "*/*": { schema: str } })],
      "application/*": [res({ "application/json": { schema: str } }), res({ "application/*": { schema: str } })],
    },
    expect: [{ at: [RS, `${RS}/*`], type: breaking, mentions: ["application/json", "200"] }],
    // ISSUE-63 (fixed): detection and classification pass; the description remains (ISSUE-85)
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-018",
    title: "response media type specialized from a wildcard (*/* -> application/json)",
    before: "200 */* / application/*",
    after: "200 application/json",
    rationale: "the server answers with a subset of what it promised",
    annotation: "names the old and the new media type and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_mediatype_name_updated_test.go TestSpecializeMediaTypeName",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:response-media-type-name-specialized"],
    docs: {
      "*/*": [res({ "*/*": { schema: str } }), res({ "application/json": { schema: str } })],
      "application/*": [res({ "application/*": { schema: str } }), res({ "application/json": { schema: str } })],
    },
    expect: {
      "*/*": [{ at: [RS, `${RS}/*`], type: nonBreaking, mentions: ["*/*", "application/json", "200"] }],
      "application/*": [
        { at: [RS, `${RS}/*`], type: nonBreaking, mentions: ["application/*", "application/json", "200"] },
      ],
    },
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-019",
    title: "response media type changed to a structured-syntax variant (application/json -> application/problem+json)",
    before: "200 application/json",
    after: "200 application/problem+json (optionally with a parameter)",
    rationale:
      "the mapping resolver (decision §4.6) matches exact, base type and one wildcard pair only: a different subtype is a different media type, so clients negotiating application/json lose it",
    annotation: "names the removed and the added media type and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_mediatype_name_updated_test.go TestSpecializeMediaTypeName",
        verdict: "INFO (specialized)",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_response_mediatype_name_updated_test.go TestChangeMediaTypeParameters",
        verdict: "WARN (name changed)",
      },
      {
        tool: "fork",
        ref: "test/openapi.contentMediaTypeMapping.test.ts should mark completely different types as added/removed",
      },
    ],
    covers: ["oasdiff:response-media-type-name-changed"],
    docs: {
      plain: [res({ "application/json": { schema: str } }), res({ "application/problem+json": { schema: str } })],
      param: [res({ "application/json": { schema: str } }), res({ "application/problem+json;q=1": { schema: str } })],
    },
    expect: {
      plain: [
        {
          at: `${RS}/${mt("application/json")}`,
          action: "remove",
          type: breaking,
          mentions: ["application/json", "200"],
        },
        {
          at: `${RS}/${mt("application/problem+json")}`,
          action: "add",
          type: nonBreaking,
          mentions: ["application/problem+json", "200"],
        },
      ],
      param: [
        {
          at: `${RS}/${mt("application/json")}`,
          action: "remove",
          type: breaking,
          mentions: ["application/json", "200"],
        },
        {
          at: `${RS}/${mt("application/problem+json;q=1")}`,
          action: "add",
          type: nonBreaking,
          mentions: ["application/problem+json", "200"],
        },
      ],
    },
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-020",
    title: "response media type changed from a structured-syntax variant to the plain type",
    before: "200 application/problem+json",
    after: "200 application/json",
    rationale:
      "a different subtype is a different media type (decision §4.6): clients negotiating problem+json lose it",
    annotation: "names the removed and the added media type and the status code",
    sources: [
      { tool: "oasdiff", ref: "checker/check_response_mediatype_name_updated_test.go TestGeneralizeMediaTypeName" },
    ],
    docs: [res({ "application/problem+json": { schema: str } }), res({ "application/json": { schema: str } })],
    expect: [
      {
        at: `${RS}/${mt("application/problem+json")}`,
        action: "remove",
        type: breaking,
        mentions: ["application/problem+json", "200"],
      },
      {
        at: `${RS}/${mt("application/json")}`,
        action: "add",
        type: nonBreaking,
        mentions: ["application/json", "200"],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-021",
    title: "response media type parameter added (charset)",
    before: "200 application/json",
    after: "200 application/json;charset=utf-8",
    rationale: "POLICY-15 (a): a parameter-only change is the same media type; the server narrows what it may send",
    annotation: "names the media type, the parameter and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_mediatype_name_updated_test.go TestResponseMediaTypeParameterAdded",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:response-media-type-parameter-added"],
    docs: [res({ "application/json": { schema: str } }), res({ "application/json;charset=utf-8": { schema: str } })],
    expect: [{ at: [RS, `${RS}/*`], type: nonBreaking, mentions: ["charset", "200"] }],
    // ISSUE-85 (fixed) (P8a); POLICY-15 decided (a)
  },
  {
    kind: "doc",
    id: "OAS-MT-022",
    title: "response media type parameter removed (charset)",
    before: "200 application/json;charset=utf-8",
    after: "200 application/json",
    rationale:
      "POLICY-15 (a): a parameter-only change is the same media type (oasdiff ERR: clients relying on utf-8 may receive another charset)",
    annotation: "names the media type, the parameter and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_mediatype_name_updated_test.go TestResponseMediaTypeParameterRemoved",
        verdict: "ERR",
      },
    ],
    covers: ["oasdiff:response-media-type-parameter-removed"],
    docs: [res({ "application/json;charset=utf-8": { schema: str } }), res({ "application/json": { schema: str } })],
    expect: [{ at: [RS, `${RS}/*`], type: nonBreaking, mentions: ["charset", "200"] }],
    // POLICY-15 decided (a)
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-023",
    title: "response media type parameter value changed (charset utf-8 -> utf-16)",
    before: "200 application/json;charset=utf-8",
    after: "200 application/json;charset=utf-16",
    rationale:
      "POLICY-15 (a): a parameter-only change is the same media type (oasdiff ERR: clients decoding utf-8 misread the body)",
    annotation: "names the media type, the parameter values and the status code",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_response_mediatype_name_updated_test.go TestResponseMediaTypeParameterChanged",
        verdict: "ERR",
      },
    ],
    covers: ["oasdiff:response-media-type-parameter-changed"],
    docs: [
      res({ "application/json;charset=utf-8": { schema: str } }),
      res({ "application/json;charset=utf-16": { schema: str } }),
    ],
    expect: [{ at: [RS, `${RS}/*`], type: nonBreaking, mentions: ["utf-8", "utf-16", "200"] }],
    // POLICY-15 decided (a)
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-024",
    title: "request media type parameter added and removed (charset)",
    before: "request application/json / application/json;charset=utf-8",
    after: "application/json;charset=utf-8 / application/json",
    rationale:
      "POLICY-15 (a): a parameter-only change is the same media type (oasdiff mirrors the response rules: requiring a charset is breaking)",
    annotation: "names the media type, the parameter and the request body",
    sources: [
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.5 (parameters ignored when matching)" },
      {
        tool: "fork",
        ref: "test/openapi.contentMediaTypeMapping.test.ts should match media types ignoring parameters",
      },
    ],
    docs: {
      added: [
        req({ "application/json": { schema: str } }),
        req({ "application/json; charset=utf-8": { schema: str } }),
      ],
      removed: [
        req({ "application/json; charset=utf-8": { schema: str } }),
        req({ "application/json": { schema: str } }),
      ],
    },
    expect: {
      added: [{ at: [RQ, `${RQ}/*`], type: nonBreaking, mentions: ["charset", reqBody] }],
      removed: [{ at: [RQ, `${RQ}/*`], type: nonBreaking, mentions: ["charset", reqBody] }],
    },
    // POLICY-15 decided (a); ISSUE-85 fixed for "added" (P8a)
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-MT-025",
    title: "media type name changes case only",
    before: "application/json",
    after: "Application/JSON",
    rationale: "media type names are case-insensitive (RFC 6838 §4.2): the contract is unchanged",
    annotation: "an annotation rename naming the media type, or no diff",
    sources: [
      { tool: "asd", ref: "src/openapi/openapi3.classify.ts caseOnlyRename (applied to response codes and headers)" },
    ],
    docs: {
      request: [req({ "application/json": { schema: str } }), req({ "Application/JSON": { schema: str } })],
      response: [res({ "application/json": { schema: str } }), res({ "Application/JSON": { schema: str } })],
    },
    expect: {
      request: [
        { at: [RQ, `${RQ}/*`], action: "rename", type: annotation, optional: true, mentions: ["application/json"] },
      ],
      response: [
        { at: [RS, `${RS}/*`], action: "rename", type: annotation, optional: true, mentions: ["application/json"] },
      ],
    },
    // ISSUE-63 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-MT-026",
    title: "media types reordered",
    before: "json, xml, */*",
    after: "*/*, xml, json",
    rationale: "content is a map: order is not significant, and exact matches win over the wildcard",
    annotation: "no diff",
    sources: [
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.6" },
      {
        tool: "fork",
        ref: "test/openapi.contentMediaTypeMapping.test.ts should prefer exact matches over wildcard compatibility",
      },
    ],
    docs: {
      request: [
        req({ "application/json": { schema: str }, "application/xml": { schema: str }, "*/*": { schema: str } }),
        req({ "*/*": { schema: str }, "application/xml": { schema: str }, "application/json": { schema: str } }),
      ],
      response: [
        res({ "application/json": { schema: str }, "application/xml": { schema: str }, "*/*": { schema: str } }),
        res({ "*/*": { schema: str }, "application/xml": { schema: str }, "application/json": { schema: str } }),
      ],
    },
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-MT-027",
    title: "schema of one media type changed next to a wildcard media type",
    before: "200 application/json string, */* string",
    after: "200 */* string, application/json integer",
    rationale: "the exact media type is mapped to itself, so only the json schema change is reported",
    annotation: "names the type change, application/json and the status code",
    sources: [
      {
        tool: "fork",
        ref: "test/openapi.contentMediaTypeMapping.test.ts should prioritize exact matches over potential wildcard matches",
      },
    ],
    docs: [
      res({ "application/json": { schema: str }, "*/*": { schema: str } }),
      res({ "*/*": { schema: str }, "application/json": { schema: { type: "integer" } } }),
    ],
    expect: [
      {
        at: `${RS}/${mt("application/json")}/schema/type`,
        type: breaking,
        mentions: ["type", "application/json", "200"],
      },
    ],
  },
  {
    kind: "schema",
    id: "OAS-MT-028",
    title: "body contentMediaType changed",
    before: "string body with contentMediaType image/png",
    after: "contentMediaType image/jpeg",
    rationale: "request: callers sending png are rejected; response: clients decoding png misread jpeg",
    annotation: "names contentMediaType (placement adds the body location)",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_property_content_updated.go request-body-content-media-type-changed",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_response_property_content_updated.go response-body-content-media-type-changed",
      },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Schema.ContentMediaType modified" },
    ],
    covers: ["oasdiff:request-body-content-media-type-changed", "oasdiff:response-body-content-media-type-changed"],
    schema: [
      { type: "string", contentMediaType: "image/png" },
      { type: "string", contentMediaType: "image/jpeg" },
    ],
    expect: [{ at: "contentMediaType", action: "replace", type: breaking, mentions: ["contentMediaType"] }],
  },
  {
    kind: "schema",
    id: "OAS-MT-029",
    title: "body contentEncoding changed",
    before: "string body with contentEncoding base64",
    after: "contentEncoding base64url",
    rationale: "request: callers encoding base64 are rejected; response: clients decoding base64 misread base64url",
    annotation: "names contentEncoding (placement adds the body location)",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_property_content_updated.go request-body-content-encoding-changed",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_response_property_content_updated.go response-body-content-encoding-changed",
      },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Schema.ContentEncoding modified" },
    ],
    covers: ["oasdiff:request-body-content-encoding-changed", "oasdiff:response-body-content-encoding-changed"],
    schema: [
      { type: "string", contentEncoding: "base64" },
      { type: "string", contentEncoding: "base64url" },
    ],
    expect: [{ at: "contentEncoding", action: "replace", type: breaking, mentions: ["contentEncoding"] }],
  },
  {
    kind: "doc",
    id: "OAS-MT-030",
    title: "3.2 components.mediaTypes entry used by a response changed",
    before: "200 application/json $ref components.mediaTypes.Plain (string)",
    after: "Plain schema integer",
    rationale: "clients parsing a string fail; reported at the usage and in the component",
    annotation: "names the type change at the usage (media type, status) and in component Plain",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §7.2 components.mediaTypes" }],
    docs: [
      res({ "application/json": { $ref: "#/components/mediaTypes/Plain" } }, "3.2.0", {
        components: { mediaTypes: { Plain: { schema: str } } },
      }),
      res({ "application/json": { $ref: "#/components/mediaTypes/Plain" } }, "3.2.0", {
        components: { mediaTypes: { Plain: { schema: { type: "integer" } } } },
      }),
    ],
    expect: [
      {
        at: `${RS}/${mt("application/json")}/schema/type`,
        type: breaking,
        mentions: ["type", "application/json", "200"],
      },
      { at: "components/mediaTypes/Plain/schema/type", type: breaking, mentions: ["type", "Plain"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-MT-031",
    title: "media type vendor extension added",
    before: "request application/json",
    after: "application/json with `x-max-size: 10`",
    rationale: "vendor extensions carry no wire contract",
    annotation: "names the extension key and the media type",
    sources: [{ tool: "compat-suites", ref: "openapi/response add-custom-property (media type analogue)" }],
    docs: [
      req({ "application/json": { schema: str } }),
      req({ "application/json": { schema: str, "x-max-size": 10 } }),
    ],
    expect: [
      {
        at: `${RQ}/${mt("application/json")}/x-max-size`,
        action: "add",
        type: annotation,
        mentions: ["x-max-size", "application/json"],
      },
    ],
    // POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "OAS-MT-032",
    title: "request form encoding switched (multipart/form-data -> application/x-www-form-urlencoded)",
    before: "request multipart/form-data",
    after: "request application/x-www-form-urlencoded",
    rationale: "callers posting multipart are rejected",
    annotation: "names the removed and the added media type of the request body",
    sources: [{ tool: "openapi-diff", ref: "core/src/test/resources/content_diff_1.yaml / content_diff_2.yaml" }],
    covers: ["oasdiff:request-body-media-type-removed", "oasdiff:request-body-media-type-added"],
    docs: [
      req({ "multipart/form-data": { schema: { type: "object", properties: { a: str } } } }),
      req({ "application/x-www-form-urlencoded": { schema: { type: "object", properties: { a: str } } } }),
    ],
    expect: [
      {
        at: `${RQ}/${mt("multipart/form-data")}`,
        action: "remove",
        type: breaking,
        mentions: ["multipart/form-data", reqBody],
      },
      {
        at: `${RQ}/${mt("application/x-www-form-urlencoded")}`,
        action: "add",
        type: nonBreaking,
        mentions: ["application/x-www-form-urlencoded", reqBody],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
]

runCases("openapi", "media-types", cases, import.meta.filename)
