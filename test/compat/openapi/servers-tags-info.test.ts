import { annotation } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// Servers (root / path item / operation, variables, 3.2 name), root tags (incl. 3.2 parent / kind / summary), info
// (version, title, description, termsOfService, contact, license incl. 3.1 identifier / summary) and root externalDocs.

const ok = { 200: { description: "ok" } }
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const baseInfo = { title: "compat", version: "1.0.0" }
const root = (extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info: baseInfo,
  paths: { "/pets": { get: op() } },
  ...extra,
})
const withInfo = (info: Record<string, unknown>) => ({ ...root(), info: { ...baseInfo, ...info } })
const srv = (url: string, o: Record<string, unknown> = {}) => ({ url, ...o })

// POLICY-09 decided (a): servers are deployment metadata and every server change is an annotation (decision §11.18)

const cases: CompatCase[] = [
  // ---------------------------------------------------------------------------------------------------------------
  // servers
  {
    kind: "doc",
    id: "OAS-SRV-001",
    title: "root server added",
    before: "servers [https://api.example.com]",
    after: "servers [https://api.example.com, https://eu.example.com]",
    rationale:
      "a new base URL is an extra option; clients of the existing one are unaffected (test/openapi/openapi3.test.ts add servers)",
    annotation: "names the added server URL",
    sources: [
      {
        tool: "libopenapi",
        ref: "document_test.go TestCompareDocuments_OpenAPI_ServersAddedConfigurable",
        verdict: "non-breaking",
      },
      { tool: "oasdiff", ref: "diff/diff_test.go TestServerAdded (no checker rule: non-contract)" },
      { tool: "asd", ref: "test/openapi/openapi3.test.ts add servers should be non-breaking change" },
    ],
    docs: [
      root({ servers: [srv("https://api.example.com")] }),
      root({ servers: [srv("https://api.example.com"), srv("https://eu.example.com")] }),
    ],
    expect: [{ at: "servers/1", action: "add", type: annotation, mentions: ["https://eu.example.com"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-002",
    title: "root servers declared for the first time",
    before: "no servers (default /)",
    after: "servers [https://api.example.com]",
    rationale: "documentation of the deployment",
    annotation: "names the server URL",
    sources: [{ tool: "fork", ref: "openapi.add-required-fields.test.ts + servers url (not breaking)" }],
    docs: [root(), root({ servers: [srv("https://api.example.com")] })],
    expect: [{ at: "servers/**", action: "add", type: annotation, mentions: ["https://api.example.com"] }],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SRV-003",
    title: "root server removed",
    before: "servers [https://api.example.com, https://eu.example.com]",
    after: "servers [https://api.example.com]",
    rationale: "clients configured with the EU base URL may stop working (libopenapi breaking); ASD proposes option a",
    annotation: "names the removed server URL",
    sources: [
      {
        tool: "libopenapi",
        ref: "document_test.go TestCompareDocuments_OpenAPI_ServersConfigurable",
        verdict: "breaking",
      },
      { tool: "oasdiff", ref: "checker/check_not_breaking_test.go TestBreaking_Servers", verdict: "no change" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-server-url", verdict: "annotation" },
    ],
    docs: [
      root({ servers: [srv("https://api.example.com"), srv("https://eu.example.com")] }),
      root({ servers: [srv("https://api.example.com")] }),
    ],
    expect: [{ at: "servers/1", action: "remove", type: annotation, mentions: ["https://eu.example.com"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-004",
    title: "root server URL changed",
    before: "servers [https://api.example.com/v1]",
    after: "servers [https://api.example.com/v2]",
    rationale: "requests to the old base URL may fail (libopenapi: removed + added, breaking); ASD proposes option a",
    annotation: "names the old and the new URL",
    sources: [
      { tool: "libopenapi", ref: "document_test.go TestCompareDocuments_OpenAPI_ModifyServers", verdict: "breaking" },
      { tool: "fork", ref: "openapi.classification.test.ts Servers change", verdict: "annotation" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-server-url", verdict: "annotation" },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.2" },
    ],
    docs: [
      root({ servers: [srv("https://api.example.com/v1")] }),
      root({ servers: [srv("https://api.example.com/v2")] }),
    ],
    expect: [
      {
        at: ["servers/0/url", "servers/0"],
        type: annotation,
        mentions: ["https://api.example.com/v1", "https://api.example.com/v2"],
      },
    ],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-005",
    title: "server description added, changed and removed",
    before: "server https://api.example.com description absent / Production / Production",
    after: "description Production / Live / absent",
    rationale: "documentation only (every tool agrees)",
    annotation: "names the server URL and the description",
    sources: [
      { tool: "libopenapi", ref: "breaking_rules.go server.description", verdict: "non-breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-server-description" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-server-description" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-server-description" },
    ],
    docs: {
      add: [
        root({ servers: [srv("https://api.example.com")] }),
        root({ servers: [srv("https://api.example.com", { description: "Production" })] }),
      ],
      replace: [
        root({ servers: [srv("https://api.example.com", { description: "Production" })] }),
        root({ servers: [srv("https://api.example.com", { description: "Live" })] }),
      ],
      remove: [
        root({ servers: [srv("https://api.example.com", { description: "Production" })] }),
        root({ servers: [srv("https://api.example.com")] }),
      ],
    },
    expect: [{ at: "servers/0/description", type: annotation, mentions: ["https://api.example.com", "description"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-006",
    title: "servers reordered",
    before: "servers [a, b]",
    after: "servers [b, a]",
    rationale: "the set of base URLs is unchanged (servers are matched by url)",
    annotation: "no diff",
    sources: [{ tool: "libopenapi", ref: "operation.go checkServers (keyed by URL)", verdict: "no change" }],
    docs: [
      root({ servers: [srv("https://a.example.com"), srv("https://b.example.com")] }),
      root({ servers: [srv("https://b.example.com"), srv("https://a.example.com")] }),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-SRV-007",
    title: "server variable introduced into the URL",
    before: "server https://example.com",
    after: "server https://{tenant}.example.com with variable tenant (default www)",
    rationale: "the default resolves to a different host name (the fork reports annotations); ASD proposes option a",
    annotation: "names the server URL and the variable",
    sources: [
      { tool: "compat-suites", ref: "general-operation-parameters/add-variable", verdict: "annotation" },
      { tool: "oasdiff", ref: "diff/diff_test.go TestServerVariableAdded" },
    ],
    docs: [
      root({ servers: [srv("https://example.com")] }),
      root({ servers: [srv("https://{tenant}.example.com", { variables: { tenant: { default: "www" } } })] }),
    ],
    expect: [
      { at: "servers/0/url", type: annotation, mentions: ["https://{tenant}.example.com"] },
      { at: "servers/0/variables", action: "add", type: annotation, mentions: ["tenant"] },
    ],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-008",
    title: "server variable default changed",
    before: "variable env default prod",
    after: "variable env default staging",
    rationale: "clients using the default base URL now hit another host (libopenapi breaking); ASD proposes option a",
    annotation: "names the server, the variable and the new default",
    sources: [
      { tool: "libopenapi", ref: "server_variable_test.go TestCompareServers_Modified", verdict: "breaking" },
      { tool: "oasdiff", ref: "diff/diff_test.go TestServerVariableModified" },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/update-variable-default-value",
        verdict: "annotation",
      },
    ],
    docs: [
      root({
        servers: [
          srv("https://{env}.example.com", { variables: { env: { default: "prod", enum: ["prod", "staging"] } } }),
        ],
      }),
      root({
        servers: [
          srv("https://{env}.example.com", { variables: { env: { default: "staging", enum: ["prod", "staging"] } } }),
        ],
      }),
    ],
    expect: [{ at: "servers/0/variables/env/default", type: annotation, mentions: ["env", "staging"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-009",
    title: "server variable enum value added",
    before: "variable env enum [prod]",
    after: "enum [prod, staging]",
    rationale: "an extra allowed value does not affect clients using prod (libopenapi non-breaking)",
    annotation: "names the variable and the added value",
    sources: [
      {
        tool: "libopenapi",
        ref: "server_variable_test.go TestCompareServerVariables_EnumAddedEdgeCase",
        verdict: "non-breaking",
      },
      { tool: "compat-suites", ref: "general-operation-parameters/update-variable-enum", verdict: "annotation" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-variable-enum", verdict: "annotation" },
    ],
    docs: [
      root({
        servers: [srv("https://{env}.example.com", { variables: { env: { default: "prod", enum: ["prod"] } } })],
      }),
      root({
        servers: [
          srv("https://{env}.example.com", { variables: { env: { default: "prod", enum: ["prod", "staging"] } } }),
        ],
      }),
    ],
    expect: [{ at: "servers/0/variables/env/enum/**", action: "add", type: annotation, mentions: ["env", "staging"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-010",
    title: "server variable enum value removed",
    before: "variable env enum [prod, staging]",
    after: "enum [prod]",
    rationale: "clients using the staging host lose it (libopenapi breaking); ASD proposes option a",
    annotation: "names the variable and the removed value",
    sources: [
      {
        tool: "libopenapi",
        ref: "server_variable_test.go TestCompareServerVariables_EnumRemoved",
        verdict: "breaking",
      },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-variable-enum", verdict: "annotation" },
    ],
    docs: [
      root({
        servers: [
          srv("https://{env}.example.com", { variables: { env: { default: "prod", enum: ["prod", "staging"] } } }),
        ],
      }),
      root({
        servers: [srv("https://{env}.example.com", { variables: { env: { default: "prod", enum: ["prod"] } } })],
      }),
    ],
    expect: [
      { at: "servers/0/variables/env/enum/**", action: "remove", type: annotation, mentions: ["env", "staging"] },
    ],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-011",
    title: "server variable description changed",
    before: "variable env description a",
    after: "description b",
    rationale: "documentation only",
    annotation: "names the variable and the description",
    sources: [
      {
        tool: "libopenapi",
        ref: "server_variable_test.go TestCompareServerVariables_Modified",
        verdict: "non-breaking",
      },
      { tool: "compat-suites", ref: "general-operation-parameters/update-server-variable-description" },
    ],
    docs: [
      root({
        servers: [srv("https://{env}.example.com", { variables: { env: { default: "prod", description: "a" } } })],
      }),
      root({
        servers: [srv("https://{env}.example.com", { variables: { env: { default: "prod", description: "b" } } })],
      }),
    ],
    expect: [{ at: "servers/0/variables/env/description", type: annotation, mentions: ["env", "description"] }],
  },
  {
    kind: "doc",
    id: "OAS-SRV-012",
    title: "path-level server URL changed",
    before: "/pets servers [https://a.example.com]",
    after: "/pets servers [https://b.example.com]",
    rationale: "as for root servers; ASD proposes option a",
    annotation: "names the path and the new URL",
    sources: [
      { tool: "libopenapi", ref: "breaking_rules.go pathItem.servers", verdict: "breaking (removed)" },
      { tool: "oasdiff", ref: "diff/diff_test.go TestServerAddedToPathItem" },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.11" },
    ],
    docs: [
      { ...root(), paths: { "/pets": { servers: [srv("https://a.example.com")], get: op() } } },
      { ...root(), paths: { "/pets": { servers: [srv("https://b.example.com")], get: op() } } },
    ],
    expect: [
      {
        at: ["paths/~1pets/servers/0/url", "paths/~1pets/servers/0"],
        type: annotation,
        mentions: ["/pets", "https://b.example.com"],
      },
    ],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SRV-013",
    title: "operation-level server added",
    before: "GET /pets without servers",
    after: "GET /pets servers [https://read.example.com]",
    rationale: "documentation of an alternative host for this operation",
    annotation: "names the operation and the server URL",
    sources: [
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_AddServerToOp", verdict: "non-breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-server-url", verdict: "annotation" },
    ],
    docs: [root(), { ...root(), paths: { "/pets": { get: op({ servers: [srv("https://read.example.com")] }) } } }],
    expect: [
      {
        at: "paths/~1pets/get/servers/**",
        action: "add",
        type: annotation,
        mentions: ["GET /pets", "https://read.example.com"],
      },
    ],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SRV-014",
    title: "operation-level server removed and URL changed",
    before: "GET /pets servers [https://read.example.com]",
    after: "no servers / servers [https://ro.example.com]",
    rationale: "clients calling the operation-specific host may fail (libopenapi breaking); ASD proposes option a",
    annotation: "names the operation and the server URL",
    sources: [
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_RemoveServerFromOp", verdict: "breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-server-url", verdict: "annotation" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-server-url", verdict: "annotation" },
    ],
    docs: {
      removed: [{ ...root(), paths: { "/pets": { get: op({ servers: [srv("https://read.example.com")] }) } } }, root()],
      changed: [
        { ...root(), paths: { "/pets": { get: op({ servers: [srv("https://read.example.com")] }) } } },
        { ...root(), paths: { "/pets": { get: op({ servers: [srv("https://ro.example.com")] }) } } },
      ],
    },
    expect: {
      removed: [
        {
          at: "paths/~1pets/get/servers/**",
          action: "remove",
          type: annotation,
          mentions: ["GET /pets", "https://read.example.com"],
        },
      ],
      changed: [
        { at: "paths/~1pets/get/servers/**", type: annotation, mentions: ["GET /pets", "https://ro.example.com"] },
      ],
    },
    // ISSUE-84 fixed for "changed" (P8a)
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SRV-015",
    title: "3.2 named server: URL changed under the same name",
    before: "servers [{ name: prod, url: https://api.example.com }]",
    after: "servers [{ name: prod, url: https://api2.example.com }]",
    rationale:
      "servers are matched by name (DESIGN_PROPOSALS §7.2), so this is a URL change of the prod server; ASD proposes option a",
    annotation: "names the server and the new URL",
    sources: [
      { tool: "libopenapi", ref: "server_test.go TestCompareServers_NameAndOtherChanges", verdict: "breaking" },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G6" },
    ],
    docs: [
      root({ servers: [srv("https://api.example.com", { name: "prod" })] }, "3.2.0"),
      root({ servers: [srv("https://api2.example.com", { name: "prod" })] }, "3.2.0"),
    ],
    expect: [{ at: "servers/0/url", type: annotation, mentions: ["prod", "https://api2.example.com"] }],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SRV-016",
    title: "3.2 server name added",
    before: "servers [{ url: https://api.example.com }]",
    after: "servers [{ name: prod, url: https://api.example.com }]",
    rationale: "a name is documentation (libopenapi flags every server name change as breaking); ASD proposes option a",
    annotation: "names the server URL and the name",
    sources: [
      { tool: "libopenapi", ref: "server_test.go TestCompareServers_NameAdded", verdict: "breaking" },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G6" },
    ],
    docs: [
      root({ servers: [srv("https://api.example.com")] }, "3.2.0"),
      root({ servers: [srv("https://api.example.com", { name: "prod" })] }, "3.2.0"),
    ],
    expect: [{ at: "servers/0/name", action: "add", type: annotation, mentions: ["https://api.example.com", "prod"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // root tags
  {
    kind: "doc",
    id: "OAS-TAG-001",
    title: "root tag added",
    before: "tags [pets]",
    after: "tags [pets, store]",
    rationale: "documentation grouping only",
    annotation: "names the added tag",
    sources: [
      { tool: "oasdiff", ref: "diff/diff_test.go TestDiff_AddedGlobalTag (no checker rule)" },
      { tool: "libopenapi", ref: "tags_test.go TestCompareTags_AddNewTag", verdict: "non-breaking" },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.3" },
    ],
    docs: [root({ tags: [{ name: "pets" }] }), root({ tags: [{ name: "pets" }, { name: "store" }] })],
    expect: [{ at: "tags/1", action: "add", type: annotation, mentions: ["store"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-TAG-002",
    title: "root tag removed",
    before: "tags [pets, store]",
    after: "tags [pets]",
    rationale: "documentation grouping only; no request or response changes (libopenapi flags it as breaking)",
    annotation: "names the removed tag",
    sources: [
      { tool: "libopenapi", ref: "tags_test.go TestCompareTags_AddDeleteTag", verdict: "breaking" },
      { tool: "oasdiff", ref: "checker/check_not_breaking_test.go TestBreaking_DeletedTag", verdict: "no change" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-tag", verdict: "annotation" },
    ],
    docs: [root({ tags: [{ name: "pets" }, { name: "store" }] }), root({ tags: [{ name: "pets" }] })],
    expect: [{ at: "tags/1", action: "remove", type: annotation, mentions: ["store"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-TAG-003",
    title: "root tag description and externalDocs changed",
    before: "tag pets description Harrison / no externalDocs",
    after: "description harrison / externalDocs added",
    rationale: "documentation only",
    annotation: "names the tag and the field",
    sources: [
      { tool: "oasdiff", ref: "diff/diff_test.go TestDiff_ModifiedGlobalTag" },
      {
        tool: "libopenapi",
        ref: "tags_test.go TestCompareTags / TestCompareTags_AddExternalDocs",
        verdict: "non-breaking",
      },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.3" },
    ],
    docs: {
      description: [
        root({ tags: [{ name: "pets", description: "Harrison" }] }),
        root({ tags: [{ name: "pets", description: "harrison" }] }),
      ],
      externalDocs: [
        root({ tags: [{ name: "pets" }] }),
        root({ tags: [{ name: "pets", externalDocs: { url: "https://docs.example.com/pets" } }] }),
      ],
    },
    expect: {
      description: [{ at: "tags/0/description", type: annotation, mentions: ["pets", "description"] }],
      externalDocs: [{ at: "tags/0/externalDocs", type: annotation, mentions: ["pets", "externalDocs"] }],
    },
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-TAG-004",
    title: "root tags reordered",
    before: "tags [pets, store]",
    after: "tags [store, pets]",
    rationale: "tags are matched by name",
    annotation: "no diff",
    sources: [{ tool: "libopenapi", ref: "tags.go (keyed by name)", verdict: "no change" }],
    docs: [
      root({ tags: [{ name: "pets" }, { name: "store" }] }),
      root({ tags: [{ name: "store" }, { name: "pets" }] }),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-TAG-005",
    title: "root tag renamed",
    before: "tags [pets]",
    after: "tags [animals]",
    rationale: "documentation grouping only (libopenapi: removed + added, breaking)",
    annotation: "names the old and the new tag",
    sources: [{ tool: "libopenapi", ref: "tags.go (rename = removed + added)", verdict: "breaking" }],
    docs: [root({ tags: [{ name: "pets" }] }), root({ tags: [{ name: "animals" }] })],
    expect: [
      { at: "tags/0", action: "remove", type: annotation, mentions: ["pets"] },
      { at: "tags/0", action: "add", type: annotation, mentions: ["animals"] },
    ],
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-TAG-006",
    title: "tags section added and removed as a whole",
    before: "no tags / tags [pets]",
    after: "tags [pets] / no tags",
    rationale: "documentation only (test/openapi/document.test.ts C1.4)",
    annotation: "names the tag",
    sources: [{ tool: "asd", ref: "test/openapi/document.test.ts C1.4" }],
    docs: {
      added: [root(), root({ tags: [{ name: "pets" }] })],
      removed: [root({ tags: [{ name: "pets" }] }), root()],
    },
    expect: [{ at: "tags/**", type: annotation, mentions: ["pets"] }],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-TAG-007",
    title: "3.2 tag parent set and changed",
    before: "tags [pets, store, cats] (cats without parent / parent pets)",
    after: "cats parent pets / parent store",
    rationale:
      "the hierarchy is navigation metadata (DESIGN_PROPOSALS §7.2: annotation, described as moved); libopenapi treats every parent change as breaking",
    annotation: "names the tag and its parent",
    sources: [
      {
        tool: "libopenapi",
        ref: "tags_test.go TestCompareTags_OpenAPI32_ModifiedFields / TestCompareTags_ParentAddedConfigurable",
        verdict: "breaking",
      },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G5" },
    ],
    docs: {
      set: [
        root({ tags: [{ name: "pets" }, { name: "store" }, { name: "cats" }] }, "3.2.0"),
        root({ tags: [{ name: "pets" }, { name: "store" }, { name: "cats", parent: "pets" }] }, "3.2.0"),
      ],
      moved: [
        root({ tags: [{ name: "pets" }, { name: "store" }, { name: "cats", parent: "pets" }] }, "3.2.0"),
        root({ tags: [{ name: "pets" }, { name: "store" }, { name: "cats", parent: "store" }] }, "3.2.0"),
      ],
    },
    expect: {
      set: [{ at: "tags/2/parent", type: annotation, mentions: ["cats", "pets"] }],
      moved: [{ at: "tags/2/parent", type: annotation, mentions: ["cats", "store"] }],
    },
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-TAG-008",
    title: "3.2 tag kind and summary added",
    before: "tag pets",
    after: "tag pets kind nav, summary Pets",
    rationale: "documentation only (libopenapi non-breaking)",
    annotation: "names the tag and the field",
    sources: [
      { tool: "libopenapi", ref: "tags_test.go TestCompareTags_OpenAPI32_NewFields", verdict: "non-breaking" },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G5" },
    ],
    docs: [
      root({ tags: [{ name: "pets" }] }, "3.2.0"),
      root({ tags: [{ name: "pets", kind: "nav", summary: "Pets" }] }, "3.2.0"),
    ],
    expect: [{ at: ["tags/0/kind", "tags/0/summary"], action: "add", type: annotation, mentions: ["pets"] }],
    // ISSUE-84 (fixed) (P8a)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // info and root externalDocs
  {
    kind: "doc",
    id: "OAS-INFO-001",
    title: "API version changed (upgrade, patch and downgrade)",
    before: "info.version 1.0.0 / 1.0.0 / 2.0.0",
    after: "2.0.0 / 1.0.1 / 1.0.0",
    rationale:
      "the version string is metadata; the actual changes are reported on their own (oasdiff api-version-changed INFO, never the verdict)",
    annotation: "names info.version and the new version",
    sources: [
      { tool: "oasdiff", ref: "checker/check_api_version_updated_test.go TestAPIVersionChanged", verdict: "INFO" },
      { tool: "libopenapi", ref: "info_test.go TestCompareInfo_VersionModified", verdict: "non-breaking" },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.1" },
    ],
    covers: ["oasdiff:api-version-changed"],
    docs: {
      major: [withInfo({ version: "1.0.0" }), withInfo({ version: "2.0.0" })],
      patch: [withInfo({ version: "1.0.0" }), withInfo({ version: "1.0.1" })],
      downgrade: [withInfo({ version: "2.0.0" }), withInfo({ version: "1.0.0" })],
    },
    expect: {
      major: [{ at: "info/version", type: annotation, mentions: ["version", "2.0.0"] }],
      patch: [{ at: "info/version", type: annotation, mentions: ["version", "1.0.1"] }],
      downgrade: [{ at: "info/version", type: annotation, mentions: ["version", "1.0.0"] }],
    },
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-INFO-002",
    title: "info title, description and termsOfService changed",
    before: "title compat, no description, no termsOfService",
    after: "title Pet Store / description added / termsOfService added",
    rationale: "documentation only",
    annotation: "names the info field",
    sources: [
      {
        tool: "libopenapi",
        ref: "info_test.go TestCompareInfo_DescriptionAdded / _TitleRemoved",
        verdict: "non-breaking",
      },
      {
        tool: "openapi-changes",
        ref: "sample-specs petstorev3 regression (info title / description / termsOfService)",
      },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.1" },
    ],
    docs: {
      title: [withInfo({}), withInfo({ title: "Pet Store" })],
      description: [withInfo({}), withInfo({ description: "Pets API" })],
      termsOfService: [withInfo({}), withInfo({ termsOfService: "https://example.com/terms" })],
    },
    expect: {
      title: [{ at: "info/title", type: annotation, mentions: ["title"] }],
      description: [{ at: "info/description", type: annotation, mentions: ["description"] }],
      termsOfService: [{ at: "info/termsOfService", type: annotation, mentions: ["termsOfService"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-INFO-003",
    title: "info contact added, changed and removed",
    before: "no contact / contact email a / contact",
    after: "contact / email b / no contact",
    rationale: "documentation only",
    annotation: "names the contact field",
    sources: [
      {
        tool: "libopenapi",
        ref: "info_test.go TestCompareInfo_AddContact / _ContactModified / _RemoveContact",
        verdict: "non-breaking",
      },
      { tool: "fork", ref: "openapi.specificationExtensions.test.ts info.contact (x-* annotation)" },
    ],
    docs: {
      add: [withInfo({}), withInfo({ contact: { name: "API team", email: "api@example.com" } })],
      email: [
        withInfo({ contact: { email: "api@example.com" } }),
        withInfo({ contact: { email: "team@example.com" } }),
      ],
      remove: [withInfo({ contact: { email: "api@example.com" } }), withInfo({})],
    },
    expect: [{ at: ["info/contact", "info/contact/**"], type: annotation, mentions: ["contact"] }],
  },
  {
    kind: "doc",
    id: "OAS-INFO-004",
    title: "license added, changed and given a 3.1 identifier",
    before: "no license / license MIT / license MIT",
    after: "license MIT / Apache-2.0 (url changed) / MIT with identifier MIT",
    rationale: "documentation only",
    annotation: "names the license field",
    sources: [
      { tool: "libopenapi", ref: "license_test.go TestCompareLicense_URLAdded / _Identifier", verdict: "non-breaking" },
      { tool: "oasdiff", ref: "diff/openapi31_test.go TestOpenAPI31_LicenseIdentifier" },
    ],
    docs: {
      add: [withInfo({}), withInfo({ license: { name: "MIT" } })],
      changed: [
        withInfo({ license: { name: "MIT", url: "https://opensource.org/licenses/MIT" } }),
        withInfo({ license: { name: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" } }),
      ],
      identifier: [withInfo({ license: { name: "MIT" } }), withInfo({ license: { name: "MIT", identifier: "MIT" } })],
    },
    expect: [{ at: ["info/license", "info/license/**"], type: annotation, mentions: ["license"] }],
  },
  {
    kind: "doc",
    id: "OAS-INFO-005",
    title: "3.1 info summary added",
    before: "info without summary",
    after: "info.summary Pets API",
    rationale: "documentation only",
    annotation: "names info.summary",
    sources: [
      { tool: "oasdiff", ref: "diff/openapi31_test.go TestOpenAPI31_InfoSummary" },
      { tool: "libopenapi", ref: "breaking_rules.go info.summary", verdict: "non-breaking" },
    ],
    docs: [withInfo({}), withInfo({ summary: "Pets API" })],
    expect: [{ at: "info/summary", action: "add", type: annotation, mentions: ["summary"] }],
  },
  {
    kind: "doc",
    id: "OAS-INFO-006",
    title: "root externalDocs added, url changed and removed",
    before: "no externalDocs / url a / externalDocs",
    after: "externalDocs / url b / none",
    rationale: "documentation link only",
    annotation: "names externalDocs (and the new URL)",
    sources: [
      {
        tool: "libopenapi",
        ref: "document_test.go TestCompareDocuments_Swagger_ExternalDocs_Added / _Modified / _Removed",
        verdict: "non-breaking",
      },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.3 / C1.4" },
    ],
    docs: {
      add: [root(), root({ externalDocs: { url: "https://docs.example.com" } })],
      url: [
        root({ externalDocs: { url: "https://docs.example.com/a" } }),
        root({ externalDocs: { url: "https://docs.example.com/b" } }),
      ],
      remove: [root({ externalDocs: { url: "https://docs.example.com" } }), root()],
    },
    expect: {
      add: [{ at: "externalDocs", action: "add", type: annotation, mentions: ["externalDocs"] }],
      url: [{ at: "externalDocs/url", type: annotation, mentions: ["externalDocs", "https://docs.example.com/b"] }],
      remove: [{ at: "externalDocs", action: "remove", type: annotation, mentions: ["externalDocs"] }],
    },
    // ISSUE-84 fixed for "url" (P8a)
    // ISSUE-84 (fixed) (P8-OAS)
  },
]

runCases("openapi", "servers-tags-info", cases, import.meta.filename)
