import { annotation, breaking, deprecated, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// OpenAPI versions: `openapi` field changes, 3.0 <-> 3.1 <-> 3.2 cross-version comparisons (representation-only changes
// are annotations, decision §11.9 / DESIGN_PROPOSALS §7.3), 3.1 jsonSchemaDialect and 3.2 constructs ($self, the query
// method, additionalOperations, the querystring parameter).

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const oas = (
  openapi: string,
  paths: Record<string, unknown> = { "/pets": { get: op() } },
  extra: Record<string, unknown> = {},
) => ({
  openapi,
  info,
  paths,
  ...extra,
})
const withParam = (openapi: string, param: Record<string, unknown>) =>
  oas(openapi, { "/pets": { get: op({ parameters: [{ name: "q", in: "query", ...param }] }) } })
const P0 = "paths/~1pets/get/parameters/0"
const version = (to: string) => ({
  at: "openapi",
  action: "replace" as const,
  type: annotation,
  mentions: ["openapi", to],
})

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-VER-001",
    title: "openapi version field changed",
    before: "openapi 3.0.0 / 3.0.3 / 3.1.0 / 3.1.0 / 3.1",
    after: "3.0.3 / 3.1.0 / 3.2.0 / 3.0.3 (downgrade) / 3.1.0",
    rationale:
      "the specification version is metadata; representation changes are compared through the higher version's profile (§7.3)",
    annotation: "names the openapi field and the new version",
    sources: [
      { tool: "fork", ref: "oas-30-to-31.test.ts (version change annotation)", verdict: "annotation" },
      {
        tool: "libopenapi",
        ref: "document_test.go TestCompareDocuments_OpenAPI_BaseProperties_Modified",
        verdict: "breaking",
      },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G16" },
    ],
    docs: {
      patch: [oas("3.0.0"), oas("3.0.3")],
      "3.0-3.1": [oas("3.0.3"), oas("3.1.0")],
      "3.1-3.2": [oas("3.1.0"), oas("3.2.0")],
      downgrade: [oas("3.1.0"), oas("3.0.3")],
      short: [oas("3.1"), oas("3.1.0")],
    },
    expect: {
      patch: [version("3.0.3")],
      "3.0-3.1": [version("3.1.0")],
      "3.1-3.2": [version("3.2.0")],
      downgrade: [version("3.0.3")],
      short: [version("3.1.0")],
    },
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-002",
    title: "3.0 -> 3.1 upgrade together with an operation removal",
    before: "3.0.3 GET and PUT /pets",
    after: "3.1.0 GET /pets",
    rationale: "the version bump is an annotation; the removed operation is breaking as in any version",
    annotation: "names the removed operation",
    sources: [{ tool: "asd", ref: "test/openapi/openapi32.test.ts G16" }],
    covers: ["oasdiff:api-removed-without-deprecation"],
    docs: [oas("3.0.3", { "/pets": { get: op(), put: op() } }), oas("3.1.0", { "/pets": { get: op() } })],
    expect: [version("3.1.0"), { at: "paths/~1pets/put", action: "remove", type: breaking, mentions: ["PUT /pets"] }],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-003",
    title: "3.0 nullable parameter schema vs 3.1 type array with null",
    before: "3.0.3 query q { type: string, nullable: true }",
    after: "3.1.0 query q { type: [string, null] }",
    rationale: "the same set of values (§7.3 adapter); only the version changes",
    annotation: "only the version change",
    sources: [
      {
        tool: "fork",
        ref: "oas-30-to-31.test.ts nullable equals type union with null",
        verdict: "only the version change",
      },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G17" },
    ],
    docs: [
      withParam("3.0.3", { schema: { type: "string", nullable: true } }),
      withParam("3.1.0", { schema: { type: ["string", "null"] } }),
    ],
    expect: [version("3.1.0")],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-004",
    title: "3.0 boolean exclusiveMaximum vs 3.1 numeric bound in a parameter schema",
    before: "3.0.3 query q { type: integer, maximum: 10, exclusiveMaximum: true }",
    after: "3.1.0 query q { type: integer, exclusiveMaximum: 10 }",
    rationale: "the same constraint (§7.3 adapter)",
    annotation: "only the version change",
    sources: [
      {
        tool: "fork",
        ref: "oas-30-to-31.test.ts boolean exclusive bounds equal numeric ones",
        verdict: "only the version change",
      },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G18" },
    ],
    docs: [
      withParam("3.0.3", { schema: { type: "integer", maximum: 10, exclusiveMaximum: true } }),
      withParam("3.1.0", { schema: { type: "integer", exclusiveMaximum: 10 } }),
    ],
    expect: [version("3.1.0")],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-005",
    title: "3.0 parameter example vs 3.1 single examples entry",
    before: "3.0.3 query q example abc",
    after: "3.1.0 query q examples { default: { value: abc } }",
    rationale: "a representation change of the same example: annotations only (§7.3)",
    annotation: "names the parameter and the example",
    sources: [{ tool: "asd", ref: "DESIGN_PROPOSALS §7.3 (example ≡ single examples entry)" }],
    docs: [
      withParam("3.0.3", { schema: str, example: "abc" }),
      withParam("3.1.0", { schema: str, examples: { default: { value: "abc" } } }),
    ],
    expect: [
      version("3.1.0"),
      {
        at: [`${P0}/example`, `${P0}/examples`, `${P0}/examples/**`],
        type: annotation,
        mentions: ["query parameter `q`"],
      },
    ],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-006",
    title: "3.0 license url vs 3.1 license identifier",
    before: "3.0.3 license { name: MIT, url }",
    after: "3.1.0 license { name: MIT, identifier: MIT }",
    rationale: "documentation only",
    annotation: "names the license fields",
    sources: [{ tool: "oasdiff", ref: "diff/openapi31_test.go TestOpenAPI31_LicenseIdentifier" }],
    docs: [
      { ...oas("3.0.3"), info: { ...info, license: { name: "MIT", url: "https://opensource.org/licenses/MIT" } } },
      { ...oas("3.1.0"), info: { ...info, license: { name: "MIT", identifier: "MIT" } } },
    ],
    expect: [version("3.1.0"), { at: "info/license/*", type: annotation, mentions: ["license"] }],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-007",
    title: "3.0 inline path item vs 3.1 $ref to components.pathItems",
    before: "3.0.3 /pets inline GET",
    after: "3.1.0 /pets $ref #/components/pathItems/Pets",
    rationale: "the resolved path item is identical",
    annotation: "only the version change",
    sources: [
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/replace-inline-path-item-to-ref (3.0 -> 3.1)",
        verdict: "only the version change",
      },
    ],
    docs: [
      oas("3.0.3", { "/pets": { get: op() } }),
      oas(
        "3.1.0",
        { "/pets": { $ref: "#/components/pathItems/Pets" } },
        { components: { pathItems: { Pets: { get: op() } } } },
      ),
    ],
    expect: [
      version("3.1.0"),
      { at: ["components", "components/**"], action: "add", type: nonBreaking, optional: true, mentions: ["Pets"] },
    ],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-008",
    title: "3.0 -> 3.1 with a description override next to a parameter $ref",
    before: "3.0.3 parameters [$ref Limit] (component description Page size)",
    after: "3.1.0 parameters [{ $ref Limit, description: Max items }]",
    rationale: "3.1 Reference Objects may override description; documentation only",
    annotation: "names the parameter and the description",
    sources: [{ tool: "compat-suites", ref: "operation-parameters/add-overriden-description (3.0 -> 3.1)" }],
    docs: [
      oas(
        "3.0.3",
        { "/pets": { get: op({ parameters: [{ $ref: "#/components/parameters/Limit" }] }) } },
        {
          components: { parameters: { Limit: { name: "limit", in: "query", description: "Page size", schema: str } } },
        },
      ),
      oas(
        "3.1.0",
        { "/pets": { get: op({ parameters: [{ $ref: "#/components/parameters/Limit", description: "Max items" }] }) } },
        {
          components: { parameters: { Limit: { name: "limit", in: "query", description: "Page size", schema: str } } },
        },
      ),
    ],
    expect: [
      version("3.1.0"),
      { at: `${P0}/description`, type: annotation, mentions: ["query parameter `limit`", "description"] },
    ],
    // ISSUE-60 (fixed): detection and classification pass; the description remains (ISSUE-84)
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-009",
    title: "3.1 jsonSchemaDialect added",
    before: "3.1.0 without jsonSchemaDialect",
    after: "jsonSchemaDialect https://spec.openapis.org/oas/3.1/dialect/base",
    rationale:
      "declaring the default dialect explicitly does not change any schema (libopenapi flags every change as breaking)",
    annotation: "names jsonSchemaDialect",
    sources: [
      {
        tool: "libopenapi",
        ref: "document_test.go TestCompareDocuments_OpenAPI_BaseProperties_Modified (jsonSchemaDialect)",
        verdict: "breaking",
      },
      { tool: "oasdiff", ref: "diff/openapi31_test.go (root jsonSchemaDialect change)" },
    ],
    docs: [
      oas("3.1.0"),
      oas("3.1.0", undefined, { jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base" }),
    ],
    expect: [{ at: "jsonSchemaDialect", action: "add", type: annotation, mentions: ["jsonSchemaDialect"] }],
  },
  {
    kind: "doc",
    id: "OAS-VER-010",
    title: "3.2 $self added and changed",
    before: "3.2.0 without $self / $self a",
    after: "$self https://api.example.com/openapi.yaml / $self b",
    rationale: "the document's own URI is metadata (libopenapi flags it as breaking)",
    annotation: "names $self",
    sources: [
      { tool: "libopenapi", ref: "document_test.go TestCompareDocuments_OpenAPI_SelfField", verdict: "breaking" },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G14" },
    ],
    docs: {
      added: [oas("3.2.0"), oas("3.2.0", undefined, { $self: "https://api.example.com/openapi.yaml" })],
      changed: [
        oas("3.2.0", undefined, { $self: "https://api.example.com/v1/openapi.yaml" }),
        oas("3.2.0", undefined, { $self: "https://api.example.com/v2/openapi.yaml" }),
      ],
    },
    expect: [{ at: "$self", type: annotation, mentions: ["$self"] }],
  },
  {
    kind: "doc",
    id: "OAS-VER-011",
    title: "3.2 QUERY operation added and removed",
    before: "/search GET / GET + QUERY",
    after: "GET + QUERY / GET",
    rationale: "the query method is an operation like any other (§7.2)",
    annotation: "names QUERY and the path",
    sources: [
      {
        tool: "libopenapi",
        ref: "path_item_query_test.go TestComparePathItems_QueryAdded / _QueryRemoved",
        verdict: "add non-breaking, remove breaking",
      },
      {
        tool: "oasdiff",
        ref: "diff/oas32_custom_methods_test.go TestDiff_CustomMethodEndpointsOnAddedAndDeletedPaths",
      },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G2" },
    ],
    covers: ["oasdiff:endpoint-added", "oasdiff:api-removed-without-deprecation"],
    docs: {
      added: [oas("3.2.0", { "/search": { get: op() } }), oas("3.2.0", { "/search": { get: op(), query: op() } })],
      removed: [oas("3.2.0", { "/search": { get: op(), query: op() } }), oas("3.2.0", { "/search": { get: op() } })],
    },
    expect: {
      added: [{ at: "paths/~1search/query", action: "add", type: nonBreaking, mentions: ["QUERY /search"] }],
      removed: [{ at: "paths/~1search/query", action: "remove", type: breaking, mentions: ["QUERY /search"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-VER-012",
    title: "3.2 QUERY operation request changed",
    before: "QUERY /search with optional query parameter term",
    after: "term required",
    rationale: "the QUERY operation's request semantics are those of any operation",
    annotation: "names the parameter and the required status",
    sources: [
      { tool: "oasdiff", ref: "checker/oas32_custom_methods_test.go TestBreakingChange_UnderQueryMethod" },
      { tool: "libopenapi", ref: "path_item_query_test.go TestComparePathItems_QueryModified" },
    ],
    covers: ["oasdiff:request-parameter-became-required"],
    docs: [
      oas("3.2.0", { "/search": { query: op({ parameters: [{ name: "term", in: "query", schema: str }] }) } }),
      oas("3.2.0", {
        "/search": { query: op({ parameters: [{ name: "term", in: "query", required: true, schema: str }] }) },
      }),
    ],
    expect: [
      {
        at: "paths/~1search/query/parameters/0/required",
        type: breaking,
        mentions: ["query parameter `term`", "required"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-VER-013",
    title: "3.2 custom method in additionalOperations added and removed",
    before: "/pets GET + additionalOperations { PURGE } / { LINK }",
    after: "{ PURGE, MOVE } / {}",
    rationale: "custom methods are operations keyed by method name (§7.2): add non-breaking, remove breaking",
    annotation: "names the custom method and the path",
    sources: [
      {
        tool: "oasdiff",
        ref: "diff/oas32_custom_methods_test.go TestDiff_CustomMethodAddedDeletedAndModified (MOVE added, PURGE deleted)",
      },
      {
        tool: "libopenapi",
        ref: "path_item_test.go TestComparePathItem_V3_AdditionalMethodsAdd / _AdditionalMethodsRemove",
        verdict: "add non-breaking, remove breaking",
      },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G3" },
    ],
    covers: ["oasdiff:endpoint-added", "oasdiff:api-removed-without-deprecation"],
    docs: {
      added: [
        oas("3.2.0", { "/pets": { get: op(), additionalOperations: { PURGE: op() } } }),
        oas("3.2.0", { "/pets": { get: op(), additionalOperations: { PURGE: op(), MOVE: op() } } }),
      ],
      removed: [
        oas("3.2.0", { "/pets": { get: op(), additionalOperations: { PURGE: op(), LINK: op() } } }),
        oas("3.2.0", { "/pets": { get: op(), additionalOperations: { PURGE: op() } } }),
      ],
      firstAdded: [
        oas("3.2.0", { "/pets": { get: op() } }),
        oas("3.2.0", { "/pets": { get: op(), additionalOperations: { LINK: op() } } }),
      ],
    },
    expect: {
      added: [
        { at: "paths/~1pets/additionalOperations/MOVE", action: "add", type: nonBreaking, mentions: ["MOVE /pets"] },
      ],
      removed: [
        { at: "paths/~1pets/additionalOperations/LINK", action: "remove", type: breaking, mentions: ["LINK /pets"] },
      ],
      firstAdded: [
        { at: "paths/~1pets/additionalOperations/LINK", action: "add", type: nonBreaking, mentions: ["LINK /pets"] },
      ],
    },
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-014",
    title: "3.2 additionalOperations QUERY is the query method",
    before: "/search additionalOperations { QUERY }",
    after: "/search query",
    rationale: "the same operation in two containers (§7.2)",
    annotation: "no diff",
    sources: [
      {
        tool: "oasdiff",
        ref: "diff/oas32_custom_methods_test.go TestDiff_CustomMethodShadowingFixedFieldIsNotDoubleCounted",
      },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G3" },
    ],
    docs: [
      oas("3.2.0", { "/search": { additionalOperations: { QUERY: op() } } }),
      oas("3.2.0", { "/search": { query: op() } }),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-VER-015",
    title: "3.2 custom method deprecated and its summary changed",
    before: "/pets additionalOperations { COPY }",
    after: "COPY deprecated: true / summary changed",
    rationale: "deprecation and documentation as for any operation",
    annotation: "names COPY and the path",
    sources: [
      {
        tool: "oasdiff",
        ref: "diff/oas32_custom_methods_test.go TestDiff_CustomMethodAddedDeletedAndModified (COPY DeprecatedDiff)",
      },
    ],
    covers: ["oasdiff:endpoint-deprecated"],
    docs: {
      deprecated: [
        oas("3.2.0", { "/pets": { additionalOperations: { COPY: op() } } }),
        oas("3.2.0", { "/pets": { additionalOperations: { COPY: op({ deprecated: true }) } } }),
      ],
      summary: [
        oas("3.2.0", { "/pets": { additionalOperations: { COPY: op({ summary: "a" }) } } }),
        oas("3.2.0", { "/pets": { additionalOperations: { COPY: op({ summary: "b" }) } } }),
      ],
    },
    expect: {
      deprecated: [
        {
          at: "paths/~1pets/additionalOperations/COPY/deprecated",
          type: deprecated,
          mentions: ["COPY /pets", "deprecated"],
        },
      ],
      summary: [
        { at: "paths/~1pets/additionalOperations/COPY/summary", type: annotation, mentions: ["COPY /pets", "summary"] },
      ],
    },
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-016",
    title: "3.2 querystring parameter added (optional / required) and removed",
    before: "GET /search without / with a querystring parameter",
    after: "with / without it",
    rationale:
      "a querystring parameter is the whole query string as a request input (§7.2): a required one breaks callers, removing it drops their input",
    annotation: "names the querystring parameter",
    sources: [
      { tool: "libopenapi", ref: "parameter_test.go TestCompareParameters_QuerystringLocation" },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G4" },
    ],
    covers: [
      "oasdiff:new-optional-request-parameter",
      "oasdiff:new-required-request-parameter",
      "oasdiff:request-parameter-removed",
    ],
    docs: (() => {
      const qs = (required?: boolean) => ({
        name: "filter",
        in: "querystring",
        ...(required ? { required } : {}),
        content: { "application/x-www-form-urlencoded": { schema: { type: "object", properties: { q: str } } } },
      })
      const d = (p?: unknown) => oas("3.2.0", { "/search": { get: op(p ? { parameters: [p] } : {}) } })
      return { optional: [d(), d(qs())], required: [d(), d(qs(true))], removed: [d(qs()), d()] } as Record<
        string,
        [unknown, unknown]
      >
    })(),
    expect: {
      optional: [
        {
          at: "paths/~1search/get/parameters/0",
          action: "add",
          type: nonBreaking,
          mentions: ["querystring parameter `filter`"],
        },
      ],
      required: [
        {
          at: "paths/~1search/get/parameters/0",
          action: "add",
          type: breaking,
          mentions: ["querystring parameter `filter`"],
        },
      ],
      removed: [
        {
          at: "paths/~1search/get/parameters/0",
          action: "remove",
          type: breaking,
          mentions: ["querystring parameter `filter`"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-VER-017",
    title: "3.2 querystring parameter content schema gains a required property",
    before: "querystring filter { q }",
    after: "querystring filter { q, page } required [page]",
    rationale: "existing query strings without page are rejected (request semantics)",
    annotation: "names the property and the querystring parameter",
    sources: [{ tool: "asd", ref: "test/openapi/openapi32.test.ts G4" }],
    docs: (() => {
      const d = (schema: unknown) =>
        oas("3.2.0", {
          "/search": {
            get: op({
              parameters: [
                { name: "filter", in: "querystring", content: { "application/x-www-form-urlencoded": { schema } } },
              ],
            }),
          },
        })
      return [
        d({ type: "object", properties: { q: str } }),
        d({ type: "object", properties: { q: str, page: str }, required: ["page"] }),
      ] as [unknown, unknown]
    })(),
    expect: [
      {
        at: [
          "paths/~1search/get/parameters/0/content/*/schema/properties/page",
          "paths/~1search/get/parameters/0/content/*/schema/required/**",
        ],
        action: "add",
        type: breaking,
        mentions: ["page", "querystring parameter `filter`"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-VER-018",
    title: "3.1 -> 3.2 parameter example value moved to dataValue",
    before: "3.1.0 query q examples { a: { value: abc } }",
    after: "3.2.0 query q examples { a: { dataValue: abc } }",
    rationale: "value and dataValue carry the same example (§7.2 cross-version rename)",
    annotation: "only the version change",
    sources: [{ tool: "asd", ref: "test/openapi/openapi32.test.ts G19" }],
    docs: [
      withParam("3.1.0", { schema: str, examples: { a: { value: "abc" } } }),
      withParam("3.2.0", { schema: str, examples: { a: { dataValue: "abc" } } }),
    ],
    expect: [version("3.2.0")],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-VER-019",
    title: "3.0 -> 3.1 upgrade that adds webhooks",
    before: "3.0.3 without webhooks",
    after: "3.1.0 webhooks { newPet }",
    rationale: "the version bump is an annotation; the new webhook is an addition",
    annotation: "names the new webhook",
    sources: [{ tool: "oasdiff", ref: "diff/webhooks_diff_test.go TestWebhooks_OnlyInRevision" }],
    covers: ["oasdiff:webhook-added"],
    docs: [
      oas("3.0.3"),
      oas("3.1.0", undefined, {
        webhooks: {
          newPet: { post: { requestBody: { content: { "application/json": { schema: str } } }, responses: ok } },
        },
      }),
    ],
    expect: [
      version("3.1.0"),
      { at: ["webhooks", "webhooks/**"], action: "add", type: nonBreaking, mentions: ["newPet"] },
    ],
    // ISSUE-68 (fixed): detection and classification pass; the description remains (ISSUE-84)
    // ISSUE-84 (fixed) (P8-OAS)
  },
]

runCases("openapi", "versions", cases, import.meta.filename)
