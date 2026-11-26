import { annotation, breaking, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// Paths: path add / remove, template matching (`/pets/{id}` vs `/pets/{petId}`), literal and trailing-slash changes,
// path item `$ref`s and path item metadata. Operation-level changes live in operations.test.ts.

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const pathParam = (name: string, type = "string") => ({ name, in: "path", required: true, schema: { type } })

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-PATH-001",
    title: "path added",
    before: "/pets",
    after: "/pets and /orders (GET)",
    rationale: "existing clients never call the new path, so it cannot break them",
    annotation: "names the added operation (method and path)",
    sources: [
      { tool: "oasdiff", ref: "checker/check_new_endpoint.go endpoint-added" },
      { tool: "openapi-diff", ref: "backcompat/PathsBCTest::changedButCompatible" },
      { tool: "atlassian-openapi-diff", ref: "result-type-finder path.add" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-new-path" },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.1" },
      { tool: "bench", ref: "oas-github G3" },
      { tool: "bench", ref: "oas-petstore P2" },
    ],
    covers: ["oasdiff:endpoint-added"],
    docs: [oas({ "/pets": { get: op() } }), oas({ "/pets": { get: op() }, "/orders": { get: op() } })],
    expect: [{ at: "paths/~1orders/get", action: "add", type: nonBreaking, mentions: ["GET /orders"] }],
  },
  {
    kind: "doc",
    id: "OAS-PATH-002",
    title: "path with several operations added",
    before: "/pets",
    after: "/pets and /orders (GET, POST)",
    rationale: "a new path adds endpoints only; ASD reports one diff per operation, not one for the path item",
    annotation: "one description per added operation, each naming its method and path",
    sources: [
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.1" },
      { tool: "openapi-diff", ref: "OpenApiDiffTest::testNewApi" },
    ],
    covers: ["oasdiff:endpoint-added"],
    docs: [oas({ "/pets": { get: op() } }), oas({ "/pets": { get: op() }, "/orders": { get: op(), post: op() } })],
    expect: [
      { at: "paths/~1orders/get", action: "add", type: nonBreaking, mentions: ["GET /orders"] },
      { at: "paths/~1orders/post", action: "add", type: nonBreaking, mentions: ["POST /orders"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PATH-003",
    title: "path removed (not deprecated)",
    before: "/pets and /orders (GET, POST)",
    after: "/pets",
    rationale: "a client calling GET or POST /orders gets 404 after the change",
    annotation: "one description per removed operation, each naming its method and path",
    sources: [
      {
        tool: "optic",
        ref: "projects/standard-rulesets/src/breaking-changes/__tests__/breaking-changes.test.ts breaking changes ruleset > operation removal",
      },
      { tool: "oasdiff", ref: "checker/check_api_removed.go api-path-removed-without-deprecation" },
      { tool: "openapi-diff", ref: "backcompat/PathsBCTest::decreased" },
      { tool: "atlassian-openapi-diff", ref: "result-type-finder path.remove" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-path" },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.2" },
      { tool: "bench", ref: "oas-github G2" },
    ],
    covers: [
      "oasdiff:api-path-removed-without-deprecation",
      "oasdiff:api-removed-without-deprecation",
      "optic:breaking-changes::breaking changes ruleset > operation removal",
    ],
    docs: [oas({ "/pets": { get: op() }, "/orders": { get: op(), post: op() } }), oas({ "/pets": { get: op() } })],
    expect: [
      { at: "paths/~1orders/get", action: "remove", type: breaking, mentions: ["GET /orders"] },
      { at: "paths/~1orders/post", action: "remove", type: breaking, mentions: ["POST /orders"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PATH-004",
    title: "path template parameter renamed",
    before: "/pets/{id} with path parameter id",
    after: "/pets/{petId} with path parameter petId",
    rationale:
      "path parameter names never travel on the wire: the URL template matches exactly the same requests, so ASD maps the path (non-breaking rename, test/openapi/paths-operations.test.ts C2.4)",
    annotation: "the rename names both templates; the parameter rename names the old and the new parameter name",
    sources: [
      { tool: "oasdiff", ref: "diff/paths_test.go path template matching (paths compared by normalized template)" },
      { tool: "openapi-diff", ref: "PathDiffTest::testEqual (no change)", verdict: "no change" },
      { tool: "atlassian-openapi-diff", ref: "normalize-path.js (not detected)", verdict: "no change" },
      { tool: "fork", ref: "openapi.diff.test.ts Update operation parameter name", verdict: "annotation" },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.4" },
      { tool: "bench", ref: "oas-petstore P14", verdict: "annotation (non-breaking accepted)" },
    ],
    docs: [
      oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
      oas({ "/pets/{petId}": { get: op({ parameters: [pathParam("petId")] }) } }),
    ],
    expect: [
      { at: "paths", action: "rename", type: nonBreaking, mentions: ["/pets/{id}", "/pets/{petId}"] },
      {
        at: "paths/~1pets~1{id}/get/parameters/0/name",
        action: "replace",
        type: nonBreaking,
        mentions: ["path parameter", "petId", /`id`|"id"|\bid\b/],
      },
    ],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PATH-005",
    title: "path template parameter renamed with path-level parameters and two operations",
    before: "/pets/{id} (path-level parameter id) GET and PUT",
    after: "/pets/{petId} (path-level parameter petId) GET and PUT",
    rationale: "same requests are matched; the path-level parameter is attributed to every operation",
    annotation: "the path rename names both templates; each parameter rename names old and new name",
    sources: [
      { tool: "fork", ref: "openapi.diff.test.ts Update path item parameter name", verdict: "annotation" },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.5" },
    ],
    docs: [
      oas({ "/pets/{id}": { parameters: [pathParam("id")], get: op(), put: op() } }),
      oas({ "/pets/{petId}": { parameters: [pathParam("petId")], get: op(), put: op() } }),
    ],
    expect: [
      { at: "paths", action: "rename", type: nonBreaking, mentions: ["/pets/{id}", "/pets/{petId}"] },
      {
        at: "paths/~1pets~1{id}/*/parameters/0/name",
        action: "replace",
        type: nonBreaking,
        mentions: ["path parameter", "petId", /\bid\b/],
      },
    ],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PATH-006",
    title: "second template parameter renamed",
    before: "/owners/{ownerId}/pets/{id}",
    after: "/owners/{ownerId}/pets/{petId}",
    rationale: "template parameters are matched by position; only the name of the second one changes",
    annotation: "the path rename names both templates; the parameter rename names old and new name",
    sources: [{ tool: "atlassian-openapi-diff", ref: "normalize-path.js (positional)", verdict: "no change" }],
    docs: [
      oas({ "/owners/{ownerId}/pets/{id}": { get: op({ parameters: [pathParam("ownerId"), pathParam("id")] }) } }),
      oas({
        "/owners/{ownerId}/pets/{petId}": { get: op({ parameters: [pathParam("ownerId"), pathParam("petId")] }) },
      }),
    ],
    expect: [
      {
        at: "paths",
        action: "rename",
        type: nonBreaking,
        mentions: ["/owners/{ownerId}/pets/{id}", "/owners/{ownerId}/pets/{petId}"],
      },
      {
        at: "paths/~1owners~1{ownerId}~1pets~1{id}/get/parameters/1/name",
        action: "replace",
        type: nonBreaking,
        mentions: ["petId", /\bid\b/],
      },
    ],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PATH-007",
    title: "template parameters swapped by position",
    before: "/a/{x}/{y} with x: string, y: integer",
    after: "/a/{y}/{x} with y: string, x: integer",
    rationale:
      "the first segment still takes a string and the second an integer, so the same requests are valid; only the names moved",
    annotation: "the path rename names both templates; each parameter rename names old and new name",
    sources: [{ tool: "atlassian-openapi-diff", ref: "normalize-path.js (template reorder not detected)" }],
    docs: [
      oas({ "/a/{x}/{y}": { get: op({ parameters: [pathParam("x"), pathParam("y", "integer")] }) } }),
      oas({ "/a/{y}/{x}": { get: op({ parameters: [pathParam("y"), pathParam("x", "integer")] }) } }),
    ],
    expect: [
      { at: "paths", action: "rename", type: nonBreaking, mentions: ["/a/{x}/{y}", "/a/{y}/{x}"] },
      {
        at: "paths/~1a~1{x}~1{y}/get/parameters/*/name",
        action: "replace",
        type: nonBreaking,
        mentions: ["path parameter", /`x`.*`y`|`y`.*`x`/],
      },
    ],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PATH-008",
    title: "template parameter renamed and its type narrowed",
    before: "/pets/{id} with id: string",
    after: "/pets/{petId} with petId: integer",
    rationale: "the mapped path parameter now only accepts integers, so a client sending a string id is rejected",
    annotation: "the type change names the path parameter",
    sources: [{ tool: "openapi-diff", ref: "ParameterDiffTest::pathSamePathParamsDiffParamSameAsInPathButSchemaDiff" }],
    docs: [
      oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
      oas({ "/pets/{petId}": { get: op({ parameters: [pathParam("petId", "integer")] }) } }),
    ],
    expect: [
      { at: "paths", action: "rename", type: nonBreaking, mentions: ["/pets/{id}", "/pets/{petId}"] },
      {
        at: "paths/~1pets~1{id}/get/parameters/0/name",
        action: "replace",
        type: nonBreaking,
        mentions: ["petId", /\bid\b/],
      },
      {
        at: "paths/~1pets~1{id}/get/parameters/0/schema/type",
        action: "replace",
        type: breaking,
        mentions: ["path parameter `petId`"],
      },
    ],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PATH-009",
    title: "path template renamed and an operation removed",
    before: "/pets/{id} GET and PUT",
    after: "/pets/{petId} GET",
    rationale: "the mapped path keeps GET; PUT is gone, which breaks its callers",
    annotation: "the removed operation is named with its method and path",
    sources: [{ tool: "asd", ref: "probe 2.0.0 (path mapping combined with operation removal)" }],
    docs: [
      oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }), put: op({ parameters: [pathParam("id")] }) } }),
      oas({ "/pets/{petId}": { get: op({ parameters: [pathParam("petId")] }) } }),
    ],
    expect: [
      { at: "paths", action: "rename", type: nonBreaking, mentions: ["/pets/{id}", "/pets/{petId}"] },
      { at: "paths/~1pets~1{id}/put", action: "remove", type: breaking, mentions: ["PUT /pets/"] },
      {
        at: "paths/~1pets~1{id}/get/parameters/0/name",
        action: "replace",
        type: nonBreaking,
        mentions: ["petId", /\bid\b/],
      },
    ],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PATH-010",
    title: "trailing slash added to a path",
    before: "/pets",
    after: "/pets/",
    rationale: "RFC 3986 treats /pets and /pets/ as different resources; servers commonly route them differently",
    annotation: "names the removed GET /pets and the added GET /pets/",
    sources: [
      { tool: "openapi-diff", ref: "PathsDiff.java (literal comparison)" },
      { tool: "fork", ref: "openapi.pathAndMethodMapping.test.ts Path with and without trailing slash are different" },
    ],
    covers: ["oasdiff:api-path-removed-without-deprecation", "oasdiff:endpoint-added"],
    docs: [oas({ "/pets": { get: op() } }), oas({ "/pets/": { get: op() } })],
    expect: [
      { at: "paths/~1pets/get", action: "remove", type: breaking, mentions: ["GET /pets"] },
      { at: "paths/~1pets~1/get", action: "add", type: nonBreaking, mentions: ["GET /pets/"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PATH-011",
    title: "literal path segment changed",
    before: "/pets/{id}",
    after: "/animals/{id}",
    rationale: "requests to /pets/... are no longer served",
    annotation: "names the removed and the added operation",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "result-type-finder path.remove + path.add" },
      { tool: "openapi-diff", ref: "PathsDiff.java" },
    ],
    covers: ["oasdiff:api-path-removed-without-deprecation"],
    docs: [
      oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
      oas({ "/animals/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
    ],
    expect: [
      { at: "paths/~1pets~1{id}/get", action: "remove", type: breaking, mentions: ["GET /pets/{id}"] },
      { at: "paths/~1animals~1{id}/get", action: "add", type: nonBreaking, mentions: ["GET /animals/{id}"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PATH-012",
    title: "literal segment replaced by a template",
    before: "/pets/mine",
    after: "/pets/{id}",
    rationale:
      "a template is not the same path as a literal (the literal may have had its own semantics); tools report remove + add",
    annotation: "names the removed and the added operation",
    sources: [{ tool: "fork", ref: "openapi.diff.test.ts Add parameter (/path1/qwe -> /path1/{param1})" }],
    docs: [oas({ "/pets/mine": { get: op() } }), oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } })],
    expect: [
      { at: "paths/~1pets~1mine/get", action: "remove", type: breaking, mentions: ["GET /pets/mine"] },
      { at: "paths/~1pets~1{id}/get", action: "add", type: nonBreaking, mentions: ["GET /pets/{id}"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PATH-013",
    title: "path case changed",
    before: "/Pets",
    after: "/pets",
    rationale: "path matching is case-sensitive (RFC 3986), so /Pets requests are no longer routed",
    annotation: "names the removed and the added operation",
    sources: [{ tool: "asd", ref: "probe 2.0.0" }],
    docs: [oas({ "/Pets": { get: op() } }), oas({ "/pets": { get: op() } })],
    expect: [
      { at: "paths/~1Pets/get", action: "remove", type: breaking, mentions: ["GET /Pets"] },
      { at: "paths/~1pets/get", action: "add", type: nonBreaking, mentions: ["GET /pets"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PATH-014",
    title: "sub-resource path added next to an existing one",
    before: "/pets/{id}",
    after: "/pets/{id} and /pets/{id}/status",
    rationale: "an additional endpoint under an existing prefix does not change the existing one",
    annotation: "names the added operation",
    sources: [{ tool: "openapi-diff", ref: "backcompat/PathsBCTest::changedButCompatible" }],
    covers: ["oasdiff:endpoint-added"],
    docs: [
      oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
      oas({
        "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) },
        "/pets/{id}/status": { get: op({ parameters: [pathParam("id")] }) },
      }),
    ],
    expect: [
      { at: "paths/~1pets~1{id}~1status/get", action: "add", type: nonBreaking, mentions: ["GET /pets/{id}/status"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PATH-015",
    title: "paths reordered in the document",
    before: "/a then /b",
    after: "/b then /a",
    rationale: "the Paths object is a map: key order carries no meaning",
    annotation: "no diff",
    sources: [{ tool: "fork", ref: "openapi.classification.test.ts Replace paths (reorder)", verdict: "no diffs" }],
    docs: [oas({ "/a": { get: op() }, "/b": { get: op() } }), oas({ "/b": { get: op() }, "/a": { get: op() } })],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-PATH-016",
    title: "inline path item replaced by an identical $ref (3.1 components.pathItems)",
    before: "/pets inline GET",
    after: "/pets: $ref #/components/pathItems/Pets (GET)",
    rationale: "the resolved path item is identical, so no client can tell the difference",
    annotation: "no diff",
    sources: [
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/replace-inline-path-item-to-ref",
        verdict: "no diffs",
      },
    ],
    docs: [
      oas({ "/pets": { get: op() } }, { components: { pathItems: { Pets: { get: op() } } } }),
      oas({ "/pets": { $ref: "#/components/pathItems/Pets" } }, { components: { pathItems: { Pets: { get: op() } } } }),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-PATH-017",
    title: "$ref path item replaced by an identical inline path item",
    before: "/pets: $ref #/components/pathItems/Pets",
    after: "/pets inline GET",
    rationale: "the resolved path item is identical",
    annotation: "no diff",
    sources: [
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/replace-ref-path-item-to-inline",
        verdict: "no diffs",
      },
    ],
    docs: [
      oas({ "/pets": { $ref: "#/components/pathItems/Pets" } }, { components: { pathItems: { Pets: { get: op() } } } }),
      oas({ "/pets": { get: op() } }, { components: { pathItems: { Pets: { get: op() } } } }),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-PATH-018",
    title: "operation removed inside a referenced components.pathItems entry",
    before: "/pets: $ref Pets (GET, POST)",
    after: "/pets: $ref Pets (GET)",
    rationale: "POST /pets is gone for every path that references the path item (usage-derived component semantics)",
    annotation: "the usage site names POST /pets; the component site names the path item component and the POST method",
    sources: [
      { tool: "compat-suites", ref: "general-operation-parameters/remove-method-in-path-item" },
      { tool: "fork", ref: "pathItems.rules.test.ts" },
    ],
    covers: ["oasdiff:api-removed-without-deprecation"],
    docs: [
      oas(
        { "/pets": { $ref: "#/components/pathItems/Pets" } },
        { components: { pathItems: { Pets: { get: op(), post: op() } } } },
      ),
      oas({ "/pets": { $ref: "#/components/pathItems/Pets" } }, { components: { pathItems: { Pets: { get: op() } } } }),
    ],
    expect: [
      { at: "paths/~1pets/post", action: "remove", type: breaking, mentions: ["POST /pets"] },
      { at: "components/pathItems/Pets/post", action: "remove", type: breaking, mentions: ["POST", "Pets"] },
    ],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PATH-019",
    title: "operation added inside a referenced components.pathItems entry",
    before: "/pets: $ref Pets (GET)",
    after: "/pets: $ref Pets (GET, POST)",
    rationale: "a new operation on an existing path cannot break existing callers",
    annotation: "the usage site names POST /pets; the component site names the path item component and POST",
    sources: [{ tool: "compat-suites", ref: "general-operation-parameters/add-method-in-path-item" }],
    covers: ["oasdiff:endpoint-added"],
    docs: [
      oas({ "/pets": { $ref: "#/components/pathItems/Pets" } }, { components: { pathItems: { Pets: { get: op() } } } }),
      oas(
        { "/pets": { $ref: "#/components/pathItems/Pets" } },
        { components: { pathItems: { Pets: { get: op(), post: op() } } } },
      ),
    ],
    expect: [
      { at: "paths/~1pets/post", action: "add", type: nonBreaking, mentions: ["POST /pets"] },
      { at: "components/pathItems/Pets/post", action: "add", type: nonBreaking, mentions: ["POST", "Pets"] },
    ],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PATH-020",
    title: "unreferenced components.pathItems entry removed",
    before: "components.pathItems.Unused (GET), not referenced",
    after: "no Unused path item",
    rationale:
      "an unreferenced component is not part of any operation; decision §11.4 makes its diffs unclassified with a description (the fork reports no diff at all)",
    annotation: "names the removed path item component",
    sources: [
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/remove-unused-method-in-path-item",
        verdict: "no diffs",
      },
    ],
    docs: [
      oas({ "/pets": { get: op() } }, { components: { pathItems: { Unused: { get: op() } } } }),
      oas({ "/pets": { get: op() } }, { components: { pathItems: {} } }),
    ],
    expect: [{ at: "components/pathItems/Unused", action: "remove", type: "unclassified", mentions: ["Unused"] }],
  },
  {
    kind: "doc",
    id: "OAS-PATH-021",
    title: "path item summary added",
    before: "/pets without summary",
    after: "/pets summary: Pets",
    rationale: "documentation only",
    annotation: "names the field and the path",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/path_item.go summary" },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.8" },
    ],
    docs: [oas({ "/pets": { get: op() } }), oas({ "/pets": { summary: "Pets", get: op() } })],
    expect: [{ at: "paths/~1pets/summary", action: "add", type: annotation, mentions: ["summary", "/pets"] }],
  },
  {
    kind: "doc",
    id: "OAS-PATH-022",
    title: "path item description changed (reported once, not per operation)",
    before: "/pets description one, GET and POST",
    after: "/pets description two",
    rationale: "documentation only; one change of the path item is one diff",
    annotation: "names the field and the path",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/path_item.go description" },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.8 (ISSUE-32)" },
    ],
    docs: [
      oas({ "/pets": { description: "one", get: op(), post: op() } }),
      oas({ "/pets": { description: "two", get: op(), post: op() } }),
    ],
    expect: [
      { at: "paths/~1pets/description", action: "replace", type: annotation, mentions: ["description", "/pets"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PATH-023",
    title: "server prefix moved from the root server into the paths",
    before: "servers https://api.example.com/v2, path /pets",
    after: "servers https://api.example.com, path /v2/pets",
    rationale:
      "the effective request URL https://api.example.com/v2/pets is unchanged, so existing clients keep working; the fork maps the path and reports only annotations",
    annotation: "the path change names both paths; the server change names both URLs",
    sources: [
      { tool: "fork", ref: "openapi.pathAndMethodMapping.test.ts Prefix moved from root servers to path" },
      { tool: "oasdiff", ref: "diff option --prefix-base / --prefix-revision (manual)" },
    ],
    docs: [
      oas({ "/pets": { get: op() } }, { servers: [{ url: "https://api.example.com/v2" }] }),
      oas({ "/v2/pets": { get: op() } }, { servers: [{ url: "https://api.example.com" }] }),
    ],
    expect: [
      { at: "paths", action: "rename", type: annotation, mentions: ["/pets", "/v2/pets"] },
      {
        at: "servers/0/url",
        action: "replace",
        type: annotation,
        mentions: ["https://api.example.com/v2", "https://api.example.com"],
      },
    ],
    // ISSUE-84 (fixed) (P8a); ISSUE-80 (fixed): detection and classification pass; the description remains (ISSUE-84)
  },
  {
    kind: "doc",
    id: "OAS-PATH-024",
    area: "components",
    title: "all schema components removed together with the paths that used them",
    before: "/pets GET returns $ref Pet; components.schemas { Pet, Unused }",
    after: "paths emptied; components.schemas {}",
    rationale:
      "the operation removal is breaking; Pet was used by a response in the before document, so its removal takes that usage's semantics, while the never-referenced Unused is unclassified (decision §11.4; oasdiff api-schema-removed INFO)",
    annotation: "names the removed operation and each removed schema component",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_breaking_test.go TestBreaking_SchemaRemoved api-schema-removed",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:api-schema-removed", "oasdiff:api-path-removed-without-deprecation"],
    docs: [
      oas(
        {
          "/pets": {
            get: {
              responses: {
                200: {
                  description: "ok",
                  content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
                },
              },
            },
          },
        },
        { components: { schemas: { Pet: { type: "object" }, Unused: { type: "string" } } } },
      ),
      oas({}, { components: { schemas: {} } }),
    ],
    expect: [
      { at: "paths/~1pets/get", action: "remove", type: breaking, mentions: ["GET /pets"] },
      { at: "components/schemas/Pet", action: "remove", type: breaking, mentions: ["Pet"] },
      { at: "components/schemas/Unused", action: "remove", type: "unclassified", mentions: ["Unused"] },
    ],
  },
]

runCases("openapi", "paths", cases, import.meta.filename)
