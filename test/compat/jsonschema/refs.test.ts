import { breaking, nonBreaking } from "../../../src"
import { type CompatCase, risky, runCases } from "../../helpers/compat"
import { cases } from "./refs.cases"

// Changes inside a component need different components on the two sides, which schema cases cannot express: these
// are doc cases (OpenAPI 3.1), kept here so that refs.cases.ts stays reusable for the AsyncAPI payload placements.

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema: unknown) => ({ content: { "application/json": { schema } } })
const doc = (paths: Record<string, unknown>, schemas: Record<string, unknown>) => ({
  openapi: "3.1.0",
  info,
  paths,
  components: { schemas },
})
const post = (schema: unknown) => ({ "/items": { post: { requestBody: json(schema), responses: ok } } })
const both = (schema: unknown) => ({
  "/items": {
    post: { requestBody: json(schema), responses: ok },
    get: { responses: { 200: { description: "ok", ...json(schema) } } },
  },
})
const node = (maxLength: number) => ({
  type: "object",
  properties: { name: { type: "string", maxLength }, next: ref("Node") },
})
const REQ = "paths/~1items/post/requestBody/content/application~1json/schema"
const RES = "paths/~1items/get/responses/200/content/application~1json/schema"

const docCases: CompatCase[] = [
  {
    kind: "doc",
    id: "JS-REF-101",
    title: "change inside a component referenced from a request body",
    before: "components.Name: string, maxLength 10; request body $ref Name",
    after: "components.Name: string, maxLength 5",
    rationale:
      "the request schema narrows through the reference: breaking at the usage and, usage-derived (decision §11.4), at the component",
    annotation: "names the keyword (maxLength) at the usage and at the component",
    sources: [
      {
        tool: "fork",
        ref: "test/compatibility-suites/schemas/schema-test-runner-openapi-only.ts (Reference Sibling Properties)",
      },
      { tool: "oasdiff", ref: "checker/shared_schema_test.go" },
    ],
    covers: ["oasdiff:request-body-max-length-decreased"],
    docs: [
      doc(post(ref("Name")), { Name: { type: "string", maxLength: 10 } }),
      doc(post(ref("Name")), { Name: { type: "string", maxLength: 5 } }),
    ],
    expect: [
      { at: `${REQ}/maxLength`, action: "replace", type: breaking, mentions: ["maxLength", "Request Body"] },
      { at: "components/schemas/Name/maxLength", action: "replace", type: breaking, mentions: ["maxLength", "Name"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "JS-REF-102",
    title: "change inside a component referenced from a request and a response",
    before: "components.Name: maxLength 10, used by POST body and GET 200",
    after: "components.Name: maxLength 5",
    rationale:
      "breaking for the request usage, non-breaking for the response usage; the component is breaking because it is breaking in one of its usages (decision §11.4)",
    annotation: "names the keyword (maxLength) at each usage and at the component",
    sources: [{ tool: "fork", ref: "test/cycled-objects.test.ts (scopes request / response / components)" }],
    covers: ["oasdiff:request-body-max-length-decreased"],
    docs: [
      doc(both(ref("Name")), { Name: { type: "string", maxLength: 10 } }),
      doc(both(ref("Name")), { Name: { type: "string", maxLength: 5 } }),
    ],
    expect: [
      { at: `${REQ}/maxLength`, action: "replace", type: breaking, mentions: ["maxLength", "Request Body"] },
      { at: `${RES}/maxLength`, action: "replace", type: nonBreaking, mentions: ["maxLength", "Response 200"] },
      { at: "components/schemas/Name/maxLength", action: "replace", type: breaking, mentions: ["maxLength", "Name"] },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "JS-REF-103",
    title: "change inside a recursive component",
    before: "components.Node { name: maxLength 10, next: $ref Node }",
    after: "components.Node { name: maxLength 5, next: $ref Node }",
    rationale: "the cycle is compared once; the request usage narrows (breaking)",
    annotation: "names the keyword and the property name at the usage and at the component",
    sources: [
      { tool: "fork", ref: "test/cycled-objects.test.ts should handle cycled objects" },
      { tool: "oasdiff", ref: "diff/schema_diff_unroll_test.go (cycle expanded once)" },
    ],
    covers: ["oasdiff:request-property-max-length-decreased"],
    docs: [doc(post(ref("Node")), { Node: node(10) }), doc(post(ref("Node")), { Node: node(5) })],
    expect: [
      {
        at: [`${REQ}/properties/name/maxLength`, `${REQ}/**/properties/name/maxLength`],
        action: "replace",
        type: breaking,
        mentions: ["maxLength", "name"],
      },
      {
        at: [
          "components/schemas/Node/properties/name/maxLength",
          "components/schemas/Node/**/properties/name/maxLength",
        ],
        action: "replace",
        type: breaking,
        mentions: ["maxLength", "name"],
      },
    ],
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "JS-REF-104",
    title: "referenced enum widened while the usage has a sibling description",
    before: "components.Color enum [red]; response $ref Color + description",
    after: "components.Color enum [red, green]",
    rationale:
      "the response gains an unknown value (POLICY-05: risky, as the fork), the sibling does not hide the change",
    annotation: "names the added value (green)",
    sources: [
      {
        tool: "fork",
        ref: "test/compatibility-suites/schemas/schema-test-runner-openapi-only.ts change-referenced-enum-when-sibling-exists-for-ref",
      },
    ],
    covers: ["oasdiff:response-mediatype-enum-value-added"],
    docs: [
      doc(
        {
          "/items": {
            get: { responses: { 200: { description: "ok", ...json({ ...ref("Color"), description: "c" }) } } },
          },
        },
        { Color: { type: "string", enum: ["red"] } },
      ),
      doc(
        {
          "/items": {
            get: { responses: { 200: { description: "ok", ...json({ ...ref("Color"), description: "c" }) } } },
          },
        },
        { Color: { type: "string", enum: ["red", "green"] } },
      ),
    ],
    expect: [
      { at: [`${RES}/enum/*`, "components/schemas/Color/enum/*"], action: "add", type: risky, mentions: ["green"] },
    ],
    // ISSUE-130 (fixed): POLICY-05 decided (b); the enum value description is ISSUE-57
    // ISSUE-57 (fixed) (P8a)
  },
]

runCases("jsonschema", "refs", [...cases, ...docCases], import.meta.filename)
