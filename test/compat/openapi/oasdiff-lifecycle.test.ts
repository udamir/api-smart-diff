import { annotation, breaking, deprecated } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"
import { property } from "../jsonschema/kw"

// Document-diff counterparts of oasdiff's date- and lint-dependent lifecycle rules (sunset date too small, sunset date
// unparseable, deprecation without a sunset date under a deprecation policy, unknown stability level). oasdiff
// compares x-sunset with the current date and a configured policy or validates the extension value; ASD compares two
// documents only, so the same before / after pairs are re-authored with fixed dates and the expectations follow
// POLICY-07 decided (a): x-sunset / x-stability-level are vendor extensions without lifecycle semantics, i.e. an
// annotation naming the key; the `deprecated` flag keeps its deprecated diff; a removal is breaking (POLICY-04 (a)).

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const oas = (paths: Record<string, unknown>) => ({ openapi: "3.1.0", info, paths })
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const getPets = (o: Record<string, unknown> = {}) => oas({ "/pets": { get: op(o) } })
const withParam = (o: Record<string, unknown> = {}, operation: Record<string, unknown> = {}) =>
  getPets({ ...operation, parameters: [{ name: "id", in: "query", schema: str, ...o }] })

/** a sunset date closer than any deprecation period a policy would require (fixed, so the case does not age) */
const NEAR = "2026-11-25"
const FAR = "2099-12-31"
const INVALID = "invalid-date-format"

const ref = (file: string, test: string, verdict?: string) => ({
  tool: "oasdiff",
  ref: `checker/${file} ${test}`,
  ...(verdict ? { verdict } : {}),
})

const OP = "paths/~1pets/get"
const PARAM = "paths/~1pets/get/parameters/0"
const opDeprecated = { at: `${OP}/deprecated`, type: deprecated, mentions: ["GET /pets", "deprecated"] }
const opSunset = { at: `${OP}/x-sunset`, type: annotation, mentions: ["GET /pets", "x-sunset"] }
const paramDeprecated = {
  at: `${PARAM}/deprecated`,
  type: deprecated,
  mentions: ["query parameter `id`", "deprecated"],
}
const paramSunset = { at: `${PARAM}/x-sunset`, type: annotation, mentions: ["query parameter `id`", "x-sunset"] }

// POLICY-07 decided (a); operation-level descriptions name the operation (ISSUE-81 (fixed) (P8-OAS))
// POLICY-06 (d) / POLICY-07 (a): an x-* key inside a schema is an annotation naming the key
// ISSUE-131 (fixed): passes since P1 added the `x-` prefix extension rule (`"/x-*"` since 2026-11-21)

const docCases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-LCY-001",
    title: "operation deprecated with an unparseable x-sunset value",
    before: "GET /pets",
    after: `GET /pets deprecated: true, x-sunset "${INVALID}" (or an RFC 1123 HTTP-date)`,
    rationale:
      "oasdiff rejects a sunset value that is not an RFC 3339 date (api-deprecated-sunset-parse ERR); ASD does not validate extension values: the deprecation is a deprecated diff, x-sunset an annotation (POLICY-07 a)",
    annotation: "names the operation, the deprecation and the sunset extension",
    sources: [
      ref("check_api_deprecation_test.go", "TestBreaking_DeprecationWithInvalidSunset", "ERR"),
      ref("check_api_deprecation_test.go", "TestBreaking_DeprecationWithInvalidJsonSunset", "ERR"),
      ref("internal/deprecation/announce_test.go", "TestAnnounceStages unparseable sunset date", "ERR"),
    ],
    covers: ["oasdiff:api-deprecated-sunset-parse"],
    docs: {
      invalid: [getPets(), getPets({ deprecated: true, "x-sunset": INVALID })],
      httpDate: [getPets(), getPets({ deprecated: true, "x-sunset": "Wed, 01 Jan 2031 00:00:00 GMT" })],
    },
    expect: [opDeprecated, opSunset],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-LCY-002",
    title: "operation deprecated without x-sunset under a stability level",
    before: "GET /pets x-stability-level stable / beta",
    after: "GET /pets x-stability-level stable / beta, deprecated: true (no x-sunset)",
    rationale:
      "oasdiff's deprecation policy requires a sunset date for stable / beta operations (api-deprecated-sunset-missing ERR); the documents only differ by the deprecation, a deprecated diff",
    annotation: "names the operation and the deprecation",
    sources: [
      ref("check_api_deprecation_test.go", "TestBreaking_DeprecationWithoutSunsetWithPolicy", "ERR"),
      ref("check_api_deprecation_test.go", "TestBreaking_DeprecationWithoutSunset", "ERR"),
      ref("check_api_deprecation_test.go", "TestBreaking_DeprecationForAlpha", "INFO"),
      ref("internal/deprecation/announce_test.go", "TestAnnounceStages no sunset date under a grace period", "ERR"),
    ],
    covers: ["oasdiff:api-deprecated-sunset-missing"],
    docs: {
      stable: [
        getPets({ "x-stability-level": "stable" }),
        getPets({ "x-stability-level": "stable", deprecated: true }),
      ],
      beta: [getPets({ "x-stability-level": "beta" }), getPets({ "x-stability-level": "beta", deprecated: true })],
    },
    expect: [opDeprecated],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-LCY-003",
    title: "operation x-stability-level set to a value outside draft / alpha / beta / stable",
    before: "GET /pets x-stability-level beta / invalid / absent (deprecated absent)",
    after: "x-stability-level invalid / beta / 1 (or invalid together with deprecated: true)",
    rationale:
      "oasdiff validates the extension value (api-invalid-stability-level ERR); for ASD it is a vendor extension whose value changed: an annotation naming the key (POLICY-07 a)",
    annotation: "names the operation and the stability extension",
    sources: [
      ref("check_api_stability_level_test.go", "TestBreaking_InvalidStabilityLevelInRevision", "ERR"),
      ref("check_api_stability_level_test.go", "TestBreaking_InvalidStabilityLevelInBase", "ERR"),
      ref("check_api_stability_level_test.go", "TestBreaking_InvalidNonJsonStabilityLevel", "ERR"),
      ref("check_api_stability_level_test.go", "TestStabilityLevel_InvalidValueIsQuoted", "ERR"),
      ref("check_api_deprecation_test.go", "TestBreaking_DeprecationWithInvalidStabilityLevel", "ERR"),
      ref("check_api_deprecation_test.go", "TestBreaking_InvaidStability", "ERR"),
    ],
    covers: ["oasdiff:api-invalid-stability-level"],
    docs: {
      toInvalid: [getPets({ "x-stability-level": "beta" }), getPets({ "x-stability-level": "invalid" })],
      fromInvalid: [getPets({ "x-stability-level": "invalid" }), getPets({ "x-stability-level": "beta" })],
      number: [getPets(), getPets({ "x-stability-level": 1 })],
      deprecated: [getPets(), getPets({ "x-stability-level": "invalid", deprecated: true })],
    },
    expect: {
      "*": [{ at: `${OP}/x-stability-level`, type: annotation, mentions: ["GET /pets", "x-stability-level"] }],
      deprecated: [
        opDeprecated,
        { at: `${OP}/x-stability-level`, type: annotation, mentions: ["GET /pets", "x-stability-level"] },
      ],
    },
    // the other variants: ISSUE-81 (fixed) on the in-progress P1 build
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-LCY-004",
    title: "operation deprecated with a sunset date sooner than a deprecation policy allows",
    before: "GET /pets x-stability-level stable",
    after: `deprecated: true, x-sunset ${NEAR} (a few days after the change)`,
    rationale:
      "oasdiff compares the sunset date with today and the configured deprecation days (api-sunset-date-too-small ERR); between the two documents only the deprecation (deprecated) and the extension (annotation, POLICY-07 a) change",
    annotation: "names the operation, the deprecation and the sunset extension",
    sources: [
      ref("check_api_deprecation_test.go", "TestBreaking_DeprecationWithEarlySunset", "ERR"),
      ref("check_api_deprecation_test.go", "TestBreaking_DeprecationWithProperSunset", "INFO"),
      ref("internal/deprecation/announce_test.go", "TestAnnounceStages sunset date inside the grace period", "ERR"),
    ],
    covers: ["oasdiff:api-sunset-date-too-small"],
    docs: [
      getPets({ "x-stability-level": "stable" }),
      getPets({ "x-stability-level": "stable", deprecated: true, "x-sunset": NEAR }),
    ],
    expect: [opDeprecated, opSunset],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-LCY-005",
    title: "sunset date of a deprecated operation moved to a date sooner than a deprecation policy allows",
    before: `GET /pets deprecated, x-sunset ${FAR}`,
    after: `x-sunset ${NEAR}`,
    rationale:
      "oasdiff rejects a new sunset date inside the deprecation period (api-sunset-date-changed-too-small ERR); the plain earlier date is OAS-DEP-013; ASD: an annotation (POLICY-07 a)",
    annotation: "names the operation and the sunset extension",
    sources: [
      ref("check_api_sunset_changed_test.go", "TestBreaking_SunsetModifiedForDeprecatedEndpoint", "ERR"),
      ref("check_api_sunset_changed_test.go", "TestSunsetChanged_EarlierCarriesTheReason", "ERR"),
    ],
    covers: ["oasdiff:api-sunset-date-changed-too-small"],
    docs: [getPets({ deprecated: true, "x-sunset": FAR }), getPets({ deprecated: true, "x-sunset": NEAR })],
    expect: [opSunset],
    // ISSUE-81 (fixed): passes on the in-progress P1 build
  },
  {
    kind: "doc",
    id: "OAS-LCY-006",
    title: "unparseable x-sunset on a deprecated operation: removed operation, changed to and from an invalid value",
    before: `GET /pets deprecated, x-sunset "${INVALID}" (and POST /pets) / x-sunset ${FAR} / x-sunset "${INVALID}"`,
    after: `GET /pets removed / x-sunset "${INVALID}" / x-sunset ${FAR}`,
    rationale:
      "oasdiff cannot tell whether the sunset date passed (api-path-sunset-parse ERR); ASD: the removal is breaking regardless of the deprecation (POLICY-04 a), a sunset value change is an annotation (POLICY-07 a)",
    annotation: "names the removed operation / the operation and the sunset extension",
    sources: [
      ref("check_api_removed_test.go", "TestBreaking_RemoveEndpointWithInvalidSunset", "ERR"),
      ref("check_api_sunset_changed_test.go", "TestBreaking_SunsetModifiedToInvalidForDeprecatedEndpoint", "ERR"),
      ref("check_api_sunset_changed_test.go", "TestBreaking_SunsetModifiedFromInvalidForDeprecatedEndpoint"),
      ref("check_api_sunset_changed_test.go", "TestSunsetChanged_ParseFailureIsOneSided", "ERR"),
    ],
    covers: ["oasdiff:api-path-sunset-parse"],
    docs: {
      removed: [
        oas({ "/pets": { get: op({ deprecated: true, "x-sunset": INVALID }), post: op() } }),
        oas({ "/pets": { post: op() } }),
      ],
      toInvalid: [getPets({ deprecated: true, "x-sunset": FAR }), getPets({ deprecated: true, "x-sunset": INVALID })],
      fromInvalid: [getPets({ deprecated: true, "x-sunset": INVALID }), getPets({ deprecated: true, "x-sunset": FAR })],
    },
    expect: {
      removed: [{ at: OP, action: "remove", type: breaking, mentions: ["GET /pets"] }],
      "*": [opSunset],
    },
    // ISSUE-81 (fixed): passes on the in-progress P1 build
  },
  {
    kind: "doc",
    id: "OAS-LCY-007",
    title: "parameter deprecated without x-sunset in an operation with a stability level",
    before: "GET /pets x-stability-level stable, query parameter id",
    after: "id deprecated: true (no x-sunset)",
    rationale:
      "oasdiff's deprecation policy requires a sunset date (request-parameter-deprecated-sunset-missing ERR); between the documents only the parameter's deprecation changes",
    annotation: "names the parameter and the deprecation",
    sources: [
      ref(
        "check_request_parameter_deprecation_test.go",
        "TestBreaking_ParameterDeprecationWithoutSunsetWithPolicy",
        "ERR",
      ),
      ref("check_request_parameter_deprecation_test.go", "TestBreaking_ParameterDeprecationWithoutSunset", "ERR"),
      ref("check_request_parameter_deprecation_test.go", "TestBreaking_ParameterDeprecationForAlpha", "INFO"),
    ],
    covers: ["oasdiff:request-parameter-deprecated-sunset-missing"],
    docs: [
      withParam({}, { "x-stability-level": "stable" }),
      withParam({ deprecated: true }, { "x-stability-level": "stable" }),
    ],
    expect: [paramDeprecated],
  },
  {
    kind: "doc",
    id: "OAS-LCY-008",
    title: "parameter deprecated with a near or an unparseable sunset date",
    before: "query parameter id",
    after: `deprecated: true, x-sunset ${NEAR} / "${INVALID}"`,
    rationale:
      "oasdiff checks the date against today and the policy (request-parameter-sunset-date-too-small ERR) or rejects the value (request-parameter-sunset-parse ERR); ASD: deprecated + annotation (POLICY-07 a)",
    annotation: "names the parameter, the deprecation and the sunset extension",
    sources: [
      ref("check_request_parameter_deprecation_test.go", "TestBreaking_ParameterDeprecationWithEarlySunset", "ERR"),
      ref("check_request_parameter_deprecation_test.go", "TestBreaking_ParameterDeprecationWithInvalidSunset", "ERR"),
      ref("check_request_parameter_deprecation_test.go", "TestBreaking_ParameterDeprecationWithProperSunset", "INFO"),
    ],
    covers: ["oasdiff:request-parameter-sunset-date-too-small", "oasdiff:request-parameter-sunset-parse"],
    docs: {
      near: [withParam(), withParam({ deprecated: true, "x-sunset": NEAR })],
      invalid: [withParam(), withParam({ deprecated: true, "x-sunset": INVALID })],
    },
    expect: [paramDeprecated, paramSunset],
  },
  {
    kind: "doc",
    id: "OAS-LCY-009",
    title: "sunset date of a deprecated parameter moved to a near date or to an unparseable value",
    before: `query parameter id deprecated, x-sunset ${FAR}`,
    after: `x-sunset ${NEAR} / "${INVALID}"`,
    rationale:
      "oasdiff: request-parameter-sunset-date-changed-too-small / request-parameter-sunset-parse ERR (the plain earlier date is OAS-DEP-014); ASD: an annotation (POLICY-07 a)",
    annotation: "names the parameter and the sunset extension",
    sources: [
      ref("check_request_parameter_sunset_changed_test.go", "TestBreaking_SunsetModifiedForDeprecatedParameter", "ERR"),
      ref(
        "check_request_parameter_sunset_changed_test.go",
        "TestBreaking_SunsetModifiedToInvalidForDeprecatedParameter",
        "ERR",
      ),
      ref(
        "check_request_parameter_sunset_changed_test.go",
        "TestBreaking_SunsetModifiedFromInvalidForDeprecatedParameter",
      ),
    ],
    covers: ["oasdiff:request-parameter-sunset-date-changed-too-small", "oasdiff:request-parameter-sunset-parse"],
    docs: {
      near: [withParam({ deprecated: true, "x-sunset": FAR }), withParam({ deprecated: true, "x-sunset": NEAR })],
      toInvalid: [
        withParam({ deprecated: true, "x-sunset": FAR }),
        withParam({ deprecated: true, "x-sunset": INVALID }),
      ],
      fromInvalid: [
        withParam({ deprecated: true, "x-sunset": INVALID }),
        withParam({ deprecated: true, "x-sunset": FAR }),
      ],
    },
    expect: [paramSunset],
  },
  {
    kind: "doc",
    id: "OAS-LCY-010",
    title: "deprecated parameter with an unparseable x-sunset removed",
    before: `query parameter id deprecated, x-sunset "${INVALID}"`,
    after: "parameter removed",
    rationale:
      "oasdiff cannot tell whether the sunset passed (request-parameter-sunset-parse ERR); the removal is breaking regardless of the deprecation (POLICY-04 a)",
    annotation: "names the removed parameter",
    sources: [ref("check_request_parameter_removed_test.go", "TestBreaking_RemoveParameterWithInvalidSunset", "ERR")],
    covers: ["oasdiff:request-parameter-sunset-parse"],
    docs: [withParam({ deprecated: true, "x-sunset": INVALID }), getPets({ parameters: [] })],
    expect: [{ at: PARAM, action: "remove", type: breaking, mentions: ["query parameter `id`"] }],
  },
]

const s = str
const schemaCases: CompatCase[] = [
  property({
    id: "OAS-LCY-011",
    title: "property deprecated with an unparseable x-sunset value",
    before: "name: string",
    after: `name: string, deprecated true, x-sunset "${INVALID}"`,
    rationale:
      "oasdiff rejects the value (request / response-property-deprecated-sunset-invalid ERR); ASD: the deprecation is a deprecated diff, x-sunset an annotation (POLICY-07 a) in both directions",
    annotation: "states the deprecation; names the sunset extension",
    sources: [
      ref("check_request_property_deprecation_test.go", "TestRequestPropertyDeprecation_WithInvalidSunset", "ERR"),
      ref("check_response_property_deprecation_test.go", "TestResponsePropertyDeprecation_WithInvalidSunset", "ERR"),
    ],
    stems: ["deprecated-sunset-invalid"],
    schema: [s, { ...s, deprecated: true, "x-sunset": INVALID }],
    expect: [
      { at: "deprecated", action: "add", type: deprecated, mentions: ["deprecated"] },
      { at: "x-sunset", action: "add", type: annotation, mentions: ["x-sunset"] },
    ],
  }),
  property({
    id: "OAS-LCY-012",
    title: "property deprecated with a sunset date sooner than a deprecation policy allows",
    before: "name: string",
    after: `name: string, deprecated true, x-sunset ${NEAR}`,
    rationale:
      "oasdiff compares the date with today and the policy (request / response-property-sunset-date-too-small ERR); ASD: deprecated + annotation (POLICY-07 a) in both directions",
    annotation: "states the deprecation; names the sunset extension",
    sources: [
      ref("check_request_property_deprecation_test.go", "TestRequestPropertyDeprecation_WithEarlySunset", "ERR"),
      ref("check_response_property_deprecation_test.go", "TestResponsePropertyDeprecation_WithEarlySunset", "ERR"),
    ],
    stems: ["sunset-date-too-small"],
    schema: [s, { ...s, deprecated: true, "x-sunset": NEAR }],
    expect: [
      { at: "deprecated", action: "add", type: deprecated, mentions: ["deprecated"] },
      { at: "x-sunset", action: "add", type: annotation, mentions: ["x-sunset"] },
    ],
  }),
  property({
    id: "OAS-LCY-013",
    title: "sunset date of a deprecated property moved to a date sooner than a deprecation policy allows",
    before: `name: deprecated true, x-sunset ${FAR}`,
    after: `name: deprecated true, x-sunset ${NEAR}`,
    rationale:
      "oasdiff: request / response-property-sunset-date-changed-too-small ERR (the plain earlier date is JS-ANN-016); ASD: an annotation (POLICY-07 a)",
    annotation: "names the changed sunset extension",
    sources: [
      ref("check_request_property_sunset_changed_test.go", "TestRequestPropertySunsetChanged_TooSmall", "ERR"),
      ref("check_response_property_sunset_changed_test.go", "TestResponsePropertySunsetChanged_TooSmall", "ERR"),
    ],
    stems: ["sunset-date-changed-too-small"],
    schema: [
      { ...s, deprecated: true, "x-sunset": FAR },
      { ...s, deprecated: true, "x-sunset": NEAR },
    ],
    expect: [{ at: "x-sunset", action: "replace", type: annotation, mentions: ["x-sunset"] }],
  }),
  property({
    id: "OAS-LCY-014",
    title: "sunset date of a deprecated property changed to an unparseable value",
    before: `name: deprecated true, x-sunset ${FAR}`,
    after: `name: deprecated true, x-sunset "${INVALID}"`,
    rationale:
      "oasdiff reports the unparseable new value (request / response-property-deprecated-sunset-invalid ERR); ASD: an annotation (POLICY-07 a)",
    annotation: "names the changed sunset extension",
    sources: [
      ref("check_request_property_sunset_changed_test.go", "TestRequestPropertySunsetChanged_ToInvalid", "ERR"),
      ref("check_request_property_sunset_changed_test.go", "TestRequestPropertySunsetChanged_FromInvalid"),
    ],
    stems: ["deprecated-sunset-invalid"],
    schema: [
      { ...s, deprecated: true, "x-sunset": FAR },
      { ...s, deprecated: true, "x-sunset": INVALID },
    ],
    expect: [{ at: "x-sunset", action: "replace", type: annotation, mentions: ["x-sunset"] }],
  }),
]

runCases("openapi", "deprecation", [...docCases, ...schemaCases], import.meta.filename)
