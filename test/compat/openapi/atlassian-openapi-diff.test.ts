// Cases derived from Atlassian openapi-diff 0.24.1 (npm dist: `dist/api-types.d.ts` DiffResultCode,
// `dist/openapi-diff/spec-differ/result-type-finder.js`, `docs/OPENAPI3.md`); the Bitbucket repository is not
// reachable, so the scenarios come from the code list and the supported-field table. Checklist:
// test/compat/coverage/atlassian-openapi-diff-change-kinds.json.

import { breaking, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const aod = (ref: string, verdict?: string) => ({
  tool: "atlassian-openapi-diff",
  ref,
  ...(verdict ? { verdict } : {}),
})

/** GET /a whose 200 response declares the given headers */
const hdrs = (headers: Record<string, unknown>) => ({
  openapi: "3.1.0",
  info,
  paths: { "/a": { get: { responses: { 200: { description: "ok", headers } } } } },
})
const H = "paths/~1a/get/responses/200/headers"

const form = (maxLength: number) => ({ type: "object", properties: { name: { ...str, maxLength } } })
const reqBody = (mediaType: string, schema: unknown) => ({
  openapi: "3.1.0",
  info,
  paths: { "/a": { post: { requestBody: { content: { [mediaType]: { schema } } }, responses: ok } } },
})
const resBody = (mediaType: string, schema: unknown) => ({
  openapi: "3.1.0",
  info,
  paths: { "/a": { get: { responses: { 200: { description: "ok", content: { [mediaType]: { schema } } } } } } },
})

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-AOD-001",
    area: "headers",
    title: "required response header added",
    before: "200 with header X-Rate",
    after: "200 with headers X-Rate and X-Id (required: true)",
    rationale:
      "the server promises a header it did not promise before: clients that ignore unknown headers are unaffected, clients that want it can rely on it",
    annotation: "names the added header and the status code",
    sources: [aod("dist/openapi-diff/spec-differ/result-type-finder.js response.required.header.add", "non-breaking")],
    covers: ["aod:response.required.header.add"],
    docs: [
      hdrs({ "X-Rate": { schema: { type: "integer" } } }),
      hdrs({ "X-Rate": { schema: { type: "integer" } }, "X-Id": { required: true, schema: str } }),
    ],
    expect: [{ at: `${H}/X-Id`, action: "add", type: nonBreaking, mentions: ["X-Id", "200"] }],
  },
  {
    kind: "doc",
    id: "OAS-AOD-002",
    area: "media-types",
    title: "body schema changed under a non-JSON media type",
    before: "request application/x-www-form-urlencoded name maxLength 10 / response text/plain maxLength 5",
    after: "request maxLength 5 / response maxLength 10",
    rationale:
      "the schema constrains the body whatever its media type: a tighter form field rejects callers (request), a looser text body can exceed what clients accept (response); openapi-diff only diffs application/json bodies and reports nothing",
    annotation: "names maxLength, the property (request) and the body media type",
    sources: [
      aod(
        "docs/OPENAPI3.md Request Body Object content (partial: yes for application/json, no for all other mime types)",
      ),
      aod("dist/openapi-diff/spec-differ/result-type-finder.js request.body.scope.remove / response.body.scope.add"),
    ],
    covers: ["aod:request.body.scope.remove", "aod:response.body.scope.add", "aod:doc:RequestBody.content"],
    docs: {
      request: [
        reqBody("application/x-www-form-urlencoded", form(10)),
        reqBody("application/x-www-form-urlencoded", form(5)),
      ],
      response: [resBody("text/plain", { ...str, maxLength: 5 }), resBody("text/plain", { ...str, maxLength: 10 })],
    },
    expect: {
      request: [
        {
          at: "paths/~1a/post/requestBody/content/application~1x-www-form-urlencoded/schema/properties/name/maxLength",
          action: "replace",
          type: breaking,
          mentions: ["maxLength", "name", "application/x-www-form-urlencoded"],
        },
      ],
      response: [
        {
          at: "paths/~1a/get/responses/200/content/text~1plain/schema/maxLength",
          action: "replace",
          type: breaking,
          mentions: ["maxLength", "text/plain", "200"],
        },
      ],
    },
  },
]

runCases("openapi", "atlassian-openapi-diff", cases, import.meta.filename)
