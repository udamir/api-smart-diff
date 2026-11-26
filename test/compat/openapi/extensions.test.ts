import { annotation } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// Vendor extensions (`x-*`) at every level of an OpenAPI document. DESIGN_PROPOSALS §12.2: extensions keep the
// classification of the rule tree they fall under (annotation on operations, request bodies, responses, headers,
// parameters; unclassified at the document root and in JSON Schema). POLICY-06 decided (d): an extension no prefix rule
// configures is an annotation naming the key everywhere (ISSUE-131 (fixed) since P1 added the `x-` prefix rule, `"/x-*"`).

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const doc = (
  paths: Record<string, unknown> = { "/pets": { get: { responses: ok } } },
  extra: Record<string, unknown> = {},
  openapi = "3.1.0",
) => ({
  openapi,
  info,
  paths,
  ...extra,
})
const getPets = (operation: Record<string, unknown>) => doc({ "/pets": { get: { responses: ok, ...operation } } })

// POLICY-06 decided (d): prefix rules (`"/x-*"`) classify extensions; an x-* key no prefix rule configures is an annotation
// with a description naming the key (decision §11.15); custom rules may override the class per prefix

/** add / change / remove variants of one extension key on a node built by `place`. */
const variants = (place: (value?: unknown) => unknown, value: unknown = true, changed: unknown = false) => ({
  add: [place(), place(value)] as [unknown, unknown],
  change: [place(value), place(changed)] as [unknown, unknown],
  remove: [place(value), place()] as [unknown, unknown],
})
const opt = (key: string, value: unknown) => (value === undefined ? {} : { [key]: value })

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-EXT-001",
    title: "root-level extension added, changed and removed",
    before: "document without / with x-api-id",
    after: "with x-api-id / changed / without",
    rationale:
      "extensions are tool metadata; ASD leaves root extensions unclassified (§12.2, C1.5), Atlassian reports them as unclassified; proposed option a",
    annotation: "names the extension key",
    sources: [
      {
        tool: "atlassian-openapi-diff",
        ref: "find-diffs-in-x-properties.js unclassified.add / unclassified.remove",
        verdict: "unclassified",
      },
      {
        tool: "oasdiff",
        ref: "diff/diff_test.go TestAddedExtension / TestDeletedExtension / TestModifiedExtension",
        verdict: "no checker rule",
      },
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts root", verdict: "unclassified" },
      { tool: "libopenapi", ref: "extensions.go CompareExtensions", verdict: "removed breaking" },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.5" },
    ],
    docs: variants((v) => doc(undefined, opt("x-api-id", v)), "pets-v1", "pets-v2"),
    expect: [{ at: "x-api-id", type: annotation, mentions: ["x-api-id"] }],
    // ISSUE-131 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-002",
    title: "extension in info, contact and license",
    before: "info without x-logo",
    after: "info x-logo added (or changed in contact / license)",
    rationale: "metadata only (the fork expects annotation)",
    annotation: "names the extension key",
    sources: [
      {
        tool: "fork",
        ref: "openapi.specificationExtensions.test.ts info / info.contact / info.license",
        verdict: "annotation",
      },
    ],
    docs: {
      info: [doc(), { ...doc(), info: { ...info, "x-logo": { url: "https://example.com/logo.png" } } }],
      contact: [
        { ...doc(), info: { ...info, contact: { name: "a" } } },
        { ...doc(), info: { ...info, contact: { name: "a", "x-team": "pets" } } },
      ],
      license: [
        { ...doc(), info: { ...info, license: { name: "MIT", "x-spdx": "MIT" } } },
        { ...doc(), info: { ...info, license: { name: "MIT", "x-spdx": "MIT-0" } } },
      ],
    },
    expect: {
      info: [{ at: "info/x-logo", type: annotation, mentions: ["x-logo"] }],
      contact: [{ at: "info/contact/x-team", type: annotation, mentions: ["x-team"] }],
      license: [{ at: "info/license/x-spdx", type: annotation, mentions: ["x-spdx"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-EXT-003",
    title: "extension on a path item",
    before: "/pets without x-feature-flag",
    after: "x-feature-flag added / changed / removed",
    rationale:
      "an extension is not an operation; proposed classification annotation (the fork's suite expects non-breaking)",
    annotation: "names the extension key and the path",
    sources: [
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/add-custom-property-in-path",
        verdict: "non-breaking",
      },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/update-custom-property-value-in-path",
        verdict: "non-breaking",
      },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/remove-custom-property-in-path",
        verdict: "non-breaking",
      },
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts paths./somePath", verdict: "unclassified" },
    ],
    docs: variants(
      (v) => doc({ "/pets": { get: { responses: ok }, ...opt("x-feature-flag", v) } }),
      "v2-release",
      "v3-release",
    ),
    expect: [{ at: "paths/~1pets/x-feature-flag", type: annotation, mentions: ["x-feature-flag", "/pets"] }],
    // ISSUE-54 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-004",
    title: "extension on the Paths object",
    before: "paths without x-paths-meta",
    after: "paths.x-paths-meta added / changed / removed",
    rationale: "Paths object extensions are not paths; proposed classification annotation",
    annotation: "names the extension key",
    sources: [{ tool: "fork", ref: "openapi.specificationExtensions.test.ts paths", verdict: "unclassified" }],
    docs: variants((v) => doc({ "/pets": { get: { responses: ok } }, ...opt("x-paths-meta", v) }), "a", "b"),
    expect: [{ at: "paths/x-paths-meta", type: annotation, mentions: ["x-paths-meta"] }],
    // ISSUE-54 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-005",
    title: "extension on an operation",
    before: "GET /pets without x-internal",
    after: "x-internal added / changed / removed",
    rationale:
      "operation extensions are annotations (§12.2, test/openapi/paths-operations.test.ts C2.14); the fork's suite expects non-breaking",
    annotation: "names the extension key and the operation",
    sources: [
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/add-custom-property-in-operation",
        verdict: "non-breaking",
      },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/update-custom-property-value-in-operation",
        verdict: "non-breaking",
      },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/remove-custom-property-in-operation",
        verdict: "non-breaking",
      },
      {
        tool: "oasdiff",
        ref: "diff/diff_test.go TestDiff_Extensions (x-amazon-apigateway-integration)",
        verdict: "no checker rule",
      },
      {
        tool: "libopenapi",
        ref: "operation_test.go TestCompareOperations_V3_ModifyExtension",
        verdict: "non-breaking",
      },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.14" },
    ],
    docs: variants((v) => getPets(opt("x-internal", v)), true, false),
    expect: [{ at: "paths/~1pets/get/x-internal", type: annotation, mentions: ["x-internal", "GET /pets"] }],
    // ISSUE-81 (fixed for x-* extensions): the extension rule names the operation
  },
  {
    kind: "doc",
    id: "OAS-EXT-006",
    title: "nested value of an object extension on an operation changed",
    before: "GET /pets x-internal-use-reason { reason: a, release: 1 }",
    after: "reason b / release removed / release added / primitive replaced by an object",
    rationale: "the whole extension value is metadata, whatever its shape",
    annotation: "names the extension key and the operation",
    sources: [
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/update-objects-custom-property-value-in-operation",
        verdict: "non-breaking",
      },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/remove-objects-custom-property-in-operation",
        verdict: "non-breaking",
      },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/add-objects-custom-property-in-operation",
        verdict: "non-breaking",
      },
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts change from simple to complex" },
    ],
    docs: {
      nestedChange: [
        getPets({ "x-reason": { reason: "a", release: "1" } }),
        getPets({ "x-reason": { reason: "b", release: "1" } }),
      ],
      nestedRemove: [getPets({ "x-reason": { reason: "a", release: "1" } }), getPets({ "x-reason": { reason: "a" } })],
      nestedAdd: [getPets({ "x-reason": { reason: "a" } }), getPets({ "x-reason": { reason: "a", release: "1" } })],
      simpleToComplex: [getPets({ "x-reason": "a" }), getPets({ "x-reason": { reason: "a" } })],
    },
    expect: [
      {
        at: ["paths/~1pets/get/x-reason", "paths/~1pets/get/x-reason/**"],
        type: annotation,
        mentions: ["x-reason", "GET /pets"],
      },
    ],
    // ISSUE-73 (fixed), ISSUE-81 (fixed for x-* extensions): nested extension values are annotations naming the operation
  },
  {
    kind: "doc",
    id: "OAS-EXT-007",
    title: "extension on a parameter",
    before: "query parameter limit without x-custom-prop",
    after: "x-custom-prop added / changed / removed",
    rationale: "parameter extensions are annotations (§12.2); the fork's suite expects non-breaking",
    annotation: "names the extension key and the parameter",
    sources: [
      { tool: "compat-suites", ref: "operation-parameters/add-custom-property", verdict: "non-breaking" },
      { tool: "compat-suites", ref: "operation-parameters/update-custom-property-value", verdict: "non-breaking" },
      { tool: "compat-suites", ref: "operation-parameters/remove-custom-property", verdict: "non-breaking" },
      { tool: "libopenapi", ref: "parameter_test.go TestCompareParameters_V3_Extensions", verdict: "non-breaking" },
    ],
    docs: variants(
      (v) => getPets({ parameters: [{ name: "limit", in: "query", schema: str, ...opt("x-custom-prop", v) }] }),
      "a",
      "b",
    ),
    expect: [
      {
        at: "paths/~1pets/get/parameters/0/x-custom-prop",
        type: annotation,
        mentions: ["x-custom-prop", "query parameter `limit`"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-EXT-008",
    title: "extension on a request body, a media type and an example",
    before: "POST /pets request body without extensions",
    after: "x-body-meta on the request body / x-mt on application/json / x-example-meta on an example",
    rationale: "metadata only (§12.2: annotation under request bodies)",
    annotation: "names the extension key and the request body",
    sources: [
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts requestBody / media type / example object" },
    ],
    docs: (() => {
      const body = (
        b: Record<string, unknown> = {},
        mt: Record<string, unknown> = {},
        ex: Record<string, unknown> = {},
      ) =>
        doc({
          "/pets": {
            post: {
              requestBody: {
                ...b,
                content: { "application/json": { schema: str, examples: { a: { value: "x", ...ex } }, ...mt } },
              },
              responses: ok,
            },
          },
        })
      return {
        requestBody: [body(), body({ "x-body-meta": 1 })],
        mediaType: [body(), body({}, { "x-mt": 1 })],
        example: [body(), body({}, {}, { "x-example-meta": 1 })],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: {
      requestBody: [
        {
          at: "paths/~1pets/post/requestBody/x-body-meta",
          type: annotation,
          mentions: ["x-body-meta", "Request Body"],
        },
      ],
      mediaType: [
        {
          at: "paths/~1pets/post/requestBody/content/application~1json/x-mt",
          type: annotation,
          mentions: ["x-mt", "Request Body"],
        },
      ],
      example: [
        {
          at: "paths/~1pets/post/requestBody/content/application~1json/examples/a/x-example-meta",
          type: annotation,
          mentions: ["x-example-meta"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-EXT-009",
    title: "extension on a response and on a response header",
    before: "GET /pets 200 (header X-Rate) without extensions",
    after: "x-resp-meta on the response / x-hdr-meta on the header",
    rationale: "metadata only (§12.2: annotation under responses and headers)",
    annotation: "names the extension key and the response (header)",
    sources: [
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts responses / header objects" },
      {
        tool: "libopenapi",
        ref: "response_test.go (extension removal counted as breaking)",
        verdict: "removed breaking",
      },
    ],
    docs: (() => {
      const resp = (r: Record<string, unknown> = {}, h: Record<string, unknown> = {}) =>
        getPets({ responses: { 200: { description: "ok", headers: { "X-Rate": { schema: str, ...h } }, ...r } } })
      return {
        response: [resp(), resp({ "x-resp-meta": 1 })],
        header: [resp(), resp({}, { "x-hdr-meta": 1 })],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: {
      response: [
        { at: "paths/~1pets/get/responses/200/x-resp-meta", type: annotation, mentions: ["x-resp-meta", "200"] },
      ],
      header: [
        {
          at: "paths/~1pets/get/responses/200/headers/X-Rate/x-hdr-meta",
          type: annotation,
          mentions: ["x-hdr-meta", "X-Rate"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-EXT-010",
    title: "extension on the Responses object",
    before: "GET /pets responses { 200 }",
    after: "responses { 200, x-codegen-ignore }",
    rationale: "an extension of the Responses map is not a status code; proposed classification annotation",
    annotation: "names the extension key",
    sources: [
      { tool: "libopenapi", ref: "responses_test.go (extensions counted)", verdict: "removed breaking" },
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts responses", verdict: "unclassified" },
    ],
    docs: variants((v) => getPets({ responses: { ...ok, ...opt("x-codegen-ignore", v) } }), true, false),
    expect: [{ at: "paths/~1pets/get/responses/x-codegen-ignore", type: annotation, mentions: ["x-codegen-ignore"] }],
    // ISSUE-54 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-011",
    title: "extension on a server and a server variable",
    before: "servers [https://{env}.example.com] without extensions",
    after: "x-region on the server / x-hidden on the variable",
    rationale: "metadata only",
    annotation: "names the extension key and the server",
    sources: [
      {
        tool: "fork",
        ref: "openapi.specificationExtensions.test.ts servers[0] / variables.someVariable",
        verdict: "unclassified",
      },
    ],
    docs: (() => {
      const s = (o: Record<string, unknown> = {}, v: Record<string, unknown> = {}) =>
        doc(undefined, {
          servers: [{ url: "https://{env}.example.com", variables: { env: { default: "prod", ...v } }, ...o }],
        })
      return {
        server: [s(), s({ "x-region": "eu" })],
        variable: [s(), s({}, { "x-hidden": true })],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: {
      server: [{ at: "servers/0/x-region", type: annotation, mentions: ["x-region", "https://{env}.example.com"] }],
      variable: [{ at: "servers/0/variables/env/x-hidden", type: annotation, mentions: ["x-hidden", "env"] }],
    },
    // ISSUE-84 (fixed for x-* extensions) for the server extension: the extension rule names the server URL
  },
  {
    kind: "doc",
    id: "OAS-EXT-012",
    title: "extension on a root tag and on externalDocs",
    before: "tag pets / externalDocs without extensions",
    after: "tag pets x-display-name / externalDocs x-docs-kind",
    rationale: "metadata only (the fork expects annotation)",
    annotation: "names the extension key and the tag",
    sources: [
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts tags[0] / externalDocs", verdict: "annotation" },
    ],
    docs: {
      tag: [
        doc(undefined, { tags: [{ name: "pets" }] }),
        doc(undefined, { tags: [{ name: "pets", "x-display-name": "Pets" }] }),
      ],
      externalDocs: [
        doc(undefined, { externalDocs: { url: "https://docs.example.com" } }),
        doc(undefined, { externalDocs: { url: "https://docs.example.com", "x-docs-kind": "guide" } }),
      ],
    },
    expect: {
      tag: [{ at: "tags/0/x-display-name", type: annotation, mentions: ["x-display-name", "pets"] }],
      externalDocs: [{ at: "externalDocs/x-docs-kind", type: annotation, mentions: ["x-docs-kind"] }],
    },
    // ISSUE-84 (fixed for x-* extensions) for the tag extension: the extension rule names the tag
  },
  {
    kind: "doc",
    id: "OAS-EXT-013",
    title: "extension on the components object",
    before: "components without x-components-meta",
    after: "components.x-components-meta added",
    rationale: "metadata only; ASD leaves it unclassified (component kind tree); proposed option a",
    annotation: "names the extension key",
    sources: [{ tool: "fork", ref: "openapi.specificationExtensions.test.ts components", verdict: "unclassified" }],
    docs: variants((v) => doc(undefined, { components: { schemas: {}, ...opt("x-components-meta", v) } }), 1, 2),
    expect: [{ at: "components/x-components-meta", type: annotation, mentions: ["x-components-meta"] }],
    // ISSUE-131 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-014",
    title: "extension on a security scheme and an OAuth flow",
    before: "scheme api_key / oauth2 flow without extensions",
    after: "x-security-level on the scheme (added / changed / removed), x-flow-meta on the flow",
    rationale: "metadata only; the fork's suite expects non-breaking",
    annotation: "names the extension key and the scheme",
    sources: [
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/add-custom-property-in-security-schemes",
        verdict: "non-breaking",
      },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/update-custom-property-value-in-security-schemes",
        verdict: "non-breaking",
      },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/remove-custom-property-in-security-schemes",
        verdict: "non-breaking",
      },
      {
        tool: "fork",
        ref: "openapi.specificationExtensions.test.ts securitySchemes.oauth2 / flows",
        verdict: "unclassified",
      },
    ],
    docs: (() => {
      const s = (x: Record<string, unknown> = {}, f: Record<string, unknown> = {}) =>
        doc(undefined, {
          security: [{ api_key: [] }],
          components: {
            securitySchemes: {
              api_key: { type: "apiKey", name: "X-API-Key", in: "header", ...x },
              oauth: {
                type: "oauth2",
                flows: { clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {}, ...f } },
              },
            },
          },
        })
      return {
        add: [s(), s({ "x-security-level": "medium" })],
        change: [s({ "x-security-level": "medium" }), s({ "x-security-level": "high" })],
        remove: [s({ "x-security-level": "medium" }), s()],
        flow: [s(), s({}, { "x-flow-meta": 1 })],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: {
      add: [
        {
          at: "components/securitySchemes/api_key/x-security-level",
          type: annotation,
          mentions: ["x-security-level", "api_key"],
        },
      ],
      change: [
        {
          at: "components/securitySchemes/api_key/x-security-level",
          type: annotation,
          mentions: ["x-security-level", "api_key"],
        },
      ],
      remove: [
        {
          at: "components/securitySchemes/api_key/x-security-level",
          type: annotation,
          mentions: ["x-security-level", "api_key"],
        },
      ],
      flow: [
        {
          at: "components/securitySchemes/oauth/flows/clientCredentials/x-flow-meta",
          type: annotation,
          mentions: ["x-flow-meta", "oauth"],
        },
      ],
    },
  },
  {
    kind: "schema",
    id: "OAS-EXT-015",
    title: "extension inside a schema",
    before: "schema { type: string }",
    after: "schema { type: string, x-go-type: Name }",
    rationale: "schema extensions do not change validation; ASD leaves them unclassified (§12.2); proposed option a",
    annotation: "names the extension key",
    sources: [
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts schema objects", verdict: "unclassified" },
      { tool: "asd", ref: "DESIGN_PROPOSALS §12.2 (unclassified in JSON Schema)" },
    ],
    schema: [str, { ...str, "x-go-type": "Name" }],
    placements: ["request", "response", "param"],
    expect: [{ at: "x-go-type", type: annotation, mentions: ["x-go-type"] }],
    // ISSUE-131 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-016",
    title: "x-extensible-enum value removed from a request parameter",
    before: "path parameter groupId x-extensible-enum [1, 2]",
    after: "x-extensible-enum [1]",
    rationale:
      "oasdiff gives x-extensible-enum enum semantics (ERR: clients sending 2 are rejected); ASD treats extensions as metadata; proposed option a, option c would adopt the oasdiff semantics",
    annotation: "names the parameter, the extension and the removed value",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_x_extensible_enum_value_removed_test.go TestRequestParameterXExtensibleEnumValueRemoved",
        verdict: "ERR",
      },
    ],
    covers: ["oasdiff:request-parameter-x-extensible-enum-value-removed"],
    docs: [
      doc({
        "/groups/{groupId}": {
          get: {
            parameters: [
              {
                name: "groupId",
                in: "path",
                required: true,
                schema: { type: "string", "x-extensible-enum": ["1", "2"] },
              },
            ],
            responses: ok,
          },
        },
      }),
      doc({
        "/groups/{groupId}": {
          get: {
            parameters: [
              { name: "groupId", in: "path", required: true, schema: { type: "string", "x-extensible-enum": ["1"] } },
            ],
            responses: ok,
          },
        },
      }),
    ],
    expect: [
      {
        at: "paths/~1groups~1{groupId}/get/parameters/0/schema/x-extensible-enum/**",
        type: annotation,
        mentions: ["x-extensible-enum", "path parameter `groupId`"],
      },
    ],
    // ISSUE-131 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-017",
    title: "extension in the 3.2 additionalOperations map",
    before: "/pets additionalOperations { LINK }",
    after: "additionalOperations { LINK, x-proxy }",
    rationale: "an extension key of the map is not an operation",
    annotation: "names the extension key and the path",
    sources: [{ tool: "oasdiff", ref: "diff/oas32_custom_methods_test.go (custom methods)" }],
    docs: [
      doc({ "/pets": { additionalOperations: { LINK: { responses: ok } } } }, {}, "3.2.0"),
      doc({ "/pets": { additionalOperations: { LINK: { responses: ok }, "x-proxy": true } } }, {}, "3.2.0"),
    ],
    expect: [{ at: "paths/~1pets/additionalOperations/x-proxy", type: annotation, mentions: ["x-proxy", "/pets"] }],
    // ISSUE-54 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-018",
    title: "extension on a callback object and in the webhooks map",
    before: "callbacks.onEvent / webhooks without extensions",
    after: "callbacks.onEvent.x-retry / webhooks.x-signing",
    rationale: "extension keys of these maps are not callback expressions or webhooks",
    annotation: "names the extension key",
    sources: [{ tool: "fork", ref: "openapi.specificationExtensions.test.ts (callbacks: not implemented yet)" }],
    docs: (() => {
      const hook = { post: { requestBody: { content: { "application/json": { schema: str } } }, responses: ok } }
      const cb = (x: Record<string, unknown> = {}) =>
        doc({
          "/subscribe": { post: { callbacks: { onEvent: { "{$request.body#/url}": hook, ...x } }, responses: ok } },
        })
      const wh = (x: Record<string, unknown> = {}) => doc({}, { webhooks: { newPet: hook, ...x } })
      return {
        callback: [cb(), cb({ "x-retry": 3 })],
        webhooks: [wh(), wh({ "x-signing": "hmac" })],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: {
      callback: [{ at: "paths/~1subscribe/post/callbacks/onEvent/x-retry", type: annotation, mentions: ["x-retry"] }],
      webhooks: [{ at: "webhooks/x-signing", type: annotation, mentions: ["x-signing"] }],
    },
    // ISSUE-54 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EXT-019",
    title: "extension on a response link",
    before: "201 links { GetPet }",
    after: "GetPet x-link-meta added",
    rationale: "metadata only",
    annotation: "names the extension key and the link",
    sources: [{ tool: "libopenapi", ref: "link_test.go TestCompareLinks_ModifyExtension", verdict: "non-breaking" }],
    docs: (() => {
      const l = (x: Record<string, unknown> = {}) =>
        doc({
          "/pets": {
            post: {
              responses: { 201: { description: "created", links: { GetPet: { operationId: "getPet", ...x } } } },
            },
          },
        })
      return [l(), l({ "x-link-meta": 1 })] as [unknown, unknown]
    })(),
    expect: [
      {
        at: "paths/~1pets/post/responses/201/links/GetPet/x-link-meta",
        type: annotation,
        mentions: ["x-link-meta", "GetPet"],
      },
    ],
  },
]

runCases("openapi", "extensions", cases, import.meta.filename)
