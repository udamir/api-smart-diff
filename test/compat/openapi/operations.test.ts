import { annotation, breaking, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// Operations: add / remove, method changes, operationId, summary, description, tags and externalDocs of the operation.
// Deprecation lives in deprecation.test.ts, security in security.test.ts, servers in servers-tags-info.test.ts,
// callbacks in callbacks-webhooks-links.test.ts, vendor extensions in extensions.test.ts.

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const getPets = (o: Record<string, unknown> = {}) => oas({ "/pets": { get: op(o) } })

// an operation's own fields are documentation: the description names the operation (METHOD and path); ISSUE-81 (fixed)
// (P8-OAS)

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-OP-001",
    title: "operation removed",
    before: "GET /pets and DELETE /pets",
    after: "GET /pets only",
    rationale: "a client calling DELETE /pets gets 404/405 (consumer viewpoint)",
    annotation: "names the removed operation (method and path)",
    sources: [
      {
        tool: "optic",
        ref: "projects/standard-rulesets/src/breaking-changes/__tests__/breaking-changes.test.ts breaking change ruleset configuration > breaking changes applies a matches function for object extension value mismatch / missing",
      },
      { tool: "oasdiff", ref: "checker/check_api_removed.go api-removed-without-deprecation (TestBreaking_DeletedOp)" },
      { tool: "openapi-diff", ref: "backcompat/PathBCTest::opsDecreased" },
      { tool: "atlassian-openapi-diff", ref: "result-type-finder method.remove" },
      { tool: "libopenapi", ref: "what-changed/model/path_item_test.go TestComparePathItem_V3_RemoveMethods" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-method" },
      { tool: "bench", ref: "oas-petstore P1" },
      { tool: "bench", ref: "oas-github G1" },
    ],
    covers: [
      "oasdiff:api-removed-without-deprecation",
      "optic:breaking-changes::breaking changes ruleset > operation removal",
      "optic:breaking-changes::breaking change ruleset configuration > breaking changes applies a matches function for object extension value mismatch",
      "optic:breaking-changes::breaking change ruleset configuration > breaking changes applies a matches function for object extension value missing",
    ],
    docs: [oas({ "/pets": { get: op(), delete: op() } }), oas({ "/pets": { get: op() } })],
    expect: [{ at: "paths/~1pets/delete", action: "remove", type: breaking, mentions: ["DELETE", "/pets"] }],
  },
  {
    kind: "doc",
    id: "OAS-OP-002",
    title: "operation added",
    before: "GET /pets",
    after: "GET /pets and POST /pets",
    rationale: "existing clients never call the new operation",
    annotation: "names the added operation (method and path)",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_new_endpoint.go endpoint-added (TestApiAdded_DetectsNewPathsAndNewOperations)",
      },
      { tool: "openapi-diff", ref: "backcompat/PathBCTest::changedButCompatible" },
      { tool: "atlassian-openapi-diff", ref: "result-type-finder method.add" },
      { tool: "libopenapi", ref: "what-changed/model/path_item_test.go TestComparePathItem_V3_AddMethods" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-new-method" },
      { tool: "bench", ref: "oas-github G4" },
    ],
    covers: ["oasdiff:endpoint-added"],
    docs: [oas({ "/pets": { get: op() } }), oas({ "/pets": { get: op(), post: op() } })],
    expect: [{ at: "paths/~1pets/post", action: "add", type: nonBreaking, mentions: ["POST", "/pets"] }],
  },
  {
    kind: "doc",
    id: "OAS-OP-003",
    title: "operation method changed",
    before: "GET /pets/search",
    after: "POST /pets/search (same operationId)",
    rationale: "a client sending GET is no longer served; the POST is a new operation for it",
    annotation: "names the removed GET and the added POST with the path",
    sources: [
      { tool: "oasdiff", ref: "diff/diff_test.go TestDiff_ModifiedOperation (GET <-> POST is added + deleted)" },
      { tool: "openapi-changes", ref: "sample-specs petstorev3 regression (get -> post swap)", verdict: "breaking" },
      { tool: "fork", ref: "openapi.diff.test.ts Should compare operations with different paths (operation mode)" },
    ],
    covers: ["oasdiff:api-removed-without-deprecation", "oasdiff:endpoint-added"],
    docs: [
      oas({ "/pets/search": { get: op({ operationId: "searchPets" }) } }),
      oas({ "/pets/search": { post: op({ operationId: "searchPets" }) } }),
    ],
    expect: [
      { at: "paths/~1pets~1search/get", action: "remove", type: breaking, mentions: ["GET /pets/search"] },
      { at: "paths/~1pets~1search/post", action: "add", type: nonBreaking, mentions: ["POST /pets/search"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-OP-004",
    title: "operation moved to another path (same operationId)",
    before: "GET /pets operationId listPets",
    after: "GET /animals operationId listPets",
    rationale: "operations are identified by method and path, not operationId: GET /pets is gone",
    annotation: "names the removed and the added operation",
    sources: [{ tool: "openapi-diff", ref: "PathsDiff.java (operations matched by path + method)" }],
    covers: ["oasdiff:api-path-removed-without-deprecation", "oasdiff:endpoint-added"],
    docs: [
      oas({ "/pets": { get: op({ operationId: "listPets" }) } }),
      oas({ "/animals": { get: op({ operationId: "listPets" }) } }),
    ],
    expect: [
      { at: "paths/~1pets/get", action: "remove", type: breaking, mentions: ["GET /pets"] },
      { at: "paths/~1animals/get", action: "add", type: nonBreaking, mentions: ["GET /animals"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-OP-005",
    title: "less common methods added and removed (HEAD, OPTIONS, TRACE)",
    before: "GET, HEAD and TRACE /pets",
    after: "GET and OPTIONS /pets",
    rationale: "every method of the path item is an operation with the same add / remove semantics",
    annotation: "names each operation with its method",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Path Item Object (get..trace)" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go pathItem.<method>" },
    ],
    covers: ["oasdiff:api-removed-without-deprecation", "oasdiff:endpoint-added"],
    docs: [oas({ "/pets": { get: op(), head: op(), trace: op() } }), oas({ "/pets": { get: op(), options: op() } })],
    expect: [
      { at: "paths/~1pets/head", action: "remove", type: breaking, mentions: ["HEAD /pets"] },
      { at: "paths/~1pets/trace", action: "remove", type: breaking, mentions: ["TRACE /pets"] },
      { at: "paths/~1pets/options", action: "add", type: nonBreaking, mentions: ["OPTIONS /pets"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-OP-006",
    title: "operationId added",
    before: "GET /pets without operationId",
    after: "GET /pets operationId listPets",
    rationale:
      "operationId is not sent on the wire; generated SDK names may change, which oasdiff reports as INFO and libopenapi as breaking",
    annotation: "names the operation and the new operationId",
    sources: [
      { tool: "oasdiff", ref: "checker/check_api_operation_id_updated_test.go TestOperationIdAdded", verdict: "INFO" },
      { tool: "libopenapi", ref: "breaking_rules.go operation.operationId", verdict: "breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-operationId-value" },
    ],
    covers: ["oasdiff:api-operation-id-added"],
    docs: [getPets(), getPets({ operationId: "listPets" })],
    expect: [
      { at: "paths/~1pets/get/operationId", action: "add", type: annotation, mentions: ["GET /pets", "listPets"] },
    ],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-007",
    title: "operationId removed",
    before: "GET /pets operationId listPets",
    after: "GET /pets without operationId",
    rationale: "no request or response changes",
    annotation: "names the operation and the removed operationId",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_operation_id_updated_test.go TestOperationIdRemoved",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "breaking_rules.go operation.operationId", verdict: "breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-operationId-value" },
    ],
    covers: ["oasdiff:api-operation-id-removed"],
    docs: [getPets({ operationId: "listPets" }), getPets()],
    expect: [
      { at: "paths/~1pets/get/operationId", action: "remove", type: annotation, mentions: ["GET /pets", "listPets"] },
    ],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-008",
    title: "operationId changed",
    before: "GET /pets operationId listPets",
    after: "GET /pets operationId listPetsV2",
    rationale:
      "the request and response are unchanged; openapi-diff makes it breaking only behind a flag (incompatible.operation.id.changed, default off)",
    annotation: "names the operation and the new operationId",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_operation_id_updated_test.go TestOperationIdUpdated",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "OperationDiffTest::testOperationIdChanged", verdict: "metadata" },
      { tool: "libopenapi", ref: "breaking_rules.go operation.operationId", verdict: "breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-operationId-value" },
    ],
    covers: ["oasdiff:api-operation-id-removed"],
    docs: [getPets({ operationId: "listPets" }), getPets({ operationId: "listPetsV2" })],
    expect: [
      {
        at: "paths/~1pets/get/operationId",
        action: "replace",
        type: annotation,
        mentions: ["GET /pets", "listPetsV2"],
      },
    ],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-009",
    title: "operation summary added, changed and removed",
    before: "GET /pets summary absent / List pets / List pets",
    after: "GET /pets summary List pets / List all pets / absent",
    rationale: "documentation only",
    annotation: "names the operation and the field",
    sources: [
      { tool: "openapi-diff", ref: "OperationDiffTest::testOperationSummaryChanged", verdict: "metadata" },
      { tool: "libopenapi", ref: "breaking_rules.go operation.summary" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-operation-summary" },
      { tool: "fork", ref: "openapi.classification.test.ts Summary change" },
      { tool: "bench", ref: "oas-petstore P17" },
      { tool: "bench", ref: "oas-github G17" },
    ],
    docs: {
      add: [getPets(), getPets({ summary: "List pets" })],
      replace: [getPets({ summary: "List pets" }), getPets({ summary: "List all pets" })],
      remove: [getPets({ summary: "List pets" }), getPets()],
    },
    expect: {
      add: [{ at: "paths/~1pets/get/summary", action: "add", type: annotation, mentions: ["GET /pets", "summary"] }],
      replace: [
        { at: "paths/~1pets/get/summary", action: "replace", type: annotation, mentions: ["GET /pets", "summary"] },
      ],
      remove: [
        { at: "paths/~1pets/get/summary", action: "remove", type: annotation, mentions: ["GET /pets", "summary"] },
      ],
    },
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-010",
    title: "operation description added, changed and removed",
    before: "GET /pets description absent / one / one",
    after: "GET /pets description one / two / absent",
    rationale: "documentation only",
    annotation: "names the operation and the field",
    sources: [
      { tool: "openapi-diff", ref: "OperationDiffTest::testOperationDescriptionChanged", verdict: "metadata" },
      { tool: "libopenapi", ref: "breaking_rules.go operation.description" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-operation-description" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-operation-description" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-operation-description" },
    ],
    docs: {
      add: [getPets(), getPets({ description: "one" })],
      replace: [getPets({ description: "one" }), getPets({ description: "two" })],
      remove: [getPets({ description: "one" }), getPets()],
    },
    expect: {
      add: [
        { at: "paths/~1pets/get/description", action: "add", type: annotation, mentions: ["GET /pets", "description"] },
      ],
      replace: [
        {
          at: "paths/~1pets/get/description",
          action: "replace",
          type: annotation,
          mentions: ["GET /pets", "description"],
        },
      ],
      remove: [
        {
          at: "paths/~1pets/get/description",
          action: "remove",
          type: annotation,
          mentions: ["GET /pets", "description"],
        },
      ],
    },
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-011",
    title: "tag added to an operation",
    before: "GET /pets tags [pets]",
    after: "GET /pets tags [pets, store]",
    rationale: "tags group operations in documentation; requests and responses are unchanged",
    annotation: "names the operation and the added tag",
    sources: [
      { tool: "oasdiff", ref: "checker/check_api_tag_updated_test.go TestTagAdded", verdict: "INFO" },
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_AddTag" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-tag" },
    ],
    covers: ["oasdiff:api-tag-added"],
    docs: [getPets({ tags: ["pets"] }), getPets({ tags: ["pets", "store"] })],
    expect: [{ at: "paths/~1pets/get/tags/*", action: "add", type: annotation, mentions: ["GET /pets", "store"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-012",
    title: "tag removed from an operation",
    before: "GET /pets tags [pets, store]",
    after: "GET /pets tags [pets]",
    rationale:
      "documentation grouping only (libopenapi flags a removed tag as breaking, oasdiff as INFO); no client request fails",
    annotation: "names the operation and the removed tag",
    sources: [
      { tool: "oasdiff", ref: "checker/check_api_tag_updated_test.go TestTagRemoved", verdict: "INFO" },
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_ModifyTag", verdict: "breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-tag" },
    ],
    covers: ["oasdiff:api-tag-removed"],
    docs: [getPets({ tags: ["pets", "store"] }), getPets({ tags: ["pets"] })],
    expect: [{ at: "paths/~1pets/get/tags/*", action: "remove", type: annotation, mentions: ["GET /pets", "store"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-013",
    title: "operation tags reordered",
    before: "tags [pets, store]",
    after: "tags [store, pets]",
    rationale: "tag order carries no meaning",
    annotation: "no diff",
    sources: [
      { tool: "libopenapi", ref: "operation.go tags (matched by name)" },
      { tool: "asd", ref: "openapi3.rules.ts operation /tags enumMappingResolver" },
    ],
    docs: [getPets({ tags: ["pets", "store"] }), getPets({ tags: ["store", "pets"] })],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-OP-014",
    title: "operation tag renamed",
    before: "tags [pets]",
    after: "tags [animals]",
    rationale: "documentation grouping only; ASD reports the single tag as replaced (other tools as removed + added)",
    annotation: "names the operation, the old and the new tag",
    sources: [
      { tool: "oasdiff", ref: "checker/check_api_tag_updated_test.go TestTagUpdated", verdict: "INFO" },
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_ModifyTag", verdict: "breaking" },
    ],
    covers: ["oasdiff:api-tag-removed", "oasdiff:api-tag-added"],
    docs: [getPets({ tags: ["pets"] }), getPets({ tags: ["animals"] })],
    expect: [{ at: "paths/~1pets/get/tags/*", type: annotation, mentions: ["GET /pets", "pets", "animals"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-015",
    title: "first tag added to an untagged operation",
    before: "GET /pets without tags",
    after: "GET /pets tags [pets]",
    rationale: "documentation grouping only",
    annotation: "names the operation and the tag",
    sources: [
      { tool: "oasdiff", ref: "checker/check_api_tag_updated_test.go TestTagAdded ([] -> [newTag])", verdict: "INFO" },
    ],
    covers: ["oasdiff:api-tag-added"],
    docs: [getPets(), getPets({ tags: ["pets"] })],
    expect: [{ at: "paths/~1pets/get/tags/**", action: "add", type: annotation, mentions: ["GET /pets", "pets"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-016",
    title: "operation externalDocs added, url changed, description changed and removed",
    before: "GET /pets externalDocs absent / url a / description a / present",
    after: "GET /pets externalDocs present / url b / description b / absent",
    rationale: "documentation links only",
    annotation: "names the operation and the external documentation",
    sources: [
      { tool: "libopenapi", ref: "external_docs_test.go TestCompareExternalDocs_*" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-operation-external-doc" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-url-of-operation-external-doc" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-description-of-operation-external-doc" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-operation-external-doc" },
    ],
    docs: {
      add: [getPets(), getPets({ externalDocs: { url: "https://docs.example.com/pets" } })],
      url: [
        getPets({ externalDocs: { url: "https://docs.example.com/a" } }),
        getPets({ externalDocs: { url: "https://docs.example.com/b" } }),
      ],
      description: [
        getPets({ externalDocs: { url: "https://docs.example.com/a", description: "a" } }),
        getPets({ externalDocs: { url: "https://docs.example.com/a", description: "b" } }),
      ],
      remove: [getPets({ externalDocs: { url: "https://docs.example.com/pets" } }), getPets()],
    },
    expect: {
      add: [{ at: "paths/~1pets/get/externalDocs", action: "add", type: annotation, mentions: ["GET /pets"] }],
      url: [
        {
          at: "paths/~1pets/get/externalDocs/url",
          action: "replace",
          type: annotation,
          mentions: ["GET /pets", "https://docs.example.com/b"],
        },
      ],
      description: [
        {
          at: "paths/~1pets/get/externalDocs/description",
          action: "replace",
          type: annotation,
          mentions: ["GET /pets", "externalDocs"],
        },
      ],
      remove: [{ at: "paths/~1pets/get/externalDocs", action: "remove", type: annotation, mentions: ["GET /pets"] }],
    },
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-017",
    title: "two operations swap their summaries",
    before: "GET /pets summary A, DELETE /pets summary B",
    after: "GET /pets summary B, DELETE /pets summary A",
    rationale:
      "operations are matched by method: both operations still exist and only their summaries changed (the fork's operation-mode renames are not ASD semantics)",
    annotation: "names each operation in its summary change",
    sources: [{ tool: "fork", ref: "openapi.classification.test.ts Replace paths with compare operations mode" }],
    docs: [
      oas({ "/pets": { get: op({ summary: "A" }), delete: op({ summary: "B" }) } }),
      oas({ "/pets": { get: op({ summary: "B" }), delete: op({ summary: "A" }) } }),
    ],
    expect: [
      { at: "paths/~1pets/get/summary", action: "replace", type: annotation, mentions: ["GET /pets"] },
      { at: "paths/~1pets/delete/summary", action: "replace", type: annotation, mentions: ["DELETE /pets"] },
    ],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-OP-018",
    title: "operations on a path added and removed at the same time",
    before: "/pets GET and DELETE",
    after: "/pets GET and PATCH",
    rationale: "the DELETE callers break, the PATCH is new, GET is unchanged",
    annotation: "names each operation",
    sources: [{ tool: "openapi-changes", ref: "sample-specs petstorev3 regression (post -> patch)" }],
    covers: ["oasdiff:api-removed-without-deprecation", "oasdiff:endpoint-added"],
    docs: [oas({ "/pets": { get: op(), delete: op() } }), oas({ "/pets": { get: op(), patch: op() } })],
    expect: [
      { at: "paths/~1pets/delete", action: "remove", type: breaking, mentions: ["DELETE /pets"] },
      { at: "paths/~1pets/patch", action: "add", type: nonBreaking, mentions: ["PATCH /pets"] },
    ],
  },
]

runCases("openapi", "operations", cases, import.meta.filename)
