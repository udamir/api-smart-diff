import { annotation, breaking, deprecated } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// Deprecation and sunset of operations, paths and parameters: `deprecated` (ASD convention: every change of the flag is
// a `deprecated` diff, allDeprecated), removal of deprecated entities (POLICY-04) and oasdiff's x-sunset /
// x-stability-level lifecycle rules (POLICY-07). Date-relative and lint-only oasdiff rules are listed in
// test/compat/coverage/not-applicable.openapi-structure.json.

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const oas = (paths: Record<string, unknown>) => ({ openapi: "3.1.0", info, paths })
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const getPets = (o: Record<string, unknown> = {}) => oas({ "/pets": { get: op(o) } })
const withParam = (o: Record<string, unknown> = {}) =>
  getPets({ parameters: [{ name: "id", in: "query", schema: str, ...o }] })

// POLICY-04 decided (a): a removal is breaking whether or not the entity was deprecated before
// POLICY-07 decided (a): x-sunset / x-stability-level are vendor extensions without lifecycle semantics: annotation

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-DEP-001",
    title: "operation deprecated",
    before: "GET /pets",
    after: "GET /pets deprecated: true",
    rationale: "deprecation announces a future removal; nothing breaks now",
    annotation: "names the operation and the deprecation",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_deprecation_test.go TestApiDeprecated_MessageWithoutDetails endpoint-deprecated",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "OperationDiffTest::testOperationBecomesDeprecated", verdict: "compatible" },
      { tool: "libopenapi", ref: "breaking_rules.go operation.deprecated", verdict: "non-breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-deprecated-value" },
      { tool: "bench", ref: "oas-petstore P18" },
      { tool: "bench", ref: "oas-github G18" },
    ],
    covers: ["oasdiff:endpoint-deprecated"],
    docs: [getPets(), getPets({ deprecated: true })],
    expect: [{ at: "paths/~1pets/get/deprecated", type: deprecated, mentions: ["GET /pets", "deprecated"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-DEP-002",
    title: "operation reactivated (deprecation removed or set to false)",
    before: "GET /pets deprecated: true",
    after: "deprecated absent / false",
    rationale:
      "un-deprecation is a deprecation change (ASD allDeprecated; the fork expects deprecated; oasdiff endpoint-reactivated INFO)",
    annotation: "names the operation and the deprecation",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_deprecation_test.go TestApiDeprecated_DetectsReactivatedOperations endpoint-reactivated",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "OperationDiffTest::testOperationBecomesNotDeprecated", verdict: "compatible" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-deprecated-value" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-deprecated-value" },
    ],
    covers: ["oasdiff:endpoint-reactivated"],
    docs: {
      removed: [getPets({ deprecated: true }), getPets()],
      false: [getPets({ deprecated: true }), getPets({ deprecated: false })],
    },
    expect: [{ at: "paths/~1pets/get/deprecated", type: deprecated, mentions: ["GET /pets", "deprecated"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-DEP-003",
    title: "deprecated: false made explicit",
    before: "GET /pets",
    after: "GET /pets deprecated: false",
    rationale: "false is the default",
    annotation: "no diff",
    sources: [{ tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.10" }],
    docs: [getPets(), getPets({ deprecated: false })],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-DEP-004",
    title: "operation deprecated with an x-sunset date",
    before: "GET /pets",
    after: "GET /pets deprecated: true, x-sunset: 2030-01-01",
    rationale: "the deprecation is a deprecated diff; the x-sunset extension is metadata under option a",
    annotation: "names the operation, the deprecation and the sunset extension",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_deprecation_test.go TestApiDeprecated_MessageIncludesSunset endpoint-deprecated-with-sunset",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:endpoint-deprecated-with-sunset"],
    docs: [getPets(), getPets({ deprecated: true, "x-sunset": "2030-01-01" })],
    expect: [
      { at: "paths/~1pets/get/deprecated", type: deprecated, mentions: ["GET /pets", "deprecated"] },
      { at: "paths/~1pets/get/x-sunset", type: annotation, mentions: ["GET /pets", "x-sunset"] },
    ],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-DEP-005",
    title: "deprecated operation removed",
    before: "GET /pets deprecated: true, POST /pets",
    after: "POST /pets",
    rationale:
      "clients still calling the deprecated operation fail; oasdiff allows it (INFO) when no sunset date is pending; proposed option b",
    annotation: "names the removed operation",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_removed_test.go TestBreaking_DeprecationNoSunset api-removed-with-deprecation",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "backcompat/PathBCTest::opsDecreased", verdict: "breaking" },
    ],
    covers: ["oasdiff:api-removed-with-deprecation"],
    docs: [oas({ "/pets": { get: op({ deprecated: true }), post: op() } }), oas({ "/pets": { post: op() } })],
    expect: [{ at: "paths/~1pets/get", action: "remove", type: breaking, mentions: ["GET /pets"] }],
  },
  {
    kind: "doc",
    id: "OAS-DEP-006",
    title: "path removed after all its operations were deprecated",
    before: "/pets (GET, POST deprecated), /orders",
    after: "/orders",
    rationale:
      "callers of the deprecated path fail; oasdiff reports api-path-removed-with-deprecation (INFO); proposed option b",
    annotation: "names each removed operation",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_removed_test.go TestBreaking_PathDeprecationNoSunset",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:api-path-removed-with-deprecation"],
    docs: [
      oas({ "/pets": { get: op({ deprecated: true }), post: op({ deprecated: true }) }, "/orders": { get: op() } }),
      oas({ "/orders": { get: op() } }),
    ],
    expect: [{ at: ["paths/~1pets/get", "paths/~1pets/post"], action: "remove", type: breaking, mentions: ["/pets"] }],
  },
  {
    kind: "doc",
    id: "OAS-DEP-007",
    title: "deprecated operation and path removed before their x-sunset date",
    before: "GET /pets deprecated, x-sunset 9999-08-10 (and /legacy GET with the same)",
    after: "both removed",
    rationale: "removal before the announced sunset breaks the promise (oasdiff ERR) and the callers",
    annotation: "names the removed operations",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_removed_test.go TestBreaking_RemoveBeforeSunset api-removed-before-sunset",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_api_removed_test.go TestBreaking_DeprecationPathMixed api-path-removed-before-sunset",
      },
    ],
    covers: ["oasdiff:api-removed-before-sunset", "oasdiff:api-path-removed-before-sunset"],
    docs: [
      oas({
        "/pets": { get: op({ deprecated: true, "x-sunset": "9999-08-10" }), post: op() },
        "/legacy": { get: op({ deprecated: true, "x-sunset": "9999-08-10" }) },
      }),
      oas({ "/pets": { post: op() } }),
    ],
    expect: [
      {
        at: ["paths/~1pets/get", "paths/~1legacy/get"],
        action: "remove",
        type: breaking,
        mentions: [/GET \/(pets|legacy)/],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-DEP-008",
    title: "parameter deprecated (with and without x-sunset)",
    before: "query parameter id",
    after: "deprecated: true (optionally with x-sunset)",
    rationale: "deprecation announces a future removal",
    annotation: "names the parameter and the deprecation",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_deprecation_test.go TestParameterDeprecated_DetectsDeprecated request-parameter-deprecated",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "ParameterDiffTest::testParameterBecomesDeprecated", verdict: "compatible" },
      { tool: "compat-suites", ref: "operation-parameters/mark-parameter-as-deprecated" },
      { tool: "fork", ref: "human-readable/openapi/parameter-object.test.ts parameter-object-deprecated-inline" },
    ],
    covers: ["oasdiff:request-parameter-deprecated"],
    docs: {
      deprecated: [withParam(), withParam({ deprecated: true })],
      false: [withParam({ deprecated: false }), withParam({ deprecated: true })],
    },
    expect: [
      {
        at: "paths/~1pets/get/parameters/0/deprecated",
        type: deprecated,
        mentions: ["query parameter `id`", "deprecated"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-DEP-009",
    title: "parameter reactivated",
    before: "query parameter id deprecated: true",
    after: "deprecated absent / false",
    rationale: "un-deprecation is a deprecation change (allDeprecated)",
    annotation: "names the parameter and the deprecation",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_deprecation_test.go TestParameterDeprecated_DetectsReactivated",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "ParameterDiffTest::testParameterBecomesNotDeprecated", verdict: "compatible" },
      { tool: "compat-suites", ref: "operation-parameters/remove-deprecated-value" },
    ],
    covers: ["oasdiff:request-parameter-reactivated"],
    docs: {
      removed: [withParam({ deprecated: true }), withParam()],
      false: [withParam({ deprecated: true }), withParam({ deprecated: false })],
    },
    expect: [
      {
        at: "paths/~1pets/get/parameters/0/deprecated",
        type: deprecated,
        mentions: ["query parameter `id`", "deprecated"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-DEP-010",
    title: "path-level parameter deprecated",
    before: "/pets path-level query parameter id, GET and POST",
    after: "id deprecated: true",
    rationale: "the deprecation applies to every operation of the path",
    annotation: "one description per operation naming the parameter",
    sources: [
      { tool: "asd", ref: "openapi3.transform.ts createPathItemsTransform (path-level parameters attributed)" },
    ],
    covers: ["oasdiff:request-parameter-deprecated"],
    docs: [
      oas({ "/pets": { parameters: [{ name: "id", in: "query", schema: str }], get: op(), post: op() } }),
      oas({
        "/pets": { parameters: [{ name: "id", in: "query", schema: str, deprecated: true }], get: op(), post: op() },
      }),
    ],
    expect: [
      {
        at: ["paths/~1pets/get/parameters/0/deprecated", "paths/~1pets/post/parameters/0/deprecated"],
        type: deprecated,
        mentions: ["query parameter `id`", "deprecated"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-DEP-011",
    title: "deprecated parameter removed (with and without a pending sunset)",
    before: "query parameter id deprecated (x-sunset absent / 9999-08-10)",
    after: "parameter removed",
    rationale:
      "clients still sending id lose its effect; oasdiff allows it without a pending sunset (INFO) and rejects it before the sunset (ERR); proposed option b",
    annotation: "names the removed parameter",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_removed.go request-parameter-removed-with-deprecation",
        verdict: "INFO",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_removed_test.go TestBreaking_ParameterDeprecationFuture request-parameter-removed-before-sunset",
      },
    ],
    covers: ["oasdiff:request-parameter-removed-with-deprecation", "oasdiff:request-parameter-removed-before-sunset"],
    docs: {
      noSunset: [withParam({ deprecated: true }), getPets({ parameters: [] })],
      beforeSunset: [withParam({ deprecated: true, "x-sunset": "9999-08-10" }), getPets({ parameters: [] })],
    },
    expect: [
      { at: "paths/~1pets/get/parameters/0", action: "remove", type: breaking, mentions: ["query parameter `id`"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-DEP-012",
    title: "operation stability level decreased and increased (x-stability-level)",
    before: "GET /pets x-stability-level beta / alpha",
    after: "alpha / stable",
    rationale:
      "oasdiff treats a decrease as breaking (api-stability-decreased ERR) and an increase as INFO; ASD treats the extension as metadata (option a)",
    annotation: "names the operation and the extension",
    sources: [
      { tool: "oasdiff", ref: "checker/check_api_stability_level_test.go TestBreaking_StabilityLevelDecreased" },
      {
        tool: "oasdiff",
        ref: "checker/check_api_stability_level_test.go TestEndpointStability_DraftToStable_Increased",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:api-stability-decreased", "oasdiff:api-stability-increased"],
    docs: {
      decreased: [getPets({ "x-stability-level": "beta" }), getPets({ "x-stability-level": "alpha" })],
      increased: [getPets({ "x-stability-level": "alpha" }), getPets({ "x-stability-level": "stable" })],
    },
    expect: [
      { at: "paths/~1pets/get/x-stability-level", type: annotation, mentions: ["GET /pets", "x-stability-level"] },
    ],
    // ISSUE-81 (fixed for x-* extensions): the extension rule names the operation (POLICY-07 decided (a))
  },
  {
    kind: "doc",
    id: "OAS-DEP-013",
    title: "x-sunset of a deprecated operation deleted or moved earlier",
    before: "GET /pets deprecated, x-sunset 9999-08-10",
    after: "x-sunset removed / 2030-01-01",
    rationale:
      "oasdiff treats the published sunset date as a commitment (sunset-deleted / api-sunset-date-changed-earlier ERR); ASD treats it as metadata (option a)",
    annotation: "names the operation and the extension",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_sunset_changed_test.go TestBreaking_SunsetDeletedForDeprecatedEndpoint",
      },
      { tool: "oasdiff", ref: "checker/check_api_sunset_changed_test.go TestSunsetChanged_Earlier" },
    ],
    covers: ["oasdiff:sunset-deleted", "oasdiff:api-sunset-date-changed-earlier"],
    docs: {
      deleted: [getPets({ deprecated: true, "x-sunset": "9999-08-10" }), getPets({ deprecated: true })],
      earlier: [
        getPets({ deprecated: true, "x-sunset": "9999-08-10" }),
        getPets({ deprecated: true, "x-sunset": "2030-01-01" }),
      ],
    },
    expect: [{ at: "paths/~1pets/get/x-sunset", type: annotation, mentions: ["GET /pets", "x-sunset"] }],
    // ISSUE-81 (fixed for x-* extensions): the extension rule names the operation (POLICY-07 decided (a))
  },
  {
    kind: "doc",
    id: "OAS-DEP-014",
    title: "x-sunset of a deprecated parameter deleted or moved earlier",
    before: "query parameter id deprecated, x-sunset 9999-08-10",
    after: "x-sunset removed / 2030-01-01",
    rationale: "as for operations: oasdiff ERR, ASD metadata (option a)",
    annotation: "names the parameter and the extension",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_sunset_changed_test.go TestBreaking_SunsetDeletedForDeprecatedParameter",
      },
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_sunset_changed_test.go TestRequestParameterSunsetChanged_Earlier",
      },
    ],
    covers: ["oasdiff:request-parameter-sunset-deleted", "oasdiff:request-parameter-sunset-date-changed-earlier"],
    docs: {
      deleted: [withParam({ deprecated: true, "x-sunset": "9999-08-10" }), withParam({ deprecated: true })],
      earlier: [
        withParam({ deprecated: true, "x-sunset": "9999-08-10" }),
        withParam({ deprecated: true, "x-sunset": "2030-01-01" }),
      ],
    },
    expect: [
      {
        at: "paths/~1pets/get/parameters/0/x-sunset",
        type: annotation,
        mentions: ["query parameter `id`", "x-sunset"],
      },
    ],
  },
]

runCases("openapi", "deprecation", cases, import.meta.filename)
