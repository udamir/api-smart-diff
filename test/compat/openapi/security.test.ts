import { annotation, breaking, deprecated, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, risky, runCases } from "../../helpers/compat"

// Security: global and operation requirements (alternatives = OR, schemes inside a requirement = AND, scopes),
// anonymous `{}` access, and security schemes in components (type / name / in / scheme / bearerFormat / URLs /
// OAuth flows and scopes, 3.2 deviceAuthorization / oauth2MetadataUrl / deprecated).

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })

const apiKey = { type: "apiKey", name: "X-API-Key", in: "header" }
const bearer = { type: "http", scheme: "bearer" }
const oauth = {
  type: "oauth2",
  flows: {
    clientCredentials: { tokenUrl: "https://auth.example.com/token", scopes: { "read:pets": "", "write:pets": "" } },
  },
}
const schemes = { api_key: apiKey, bearer_auth: bearer, petstore_auth: oauth }

/** GET /pets with optional global and operation security; `undefined` leaves the field out. */
const doc = (
  global: unknown[] | undefined,
  operation?: unknown[],
  securitySchemes: Record<string, unknown> = schemes,
  openapi = "3.1.0",
) => ({
  openapi,
  info,
  paths: { "/pets": { get: op(operation === undefined ? {} : { security: operation }) } },
  ...(global === undefined ? {} : { security: global }),
  components: { securitySchemes },
})
/** A single scheme `S` referenced by the global requirement. */
const withScheme = (scheme: unknown, openapi = "3.1.0") =>
  ({
    openapi,
    info,
    paths: { "/pets": { get: op() } },
    security: [{ S: [] }],
    components: { securitySchemes: { S: scheme } },
  }) as const
const flow = (o: Record<string, unknown>) => ({ type: "oauth2", flows: o })

const SEC = "paths/~1pets/get/security"
// POLICY-05 decided (b): a changed OAuth / OpenID Connect URL is risky (clients configured with the before URL fail if
// it stops serving; oasdiff WARN, openapi-diff and libopenapi breaking for OAuth URLs)
// ISSUE-130 (fixed): the class is risky since P1

const cases: CompatCase[] = [
  // ---------------------------------------------------------------------------------------------------------------
  // global requirements
  {
    kind: "doc",
    id: "OAS-SEC-001",
    title: "global security added to an unsecured API",
    before: "no security",
    after: "security [api_key]",
    rationale: "anonymous calls that worked before are now rejected",
    annotation: "names the security requirement (scheme)",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_security_updated_test.go TestAPIGlobalSecurityyAdded (api-security-anonymous-access-removed)",
      },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.6" },
    ],
    covers: ["oasdiff:api-security-anonymous-access-removed"],
    docs: [doc(undefined), doc([{ api_key: [] }])],
    expect: [{ at: "security", action: "add", type: breaking, mentions: ["api_key"] }],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-002",
    title: "global security removed",
    before: "security [api_key]",
    after: "no security",
    rationale: "every operation becomes public; clients sending credentials keep working",
    annotation: "names the removed requirement (scheme)",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_security_updated_test.go TestAPIGlobalSecurityyDeleted (api-security-anonymous-access-added)",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "breaking_rules.go security (removed)", verdict: "breaking" },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.6" },
    ],
    covers: ["oasdiff:api-security-anonymous-access-added"],
    docs: [doc([{ api_key: [] }]), doc(undefined)],
    expect: [{ at: "security", action: "remove", type: nonBreaking, mentions: ["api_key"] }],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-003",
    title: "global alternative requirement added",
    before: "security [api_key]",
    after: "security [api_key] OR [bearer_auth]",
    rationale: "clients using api_key still satisfy one alternative",
    annotation: "names the added alternative (scheme)",
    sources: [
      {
        tool: "oasdiff",
        ref: "TestAPISecurityListPositions apiKey -> apiKey|bearer (api-security-added)",
        verdict: "INFO",
      },
      { tool: "openapi-diff", ref: "backcompat/SecurityRequirementsBCTest::changedButCompatible" },
      { tool: "libopenapi", ref: "security_requirement_test.go TestCompareSecurityRequirement_NewReq_V2" },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.7" },
    ],
    covers: ["oasdiff:api-security-added"],
    docs: [doc([{ api_key: [] }]), doc([{ api_key: [] }, { bearer_auth: [] }])],
    expect: [{ at: "security/1", action: "add", type: nonBreaking, mentions: ["bearer_auth"] }],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-004",
    title: "one of two global alternatives removed",
    before: "security [api_key] OR [bearer_auth]",
    after: "security [api_key]",
    rationale: "clients authenticating with bearer_auth are rejected",
    annotation: "names the removed alternative (scheme)",
    sources: [
      { tool: "oasdiff", ref: "TestAPISecurityListPositions apiKey|bearer -> apiKey (api-security-removed)" },
      { tool: "openapi-diff", ref: "backcompat/SecurityRequirementsBCTest::decreased" },
      { tool: "libopenapi", ref: "security_requirement_test.go TestCompareSecurityRequirement_RemoveReq_V2" },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.8" },
    ],
    covers: ["oasdiff:api-security-removed"],
    docs: [doc([{ api_key: [] }, { bearer_auth: [] }]), doc([{ api_key: [] }])],
    expect: [{ at: "security/1", action: "remove", type: breaking, mentions: ["bearer_auth"] }],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-005",
    title: "global requirement replaced by another scheme",
    before: "security [api_key]",
    after: "security [bearer_auth]",
    rationale: "clients sending the API key are rejected; ASD reports the scheme swap inside the requirement (AND set)",
    annotation: "names the removed and the added scheme",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_security_updated_test.go TestAPIGlobalSecurityReplaced (api-security-removed + api-security-added)",
      },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.9" },
    ],
    covers: ["oasdiff:api-security-removed", "oasdiff:api-security-added"],
    docs: [doc([{ api_key: [] }]), doc([{ bearer_auth: [] }])],
    expect: [
      { at: "security/0/api_key", action: "remove", type: nonBreaking, mentions: ["api_key"] },
      { at: "security/0/bearer_auth", action: "add", type: breaking, mentions: ["bearer_auth"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-SEC-006",
    title: "anonymous alternative added to and removed from global security",
    before: "security [api_key] / [api_key] OR {}",
    after: "security [api_key] OR {} / [api_key]",
    rationale:
      "an empty requirement allows anonymous access: adding it widens access, removing it rejects anonymous calls",
    annotation: "names the anonymous (empty) requirement",
    sources: [
      { tool: "oasdiff", ref: "TestAPISecurityAnonymousAccess op_api_key <-> op_api_key_or_anonymous" },
      { tool: "asd", ref: "test/openapi/document.test.ts C1.10" },
    ],
    covers: ["oasdiff:api-security-anonymous-access-added", "oasdiff:api-security-anonymous-access-removed"],
    docs: {
      added: [doc([{ api_key: [] }]), doc([{ api_key: [] }, {}])],
      removed: [doc([{ api_key: [] }, {}]), doc([{ api_key: [] }])],
    },
    expect: {
      added: [{ at: "security/1", action: "add", type: nonBreaking, mentions: [/anonymous|\{\}|empty/i] }],
      removed: [{ at: "security/1", action: "remove", type: breaking, mentions: [/anonymous|\{\}|empty/i] }],
    },
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-007",
    title: "scope added to and removed from the global requirement",
    before: "security [petstore_auth: [read:pets]] / [read:pets, write:pets]",
    after: "[read:pets, write:pets] / [read:pets]",
    rationale: "requiring an extra scope rejects tokens that lack it; dropping a scope accepts more tokens",
    annotation: "names the scheme and the scope",
    sources: [
      { tool: "oasdiff", ref: "TestAPIGlobalSecurityScopeAdded (api-security-scope-added on inheriting operations)" },
      { tool: "oasdiff", ref: "TestAPIGlobalSecurityScopeRemoved (api-security-scope-removed)", verdict: "INFO" },
      {
        tool: "libopenapi",
        ref: "security_requirement_test.go _AddedRole_V2 / _RemovedRole_V2",
        verdict: "add non-breaking, remove breaking",
      },
    ],
    covers: [
      "oasdiff:api-global-security-scope-added",
      "oasdiff:api-global-security-scope-removed",
      "oasdiff:api-security-scope-added",
      "oasdiff:api-security-scope-removed",
    ],
    docs: {
      added: [doc([{ petstore_auth: ["read:pets"] }]), doc([{ petstore_auth: ["read:pets", "write:pets"] }])],
      removed: [doc([{ petstore_auth: ["read:pets", "write:pets"] }]), doc([{ petstore_auth: ["read:pets"] }])],
    },
    expect: {
      added: [
        { at: "security/0/petstore_auth/*", action: "add", type: breaking, mentions: ["petstore_auth", "write:pets"] },
      ],
      removed: [
        {
          at: "security/0/petstore_auth/*",
          action: "remove",
          type: nonBreaking,
          mentions: ["petstore_auth", "write:pets"],
        },
      ],
    },
    // ISSUE-83 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SEC-008",
    title: "global alternatives reordered",
    before: "security [api_key] OR [bearer_auth]",
    after: "security [bearer_auth] OR [api_key]",
    rationale: "requirement alternatives are a set: the same clients are accepted",
    annotation: "no diff",
    sources: [
      {
        tool: "libopenapi",
        ref: "security_requirement.go (requirements keyed by sorted scheme names)",
        verdict: "no change",
      },
      { tool: "openapi-diff", ref: "SecurityRequirementsDiff.same()", verdict: "no change" },
    ],
    docs: [doc([{ api_key: [] }, { bearer_auth: [] }]), doc([{ bearer_auth: [] }, { api_key: [] }])],
    expect: [],
    // ISSUE-65 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-SEC-009",
    title: "global scopes reordered",
    before: "security [petstore_auth: [read:pets, write:pets]]",
    after: "security [petstore_auth: [write:pets, read:pets]]",
    rationale: "scopes are a set",
    annotation: "no diff",
    sources: [{ tool: "asd", ref: "test/openapi/components-security.test.ts C7.5" }],
    docs: [
      doc([{ petstore_auth: ["read:pets", "write:pets"] }]),
      doc([{ petstore_auth: ["write:pets", "read:pets"] }]),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-SEC-010",
    title: "global security added while every operation declares its own",
    before: "GET /pets security [bearer_auth], no global security",
    after: "global security [api_key], GET /pets still [bearer_auth]",
    rationale:
      "no operation inherits the global requirement, so no request changes (oasdiff api-global-security-added INFO)",
    annotation: "names the global requirement",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_security_updated_test.go TestAPIGlobalSecurityAddedNotInherited",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:api-global-security-added"],
    docs: [doc(undefined, [{ bearer_auth: [] }]), doc([{ api_key: [] }], [{ bearer_auth: [] }])],
    expect: [{ at: "security", action: "add", type: nonBreaking, mentions: ["api_key"] }],
    // ISSUE-67 (fixed): detection and classification pass; the description remains (ISSUE-83)
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-011",
    title: "global security removed while every operation declares its own",
    before: "global security [api_key], GET /pets [bearer_auth]",
    after: "no global security, GET /pets [bearer_auth]",
    rationale: "no operation inherited the global requirement",
    annotation: "names the removed global requirement",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_security_updated_test.go TestAPIGlobalSecurityRemovedNotInherited",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:api-global-security-removed"],
    docs: [doc([{ api_key: [] }], [{ bearer_auth: [] }]), doc(undefined, [{ bearer_auth: [] }])],
    expect: [{ at: "security", action: "remove", type: nonBreaking, mentions: ["api_key"] }],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // operation requirements
  {
    kind: "doc",
    id: "OAS-SEC-012",
    title: "security added to a public operation",
    before: "GET /pets without security (no global security)",
    after: "GET /pets security [api_key]",
    rationale: "anonymous calls are rejected (libopenapi reports it as non-breaking)",
    annotation: "names the operation and the scheme",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_security_updated_test.go TestAPISecurityAdded (api-security-anonymous-access-removed)",
      },
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_AddSecurity", verdict: "non-breaking" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-security-with-authentication-method" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C7.1b" },
    ],
    covers: ["oasdiff:api-security-anonymous-access-removed"],
    docs: [doc(undefined), doc(undefined, [{ api_key: [] }])],
    expect: [{ at: SEC, action: "add", type: breaking, mentions: ["GET /pets", "api_key"] }],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-013",
    title: "security removed from an operation of an API without global security",
    before: "GET /pets security [api_key], no global security",
    after: "GET /pets without security",
    rationale:
      "the operation becomes public, so clients that send the key keep working (oasdiff: anonymous access added, INFO; the fork, openapi-diff and libopenapi report the removal as breaking)",
    annotation: "names the operation and the removed scheme",
    sources: [
      { tool: "oasdiff", ref: "checker/check_api_security_updated_test.go TestAPISecurityDeleted", verdict: "INFO" },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/remove-security-with-authentication-method",
        verdict: "breaking",
      },
      { tool: "openapi-diff", ref: "ChangedSecurityRequirements (requirements decreased)", verdict: "breaking" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C7.1" },
    ],
    covers: ["oasdiff:api-security-anonymous-access-added"],
    docs: [doc(undefined, [{ api_key: [] }]), doc(undefined)],
    expect: [{ at: SEC, action: "remove", type: nonBreaking, mentions: ["GET /pets", "api_key"] }],
    // ISSUE-66 (fixed): detection and classification pass; the description remains (ISSUE-83)
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-014",
    title: "operation overrides the global requirement with another scheme",
    before: "global [api_key], POST /store/order inherits it",
    after: "POST /store/order security [petstore_auth]",
    rationale: "clients sending only the API key are rejected",
    annotation: "names the operation and the new scheme",
    sources: [
      {
        tool: "oasdiff",
        ref: "TestAPISecurityAnonymousAccess global_api_key -> global_api_key_op_bearer (api-security-removed + api-security-added)",
      },
      {
        tool: "asd",
        ref: "test/openapi/openapi3.test.ts should classify as breaking set to default operation security if not equal to default",
      },
      { tool: "bench", ref: "oas-petstore P16" },
    ],
    covers: ["oasdiff:api-security-removed", "oasdiff:api-security-added"],
    docs: [doc([{ api_key: [] }]), doc([{ api_key: [] }], [{ petstore_auth: ["write:pets"] }])],
    expect: [{ at: SEC, action: "add", type: breaking, mentions: ["GET /pets", "petstore_auth"] }],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-015",
    title: "operation requirement equal to the global one made explicit and removed again",
    before: "global [api_key], GET /pets inherits / declares [api_key]",
    after: "GET /pets declares [api_key] / inherits",
    rationale: "the effective requirement is unchanged (test/openapi/components-security.test.ts C7.2)",
    annotation: "names the operation and the scheme",
    sources: [{ tool: "asd", ref: "test/openapi/components-security.test.ts C7.2" }],
    docs: {
      explicit: [doc([{ api_key: [] }]), doc([{ api_key: [] }], [{ api_key: [] }])],
      inherited: [doc([{ api_key: [] }], [{ api_key: [] }]), doc([{ api_key: [] }])],
    },
    expect: [{ at: SEC, type: nonBreaking, mentions: ["GET /pets", "api_key"] }],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-016",
    title: "operation made public with an empty security list, and the override removed",
    before: "global [api_key], GET /pets inherits / security []",
    after: "GET /pets security [] / inherits",
    rationale:
      "security: [] removes authentication for the operation (anonymous access added); removing the override requires the key again",
    annotation: "names the operation and the anonymous access",
    sources: [
      { tool: "oasdiff", ref: "TestAPISecurityAnonymousAccess global_api_key <-> global_api_key_op_anonymous" },
      {
        tool: "asd",
        ref: "test/openapi/openapi3.test.ts should classify as non-breaking remove of operation security",
      },
    ],
    covers: ["oasdiff:api-security-anonymous-access-added", "oasdiff:api-security-anonymous-access-removed"],
    docs: {
      public: [doc([{ api_key: [] }]), doc([{ api_key: [] }], [])],
      secured: [doc([{ api_key: [] }], []), doc([{ api_key: [] }])],
    },
    expect: {
      public: [{ at: SEC, action: "add", type: nonBreaking, mentions: ["GET /pets", /anonymous|public|\[\]/i] }],
      secured: [{ at: SEC, action: "remove", type: breaking, mentions: ["GET /pets", "api_key"] }],
    },
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-017",
    title: "operation alternative requirement added and removed",
    before: "GET /pets [api_key] / [api_key] OR [bearer_auth]",
    after: "[api_key] OR [bearer_auth] / [api_key]",
    rationale: "an extra alternative accepts more clients; removing one rejects its users",
    annotation: "names the operation and the alternative",
    sources: [
      { tool: "oasdiff", ref: "TestAPISecurityAddedToSecuredEndpoint (api-security-added)", verdict: "INFO" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-alternative-authentication-method" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-alternative-authentication-method" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C7.3" },
    ],
    covers: ["oasdiff:api-security-added", "oasdiff:api-security-removed"],
    docs: {
      added: [doc(undefined, [{ api_key: [] }]), doc(undefined, [{ api_key: [] }, { bearer_auth: [] }])],
      removed: [doc(undefined, [{ api_key: [] }, { bearer_auth: [] }]), doc(undefined, [{ api_key: [] }])],
    },
    expect: {
      added: [{ at: `${SEC}/1`, action: "add", type: nonBreaking, mentions: ["GET /pets", "bearer_auth"] }],
      removed: [{ at: `${SEC}/1`, action: "remove", type: breaking, mentions: ["GET /pets", "bearer_auth"] }],
    },
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-018",
    title: "scheme added to and removed from an AND requirement of an operation",
    before: "GET /pets [api_key] / [api_key AND bearer_auth]",
    after: "[api_key AND bearer_auth] / [api_key]",
    rationale:
      "an extra mandatory scheme rejects clients that send only the key; dropping one demands less (the fork expects the removal to be breaking, openapi-diff compatible)",
    annotation: "names the operation and the scheme",
    sources: [
      { tool: "openapi-diff", ref: "backcompat/SecurityRequirementBCTest::schemesIncreased" },
      { tool: "openapi-diff", ref: "backcompat/SecurityRequirementBCTest::changedButCompatible" },
      { tool: "compat-suites", ref: "general-operation-parameters/add-mandatory-authentication-method" },
      {
        tool: "compat-suites",
        ref: "general-operation-parameters/remove-mandatory-authentication-method",
        verdict: "breaking",
      },
    ],
    docs: {
      added: [doc(undefined, [{ api_key: [] }]), doc(undefined, [{ api_key: [], bearer_auth: [] }])],
      removed: [doc(undefined, [{ api_key: [], bearer_auth: [] }]), doc(undefined, [{ api_key: [] }])],
    },
    expect: {
      added: [{ at: `${SEC}/0/bearer_auth`, action: "add", type: breaking, mentions: ["GET /pets", "bearer_auth"] }],
      removed: [
        { at: `${SEC}/0/bearer_auth`, action: "remove", type: nonBreaking, mentions: ["GET /pets", "bearer_auth"] },
      ],
    },
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-019",
    title: "scope added to, removed from and replaced in an operation requirement",
    before: "GET /pets [petstore_auth: [read:pets]] / [read:pets, write:pets] / [write:pets]",
    after: "[read:pets, write:pets] / [read:pets] / [read:pets]",
    rationale: "requiring another scope rejects tokens without it; dropping one accepts more tokens",
    annotation: "names the operation, the scheme and the scope",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_api_security_updated_test.go TestAPISecurityScopeAdded / TestAPISecurityScopeRemoved",
      },
      { tool: "openapi-diff", ref: "backcompat/SecuritySchemeBCTest::scopesIncreased / ::changedButCompatible" },
      {
        tool: "libopenapi",
        ref: "security_requirement_test.go _AddScope_ShowsSchemeName",
        verdict: "add non-breaking, remove breaking",
      },
      { tool: "compat-suites", ref: "general-operation-parameters/add-scope-for-authentication-method" },
      { tool: "compat-suites", ref: "general-operation-parameters/remove-scope-for-authentication-method" },
      { tool: "compat-suites", ref: "general-operation-parameters/update-scope-for-authentication-method" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C7.4" },
    ],
    covers: ["oasdiff:api-security-scope-added", "oasdiff:api-security-scope-removed"],
    docs: {
      added: [
        doc(undefined, [{ petstore_auth: ["read:pets"] }]),
        doc(undefined, [{ petstore_auth: ["read:pets", "write:pets"] }]),
      ],
      removed: [
        doc(undefined, [{ petstore_auth: ["read:pets", "write:pets"] }]),
        doc(undefined, [{ petstore_auth: ["read:pets"] }]),
      ],
      replaced: [
        doc(undefined, [{ petstore_auth: ["write:pets"] }]),
        doc(undefined, [{ petstore_auth: ["read:pets"] }]),
      ],
    },
    expect: {
      added: [{ at: `${SEC}/0/petstore_auth/*`, action: "add", type: breaking, mentions: ["GET /pets", "write:pets"] }],
      removed: [
        { at: `${SEC}/0/petstore_auth/*`, action: "remove", type: nonBreaking, mentions: ["GET /pets", "write:pets"] },
      ],
      replaced: [
        { at: `${SEC}/0/petstore_auth/*`, action: "remove", type: nonBreaking, mentions: ["GET /pets", "write:pets"] },
        { at: `${SEC}/0/petstore_auth/*`, action: "add", type: breaking, mentions: ["GET /pets", "read:pets"] },
      ],
    },
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-020",
    title: "anonymous alternative added to and removed from an operation",
    before: "GET /pets [petstore_auth] / [petstore_auth] OR {}",
    after: "[petstore_auth] OR {} / [petstore_auth]",
    rationale: "{} allows anonymous calls: adding it widens access, removing it rejects anonymous callers",
    annotation: "names the operation and the anonymous access",
    sources: [
      {
        tool: "oasdiff",
        ref: "TestAPISecurityListPositions oauth[read]|{} -> oauth[read,write] (anonymous access removed)",
      },
      { tool: "oasdiff", ref: "TestAPISecurityAnonymousAccess op_api_key_or_anonymous -> op_api_key" },
    ],
    covers: ["oasdiff:api-security-anonymous-access-added", "oasdiff:api-security-anonymous-access-removed"],
    docs: {
      added: [
        doc(undefined, [{ petstore_auth: ["read:pets"] }]),
        doc(undefined, [{ petstore_auth: ["read:pets"] }, {}]),
      ],
      removed: [
        doc(undefined, [{ petstore_auth: ["read:pets"] }, {}]),
        doc(undefined, [{ petstore_auth: ["read:pets"] }]),
      ],
    },
    expect: {
      added: [{ at: `${SEC}/1`, action: "add", type: nonBreaking, mentions: ["GET /pets", /anonymous|\{\}|empty/i] }],
      removed: [{ at: `${SEC}/1`, action: "remove", type: breaking, mentions: ["GET /pets", /anonymous|\{\}|empty/i] }],
    },
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-021",
    title: "operation alternatives reordered",
    before: "GET /pets [petstore_auth] OR [api_key]",
    after: "GET /pets [api_key] OR [petstore_auth]",
    rationale: "alternatives are a set: the same clients are accepted",
    annotation: "no diff",
    sources: [
      { tool: "libopenapi", ref: "security_requirement.go (keyed by sorted scheme names)", verdict: "no change" },
      { tool: "oasdiff", ref: "diff TestDiff_SharedSchemeORAlternatives_* (no phantom diff)", verdict: "no change" },
    ],
    docs: [
      doc(undefined, [{ petstore_auth: ["read:pets"] }, { api_key: [] }]),
      doc(undefined, [{ api_key: [] }, { petstore_auth: ["read:pets"] }]),
    ],
    expect: [],
    // ISSUE-65 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-SEC-022",
    title: "operation requirement switched to another scheme",
    before: "GET /pets [api_key]",
    after: "GET /pets [bearer_auth]",
    rationale: "clients sending the key are rejected; ASD reports the swap inside the AND set",
    annotation: "names the operation and both schemes",
    sources: [
      {
        tool: "oasdiff",
        ref: "TestAPISecurityListPositions apiKey -> bearer (api-security-removed + api-security-added)",
      },
      { tool: "libopenapi", ref: "security_requirement_test.go TestCompareSecurityRequirement_SwapOut_V2" },
    ],
    covers: ["oasdiff:api-security-removed", "oasdiff:api-security-added"],
    docs: [doc(undefined, [{ api_key: [] }]), doc(undefined, [{ bearer_auth: [] }])],
    expect: [
      { at: `${SEC}/0/api_key`, action: "remove", type: nonBreaking, mentions: ["GET /pets", "api_key"] },
      { at: `${SEC}/0/bearer_auth`, action: "add", type: breaking, mentions: ["GET /pets", "bearer_auth"] },
    ],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-023",
    title: "security scheme renamed with an identical definition",
    before: "scheme api_key (apiKey header X-API-Key), global [api_key]",
    after: "scheme key2 with the same definition, global [key2]",
    rationale:
      "clients send the same X-API-Key header, so nothing changes on the wire (openapi-diff matches requirements by scheme type and location and reports no change)",
    annotation: "no breaking diff; annotations may name both scheme names",
    sources: [
      {
        tool: "openapi-diff",
        ref: "SecurityDiffTest::testDiffDifferent (/pet2: renamed scheme with identical definition)",
        verdict: "no change",
      },
    ],
    docs: [doc([{ api_key: [] }], undefined, { api_key: apiKey }), doc([{ key2: [] }], undefined, { key2: apiKey })],
    expect: [
      {
        at: "components/securitySchemes",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["security scheme component", "api_key", "key2"],
      },
      {
        at: "security/0",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["api_key", "key2", "global security"],
      },
    ],
    // ISSUE-78 (fixed); P8c: the optional annotations became the two rename diffs (POLICY-100 / 101)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // security schemes (components)
  {
    kind: "doc",
    id: "OAS-SEC-024",
    title: "security scheme added together with a new alternative requirement",
    before: "scheme api_key, global [api_key]",
    after: "schemes api_key and bearer_auth, global [api_key] OR [bearer_auth]",
    rationale:
      "a new definition alone cannot break a client; the requirement change carries the classification (oasdiff INFO)",
    annotation: "names the added scheme and the added alternative",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_components_security_updated_test.go TestComponentSecurityAdded",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "components.go securitySchemes (added non-breaking)" },
    ],
    covers: ["oasdiff:api-security-component-added", "oasdiff:api-security-added"],
    docs: [
      doc([{ api_key: [] }], undefined, { api_key: apiKey }),
      doc([{ api_key: [] }, { bearer_auth: [] }], undefined, { api_key: apiKey, bearer_auth: bearer }),
    ],
    expect: [
      { at: "security/1", action: "add", type: nonBreaking, mentions: ["bearer_auth"] },
      { at: "components/securitySchemes/bearer_auth", action: "add", type: nonBreaking, mentions: ["bearer_auth"] },
    ],
    // ISSUE-64 (fixed): detection and classification pass; the description remains (ISSUE-83)
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-025",
    title: "security scheme removed together with its alternative requirement",
    before: "schemes api_key and bearer_auth, global [api_key] OR [bearer_auth]",
    after: "scheme api_key, global [api_key]",
    rationale:
      "bearer_auth clients are rejected: the requirement removal is breaking, the scheme definition removal follows it",
    annotation: "names the removed scheme and the removed alternative",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_components_security_updated_test.go TestComponentSecurityRemoved",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "components.go securitySchemes (removed breaking)", verdict: "breaking" },
    ],
    covers: ["oasdiff:api-security-component-removed", "oasdiff:api-security-removed"],
    docs: [
      doc([{ api_key: [] }, { bearer_auth: [] }], undefined, { api_key: apiKey, bearer_auth: bearer }),
      doc([{ api_key: [] }], undefined, { api_key: apiKey }),
    ],
    expect: [
      { at: "security/1", action: "remove", type: breaking, mentions: ["bearer_auth"] },
      { at: "components/securitySchemes/bearer_auth", action: "remove", type: nonBreaking, mentions: ["bearer_auth"] },
    ],
    // ISSUE-83 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-SEC-026",
    title: "unreferenced security scheme added and removed",
    before: "schemes { api_key } / { api_key, unused }",
    after: "{ api_key, unused } / { api_key }",
    rationale:
      "no requirement references the scheme, so no operation changes; extending decision §11.4 (unreferenced components are unclassified) to schemes referenced by name is proposed (option a)",
    annotation: "names the scheme",
    sources: [
      { tool: "oasdiff", ref: "TestComponentSecurityAdded / TestComponentSecurityRemoved", verdict: "INFO" },
      { tool: "openapi-diff", ref: "SecurityRequirementsDiff (unused schemes not detected)", verdict: "no change" },
    ],
    covers: ["oasdiff:api-security-component-added", "oasdiff:api-security-component-removed"],
    docs: {
      added: [
        doc([{ api_key: [] }], undefined, { api_key: apiKey }),
        doc([{ api_key: [] }], undefined, { api_key: apiKey, unused: bearer }),
      ],
      removed: [
        doc([{ api_key: [] }], undefined, { api_key: apiKey, unused: bearer }),
        doc([{ api_key: [] }], undefined, { api_key: apiKey }),
      ],
    },
    expect: [{ at: "components/securitySchemes/unused", type: unclassified, mentions: ["unused"] }],
    // ISSUE-69 (fixed); POLICY-11 decided (a)
  },
  {
    kind: "doc",
    id: "OAS-SEC-027",
    title: "attribute of an unreferenced security scheme changed",
    before: "scheme unused apiKey in header (no requirement references it)",
    after: "in query",
    rationale: "no operation uses the scheme; option a of the policy makes it unclassified",
    annotation: "names the scheme and the field",
    sources: [
      {
        tool: "openapi-diff",
        ref: "SecurityRequirementsDiff (only referenced schemes compared)",
        verdict: "no change",
      },
    ],
    docs: [
      doc([{ api_key: [] }], undefined, { api_key: apiKey, unused: apiKey }),
      doc([{ api_key: [] }], undefined, { api_key: apiKey, unused: { ...apiKey, in: "query" } }),
    ],
    expect: [{ at: "components/securitySchemes/unused/in", type: unclassified, mentions: ["unused", "in"] }],
    // ISSUE-69 (fixed); POLICY-11 decided (a)
  },
  {
    kind: "doc",
    id: "OAS-SEC-028",
    title: "security scheme type changed",
    before: "scheme S apiKey (header X-API-Key)",
    after: "scheme S http bearer",
    rationale: "clients send credentials the server no longer accepts",
    annotation: "names the scheme and the type change",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_components_security_updated_test.go TestComponentSecurityTypeUpdated_WireFieldsNotRepeated",
      },
      { tool: "openapi-diff", ref: "backcompat/SecuritySchemeBCTest::typeChanged" },
      { tool: "libopenapi", ref: "security_scheme_test.go TestCompareSecuritySchemes_v3_ModifyProps" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.5" },
    ],
    covers: ["oasdiff:api-security-component-type-changed"],
    docs: [withScheme(apiKey), withScheme(bearer)],
    expect: [
      { at: "components/securitySchemes/S/type", action: "replace", type: breaking, mentions: ["S", "type"] },
      { at: "components/securitySchemes/S/scheme", action: "add", type: breaking, mentions: ["S", "scheme"] },
      {
        at: ["components/securitySchemes/S/name", "components/securitySchemes/S/in"],
        action: "remove",
        type: nonBreaking,
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-SEC-029",
    title: "apiKey scheme name and location changed",
    before: "S apiKey name X-API-Key in header",
    after: "name X-Token (or in query)",
    rationale: "clients send the key under the old name / location, where it is no longer read",
    annotation: "names the scheme and the field",
    sources: [
      { tool: "oasdiff", ref: "TestComponentSecurityApiKeyNameUpdated / TestComponentSecurityApiKeyInUpdated" },
      { tool: "openapi-diff", ref: "backcompat/SecuritySchemeBCTest::inChanged" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.5" },
    ],
    covers: [
      "oasdiff:api-security-component-api-key-name-changed",
      "oasdiff:api-security-component-api-key-in-changed",
    ],
    docs: {
      name: [withScheme(apiKey), withScheme({ ...apiKey, name: "X-Token" })],
      in: [withScheme(apiKey), withScheme({ ...apiKey, in: "query" })],
    },
    expect: {
      name: [{ at: "components/securitySchemes/S/name", type: breaking, mentions: ["S", "name", "X-Token"] }],
      in: [{ at: "components/securitySchemes/S/in", type: breaking, mentions: ["S", "in", "query"] }],
    },
    // ISSUE-83 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SEC-030",
    title: "HTTP authentication scheme changed",
    before: "S http basic",
    after: "S http bearer",
    rationale: "basic credentials are rejected",
    annotation: "names the scheme and the field",
    sources: [
      { tool: "oasdiff", ref: "TestComponentSecurityHttpSchemeUpdated" },
      { tool: "openapi-diff", ref: "backcompat/SecuritySchemeBCTest::schemeChanged" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.5" },
    ],
    covers: ["oasdiff:api-security-component-http-scheme-changed"],
    docs: [withScheme({ type: "http", scheme: "basic" }), withScheme(bearer)],
    expect: [{ at: "components/securitySchemes/S/scheme", type: breaking, mentions: ["S", "scheme", "bearer"] }],
    // ISSUE-83 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SEC-031",
    title: "HTTP authentication scheme changed only in case",
    before: "S http bearer",
    after: "S http Bearer",
    rationale:
      "HTTP authentication scheme names are case-insensitive (RFC 9110 §11.1), so the same credentials are accepted",
    annotation: "no diff (or an annotation)",
    sources: [{ tool: "oasdiff", ref: "TestComponentSecurityHttpSchemeCaseChanged", verdict: "no change" }],
    docs: [withScheme(bearer), withScheme({ type: "http", scheme: "Bearer" })],
    expect: [{ at: "components/securitySchemes/S/scheme", type: annotation, optional: true }],
    // ISSUE-77 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-SEC-032",
    title: "bearerFormat and scheme description changed",
    before: "S http bearer (bearerFormat JWT)",
    after: "bearerFormat opaque / description added",
    rationale: "bearerFormat is a documentation hint (oasdiff INFO; openapi-diff makes it breaking behind a flag)",
    annotation: "names the scheme and the field",
    sources: [
      { tool: "oasdiff", ref: "TestComponentSecurityBearerFormatUpdated", verdict: "INFO" },
      { tool: "openapi-diff", ref: "backcompat/SecuritySchemeBCTest::bearerFormatChanged", verdict: "breaking" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.5" },
    ],
    covers: ["oasdiff:api-security-component-bearer-format-changed"],
    docs: {
      bearerFormat: [withScheme({ ...bearer, bearerFormat: "JWT" }), withScheme({ ...bearer, bearerFormat: "opaque" })],
      description: [withScheme(bearer), withScheme({ ...bearer, description: "Bearer token" })],
    },
    expect: {
      bearerFormat: [
        { at: "components/securitySchemes/S/bearerFormat", type: annotation, mentions: ["S", "bearerFormat"] },
      ],
      description: [
        { at: "components/securitySchemes/S/description", type: annotation, mentions: ["S", "description"] },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-SEC-033",
    title: "mutualTLS scheme replaces HTTP basic (3.1)",
    before: "S http basic",
    after: "S mutualTLS",
    rationale: "clients without a client certificate are rejected",
    annotation: "names the scheme and the type change",
    sources: [{ tool: "asd", ref: "DESIGN_PROPOSALS §7.2 (3.1 carry-over mutualTLS)" }],
    covers: ["oasdiff:api-security-component-type-changed"],
    docs: [withScheme({ type: "http", scheme: "basic" }), withScheme({ type: "mutualTLS" })],
    expect: [
      { at: "components/securitySchemes/S/type", action: "replace", type: breaking, mentions: ["S", "type"] },
      { at: "components/securitySchemes/S/scheme", action: "remove", type: nonBreaking },
    ],
  },
  {
    kind: "doc",
    id: "OAS-SEC-034",
    title: "openIdConnectUrl changed",
    before: "S openIdConnect https://id.example.com/.well-known/openid-configuration",
    after: "https://login.example.com/.well-known/openid-configuration",
    rationale:
      "clients discover endpoints from the old URL (oasdiff WARN, openapi-diff breaking, libopenapi non-breaking), POLICY-05: risky",
    annotation: "names the scheme and the new URL",
    sources: [
      { tool: "oasdiff", ref: "TestComponentSecurityOpenIdConnectUrlUpdated" },
      { tool: "openapi-diff", ref: "backcompat/SecuritySchemeBCTest::openIdConnectUrlChanged", verdict: "breaking" },
      { tool: "libopenapi", ref: "breaking_rules.go securityScheme.openIdConnectUrl", verdict: "non-breaking" },
    ],
    covers: ["oasdiff:api-security-component-openid-connect-url-changed"],
    docs: [
      withScheme({
        type: "openIdConnect",
        openIdConnectUrl: "https://id.example.com/.well-known/openid-configuration",
      }),
      withScheme({
        type: "openIdConnect",
        openIdConnectUrl: "https://login.example.com/.well-known/openid-configuration",
      }),
    ],
    expect: [
      {
        at: "components/securitySchemes/S/openIdConnectUrl",
        type: risky,
        mentions: ["S", "https://login.example.com/.well-known/openid-configuration"],
      },
    ],
    // ISSUE-83 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SEC-035",
    title: "OAuth flow URLs changed (authorizationUrl, tokenUrl, refreshUrl)",
    before: "S oauth2 authorizationCode with authorizationUrl a, tokenUrl a, refreshUrl a",
    after: "one of the URLs b",
    rationale:
      "clients configured with the old URL fail if it stops serving (oasdiff WARN, openapi-diff and libopenapi breaking), POLICY-05: risky",
    annotation: "names the scheme, the flow and the new URL",
    sources: [
      {
        tool: "oasdiff",
        ref: "TestComponentSecurityOauthURLUpdated / TestComponentSecurityOauthTokenUpdated / TestComponentSecurityOauthFlows",
      },
      {
        tool: "openapi-diff",
        ref: "backcompat/OAuthFlowBCTest::authorizationUrlChanged / ::tokenUrlChanged / ::refreshUrlChanged",
        verdict: "breaking",
      },
      { tool: "libopenapi", ref: "oauth_flows_test.go TestCompareOAuthFlow_Modified" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.6" },
    ],
    covers: [
      "oasdiff:api-security-component-oauth-url-changed",
      "oasdiff:api-security-component-oauth-token-url-changed",
      "oasdiff:api-security-component-oauth-refresh-url-changed",
    ],
    docs: (() => {
      const base = {
        authorizationUrl: "https://a.example.com/auth",
        tokenUrl: "https://a.example.com/token",
        refreshUrl: "https://a.example.com/refresh",
        scopes: {},
      }
      const v = (o: Record<string, unknown>) => withScheme(flow({ authorizationCode: { ...base, ...o } }))
      return {
        authorizationUrl: [v({}), v({ authorizationUrl: "https://b.example.com/auth" })],
        tokenUrl: [v({}), v({ tokenUrl: "https://b.example.com/token" })],
        refreshUrl: [v({}), v({ refreshUrl: "https://b.example.com/refresh" })],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: {
      authorizationUrl: [
        {
          at: "components/securitySchemes/S/flows/authorizationCode/authorizationUrl",
          type: risky,
          mentions: ["S", "authorizationCode", "https://b.example.com/auth"],
        },
      ],
      tokenUrl: [
        {
          at: "components/securitySchemes/S/flows/authorizationCode/tokenUrl",
          type: risky,
          mentions: ["S", "authorizationCode", "https://b.example.com/token"],
        },
      ],
      refreshUrl: [
        {
          at: "components/securitySchemes/S/flows/authorizationCode/refreshUrl",
          type: risky,
          mentions: ["S", "authorizationCode", "https://b.example.com/refresh"],
        },
      ],
    },
    // ISSUE-83 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SEC-036",
    title: "refreshUrl added and removed",
    before: "S oauth2 password flow without / with refreshUrl",
    after: "with / without refreshUrl",
    rationale: "an optional refresh endpoint only adds a capability; removing it breaks clients that refresh tokens",
    annotation: "names the scheme, the flow and the refresh URL",
    sources: [
      { tool: "libopenapi", ref: "breaking_rules.go oauthFlow.refreshUrl", verdict: "breaking (all actions)" },
      { tool: "oasdiff", ref: "TestComponentSecurityOauthFlows (refresh-url changed from empty)", verdict: "WARN" },
    ],
    covers: ["oasdiff:api-security-component-oauth-refresh-url-changed"],
    docs: {
      added: [
        withScheme(flow({ password: { tokenUrl: "https://a.example.com/token", scopes: {} } })),
        withScheme(
          flow({
            password: {
              tokenUrl: "https://a.example.com/token",
              refreshUrl: "https://a.example.com/refresh",
              scopes: {},
            },
          }),
        ),
      ],
      removed: [
        withScheme(
          flow({
            password: {
              tokenUrl: "https://a.example.com/token",
              refreshUrl: "https://a.example.com/refresh",
              scopes: {},
            },
          }),
        ),
        withScheme(flow({ password: { tokenUrl: "https://a.example.com/token", scopes: {} } })),
      ],
    },
    expect: {
      added: [
        {
          at: "components/securitySchemes/S/flows/password/refreshUrl",
          action: "add",
          type: nonBreaking,
          mentions: ["S", "password", "refreshUrl"],
        },
      ],
      removed: [
        {
          at: "components/securitySchemes/S/flows/password/refreshUrl",
          action: "remove",
          type: breaking,
          mentions: ["S", "password", "refreshUrl"],
        },
      ],
    },
    // ISSUE-64 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-SEC-037",
    title: "OAuth flow added and removed",
    before: "S oauth2 clientCredentials / clientCredentials + password",
    after: "clientCredentials + password / clientCredentials",
    rationale: "an extra flow is another way to obtain a token; removing a flow breaks clients that use it",
    annotation: "names the scheme and the flow",
    sources: [
      {
        tool: "libopenapi",
        ref: "oauth_flows_test.go TestCompareOAuthFlows_AddEverything / _RemoveEverything",
        verdict: "add non-breaking, remove breaking",
      },
      { tool: "oasdiff", ref: "coverage waiver (flows add / remove)", verdict: "no rule" },
    ],
    docs: {
      added: [
        withScheme(flow({ clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {} } })),
        withScheme(
          flow({
            clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {} },
            password: { tokenUrl: "https://a.example.com/token", scopes: {} },
          }),
        ),
      ],
      removed: [
        withScheme(
          flow({
            clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {} },
            password: { tokenUrl: "https://a.example.com/token", scopes: {} },
          }),
        ),
        withScheme(flow({ clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {} } })),
      ],
    },
    expect: {
      added: [
        {
          at: "components/securitySchemes/S/flows/password",
          action: "add",
          type: nonBreaking,
          mentions: ["S", "password"],
        },
      ],
      removed: [
        {
          at: "components/securitySchemes/S/flows/password",
          action: "remove",
          type: breaking,
          mentions: ["S", "password"],
        },
      ],
    },
    // ISSUE-64 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-SEC-038",
    title: "OAuth implicit flow replaced by authorizationCode",
    before: "S oauth2 implicit",
    after: "S oauth2 authorizationCode",
    rationale: "clients using the implicit grant can no longer obtain tokens",
    annotation: "names the scheme and both flows",
    sources: [{ tool: "libopenapi", ref: "oauth_flows_test.go TestCompareOAuthFlows_ModifyEverything" }],
    docs: [
      withScheme(flow({ implicit: { authorizationUrl: "https://a.example.com/auth", scopes: {} } })),
      withScheme(
        flow({
          authorizationCode: {
            authorizationUrl: "https://a.example.com/auth",
            tokenUrl: "https://a.example.com/token",
            scopes: {},
          },
        }),
      ),
    ],
    expect: [
      {
        at: "components/securitySchemes/S/flows/implicit",
        action: "remove",
        type: breaking,
        mentions: ["S", "implicit"],
      },
      {
        at: "components/securitySchemes/S/flows/authorizationCode",
        action: "add",
        type: nonBreaking,
        mentions: ["S", "authorizationCode"],
      },
    ],
    // ISSUE-64 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-SEC-039",
    title: "OAuth scope added to, removed from and redescribed in a flow",
    before: "S clientCredentials scopes { read:pets }",
    after: "{ read:pets, write:pets } / {} / { read:pets: new text }",
    rationale:
      "a new scope is an option; removing one makes token requests for it fail (oasdiff INFO, libopenapi breaking); the scope text is documentation (libopenapi flags it breaking)",
    annotation: "names the scheme and the scope",
    sources: [
      {
        tool: "oasdiff",
        ref: "TestComponentSecurityOauthScopeAdded / ...ScopeRemoved / ...ScopeUpdated",
        verdict: "INFO",
      },
      {
        tool: "libopenapi",
        ref: "oauth_flows_test.go TestCompareOAuthFlow_AddScope / _RemoveScope / _ModifyScope",
        verdict: "remove and modify breaking",
      },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.6" },
    ],
    covers: [
      "oasdiff:api-security-component-oauth-scope-added",
      "oasdiff:api-security-component-oauth-scope-removed",
      "oasdiff:api-security-component-oauth-scope-changed",
    ],
    docs: (() => {
      const v = (scopes: Record<string, string>) =>
        withScheme(flow({ clientCredentials: { tokenUrl: "https://a.example.com/token", scopes } }))
      return {
        added: [v({ "read:pets": "read" }), v({ "read:pets": "read", "write:pets": "write" })],
        removed: [v({ "read:pets": "read", "write:pets": "write" }), v({ "read:pets": "read" })],
        described: [v({ "read:pets": "read" }), v({ "read:pets": "read your pets" })],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: {
      added: [
        {
          at: "components/securitySchemes/S/flows/clientCredentials/scopes/write:pets",
          action: "add",
          type: nonBreaking,
          mentions: ["S", "write:pets"],
        },
      ],
      removed: [
        {
          at: "components/securitySchemes/S/flows/clientCredentials/scopes/write:pets",
          action: "remove",
          type: breaking,
          mentions: ["S", "write:pets"],
        },
      ],
      described: [
        {
          at: "components/securitySchemes/S/flows/clientCredentials/scopes/read:pets",
          action: "replace",
          type: annotation,
          mentions: ["S", "read:pets"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-SEC-040",
    title: "3.2 deviceAuthorization flow added and its URL changed",
    before: "S oauth2 clientCredentials / deviceAuthorization url a",
    after: "clientCredentials + deviceAuthorization / url b",
    rationale:
      "an extra flow only adds a way to obtain tokens; a changed device authorization URL behaves like the other OAuth URLs",
    annotation: "names the scheme, the flow and the URL",
    sources: [
      {
        tool: "libopenapi",
        ref: "oauth_flows_test.go TestCompareOAuthFlows_DeviceFlowAdded / _DeviceFlowModified (key `device`)",
      },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G11" },
    ],
    docs: {
      added: [
        withScheme(flow({ clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {} } }), "3.2.0"),
        withScheme(
          flow({
            clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {} },
            deviceAuthorization: {
              deviceAuthorizationUrl: "https://a.example.com/device",
              tokenUrl: "https://a.example.com/token",
              scopes: {},
            },
          }),
          "3.2.0",
        ),
      ],
    },
    expect: {
      added: [
        {
          at: "components/securitySchemes/S/flows/deviceAuthorization",
          action: "add",
          type: nonBreaking,
          mentions: ["S", "deviceAuthorization"],
        },
      ],
    },
    // ISSUE-64 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-SEC-041",
    title: "3.2 deviceAuthorizationUrl changed",
    before: "S deviceAuthorization deviceAuthorizationUrl a",
    after: "deviceAuthorizationUrl b",
    rationale: "clients configured with the old URL fail if it stops serving, POLICY-05: risky",
    annotation: "names the scheme, the flow and the new URL",
    sources: [
      { tool: "libopenapi", ref: "oauth_flows_test.go TestCompareOAuthFlows_DeviceFlowModified" },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G11" },
    ],
    docs: [
      withScheme(
        flow({
          deviceAuthorization: {
            deviceAuthorizationUrl: "https://a.example.com/device",
            tokenUrl: "https://a.example.com/token",
            scopes: {},
          },
        }),
        "3.2.0",
      ),
      withScheme(
        flow({
          deviceAuthorization: {
            deviceAuthorizationUrl: "https://b.example.com/device",
            tokenUrl: "https://a.example.com/token",
            scopes: {},
          },
        }),
        "3.2.0",
      ),
    ],
    expect: [
      {
        at: "components/securitySchemes/S/flows/deviceAuthorization/deviceAuthorizationUrl",
        type: risky,
        mentions: ["S", "https://b.example.com/device"],
      },
    ],
    // ISSUE-83 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-SEC-042",
    title: "3.2 oauth2MetadataUrl added",
    before: "S oauth2 without oauth2MetadataUrl",
    after: "S oauth2 with oauth2MetadataUrl",
    rationale: "an optional discovery document only adds information (libopenapi non-breaking)",
    annotation: "names the scheme and the metadata URL",
    sources: [
      {
        tool: "libopenapi",
        ref: "openapi32_breaking_rules_test.go TestDefaultBreakingRules_OAuth2MetadataUrl",
        verdict: "non-breaking",
      },
    ],
    docs: [
      withScheme(flow({ clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {} } }), "3.2.0"),
      withScheme(
        {
          ...flow({ clientCredentials: { tokenUrl: "https://a.example.com/token", scopes: {} } }),
          oauth2MetadataUrl: "https://a.example.com/.well-known/oauth-authorization-server",
        },
        "3.2.0",
      ),
    ],
    expect: [
      {
        at: "components/securitySchemes/S/oauth2MetadataUrl",
        action: "add",
        type: nonBreaking,
        mentions: ["S", "oauth2MetadataUrl"],
      },
    ],
    // ISSUE-64 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-SEC-043",
    title: "3.2 security scheme deprecated",
    before: "S http bearer",
    after: "S http bearer deprecated: true",
    rationale: "deprecation announces a future removal; nothing breaks now",
    annotation: "names the scheme and the deprecation",
    sources: [
      { tool: "libopenapi", ref: "breaking_rules.go securityScheme.deprecated", verdict: "non-breaking" },
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G11" },
    ],
    docs: [withScheme(bearer, "3.2.0"), withScheme({ ...bearer, deprecated: true }, "3.2.0")],
    expect: [{ at: "components/securitySchemes/S/deprecated", type: deprecated, mentions: ["S", "deprecated"] }],
  },
  {
    kind: "doc",
    id: "OAS-SEC-044",
    title: "attribute of a scheme referenced only by an operation changed",
    before: "GET /pets security [api_key] (no global), api_key in header",
    after: "api_key in query",
    rationale: "the operation's clients send the key in the header, where it is no longer read",
    annotation: "names the scheme and the field",
    sources: [{ tool: "openapi-diff", ref: "backcompat/SecuritySchemeBCTest::inChanged" }],
    covers: ["oasdiff:api-security-component-api-key-in-changed"],
    docs: [
      doc(undefined, [{ api_key: [] }]),
      doc(undefined, [{ api_key: [] }], { ...schemes, api_key: { ...apiKey, in: "query" } }),
    ],
    expect: [{ at: "components/securitySchemes/api_key/in", type: breaking, mentions: ["api_key", "in"] }],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // POLICY-101 (P8c): a scheme renamed and changed at once is paired by the requirements that name it
  {
    kind: "doc",
    id: "OAS-SEC-045",
    title: "security scheme renamed with every requirement repointed and a compatible change",
    before: "scheme petstore_auth (client credentials flow), global [petstore_auth]",
    after: "scheme oauth with an added authorization code flow, global [oauth]",
    rationale:
      "POLICY-101: every requirement moved from petstore_auth to oauth, so the key change is a rename (annotation); the definitions are compared on their own: one more way to obtain a token is non-breaking",
    annotation: "names both scheme names for the renames; the added flow with the scheme",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101" }],
    docs: [
      doc([{ petstore_auth: ["read:pets"] }], undefined, { petstore_auth: oauth }),
      doc([{ oauth: ["read:pets"] }], undefined, {
        oauth: {
          ...oauth,
          flows: {
            ...oauth.flows,
            authorizationCode: {
              authorizationUrl: "https://auth.example.com/authorize",
              tokenUrl: "https://auth.example.com/token",
              scopes: { "read:pets": "" },
            },
          },
        },
      }),
    ],
    expect: [
      {
        at: "components/securitySchemes",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["petstore_auth", "oauth"],
      },
      { at: "security/0", action: "rename", type: annotation, count: 1, mentions: ["petstore_auth", "oauth"] },
      {
        at: "components/securitySchemes/petstore_auth/flows/authorizationCode",
        action: "add",
        type: nonBreaking,
        count: 1,
        mentions: ["authorizationCode"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-SEC-046",
    title: "security scheme renamed with every requirement repointed and a breaking change",
    before: "scheme api_key (header X-API-Key), global [api_key] and GET /pets [api_key]",
    after: "scheme key2 (header X-Key), global [key2] and GET /pets [key2]",
    rationale:
      "POLICY-101: the rename itself is an annotation in the scheme map and in each requirement; clients still send X-API-Key, which is no longer read: the header name change is breaking",
    annotation: "names both scheme names for the renames; the changed header name with the scheme",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101" }],
    docs: [
      doc([{ api_key: [] }], [{ api_key: [] }], { api_key: apiKey }),
      doc([{ key2: [] }], [{ key2: [] }], { key2: { ...apiKey, name: "X-Key" } }),
    ],
    expect: [
      { at: "components/securitySchemes", action: "rename", type: annotation, count: 1, mentions: ["api_key", "key2"] },
      {
        at: ["security/0", `${SEC}/0`],
        action: "rename",
        type: annotation,
        count: 2,
        mentions: ["api_key", "key2"],
      },
      {
        at: "components/securitySchemes/api_key/name",
        action: "replace",
        type: breaking,
        count: 1,
        mentions: ["name", "X-API-Key", "X-Key"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-SEC-047",
    title: "security scheme renamed with only some requirements repointed and most fields kept is a rename",
    before: "scheme api_key (header X-API-Key), global [api_key] and GET /pets [api_key]",
    after: "scheme key2 (header X-Key) and bearer_auth, global [key2], GET /pets [bearer_auth]",
    rationale:
      "POLICY-105 decided (P8d): GET /pets moved to another scheme, so the requirements of key2 are not those of api_key (POLICY-101), but 2 of the 3 direct fields of the definitions are equal (type, in), so api_key was renamed to key2: a rename annotation in the scheme map and in the global requirement, the header name change classified on its own; GET /pets reports its own requirement change",
    annotation: "names both scheme names for the rename; the changed header name with the scheme",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101 / POLICY-105" }],
    docs: [
      doc([{ api_key: [] }], [{ api_key: [] }], { api_key: apiKey }),
      doc([{ key2: [] }], [{ bearer_auth: [] }], { key2: { ...apiKey, name: "X-Key" }, bearer_auth: bearer }),
    ],
    // POLICY-105 decided (P8d): the former expectation (POLICY-101 alone) was a removed api_key and an added key2, in
    // the scheme map and in the global requirement
    expect: [
      {
        at: "components/securitySchemes",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["api_key", "key2"],
      },
      {
        at: "security/0",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["api_key", "key2", "global security"],
      },
      {
        at: "components/securitySchemes/api_key/name",
        action: "replace",
        type: breaking,
        count: 1,
        mentions: ["X-API-Key", "X-Key", "key2"],
      },
      { at: "components/securitySchemes/bearer_auth", action: "add", type: nonBreaking, count: 1 },
      { at: `${SEC}/0/api_key`, action: "remove", type: nonBreaking, count: 1, mentions: ["api_key", "GET /pets"] },
      { at: `${SEC}/0/bearer_auth`, action: "add", type: breaking, count: 1, mentions: ["bearer_auth", "GET /pets"] },
    ],
  },
]

runCases("openapi", "security", cases, import.meta.filename)
