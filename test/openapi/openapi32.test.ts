import { annotation, breaking, compareOpenApi, deprecated, nonBreaking, risky, unclassified } from "../../src"
import { openApiProfile } from "../../src/openapi"

// Block G — OpenAPI 3.2 profile (DESIGN_PROPOSALS §7) and cross-version comparison (§7.3).
// Expectations follow the OpenAPI 3.2.0 specification semantics.

const metaKey = Symbol("diff")
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const s = { type: "string" }
const ok = { 200: { description: "ok" } }

const doc32 = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  openapi: "3.2.0",
  paths,
  ...extra,
})
const diffsOf = (before: unknown, after: unknown) => compareOpenApi(before, after, { metaKey }).diffs

describe("Block G — OpenAPI 3.2 profile", () => {
  it("G1 the profile enables 3.2 constructs only for 3.2 documents", () => {
    expect(openApiProfile("3.0")).toMatchObject({
      schemaDraft: "draft-04",
      webhooks: false,
      additionalOperations: false,
    })
    expect(openApiProfile("3.1")).toMatchObject({ schemaDraft: "2020-12", webhooks: true, componentsMediaTypes: false })
    expect(openApiProfile("3.2")).toMatchObject({
      schemaDraft: "2020-12",
      additionalOperations: true,
      componentsMediaTypes: true,
      mediaTypeStreaming: true,
      oauthDeviceFlow: true,
      self: true,
    })
    expect(openApiProfile("3.2").methods).toContain("query")
    expect(openApiProfile("3.2").parameterLocations).toContain("querystring")
  })

  it("G2 the query method is an operation: add non-breaking, remove breaking, path-level parameters attributed", () => {
    const before = doc32({ "/search": { get: { responses: ok } } })
    const after = doc32({ "/search": { get: { responses: ok }, query: { responses: ok } } })
    expect(diffsOf(before, after)).toMatchObject([
      { path: ["paths", "/search", "query"], action: "add", type: nonBreaking },
    ])
    expect(diffsOf(after, before)).toMatchObject([
      { path: ["paths", "/search", "query"], action: "remove", type: breaking },
    ])

    const withParam = doc32({
      "/search": { parameters: [{ name: "q", in: "query", required: true, schema: s }], query: { responses: ok } },
    })
    const { diffs } = compareOpenApi(after, withParam, { metaKey })
    expect(diffs).toMatchObject([
      { path: ["paths", "/search", "get"], action: "remove", type: breaking },
      { path: ["paths", "/search", "query", "parameters", 0], action: "add", type: breaking },
    ])
  })

  it("G3 additionalOperations are operations keyed by method; QUERY maps onto the query method", () => {
    const custom = doc32({ "/a": { additionalOperations: { PURGE: { responses: ok } } } })
    const changed = doc32({
      "/a": { additionalOperations: { PURGE: { responses: { 200: { description: "purged" } } } } },
    })
    expect(diffsOf(custom, changed)).toMatchObject([
      { path: ["paths", "/a", "additionalOperations", "PURGE", "responses", "200", "description"], type: annotation },
    ])
    expect(diffsOf(custom, doc32({ "/a": {} }))).toMatchObject([
      { path: ["paths", "/a", "additionalOperations", "PURGE"], action: "remove", type: breaking },
    ])

    const asQuery = doc32({ "/a": { query: { responses: ok } } })
    const asAdditional = doc32({ "/a": { additionalOperations: { QUERY: { responses: ok } } } })
    expect(diffsOf(asQuery, asAdditional)).toEqual([])
  })

  it("G4 a querystring parameter is a request body-like input compared by its content schema", () => {
    const qs = (type: string) =>
      doc32({
        "/a": {
          get: {
            parameters: [{ name: "filter", in: "querystring", content: { "application/json": { schema: { type } } } }],
            responses: ok,
          },
        },
      })
    const diffs = diffsOf(qs("string"), qs("integer"))
    expect(diffs).toMatchObject([{ type: breaking, scope: "request" }])
    expect(diffs[0].path).toEqual([
      "paths",
      "/a",
      "get",
      "parameters",
      0,
      "content",
      "application/json",
      "schema",
      "type",
    ])
    expect(diffs[0].description).toContain("querystring parameter `filter`")

    const added = diffsOf(doc32({ "/a": { get: { parameters: [], responses: ok } } }), qs("string"))
    expect(added).toMatchObject([{ action: "add", type: nonBreaking }])
  })

  it("G5 tag parent, kind and summary are annotations and tags are matched by name", () => {
    const before = doc32({}, { tags: [{ name: "pets" }, { name: "store" }] })
    const after = doc32(
      {},
      { tags: [{ name: "store" }, { name: "pets", parent: "store", kind: "nav", summary: "Pets" }] },
    )
    const diffs = diffsOf(before, after)
    expect(diffs).toHaveLength(3)
    expect(diffs.every((d) => d.type === annotation && d.path[0] === "tags")).toBe(true)
  })

  it("G6 servers are matched by name when present (else by url); the name itself is an annotation", () => {
    const before = doc32(
      {},
      {
        servers: [
          { name: "prod", url: "https://a" },
          { name: "dev", url: "https://d" },
        ],
      },
    )
    const after = doc32(
      {},
      {
        servers: [
          { name: "dev", url: "https://d" },
          { name: "prod", url: "https://b" },
        ],
      },
    )
    expect(diffsOf(before, after)).toMatchObject([{ path: ["servers", 0, "url"], type: annotation }])
    expect(
      diffsOf(
        doc32({}, { servers: [{ url: "https://a" }] }),
        doc32({}, { servers: [{ url: "https://a", name: "n" }] }),
      ),
    ).toMatchObject([{ path: ["servers", 0, "name"], type: annotation }])
  })

  it("G7 streaming media types: itemSchema uses the enclosing scope, itemEncoding and prefixEncoding are classified", () => {
    const stream = (type: string, extra: Record<string, unknown> = {}) =>
      doc32({
        "/events": {
          get: {
            responses: {
              200: {
                description: "ok",
                content: {
                  "application/jsonl": { itemSchema: { type: "object", properties: { v: { type } } }, ...extra },
                },
              },
            },
          },
        },
      })
    expect(diffsOf(stream("string"), stream("integer"))).toMatchObject([
      {
        path: [
          "paths",
          "/events",
          "get",
          "responses",
          "200",
          "content",
          "application/jsonl",
          "itemSchema",
          "properties",
          "v",
          "type",
        ],
        type: breaking,
        scope: "response",
      },
    ])
    const request = (type: string) =>
      doc32({
        "/events": {
          post: { requestBody: { content: { "application/jsonl": { itemSchema: { type } } } }, responses: ok },
        },
      })
    expect(diffsOf(request("string"), request("integer"))).toMatchObject([{ type: breaking, scope: "request" }])

    const encoded = diffsOf(stream("string"), stream("string", { itemEncoding: { contentType: "text/plain" } }))
    expect(encoded).toMatchObject([{ path: expect.arrayContaining(["itemEncoding"]), type: breaking }])
    const prefixed = diffsOf(stream("string"), stream("string", { prefixEncoding: [{ contentType: "text/plain" }] }))
    expect(prefixed).toMatchObject([{ type: breaking }])
    expect(prefixed.every((d) => d.type !== unclassified)).toBe(true)
  })

  it("G8 example dataValue and serializedValue are annotations; value -> dataValue is a representation change", () => {
    const ex = (example: Record<string, unknown>) =>
      doc32({
        "/a": {
          get: {
            responses: {
              200: { description: "ok", content: { "application/json": { schema: s, examples: { one: example } } } },
            },
          },
        },
      })
    expect(diffsOf(ex({ dataValue: "a" }), ex({ dataValue: "b" }))).toMatchObject([{ type: annotation }])
    expect(diffsOf(ex({ dataValue: "a" }), ex({ dataValue: "a", serializedValue: '"a"' }))).toMatchObject([
      { type: annotation },
    ])
    expect(diffsOf(ex({ value: "a" }), ex({ dataValue: "a" }))).toEqual([])
  })

  it("G9 discriminator.defaultMapping: removing or changing it is breaking in a request, non-breaking in a response", () => {
    const schema = (defaultMapping?: string) => ({
      oneOf: [{ $ref: "#/components/schemas/A" }, { $ref: "#/components/schemas/B" }],
      discriminator: { propertyName: "kind", ...(defaultMapping ? { defaultMapping } : {}) },
    })
    const components = {
      schemas: { A: { type: "object", properties: { kind: s } }, B: { type: "object", properties: { kind: s } } },
    }
    const request = (dm?: string) =>
      doc32(
        { "/a": { post: { requestBody: { content: { "application/json": { schema: schema(dm) } } }, responses: ok } } },
        { components },
      )
    const response = (dm?: string) =>
      doc32(
        {
          "/a": {
            get: { responses: { 200: { description: "ok", content: { "application/json": { schema: schema(dm) } } } } },
          },
        },
        { components },
      )
    const requestDiffs = diffsOf(request("#/components/schemas/A"), request())
    expect(requestDiffs.filter((d) => d.path[0] === "paths")).toMatchObject([{ action: "remove", type: breaking }])
    const responseDiffs = diffsOf(response("#/components/schemas/A"), response())
    expect(responseDiffs.filter((d) => d.path[0] === "paths")).toMatchObject([{ action: "remove", type: nonBreaking }])
    expect(diffsOf(request(), request("#/components/schemas/A")).filter((d) => d.path[0] === "paths")).toMatchObject([
      { action: "add", type: nonBreaking },
    ])
  })

  // POLICY-27 decided (c), ISSUE-147 (fixed): `xml` is documentation under JSON (annotation) and the wire format under
  // an XML media type (breaking)
  it("G10 xml.nodeType is an annotation and equivalent to attribute / wrapped", () => {
    const xml = (xml: Record<string, unknown>, mediaType = "application/xml") =>
      doc32({
        "/a": {
          get: {
            responses: {
              200: { description: "ok", content: { [mediaType]: { schema: { type: "string", xml } } } },
            },
          },
        },
      })
    expect(
      diffsOf(xml({ nodeType: "element" }, "application/json"), xml({ nodeType: "attribute" }, "application/json")),
    ).toMatchObject([{ type: annotation }])
    expect(diffsOf(xml({ nodeType: "element" }), xml({ nodeType: "attribute" }))).toMatchObject([{ type: breaking }])
    expect(diffsOf(xml({ attribute: true }), xml({ nodeType: "attribute" }))).toEqual([])
    expect(diffsOf(xml({ wrapped: true }), xml({ nodeType: "element" }))).toEqual([])
  })

  it("G11 security: deviceAuthorization flow, oauth2MetadataUrl and scheme deprecation are classified", () => {
    // referenced by the global requirement (POLICY-11 decided (a): an unreferenced scheme is unclassified)
    const sec = (scheme: Record<string, unknown>) =>
      doc32({}, { security: [{ o: [] }], components: { securitySchemes: { o: scheme } } })
    const device = (url: string) => ({
      type: "oauth2",
      flows: { deviceAuthorization: { deviceAuthorizationUrl: url, tokenUrl: "https://t", scopes: { read: "r" } } },
    })
    // POLICY-05 decided (b), decision §11.14 (ISSUE-130 fixed): a changed OAuth endpoint URL is risky (was breaking)
    expect(diffsOf(sec(device("https://d1")), sec(device("https://d2")))).toMatchObject([{ type: risky }])
    // ISSUE-64 (fixed): a metadata URL added is one more way to discover the endpoints (non-breaking)
    expect(
      diffsOf(sec(device("https://d1")), sec({ ...device("https://d1"), oauth2MetadataUrl: "https://m" })),
    ).toMatchObject([{ type: nonBreaking }])
    expect(diffsOf(sec(device("https://d1")), sec({ ...device("https://d1"), deprecated: true }))).toMatchObject([
      { type: deprecated },
    ])
  })

  it("G12 response summary is an annotation", () => {
    const before = doc32({ "/a": { get: { responses: { 200: { description: "ok" } } } } })
    const after = doc32({ "/a": { get: { responses: { 200: { description: "ok", summary: "fine" } } } } })
    expect(diffsOf(before, after)).toMatchObject([
      { path: ["paths", "/a", "get", "responses", "200", "summary"], type: annotation },
    ])
  })

  it("G13 components.mediaTypes are $ref-able from content and compared in the usage scope", () => {
    const mk = (type: string) =>
      doc32(
        {
          "/a": {
            get: {
              responses: {
                200: { description: "ok", content: { "application/json": { $ref: "#/components/mediaTypes/Json" } } },
              },
            },
          },
        },
        { components: { mediaTypes: { Json: { schema: { type } } } } },
      )
    const diffs = diffsOf(mk("string"), mk("integer")).filter((d) => d.path[0] === "paths")
    expect(diffs).toMatchObject([
      {
        path: ["paths", "/a", "get", "responses", "200", "content", "application/json", "schema", "type"],
        type: breaking,
        scope: "response",
      },
    ])
  })

  it("G14 $self is an annotation and the base URI of relative external references", () => {
    expect(
      diffsOf(doc32({}, { $self: "https://e.com/a.yaml" }), doc32({}, { $self: "https://e.com/b.yaml" })),
    ).toMatchObject([{ path: ["$self"], type: annotation }])
    const mk = (type: string) =>
      doc32(
        {
          "/a": {
            get: {
              responses: {
                200: { description: "ok", content: { "application/json": { schema: { $ref: "common.yaml#/X" } } } },
              },
            },
          },
        },
        { $self: "https://e.com/api/root.yaml" },
      )
    const external = (type: string) => ({ "https://e.com/api/common.yaml": { X: { type } } })
    const { diffs } = compareOpenApi(mk("string"), mk("string"), {
      metaKey,
      externalSources: { before: external("string"), after: external("integer") },
    })
    expect(diffs).toMatchObject([
      {
        path: ["paths", "/a", "get", "responses", "200", "content", "application/json", "schema", "type"],
        type: breaking,
      },
    ])
  })

  it("G15 3.1 constructs: webhooks and components.pathItems are compared, 3.1 schema keywords use 2020-12 rules", () => {
    const wh = (desc: string) => ({
      openapi: "3.1.0",
      webhooks: { newPet: { post: { responses: { 200: { description: desc } } } } },
    })
    expect(diffsOf(wh("one"), wh("two"))).toMatchObject([
      { path: ["webhooks", "newPet", "post", "responses", "200", "description"], type: annotation },
    ])
    const d31 = (max: number) => ({
      openapi: "3.1.0",
      paths: {
        "/a": {
          post: {
            requestBody: { content: { "application/json": { schema: { type: "number", exclusiveMaximum: max } } } },
            responses: ok,
          },
        },
      },
    })
    expect(diffsOf(d31(5), d31(10))).toMatchObject([{ type: nonBreaking }])
  })
})

describe("Block G — cross-version comparison (3.0 <-> 3.1 <-> 3.2)", () => {
  it("G16 the higher version's profile is used and the version bump is an annotation", () => {
    const before = { openapi: "3.0.3", paths: { "/a": { get: { responses: ok } } } }
    const after = {
      openapi: "3.1.0",
      paths: { "/a": { get: { responses: ok } } },
      webhooks: { w: { post: { responses: ok } } },
    }
    const diffs = diffsOf(before, after)
    // ISSUE-68 / ISSUE-160 (fixed): a `webhooks` section added is reported per webhook
    expect(diffs).toMatchObject([
      { path: ["openapi"], type: annotation },
      { path: ["webhooks", "w"], action: "add", type: nonBreaking },
    ])
  })

  it("G17 nullable (3.0) and a type array with null (3.1) are the same schema", () => {
    const d30 = {
      openapi: "3.0.0",
      paths: {
        "/a": {
          post: {
            requestBody: { content: { "application/json": { schema: { type: "string", nullable: true } } } },
            responses: ok,
          },
        },
      },
    }
    const d31 = {
      openapi: "3.1.0",
      paths: {
        "/a": {
          post: {
            requestBody: { content: { "application/json": { schema: { type: ["string", "null"] } } } },
            responses: ok,
          },
        },
      },
    }
    expect(diffsOf(d30, d31)).toMatchObject([{ path: ["openapi"], type: annotation }])
    expect(diffsOf(d31, d30)).toMatchObject([{ path: ["openapi"], type: annotation }])
  })

  it("G18 boolean exclusive bounds (3.0) and numeric bounds (3.1) are the same constraint", () => {
    const d30 = {
      openapi: "3.0.0",
      paths: {
        "/a": {
          post: {
            requestBody: {
              content: { "application/json": { schema: { type: "number", maximum: 10, exclusiveMaximum: true } } },
            },
            responses: ok,
          },
        },
      },
    }
    const d31 = {
      openapi: "3.1.0",
      paths: {
        "/a": {
          post: {
            requestBody: { content: { "application/json": { schema: { type: "number", exclusiveMaximum: 10 } } } },
            responses: ok,
          },
        },
      },
    }
    expect(diffsOf(d30, d31)).toMatchObject([{ path: ["openapi"], type: annotation }])
    const d31tighter = clone(d31)
    d31tighter.paths["/a"].post.requestBody.content["application/json"].schema.exclusiveMaximum = 5
    expect(diffsOf(d30, d31tighter).filter((d) => d.path[0] === "paths")).toMatchObject([{ type: breaking }])
  })

  it("G19 example (3.0 / 3.1) and a 3.2 example with dataValue are representation changes only", () => {
    const d31 = {
      openapi: "3.1.0",
      paths: {
        "/a": {
          get: {
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: s, examples: { one: { value: "x" } } } },
              },
            },
          },
        },
      },
    }
    const d32 = clone(d31)
    d32.openapi = "3.2.0"
    d32.paths["/a"].get.responses[200].content["application/json"].examples.one = { dataValue: "x" } as any
    expect(diffsOf(d31, d32)).toMatchObject([{ path: ["openapi"], type: annotation }])
  })

  it("G20 merged keeps each document's original representation", () => {
    const d30 = {
      openapi: "3.0.0",
      paths: {
        "/a": {
          post: {
            requestBody: { content: { "application/json": { schema: { type: "string", nullable: true } } } },
            responses: ok,
          },
        },
      },
    }
    const d31 = {
      openapi: "3.1.0",
      paths: {
        "/a": {
          post: {
            requestBody: { content: { "application/json": { schema: { type: ["string", "null"] } } } },
            responses: ok,
          },
        },
      },
    }
    const { merged } = compareOpenApi(d30, d31, { metaKey })
    expect(merged.paths["/a"].post.requestBody.content["application/json"].schema).toEqual({ type: ["string", "null"] })
  })
})
