import { annotation } from "../../../src"
import { type CompatCase, type ExpectedChange, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const oas = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({
  openapi,
  info,
  paths,
  ...extra,
})
type Dir = "request" | "response"
/** application/json media type of the POST /a request body or of the GET /a 200 response with extra fields */
const doc = (dir: Dir, media: Record<string, unknown>, extra: Record<string, unknown> = {}, openapi?: string) => {
  const content = { "application/json": { schema: str, ...media } }
  return dir === "request"
    ? oas({ "/a": { post: { requestBody: { content }, responses: ok } } }, extra, openapi)
    : oas({ "/a": { get: { responses: { 200: { description: "ok", content } } } } }, extra, openapi)
}
/** request and response variants of one before / after media type pair */
const both = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  extra: Record<string, unknown> = {},
  openapi?: string,
) => ({
  request: [doc("request", before, extra, openapi), doc("request", after, extra, openapi)] as [unknown, unknown],
  response: [doc("response", before, extra, openapi), doc("response", after, extra, openapi)] as [unknown, unknown],
})
const MT = {
  request: "paths/~1a/post/requestBody/content/application~1json",
  response: "paths/~1a/get/responses/200/content/application~1json",
}
const where = { request: /request ?body/i, response: "200" }
/** one expectation per direction at a path below the media type */
const at = (rel: string | string[], mentions: (string | RegExp)[], extra: Partial<ExpectedChange> = {}) => {
  const rels = Array.isArray(rel) ? rel : [rel]
  const one = (dir: Dir): ExpectedChange[] => [
    {
      at: rels.map((r) => `${MT[dir]}/${r}`),
      type: annotation,
      mentions: [...mentions, "application/json", where[dir]],
      ...extra,
    },
  ]
  return { request: one("request"), response: one("response") }
}
const exRef = { $ref: "#/components/examples/Sample" }
const withEx = { examples: { one: exRef } }
const comps = (sample: unknown) => ({ components: { examples: { Sample: sample } } })

const suite = (name: string) => [
  { tool: "compat-suites", ref: `openapi/request-body-examples ${name}` },
  { tool: "compat-suites", ref: `openapi/response-body-examples ${name}` },
  {
    tool: "fork",
    ref: "test/compatibility-suites/openapi/request-body-examples.test.ts, response-body-examples.test.ts",
  },
]

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-EX-001",
    title: "examples map added to a media type",
    before: "application/json without examples",
    after: "examples { one }",
    rationale: "examples are documentation only",
    annotation: "names the added example `one` and its location",
    sources: [
      ...suite("add-examples-object-for-request-body / add-examples-object-for-response-body"),
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go MediaType.Examples" },
    ],
    docs: both({}, { examples: { one: { value: "a" } } }),
    expect: at(["examples", "examples/one"], ["one"], { action: "add" }),
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-EX-002",
    title: "additional example added",
    before: "examples { one }",
    after: "examples { one, two }",
    rationale: "documentation only",
    annotation: "names the added example `two` and its location",
    sources: suite("add-additional-examples-object"),
    docs: both({ examples: { one: { value: "a" } } }, { examples: { one: { value: "a" }, two: { value: "b" } } }),
    expect: at("examples/two", ["two"], { action: "add" }),
  },
  {
    kind: "doc",
    id: "OAS-EX-003",
    title: "example removed",
    before: "examples { one, two }",
    after: "examples { one }",
    rationale: "documentation only",
    annotation: "names the removed example `two` and its location",
    sources: [{ tool: "fork", ref: "test/human-readable/openapi/examples-object.test.ts Examples Inline" }],
    docs: both({ examples: { one: { value: "a" }, two: { value: "b" } } }, { examples: { one: { value: "a" } } }),
    expect: at("examples/two", ["two"], { action: "remove" }),
  },
  {
    kind: "doc",
    id: "OAS-EX-004",
    title: "example value changed (scalar and nested object)",
    before: "examples.one value `a` / { prop1: { prop11: 1 } }",
    after: "value `b` / { prop1: { prop11: 2 } }",
    rationale: "documentation only",
    annotation: "names the example `one`, its value and its location",
    sources: [
      ...suite("update-example-value"),
      { tool: "fork", ref: "test/human-readable/openapi/examples-object.test.ts Value Inline, Value Object Inline" },
    ],
    docs: {
      ...both({ examples: { one: { value: "a" } } }, { examples: { one: { value: "b" } } }),
      "request-object": [
        doc("request", { examples: { one: { value: { prop1: { prop11: 1 } } } } }),
        doc("request", { examples: { one: { value: { prop1: { prop11: 2 } } } } }),
      ],
      "response-object": [
        doc("response", { examples: { one: { value: { prop1: { prop11: 1 } } } } }),
        doc("response", { examples: { one: { value: { prop1: { prop11: 2 } } } } }),
      ],
    },
    expect: {
      ...at("examples/one/value/**", ["one", "value"]),
      "request-object": at("examples/one/value/**", ["one", "value"]).request,
      "response-object": at("examples/one/value/**", ["one", "value"]).response,
    },
  },
  {
    kind: "doc",
    id: "OAS-EX-005",
    title: "example renamed",
    before: "examples { example1 }",
    after: "examples { example0 } (same value)",
    rationale: "documentation only; reported as remove + add",
    annotation: "names the removed and the added example",
    sources: suite("update-name-of-example"),
    docs: both({ examples: { example1: { value: "a" } } }, { examples: { example0: { value: "a" } } }),
    expect: {
      request: [
        {
          at: `${MT.request}/examples/example1`,
          action: "remove",
          type: annotation,
          mentions: ["example1", "application/json", where.request],
        },
        {
          at: `${MT.request}/examples/example0`,
          action: "add",
          type: annotation,
          mentions: ["example0", "application/json", where.request],
        },
      ],
      response: [
        {
          at: `${MT.response}/examples/example1`,
          action: "remove",
          type: annotation,
          mentions: ["example1", "application/json", where.response],
        },
        {
          at: `${MT.response}/examples/example0`,
          action: "add",
          type: annotation,
          mentions: ["example0", "application/json", where.response],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-EX-006",
    title: "example externalValue changed and removed",
    before: "examples.one externalValue http://a",
    after: "externalValue http://b / removed",
    rationale: "documentation only",
    annotation: "names externalValue of example `one` and its location",
    sources: [
      ...suite("update-external-value-of-example, remove-external-value-of-example"),
      { tool: "fork", ref: "test/human-readable/openapi/examples-object.test.ts External Value Inline" },
    ],
    docs: {
      request: [
        doc("request", { examples: { one: { externalValue: "http://a" } } }),
        doc("request", { examples: { one: { externalValue: "http://b" } } }),
      ],
      response: [
        doc("response", { examples: { one: { externalValue: "http://a" } } }),
        doc("response", { examples: { one: { externalValue: "http://b" } } }),
      ],
      "request-remove": [
        doc("request", { examples: { one: { summary: "s", externalValue: "http://a" } } }),
        doc("request", { examples: { one: { summary: "s" } } }),
      ],
      "response-remove": [
        doc("response", { examples: { one: { summary: "s", externalValue: "http://a" } } }),
        doc("response", { examples: { one: { summary: "s" } } }),
      ],
    },
    expect: {
      ...at("examples/one/externalValue", ["one", "externalValue"]),
      "request-remove": at("examples/one/externalValue", ["one", "externalValue"], { action: "remove" }).request,
      "response-remove": at("examples/one/externalValue", ["one", "externalValue"], { action: "remove" }).response,
    },
  },
  {
    kind: "doc",
    id: "OAS-EX-007",
    title: "example summary added, changed, removed",
    before: "summary absent / `s1`",
    after: "`s1` / `s2` / absent",
    rationale: "documentation only",
    annotation: "names the summary of example `one` and its location",
    sources: suite("add-summary-of-example, update-summary-of-example, remove-summary-of-example"),
    docs: {
      ...both({ examples: { one: { value: "a" } } }, { examples: { one: { value: "a", summary: "s1" } } }),
      "request-change": [
        doc("request", { examples: { one: { value: "a", summary: "s1" } } }),
        doc("request", { examples: { one: { value: "a", summary: "s2" } } }),
      ],
      "response-remove": [
        doc("response", { examples: { one: { value: "a", summary: "s1" } } }),
        doc("response", { examples: { one: { value: "a" } } }),
      ],
    },
    expect: {
      ...at("examples/one/summary", ["one", "summary"]),
      "request-change": at("examples/one/summary", ["one", "summary"]).request,
      "response-remove": at("examples/one/summary", ["one", "summary"]).response,
    },
  },
  {
    kind: "doc",
    id: "OAS-EX-008",
    title: "example description added, changed, removed",
    before: "description absent / `d1`",
    after: "`d1` / `d2` / absent",
    rationale: "documentation only",
    annotation: "names the description of example `one` and its location",
    sources: suite("add-description-of-example, update-description-of-example, remove-description-of-example"),
    docs: {
      ...both({ examples: { one: { value: "a" } } }, { examples: { one: { value: "a", description: "d1" } } }),
      "request-change": [
        doc("request", { examples: { one: { value: "a", description: "d1" } } }),
        doc("request", { examples: { one: { value: "a", description: "d2" } } }),
      ],
      "response-remove": [
        doc("response", { examples: { one: { value: "a", description: "d1" } } }),
        doc("response", { examples: { one: { value: "a" } } }),
      ],
    },
    expect: {
      ...at("examples/one/description", ["one", "description"]),
      "request-change": at("examples/one/description", ["one", "description"]).request,
      "response-remove": at("examples/one/description", ["one", "description"]).response,
    },
  },
  {
    kind: "doc",
    id: "OAS-EX-009",
    title: "singular `example` added, changed (scalar and nested), removed",
    before: "example absent / `a` / { prop1: 1 }",
    after: "`a` / `b` / { prop1: 2 } / absent",
    rationale: "documentation only",
    annotation: "names the example and its location",
    sources: [
      {
        tool: "fork",
        ref: "test/human-readable/openapi/request-body-object.test.ts Content Example Inline, Content Example Array Inline",
      },
      { tool: "fork", ref: "test/human-readable/openapi/response-object.test.ts Content Example Inline" },
      {
        tool: "asd",
        ref: "test/openapi/request-body-content.test.ts C4.9; test/openapi/responses-edge-cases.test.ts C5.15",
      },
    ],
    docs: {
      ...both({ example: "a" }, { example: "b" }),
      "request-add": [doc("request", {}), doc("request", { example: "a" })],
      "response-remove": [doc("response", { example: "a" }), doc("response", {})],
      "request-object": [doc("request", { example: { prop1: 1 } }), doc("request", { example: { prop1: 2 } })],
    },
    expect: {
      ...at("example/**", ["example"]),
      "request-add": at("example", ["example"]).request,
      "response-remove": at("example", ["example"]).response,
      "request-object": at("example/**", ["example"]).request,
    },
  },
  {
    kind: "doc",
    id: "OAS-EX-010",
    title: "singular `example` replaced by an `examples` map",
    before: "example `a`",
    after: "examples { one: value `a` }",
    rationale: "documentation only (OAS: `example` and `examples` are mutually exclusive)",
    annotation: "names the removed example and the added examples",
    sources: [
      { tool: "openapi-diff", ref: "core/src/test/resources/issue-666-oas-3-1-examples-handling-1.yaml / -2.yaml" },
    ],
    docs: both({ example: "a" }, { examples: { one: { value: "a" } } }),
    expect: at(["example", "examples", "examples/one"], ["example"]),
  },
  {
    kind: "doc",
    id: "OAS-EX-011",
    title: "examples entry referencing components.examples: referenced value changed",
    before: "examples.one $ref Sample (value `a`)",
    after: "Sample value `b`",
    rationale:
      "documentation only; POLICY-57 (decided after P3): an annotation-only change inside a component is reported at its declaration only, not at the usage",
    annotation: "names the example value in component Sample",
    sources: [
      {
        tool: "fork",
        ref: "test/human-readable/openapi/examples-object.test.ts Value Ref, Summary Ref, Description Ref",
      },
      { tool: "libopenapi", ref: "what-changed/model/example_test.go" },
    ],
    docs: {
      request: [doc("request", withEx, comps({ value: "a" })), doc("request", withEx, comps({ value: "b" }))],
      response: [doc("response", withEx, comps({ value: "a" })), doc("response", withEx, comps({ value: "b" }))],
    },
    // ISSUE-190 (fixed): the usage-site diff (`examples/one/value` at the operation) is no longer reported
    expect: {
      request: [{ at: "components/examples/Sample/value", type: annotation, mentions: ["Sample", "value"] }],
      response: [{ at: "components/examples/Sample/value", type: annotation, mentions: ["Sample", "value"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-EX-012",
    title: "3.1 reference object: overriding example summary / description added next to an example $ref",
    before: "examples.one: { $ref: Sample }",
    after: "examples.one: { $ref: Sample, summary: `o` } / description `o`",
    rationale: "OAS 3.1 Reference Object `summary` / `description` override the referenced ones; documentation only",
    annotation: "names the summary / description of example `one`",
    sources: suite("add-overriden-description"),
    docs: {
      request: [
        doc("request", withEx, comps({ summary: "c", value: "a" })),
        doc("request", { examples: { one: { ...exRef, summary: "o" } } }, comps({ summary: "c", value: "a" })),
      ],
      response: [
        doc("response", withEx, comps({ description: "c", value: "a" })),
        doc("response", { examples: { one: { ...exRef, description: "o" } } }, comps({ description: "c", value: "a" })),
      ],
    },
    expect: {
      request: at("examples/one/summary", ["one", "summary"], { action: ["add", "replace"] }).request,
      response: at("examples/one/description", ["one", "description"], { action: ["add", "replace"] }).response,
    },
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EX-013",
    title: "3.1 reference object: overriding example description removed or changed",
    before: "examples.one: { $ref: Sample, description: `o1` }",
    after: "{ $ref: Sample } / description `o2`",
    rationale: "documentation only",
    annotation: "names the description of example `one`",
    sources: suite("remove-overriden-description, change-overriden-description"),
    docs: {
      request: [
        doc("request", { examples: { one: { ...exRef, description: "o1" } } }, comps({ description: "c", value: "a" })),
        doc("request", withEx, comps({ description: "c", value: "a" })),
      ],
      response: [
        doc(
          "response",
          { examples: { one: { ...exRef, description: "o1" } } },
          comps({ description: "c", value: "a" }),
        ),
        doc(
          "response",
          { examples: { one: { ...exRef, description: "o2" } } },
          comps({ description: "c", value: "a" }),
        ),
      ],
    },
    expect: at("examples/one/description", ["one", "description"], { action: ["remove", "replace"] }),
    // ISSUE-60 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-EX-014",
    title: "3.1 reference object: referenced example description changed while the usage overrides it",
    before: "examples.one: { $ref: Sample, description: `o` }, Sample.description `c1`",
    after: "Sample.description `c2`",
    rationale: "the usage still shows `o`: only the component changed",
    annotation: "names the description of component Sample; nothing at the usage site",
    sources: suite("change-referenced-description-when-overridden-exists"),
    docs: {
      request: [
        doc("request", { examples: { one: { ...exRef, description: "o" } } }, comps({ description: "c1", value: "a" })),
        doc("request", { examples: { one: { ...exRef, description: "o" } } }, comps({ description: "c2", value: "a" })),
      ],
      response: [
        doc(
          "response",
          { examples: { one: { ...exRef, description: "o" } } },
          comps({ description: "c1", value: "a" }),
        ),
        doc(
          "response",
          { examples: { one: { ...exRef, description: "o" } } },
          comps({ description: "c2", value: "a" }),
        ),
      ],
    },
    expect: [
      {
        at: "components/examples/Sample/description",
        action: "replace",
        type: annotation,
        mentions: ["Sample", "description"],
      },
    ],
    // ISSUE-60 (fixed for this variant): the referenced description change is an annotation inside a component, reported
    // at the declaration only (POLICY-57, ISSUE-190), so the overridden usage site no longer repeats it
  },
  {
    kind: "doc",
    id: "OAS-EX-015",
    title: "3.2 example dataValue and serializedValue changed",
    before: "examples.one dataValue `a` / serializedValue `a`",
    after: "dataValue `b` / serializedValue `b`",
    rationale: "OAS 3.2 Example Object values are documentation only",
    annotation: "names dataValue / serializedValue of example `one` and its location",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Example.DataValue, Example.SerializedValue" },
      { tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §7.2 Example dataValue / serializedValue" },
    ],
    docs: {
      request: [
        doc("request", { examples: { one: { dataValue: "a" } } }, {}, "3.2.0"),
        doc("request", { examples: { one: { dataValue: "b" } } }, {}, "3.2.0"),
      ],
      response: [
        doc("response", { examples: { one: { serializedValue: "a" } } }, {}, "3.2.0"),
        doc("response", { examples: { one: { serializedValue: "b" } } }, {}, "3.2.0"),
      ],
    },
    expect: {
      request: at("examples/one/dataValue", ["one", "dataValue"]).request,
      response: at("examples/one/serializedValue", ["one", "serializedValue"]).response,
    },
  },
  {
    kind: "doc",
    id: "OAS-EX-016",
    title: "3.1 -> 3.2: example `value` moved to `dataValue` unchanged",
    before: "3.1.0 examples.one value `a`",
    after: "3.2.0 examples.one dataValue `a`",
    rationale:
      "cross-version representation change with identical meaning (decision §11.9): no diff beyond the version",
    annotation: "only the document version changes",
    sources: [{ tool: "asd", ref: "docs/DESIGN_PROPOSALS.md §7.2 / §7.3 value <-> dataValue" }],
    docs: {
      request: [
        doc("request", { examples: { one: { value: "a" } } }),
        doc("request", { examples: { one: { dataValue: "a" } } }, {}, "3.2.0"),
      ],
      response: [
        doc("response", { examples: { one: { value: "a" } } }),
        doc("response", { examples: { one: { dataValue: "a" } } }, {}, "3.2.0"),
      ],
    },
    expect: [{ at: "openapi", action: "replace", type: annotation, mentions: ["openapi"] }],
  },
  {
    kind: "doc",
    id: "OAS-EX-017",
    title: "schema-level `example` changed inside a body schema",
    before: "body schema string, example `a`",
    after: "example `b`",
    rationale: "the Schema Object `example` keyword is documentation only",
    annotation: "names the example and its location",
    sources: [
      { tool: "libopenapi", ref: "what-changed/model/breaking_rules.go Schema.Example" },
      { tool: "fork", ref: "test/human-readable/openapi/schema-object.test.ts example" },
    ],
    docs: both({ schema: { type: "string", example: "a" } }, { schema: { type: "string", example: "b" } }),
    expect: at("schema/example", ["example"]),
  },
]

runCases("openapi", "examples", cases, import.meta.filename)
