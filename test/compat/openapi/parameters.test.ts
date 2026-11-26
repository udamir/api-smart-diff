import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// Parameters (structural attributes): add / remove, required, in / name, header case, path-level vs operation-level,
// style / explode / allowReserved / allowEmptyValue, content instead of schema, description, example(s), $ref
// parameters, header parameter object properties. Schema keywords inside parameter schemas are covered by the JSON
// Schema family through the `param` placement; deprecation lives in deprecation.test.ts, 3.2 `querystring` in
// versions.test.ts, vendor extensions in extensions.test.ts.

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const withParams = (...parameters: unknown[]) => oas({ "/pets": { get: op({ parameters }) } })
const str = { type: "string" }
const arr = { type: "array", items: { type: "string" } }
const query = (name: string, o: Record<string, unknown> = {}) => ({ name, in: "query", schema: str, ...o })
const header = (name: string, o: Record<string, unknown> = {}) => ({ name, in: "header", schema: str, ...o })
const cookie = (name: string, o: Record<string, unknown> = {}) => ({ name, in: "cookie", schema: str, ...o })
const pathParam = (name: string, o: Record<string, unknown> = {}) => ({
  name,
  in: "path",
  required: true,
  schema: str,
  ...o,
})
const P0 = "paths/~1pets/get/parameters/0"
const P1 = "paths/~1pets/get/parameters/1"

// classified parameter keywords (style, explode, allowReserved, ...) and example entries name the change on the parameter
// with its values (ISSUE-82 (fixed) (P8-OAS))

// POLICY-10 decided (a): a definition without effect on the wire (the spec says it SHALL be ignored or applies only
// elsewhere) is an annotation

const cases: CompatCase[] = [
  // ---------------------------------------------------------------------------------------------------------------
  // add / remove
  {
    kind: "doc",
    id: "OAS-PARAM-001",
    title: "optional query parameter added",
    before: "GET /pets without parameters",
    after: "GET /pets optional query parameter limit",
    rationale: "existing clients that do not send limit keep working",
    annotation: "names the added query parameter",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_new_request_non_path_parameter_test.go new-optional-request-parameter",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "backcompat/ParametersBCTest::changedButCompatible" },
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_AddParam" },
      { tool: "compat-suites", ref: "operation-parameters/add-operation-parameter" },
      { tool: "fork", ref: "openapi.classification.test.ts Addition of a non-required query parameter" },
      { tool: "bench", ref: "oas-petstore P9" },
      { tool: "bench", ref: "oas-github G8" },
    ],
    covers: ["oasdiff:new-optional-request-parameter"],
    docs: [withParams(), withParams(query("limit"))],
    expect: [{ at: P0, action: "add", type: nonBreaking, mentions: ["query parameter `limit`"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-002",
    title: "required query parameter added",
    before: "GET /pets without parameters",
    after: "GET /pets required query parameter token",
    rationale: "an existing client does not send token and is rejected",
    annotation: "names the added required query parameter",
    sources: [
      {
        tool: "optic",
        ref: "projects/standard-rulesets/src/breaking-changes/__tests__/parameter-requirement-breaking-changes.test.ts required %p parameter added (query)",
      },
      { tool: "oasdiff", ref: "checker/check_new_request_parameter.go new-required-request-parameter" },
      { tool: "openapi-diff", ref: "backcompat/ParametersBCTest::requiredIncreased" },
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_AddRequiredParam" },
      { tool: "bench", ref: "oas-petstore P8" },
      { tool: "bench", ref: "oas-github G7" },
    ],
    covers: [
      "oasdiff:new-required-request-parameter",
      "optic:parameter-requirement-breaking-changes::breaking changes ruleset - parameter requirement change > required %p parameter added",
    ],
    docs: [withParams(), withParams(query("token", { required: true }))],
    expect: [{ at: P0, action: "add", type: breaking, mentions: ["query parameter `token`"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-003",
    title: "required header parameter added",
    before: "GET /pets without parameters",
    after: "GET /pets required header X-Tenant",
    rationale: "existing clients do not send the header and are rejected",
    annotation: "names the added header parameter",
    sources: [
      {
        tool: "optic",
        ref: "projects/standard-rulesets/src/breaking-changes/__tests__/parameter-requirement-breaking-changes.test.ts required %p parameter added (header)",
      },
      { tool: "oasdiff", ref: "checker/check_breaking_test.go TestBreaking_NewRequiredHeaderParam" },
    ],
    covers: [
      "oasdiff:new-required-request-parameter",
      "optic:parameter-requirement-breaking-changes::breaking changes ruleset - parameter requirement change > required %p parameter added",
    ],
    docs: [withParams(), withParams(header("X-Tenant", { required: true }))],
    expect: [{ at: P0, action: "add", type: breaking, mentions: ["header parameter `X-Tenant`"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-004",
    title: "optional header and cookie parameters added",
    before: "GET /pets without parameters",
    after: "GET /pets optional header X-Trace and optional cookie csrf-token",
    rationale: "optional inputs do not affect existing clients",
    annotation: "names each added parameter with its location",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_not_breaking_test.go TestBreaking_NewOptionalHeaderParam",
        verdict: "INFO",
      },
      { tool: "oasdiff", ref: "check_new_request_non_path_parameter_test.go (cookie csrf-token)", verdict: "INFO" },
    ],
    covers: ["oasdiff:new-optional-request-parameter"],
    docs: [withParams(), withParams(header("X-Trace"), cookie("csrf-token"))],
    expect: [
      { at: P0, action: "add", type: nonBreaking, mentions: ["header parameter `X-Trace`"] },
      { at: P1, action: "add", type: nonBreaking, mentions: ["cookie parameter `csrf-token`"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-005",
    title: "required cookie parameter added",
    before: "GET /pets without parameters",
    after: "GET /pets required cookie session",
    rationale: "existing clients do not send the cookie and are rejected",
    annotation: "names the added cookie parameter",
    sources: [
      {
        tool: "optic",
        ref: "projects/standard-rulesets/src/breaking-changes/__tests__/parameter-requirement-breaking-changes.test.ts required %p parameter added (cookie)",
      },
      { tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.17" },
    ],
    covers: [
      "oasdiff:new-required-request-parameter",
      "optic:parameter-requirement-breaking-changes::breaking changes ruleset - parameter requirement change > required %p parameter added",
    ],
    docs: [withParams(), withParams(cookie("session", { required: true }))],
    expect: [{ at: P0, action: "add", type: breaking, mentions: ["cookie parameter `session`"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-006",
    title: "required parameter with a schema default added",
    before: "GET /pets without parameters",
    after: "GET /pets required query parameter sort with default name",
    rationale:
      "the server applies the default when the parameter is absent, so existing calls stay valid (test/openapi/parameters-edge-cases.test.ts C3.1)",
    annotation: "names the added query parameter",
    sources: [{ tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.1" }],
    docs: [withParams(), withParams(query("sort", { required: true, schema: { type: "string", default: "name" } }))],
    expect: [{ at: P0, action: "add", type: nonBreaking, mentions: ["query parameter `sort`"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-007",
    title: "several parameters added, one of them required",
    before: "GET /pets without parameters",
    after: "GET /pets optional query a, required query b",
    rationale: "each parameter is classified on its own; the required one breaks existing calls",
    annotation: "names each parameter",
    sources: [{ tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_AddParams" }],
    covers: ["oasdiff:new-optional-request-parameter", "oasdiff:new-required-request-parameter"],
    docs: [withParams(), withParams(query("a"), query("b", { required: true }))],
    expect: [
      { at: P0, action: "add", type: nonBreaking, mentions: ["query parameter `a`"] },
      { at: P1, action: "add", type: breaking, mentions: ["query parameter `b`"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-008",
    title: "parameter removed (query, header, cookie)",
    before: "GET /pets with an optional query / header / cookie parameter",
    after: "GET /pets without it",
    rationale:
      "clients sending the parameter lose its effect (or are rejected by strict servers); ASD and openapi-diff / libopenapi classify the removal as breaking, oasdiff as WARN (test/openapi/parameters-edge-cases.test.ts C3.2)",
    annotation: "names the removed parameter with its location",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_removed_test.go TestBreaking_DeletedParameter",
        verdict: "WARN",
      },
      { tool: "openapi-diff", ref: "backcompat/ParametersBCTest::decreased" },
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_RemoveParam" },
      { tool: "compat-suites", ref: "operation-parameters/remove-operation-parameter" },
      { tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.2" },
    ],
    covers: ["oasdiff:request-parameter-removed"],
    docs: {
      query: [withParams(query("limit")), withParams()],
      header: [withParams(header("X-Trace")), withParams()],
      cookie: [withParams(cookie("session")), withParams()],
    },
    expect: {
      query: [{ at: P0, action: "remove", type: breaking, mentions: ["query parameter `limit`"] }],
      header: [{ at: P0, action: "remove", type: breaking, mentions: ["header parameter `X-Trace`"] }],
      cookie: [{ at: P0, action: "remove", type: breaking, mentions: ["cookie parameter `session`"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-PARAM-009",
    title: "one of two same-named parameters in different locations removed",
    before: "query id and header id",
    after: "header id",
    rationale: "parameters are identified by name and location; only the query one is gone",
    annotation: "names the removed query parameter",
    sources: [
      { tool: "libopenapi", ref: "operation.go (params matched by name only; collision)", verdict: "not detected" },
    ],
    covers: ["oasdiff:request-parameter-removed"],
    docs: [withParams(query("id"), header("id")), withParams(header("id"))],
    expect: [{ at: P0, action: "remove", type: breaking, mentions: ["query parameter `id`"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-010",
    title: "parameters reordered",
    before: "query a, query b",
    after: "query b, query a",
    rationale: "parameters are matched by name and location, not by position",
    annotation: "no diff",
    sources: [{ tool: "openapi-diff", ref: "ParametersDiff.same() (name + in)" }],
    docs: [withParams(query("a"), query("b")), withParams(query("b"), query("a"))],
    expect: [],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // required
  {
    kind: "doc",
    id: "OAS-PARAM-011",
    title: "query parameter became required",
    before: "optional query parameter status",
    after: "required query parameter status",
    rationale: "existing calls without status are rejected",
    annotation: "names the parameter and the required status",
    sources: [
      {
        tool: "optic",
        ref: "projects/standard-rulesets/src/breaking-changes/__tests__/parameter-requirement-breaking-changes.test.ts %p parameter optional to required (query)",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_required_value_updated.go request-parameter-became-required",
      },
      { tool: "openapi-diff", ref: "backcompat/ParameterBCTest::requiredIncreased" },
      { tool: "libopenapi", ref: "parameter_test.go TestCompareParameters_V3_OptionalToRequired" },
      { tool: "compat-suites", ref: "operation-parameters/mark-parameter-as-required" },
      { tool: "bench", ref: "oas-github G6" },
    ],
    covers: [
      "oasdiff:request-parameter-became-required",
      "optic:parameter-requirement-breaking-changes::breaking changes ruleset - parameter requirement change > %p parameter optional to required",
    ],
    docs: {
      absent: [withParams(query("status")), withParams(query("status", { required: true }))],
      false: [withParams(query("status", { required: false })), withParams(query("status", { required: true }))],
    },
    expect: [{ at: `${P0}/required`, type: breaking, mentions: ["query parameter `status`", "required"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-012",
    title: "header parameter became required",
    before: "optional header X-Network-Policy",
    after: "required header X-Network-Policy",
    rationale: "existing calls without the header are rejected",
    annotation: "names the header parameter and the required status",
    sources: [
      {
        tool: "optic",
        ref: "projects/standard-rulesets/src/breaking-changes/__tests__/parameter-requirement-breaking-changes.test.ts %p parameter optional to required (header)",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_required_value_updated_test.go TestBreaking_HeaderParamBecameRequired",
      },
    ],
    covers: [
      "oasdiff:request-parameter-became-required",
      "optic:parameter-requirement-breaking-changes::breaking changes ruleset - parameter requirement change > %p parameter optional to required",
    ],
    docs: [withParams(header("X-Network-Policy")), withParams(header("X-Network-Policy", { required: true }))],
    expect: [{ at: `${P0}/required`, type: breaking, mentions: ["header parameter `X-Network-Policy`", "required"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-013",
    title: "parameter became optional",
    before: "required query parameter status",
    after: "optional query parameter status (required absent / false)",
    rationale: "clients that send it keep working",
    annotation: "names the parameter and the required status",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_required_value_updated_test.go TestBreaking_HeaderParamBecameOptional",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "parameter_test.go TestCompareParameters_V3_RequiredToOptional", verdict: "breaking" },
      { tool: "compat-suites", ref: "operation-parameters/mark-parameter-as-optional" },
    ],
    covers: ["oasdiff:request-parameter-became-optional"],
    docs: {
      absent: [withParams(query("status", { required: true })), withParams(query("status"))],
      false: [withParams(query("status", { required: true })), withParams(query("status", { required: false }))],
    },
    expect: [{ at: `${P0}/required`, type: nonBreaking, mentions: ["query parameter `status`", "required"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-014",
    title: "parameter became required together with a default",
    before: "optional query parameter sort with default name",
    after: "required query parameter sort with default name",
    rationale:
      "the default still applies to calls without the parameter (test/openapi/parameters-edge-cases.test.ts C3.3b)",
    annotation: "names the parameter and the required status",
    sources: [{ tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.3b" }],
    docs: [
      withParams(query("sort", { schema: { type: "string", default: "name" } })),
      withParams(query("sort", { required: true, schema: { type: "string", default: "name" } })),
    ],
    expect: [{ at: `${P0}/required`, type: nonBreaking, mentions: ["query parameter `sort`", "required"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-015",
    title:
      "explicit default values added (required false, deprecated false, allowEmptyValue false, allowReserved false)",
    before: "query parameter without the fields",
    after: "the same parameter with the fields set to their default false",
    rationale: "an explicit default is the same parameter definition",
    annotation: "no diff",
    sources: [
      { tool: "compat-suites", ref: "operation-parameters/add-required-attribute-with-default-value-for-parameter" },
      { tool: "compat-suites", ref: "operation-parameters/add-deprecated-attribute-with-default-value-for-parameter" },
      {
        tool: "compat-suites",
        ref: "operation-parameters/add-allowEmptyValue-attribute-with-default-value-for-parameter",
      },
      {
        tool: "compat-suites",
        ref: "operation-parameters/add-allowReserved-attribute-with-default-value-for-query-parameter",
      },
    ],
    docs: {
      required: [withParams(query("q")), withParams(query("q", { required: false }))],
      deprecated: [withParams(query("q")), withParams(query("q", { deprecated: false }))],
      allowEmptyValue: [withParams(query("q")), withParams(query("q", { allowEmptyValue: false }))],
      allowReserved: [withParams(query("q")), withParams(query("q", { allowReserved: false }))],
    },
    expect: [],
    // ISSUE-70 (fixed)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // in / name
  {
    kind: "doc",
    id: "OAS-PARAM-016",
    title: "parameter location changed",
    before: "query parameter offset",
    after: "header (or cookie) parameter offset",
    rationale: "clients still send offset in the query string, where it is no longer read",
    annotation: "names the removed and the added parameter with their locations",
    sources: [
      { tool: "openapi-diff", ref: "ParametersDiff.same() (in changed = removed + added)" },
      { tool: "libopenapi", ref: "parameter.go parameter.in", verdict: "breaking" },
      { tool: "compat-suites", ref: "operation-parameters/update-parameter-type (query -> cookie)" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-in-inline" },
      { tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.4" },
    ],
    covers: ["oasdiff:request-parameter-removed", "oasdiff:new-optional-request-parameter"],
    docs: {
      header: [withParams(query("offset")), withParams(header("offset"))],
      cookie: [withParams(query("offset")), withParams(cookie("offset"))],
    },
    expect: {
      header: [
        { at: P0, action: "remove", type: breaking, mentions: ["query parameter `offset`"] },
        { at: P0, action: "add", type: nonBreaking, mentions: ["header parameter `offset`"] },
      ],
      cookie: [
        { at: P0, action: "remove", type: breaking, mentions: ["query parameter `offset`"] },
        { at: P0, action: "add", type: nonBreaking, mentions: ["cookie parameter `offset`"] },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-PARAM-017",
    title: "optional query parameter renamed",
    before: "query parameter per_page",
    after: "query parameter perPage",
    rationale:
      "the old name is no longer read: clients sending per_page silently lose paging (bench G5 accepts risky; ASD reports removal + addition)",
    annotation: "names the removed and the added parameter",
    sources: [
      { tool: "openapi-diff", ref: "ParameterDiffTest::issue488RenameParameterAddAndRemoveParameterReturnFalse" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-name-inline" },
      { tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.5" },
      { tool: "bench", ref: "oas-github G5", verdict: "risky accepted" },
    ],
    covers: ["oasdiff:request-parameter-removed", "oasdiff:new-optional-request-parameter"],
    docs: [withParams(query("per_page")), withParams(query("perPage"))],
    expect: [
      { at: P0, action: "remove", type: breaking, mentions: ["query parameter `per_page`"] },
      { at: P0, action: "add", type: nonBreaking, mentions: ["query parameter `perPage`"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-018",
    title: "header parameter name changed only in case",
    before: "header X-Request-Id",
    after: "header x-request-id",
    rationale: "HTTP header field names are case-insensitive (RFC 9110 §5.1): the same header is sent and read",
    annotation: "no diff, or an annotation naming the header",
    sources: [
      { tool: "oasdiff", ref: "(no handling, no test for header param name case)" },
      { tool: "asd", ref: "openapi3.mapping.ts paramMappingResolver (exact name match)" },
    ],
    docs: [withParams(header("X-Request-Id")), withParams(header("x-request-id"))],
    expect: [{ at: `${P0}/**`, type: annotation, optional: true, mentions: ["x-request-id"] }],
    // ISSUE-74 (fixed)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // path-level parameters
  {
    kind: "doc",
    id: "OAS-PARAM-019",
    title: "optional path-level parameter added to a path with two operations",
    before: "/pets GET and POST",
    after: "/pets with path-level optional query parameter debug",
    rationale: "the parameter applies to every operation of the path; optional inputs do not break callers",
    annotation: "one description per operation naming the parameter",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_new_request_non_path_default_parameter_test.go new-optional-request-default-parameter-to-existing-path",
        verdict: "INFO",
      },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.5" },
    ],
    covers: ["oasdiff:new-optional-request-default-parameter-to-existing-path"],
    docs: [
      oas({ "/pets": { get: op(), post: op() } }),
      oas({ "/pets": { parameters: [query("debug")], get: op(), post: op() } }),
    ],
    expect: [
      {
        at: ["paths/~1pets/get/parameters/0", "paths/~1pets/post/parameters/0"],
        action: "add",
        type: nonBreaking,
        mentions: ["query parameter `debug`"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-020",
    title: "required path-level parameter added",
    before: "/pets GET and POST",
    after: "/pets with path-level required header X-Version",
    rationale: "every operation of the path now rejects calls without the header",
    annotation: "one description per operation naming the parameter",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_new_request_non_path_default_parameter_test.go new-required-request-default-parameter-to-existing-path",
      },
    ],
    covers: ["oasdiff:new-required-request-default-parameter-to-existing-path"],
    docs: [
      oas({ "/pets": { get: op(), post: op() } }),
      oas({ "/pets": { parameters: [header("X-Version", { required: true })], get: op(), post: op() } }),
    ],
    expect: [
      {
        at: ["paths/~1pets/get/parameters/0", "paths/~1pets/post/parameters/0"],
        action: "add",
        type: breaking,
        mentions: ["header parameter `X-Version`"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-021",
    title: "path-level parameter removed",
    before: "/pets with path-level query parameter debug",
    after: "/pets without it",
    rationale: "every operation loses the parameter",
    annotation: "one description per operation naming the parameter",
    sources: [
      { tool: "oasdiff", ref: "diff/diff_test.go TestParamDeletedFromPathItem", verdict: "no checker rule (#1163)" },
      { tool: "libopenapi", ref: "path_item_test.go TestComparePathItem_V3_RemoveParams" },
    ],
    covers: ["oasdiff:request-parameter-removed"],
    docs: [
      oas({ "/pets": { parameters: [query("debug")], get: op(), post: op() } }),
      oas({ "/pets": { get: op(), post: op() } }),
    ],
    expect: [
      {
        at: ["paths/~1pets/get/parameters/0", "paths/~1pets/post/parameters/0"],
        action: "remove",
        type: breaking,
        mentions: ["query parameter `debug`"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-022",
    title: "parameter moved from path level to operation level",
    before: "/pets path-level query parameter limit, GET",
    after: "/pets GET with operation-level query parameter limit",
    rationale: "the effective parameter list of GET is unchanged",
    annotation: "no diff",
    sources: [
      { tool: "oasdiff", ref: "diff/diff_test.go TestDiff_CommonParamsMoved (WithFlattenParams)", verdict: "no diff" },
    ],
    docs: [
      oas({ "/pets": { parameters: [query("limit")], get: op() } }),
      oas({ "/pets": { get: op({ parameters: [query("limit")] }) } }),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-023",
    title: "operation overrides a path-level parameter and makes it required",
    before: "/pets path-level optional query limit",
    after: "/pets path-level optional limit, GET overrides it with required limit",
    rationale:
      "an operation parameter with the same name and location replaces the path-level one, so GET now requires it",
    annotation: "names the parameter and the required status",
    sources: [{ tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.6" }],
    covers: ["oasdiff:request-parameter-became-required"],
    docs: [
      oas({ "/pets": { parameters: [query("limit")], get: op() } }),
      oas({ "/pets": { parameters: [query("limit")], get: op({ parameters: [query("limit", { required: true })] }) } }),
    ],
    expect: [{ at: `${P0}/required`, type: breaking, mentions: ["query parameter `limit`", "required"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-024",
    title: "path parameter declared for an existing template variable",
    before: "/pets/{petId} GET without a parameter object (template variable undeclared)",
    after: "/pets/{petId} GET with path parameter petId",
    rationale:
      "oasdiff treats the new required path parameter as breaking; a required parameter without default is breaking on add",
    annotation: "names the path parameter",
    sources: [
      { tool: "oasdiff", ref: "checker/check_breaking_test.go TestBreaking_NewPathParam new-request-path-parameter" },
    ],
    covers: ["oasdiff:new-request-path-parameter"],
    docs: [
      oas({ "/pets/{petId}": { get: op() } }),
      oas({ "/pets/{petId}": { get: op({ parameters: [pathParam("petId")] }) } }),
    ],
    expect: [
      {
        at: "paths/~1pets~1{petId}/get/parameters/0",
        action: "add",
        type: breaking,
        mentions: ["path parameter `petId`"],
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // serialization: style / explode / allowReserved / allowEmptyValue
  {
    kind: "doc",
    id: "OAS-PARAM-025",
    title: "query parameter style changed",
    before: "array query parameter tags (style form)",
    after: "style pipeDelimited",
    rationale: "tags=a&tags=b is no longer parsed the same as tags=a|b, so existing calls are misread",
    annotation: "names the parameter, the style and the new value",
    sources: [
      { tool: "openapi-diff", ref: "backcompat/ParameterBCTest::styleChanged" },
      { tool: "libopenapi", ref: "breaking_rules.go parameter.style", verdict: "non-breaking" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-style-inline" },
      { tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.10" },
    ],
    docs: [
      withParams(query("tags", { schema: arr })),
      withParams(query("tags", { style: "pipeDelimited", schema: arr })),
    ],
    expect: [{ at: `${P0}/style`, type: breaking, mentions: ["query parameter `tags`", "style", "pipeDelimited"] }],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-026",
    title: "path parameter style changed",
    before: "path parameter id (style simple)",
    after: "style label (or matrix)",
    rationale: "/pets/5 vs /pets/.5 (or ;id=5): existing URLs no longer match",
    annotation: "names the parameter, the style and the new value",
    sources: [{ tool: "compat-suites", ref: "operation-parameters/update-style-for-path-parameter" }],
    docs: {
      label: [
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id", { style: "label" })] }) } }),
      ],
      matrix: [
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id", { style: "simple" })] }) } }),
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id", { style: "matrix" })] }) } }),
      ],
    },
    expect: {
      label: [
        {
          at: "paths/~1pets~1{id}/get/parameters/0/style",
          type: breaking,
          mentions: ["path parameter `id`", "style", "label"],
        },
      ],
      matrix: [
        {
          at: "paths/~1pets~1{id}/get/parameters/0/style",
          type: breaking,
          mentions: ["path parameter `id`", "style", "matrix"],
        },
      ],
    },
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-027",
    title: "object query parameter switched to deepObject style",
    before: "object query parameter filter (style form)",
    after: "style deepObject",
    rationale: "name=x&age=1 vs filter[name]=x&filter[age]=1: existing calls are misread",
    annotation: "names the parameter, the style and the new value",
    sources: [{ tool: "openapi-diff", ref: "backcompat/ParameterBCTest::styleChanged" }],
    docs: [
      withParams(query("filter", { schema: { type: "object" } })),
      withParams(query("filter", { style: "deepObject", schema: { type: "object" } })),
    ],
    expect: [{ at: `${P0}/style`, type: breaking, mentions: ["query parameter `filter`", "style", "deepObject"] }],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-028",
    title: "default style or explode made explicit",
    before: "parameters without style / explode",
    after: "the same parameters with their default style (and explode)",
    rationale: "an explicit default is the same serialization",
    annotation: "no diff",
    sources: [
      { tool: "compat-suites", ref: "operation-parameters/add-default-style-for-query-parameter" },
      { tool: "compat-suites", ref: "operation-parameters/add-default-style-for-path-parameter" },
      { tool: "compat-suites", ref: "operation-parameters/add-default-style-for-header-parameter" },
      { tool: "compat-suites", ref: "operation-parameters/add-default-style-for-cookie-parameter" },
      { tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.12" },
    ],
    docs: {
      query: [withParams(query("q")), withParams(query("q", { style: "form", explode: true }))],
      header: [withParams(header("X-A")), withParams(header("X-A", { style: "simple", explode: false }))],
      cookie: [withParams(cookie("c")), withParams(cookie("c", { style: "form" }))],
      path: [
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id", { style: "simple" })] }) } }),
      ],
    },
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-029",
    title: "explode changed on a form-style array query parameter",
    before: "array query parameter tags (explode true by default)",
    after: "explode false",
    rationale: "tags=a&tags=b becomes tags=a,b: existing calls are misread",
    annotation: "names the parameter and explode",
    sources: [
      { tool: "openapi-diff", ref: "backcompat/ParameterBCTest::explodeChanged" },
      { tool: "oasdiff", ref: "diff/diff_test.go TestDiff_ModifiedParam (ExplodeDiff, no checker rule #1164)" },
      { tool: "libopenapi", ref: "breaking_rules.go parameter.explode", verdict: "non-breaking" },
      { tool: "compat-suites", ref: "operation-parameters/mark-array-parameter-with-form-style-as-not-exploded" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-explode-inline" },
      { tool: "bench", ref: "oas-petstore P13" },
    ],
    docs: [withParams(query("tags", { schema: arr })), withParams(query("tags", { explode: false, schema: arr }))],
    expect: [{ at: `${P0}/explode`, type: breaking, mentions: ["query parameter `tags`", "explode"] }],
    // ISSUE-82 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-030",
    title: "explode changed on a spaceDelimited array query parameter",
    before: "array query parameter tags style spaceDelimited (explode false by default)",
    after: "explode true",
    rationale: "the serialization of the array changes, so existing calls are misread",
    annotation: "names the parameter and explode",
    sources: [
      { tool: "compat-suites", ref: "operation-parameters/mark-array-parameter-with-not-form-style-as-exploded" },
    ],
    docs: [
      withParams(query("tags", { style: "spaceDelimited", schema: arr })),
      withParams(query("tags", { style: "spaceDelimited", explode: true, schema: arr })),
    ],
    expect: [{ at: `${P0}/explode`, type: breaking, mentions: ["query parameter `tags`", "explode"] }],
    // ISSUE-82 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-031",
    title: "explode changed on a primitive query parameter",
    before: "string query parameter q (explode true by default)",
    after: "explode false",
    rationale:
      "explode only affects arrays and objects: q=x is serialized identically, so no client is affected; the fork expects unclassified, ASD reports breaking (proposed: option a)",
    annotation: "names the parameter and explode",
    sources: [
      {
        tool: "compat-suites",
        ref: "operation-parameters/mark-primitive-parameter-as-not-exploded",
        verdict: "unclassified",
      },
    ],
    docs: [withParams(query("q")), withParams(query("q", { explode: false }))],
    expect: [{ at: `${P0}/explode`, type: annotation, mentions: ["query parameter `q`", "explode"] }],
    // ISSUE-133 (fixed); POLICY-10 decided (a)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-032",
    title: "allowReserved enabled and disabled on a query parameter",
    before: "query parameter url without allowReserved / with allowReserved true",
    after: "with allowReserved true / without it",
    rationale:
      "enabling it accepts more raw characters (non-breaking); disabling it makes reserved characters that clients send unencoded invalid (breaking)",
    annotation: "names the parameter and allowReserved",
    sources: [
      { tool: "libopenapi", ref: "breaking_rules.go parameter.allowReserved", verdict: "breaking (all actions)" },
      { tool: "compat-suites", ref: "operation-parameters/allow-reserved-characters-for-query" },
      { tool: "compat-suites", ref: "operation-parameters/prohibit-reserved-characters-for-query" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-allow-reserved-inline" },
    ],
    docs: {
      allow: [withParams(query("url")), withParams(query("url", { allowReserved: true }))],
      prohibit: [withParams(query("url", { allowReserved: true })), withParams(query("url"))],
      false: [withParams(query("url", { allowReserved: true })), withParams(query("url", { allowReserved: false }))],
    },
    expect: {
      allow: [{ at: `${P0}/allowReserved`, type: nonBreaking, mentions: ["query parameter `url`", "allowReserved"] }],
      prohibit: [{ at: `${P0}/allowReserved`, type: breaking, mentions: ["query parameter `url`", "allowReserved"] }],
      false: [{ at: `${P0}/allowReserved`, type: breaking, mentions: ["query parameter `url`", "allowReserved"] }],
    },
    // ISSUE-82 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-033",
    title: "allowEmptyValue enabled and disabled on a query parameter",
    before: "query parameter flag without allowEmptyValue / with allowEmptyValue true",
    after: "with allowEmptyValue true / without it",
    rationale: "disabling it rejects ?flag= that clients may send (breaking); enabling it accepts more (non-breaking)",
    annotation: "names the parameter and allowEmptyValue",
    sources: [
      { tool: "openapi-diff", ref: "backcompat/ParameterBCTest::allowEmptyValueDecreased" },
      { tool: "openapi-diff", ref: "backcompat/ParameterBCTest::changedButCompatible" },
      { tool: "libopenapi", ref: "breaking_rules.go parameter.allowEmptyValue", verdict: "breaking (all actions)" },
      { tool: "compat-suites", ref: "operation-parameters/allow-empty-value-for-query" },
      { tool: "compat-suites", ref: "operation-parameters/prohibit-empty-value-for-query" },
      {
        tool: "fork",
        ref: "human-readable/openapi/parameter-object.test.ts parameter-object-allow-empty-value-inline",
      },
    ],
    docs: {
      allow: [withParams(query("flag")), withParams(query("flag", { allowEmptyValue: true }))],
      prohibit: [withParams(query("flag", { allowEmptyValue: true })), withParams(query("flag"))],
    },
    expect: {
      allow: [
        { at: `${P0}/allowEmptyValue`, type: nonBreaking, mentions: ["query parameter `flag`", "allowEmptyValue"] },
      ],
      prohibit: [
        { at: `${P0}/allowEmptyValue`, type: breaking, mentions: ["query parameter `flag`", "allowEmptyValue"] },
      ],
    },
    // ISSUE-82 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-034",
    title: "allowEmptyValue / allowReserved changed on a path parameter",
    before: "path parameter id with allowEmptyValue (or allowReserved) true",
    after: "without it",
    rationale:
      "both fields apply only to query parameters in 3.0 / 3.1 (allowEmptyValue: 'valid only for query parameters'), so the change has no effect; the fork expects unclassified, ASD classifies it as for a query parameter (proposed: option a)",
    annotation: "names the parameter and the field",
    sources: [
      {
        tool: "compat-suites",
        ref: "operation-parameters/prohibit-empty-value-for-not-query",
        verdict: "unclassified",
      },
      {
        tool: "compat-suites",
        ref: "operation-parameters/prohibit-reserved-characters-for-not-query",
        verdict: "unclassified",
      },
    ],
    docs: {
      allowEmptyValue: [
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id", { allowEmptyValue: true })] }) } }),
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
      ],
      allowReserved: [
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id", { allowReserved: true })] }) } }),
        oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id")] }) } }),
      ],
    },
    expect: [{ at: "paths/~1pets~1{id}/get/parameters/0/*", type: annotation, mentions: ["path parameter `id`"] }],
    // ISSUE-133 (fixed); POLICY-10 decided (a)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-035",
    title: "Accept / Content-Type / Authorization header parameters added and removed",
    before: "GET /pets without (with) a required header parameter Accept / Content-Type / Authorization",
    after: "with (without) it",
    rationale:
      "OAS 3.x: header parameters named Accept, Content-Type or Authorization SHALL be ignored, so the change has no effect on the contract; the fork expects unclassified, ASD classifies them as regular headers (proposed: option a)",
    annotation: "names the header parameter",
    sources: [
      {
        tool: "compat-suites",
        ref: "operation-parameters/add-header-parameter-with-name-accept",
        verdict: "unclassified",
      },
      {
        tool: "compat-suites",
        ref: "operation-parameters/remove-header-parameter-with-name-content-type",
        verdict: "unclassified",
      },
      {
        tool: "compat-suites",
        ref: "operation-parameters/add-header-parameter-with-name-authorization",
        verdict: "unclassified",
      },
      { tool: "fork", ref: "openapi.classification.test.ts Removal of Accept/Content-Type/Authorization headers" },
    ],
    docs: {
      acceptAdded: [withParams(), withParams(header("Accept", { required: true }))],
      contentTypeRemoved: [withParams(header("Content-Type", { required: true })), withParams()],
      authorizationAdded: [withParams(), withParams(header("Authorization", { required: true }))],
    },
    expect: {
      acceptAdded: [{ at: P0, action: "add", type: annotation, mentions: ["header parameter `Accept`"] }],
      contentTypeRemoved: [
        { at: P0, action: "remove", type: annotation, mentions: ["header parameter `Content-Type`"] },
      ],
      authorizationAdded: [{ at: P0, action: "add", type: annotation, mentions: ["header parameter `Authorization`"] }],
    },
    // ISSUE-133 (fixed); POLICY-10 decided (a)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-036",
    title: "exploded object query parameter replaced by the equivalent individual parameters",
    before: "query parameter filter (object {a, b}, style form, explode true)",
    after: "query parameters a and b",
    rationale:
      "both serialize as ?a=..&b=..: the requests on the wire are identical (oasdiff treats them as equivalent), so nothing breaks",
    annotation: "no breaking diff; an annotation may name the representation change",
    sources: [
      {
        tool: "oasdiff",
        ref: "diff/parameters_diff_by_location_test.go TestExplodedParameterEquivalence",
        verdict: "no diff",
      },
    ],
    docs: [
      withParams(
        query("filter", {
          style: "form",
          explode: true,
          schema: { type: "object", properties: { a: str, b: str } },
        }),
      ),
      withParams(query("a"), query("b")),
    ],
    expect: [{ at: "paths/~1pets/get/parameters/**", type: annotation, optional: true }],
    // ISSUE-79 (fixed)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // content instead of schema
  {
    kind: "doc",
    id: "OAS-PARAM-037",
    title: "parameter schema replaced by content",
    before: "query parameter filter with schema string",
    after: "query parameter filter with content application/json schema string",
    rationale:
      "the value is now JSON-encoded (filter=%22x%22 instead of filter=x), so existing calls are misread; the schema removal carries the break",
    annotation: "names the parameter, the removed schema and the added media type",
    sources: [
      { tool: "libopenapi", ref: "parameter_test.go TestCompareParameters_V3_SchemaRemove + _ContentAdded" },
      { tool: "oasdiff", ref: "coverage waiver #1166 (content instead of schema)", verdict: "no rule" },
    ],
    docs: [
      withParams(query("filter")),
      withParams({ name: "filter", in: "query", content: { "application/json": { schema: str } } }),
    ],
    expect: [
      { at: `${P0}/schema`, action: "remove", type: breaking, mentions: ["query parameter `filter`", "schema"] },
      {
        at: `${P0}/content/**`,
        action: "add",
        type: nonBreaking,
        mentions: ["query parameter `filter`", "application/json"],
      },
    ],
    // ISSUE-82 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-038",
    title: "media type of a content parameter changed",
    before: "query parameter filter content application/json",
    after: "content text/plain",
    rationale: "clients send JSON-encoded values that are no longer parsed as JSON",
    annotation: "names the parameter and each media type",
    sources: [{ tool: "libopenapi", ref: "parameter.go content (entry removed breaking, added not)" }],
    docs: [
      withParams({ name: "filter", in: "query", content: { "application/json": { schema: str } } }),
      withParams({ name: "filter", in: "query", content: { "text/plain": { schema: str } } }),
    ],
    expect: [
      {
        at: `${P0}/content/application~1json`,
        action: "remove",
        type: breaking,
        mentions: ["query parameter `filter`", "application/json"],
      },
      {
        at: `${P0}/content/text~1plain`,
        action: "add",
        type: nonBreaking,
        mentions: ["query parameter `filter`", "text/plain"],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-039",
    title: "schema type changed inside a content parameter",
    before: "query parameter filter content application/json schema string",
    after: "schema integer",
    rationale: "string values clients send are rejected",
    annotation: "names the parameter, the media type and the type change",
    sources: [{ tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.15" }],
    docs: [
      withParams({ name: "filter", in: "query", content: { "application/json": { schema: str } } }),
      withParams({ name: "filter", in: "query", content: { "application/json": { schema: { type: "integer" } } } }),
    ],
    expect: [
      {
        at: `${P0}/content/application~1json/schema/type`,
        type: breaking,
        mentions: ["query parameter `filter`", "application/json"],
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // description and examples
  {
    kind: "doc",
    id: "OAS-PARAM-040",
    title: "parameter description added, changed and removed",
    before: "query parameter limit description absent / a / a",
    after: "description a / b / absent",
    rationale: "documentation only",
    annotation: "names the parameter and the description",
    sources: [
      { tool: "openapi-diff", ref: "ParameterDiffTest::testParameterDescriptionChanged", verdict: "metadata" },
      { tool: "compat-suites", ref: "operation-parameters/add-parameter-description" },
      { tool: "compat-suites", ref: "operation-parameters/update-parameter-description" },
      { tool: "compat-suites", ref: "operation-parameters/remove-parameter-description" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-description-inline" },
    ],
    docs: {
      add: [withParams(query("limit")), withParams(query("limit", { description: "a" }))],
      replace: [withParams(query("limit", { description: "a" })), withParams(query("limit", { description: "b" }))],
      remove: [withParams(query("limit", { description: "a" })), withParams(query("limit"))],
    },
    expect: [{ at: `${P0}/description`, type: annotation, mentions: ["query parameter `limit`", "description"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-041",
    title: "parameter example added, changed and removed",
    before: "query parameter limit example absent / 10 / 10",
    after: "example 10 / 20 / absent",
    rationale: "examples are documentation",
    annotation: "names the parameter and the example",
    sources: [
      {
        tool: "libopenapi",
        ref: "parameter_test.go TestCompareParameters_V3_ExampleAdd / _ExampleChange / _ExampleRemove",
      },
      { tool: "compat-suites", ref: "operation-parameters/add-parameter-example" },
      { tool: "compat-suites", ref: "operation-parameters/update-parameter-example" },
      { tool: "compat-suites", ref: "operation-parameters/remove-parameter-example" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-example-inline" },
    ],
    docs: {
      add: [withParams(query("limit")), withParams(query("limit", { example: "10" }))],
      replace: [withParams(query("limit", { example: "10" })), withParams(query("limit", { example: "20" }))],
      remove: [withParams(query("limit", { example: "10" })), withParams(query("limit"))],
    },
    expect: [{ at: `${P0}/example`, type: annotation, mentions: ["query parameter `limit`", "example"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-042",
    title: "object example of a parameter changed in a nested value",
    before: "query parameter filter example { a: 1 }",
    after: "example { a: 2 }",
    rationale: "examples are documentation, whatever their shape",
    annotation: "names the parameter and the example",
    sources: [
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-example-array-inline" },
    ],
    docs: [
      withParams(query("filter", { schema: { type: "object" }, example: { a: 1 } })),
      withParams(query("filter", { schema: { type: "object" }, example: { a: 2 } })),
    ],
    expect: [{ at: `${P0}/example/**`, type: annotation, mentions: ["query parameter `filter`", "example"] }],
    // ISSUE-73 (fixed): nested example values are annotations naming the parameter
  },
  {
    kind: "doc",
    id: "OAS-PARAM-043",
    title: "parameter examples map changed",
    before: "query parameter limit examples { small: 10 }",
    after: "examples added / value changed / summary, description, externalValue changed / entry renamed / removed",
    rationale: "examples are documentation",
    annotation: "names the parameter and the example entry",
    sources: [
      {
        tool: "libopenapi",
        ref: "parameter_test.go TestCompareParameters_V3_ExamplesAdded / _ExamplesChanged / _ExamplesRemoved",
      },
      { tool: "compat-suites", ref: "parameters-examples/add-examples-object-for-parameter" },
      { tool: "compat-suites", ref: "parameters-examples/add-additional-examples-object" },
      { tool: "compat-suites", ref: "parameters-examples/update-example-value" },
      { tool: "compat-suites", ref: "parameters-examples/update-name-of-example" },
      { tool: "compat-suites", ref: "parameters-examples/update-external-value-of-example" },
      { tool: "compat-suites", ref: "parameters-examples/add-example-summary" },
      { tool: "compat-suites", ref: "parameters-examples/update-example-description" },
      { tool: "fork", ref: "human-readable/openapi/examples-object.test.ts examples-object-*-inline" },
    ],
    docs: {
      first: [withParams(query("limit")), withParams(query("limit", { examples: { small: { value: "10" } } }))],
      another: [
        withParams(query("limit", { examples: { small: { value: "10" } } })),
        withParams(query("limit", { examples: { small: { value: "10" }, large: { value: "100" } } })),
      ],
      value: [
        withParams(query("limit", { examples: { small: { value: "10" } } })),
        withParams(query("limit", { examples: { small: { value: "5" } } })),
      ],
      summary: [
        withParams(query("limit", { examples: { small: { value: "10", summary: "a" } } })),
        withParams(query("limit", { examples: { small: { value: "10", summary: "b" } } })),
      ],
      description: [
        withParams(query("limit", { examples: { small: { value: "10" } } })),
        withParams(query("limit", { examples: { small: { value: "10", description: "d" } } })),
      ],
      externalValue: [
        withParams(query("limit", { examples: { small: { externalValue: "https://e.example.com/1" } } })),
        withParams(query("limit", { examples: { small: { externalValue: "https://e.example.com/2" } } })),
      ],
      renamed: [
        withParams(query("limit", { examples: { small: { value: "10" } } })),
        withParams(query("limit", { examples: { tiny: { value: "10" } } })),
      ],
      removed: [
        withParams(query("limit", { examples: { small: { value: "10" }, large: { value: "100" } } })),
        withParams(query("limit", { examples: { small: { value: "10" } } })),
      ],
    },
    expect: {
      first: [{ at: `${P0}/examples/**`, type: annotation, mentions: ["query parameter `limit`", "small"] }],
      another: [{ at: `${P0}/examples/large`, type: annotation, mentions: ["query parameter `limit`", "large"] }],
      value: [{ at: `${P0}/examples/small/**`, type: annotation, mentions: ["query parameter `limit`", "small"] }],
      summary: [
        { at: `${P0}/examples/small/summary`, type: annotation, mentions: ["query parameter `limit`", "small"] },
      ],
      description: [
        { at: `${P0}/examples/small/description`, type: annotation, mentions: ["query parameter `limit`", "small"] },
      ],
      externalValue: [
        { at: `${P0}/examples/small/externalValue`, type: annotation, mentions: ["query parameter `limit`", "small"] },
      ],
      renamed: [
        {
          at: `${P0}/examples/small`,
          action: "remove",
          type: annotation,
          mentions: ["query parameter `limit`", "small"],
        },
        { at: `${P0}/examples/tiny`, action: "add", type: annotation, mentions: ["query parameter `limit`", "tiny"] },
      ],
      removed: [{ at: `${P0}/examples/large`, type: annotation, mentions: ["query parameter `limit`", "large"] }],
    },
    // ISSUE-82 (fixed) (P8-OAS)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // $ref parameters (components.parameters)
  {
    kind: "doc",
    id: "OAS-PARAM-044",
    title: "referenced component parameter became required",
    before: "GET /pets parameters [$ref Limit], Limit optional",
    after: "Limit required",
    rationale:
      "the usage site requires the parameter now; the component diff takes the usage's request semantics (§11.4)",
    annotation: "the usage site names the query parameter; the component site names the component and the parameter",
    sources: [
      { tool: "oasdiff", ref: "diff/diff_test.go TestDiff_DifferentComponentModifiedParam (resolved at usage)" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-required-ref" },
      { tool: "asd", ref: "test/openapi/parameters-edge-cases.test.ts C3.16" },
    ],
    covers: ["oasdiff:request-parameter-became-required"],
    docs: [
      oas(
        { "/pets": { get: op({ parameters: [{ $ref: "#/components/parameters/Limit" }] }) } },
        { components: { parameters: { Limit: query("limit") } } },
      ),
      oas(
        { "/pets": { get: op({ parameters: [{ $ref: "#/components/parameters/Limit" }] }) } },
        { components: { parameters: { Limit: query("limit", { required: true }) } } },
      ),
    ],
    expect: [
      { at: `${P0}/required`, type: breaking, mentions: ["query parameter `limit`", "required"] },
      { at: "components/parameters/Limit/required", type: breaking, mentions: ["limit", "required"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-045",
    title: "$ref parameter replaced by an identical inline parameter",
    before: "parameters [$ref Limit]",
    after: "parameters [inline copy of Limit]",
    rationale: "the resolved parameter is identical",
    annotation: "no diff",
    sources: [{ tool: "fork", ref: "openapi.classification.test.ts parameters unchanged, same spec with $ref params" }],
    docs: [
      oas(
        { "/pets": { get: op({ parameters: [{ $ref: "#/components/parameters/Limit" }] }) } },
        { components: { parameters: { Limit: query("limit") } } },
      ),
      oas(
        { "/pets": { get: op({ parameters: [query("limit")] }) } },
        { components: { parameters: { Limit: query("limit") } } },
      ),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-046",
    title: "unreferenced component parameter added and removed",
    before: "components.parameters {} / { Unused }",
    after: "{ Unused } / {}",
    rationale: "an unreferenced component is not part of any operation: decision §11.4 makes its diffs unclassified",
    annotation: "names the component parameter",
    sources: [
      { tool: "libopenapi", ref: "components_test.go TestCompareComponents_OpenAPI_Parameters_Added / _Removed" },
    ],
    docs: {
      add: [
        oas({ "/pets": { get: op() } }, { components: { parameters: {} } }),
        oas({ "/pets": { get: op() } }, { components: { parameters: { Unused: query("unused") } } }),
      ],
      remove: [
        oas({ "/pets": { get: op() } }, { components: { parameters: { Unused: query("unused") } } }),
        oas({ "/pets": { get: op() } }, { components: { parameters: {} } }),
      ],
    },
    expect: [{ at: "components/parameters/Unused", type: unclassified, mentions: ["Unused"] }],
    // ISSUE-56 (fixed) (P8a); ISSUE-69 (fixed): detection and classification pass; the description remains (ISSUE-56)
  },
  {
    kind: "doc",
    id: "OAS-PARAM-047",
    title: "description override next to a parameter $ref (3.1)",
    before: "parameters [$ref Limit] (component description: Page size)",
    after: "parameters [{ $ref Limit, description: Max items }]",
    rationale: "OAS 3.1 Reference Objects may override description; documentation only",
    annotation: "names the parameter and the description",
    sources: [
      { tool: "compat-suites", ref: "operation-parameters/add-overriden-description" },
      { tool: "fork", ref: "oas-30-to-31.test.ts overridden description via reference object" },
    ],
    docs: [
      oas(
        { "/pets": { get: op({ parameters: [{ $ref: "#/components/parameters/Limit" }] }) } },
        { components: { parameters: { Limit: query("limit", { description: "Page size" }) } } },
      ),
      oas(
        { "/pets": { get: op({ parameters: [{ $ref: "#/components/parameters/Limit", description: "Max items" }] }) } },
        { components: { parameters: { Limit: query("limit", { description: "Page size" }) } } },
      ),
    ],
    expect: [{ at: `${P0}/description`, type: annotation, mentions: ["query parameter `limit`", "description"] }],
    // ISSUE-60 (fixed)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // header parameter object properties
  {
    kind: "doc",
    id: "OAS-PARAM-048",
    title: "required property added to an object header parameter",
    before: "header X-Ctx schema { type: object, properties: { tenant } }",
    after: "properties { tenant, courseId }, required [courseId]",
    rationale: "clients serialize the header without courseId and are rejected",
    annotation: "names the property and the header parameter",
    sources: [{ tool: "oasdiff", ref: "checker/check_breaking_property_test.go TestBreaking_NewRequiredProperty" }],
    covers: ["oasdiff:new-required-request-header-property"],
    docs: [
      withParams(header("X-Ctx", { schema: { type: "object", properties: { tenant: str } } })),
      withParams(
        header("X-Ctx", {
          schema: { type: "object", properties: { tenant: str, courseId: str }, required: ["courseId"] },
        }),
      ),
    ],
    expect: [
      {
        at: [`${P0}/schema/properties/courseId`, `${P0}/schema/required/**`],
        action: "add",
        type: breaking,
        mentions: ["courseId", "header parameter `X-Ctx`"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-049",
    title: "property of an object header parameter became required",
    before: "header X-Ctx properties { tenant }",
    after: "required [tenant]",
    rationale: "clients that omit tenant are rejected",
    annotation: "names the property and the header parameter",
    sources: [{ tool: "oasdiff", ref: "checker/check_breaking_property_test.go TestBreaking_PropertyRequiredEnabled" }],
    covers: ["oasdiff:request-header-property-became-required"],
    docs: [
      withParams(header("X-Ctx", { schema: { type: "object", properties: { tenant: str } } })),
      withParams(header("X-Ctx", { schema: { type: "object", properties: { tenant: str }, required: ["tenant"] } })),
    ],
    expect: [{ at: `${P0}/schema/required/**`, type: breaking, mentions: ["tenant", "header parameter `X-Ctx`"] }],
  },
  {
    kind: "doc",
    id: "OAS-PARAM-050",
    title: "property of an object header parameter became an enum",
    before: "header X-Ctx properties { mode: string }",
    after: "mode: string enum [fast]",
    rationale: "values other than fast that clients send are rejected",
    annotation: "names the property, the header parameter and the allowed value",
    sources: [
      { tool: "oasdiff", ref: "checker/check_breaking_test.go TestBreaking_ReqParameterHeaderPropertyBecameEnum" },
    ],
    covers: ["oasdiff:request-header-property-became-enum"],
    docs: [
      withParams(header("X-Ctx", { schema: { type: "object", properties: { mode: str } } })),
      withParams(
        header("X-Ctx", { schema: { type: "object", properties: { mode: { type: "string", enum: ["fast"] } } } }),
      ),
    ],
    expect: [
      {
        at: `${P0}/schema/properties/mode/enum/**`,
        type: breaking,
        mentions: ["mode", "header parameter `X-Ctx`", "fast"],
      },
    ],
    // ISSUE-87 (fixed)
  },
]

runCases("openapi", "parameters", cases, import.meta.filename)
