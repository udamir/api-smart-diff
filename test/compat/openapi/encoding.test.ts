import { breaking, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const form = {
  type: "object",
  properties: {
    profileImage: { type: "string", contentMediaType: "image/png" },
    meta: { type: "object" },
    tags: { type: "array", items: str },
  },
}
const oas = (paths: Record<string, unknown>, openapi = "3.1.0") => ({ openapi, info, paths })
/** POST /a with a multipart/form-data (or other) request body carrying the given encoding map and extra media type fields */
const req = (
  encoding?: Record<string, unknown>,
  media: Record<string, unknown> = {},
  openapi?: string,
  mediaType = "multipart/form-data",
) =>
  oas(
    {
      "/a": {
        post: {
          requestBody: { content: { [mediaType]: { schema: form, ...(encoding ? { encoding } : {}), ...media } } },
          responses: ok,
        },
      },
    },
    openapi,
  )
/** GET /a whose 200 multipart/form-data response carries the given encoding map */
const res = (encoding?: Record<string, unknown>) =>
  oas({
    "/a": {
      get: {
        responses: {
          200: {
            description: "ok",
            content: { "multipart/form-data": { schema: form, ...(encoding ? { encoding } : {}) } },
          },
        },
      },
    },
  })

const MP = "paths/~1a/post/requestBody/content/multipart~1form-data"
const E = `${MP}/encoding`
const where = ["multipart/form-data", /request ?body/i]

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-ENC-001",
    title: "encoding entry added for a form part",
    before: "encoding { profileImage }",
    after: "encoding { profileImage, meta: contentType application/xml }",
    rationale:
      "the `meta` part was serialized with its default (application/json for an object); callers sending the default are now rejected",
    annotation: "names the encoding of `meta` and the request body media type",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/encoding-object.test.ts Encoding" },
      { tool: "libopenapi", ref: "what-changed/model/encoding_test.go" },
    ],
    docs: [
      req({ profileImage: { contentType: "image/png" } }),
      req({ profileImage: { contentType: "image/png" }, meta: { contentType: "application/xml" } }),
    ],
    expect: [{ at: `${E}/meta`, action: "add", type: breaking, mentions: ["meta", ...where] }],
  },
  {
    kind: "doc",
    id: "OAS-ENC-002",
    title: "encoding map added to a media type",
    before: "multipart/form-data without encoding",
    after: "encoding { profileImage: contentType image/png }",
    rationale: "the part content type changes from the default to image/png: callers sending the default are rejected",
    annotation: "names the encoding of `profileImage` and the request body media type",
    sources: [{ tool: "fork", ref: "test/human-readable/openapi/encoding-object.test.ts Encoding" }],
    docs: [req(), req({ profileImage: { contentType: "image/png" } })],
    expect: [{ at: [E, `${E}/profileImage`], action: "add", type: breaking, mentions: ["profileImage", ...where] }],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-ENC-003",
    title: "encoding entry removed for a form part",
    before: "encoding { profileImage, meta: contentType application/json }",
    after: "encoding { profileImage }",
    rationale: "the removed entry equalled the default serialization of an object part (application/json)",
    annotation: "names the encoding of `meta` and the request body media type",
    sources: [
      { tool: "fork", ref: "src/openapi/openapi3.rules.ts encodingRules [breaking, nonBreaking, breaking]" },
      { tool: "libopenapi", ref: "what-changed/model/encoding_test.go", verdict: "breaking" },
    ],
    docs: [
      req({ profileImage: { contentType: "image/png" }, meta: { contentType: "application/json" } }),
      req({ profileImage: { contentType: "image/png" } }),
    ],
    expect: [{ at: `${E}/meta`, action: "remove", type: nonBreaking, mentions: ["meta", ...where] }],
  },
  {
    kind: "doc",
    id: "OAS-ENC-004",
    title: "encoding contentType changed",
    before: "profileImage contentType image/png",
    after: "contentType image/jpeg",
    rationale: "callers sending png parts are rejected (request); clients decoding png misread jpeg parts (response)",
    annotation: "names contentType of `profileImage` and the body media type",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/encoding-object.test.ts Content type" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Encoding.ContentType modified" },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.8" },
    ],
    docs: {
      request: [
        req({ profileImage: { contentType: "image/png" } }),
        req({ profileImage: { contentType: "image/jpeg" } }),
      ],
      response: [
        res({ profileImage: { contentType: "image/png" } }),
        res({ profileImage: { contentType: "image/jpeg" } }),
      ],
    },
    expect: {
      request: [
        {
          at: `${E}/profileImage/contentType`,
          action: "replace",
          type: breaking,
          mentions: ["contentType", "profileImage", ...where],
        },
      ],
      response: [
        {
          at: "paths/~1a/get/responses/200/content/multipart~1form-data/encoding/profileImage/contentType",
          action: "replace",
          type: breaking,
          mentions: ["contentType", "profileImage", "multipart/form-data", "200"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-ENC-005",
    title: "explicit encoding contentType added to an entry",
    before: "encoding { meta: { style: form } }",
    after: "meta contentType application/xml",
    rationale:
      "POLICY-17 (b): an explicit encoding field added is non-breaking (ASD, fork; libopenapi breaking: callers sending the default content type may be rejected)",
    annotation: "names contentType of `meta` and the request body media type",
    sources: [
      {
        tool: "libopenapi",
        ref: "what-changed/model/breaking_rules.go Encoding.ContentType added",
        verdict: "breaking",
      },
      {
        tool: "fork",
        ref: "src/openapi/openapi3.rules.ts encoding /contentType [nonBreaking, breaking, breaking]",
      },
    ],
    docs: [req({ meta: { style: "form" } }), req({ meta: { style: "form", contentType: "application/xml" } })],
    expect: [
      { at: `${E}/meta/contentType`, action: "add", type: nonBreaking, mentions: ["contentType", "meta", ...where] },
    ],
    // POLICY-17 decided (b)
  },
  {
    kind: "doc",
    id: "OAS-ENC-006",
    title: "encoding contentType removed from an entry",
    before: "profileImage contentType image/png (and style form)",
    after: "profileImage style form only",
    rationale: "the part reverts to its default content type; callers sending png are rejected",
    annotation: "names contentType of `profileImage` and the request body media type",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Encoding.ContentType removed" },
      { tool: "fork", ref: "src/openapi/openapi3.rules.ts encoding /contentType removed breaking" },
    ],
    docs: [
      req({ profileImage: { contentType: "image/png", style: "form" } }),
      req({ profileImage: { style: "form" } }),
    ],
    expect: [
      {
        at: `${E}/profileImage/contentType`,
        action: "remove",
        type: breaking,
        mentions: ["contentType", "profileImage", ...where],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-ENC-007",
    title: "encoding style changed (urlencoded form)",
    before: "application/x-www-form-urlencoded, meta style form",
    after: "meta style deepObject",
    rationale: "the serialization of `meta` changes: callers using the old style are misread",
    annotation: "names style of `meta` and the request body media type",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/encoding-object.test.ts Style" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Encoding.Style modified" },
    ],
    docs: [
      req({ meta: { style: "form" } }, {}, undefined, "application/x-www-form-urlencoded"),
      req({ meta: { style: "deepObject" } }, {}, undefined, "application/x-www-form-urlencoded"),
    ],
    expect: [
      {
        at: "paths/~1a/post/requestBody/content/application~1x-www-form-urlencoded/encoding/meta/style",
        action: "replace",
        type: breaking,
        mentions: ["style", "meta", "application/x-www-form-urlencoded", /request ?body/i],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-ENC-008",
    title: "explicit non-default encoding style added",
    before: "urlencoded form, meta { contentType application/json }",
    after: "meta style deepObject",
    rationale:
      "POLICY-17 (b): an explicit encoding field added is non-breaking (ASD, fork; libopenapi breaking: the serialization changes from the default `form` to `deepObject`)",
    annotation: "names style of `meta` and the request body media type",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Encoding.Style added", verdict: "breaking" },
      {
        tool: "fork",
        ref: "src/openapi/openapi3.rules.ts encoding /style [nonBreaking, breaking, breaking]",
      },
    ],
    docs: [
      req({ meta: { contentType: "application/json" } }, {}, undefined, "application/x-www-form-urlencoded"),
      req(
        { meta: { contentType: "application/json", style: "deepObject" } },
        {},
        undefined,
        "application/x-www-form-urlencoded",
      ),
    ],
    expect: [
      {
        at: "paths/~1a/post/requestBody/content/application~1x-www-form-urlencoded/encoding/meta/style",
        action: "add",
        type: nonBreaking,
        mentions: ["style", "meta", "application/x-www-form-urlencoded"],
      },
    ],
    // POLICY-17 decided (b)
  },
  {
    kind: "doc",
    id: "OAS-ENC-009",
    title: "encoding explode changed",
    before: "tags explode true",
    after: "tags explode false",
    rationale: "array values are serialized differently: callers using the old form are misread",
    annotation: "names explode of `tags` and the request body media type",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/encoding-object.test.ts Explode" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Encoding.Explode modified" },
    ],
    docs: [
      req({ tags: { style: "form", explode: true } }, {}, undefined, "application/x-www-form-urlencoded"),
      req({ tags: { style: "form", explode: false } }, {}, undefined, "application/x-www-form-urlencoded"),
    ],
    expect: [
      {
        at: "paths/~1a/post/requestBody/content/application~1x-www-form-urlencoded/encoding/tags/explode",
        action: "replace",
        type: breaking,
        mentions: ["explode", "tags", "application/x-www-form-urlencoded"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-ENC-010",
    title: "encoding allowReserved enabled in a request",
    before: "meta allowReserved false",
    after: "meta allowReserved true",
    rationale:
      "the server now also accepts unencoded reserved characters; percent-encoded values sent before are still valid (same rule ASD applies to parameters)",
    annotation: "names allowReserved of `meta` and the request body media type",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/encoding-object.test.ts AllowReserved" },
      {
        tool: "libopenapi",
        ref: "what-changed/model/breaking_rules.go Encoding.AllowReserved (never breaking)",
        verdict: "non-breaking",
      },
      { tool: "asd", ref: "src/openapi/openapi3.rules.ts parameter /allowReserved breakingIfAfterTrueInverse" },
    ],
    docs: [
      req({ meta: { allowReserved: false, style: "form" } }, {}, undefined, "application/x-www-form-urlencoded"),
      req({ meta: { allowReserved: true, style: "form" } }, {}, undefined, "application/x-www-form-urlencoded"),
    ],
    expect: [
      {
        at: "paths/~1a/post/requestBody/content/application~1x-www-form-urlencoded/encoding/meta/allowReserved",
        action: "replace",
        type: nonBreaking,
        mentions: ["allowReserved", "meta", "application/x-www-form-urlencoded"],
      },
    ],
    // ISSUE-75 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-ENC-011",
    title: "encoding allowReserved disabled in a request",
    before: "meta allowReserved true",
    after: "meta allowReserved false",
    rationale: "callers sending unencoded reserved characters are rejected or misread",
    annotation: "names allowReserved of `meta` and the request body media type",
    sources: [{ tool: "fork", ref: "test/human-readable/openapi/encoding-object.test.ts AllowReserved" }],
    docs: [
      req({ meta: { allowReserved: true, style: "form" } }, {}, undefined, "application/x-www-form-urlencoded"),
      req({ meta: { allowReserved: false, style: "form" } }, {}, undefined, "application/x-www-form-urlencoded"),
    ],
    expect: [
      {
        at: "paths/~1a/post/requestBody/content/application~1x-www-form-urlencoded/encoding/meta/allowReserved",
        action: "replace",
        type: breaking,
        mentions: ["allowReserved", "meta", "application/x-www-form-urlencoded"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-ENC-012",
    title: "explicit default serialization values added to or removed from an encoding entry",
    before: "meta { contentType application/json }",
    after: "meta with allowReserved false / style form / explode true (request and response)",
    rationale: "each value is the Encoding Object default: the serialization is unchanged",
    annotation: "no diff",
    sources: [
      {
        tool: "compat-suites",
        ref: "openapi/response add-allowReserved-attribute-with-default-value-for-response-parameter-encoding",
      },
      {
        tool: "compat-suites",
        ref: "openapi/response remove-allowReserved-attribute-with-default-value-from-response-parameter-encoding",
      },
      { tool: "fork", ref: "test/compatibility-suites/openapi/response.test.ts Add/remove default values (expect [])" },
    ],
    docs: {
      "allowReserved-add": [
        req({ meta: { contentType: "application/json" } }),
        req({ meta: { contentType: "application/json", allowReserved: false } }),
      ],
      "allowReserved-remove-response": [
        res({ meta: { contentType: "application/json", allowReserved: false } }),
        res({ meta: { contentType: "application/json" } }),
      ],
      "style-remove": [
        req({ meta: { contentType: "application/json", style: "form" } }),
        req({ meta: { contentType: "application/json" } }),
      ],
      "explode-add": [
        req({ meta: { contentType: "application/json", style: "form" } }),
        req({ meta: { contentType: "application/json", style: "form", explode: true } }),
      ],
    },
    expect: [],
    // ISSUE-70 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-ENC-013",
    title: "optional part header added to an encoding entry",
    before: "profileImage encoding without headers / with header X-Id",
    after: "header X-Rate-Limit-Limit added",
    rationale: "callers that do not send an optional part header keep working",
    annotation: "names the header, the part `profileImage` and the request body media type",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/encoding-object.test.ts Headers" },
      { tool: "libopenapi", ref: "what-changed/model/encoding_test.go headers" },
    ],
    docs: {
      first: [
        req({ profileImage: { contentType: "image/png" } }),
        req({ profileImage: { contentType: "image/png", headers: { "X-Rate-Limit-Limit": { schema: str } } } }),
      ],
      second: [
        req({ profileImage: { contentType: "image/png", headers: { "X-Id": { schema: str } } } }),
        req({
          profileImage: {
            contentType: "image/png",
            headers: { "X-Id": { schema: str }, "X-Rate-Limit-Limit": { schema: str } },
          },
        }),
      ],
    },
    expect: [
      {
        at: [`${E}/profileImage/headers`, `${E}/profileImage/headers/X-Rate-Limit-Limit`],
        action: "add",
        type: nonBreaking,
        mentions: ["X-Rate-Limit-Limit", "profileImage", "multipart/form-data"],
      },
    ],
    // ISSUE-85 / ISSUE-86 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-ENC-014",
    title: "part header in a request encoding became required",
    before: "profileImage header X-Id optional",
    after: "X-Id required",
    rationale: "callers that do not send the part header are rejected",
    annotation: "names the required status of X-Id, the part and the request body media type",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Header.Required" }],
    docs: [
      req({ profileImage: { headers: { "X-Id": { schema: str } } } }),
      req({ profileImage: { headers: { "X-Id": { schema: str, required: true } } } }),
    ],
    expect: [
      {
        at: `${E}/profileImage/headers/X-Id/required`,
        action: "add",
        type: breaking,
        mentions: ["required", "X-Id", "profileImage", "multipart/form-data"],
      },
    ],
    // ISSUE-86 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-ENC-015",
    title: "part header of a request encoding removed",
    before: "profileImage header X-Id",
    after: "header removed",
    rationale: "the server stops reading a header callers may keep sending: nothing fails (request semantics)",
    annotation: "names the header, the part and the request body media type",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/encoding_test.go headers removed", verdict: "breaking" }],
    docs: [
      req({
        profileImage: { contentType: "image/png", headers: { "X-Id": { schema: str }, "X-Trace": { schema: str } } },
      }),
      req({ profileImage: { contentType: "image/png", headers: { "X-Trace": { schema: str } } } }),
    ],
    expect: [
      {
        at: `${E}/profileImage/headers/X-Id`,
        action: "remove",
        type: nonBreaking,
        mentions: ["X-Id", "profileImage", "multipart/form-data"],
      },
    ],
    // ISSUE-61 (fixed): classified by direction; the part / media type in the description is ISSUE-86
    // ISSUE-86 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-ENC-016",
    title: "part header schema type changed in a request encoding",
    before: "profileImage header X-Rate-Limit-Limit string",
    after: "integer",
    rationale: "callers sending non-numeric values are rejected",
    annotation: "names the type change, the header, the part and the request body media type",
    sources: [
      {
        tool: "fork",
        ref: "test/human-readable/openapi/encoding-object.test.ts Headers ([Changed] type for schema in header ... of encoding 'profileImage' of request body)",
      },
    ],
    docs: [
      req({ profileImage: { headers: { "X-Rate-Limit-Limit": { schema: str } } } }),
      req({ profileImage: { headers: { "X-Rate-Limit-Limit": { schema: { type: "integer" } } } } }),
    ],
    expect: [
      {
        at: `${E}/profileImage/headers/X-Rate-Limit-Limit/schema/type`,
        type: breaking,
        mentions: ["type", "X-Rate-Limit-Limit", "profileImage", "multipart/form-data"],
      },
    ],
    // ISSUE-86 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-ENC-017",
    title: "3.2 itemEncoding contentType changed on a streamed request",
    before: "multipart/mixed itemEncoding contentType image/png",
    after: "itemEncoding contentType image/jpeg",
    rationale: "callers streaming png items are rejected",
    annotation: "names contentType of the item encoding and the request body media type",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go MediaType.ItemEncoding" },
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §7.2 itemEncoding" },
    ],
    docs: [
      req(undefined, { itemEncoding: { contentType: "image/png" } }, "3.2.0", "multipart/mixed"),
      req(undefined, { itemEncoding: { contentType: "image/jpeg" } }, "3.2.0", "multipart/mixed"),
    ],
    expect: [
      {
        at: "paths/~1a/post/requestBody/content/multipart~1mixed/itemEncoding/contentType",
        action: "replace",
        type: breaking,
        mentions: ["contentType", "itemEncoding", "multipart/mixed"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-ENC-018",
    title: "3.2 prefixEncoding entry added on a request",
    before: "multipart/mixed prefixEncoding [image/png]",
    after: "prefixEncoding [image/png, text/plain]",
    rationale: "the second part must now be text/plain: callers sending its default are rejected",
    annotation: "names the prefix encoding item and the request body media type",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §7.2 prefixEncoding (mapped by index)" }],
    docs: [
      req(undefined, { prefixEncoding: [{ contentType: "image/png" }] }, "3.2.0", "multipart/mixed"),
      req(
        undefined,
        { prefixEncoding: [{ contentType: "image/png" }, { contentType: "text/plain" }] },
        "3.2.0",
        "multipart/mixed",
      ),
    ],
    expect: [
      {
        at: "paths/~1a/post/requestBody/content/multipart~1mixed/prefixEncoding/1",
        action: "add",
        type: breaking,
        mentions: ["prefixEncoding", "multipart/mixed"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-ENC-019",
    title: "3.2 nested encoding contentType changed",
    before: "meta encoding { x: contentType a/b }",
    after: "contentType a/c",
    rationale: "the nested part serialization changes",
    annotation: "names the nested contentType and the request body media type",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §7.2 nested encoding.encoding" }],
    docs: [
      req({ meta: { encoding: { x: { contentType: "text/csv" } } } }, {}, "3.2.0"),
      req({ meta: { encoding: { x: { contentType: "text/tab-separated-values" } } } }, {}, "3.2.0"),
    ],
    expect: [
      {
        at: `${E}/meta/encoding/x/contentType`,
        action: "replace",
        type: breaking,
        mentions: ["contentType", "x", ...where],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-ENC-020",
    title: "encoding entry keyed by a renamed form part",
    before: "encoding { profileImage }",
    after: "encoding { avatar } (same content type)",
    rationale:
      "the encoding of the old part is gone (default serialization again) and the new part has an explicit one",
    annotation: "names the removed and the added encoding entry",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/media_type.go encoding map compared by key" }],
    docs: [req({ profileImage: { contentType: "image/png" } }), req({ avatar: { contentType: "image/png" } })],
    expect: [
      { at: `${E}/profileImage`, action: "remove", type: nonBreaking, mentions: ["profileImage", ...where] },
      { at: `${E}/avatar`, action: "add", type: breaking, mentions: ["avatar", ...where] },
    ],
  },
]

runCases("openapi", "encoding", cases, import.meta.filename)
