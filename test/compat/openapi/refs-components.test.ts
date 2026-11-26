import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, risky, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const oas = (paths: Record<string, unknown>, schemas: Record<string, unknown>, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  components: { schemas },
})
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema: unknown) => ({ content: { "application/json": { schema } } })
const resOp = (name = "Pet", code = 200) => ({
  get: { responses: { [code]: { description: "ok", ...json(ref(name)) } } },
})
const reqOp = (name = "Pet") => ({ post: { requestBody: json(ref(name)), responses: ok } })
const bothOp = (name = "Pet") => ({
  post: { requestBody: json(ref(name)), responses: { 200: { description: "ok", ...json(ref(name)) } } },
})
const pet = (props: Record<string, unknown> = {}, required?: string[]) => ({
  type: "object",
  properties: { id: { type: "integer" }, ...props },
  ...(required ? { required } : {}),
})

// P8e (POLICY-111 / 113): a schema holding a reference, a titled one and a leaf, and an inline request body
const holder = (to: string) => ({ type: "object", properties: { next: ref(to) } })
const titled = (title: string, to: string) => ({ title, properties: { next: ref(to) } })
const leaf = { type: "object", title: "leaf", properties: { id: { type: "integer" } } }
const inlineReq = (schema: unknown) => ({ post: { requestBody: json(schema), responses: ok } })

/** usage sites of a Pet change in GET /a (response), POST /b (request), POST /c (request + response) */
const RES = "paths/~1a/get/responses/200/content/application~1json/schema"
const REQ = "paths/~1b/post/requestBody/content/application~1json/schema"
const COMP = "components/schemas/Pet"

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-REF-001",
    title: "response-only component property type changed",
    before: "Pet (used by one response) id integer",
    after: "id string",
    rationale:
      "clients parsing `id` as a number fail; reported at the usage and in the component (usage-derived response semantics)",
    annotation: "names `id` at the usage site (status, media type) and in component Pet",
    sources: [
      { tool: "bench", ref: "oas-petstore P4; github G12" },
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §11.4" },
    ],
    docs: [
      oas({ "/a": resOp() }, { Pet: pet() }),
      oas({ "/a": resOp() }, { Pet: { ...pet(), properties: { id: str } } }),
    ],
    expect: [
      { at: `${RES}/properties/id/type`, type: breaking, mentions: ["`id`", "200", "application/json"] },
      { at: `${COMP}/properties/id/type`, type: breaking, mentions: ["id", "Pet"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-002",
    title: "response-only component gains a required property",
    before: "Pet (response only) { id }",
    after: "Pet { id, name } with name required",
    rationale:
      "the server now always sends `name`: a stronger guarantee for clients, also in the component (decision §11.4)",
    annotation: "names `name` at the usage site and in component Pet",
    sources: [
      { tool: "bench", ref: "oas-petstore P6; github G15" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.1" },
    ],
    docs: [oas({ "/a": resOp() }, { Pet: pet() }), oas({ "/a": resOp() }, { Pet: pet({ name: str }, ["name"]) })],
    expect: [
      {
        at: [`${RES}/properties/name`, `${RES}/required/**`],
        action: "add",
        type: nonBreaking,
        mentions: ["`name`", "200"],
      },
      {
        at: [`${COMP}/properties/name`, `${COMP}/required/**`],
        action: "add",
        type: nonBreaking,
        mentions: ["name", "Pet"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-003",
    title: "response-only component gains an optional property",
    before: "Pet (response only) { id }",
    after: "Pet { id, traceId }",
    rationale: "clients ignore unknown properties",
    annotation: "names `traceId` at the usage site and in component Pet",
    sources: [{ tool: "bench", ref: "oas-petstore P5; github G13" }],
    docs: [oas({ "/a": resOp() }, { Pet: pet() }), oas({ "/a": resOp() }, { Pet: pet({ traceId: str }) })],
    expect: [
      { at: `${RES}/properties/traceId`, action: "add", type: nonBreaking, mentions: ["`traceId`", "200"] },
      { at: `${COMP}/properties/traceId`, action: "add", type: nonBreaking, mentions: ["traceId", "Pet"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-004",
    title: "response-only component loses a required property",
    before: "Pet (response only) { id, name } name required",
    after: "Pet { id }",
    rationale: "clients reading the guaranteed `name` fail",
    annotation: "names `name` at the usage site and in component Pet",
    sources: [{ tool: "bench", ref: "github G14" }],
    docs: [oas({ "/a": resOp() }, { Pet: pet({ name: str }, ["name"]) }), oas({ "/a": resOp() }, { Pet: pet({}, []) })],
    expect: [
      {
        at: [`${RES}/properties/name`, `${RES}/required/**`],
        action: "remove",
        type: breaking,
        mentions: ["`name`", "200"],
      },
      {
        at: [`${COMP}/properties/name`, `${COMP}/required/**`],
        action: "remove",
        type: breaking,
        mentions: ["name", "Pet"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-005",
    title: "request-only component gains a required property",
    before: "Pet (request only) { id }",
    after: "Pet { id, name } with name required",
    rationale: "callers that omit `name` are rejected; the component takes request semantics from its only usage",
    annotation: "names `name` at the usage site and in component Pet",
    sources: [
      { tool: "bench", ref: "github G9" },
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §11.4" },
    ],
    docs: [oas({ "/b": reqOp() }, { Pet: pet() }), oas({ "/b": reqOp() }, { Pet: pet({ name: str }, ["name"]) })],
    expect: [
      {
        at: [`${REQ}/properties/name`, `${REQ}/required/**`],
        action: "add",
        type: breaking,
        mentions: ["`name`", /request ?body/i],
      },
      {
        at: [`${COMP}/properties/name`, `${COMP}/required/**`],
        action: "add",
        type: breaking,
        mentions: ["name", "Pet"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-006",
    title: "component used in a request and a response gains a required property",
    before: "Pet used by POST /c request body and its 200 response",
    after: "Pet gains required `benchTag`",
    rationale:
      "breaking for callers (request usage), harmless for readers (response usage); the component is breaking because it is breaking in one usage (decision §11.4)",
    annotation: "names `benchTag` at both usage sites and in component Pet",
    sources: [
      { tool: "bench", ref: "oas-petstore P3" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.2" },
    ],
    docs: [
      oas({ "/c": bothOp() }, { Pet: pet() }),
      oas({ "/c": bothOp() }, { Pet: pet({ benchTag: str }, ["benchTag"]) }),
    ],
    expect: [
      {
        at: [
          "paths/~1c/post/requestBody/content/application~1json/schema/properties/benchTag",
          "paths/~1c/post/requestBody/content/application~1json/schema/required/**",
        ],
        action: "add",
        type: breaking,
        mentions: ["`benchTag`", /request ?body/i],
      },
      {
        at: [
          "paths/~1c/post/responses/200/content/application~1json/schema/properties/benchTag",
          "paths/~1c/post/responses/200/content/application~1json/schema/required/**",
        ],
        action: "add",
        type: nonBreaking,
        mentions: ["`benchTag`", "200"],
      },
      {
        at: [`${COMP}/properties/benchTag`, `${COMP}/required/**`],
        action: "add",
        type: breaking,
        mentions: ["benchTag", "Pet"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-007",
    title: "component used in a request and a response: maxLength decreased",
    before: "User used by POST /c request and response, phone maxLength 64",
    after: "maxLength 32",
    rationale:
      "request: longer phones are rejected; response: clients receive shorter values only; the component is breaking",
    annotation: "names `phone` and maxLength at both usage sites and in component User",
    sources: [{ tool: "bench", ref: "oas-petstore P19" }],
    docs: [
      oas(
        { "/c": bothOp("User") },
        { User: { type: "object", properties: { phone: { type: "string", maxLength: 64 } } } },
      ),
      oas(
        { "/c": bothOp("User") },
        { User: { type: "object", properties: { phone: { type: "string", maxLength: 32 } } } },
      ),
    ],
    expect: [
      {
        at: "paths/~1c/post/requestBody/content/application~1json/schema/properties/phone/maxLength",
        type: breaking,
        mentions: ["maxLength", "`phone`", /request ?body/i],
      },
      {
        at: "paths/~1c/post/responses/200/content/application~1json/schema/properties/phone/maxLength",
        type: nonBreaking,
        mentions: ["maxLength", "`phone`", "200"],
      },
      {
        at: "components/schemas/User/properties/phone/maxLength",
        type: breaking,
        mentions: ["maxLength", "phone", "User"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-008",
    title: "component used in a request and a response loses a required property",
    before: "Pet { name, photoUrls } both required, used by POST /c request and response",
    after: "photoUrls removed",
    rationale:
      "readers of the response lose a guaranteed property (breaking); callers may keep sending it (non-breaking)",
    annotation: "names `photoUrls` at both usage sites and in component Pet",
    sources: [{ tool: "bench", ref: "oas-petstore P24" }],
    docs: [
      oas({ "/c": bothOp() }, { Pet: pet({ photoUrls: { type: "array", items: str } }, ["photoUrls"]) }),
      oas({ "/c": bothOp() }, { Pet: pet({}, []) }),
    ],
    expect: [
      // POLICY-03 decided (c) (aligned in P4, as the JSON Schema case "required property removed"): callers may keep
      // sending the property the request no longer declares (risky); dropping its required status is non-breaking
      {
        at: "paths/~1c/post/requestBody/content/application~1json/schema/properties/photoUrls",
        action: "remove",
        type: risky,
        mentions: ["`photoUrls`", /request ?body/i],
      },
      {
        at: "paths/~1c/post/requestBody/content/application~1json/schema/required/**",
        action: "remove",
        type: nonBreaking,
        mentions: ["`photoUrls`", /request ?body/i],
      },
      {
        at: [
          "paths/~1c/post/responses/200/content/application~1json/schema/properties/photoUrls",
          "paths/~1c/post/responses/200/content/application~1json/schema/required/**",
        ],
        action: "remove",
        type: breaking,
        mentions: ["`photoUrls`", "200"],
      },
      {
        at: [`${COMP}/properties/photoUrls`, `${COMP}/required/**`],
        action: "remove",
        type: breaking,
        mentions: ["photoUrls", "Pet"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-009",
    title: "component used in a request and a response gains an optional property",
    before: "Order used by POST /c request and response",
    after: "Order gains optional `giftNote`",
    rationale: "callers need not send it, readers ignore it",
    annotation: "names `giftNote` at both usage sites and in component Order",
    sources: [{ tool: "bench", ref: "oas-petstore P23" }],
    docs: [
      oas({ "/c": bothOp("Order") }, { Order: pet() }),
      oas({ "/c": bothOp("Order") }, { Order: pet({ giftNote: str }) }),
    ],
    expect: [
      {
        at: "paths/~1c/post/requestBody/content/application~1json/schema/properties/giftNote",
        action: "add",
        type: nonBreaking,
        mentions: ["`giftNote`", /request ?body/i],
      },
      {
        at: "paths/~1c/post/responses/200/content/application~1json/schema/properties/giftNote",
        action: "add",
        type: nonBreaking,
        mentions: ["`giftNote`", "200"],
      },
      {
        at: "components/schemas/Order/properties/giftNote",
        action: "add",
        type: nonBreaking,
        mentions: ["giftNote", "Order"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-010",
    title: "unreferenced component gains a required property",
    before: "Pet (no usage) { id }",
    after: "Pet gains required `name`",
    rationale: "no operation uses Pet: decision §11.4 classifies unreferenced components as unclassified",
    annotation: "names `name` and component Pet",
    sources: [{ tool: "asd", ref: "test/openapi/components-security.test.ts C6.3" }],
    docs: [
      oas({ "/z": { get: { responses: ok } } }, { Pet: pet() }),
      oas({ "/z": { get: { responses: ok } } }, { Pet: pet({ name: str }, ["name"]) }),
    ],
    expect: [
      {
        at: [`${COMP}/properties/name`, `${COMP}/required/**`],
        action: "add",
        type: unclassified,
        mentions: ["name", "Pet"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-011",
    title: "unreferenced component schema removed",
    before: "components.schemas { Pet, Tag } (Tag unused)",
    after: "components.schemas { Pet }",
    rationale: "nothing references Tag: unclassified with a description (decision §11.4)",
    annotation: "names the removed schema component Tag",
    sources: [
      { tool: "oasdiff", ref: "checker/rules.go api-schema-removed", verdict: "INFO" },
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.3" },
    ],
    covers: ["oasdiff:api-schema-removed"],
    docs: [oas({ "/a": resOp() }, { Pet: pet(), Tag: str }), oas({ "/a": resOp() }, { Pet: pet() })],
    expect: [{ at: "components/schemas/Tag", action: "remove", type: unclassified, mentions: ["Tag"] }],
  },
  {
    kind: "doc",
    id: "OAS-REF-012",
    title: "unreferenced component schema added",
    before: "components.schemas { Pet }",
    after: "components.schemas { Pet, Tag } (Tag unused)",
    rationale: "nothing references Tag: unclassified with a description (decision §11.4)",
    annotation: "names the added schema component Tag",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/components_test.go schemas added" }],
    docs: [oas({ "/a": resOp() }, { Pet: pet() }), oas({ "/a": resOp() }, { Pet: pet(), Tag: str })],
    expect: [{ at: "components/schemas/Tag", action: "add", type: unclassified, mentions: ["Tag"] }],
  },
  {
    kind: "doc",
    id: "OAS-REF-013",
    title: "component renamed with its only usage repointed",
    before: "response $ref Old, components { Old }",
    after: "response $ref New, components { New } (identical schema)",
    rationale:
      "POLICY-101 decided: every reference moved from Old to New, so the component was renamed: one rename annotation (the resolved response is unchanged, POLICY-18 (b))",
    annotation: "names the old and the new component name",
    sources: [
      {
        tool: "oasdiff",
        ref: "data/component-renamed1.yaml / component-renamed2.yaml; checker api-schema-removed",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Schemas removed", verdict: "breaking" },
    ],
    covers: ["oasdiff:api-schema-removed"],
    docs: [oas({ "/a": resOp("Old") }, { Old: str }), oas({ "/a": resOp("New") }, { New: str })],
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["schema component", "Old", "New"],
      },
    ],
    // ISSUE-78 (fixed); POLICY-18 decided (b); POLICY-101 decided (P8c): the former expectation was a non-breaking
    // removal of Old plus a non-breaking addition of New
  },
  {
    kind: "doc",
    id: "OAS-REF-014",
    title: "shared response schema $ref used under two media types",
    before: "200 application/json and application/xml both $ref Pet (id integer)",
    after: "Pet id string",
    rationale:
      "each usage must be described with its own media type (residual of ISSUE-09: the petstore application/xml usage was described as application/json)",
    annotation: "names `id` with application/json for the first usage and application/xml for the second",
    sources: [
      { tool: "asd", ref: "docs/ANALYSIS.md ISSUE-09; bench oas-petstore P4 sites" },
      { tool: "bench", ref: "oas-petstore (application/xml usage described as application/json)" },
    ],
    docs: [
      oas(
        {
          "/a": {
            get: {
              responses: {
                200: {
                  description: "ok",
                  content: { "application/json": { schema: ref("Pet") }, "application/xml": { schema: ref("Pet") } },
                },
              },
            },
          },
        },
        { Pet: pet() },
      ),
      oas(
        {
          "/a": {
            get: {
              responses: {
                200: {
                  description: "ok",
                  content: { "application/json": { schema: ref("Pet") }, "application/xml": { schema: ref("Pet") } },
                },
              },
            },
          },
        },
        { Pet: { ...pet(), properties: { id: str } } },
      ),
    ],
    expect: [
      { at: `${RES}/properties/id/type`, type: breaking, mentions: ["`id`", "200", "application/json"] },
      {
        at: "paths/~1a/get/responses/200/content/application~1xml/schema/properties/id/type",
        type: breaking,
        mentions: ["`id`", "200", "application/xml"],
      },
      { at: `${COMP}/properties/id/type`, type: breaking, mentions: ["id"] },
    ],
    // ISSUE-55 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-015",
    title: "shared schema $ref used by a response, a request and another status code",
    before: "Pet used by GET /a 200, POST /b request body and POST /b 201",
    after: "Pet id string",
    rationale: "each usage must be described with its own location (request body vs 201 response)",
    annotation: "names `id` with the location of each usage site",
    sources: [{ tool: "asd", ref: "docs/ANALYSIS.md ISSUE-09 (cache hit re-annotated with the first usage)" }],
    docs: [
      oas(
        {
          "/a": resOp(),
          "/b": {
            post: {
              requestBody: json(ref("Pet")),
              responses: { 201: { description: "created", ...json(ref("Pet")) } },
            },
          },
        },
        { Pet: pet() },
      ),
      oas(
        {
          "/a": resOp(),
          "/b": {
            post: {
              requestBody: json(ref("Pet")),
              responses: { 201: { description: "created", ...json(ref("Pet")) } },
            },
          },
        },
        { Pet: { ...pet(), properties: { id: str } } },
      ),
    ],
    expect: [
      { at: `${RES}/properties/id/type`, type: breaking, mentions: ["`id`", "200"] },
      { at: `${REQ}/properties/id/type`, type: breaking, mentions: ["`id`", /request ?body/i] },
      {
        at: "paths/~1b/post/responses/201/content/application~1json/schema/properties/id/type",
        type: breaking,
        mentions: ["`id`", "201"],
      },
      { at: `${COMP}/properties/id/type`, type: breaking, mentions: ["id"] },
    ],
    // ISSUE-55 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-016",
    title: "same $ref used by many operations with the same status code",
    before: "Pet returned by GET /a, GET /b, GET /c",
    after: "Pet id string",
    rationale: "reported once per usage site and once in the component",
    annotation: "names `id` and the status code at every site",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §8 (500 usages of one $ref)" }],
    docs: [
      oas({ "/a": resOp(), "/b": resOp(), "/c": resOp() }, { Pet: pet() }),
      oas({ "/a": resOp(), "/b": resOp(), "/c": resOp() }, { Pet: { ...pet(), properties: { id: str } } }),
    ],
    expect: [
      {
        at: "paths/*/get/responses/200/content/application~1json/schema/properties/id/type",
        type: breaking,
        mentions: ["`id`", "200", "application/json"],
      },
      { at: `${COMP}/properties/id/type`, type: breaking, mentions: ["id", "Pet"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-017",
    title: "nested component reference changed (Owner -> Pet)",
    before: "response $ref Owner { pet: $ref Pet { id integer } }",
    after: "Pet id string",
    rationale:
      "the change is visible through Owner at the usage site and at Pet's declaration; it is not re-expanded inside Owner, which only references Pet (ISSUE-53, X-VOL-001)",
    annotation: "names `pet.id` at the usage and `id` in Pet",
    sources: [
      { tool: "asd", ref: "test/openapi/components-security.test.ts C6.4" },
      { tool: "oasdiff", ref: "data/different_component_same_schema.yaml" },
    ],
    docs: [
      oas({ "/a": resOp("Owner") }, { Owner: { type: "object", properties: { pet: ref("Pet") } }, Pet: pet() }),
      oas(
        { "/a": resOp("Owner") },
        { Owner: { type: "object", properties: { pet: ref("Pet") } }, Pet: { ...pet(), properties: { id: str } } },
      ),
    ],
    expect: [
      { at: `${RES}/properties/pet/properties/id/type`, type: breaking, mentions: ["`pet.id`", "200"], count: 1 },
      { at: `${COMP}/properties/id/type`, type: breaking, mentions: ["id", "Pet"], count: 1 },
    ],
    // ISSUE-53 (fixed): the former expectation also listed the re-expansion inside Owner
    // (`components/schemas/Owner/properties/pet/properties/id/type`)
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-018",
    title: "change inside a self-referencing (circular) component",
    before: "Node { v: integer, next: $ref Node }",
    after: "v string",
    rationale: "the cycle is compared once per site and terminates",
    annotation: "names `v` at the usage and in component Node",
    sources: [
      { tool: "oasdiff", ref: "data/circular1.yaml / circular2.yaml" },
      { tool: "openapi-diff", ref: "core/src/test/.../RecursiveSchemaTest.java" },
    ],
    docs: [
      oas(
        { "/a": resOp("Node") },
        { Node: { type: "object", properties: { v: { type: "integer" }, next: ref("Node") } } },
      ),
      oas({ "/a": resOp("Node") }, { Node: { type: "object", properties: { v: str, next: ref("Node") } } }),
    ],
    expect: [
      { at: `${RES}/**/v/type`, type: breaking, mentions: ["v", "200"] },
      { at: "components/schemas/Node/**/v/type", type: breaking, mentions: ["v", "Node"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-019",
    title: "usage repointed to another component with different content",
    before: "response $ref A { x: string }",
    after: "response $ref B { x: integer } (A and B unchanged)",
    rationale: "the resolved response changes type of `x`; the components themselves did not change",
    annotation: "names `x` at the usage site",
    sources: [
      { tool: "oasdiff", ref: "data/component-ref-override1.yaml / -2.yaml" },
      { tool: "libopenapi", ref: "what-changed/model/schema.go $ref changed" },
    ],
    docs: [
      oas(
        { "/a": resOp("A") },
        {
          A: { type: "object", properties: { x: str } },
          B: { type: "object", properties: { x: { type: "integer" } } },
        },
      ),
      oas(
        { "/a": resOp("B") },
        {
          A: { type: "object", properties: { x: str } },
          B: { type: "object", properties: { x: { type: "integer" } } },
        },
      ),
    ],
    expect: [{ at: `${RES}/properties/x/type`, type: breaking, mentions: ["`x`", "200"] }],
  },
  {
    kind: "doc",
    id: "OAS-REF-020",
    title: "inline schema replaced by an equivalent $ref and back",
    before: "inline Pet schema (component Pet identical) / $ref Pet",
    after: "$ref Pet / inline copy",
    rationale: "the resolved schema is identical",
    annotation: "no diff",
    sources: [{ tool: "libopenapi", ref: "what-changed/model/schema_test.go inline vs ref" }],
    docs: {
      "to-ref": [
        oas({ "/a": { get: { responses: { 200: { description: "ok", ...json(pet()) } } } } }, { Pet: pet() }),
        oas({ "/a": resOp() }, { Pet: pet() }),
      ],
      "to-inline": [
        oas({ "/a": resOp() }, { Pet: pet() }),
        oas({ "/a": { get: { responses: { 200: { description: "ok", ...json(pet()) } } } } }, { Pet: pet() }),
      ],
    },
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-REF-021",
    title: "schema component reached through components.requestBodies",
    before: "POST /b requestBody $ref RB -> schema $ref Item { n: string }",
    after: "Item n integer",
    rationale:
      "callers sending strings are rejected; reported at the usage and in the schema component, not re-expanded inside the request body component that only references it (ISSUE-53, X-VOL-001)",
    annotation: "names `n` at each site",
    sources: [
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §12.2 (component-to-component references followed transitively)" },
    ],
    docs: [
      {
        ...oas(
          { "/b": { post: { requestBody: { $ref: "#/components/requestBodies/ItemBody" }, responses: ok } } },
          { Item: { type: "object", properties: { n: str } } },
        ),
        components: {
          schemas: { Item: { type: "object", properties: { n: str } } },
          requestBodies: { ItemBody: json(ref("Item")) },
        },
      },
      {
        ...oas({ "/b": { post: { requestBody: { $ref: "#/components/requestBodies/ItemBody" }, responses: ok } } }, {}),
        components: {
          schemas: { Item: { type: "object", properties: { n: { type: "integer" } } } },
          requestBodies: { ItemBody: json(ref("Item")) },
        },
      },
    ],
    expect: [
      { at: `${REQ}/properties/n/type`, type: breaking, mentions: ["`n`", /request ?body/i], count: 1 },
      { at: "components/schemas/Item/properties/n/type", type: breaking, mentions: ["n", "Item"], count: 1 },
    ],
    // ISSUE-53 (fixed): the former expectation also listed the re-expansion inside the request body component
    // (`components/requestBodies/ItemBody/content/application~1json/schema/properties/n/type`)
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-022",
    title: "schema component shared by a request body and a response header",
    before: "Id (string maxLength 64) used by POST /u request body and its 200 header X-Id",
    after: "maxLength 32",
    rationale:
      "request: longer ids are rejected (breaking); response header: values get shorter (non-breaking); the component is breaking",
    annotation: "names maxLength at the request body, at header X-Id and in component Id",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §11.4 (breaking if breaking in any usage)" }],
    docs: [
      oas(
        {
          "/u": {
            post: {
              requestBody: json(ref("Id")),
              responses: { 200: { description: "ok", headers: { "X-Id": { schema: ref("Id") } } } },
            },
          },
        },
        { Id: { type: "string", maxLength: 64 } },
      ),
      oas(
        {
          "/u": {
            post: {
              requestBody: json(ref("Id")),
              responses: { 200: { description: "ok", headers: { "X-Id": { schema: ref("Id") } } } },
            },
          },
        },
        { Id: { type: "string", maxLength: 32 } },
      ),
    ],
    expect: [
      {
        at: "paths/~1u/post/requestBody/content/application~1json/schema/maxLength",
        type: breaking,
        mentions: ["maxLength", /request ?body/i],
      },
      {
        at: "paths/~1u/post/responses/200/headers/X-Id/schema/maxLength",
        type: nonBreaking,
        mentions: ["maxLength", "X-Id", "200"],
      },
      { at: "components/schemas/Id/maxLength", type: breaking, mentions: ["maxLength", "Id"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-REF-023",
    title: "component used only through another response-only component gains a required property",
    before: "response $ref Owner { pet: $ref Pet }, Pet { id }",
    after: "Pet gains required `name`",
    rationale:
      "Pet is reachable from responses only (transitively), so its component diff takes response semantics; it is reported at the usage and at Pet's declaration, not re-expanded inside Owner (ISSUE-53)",
    annotation: "names `name` at the usage and in component Pet",
    sources: [
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §12.2 (component-to-component references followed transitively)" },
    ],
    docs: [
      oas({ "/a": resOp("Owner") }, { Owner: { type: "object", properties: { pet: ref("Pet") } }, Pet: pet() }),
      oas(
        { "/a": resOp("Owner") },
        { Owner: { type: "object", properties: { pet: ref("Pet") } }, Pet: pet({ name: str }, ["name"]) },
      ),
    ],
    expect: [
      {
        at: [`${RES}/properties/pet/properties/name`, `${RES}/properties/pet/required/**`],
        action: "add",
        type: nonBreaking,
        mentions: ["name", "200"],
      },
      {
        at: [`${COMP}/properties/name`, `${COMP}/required/**`],
        action: "add",
        type: nonBreaking,
        mentions: ["name", "Pet"],
      },
    ],
    // ISSUE-53 (fixed): the former expectation also listed the re-expansion inside Owner
    // (`components/schemas/Owner/properties/pet/{properties/name,required/**}`)
    // ISSUE-56 (fixed) (P8a)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // POLICY-101 (P8c): a component renamed and changed at once is paired by its reference sites
  {
    kind: "doc",
    id: "OAS-REF-024",
    title: "component renamed with every usage repointed and a compatible change",
    before: "response $ref Old { id }",
    after: "response $ref New { id, name } (Old removed)",
    rationale:
      "POLICY-101: every reference moved from Old to New, so the key change is a rename (annotation); the definitions are compared on their own: a property added to a response is non-breaking, at the declaration and at the usage",
    annotation: "names both component names for the rename; the added property with the component or the response",
    sources: [
      { tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101" },
      { tool: "oasdiff", ref: "data/component-renamed1.yaml / component-renamed2.yaml", verdict: "INFO" },
    ],
    docs: [oas({ "/a": resOp("Old") }, { Old: pet() }), oas({ "/a": resOp("New") }, { New: pet({ name: str }) })],
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["Old", "New"] },
      { at: "components/schemas/Old/properties/name", action: "add", type: nonBreaking, count: 1, mentions: ["name"] },
      { at: `${RES}/properties/name`, action: "add", type: nonBreaking, count: 1, mentions: ["name", "200"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-025",
    title: "component renamed with every usage repointed and a breaking change",
    before: "request body $ref Old { id }",
    after: "request body $ref New { id, name } with name required (Old removed)",
    rationale:
      "POLICY-101: the rename itself is an annotation; the new required request property breaks clients that do not send it, at the declaration and at the usage",
    annotation:
      "names both component names for the rename; the required property with the component or the request body",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101" }],
    docs: [
      oas({ "/b": reqOp("Old") }, { Old: pet() }),
      oas({ "/b": reqOp("New") }, { New: pet({ name: str }, ["name"]) }),
    ],
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["Old", "New"] },
      {
        at: ["components/schemas/Old/properties/name", "components/schemas/Old/required/**"],
        action: "add",
        type: breaking,
        count: 2,
        mentions: ["name"],
      },
      {
        at: [`${REQ}/properties/name`, `${REQ}/required/**`],
        action: "add",
        type: breaking,
        count: 2,
        mentions: ["name", "Request Body"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-026",
    title: "component renamed with only some usages repointed is not a rename",
    before: "GET /a response and POST /b request body $ref Old { id }",
    after: "GET /a $ref New { id, name }; POST /b an inline copy of Old (Old removed)",
    rationale:
      "POLICY-101: the references of New are not those of Old (POST /b no longer references a component) and the definitions differ; POLICY-105: exactly 1 of the 2 direct fields is equal (`type`; `properties` differs), which is not more than 50 %, so Old is removed (breaking: the request usage loses its declaration) and New is added; the usages report their own changes",
    annotation: "names the removed Old and the added New component",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101 / POLICY-105" }],
    docs: [
      oas({ "/a": resOp("Old"), "/b": reqOp("Old") }, { Old: pet() }),
      oas(
        { "/a": resOp("New"), "/b": { post: { requestBody: json(pet()), responses: ok } } },
        { New: pet({ name: str }) },
      ),
    ],
    expect: [
      { at: "components/schemas/Old", action: "remove", type: breaking, count: 1, mentions: ["Old"] },
      { at: "components/schemas/New", action: "add", type: nonBreaking, count: 1, mentions: ["New"] },
      { at: `${RES}/properties/name`, action: "add", type: nonBreaking, count: 1, mentions: ["name", "200"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-027",
    title: "component renamed with a change, referenced from another component and from itself",
    before: "response $ref Owner { pet: $ref Old }, Old { id, next: $ref Old }",
    after: "Owner { pet: $ref New }, New { id, next: $ref New, name } (Old removed)",
    rationale:
      "POLICY-101: every reference moved (the self-reference inside the renamed component counts as moved), so the rename is an annotation; the added property is reported at New's declaration and at the usage only, not re-expanded inside Owner (ISSUE-53), and the repointed references are no change",
    annotation: "names both component names for the rename; the added property",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101; ISSUE-53" }],
    docs: [
      oas(
        { "/a": resOp("Owner") },
        { Owner: { type: "object", properties: { pet: ref("Old") } }, Old: pet({ next: ref("Old") }) },
      ),
      oas(
        { "/a": resOp("Owner") },
        { Owner: { type: "object", properties: { pet: ref("New") } }, New: pet({ next: ref("New"), name: str }) },
      ),
    ],
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["Old", "New"] },
      { at: "components/schemas/Old/properties/name", action: "add", type: nonBreaking, count: 1, mentions: ["name"] },
      {
        at: `${RES}/properties/pet/properties/name`,
        action: "add",
        type: nonBreaking,
        count: 1,
        mentions: ["name", "200"],
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // POLICY-105 decided (P8d): a removed and an added component are also a rename when more than 50 % of the direct
  // fields of their definitions are equal; one-to-one, the best score first
  {
    kind: "doc",
    id: "OAS-REF-028",
    title: "component renamed with only some usages repointed and most direct fields kept is a rename",
    before: "GET /a response and POST /b request body $ref Old { id } (required id)",
    after: "GET /a $ref New { id, name } (required id); POST /b an inline copy of Old (Old removed)",
    rationale:
      "POLICY-105: 2 of the 3 direct fields are equal (`type`, `required`; `properties` differs), so Old was renamed to New although POST /b no longer references it: one rename annotation, the content compared old against new on its own (a response property added: non-breaking, at the declaration and at the usage); POST /b reads the same schema inline (no change)",
    annotation: "names both component names for the rename; the added property with the component or the response",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-105" }],
    docs: [
      oas({ "/a": resOp("Old"), "/b": reqOp("Old") }, { Old: pet({}, ["id"]) }),
      oas(
        { "/a": resOp("New"), "/b": { post: { requestBody: json(pet({}, ["id"])), responses: ok } } },
        { New: pet({ name: str }, ["id"]) },
      ),
    ],
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["Old", "New"] },
      { at: "components/schemas/Old/properties/name", action: "add", type: nonBreaking, count: 1, mentions: ["name"] },
      { at: `${RES}/properties/name`, action: "add", type: nonBreaking, count: 1, mentions: ["name", "200"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-029",
    title: "component replaced by one that keeps less than half of its direct fields is not a rename",
    before: "GET /a response and POST /b request body $ref Old { id } (required id)",
    after: "GET /a $ref New, an array of strings; POST /b an inline copy of Old (Old removed)",
    rationale:
      "POLICY-105: none of the 3 direct fields of Old is equal in New (`type`, `required`, `properties` vs `type`, `items`), so it is no rename: Old is removed (breaking: the request usage loses its declaration) and New is added; the response usage reports its own change",
    annotation: "names the removed and the added component",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-105" }],
    docs: [
      oas({ "/a": resOp("Old"), "/b": reqOp("Old") }, { Old: pet({}, ["id"]) }),
      oas(
        { "/a": resOp("New"), "/b": { post: { requestBody: json(pet({}, ["id"])), responses: ok } } },
        { New: { type: "array", items: str } },
      ),
    ],
    expect: [
      { at: "components/schemas/Old", action: "remove", type: breaking, count: 1, mentions: ["Old"] },
      { at: "components/schemas/New", action: "add", type: nonBreaking, count: 1, mentions: ["New"] },
      { at: [`${RES}`, `${RES}/**`], type: breaking, mentions: ["200"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-030",
    title: "component renamed while another similar component is added: the more similar one is the rename",
    before: "GET /a response and POST /b request body $ref Old { id } (required id, description)",
    after:
      "GET /a $ref New { id, name } (3 of 4 fields kept); POST /b an inline copy of Old; GET /c $ref Other (1 of 4 kept)",
    rationale:
      "POLICY-105: pairing is one-to-one and the best score first: New keeps 3 of the 4 direct fields of Old (`type`, `required`, `description`), Other only `type`, so Old was renamed to New and Other is added with the new operation that uses it",
    annotation: "names both component names for the rename; the added component and property",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-105" }],
    docs: [
      oas({ "/a": resOp("Old"), "/b": reqOp("Old") }, { Old: { ...pet({}, ["id"]), description: "a pet" } }),
      oas(
        {
          "/a": resOp("New"),
          "/b": { post: { requestBody: json({ ...pet({}, ["id"]), description: "a pet" }), responses: ok } },
          "/c": resOp("Other"),
        },
        {
          New: { ...pet({ name: str }, ["id"]), description: "a pet" },
          Other: { type: "object", required: ["code"], properties: { code: str }, description: "another" },
        },
      ),
    ],
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["Old", "New"] },
      { at: "components/schemas/Old/properties/name", action: "add", type: nonBreaking, count: 1, mentions: ["name"] },
      { at: "components/schemas/Other", action: "add", type: nonBreaking, count: 1, mentions: ["Other"] },
      { at: `${RES}/properties/name`, action: "add", type: nonBreaking, count: 1, mentions: ["name", "200"] },
      { at: "paths/~1c/get", action: "add", type: nonBreaking, count: 1, mentions: ["GET /c"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-031",
    title: "component whose every usage moved to one new key while another new key holds an identical copy",
    before: "GET /a response $ref Old { id }",
    after: "GET /a $ref Moved { id, name }; GET /c $ref Copy, identical to Old (Old removed)",
    rationale:
      "POLICY-105: a reference-site match (POLICY-101: every reference of Old moved to Moved) is the best score and wins over the identical copy, so Old was renamed to Moved and Copy is added with the new operation (before P8d the two candidates made it no rename)",
    annotation: "names both component names for the rename; the added component and property",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101 / POLICY-105" }],
    docs: [
      oas({ "/a": resOp("Old") }, { Old: pet() }),
      oas({ "/a": resOp("Moved"), "/c": resOp("Copy") }, { Moved: pet({ name: str }), Copy: pet() }),
    ],
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["Old", "Moved"] },
      { at: "components/schemas/Old/properties/name", action: "add", type: nonBreaking, count: 1, mentions: ["name"] },
      { at: "components/schemas/Copy", action: "add", type: nonBreaking, count: 1, mentions: ["Copy"] },
      { at: `${RES}/properties/name`, action: "add", type: nonBreaking, count: 1, mentions: ["name", "200"] },
      { at: "paths/~1c/get", action: "add", type: nonBreaking, count: 1, mentions: ["GET /c"] },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // POLICY-106 decided (P8d): discriminator `mapping` values and link `operationRef`s are reference sites; a retarget
  // that only follows a rename is no change
  {
    kind: "doc",
    id: "OAS-REF-032",
    title: "discriminator mapping values that follow renamed components are no change",
    before: "response $ref Pet { oneOf Cat, Dog; discriminator kind, mapping cat: #/components/schemas/Cat, dog: Dog }",
    after: "Cat renamed to Feline and Dog to Canine, the mapping (pointer and bare name) and the oneOf repointed",
    rationale:
      "POLICY-106: the mapping values are references of Cat and Dog, so every reference moved with the renames (POLICY-101): two rename annotations; the repointed mapping values and `$ref`s are no change (before P8d the mapping retargets were breaking)",
    annotation: "names both component names for each rename",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-106" }],
    docs: [
      oas(
        { "/a": resOp("Pet") },
        {
          Pet: {
            oneOf: [ref("Cat"), ref("Dog")],
            discriminator: { propertyName: "kind", mapping: { cat: "#/components/schemas/Cat", dog: "Dog" } },
          },
          Cat: { type: "object", properties: { kind: str, meow: str } },
          Dog: { type: "object", properties: { kind: str, bark: str } },
        },
      ),
      oas(
        { "/a": resOp("Pet") },
        {
          Pet: {
            oneOf: [ref("Feline"), ref("Canine")],
            discriminator: { propertyName: "kind", mapping: { cat: "#/components/schemas/Feline", dog: "Canine" } },
          },
          Feline: { type: "object", properties: { kind: str, meow: str } },
          Canine: { type: "object", properties: { kind: str, bark: str } },
        },
      ),
    ],
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 2,
        mentions: [/`(Cat|Dog)` to `(Feline|Canine)`/],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-033",
    title: "discriminator mapping value pointing at a renamed component that changed: the rename and the change",
    before: "Pet { oneOf Cat; discriminator mapping cat: #/components/schemas/Cat }, Cat referenced only from Pet",
    after: "Cat renamed to Feline (mapping and oneOf repointed) with an added property",
    rationale:
      "POLICY-106: the mapping value and the `$ref` both moved to Feline, so it is a rename (POLICY-101) even though the definition changed; the repointed mapping value is no change, the added property is classified on its own",
    annotation: "names both component names for the rename; the added property",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-106" }],
    docs: [
      oas(
        { "/a": resOp("Pet") },
        {
          Pet: {
            oneOf: [ref("Cat")],
            discriminator: { propertyName: "kind", mapping: { cat: "#/components/schemas/Cat" } },
          },
          Cat: { type: "object", properties: { kind: str } },
        },
      ),
      oas(
        { "/a": resOp("Pet") },
        {
          Pet: {
            oneOf: [ref("Feline")],
            discriminator: { propertyName: "kind", mapping: { cat: "#/components/schemas/Feline" } },
          },
          Feline: { type: "object", properties: { kind: str, meow: str } },
        },
      ),
    ],
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["Cat", "Feline"] },
      { at: "components/schemas/Cat/properties/meow", action: "add", type: nonBreaking, count: 1, mentions: ["meow"] },
      { at: `${RES}/oneOf/0/properties/meow`, action: "add", type: nonBreaking, count: 1, mentions: ["meow", "200"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-034",
    title: "link operationRef that follows a renamed path item component is no change",
    before: "path /a $ref components/pathItems/Old; GET /b's 200 links operationRef #/components/pathItems/Old/get",
    after: "Old renamed to New, the path item $ref and the operationRef repointed",
    rationale:
      "POLICY-106: the operationRef is a reference of Old, so every reference moved (POLICY-101): one rename annotation, the repointed operationRef is no change (before P8d its retarget was breaking)",
    annotation: "names both component names for the rename",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-106" }],
    docs: (() => {
      const v = (name: string) => ({
        openapi: "3.1.0",
        info,
        paths: {
          "/a": { $ref: `#/components/pathItems/${name}` },
          "/b": {
            get: {
              responses: {
                200: { description: "ok", links: { next: { operationRef: `#/components/pathItems/${name}/get` } } },
              },
            },
          },
        },
        components: { pathItems: { [name]: { get: { responses: ok } } } },
      })
      return [v("Old"), v("New")] as [unknown, unknown]
    })(),
    expect: [{ at: "components/pathItems", action: "rename", type: annotation, count: 1, mentions: ["Old", "New"] }],
  },
  // POLICY-111 decided (changed, P8e): the similarity rule applies to unreferenced entries too
  {
    kind: "doc",
    id: "OAS-REF-035",
    title: "unreferenced component replaced by one that keeps most of its direct fields is a rename",
    before: "components-only document: Old { id integer } (description) referenced by nothing",
    after: "New { id string } (same description), referenced by nothing (Old removed)",
    rationale:
      "POLICY-111: 2 of the 3 direct fields are equal (`type`, `description`; `properties` differs), so Old was renamed to New although neither is referenced (before P8e the similarity rule needed references: a removal plus an addition); the rename and the content change are unclassified, as every change of an unreferenced component (decision §11.4)",
    annotation: "names both component names for the rename; the changed property with the component's new and old key",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-111" }],
    docs: [
      oas({}, { Old: { ...pet(), description: "a pet" } }),
      oas({}, { New: { ...pet({ id: str }), description: "a pet" } }),
    ],
    expect: [
      { at: "components/schemas", action: "rename", type: unclassified, count: 1, mentions: ["Old", "New"] },
      {
        at: "components/schemas/Old/properties/id/type",
        action: "replace",
        type: unclassified,
        count: 1,
        mentions: ["`id`", "`New` (renamed from `Old`)"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-036",
    title: "unreferenced component replaced by one that keeps exactly half of its direct fields is not a rename",
    before: "components-only document: Old { id integer } referenced by nothing",
    after: "New { id string }, referenced by nothing (Old removed)",
    rationale:
      "POLICY-111 with POLICY-105: 1 of the 2 direct fields is equal (`type`; `properties` differs), exactly 50 % and not more: Old is removed and New is added, both unclassified (unreferenced)",
    annotation: "names the removed and the added component",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-111" }],
    docs: [oas({}, { Old: pet() }), oas({}, { New: pet({ id: str }) })],
    expect: [
      { at: "components/schemas/Old", action: "remove", type: unclassified, count: 1, mentions: ["Old"] },
      { at: "components/schemas/New", action: "add", type: unclassified, count: 1, mentions: ["New"] },
    ],
  },
  // POLICY-113 decided (changed, P8e): fields are compared with the renames found so far applied (cascading renames)
  {
    kind: "doc",
    id: "OAS-REF-037",
    title: "component renamed together with the component it references (cascading rename)",
    before: "GET /a response and POST /b request body $ref A { next: $ref B }; B { id }",
    after:
      "GET /a $ref A2 { next: $ref B2 }; POST /b an inline copy of A2; B2 an identical copy of B (A and B removed)",
    rationale:
      "POLICY-113: B2 is B renamed (deep-equal); A keeps `type` and `properties` differs only by the `$ref` repointed through that rename, so with the rename applied 2 of 2 direct fields are equal and A was renamed to A2 although POST /b no longer references it (before P8e: 1 of 2, A removed as breaking and A2 added); no content change",
    annotation: "names both component names of each rename",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-113" }],
    docs: [
      oas({ "/a": resOp("A"), "/b": reqOp("A") }, { A: holder("B"), B: leaf }),
      oas({ "/a": resOp("A2"), "/b": inlineReq(holder("B2")) }, { A2: holder("B2"), B2: leaf }),
    ],
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 2,
        mentions: [/`A` to `A2`|`B` to `B2`/],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-038",
    title: "chain of three components renamed together",
    before: "GET /a response and POST /b request body $ref A { next: $ref B }; B { next: $ref C }; C { id }",
    after: "A2 -> B2 -> C2 (C2 an identical copy of C); GET /a $ref A2, POST /b an inline copy of A2",
    rationale:
      "POLICY-113: C2 is C renamed (deep-equal); with that rename applied B's only differing field is equal (B renamed to B2), then A's (A renamed to A2): three rename annotations, found pass by pass (before P8e only C was a rename)",
    annotation: "names both component names of each rename",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-113" }],
    docs: [
      oas({ "/a": resOp("A"), "/b": reqOp("A") }, { A: holder("B"), B: holder("C"), C: leaf }),
      oas({ "/a": resOp("A2"), "/b": inlineReq(holder("B2")) }, { A2: holder("B2"), B2: holder("C2"), C2: leaf }),
    ],
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 3,
        mentions: [/`A` to `A2`|`B` to `B2`|`C` to `C2`/],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-039",
    title: "two components referencing each other renamed together (cycle)",
    before: "GET /a response and POST /b request body $ref A { title a, next: $ref B }; B { title b, next: $ref A }",
    after: "A2 { title a, next: $ref B2 }, B2 { title b, next: $ref A2 }; GET /a $ref A2, POST /b an inline copy of A2",
    rationale:
      "POLICY-113: each pair keeps `title` and differs only by a reference repointed through the other rename, so neither is a rename on its own; assumed together, both pairs keep 2 of 2 direct fields and select each other (a consistent assumption): two rename annotations; the inline copy closes the cycle on the before side only and its reference repointed through the rename is no change (ISSUE-310)",
    annotation: "names both component names of each rename",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-113" }],
    docs: [
      oas({ "/a": resOp("A"), "/b": reqOp("A") }, { A: titled("a", "B"), B: titled("b", "A") }),
      oas({ "/a": resOp("A2"), "/b": inlineReq(titled("a", "B2")) }, { A2: titled("a", "B2"), B2: titled("b", "A2") }),
    ],
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 2,
        mentions: [/`A` to `A2`|`B` to `B2`/],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-040",
    title: "cascading rename with two equally similar candidates is no rename",
    before: "GET /a response and POST /b request body $ref A { next: $ref B }; B { id }",
    after: "GET /a $ref A2, POST /b $ref A3, both { next: $ref B2 }; B2 an identical copy of B",
    rationale:
      "POLICY-112 with POLICY-113: B was renamed to B2; with that rename applied A2 and A3 are equally similar to A (2 of 2 direct fields), a tie: A is removed (breaking) and A2, A3 are added (non-breaking); the usages read the same schema (no change)",
    annotation: "names the renamed, the removed and the added components",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-112 / 113" }],
    docs: [
      oas({ "/a": resOp("A"), "/b": reqOp("A") }, { A: holder("B"), B: leaf }),
      oas({ "/a": resOp("A2"), "/b": reqOp("A3") }, { A2: holder("B2"), A3: holder("B2"), B2: leaf }),
    ],
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["`B` to `B2`"] },
      { at: "components/schemas/A", action: "remove", type: breaking, count: 1, mentions: ["`A`"] },
      { at: "components/schemas/A2", action: "add", type: nonBreaking, count: 1, mentions: ["`A2`"] },
      { at: "components/schemas/A3", action: "add", type: nonBreaking, count: 1, mentions: ["`A3`"] },
    ],
  },
  // POLICY-116 decided (changed, P8f): a field that differs only by string references (POLICY-106) repointed through the
  // renames found so far counts as equal for the direct field share
  {
    kind: "doc",
    id: "OAS-REF-041",
    title: "component renamed together with the component its discriminator mapping names",
    before:
      "GET /a response and POST /b request body $ref Pet { oneOf [Cat]; discriminator kind, mapping cat: Cat }; Cat",
    after:
      "GET /a $ref Pet2 (oneOf [Feline], mapping cat: Feline), POST /b an inline copy of Pet2; Feline a copy of Cat",
    rationale:
      "POLICY-116: Feline is Cat renamed (deep-equal); Pet's `oneOf` differs only by a `$ref` and its `discriminator` only by the mapping value repointed through that rename (a local pointer or a bare name), so 2 of 2 direct fields are equal and Pet was renamed to Pet2 although POST /b no longer references it (before P8f the mapping value counted as different: 1 of 2, Pet removed as breaking and Pet2 added); no content change",
    annotation: "names both component names of each rename",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-116" }],
    docs: (() => {
      const poly = (cat: string, value: string) => ({
        oneOf: [ref(cat)],
        discriminator: { propertyName: "kind", mapping: { cat: value } },
      })
      const cat = { type: "object", properties: { kind: str, meow: str } }
      const pair = (value: (name: string) => string): [unknown, unknown] => [
        oas({ "/a": resOp("Pet"), "/b": reqOp("Pet") }, { Pet: poly("Cat", value("Cat")), Cat: cat }),
        oas(
          { "/a": resOp("Pet2"), "/b": inlineReq(poly("Feline", value("Feline"))) },
          { Pet2: poly("Feline", value("Feline")), Feline: cat },
        ),
      ]
      return { pointer: pair((name) => `#/components/schemas/${name}`), "bare-name": pair((name) => name) }
    })(),
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 2,
        mentions: [/`Pet` to `Pet2`|`Cat` to `Feline`/],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-042",
    title: "component renamed together with the component its 3.2 discriminator defaultMapping names",
    before:
      "3.2: GET /a response and POST /b request body $ref Pet { oneOf [Cat, Dog]; discriminator kind, defaultMapping Cat }",
    after:
      "GET /a $ref Pet2 (oneOf [Feline, Dog], defaultMapping Feline), POST /b an inline copy; Feline a copy of Cat",
    rationale:
      "POLICY-116: Feline is Cat renamed (deep-equal); Pet's `oneOf` differs only by a `$ref` and its `discriminator` only by the `defaultMapping` repointed through that rename (a local pointer or a bare name): 2 of 2 direct fields are equal, Pet was renamed to Pet2 (before P8f: 1 of 2, a removal plus an addition); no content change",
    annotation: "names both component names of each rename",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-116" }],
    docs: (() => {
      const poly = (cat: string, value: string) => ({
        oneOf: [ref(cat), ref("Dog")],
        discriminator: { propertyName: "kind", defaultMapping: value },
      })
      const cat = { type: "object", properties: { kind: str, meow: str } }
      const dog = { type: "object", properties: { kind: str, bark: str } }
      const pair = (value: (name: string) => string): [unknown, unknown] => [
        oas(
          { "/a": resOp("Pet"), "/b": reqOp("Pet") },
          { Pet: poly("Cat", value("Cat")), Cat: cat, Dog: dog },
          "3.2.0",
        ),
        oas(
          { "/a": resOp("Pet2"), "/b": inlineReq(poly("Feline", value("Feline"))) },
          { Pet2: poly("Feline", value("Feline")), Feline: cat, Dog: dog },
          "3.2.0",
        ),
      ]
      return { pointer: pair((name) => `#/components/schemas/${name}`), "bare-name": pair((name) => name) }
    })(),
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 2,
        mentions: [/`Pet` to `Pet2`|`Cat` to `Feline`/],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-043",
    title: "response component renamed together with the path item component its link operationRef names",
    before:
      "/a $ref pathItems/Old; GET /b and GET /c 200 $ref responses/Ok { description, links next operationRef Old/get }",
    after:
      "Old renamed to New (/a repointed); GET /b 200 $ref Ok2 (operationRef New/get), GET /c an inline copy of Ok2",
    rationale:
      "POLICY-116: New is Old renamed (deep-equal); Ok keeps `description` and its `links` differ only by the operationRef repointed through that rename, so 2 of 2 direct fields are equal and Ok was renamed to Ok2 although GET /c no longer references it (before P8f: 1 of 2, Ok removed and Ok2 added); no content change",
    annotation: "names both component names of each rename",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-116" }],
    docs: (() => {
      const okResponse = (item: string) => ({
        description: "ok",
        links: { next: { operationRef: `#/components/pathItems/${item}/get` } },
      })
      const v = (item: string, response: string, inlineC: boolean) => ({
        openapi: "3.1.0",
        info,
        paths: {
          "/a": { $ref: `#/components/pathItems/${item}` },
          "/b": { get: { responses: { 200: { $ref: `#/components/responses/${response}` } } } },
          "/c": {
            get: {
              responses: { 200: inlineC ? okResponse(item) : { $ref: `#/components/responses/${response}` } },
            },
          },
        },
        components: {
          pathItems: { [item]: { get: { responses: ok } } },
          responses: { [response]: okResponse(item) },
        },
      })
      return [v("Old", "Ok", false), v("New", "Ok2", true)] as [unknown, unknown]
    })(),
    expect: [
      {
        at: ["components/pathItems", "components/responses"],
        action: "rename",
        type: annotation,
        count: 2,
        mentions: [/`Old` to `New`|`Ok` to `Ok2`/],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-044",
    title: "discriminator mapping value retargeted to a component that was not renamed still counts as different",
    before: "GET /a response and POST /b request body $ref Pet { oneOf [Cat, Dog]; mapping pet: Cat }; Cat, Dog",
    after: "GET /a $ref Pet2 (mapping pet: Dog), POST /b an inline copy of Pet2; Cat and Dog unchanged",
    rationale:
      "POLICY-116: only a reference repointed through a rename counts as equal; the mapping value now names Dog, which was not renamed, so `discriminator` differs: 1 of 2 direct fields equal, Pet is removed (breaking) and Pet2 added (non-breaking); the usages report the retargeted mapping value",
    annotation: "names the removed and the added component and the retargeted mapping value",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-116" }],
    docs: (() => {
      const poly = (target: string) => ({
        oneOf: [ref("Cat"), ref("Dog")],
        discriminator: { propertyName: "kind", mapping: { pet: `#/components/schemas/${target}` } },
      })
      const cat = { type: "object", properties: { kind: str, meow: str } }
      const dog = { type: "object", properties: { kind: str, bark: str } }
      return [
        oas({ "/a": resOp("Pet"), "/b": reqOp("Pet") }, { Pet: poly("Cat"), Cat: cat, Dog: dog }),
        oas({ "/a": resOp("Pet2"), "/b": inlineReq(poly("Dog")) }, { Pet2: poly("Dog"), Cat: cat, Dog: dog }),
      ] as [unknown, unknown]
    })(),
    expect: [
      { at: "components/schemas/Pet", action: "remove", type: breaking, count: 1, mentions: ["`Pet`"] },
      { at: "components/schemas/Pet2", action: "add", type: nonBreaking, count: 1, mentions: ["`Pet2`"] },
      {
        at: [`${RES}/discriminator/mapping/pet`, `${REQ}/discriminator/mapping/pet`],
        action: "replace",
        type: breaking,
        count: 2,
        mentions: ["`pet`", "Dog"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-REF-045",
    title: "two components equally similar through a repointed mapping value: no rename",
    before: "GET /a response and POST /b request body $ref Pet { oneOf [Cat]; mapping cat: Cat }; Cat",
    after: "GET /a $ref Pet2, POST /b $ref Pet3, both { oneOf [Feline]; mapping cat: Feline }; Feline a copy of Cat",
    rationale:
      "POLICY-112 with POLICY-116: Cat was renamed to Feline; with that rename applied Pet2 and Pet3 are equally similar to Pet (2 of 2 direct fields), a tie: Pet is removed (breaking) and Pet2, Pet3 are added (non-breaking); the usages read the same schema (no change)",
    annotation: "names the renamed, the removed and the added components",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-112 / 116" }],
    docs: (() => {
      const poly = (cat: string) => ({
        oneOf: [ref(cat)],
        discriminator: { propertyName: "kind", mapping: { cat: `#/components/schemas/${cat}` } },
      })
      const cat = { type: "object", properties: { kind: str, meow: str } }
      return [
        oas({ "/a": resOp("Pet"), "/b": reqOp("Pet") }, { Pet: poly("Cat"), Cat: cat }),
        oas({ "/a": resOp("Pet2"), "/b": reqOp("Pet3") }, { Pet2: poly("Feline"), Pet3: poly("Feline"), Feline: cat }),
      ] as [unknown, unknown]
    })(),
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["`Cat` to `Feline`"] },
      { at: "components/schemas/Pet", action: "remove", type: breaking, count: 1, mentions: ["`Pet`"] },
      { at: "components/schemas/Pet2", action: "add", type: nonBreaking, count: 1, mentions: ["`Pet2`"] },
      { at: "components/schemas/Pet3", action: "add", type: nonBreaking, count: 1, mentions: ["`Pet3`"] },
    ],
  },
]

runCases("openapi", "refs-components", cases, import.meta.filename)
