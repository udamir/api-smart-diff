import { breaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"
import { cases } from "./types.cases"

// oasdiff relaxes type changes under loosely typed media types (anything -> string is "compatible" for a request
// reader in XML / text); schema cases always use application/json, so these are doc cases (OpenAPI 3.1).

const info = { title: "compat", version: "1.0.0" }
const xml = (schema: unknown) => ({ content: { "application/xml": { schema } } })
const reqDoc = (schema: unknown) => ({
  openapi: "3.1.0",
  info,
  paths: { "/items": { post: { requestBody: xml(schema), responses: { 200: { description: "ok" } } } } },
})
const resDoc = (schema: unknown) => ({
  openapi: "3.1.0",
  info,
  paths: { "/items": { get: { responses: { 200: { description: "ok", ...xml(schema) } } } } },
})
const REQ = "paths/~1items/post/requestBody/content/application~1xml/schema"
const RES = "paths/~1items/get/responses/200/content/application~1xml/schema"
const ISSUE39 = "ASD convention (ISSUE-39): a replaced type is breaking in both directions, whatever the media type"
const oas = (ref: string) => ({ tool: "oasdiff", ref, verdict: "INFO" })
const obj = (type: string) => ({ type: "object", properties: { n: { type } } })

const docCases: CompatCase[] = [
  {
    kind: "doc",
    id: "JS-TYP-101",
    title: "XML request body type object -> string (loosely typed media type)",
    before: "application/xml request body: object",
    after: "application/xml request body: string",
    rationale: `oasdiff calls this compatible because any XML document is also a string; ${ISSUE39}`,
    annotation: "names the type change and the request body",
    sources: [oas("checker/check_request_property_type_changed_test.go TestRequestBodyTypeLooselyTypedCompatible")],
    covers: ["oasdiff:request-body-type-compatible"],
    docs: [reqDoc({ type: "object" }), reqDoc({ type: "string" })],
    expect: [
      { at: `${REQ}/type`, action: "replace", type: breaking, mentions: ["type", "Request Body", "application/xml"] },
    ],
  },
  {
    kind: "doc",
    id: "JS-TYP-102",
    title: "XML response body type string -> object (loosely typed media type)",
    before: "application/xml response: string",
    after: "application/xml response: object",
    rationale: `oasdiff calls this compatible for a reader that treats the body as text; ${ISSUE39}`,
    annotation: "names the type change and the response",
    sources: [oas("checker/check_response_property_type_changed_test.go TestResponseBodyTypeLooselyTypedCompatible")],
    covers: ["oasdiff:response-body-type-compatible"],
    docs: [resDoc({ type: "string" }), resDoc({ type: "object" })],
    expect: [
      { at: `${RES}/type`, action: "replace", type: breaking, mentions: ["type", "Response 200", "application/xml"] },
    ],
  },
  {
    kind: "doc",
    id: "JS-TYP-103",
    title: "XML request property type integer -> string",
    before: "application/xml request body { n: integer }",
    after: "application/xml request body { n: string }",
    rationale: `oasdiff calls this compatible (every integer is also text in XML); ${ISSUE39}`,
    annotation: "names the type change and the property",
    sources: [oas("checker/check_types.go isTypeContained (not strongly typed)")],
    covers: ["oasdiff:request-property-type-compatible"],
    docs: [reqDoc(obj("integer")), reqDoc(obj("string"))],
    expect: [{ at: `${REQ}/properties/n/type`, action: "replace", type: breaking, mentions: ["type", "`n`"] }],
  },
  {
    kind: "doc",
    id: "JS-TYP-104",
    title: "XML response property type string -> integer",
    before: "application/xml response { n: string }",
    after: "application/xml response { n: integer }",
    rationale: `oasdiff calls this compatible (a text reader still reads it); ${ISSUE39}`,
    annotation: "names the type change and the property",
    sources: [oas("checker/check_types.go isTypeContained (not strongly typed, response frame)")],
    covers: ["oasdiff:response-property-type-compatible"],
    docs: [resDoc(obj("string")), resDoc(obj("integer"))],
    expect: [{ at: `${RES}/properties/n/type`, action: "replace", type: breaking, mentions: ["type", "`n`"] }],
  },
]

runCases("jsonschema", "types", [...cases, ...docCases], import.meta.filename)
