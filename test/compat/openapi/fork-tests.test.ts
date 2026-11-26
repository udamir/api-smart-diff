// OpenAPI scenarios of the Netcracker fork tests (github.com/Netcracker/qubership-apihub-api-diff, test/) and of the
// compatibility suites (github.com/Netcracker/qubership-apihub-compatibility-suites) that the other openapi case tables
// do not hold: the reverse direction of the explicit-default, explode, Accept / Content-Type / Authorization and
// allowEmptyValue / allowReserved suite cases, server variables, operation externalDocs descriptions, 3.1 Reference
// Object summaries, header keywords without effect, 3.0 -> 3.1 equivalences and bound changes, server prefixes moved
// from path-item / operation servers into the path, a doubled slash in a path key and an unreferenced path item added.
// Each case carries the area of the existing table it belongs to.

import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CaseSource, type CompatCase, type ExpectedChange, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const arr = { type: "array", items: { type: "string" } }
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const withParams = (...parameters: unknown[]) => oas({ "/pets": { get: op({ parameters }) } })
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
const byId = (o: Record<string, unknown> = {}) =>
  oas({ "/pets/{id}": { get: op({ parameters: [pathParam("id", o)] }) } })
const P0 = "paths/~1pets/get/parameters/0"
const PID = "paths/~1pets~1{id}/get/parameters/0"

const cs = (ref: string, verdict?: string): CaseSource => ({
  tool: "compat-suites",
  ref,
  ...(verdict ? { verdict } : {}),
})
const fork = (ref: string, verdict?: string): CaseSource => ({ tool: "fork", ref, ...(verdict ? { verdict } : {}) })
const suiteTest = (file: string, title: string, verdict?: string) =>
  fork(`test/compatibility-suites/openapi/${file}.test.ts ${title}`, verdict)

// POLICY-10 decided (a): a definition without effect on the wire is an annotation

const version = (to: string): ExpectedChange => ({
  at: "openapi",
  action: "replace",
  type: annotation,
  mentions: ["openapi", to],
})

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-FRK-001",
    area: "parameters",
    title:
      "explicit default values removed from a parameter (required, deprecated, allowEmptyValue, allowReserved, style)",
    before: "parameter with required / deprecated / allowEmptyValue / allowReserved false or its default style",
    after: "the same parameter without the field",
    rationale:
      "the removed value is the field's default: the parameter definition is unchanged (reverse of OAS-PARAM-015 / 028)",
    annotation: "no diff",
    sources: [
      cs("openapi/operation-parameters/remove-required-attribute-with-default-value-from-parameter", "no diffs"),
      cs("openapi/operation-parameters/remove-deprecated-attribute-with-default-value-from-parameter", "no diffs"),
      cs("openapi/operation-parameters/remove-allowEmptyValue-attribute-with-default-value-from-parameter", "no diffs"),
      cs(
        "openapi/operation-parameters/remove-allowReserved-attribute-with-default-value-from-query-parameter",
        "no diffs",
      ),
      cs("openapi/operation-parameters/remove-default-style-from-query-parameter", "no diffs"),
      cs("openapi/operation-parameters/remove-default-style-from-path-parameter", "no diffs"),
      cs("openapi/operation-parameters/remove-default-style-from-header-parameter", "no diffs"),
      cs("openapi/operation-parameters/remove-default-style-from-cookie-parameter", "no diffs"),
      suiteTest("operation-parameters", "Add/remove default values"),
    ],
    docs: {
      required: [withParams(query("q", { required: false })), withParams(query("q"))],
      deprecated: [withParams(query("q", { deprecated: false })), withParams(query("q"))],
      allowEmptyValue: [withParams(query("q", { allowEmptyValue: false })), withParams(query("q"))],
      allowReserved: [withParams(query("q", { allowReserved: false })), withParams(query("q"))],
      "style-query": [withParams(query("q", { style: "form" })), withParams(query("q"))],
      "style-path": [byId({ style: "simple" }), byId()],
      "style-header": [withParams(header("X-A", { style: "simple" })), withParams(header("X-A"))],
      "style-cookie": [withParams(cookie("c", { style: "form" })), withParams(cookie("c"))],
    },
    expect: [],
    // ISSUE-70 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-FRK-002",
    area: "request-body",
    title: "explicit default required: false removed from the request body",
    before: "request body with `required: false`",
    after: "request body without `required`",
    rationale: "false is the default of Request Body `required`: the contract is unchanged (reverse of OAS-RB-007)",
    annotation: "no diff, or an annotation naming the required status",
    sources: [
      cs("openapi/request/remove-required-attribute-with-default-value-from-requestBody", "no diffs"),
      suiteTest("request", "Remove required attribute with default value from request body", "no diffs"),
    ],
    docs: [
      oas({
        "/a": { post: op({ requestBody: { required: false, content: { "application/json": { schema: str } } } }) },
      }),
      oas({ "/a": { post: op({ requestBody: { content: { "application/json": { schema: str } } } }) } }),
    ],
    expect: [
      {
        at: "paths/~1a/post/requestBody/required",
        type: annotation,
        optional: true,
        mentions: ["required", "Request Body"],
      },
    ],
    // ISSUE-70 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-FRK-003",
    area: "paths",
    title: "unreferenced components.pathItems entry added",
    before: "components.pathItems { UserOps } referenced by /users",
    after: "components.pathItems { UserOps, UserCreate } (UserCreate not referenced)",
    rationale:
      "an unreferenced component is not part of any operation; decision §11.4 makes its diffs unclassified with a description (the fork reports no diff; reverse of OAS-PATH-020)",
    annotation: "names the added path item component",
    sources: [
      cs("openapi/general-operation-parameters/add-unused-method-in-path-item", "no diffs"),
      suiteTest("general-operation-parameters", "add-unused-method-in-path-item", "no diffs"),
    ],
    docs: [
      oas(
        { "/users": { $ref: "#/components/pathItems/UserOps" } },
        { components: { pathItems: { UserOps: { get: op() } } } },
      ),
      oas(
        { "/users": { $ref: "#/components/pathItems/UserOps" } },
        { components: { pathItems: { UserOps: { get: op() }, UserCreate: { post: op() } } } },
      ),
    ],
    expect: [
      {
        at: ["components/pathItems/UserCreate", "components/pathItems/UserCreate/**"],
        action: "add",
        type: unclassified,
        mentions: ["UserCreate"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-FRK-004",
    area: "servers-tags-info",
    title: "server variable removed from an operation-level server URL",
    before: "GET /pets servers [https://{username}.example.com] with variable username (default some-name)",
    after: "GET /pets servers [https://example.com] without variables",
    rationale: "POLICY-09 decided (a): server changes are annotations (reverse of OAS-SRV-007)",
    annotation: "names the server URL and the variable",
    sources: [
      cs("openapi/general-operation-parameters/remove-variable", "annotation"),
      suiteTest("general-operation-parameters", "Remove variable", "annotation"),
    ],
    docs: [
      oas({
        "/pets": {
          get: op({
            servers: [{ url: "https://{username}.example.com", variables: { username: { default: "some-name" } } }],
          }),
        },
      }),
      oas({ "/pets": { get: op({ servers: [{ url: "https://example.com" }] }) } }),
    ],
    expect: [
      {
        at: "paths/~1pets/get/servers/0/url",
        action: "replace",
        type: annotation,
        mentions: ["https://example.com"],
      },
      {
        at: ["paths/~1pets/get/servers/0/variables", "paths/~1pets/get/servers/0/variables/**"],
        action: "remove",
        type: annotation,
        mentions: ["username"],
      },
    ],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-FRK-005",
    area: "servers-tags-info",
    title: "server variable description added and removed",
    before: "variable env without / with description",
    after: "variable env with / without description",
    rationale: "documentation only (OAS-SRV-011 covers the change)",
    annotation: "names the variable and the description",
    sources: [
      cs("openapi/general-operation-parameters/add-server-variable-description", "annotation"),
      cs("openapi/general-operation-parameters/remove-server-variable-description", "annotation"),
    ],
    docs: {
      add: [
        oas(
          { "/pets": { get: op() } },
          { servers: [{ url: "https://{env}.example.com", variables: { env: { default: "prod" } } }] },
        ),
        oas(
          { "/pets": { get: op() } },
          {
            servers: [{ url: "https://{env}.example.com", variables: { env: { default: "prod", description: "a" } } }],
          },
        ),
      ],
      remove: [
        oas(
          { "/pets": { get: op() } },
          {
            servers: [{ url: "https://{env}.example.com", variables: { env: { default: "prod", description: "a" } } }],
          },
        ),
        oas(
          { "/pets": { get: op() } },
          { servers: [{ url: "https://{env}.example.com", variables: { env: { default: "prod" } } }] },
        ),
      ],
    },
    expect: {
      add: [
        {
          at: "servers/0/variables/env/description",
          action: "add",
          type: annotation,
          mentions: ["env", "description"],
        },
      ],
      remove: [
        {
          at: "servers/0/variables/env/description",
          action: "remove",
          type: annotation,
          mentions: ["env", "description"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-FRK-006",
    area: "operations",
    title: "operation externalDocs description added and removed",
    before: "GET /pets externalDocs { url } / { url, description }",
    after: "GET /pets externalDocs { url, description } / { url }",
    rationale: "documentation only (OAS-OP-016 covers url / description changes)",
    annotation: "names the externalDocs description and the operation",
    sources: [
      cs("openapi/general-operation-parameters/add-description-of-operation-external-doc", "annotation"),
      cs("openapi/general-operation-parameters/remove-description-of-operation-external-doc", "annotation"),
    ],
    docs: {
      add: [
        oas({ "/pets": { get: op({ externalDocs: { url: "https://docs.example.com/a" } }) } }),
        oas({ "/pets": { get: op({ externalDocs: { url: "https://docs.example.com/a", description: "a" } }) } }),
      ],
      remove: [
        oas({ "/pets": { get: op({ externalDocs: { url: "https://docs.example.com/a", description: "a" } }) } }),
        oas({ "/pets": { get: op({ externalDocs: { url: "https://docs.example.com/a" } }) } }),
      ],
    },
    expect: {
      add: [
        {
          at: "paths/~1pets/get/externalDocs/description",
          action: "add",
          type: annotation,
          mentions: ["GET /pets", "externalDocs"],
        },
      ],
      remove: [
        {
          at: "paths/~1pets/get/externalDocs/description",
          action: "remove",
          type: annotation,
          mentions: ["GET /pets", "externalDocs"],
        },
      ],
    },
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-FRK-007",
    area: "parameters",
    title: "Accept / Authorization header parameters removed and Content-Type added",
    before: "GET /pets with (without) a required header parameter Accept / Authorization / Content-Type",
    after: "without (with) it",
    rationale:
      "OAS: header parameters named Accept, Content-Type or Authorization SHALL be ignored; POLICY-10 decided (a): annotation (the other directions of OAS-PARAM-035)",
    annotation: "names the header parameter",
    sources: [
      cs("openapi/operation-parameters/remove-header-parameter-with-name-accept", "unclassified"),
      cs("openapi/operation-parameters/add-header-parameter-with-name-content-type", "unclassified"),
      cs("openapi/operation-parameters/remove-header-parameter-with-name-authorization", "unclassified"),
      fork(
        "test/openapi.classification.test.ts [Headers] Removal of header 'Accept' should be a non-breaking change",
        "unclassified",
      ),
    ],
    docs: {
      acceptRemoved: [withParams(header("Accept", { required: true })), withParams()],
      contentTypeAdded: [withParams(), withParams(header("Content-Type", { required: true }))],
      authorizationRemoved: [withParams(header("Authorization", { required: true })), withParams()],
    },
    expect: {
      acceptRemoved: [{ at: P0, action: "remove", type: annotation, mentions: ["header parameter `Accept`"] }],
      contentTypeAdded: [{ at: P0, action: "add", type: annotation, mentions: ["header parameter `Content-Type`"] }],
      authorizationRemoved: [
        { at: P0, action: "remove", type: annotation, mentions: ["header parameter `Authorization`"] },
      ],
    },
    // ISSUE-133 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-FRK-008",
    area: "parameters",
    title: "allowEmptyValue / allowReserved enabled on a path parameter",
    before: "path parameter id without allowEmptyValue (or allowReserved)",
    after: "with allowEmptyValue (or allowReserved) true",
    rationale:
      "both fields apply only to query parameters: POLICY-10 decided (a), annotation (the other direction of OAS-PARAM-034)",
    annotation: "names the path parameter",
    sources: [
      cs("openapi/operation-parameters/allow-empty-value-for-not-query", "unclassified"),
      cs("openapi/operation-parameters/allow-reserved-characters-for-not-query", "unclassified"),
    ],
    docs: {
      allowEmptyValue: [byId(), byId({ allowEmptyValue: true })],
      allowReserved: [byId(), byId({ allowReserved: true })],
    },
    expect: [{ at: `${PID}/*`, type: annotation, mentions: ["path parameter `id`"] }],
    // ISSUE-133 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-FRK-009",
    area: "parameters",
    title:
      "explode switched the other way (primitive and form arrays to exploded, spaceDelimited array to not exploded)",
    before:
      "query q (string) explode false / tags (array, form) explode false / tags (array, spaceDelimited) explode true",
    after: "explode true / explode true / explode false",
    rationale:
      "explode has no effect on a primitive value (POLICY-10 decided (a): annotation); on an array it changes the wire format clients send (breaking, as OAS-PARAM-029 / 030)",
    annotation: "names the query parameter and explode",
    sources: [
      cs("openapi/operation-parameters/mark-primitive-parameter-as-exploded", "unclassified"),
      cs("openapi/operation-parameters/mark-array-parameter-with-form-style-as-exploded", "breaking"),
      cs("openapi/operation-parameters/mark-array-parameter-with-not-form-style-as-not-exploded", "breaking"),
    ],
    docs: {
      primitive: [withParams(query("q", { explode: false })), withParams(query("q", { explode: true }))],
      form: [
        withParams(query("tags", { explode: false, schema: arr })),
        withParams(query("tags", { explode: true, schema: arr })),
      ],
      spaceDelimited: [
        withParams(query("tags", { style: "spaceDelimited", explode: true, schema: arr })),
        withParams(query("tags", { style: "spaceDelimited", explode: false, schema: arr })),
      ],
    },
    expect: {
      primitive: [{ at: `${P0}/explode`, type: annotation, mentions: ["query parameter `q`", "explode"] }],
      form: [{ at: `${P0}/explode`, type: breaking, mentions: ["query parameter `tags`", "explode"] }],
      spaceDelimited: [{ at: `${P0}/explode`, type: breaking, mentions: ["query parameter `tags`", "explode"] }],
    },
    // primitive: ISSUE-133 (fixed)
    // ISSUE-82 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-FRK-010",
    area: "examples",
    title: "3.1 reference object: overriding example summary removed, changed, or the referenced summary changed",
    before: "parameter examples.one: { $ref: Sample, summary: `o1` }, Sample.summary `c1`",
    after: "{ $ref: Sample } / summary `o2` / Sample.summary `c2` while the usage keeps `o1`",
    rationale: "documentation only; while the usage overrides the summary, only the component changes",
    annotation: "names the summary of example `one` (or of component Sample)",
    sources: [
      cs("openapi/parameters-examples/remove-overriden-summary", "annotation"),
      cs("openapi/parameters-examples/change-overriden-summary", "annotation"),
      cs("openapi/parameters-examples/change-referenced-summary-when-overridden-exists", "no diffs"),
      fork("test/compatibility-suites/openapi/templates/reference-object-31.template.ts runRefObjectSummaryTests"),
    ],
    docs: (() => {
      const d = (summary: string | undefined, component: string) =>
        oas(
          {
            "/pets": {
              get: op({
                parameters: [
                  query("q", {
                    examples: { one: { $ref: "#/components/examples/Sample", ...(summary ? { summary } : {}) } },
                  }),
                ],
              }),
            },
          },
          { components: { examples: { Sample: { summary: component, value: "a" } } } },
        )
      return {
        removed: [d("o1", "c1"), d(undefined, "c1")] as [unknown, unknown],
        changed: [d("o1", "c1"), d("o2", "c1")] as [unknown, unknown],
        referenced: [d("o1", "c1"), d("o1", "c2")] as [unknown, unknown],
      }
    })(),
    expect: {
      removed: [
        { at: `${P0}/examples/one/summary`, action: ["remove", "replace"], type: annotation, mentions: ["summary"] },
      ],
      changed: [{ at: `${P0}/examples/one/summary`, action: "replace", type: annotation, mentions: ["summary"] }],
      referenced: [
        {
          at: "components/examples/Sample/summary",
          action: "replace",
          type: annotation,
          mentions: ["Sample", "summary"],
        },
      ],
    },
    // ISSUE-60 (fixed for `referenced`): the referenced summary change is reported at the declaration only (POLICY-57)
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-FRK-011",
    area: "headers",
    title: "response header allowEmptyValue / allowReserved changed and style changed",
    before: "X-Rate allowEmptyValue true / allowReserved true / style simple",
    after: "without allowEmptyValue / allowReserved false / style form",
    rationale:
      "allowEmptyValue and allowReserved apply only to query parameters, so on a header they have no effect (POLICY-10 decided (a): annotation); a style change alters how clients must parse the header value (breaking)",
    annotation: "names the header and the keyword",
    sources: [
      fork("test/human-readable/openapi/header-object.test.ts Allow Empty Value Inline / Ref"),
      fork("test/human-readable/openapi/header-object.test.ts AllowReserved Inline / Ref"),
      fork("test/human-readable/openapi/header-object.test.ts Style Inline / Ref"),
      cs("openapi/human-readable/header-object-style-inline"),
    ],
    docs: (() => {
      const d = (h: Record<string, unknown>) =>
        oas({
          "/pets": { get: { responses: { 200: { description: "ok", headers: { "X-Rate": { schema: str, ...h } } } } } },
        })
      return {
        allowEmptyValue: [d({ allowEmptyValue: true }), d({})] as [unknown, unknown],
        allowReserved: [d({ allowReserved: true }), d({ allowReserved: false })] as [unknown, unknown],
        style: [d({ style: "simple" }), d({ style: "form" })] as [unknown, unknown],
      }
    })(),
    expect: {
      allowEmptyValue: [
        { at: "paths/~1pets/get/responses/200/headers/X-Rate/allowEmptyValue", type: annotation, mentions: ["X-Rate"] },
      ],
      allowReserved: [
        { at: "paths/~1pets/get/responses/200/headers/X-Rate/allowReserved", type: annotation, mentions: ["X-Rate"] },
      ],
      style: [
        {
          at: "paths/~1pets/get/responses/200/headers/X-Rate/style",
          action: "replace",
          type: breaking,
          mentions: ["X-Rate", "style"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-FRK-012",
    area: "versions",
    title: "3.0 nullable vs 3.1 anyOf with a null branch (inline and through a $ref)",
    before: "3.0.4 request body { type: string, nullable: true } (inline / component S)",
    after: "3.1.0 anyOf [{ type: string }, { type: 'null' }] (inline / component S) or type [string, null] in S",
    rationale: "the same set of values written in each version's idiom (§7.3): only the version change",
    annotation: "only the version change",
    sources: [
      fork("test/oas-30-to-31.test.ts nullable is equivalent to anyOf with null type", "only the version change"),
      fork(
        "test/oas-30-to-31.test.ts nullable is equivalent to anyOf with null type for schema defined via ref",
        "only the version change",
      ),
      fork(
        "test/oas-30-to-31.test.ts nullable is equivalent to union with null type for schema defined via ref",
        "only the version change",
      ),
    ],
    docs: (() => {
      const body = (openapi: string, schema: unknown, components?: Record<string, unknown>) =>
        oas(
          { "/a": { post: op({ requestBody: { content: { "application/json": { schema } } } }) } },
          components ? { components: { schemas: components } } : {},
          openapi,
        )
      const ref = { $ref: "#/components/schemas/S" }
      const nullable = { type: "string", nullable: true }
      const anyOf = { anyOf: [{ type: "string" }, { type: "null" }] }
      return {
        anyOf: [body("3.0.4", nullable), body("3.1.0", anyOf)] as [unknown, unknown],
        "ref-anyOf": [body("3.0.4", ref, { S: nullable }), body("3.1.0", ref, { S: anyOf })] as [unknown, unknown],
        "ref-union": [body("3.0.4", ref, { S: nullable }), body("3.1.0", ref, { S: { type: ["string", "null"] } })] as [
          unknown,
          unknown,
        ],
      }
    })(),
    expect: [version("3.1.0")],
    // ISSUE-98 (fixed) (P5): the anyOf of single-type branches is the 3.0 nullable type; remaining cause: the
    // `openapi` description does not name the versions, ISSUE-84
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-FRK-013",
    area: "versions",
    title: "3.0 explicit inclusive bounds and bare boolean exclusive bounds vs 3.1",
    before: "3.0.4 { minimum 1, exclusiveMinimum false } / { exclusiveMinimum true } (no minimum), same for maximum",
    after: "3.1.0 { minimum 1 } / {} (no bound)",
    rationale:
      "exclusiveMinimum false is the draft-04 default and a boolean exclusive bound without minimum / maximum has no effect: the same constraints (§7.3)",
    annotation: "only the version change",
    sources: [
      fork(
        "test/oas-30-to-31.test.ts OAS 3.0 explicit inclusive bounds are equivalent to OAS 3.1 inclusive bounds",
        "only the version change",
      ),
      fork(
        "test/oas-30-to-31.test.ts OAS 3.0 bare boolean exclusive bounds are ignored when no numeric bound can be inferred",
        "only the version change",
      ),
    ],
    docs: (() => {
      const body = (openapi: string, a: Record<string, unknown>, b: Record<string, unknown>) =>
        oas(
          {
            "/a": {
              post: op({
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { lo: { type: "number", ...a }, hi: { type: "number", ...b } },
                      },
                    },
                  },
                },
              }),
            },
          },
          {},
          openapi,
        )
      return {
        inclusive: [
          body("3.0.4", { minimum: 1, exclusiveMinimum: false }, { maximum: 10, exclusiveMaximum: false }),
          body("3.1.0", { minimum: 1 }, { maximum: 10 }),
        ] as [unknown, unknown],
        bare: [body("3.0.4", { exclusiveMinimum: true }, { exclusiveMaximum: true }), body("3.1.0", {}, {})] as [
          unknown,
          unknown,
        ],
      }
    })(),
    expect: [version("3.1.0")],
    // ISSUE-88 (fixed) (P5): the boolean exclusive form without a bound has no effect; remaining cause: ISSUE-84
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-FRK-014",
    area: "versions",
    title: "3.0 -> 3.1 together with a stricter numeric bound in a request body",
    before:
      "3.0.4 { minimum 1, exclusiveMinimum true } / { maximum 10, exclusiveMaximum true } / { minimum 1 } / { maximum 10 }",
    after: "3.1.0 { exclusiveMinimum 2 } / { exclusiveMaximum 9 } / { minimum 2 } / { maximum 9 }",
    rationale:
      "after the representation change (§7.3) the effective bound is stricter (> 1 to > 2, < 10 to < 9, >= 1 to >= 2, <= 10 to <= 9): requests with the dropped values fail (breaking)",
    annotation: "the version change and the bound keyword",
    sources: [
      fork(
        "test/oas-30-to-31.test.ts origins when exclusiveMinimum is true, diff beforeDeclarationPaths point to minimum",
      ),
      fork(
        "test/oas-30-to-31.test.ts origins when exclusiveMaximum is true, diff beforeDeclarationPaths point to maximum",
      ),
      fork("test/oas-30-to-31.test.ts origins when exclusiveMinimum is false, diff on minimum retains minimum origins"),
      fork("test/oas-30-to-31.test.ts origins when exclusiveMaximum is false, diff on maximum retains maximum origins"),
    ],
    docs: (() => {
      const body = (openapi: string, schema: Record<string, unknown>) =>
        oas(
          {
            "/a": {
              post: op({ requestBody: { content: { "application/json": { schema: { type: "number", ...schema } } } } }),
            },
          },
          {},
          openapi,
        )
      return {
        exclusiveMinimum: [
          body("3.0.4", { minimum: 1, exclusiveMinimum: true }),
          body("3.1.0", { exclusiveMinimum: 2 }),
        ] as [unknown, unknown],
        exclusiveMaximum: [
          body("3.0.4", { maximum: 10, exclusiveMaximum: true }),
          body("3.1.0", { exclusiveMaximum: 9 }),
        ] as [unknown, unknown],
        minimum: [body("3.0.4", { minimum: 1, exclusiveMinimum: false }), body("3.1.0", { minimum: 2 })] as [
          unknown,
          unknown,
        ],
        maximum: [body("3.0.4", { maximum: 10, exclusiveMaximum: false }), body("3.1.0", { maximum: 9 })] as [
          unknown,
          unknown,
        ],
      }
    })(),
    expect: (() => {
      const S = "paths/~1a/post/requestBody/content/application~1json/schema"
      const bound: ExpectedChange[] = [
        version("3.1.0"),
        {
          at: ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"].map((kw) => `${S}/${kw}`),
          type: breaking,
          mentions: [/imum/i],
        },
      ]
      return { exclusiveMinimum: bound, exclusiveMaximum: bound, minimum: bound, maximum: bound }
    })(),
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-FRK-015",
    area: "paths",
    title: "server prefix moved from path-item or operation servers into the path",
    before: "/users with path-item (or GET operation) servers [https://api.example.com/api/v1]",
    after: "/api/v1/users with path-item servers [https://api.example.com] (or without operation servers)",
    rationale:
      "the effective request URL https://api.example.com/api/v1/users is unchanged, so existing clients keep working; the fork maps the path and reports only annotations (as OAS-PATH-023 for the root server)",
    annotation: "the path change names both paths; the server change names the URL",
    sources: [
      fork(
        "test/openapi.pathAndMethodMapping.test.ts Should match operation when prefix moved from path item object servers to path",
        "annotation",
      ),
      fork(
        "test/openapi.pathAndMethodMapping.test.ts Should match operation when prefix moved from operation object servers to path (it.skip)",
        "annotation",
      ),
      fork(
        "test/openapi.pathAndMethodMapping.test.ts Should prioritize prefix specified in path item object servers to root servers",
        "annotation",
      ),
    ],
    docs: {
      "path-item": [
        oas({ "/users": { servers: [{ url: "https://api.example.com/api/v1" }], get: op() } }),
        oas({ "/api/v1/users": { servers: [{ url: "https://api.example.com" }], get: op() } }),
      ],
      operation: [
        oas(
          { "/users": { get: op({ servers: [{ url: "https://api.example.com/api/v1" }] }) } },
          { servers: [{ url: "https://api.example.com" }] },
        ),
        oas({ "/api/v1/users": { get: op() } }, { servers: [{ url: "https://api.example.com" }] }),
      ],
    },
    expect: {
      "path-item": [
        { at: "paths", action: "rename", type: annotation, mentions: ["/users", "/api/v1/users"] },
        { at: "paths/*/servers/0/url", action: "replace", type: annotation, mentions: ["https://api.example.com"] },
      ],
      operation: [
        { at: "paths", action: "rename", type: annotation, mentions: ["/users", "/api/v1/users"] },
        {
          at: ["paths/*/get/servers", "paths/*/get/servers/**"],
          action: "remove",
          type: annotation,
          mentions: ["https://api.example.com/api/v1"],
        },
      ],
    },
    // ISSUE-80 (fixed); ISSUE-84 fixed for "path-item" (P8a)
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-FRK-016",
    area: "paths",
    title: "doubled slash removed from a path key (//pets -> /pets)",
    before: "//pets (GET)",
    after: "/pets (GET)",
    rationale:
      "POLICY-43 decided (b): repeated slashes are collapsed, so //pets and /pets are the same path and the change is a rename annotation (as the fork, which treats the doubled slash as a typo; RFC 3986 would keep them apart)",
    annotation: "names both spellings of the path",
    sources: [fork("test/openapi.pathAndMethodMapping.test.ts Remove mistyped slashes", "rename, annotation")],
    docs: [oas({ "//pets": { get: op() } }), oas({ "/pets": { get: op() } })],
    // POLICY-43 decided (b) (changed: the proposed option (a) expected GET //pets removed and GET /pets added)
    expect: [{ at: "paths", action: "rename", type: annotation, mentions: ["//pets", "/pets"] }],
  },
]

runCases("openapi", "fork-tests", cases, import.meta.filename)
