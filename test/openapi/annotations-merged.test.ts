import { compareOpenApi } from "../../src"
import { ExampleResource } from "../helpers"

const metaKey = Symbol("diff")
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const s = { type: "string" }

describe("Block C8 — OpenAPI change descriptions", () => {
  it("C8.1 every diff outside components has a well-formed description", () => {
    const petstore = new ExampleResource("petstore.yaml")
    const after = petstore.clone()
    after.info.title = "changed"
    after.paths["/pet"].post.requestBody.required = false
    after.paths["/pet"].post.parameters = [
      { name: "dry-run", in: "query", required: true, schema: { type: "boolean" } },
    ]
    after.paths["/pet/{petId}"].get.responses["200"].content["application/json"].schema = { type: "string" }
    delete after.paths["/pet/findByStatus"]
    after.components.schemas.Pet.properties.nickname = { type: "string" }
    after.components.schemas.Pet.required.push("nickname")

    const { diffs } = compareOpenApi(petstore.clone(), after, { metaKey })
    const visible = diffs.filter((d) => d.path[0] !== "components")

    expect(visible.length).toBeGreaterThan(5)
    for (const d of visible) {
      expect(typeof d.description).toBe("string")
      expect(d.description).not.toBe("")
      expect(d.description).not.toContain("undefined")
      expect(d.description).not.toContain("{{")
    }
  })

  it("C8.2 schema changes are annotated with their location", () => {
    const mk = (schema: unknown) => ({
      openapi: "3.0.0",
      paths: {
        "/a": {
          post: {
            parameters: [{ name: "q", in: "query", schema }],
            requestBody: { content: { "application/json": { schema } } },
            responses: { 200: { description: "ok", content: { "application/json": { schema } } } },
          },
        },
      },
    })
    const { diffs } = compareOpenApi(mk(s), mk({ type: "string", maxLength: 3 }), { metaKey })
    const texts = diffs.map((d) => d.description).sort()

    expect(texts).toEqual([
      // POLICY-119 decided (changed, P8f): the added validator names its value
      "[Added] maxLength validator with value `3` in Request Body content (application/json)",
      "[Added] maxLength validator with value `3` in Response 200 content (application/json)",
      "[Added] maxLength validator with value `3` in query parameter `q`",
    ])
  })

  // ISSUE-22 (fixed): `parameterChangeAnnotation` passes `requred: false` (typo) so the `param_required` template still fires.
  it("C8.3 the required-status description does not repeat 'required'", () => {
    const mk = (required: boolean) => ({
      openapi: "3.0.0",
      paths: { "/a": { get: { parameters: [{ name: "q", in: "query", required, schema: s }] } } },
    })
    const { diffs } = compareOpenApi(mk(false), mk(true), { metaKey })
    expect(diffs[0].description).toBe("[Added] required status to query parameter `q`")
  })

  // ISSUE-09 (fixed): the second usage of a changed $ref gets a generic description from the cached result.
  it("C8.4 every usage of a changed component schema gets a specific description", () => {
    const mk = (type: string) => ({
      openapi: "3.0.0",
      paths: {
        "/a": {
          get: {
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: { $ref: "#/components/schemas/P" } } },
              },
            },
          },
        },
        "/b": {
          get: {
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: { $ref: "#/components/schemas/P" } } },
              },
            },
          },
        },
      },
      components: { schemas: { P: { type: "object", properties: { name: { type } } } } },
    })
    const { diffs } = compareOpenApi(mk("string"), mk("integer"), { metaKey })
    const texts = diffs.filter((d) => d.path[0] === "paths").map((d) => d.description)

    expect(texts).toEqual(
      Array(2).fill(
        "[Replaced] type definition of `name` from `string` to `integer` in Response 200 content (application/json)",
      ),
    )
  })

  // ISSUE-17 (fixed): header schema changes have no annotate rule (and `isResponseSchema` misreads the header path as content).
  it("C8.5 response header schema changes are described as header changes", () => {
    const mk = (type: string) => ({
      openapi: "3.0.0",
      paths: { "/a": { get: { responses: { 200: { description: "ok", headers: { "X-H": { schema: { type } } } } } } } },
    })
    const { diffs } = compareOpenApi(mk("string"), mk("integer"), { metaKey })
    expect(diffs[0].description).toMatch(/header `X-H`/)
  })

  // P8-OAS: descriptions name the entity, its container and the values (DESIGN_PROPOSALS §12.18 conventions)
  const texts = (before: unknown, after: unknown) =>
    compareOpenApi(before, after, { metaKey }).diffs.map((d) => d.description)
  const ok = { 200: { description: "ok" } }
  const doc = (get: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    openapi: "3.1.0",
    info: { title: "t", version: "1.0.0" },
    paths: { "/pets": { get: { ...get, responses: ok } } },
    ...extra,
  })

  it("C8.6 operation fields name the operation and their values (ISSUE-81)", () => {
    expect(
      texts(doc({ operationId: "a", tags: ["pets"] }), doc({ operationId: "b", tags: ["pets", "store"] })),
    ).toEqual([
      "[Replaced] annotation (operationId) of operation `GET /pets` from `a` to `b`",
      "[Added] tag `store` to operation `GET /pets`",
    ])
    expect(texts(doc({}), doc({ deprecated: true }))).toEqual(["[Added] deprecated status to operation `GET /pets`"])
    const hook = (cb?: unknown) => ({
      openapi: "3.1.0",
      info: { title: "t", version: "1.0.0" },
      paths: { "/s": { post: { responses: ok, ...(cb ? { callbacks: cb } : {}) } } },
    })
    const onEvent = { onEvent: { "{$url}": { put: { responses: ok } } } }
    expect(texts(hook(), hook(onEvent))).toEqual(["[Added] callbacks `onEvent` to operation `POST /s`"])
    expect(texts(hook(onEvent), hook({ onEvent: { "{$url}": {} } }))).toEqual([
      "[Removed] operation `PUT {$url}` of callback `onEvent`",
    ])
  })

  it("C8.7 security requirements are named by their schemes and owner (ISSUE-83)", () => {
    const sec = (global?: unknown[], operation?: unknown[]) =>
      doc(operation ? { security: operation } : {}, {
        ...(global ? { security: global } : {}),
        components: {
          securitySchemes: { k: { type: "apiKey", name: "k", in: "header" }, b: { type: "http", scheme: "bearer" } },
        },
      })
    expect(texts(sec(), sec([{ k: [] }]))).toEqual(["[Added] security requirements `k` to global security"])
    expect(texts(sec([{ k: [] }]), sec([{ k: [] }], []))).toEqual([
      "[Added] empty security requirement list (public access) to operation `GET /pets`, overriding the global security requirements `k`",
    ])
    expect(texts(sec([{ k: [] }], []), sec([{ k: [] }]))).toEqual([
      "[Removed] empty security requirement list (public access) from operation `GET /pets`, the global security requirements `k` apply",
    ])
    expect(texts(sec(undefined, [{ k: [] }]), sec(undefined, [{ k: [] }, {}]))).toEqual([
      "[Added] anonymous security requirement `{}` to operation `GET /pets`",
    ])
  })

  it("C8.8 media types, encodings and their headers name the part and the media type (ISSUE-85, ISSUE-86)", () => {
    const body = (content: Record<string, unknown>) => ({
      openapi: "3.1.0",
      info: { title: "t", version: "1.0.0" },
      paths: { "/a": { post: { requestBody: { content }, responses: ok } } },
    })
    const json = { "application/json": { schema: s } }
    expect(texts(body(json), body({ ...json, "application/xml": { schema: s } }))).toEqual([
      "[Added] media type `application/xml` to Request Body",
    ])
    const form = (headers?: unknown) => ({
      "multipart/form-data": {
        schema: s,
        encoding: { file: { contentType: "image/png", ...(headers ? { headers } : {}) } },
      },
    })
    expect(texts(body(form({ "X-Id": { schema: s } })), body(form({ "X-Id": { schema: s, required: true } })))).toEqual(
      ["[Added] required status to header `X-Id` of encoding `file` in Request Body content (multipart/form-data)"],
    )
  })

  it("C8.9 document fields, servers and parameter keywords carry their values (ISSUE-82, ISSUE-84)", () => {
    const root = (o: Record<string, unknown>) => ({ ...doc({}), ...o })
    expect(texts(root({ openapi: "3.1.0" }), root({ openapi: "3.2.0" }))).toEqual([
      "[Replaced] OpenAPI version from `3.1.0` to `3.2.0`",
    ])
    expect(texts(root({}), root({ servers: [{ url: "https://a.example.com" }] }))).toEqual([
      "[Added] servers `https://a.example.com`",
    ])
    expect(
      texts(
        root({ servers: [{ url: "https://a.example.com" }] }),
        root({ servers: [{ url: "https://b.example.com" }] }),
      ),
    ).toEqual(["[Replaced] server URL from `https://a.example.com` to `https://b.example.com`"])
    const param = (style: string) =>
      doc({ parameters: [{ name: "tags", in: "query", style, schema: { type: "array" } }] })
    expect(texts(param("form"), param("pipeDelimited"))).toEqual([
      "[Replaced] `style` of query parameter `tags` from `form` to `pipeDelimited`",
    ])
  })

  // POLICY-95 decided (c): free text is listed with its values, shortened to about 60 characters and on one line
  it("C8.10 free-text fields list their values shortened (POLICY-95)", () => {
    const long = "Returns every pet of the store, including the ones that were adopted.\nPaged by `limit`."
    expect(
      texts(
        doc({ summary: "List pets", description: "Lists pets." }),
        doc({ summary: "List all pets", description: long }),
      ),
    ).toEqual([
      "[Replaced] annotation (summary) of operation `GET /pets` from `List pets` to `List all pets`",
      "[Replaced] annotation (description) of operation `GET /pets` from `Lists pets.` to `Returns every pet of the store, including the ones that…`",
    ])
    const param = (description: string) => doc({ parameters: [{ name: "q", in: "query", description, schema: s }] })
    expect(texts(param("Search text"), param("Full-text search"))).toEqual([
      "[Replaced] annotation (description) of query parameter `q` from `Search text` to `Full-text search`",
    ])
    // identifiers and URLs stay complete
    const url = `https://docs.example.com/${"very-long-segment/".repeat(4)}pets`
    expect(texts(doc({ operationId: "a" }), doc({ operationId: "b".repeat(70) }))).toEqual([
      `[Replaced] annotation (operationId) of operation \`GET /pets\` from \`a\` to \`${"b".repeat(70)}\``,
    ])
    expect(texts(doc({}, { externalDocs: { url: "https://a" } }), doc({}, { externalDocs: { url } }))).toEqual([
      `[Replaced] document metadata (externalDocs.url) from \`https://a\` to \`${url}\``,
    ])
  })

  // ISSUE-300 (fixed): the property path was read from the whole `diff.path`, so a container key equal to a schema
  // keyword outside the schema (a response header or a schema component named `items` or `properties`) was read as one
  // (`[].id`, `properties`); the schema root is now known from the rules (`kind: "schema"`)
  it("C8.11 a container named like a schema keyword does not change the property path (ISSUE-300)", () => {
    const doc = (type: string, name: string) => ({
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {
        "/a": {
          get: {
            responses: {
              200: {
                description: "ok",
                headers: { items: { schema: { type: "object", properties: { id: { type } } } } },
                content: { "application/json": { schema: { $ref: `#/components/schemas/${name}` } } },
              },
            },
          },
        },
      },
      components: { schemas: { [name]: { type: "object", properties: { id: { type } } } } },
    })
    for (const name of ["items", "properties"]) {
      const texts = compareOpenApi(doc("string", name), doc("integer", name)).diffs.map((d) => d.description)
      for (const text of texts) {
        expect(text).toContain("type definition of `id` from `string` to `integer`")
      }
    }
  })

  // ISSUE-300 (fixed): keyword-like names as header, parameter, property and component names, and as the names of the
  // containers above a schema (a parameter component named `headers` was "in header `schema`")
  it("C8.12 keyword-like names of headers, parameters, properties and components (ISSUE-300)", () => {
    const names = [
      "items",
      "properties",
      "patternProperties",
      "additionalProperties",
      "allOf",
      "enum",
      "type",
      "if",
      "then",
      "not",
      "schema",
      "content",
      "headers",
      "requestBody",
      "responses",
    ]
    const object = (type: string) => ({ type: "object", properties: { id: { type } } })
    const doc = (type: string, name: string) => ({
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {
        "/a": {
          get: {
            parameters: [
              { name, in: "query", schema: { type: "object", properties: { [name]: object(type) } } },
              { $ref: `#/components/parameters/${name}` },
            ],
            responses: {
              200: {
                description: "ok",
                headers: { [name]: { schema: object(type) } },
                content: { "application/json": { schema: { $ref: `#/components/schemas/${name}` } } },
              },
            },
          },
        },
      },
      components: {
        schemas: { [name]: { type: "object", properties: { id: { type, "x-k": type } } } },
        headers: { [name]: { schema: object(type) } },
        parameters: { [name]: { name: "p", in: "header", schema: object(type) } },
      },
    })
    for (const name of names) {
      const texts = compareOpenApi(doc("string", name), doc("integer", name)).diffs.map((d) => d.description)
      const change = "[Replaced] type definition of `id` from `string` to `integer`"
      expect(texts).toEqual([
        `[Replaced] type definition of \`${name}.id\` from \`string\` to \`integer\` in query parameter \`${name}\``,
        `${change} in header parameter \`p\``,
        `${change} in Response 200 header \`${name}\``,
        `${change} in Response 200 content (application/json)`,
        `${change} in schema component \`${name}\``,
        `[Replaced] extension \`x-k\` of \`id\` in schema component \`${name}\``,
        `${change} in header \`${name}\``,
        `${change} in header parameter \`p\``,
      ])
    }
  })
})

describe("Block C8 — 3.2 media type components (ISSUE-311)", () => {
  // ISSUE-311 (fixed) (P8e): the fields of a `components.mediaTypes` entry were described as a Request Body
  // ("[Added] media type `M` to Request Body", "media type `example` of Request Body")
  it("C8.13 a media type component and its fields are named as the component", () => {
    const doc = (media: Record<string, unknown>) => ({
      openapi: "3.2.0",
      info: { title: "t", version: "1" },
      paths: {},
      components: { mediaTypes: media },
    })
    const texts = (before: unknown, after: unknown) => compareOpenApi(before, after).diffs.map((d) => d.description)
    expect(texts(doc({}), doc({ M: { schema: s } }))).toEqual(["[Added] media type component `M`"])
    const m = (v: number) => ({
      M: {
        schema: { type: v ? "integer" : "string" },
        example: v,
        encoding: {
          p: { contentType: v ? "a/c" : "a/b", headers: { H: { schema: { type: v ? "integer" : "string" } } } },
        },
      },
    })
    expect(texts(doc(m(0)), doc(m(1)))).toEqual([
      "[Replaced] type definition from `string` to `integer` in media type component `M`",
      "[Replaced] `example` of media type component `M` from `0` to `1`",
      "[Replaced] `contentType` of encoding `p` in media type component `M` from `a/b` to `a/c`",
      "[Replaced] type definition from `string` to `integer` in header `H` of encoding `p` in media type component `M`",
    ])
  })
})

// POLICY-119 decided (changed, P8f): validator changes list their values like other scalar keywords, at every location
describe("Block C8 — validator values (POLICY-119)", () => {
  it("C8.14 validators of parameters, headers, bodies and components list their values", () => {
    const str = (v: number) => ({ type: "string", maxLength: v ? 30 : 50, ...(v ? {} : { pattern: "^a" }) })
    const doc = (v: number) => ({
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {
        "/a": {
          post: {
            parameters: [{ name: "q", in: "query", schema: { type: "integer", minimum: v ? 1 : 0 } }],
            requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } } },
            responses: {
              200: { description: "ok", headers: { "X-Rate": { schema: { type: "integer", maximum: v ? 10 : 100 } } } },
            },
          },
        },
      },
      components: { schemas: { Pet: { type: "object", properties: { name: str(v) } } } },
    })
    expect(
      compareOpenApi(doc(0), doc(1))
        .diffs.map((d) => d.description)
        .sort(),
    ).toEqual([
      "[Removed] pattern validator with value `^a` from `name` in Request Body content (application/json)",
      "[Removed] pattern validator with value `^a` from `name` in schema component `Pet`",
      "[Replaced] maxLength validator of `name` from `50` to `30` in Request Body content (application/json)",
      "[Replaced] maxLength validator of `name` from `50` to `30` in schema component `Pet`",
      "[Replaced] maximum validator from `100` to `10` in Response 200 header `X-Rate`",
      "[Replaced] minimum validator from `0` to `1` in query parameter `q`",
    ])
  })
})

describe("Block C9 — merged OpenAPI document", () => {
  // ISSUE-20 (fixed): normalizations applied for comparison (path-level parameters merged into operations, `required: false`
  // dropped, draft-04 `exclusiveMaximum: true` rewritten to a number, `tags: []` injected) are returned as the merged
  // document, so an unchanged document comes back in a different shape — one that is not even valid OpenAPI 3.0.
  it("C9.1 merged equals the input for an unchanged document", () => {
    const d = {
      openapi: "3.0.0",
      paths: {
        "/p/{id}": {
          parameters: [{ name: "id", in: "path", required: true, schema: s }],
          get: {
            parameters: [
              {
                name: "q",
                in: "query",
                required: false,
                schema: { type: "number", maximum: 10, exclusiveMaximum: true },
              },
            ],
            responses: { 200: { description: "ok" } },
          },
        },
      },
    }
    const original = clone(d)
    const { diffs, merged } = compareOpenApi(d, clone(d), { metaKey })

    expect(diffs).toEqual([])
    // compare against a snapshot: ISSUE-03 would otherwise make the (mutated) input equal to the merged output
    expect(merged).toEqual(original)
  })

  it("C9.2 merged keeps removed operations and marks them in meta", () => {
    const before = {
      openapi: "3.0.0",
      paths: {
        "/a": {
          get: { responses: { 200: { description: "ok" } } },
          post: { responses: { 200: { description: "ok" } } },
        },
      },
    }
    const after = { openapi: "3.0.0", paths: { "/a": { get: { responses: { 200: { description: "ok" } } } } } }
    const { merged } = compareOpenApi(before, after, { metaKey })

    expect(merged.paths["/a"].post).toBeDefined()
    expect(merged.paths["/a"][metaKey]).toEqual({ post: { action: "remove", type: "breaking" } })
  })

  it("C9.3 merged resolves nothing it does not need to: inline schemas stay inline", () => {
    const d = {
      openapi: "3.0.0",
      paths: {
        "/a": { get: { responses: { 200: { description: "ok", content: { "application/json": { schema: s } } } } } },
      },
    }
    const { merged } = compareOpenApi(d, clone(d), { metaKey })
    expect(merged.paths["/a"].get.responses[200].content["application/json"].schema).toEqual(s)
  })

  // DESIGN_PROPOSALS §11.1: an unchanged `$ref` keeps its original form; targets are inlined only where they carry
  // changes (the meta of a per-usage diff needs the resolved subtree)
  it("C9.4 merged keeps an unchanged $ref and inlines a changed target at the usage site", () => {
    const d = {
      openapi: "3.0.0",
      paths: {
        "/a": {
          get: {
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: { $ref: "#/components/schemas/P" } } },
              },
            },
          },
        },
      },
      components: { schemas: { P: s } },
    }
    const { merged } = compareOpenApi(d, clone(d), { metaKey })
    expect(merged.paths["/a"].get.responses[200].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/P",
    })

    const changed = clone(d)
    changed.components.schemas.P = { type: "number" }
    const result = compareOpenApi(d, changed, { metaKey })
    expect(result.merged.paths["/a"].get.responses[200].content["application/json"].schema).toMatchObject({
      type: "number",
    })
  })
})
