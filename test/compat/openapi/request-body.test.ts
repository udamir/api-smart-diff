import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const json = (schema: unknown = str) => ({ "application/json": { schema } })
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
/** POST /a with the given request body (omitted when undefined) */
const post = (requestBody?: unknown, extra: Record<string, unknown> = {}, openapi?: string) =>
  oas({ "/a": { post: { ...(requestBody ? { requestBody } : {}), responses: ok } } }, extra, openapi)
const rbRef = { $ref: "#/components/requestBodies/PetBody" }
const withB = (b: unknown, usage: unknown = rbRef) => post(usage, { components: { requestBodies: { PetBody: b } } })

const RB = "paths/~1a/post/requestBody"
const reqBody = /request body/i

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-RB-001",
    title: "optional request body added",
    before: "POST /a without request body",
    after: "POST /a with an optional JSON request body",
    rationale: "existing callers send no body, which an optional body allows",
    annotation: "states that the request body was added",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Operation Object requestBody (supported)" },
      {
        tool: "oasdiff",
        ref: "checker/check_added_required_request_body.go request-body-added-optional",
        verdict: "INFO",
      },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.1" },
      { tool: "fork", ref: "test/human-readable/openapi/request-body-object.test.ts Request Body Inline" },
    ],
    covers: ["oasdiff:request-body-added-optional"],
    docs: [post(), post({ content: json() })],
    expect: [{ at: RB, action: "add", type: nonBreaking, mentions: [reqBody] }],
  },
  {
    kind: "doc",
    id: "OAS-RB-002",
    title: "required request body added",
    before: "POST /a without request body",
    after: "POST /a with a required JSON request body",
    rationale: "existing callers send no body, which the server now rejects",
    annotation: "states that the request body was added",
    sources: [
      { tool: "oasdiff", ref: "checker/check_added_required_request_body.go request-body-added-required" },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.2" },
      { tool: "bench", ref: "oas-petstore P15" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Operation.RequestBody added" },
    ],
    covers: ["oasdiff:request-body-added-required"],
    docs: [post(), post({ required: true, content: json() })],
    expect: [{ at: RB, action: "add", type: breaking, mentions: [reqBody] }],
  },
  {
    kind: "doc",
    id: "OAS-RB-003",
    title: "optional request body removed",
    before: "POST /a with an optional JSON request body",
    after: "POST /a without request body",
    rationale: "callers that send the documented body may now be rejected or have it ignored silently",
    annotation: "states that the request body was removed",
    sources: [
      { tool: "oasdiff", ref: "checker/check_request_body_removed_test.go TestRequestBodyRemovedOptional" },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Operation.RequestBody removed" },
    ],
    covers: ["oasdiff:request-body-removed"],
    docs: [post({ content: json() }), post()],
    expect: [{ at: RB, action: "remove", type: breaking, mentions: [reqBody] }],
  },
  {
    kind: "doc",
    id: "OAS-RB-004",
    title: "required request body removed",
    before: "POST /a with a required JSON request body",
    after: "POST /a without request body",
    rationale: "every existing caller sends a body the operation no longer accepts",
    annotation: "states that the request body was removed",
    sources: [
      { tool: "oasdiff", ref: "checker/check_request_body_removed_test.go TestRequestBodyRemoved" },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.1" },
    ],
    covers: ["oasdiff:request-body-removed"],
    docs: [post({ required: true, content: json() }), post()],
    expect: [{ at: RB, action: "remove", type: breaking, mentions: [reqBody] }],
  },
  {
    kind: "doc",
    id: "OAS-RB-005",
    title: "request body became required",
    before: "optional request body (required absent or false)",
    after: "required: true",
    rationale: "callers that omit the body are now rejected",
    annotation: "names the required status of the request body",
    sources: [
      { tool: "atlassian-openapi-diff", ref: "docs/OPENAPI3.md Request Body Object required (not supported)" },
      {
        tool: "oasdiff",
        ref: "checker/check_request_body_required_value_updated_test.go TestRequestBodyBecameRequired",
      },
      { tool: "openapi-diff", ref: "core/src/test/.../backcompat/RequestBodyBCTest.java requiredChanged" },
      { tool: "fork", ref: "test/human-readable/openapi/request-body-object.test.ts Required Inline" },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.3" },
    ],
    covers: ["oasdiff:request-body-became-required"],
    docs: {
      absent: [post({ content: json() }), post({ required: true, content: json() })],
      false: [post({ required: false, content: json() }), post({ required: true, content: json() })],
    },
    expect: [{ at: `${RB}/required`, action: ["add", "replace"], type: breaking, mentions: ["required", reqBody] }],
  },
  {
    kind: "doc",
    id: "OAS-RB-006",
    title: "request body became optional",
    before: "required: true",
    after: "required: false or absent",
    rationale: "callers that always send the body keep working",
    annotation: "names the required status of the request body",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_body_required_value_updated_test.go TestRequestBodyBecameOptional",
        verdict: "INFO",
      },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.3" },
    ],
    covers: ["oasdiff:request-body-became-optional"],
    docs: {
      false: [post({ required: true, content: json() }), post({ required: false, content: json() })],
      absent: [post({ required: true, content: json() }), post({ content: json() })],
    },
    expect: [
      { at: `${RB}/required`, action: ["remove", "replace"], type: nonBreaking, mentions: ["required", reqBody] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-RB-007",
    title: "explicit default required: false added to the request body",
    before: "request body without `required`",
    after: "request body with `required: false`",
    rationale: "false is the default of Request Body `required`: the contract is unchanged",
    annotation: "no diff, or an annotation naming the required status",
    sources: [
      {
        tool: "compat-suites",
        ref: "openapi/response add-required-attribute-with-default-value-for-header (same default rule)",
      },
      { tool: "fork", ref: "test/compatibility-suites/openapi/response.test.ts Add/remove default values" },
    ],
    docs: [post({ content: json() }), post({ required: false, content: json() })],
    expect: [{ at: `${RB}/required`, type: annotation, optional: true, mentions: ["required", reqBody] }],
    // ISSUE-70 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RB-008",
    title: "request body description added, changed, removed",
    before: "description absent / `a`",
    after: "description `a` / `b` / absent",
    rationale: "documentation only",
    annotation: "names the description of the request body",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/request-body-object.test.ts Description Inline" },
      { tool: "libopenapi", ref: "what-changed/model/request_body_test.go description" },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.9" },
    ],
    docs: {
      add: [post({ content: json() }), post({ description: "a", content: json() })],
      change: [post({ description: "a", content: json() }), post({ description: "b", content: json() })],
      remove: [post({ description: "a", content: json() }), post({ content: json() })],
    },
    expect: [{ at: `${RB}/description`, type: annotation, mentions: ["description", reqBody] }],
  },
  {
    kind: "doc",
    id: "OAS-RB-009",
    title: "content added to a request body that had none",
    before: "request body with a description and no content",
    after: "request body with application/json content",
    rationale: "fixing a request body that lacked its required `content` map documents what was accepted anyway",
    annotation: "names the added media type of the request body",
    sources: [
      {
        tool: "fork",
        ref: "test/openapi.add-required-fields.test.ts adding content to requestBody at operation is not breaking",
      },
    ],
    docs: [post({ description: "d" }), post({ description: "d", content: json() })],
    expect: [
      {
        at: [`${RB}/content`, `${RB}/content/application~1json`],
        action: "add",
        type: nonBreaking,
        mentions: ["application/json", reqBody],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-RB-010",
    title: "$ref request body (components.requestBodies) became required",
    before: "POST /a requestBody $ref B, B optional",
    after: "B required: true",
    rationale: "callers of every operation using B that omit the body are rejected",
    annotation: "names the required status of the request body at the usage site and in component B",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/request-body-object.test.ts Required Ref" },
      { tool: "asd", ref: "test/openapi/request-body-content.test.ts C4.10" },
    ],
    covers: ["oasdiff:request-body-became-required"],
    docs: [withB({ content: json() }), withB({ required: true, content: json() })],
    expect: [
      { at: `${RB}/required`, action: "add", type: breaking, mentions: ["required", reqBody] },
      {
        at: "components/requestBodies/PetBody/required",
        action: "add",
        type: breaking,
        mentions: ["required", "PetBody"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-RB-011",
    title: "$ref request body shared by two operations loses a media type",
    before: "POST /a and PUT /b reference B with json and xml",
    after: "B has json only",
    rationale: "callers sending xml to either operation are rejected; the change is reported once per usage site",
    annotation: "names the removed media type at each usage site and in component B",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/request-body-object.test.ts Content Media Type Ref" },
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §11.4 (usage-derived components)" },
    ],
    covers: ["oasdiff:request-body-media-type-removed"],
    docs: [
      oas(
        { "/a": { post: { requestBody: rbRef, responses: ok } }, "/b": { put: { requestBody: rbRef, responses: ok } } },
        { components: { requestBodies: { PetBody: { content: { ...json(), "application/xml": { schema: str } } } } } },
      ),
      oas(
        { "/a": { post: { requestBody: rbRef, responses: ok } }, "/b": { put: { requestBody: rbRef, responses: ok } } },
        { components: { requestBodies: { PetBody: { content: json() } } } },
      ),
    ],
    expect: [
      {
        at: [
          "paths/~1a/post/requestBody/content/application~1xml",
          "paths/~1b/put/requestBody/content/application~1xml",
        ],
        action: "remove",
        type: breaking,
        mentions: ["application/xml", reqBody],
      },
      {
        at: "components/requestBodies/PetBody/content/application~1xml",
        action: "remove",
        type: breaking,
        mentions: ["application/xml", "PetBody"],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-RB-012",
    title: "inline request body moved to components.requestBodies unchanged",
    before: "inline request body; components.requestBodies.B already identical",
    after: "requestBody $ref B",
    rationale: "the resolved request body is identical: no consumer-visible change",
    annotation: "no diff",
    sources: [
      { tool: "fork", ref: "test/human-readable/openapi/request-body-object.test.ts Request Body Ref vs Inline" },
    ],
    docs: [withB({ content: json() }, { content: json() }), withB({ content: json() })],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-RB-013",
    title: "$ref request body replaced by an identical inline body",
    before: "requestBody $ref B",
    after: "inline copy of B (B kept)",
    rationale: "the resolved request body is identical",
    annotation: "no diff",
    sources: [{ tool: "fork", ref: "test/human-readable/openapi/request-body-object.test.ts" }],
    docs: [withB({ content: json() }), withB({ content: json() }, { content: json() })],
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-RB-014",
    title: "3.1 reference object: overriding description added next to the request body $ref",
    before: "requestBody: { $ref: B } (B.description `c`)",
    after: "requestBody: { $ref: B, description: `o` }",
    rationale: "OAS 3.1 Reference Object `description` overrides the referenced description; documentation only",
    annotation: "names the description of the request body",
    sources: [
      { tool: "compat-suites", ref: "openapi/request-body add-overriden-description" },
      { tool: "fork", ref: "test/compatibility-suites/openapi/request-body.test.ts runRefObjectDescriptionTests" },
    ],
    docs: [
      withB({ description: "c", content: json() }),
      withB({ description: "c", content: json() }, { ...rbRef, description: "o" }),
    ],
    expect: [
      { at: `${RB}/description`, action: ["add", "replace"], type: annotation, mentions: ["description", reqBody] },
    ],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RB-015",
    title: "3.1 reference object: overriding description removed from the request body $ref",
    before: "requestBody: { $ref: B, description: `o` }",
    after: "requestBody: { $ref: B }",
    rationale: "the referenced description `c` is shown again; documentation only",
    annotation: "names the description of the request body",
    sources: [{ tool: "compat-suites", ref: "openapi/request-body remove-overriden-description" }],
    docs: [
      withB({ description: "c", content: json() }, { ...rbRef, description: "o" }),
      withB({ description: "c", content: json() }),
    ],
    expect: [
      { at: `${RB}/description`, action: ["remove", "replace"], type: annotation, mentions: ["description", reqBody] },
    ],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RB-016",
    title: "3.1 reference object: overriding description of the request body $ref changed",
    before: "requestBody: { $ref: B, description: `o1` }",
    after: "requestBody: { $ref: B, description: `o2` }",
    rationale: "documentation only",
    annotation: "names the description of the request body",
    sources: [{ tool: "compat-suites", ref: "openapi/request-body change-overriden-description" }],
    docs: [
      withB({ description: "c", content: json() }, { ...rbRef, description: "o1" }),
      withB({ description: "c", content: json() }, { ...rbRef, description: "o2" }),
    ],
    expect: [{ at: `${RB}/description`, action: "replace", type: annotation, mentions: ["description", reqBody] }],
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RB-017",
    title: "3.1 reference object: referenced description changed while the usage overrides it",
    before: "requestBody: { $ref: B, description: `o` }, B.description `c1`",
    after: "B.description `c2`",
    rationale: "the usage site still shows `o`: only the component itself changed",
    annotation: "names the description of component B; nothing at the usage site",
    sources: [
      { tool: "compat-suites", ref: "openapi/request-body change-referenced-description-when-overridden-exists" },
    ],
    docs: [
      withB({ description: "c1", content: json() }, { ...rbRef, description: "o" }),
      withB({ description: "c2", content: json() }, { ...rbRef, description: "o" }),
    ],
    expect: [
      {
        at: "components/requestBodies/PetBody/description",
        action: "replace",
        type: annotation,
        mentions: ["description", "PetBody"],
      },
    ],
    // ISSUE-60 (fixed for this variant): the referenced change is reported at the declaration only (POLICY-57); the
    // declaration diff does not name its component PetBody, ISSUE-56
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-RB-018",
    title: "unreferenced components.requestBodies entry changed",
    before: "components.requestBodies.B (unused) with string schema",
    after: "B schema integer, B required",
    rationale: "no operation uses B: decision §11.4 classifies unreferenced components as unclassified",
    annotation: "names component B and the changed field",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §11.4; test/openapi/components-security.test.ts C6.3" }],
    docs: [
      oas({ "/a": { get: { responses: ok } } }, { components: { requestBodies: { PetBody: { content: json() } } } }),
      oas(
        { "/a": { get: { responses: ok } } },
        { components: { requestBodies: { PetBody: { required: true, content: json({ type: "integer" }) } } } },
      ),
    ],
    expect: [
      { at: "components/requestBodies/PetBody/required", type: unclassified, mentions: ["required", "PetBody"] },
      {
        at: "components/requestBodies/PetBody/content/application~1json/schema/type",
        type: unclassified,
        mentions: ["type", "PetBody"],
      },
    ],
    // ISSUE-56 (fixed) (P8a); ISSUE-69 (fixed): detection and classification pass; the description remains (ISSUE-56)
  },
  {
    kind: "doc",
    id: "OAS-RB-019",
    title: "request body vendor extension added",
    before: "request body without extensions",
    after: "request body with `x-codegen: true`",
    rationale: "vendor extensions carry no wire contract",
    annotation: "names the extension key and the request body",
    sources: [{ tool: "compat-suites", ref: "openapi/response add-custom-property (request-body analogue)" }],
    docs: [post({ content: json() }), post({ "x-codegen": true, content: json() })],
    expect: [{ at: `${RB}/x-codegen`, action: "add", type: annotation, mentions: ["x-codegen", reqBody] }],
    // POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "OAS-RB-020",
    title: "readOnly property made required in a request body (3.0)",
    before: "request schema with readOnly `id`, not required",
    after: "`id` listed in `required`",
    rationale:
      "OAS 3.0 Schema Object: a readOnly property listed in `required` is required in responses only, so callers still omit it",
    annotation: "names the required status of `id` in the request body",
    sources: [
      {
        tool: "openapi-diff",
        ref: "core/src/test/resources/bc_request_readonly_required_decreased.yaml",
        verdict: "compatible",
      },
      { tool: "oasdiff", ref: "checker/check_request_property_became_required.go (readOnly properties skipped)" },
    ],
    docs: [
      post({ content: json({ type: "object", properties: { id: { type: "integer", readOnly: true } } }) }, {}, "3.0.3"),
      post(
        {
          content: json({ type: "object", properties: { id: { type: "integer", readOnly: true } }, required: ["id"] }),
        },
        {},
        "3.0.3",
      ),
    ],
    expect: [
      {
        at: `${RB}/content/application~1json/schema/required/**`,
        action: "add",
        type: nonBreaking,
        mentions: ["required", "`id`", reqBody],
      },
    ],
    // ISSUE-72 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-RB-021",
    title: "new required readOnly property in a request body (3.0)",
    before: "request schema without `id`",
    after: "`id` readOnly and required",
    rationale: "callers must not send readOnly properties, and `required` applies to responses only (OAS 3.0)",
    annotation: "names the added property `id` in the request body",
    sources: [
      {
        tool: "openapi-diff",
        ref: "core/src/test/resources/bc_request_readonly_increased.yaml",
        verdict: "compatible",
      },
    ],
    docs: [
      post({ content: json({ type: "object", properties: {} }) }, {}, "3.0.3"),
      post(
        {
          content: json({ type: "object", properties: { id: { type: "integer", readOnly: true } }, required: ["id"] }),
        },
        {},
        "3.0.3",
      ),
    ],
    expect: [
      {
        at: [
          `${RB}/content/application~1json/schema/properties/id`,
          `${RB}/content/application~1json/schema/required/**`,
        ],
        action: "add",
        type: nonBreaking,
        mentions: ["`id`", reqBody],
      },
    ],
    // ISSUE-72 (fixed)
  },
]

runCases("openapi", "request-body", cases, import.meta.filename)
