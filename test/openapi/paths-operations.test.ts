import { annotation, breaking, compareOpenApi, deprecated, nonBreaking, unclassified } from "../../src"

const metaKey = Symbol("diff")
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

const ok = { 200: { description: "ok" } }
const doc = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  openapi: "3.0.0",
  paths,
  ...extra,
})
const op = (extra: Record<string, unknown> = {}) => ({ responses: ok, ...extra })

describe("Block C2 — OpenAPI paths and operations", () => {
  it("C2.1 adding a path reports one non-breaking diff per operation and no path-level diff", () => {
    const { diffs, merged } = compareOpenApi(
      doc({ "/a": { get: op() } }),
      doc({ "/a": { get: op() }, "/b": { get: op(), post: op() } }),
      { metaKey },
    )

    expect(diffs).toHaveLength(2)
    expect(diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "add", path: ["paths", "/b", "get"], type: nonBreaking }),
        expect.objectContaining({ action: "add", path: ["paths", "/b", "post"], type: nonBreaking }),
      ]),
    )
    expect(merged.paths["/b"]).toMatchObject({ get: op(), post: op() })
  })

  it("C2.2 removing a path reports one breaking diff per operation", () => {
    const { diffs } = compareOpenApi(doc({ "/a": { get: op(), delete: op() } }), doc({}), { metaKey })
    expect(diffs).toHaveLength(2)
    expect(diffs.every((d) => d.action === "remove" && d.type === breaking)).toBe(true)
  })

  it("C2.3 adding/removing an operation on an existing path", () => {
    const added = compareOpenApi(doc({ "/a": { get: op() } }), doc({ "/a": { get: op(), post: op() } }), { metaKey })
    expect(added.diffs).toMatchObject([{ action: "add", path: ["paths", "/a", "post"], type: nonBreaking }])

    const removed = compareOpenApi(doc({ "/a": { get: op(), post: op() } }), doc({ "/a": { get: op() } }), { metaKey })
    expect(removed.diffs).toMatchObject([{ action: "remove", path: ["paths", "/a", "post"], type: breaking }])
  })

  it("C2.4 renaming a path parameter is a non-breaking rename", () => {
    const p = (name: string) => ({
      get: op({ parameters: [{ name, in: "path", required: true, schema: { type: "string" } }] }),
    })
    const { diffs } = compareOpenApi(doc({ "/pet/{id}": p("id") }), doc({ "/pet/{petId}": p("petId") }), { metaKey })

    expect(diffs.every((d) => d.type === nonBreaking)).toBe(true)
    expect(diffs).toContainEqual(
      expect.objectContaining({ action: "rename", path: ["paths"], before: "/pet/{id}", after: "/pet/{petId}" }),
    )
  })

  it("C2.5 path-level parameters are attributed to every operation", () => {
    const param = { name: "x", in: "query", schema: { type: "string" } }
    const { diffs } = compareOpenApi(
      doc({ "/a": { get: op(), post: op() } }),
      doc({ "/a": { parameters: [param], get: op(), post: op() } }),
      { metaKey },
    )

    expect(diffs).toHaveLength(2)
    expect(diffs.map((d) => d.path.slice(0, 4).join("/")).sort()).toEqual([
      "paths//a/get/parameters",
      "paths//a/post/parameters",
    ])
    expect(diffs.every((d) => d.type === nonBreaking)).toBe(true)
  })

  // ISSUE-15 (fixed): an operation-level parameter that overrides a path-level one (same name + in) is appended twice instead
  // of replacing the path-level definition, producing spurious diffs even for identical documents.
  it("C2.6 an operation-level parameter overriding a path-level one yields no diffs for identical documents", () => {
    const d = doc({
      "/a": {
        parameters: [{ name: "limit", in: "query", description: "path-level", schema: { type: "integer" } }],
        get: op({
          parameters: [{ name: "limit", in: "query", description: "operation-level", schema: { type: "integer" } }],
        }),
      },
    })
    expect(compareOpenApi(d, clone(d), { metaKey }).diffs).toEqual([])
  })

  // ISSUE-16 (fixed): `transformPathItems` runs before the $ref resolver and rewrites a `{ $ref }` path item into `{}`.
  it("C2.7 a $ref path item is resolved and its operations are compared", () => {
    const mk = (desc: string, deprecated = false) =>
      doc(
        { "/a": { $ref: "#/components/pathItems/A" } },
        {
          openapi: "3.1.0",
          components: {
            pathItems: {
              A: { get: { ...(deprecated ? { deprecated } : {}), responses: { 200: { description: desc } } } },
            },
          },
        },
      )
    const { diffs, merged } = compareOpenApi(mk("one"), mk("two", true), { metaKey })

    expect(merged.paths["/a"]).not.toEqual({})
    // the deprecation is reported at the usage and at the declaration; the description change (annotation-only inside
    // the component) at the declaration only (POLICY-57, ISSUE-190)
    expect(diffs.some((d) => d.path[0] === "paths" && d.type === deprecated)).toBe(true)
    expect(diffs.filter((d) => d.type === annotation).map((d) => d.path.join("/"))).toEqual([
      "components/pathItems/A/get/responses/200/description",
    ])
  })

  // ISSUE-32 (fixed): path-level summary/description are copied into every operation, so one documentation change produces
  // one diff per operation.
  it("C2.8 a path-level description change is reported once", () => {
    const { diffs } = compareOpenApi(
      doc({ "/a": { description: "one", get: op(), post: op() } }),
      doc({ "/a": { description: "two", get: op(), post: op() } }),
      { metaKey },
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(annotation)
  })

  it("C2.9 operation metadata changes are annotations, deprecation is 'deprecated'", () => {
    const before = doc({ "/a": { get: op({ operationId: "a", summary: "s", tags: ["t"] }) } })
    const after = doc({
      "/a": { get: op({ operationId: "b", summary: "s2", tags: ["t", "u"], description: "d", deprecated: true }) },
    })
    const { diffs } = compareOpenApi(before, after, { metaKey })

    const byKey = Object.fromEntries(diffs.map((d) => [d.path.slice(3).join("/"), d.type]))
    expect(byKey).toEqual({
      operationId: annotation,
      summary: annotation,
      "tags/1": annotation,
      description: annotation,
      deprecated: deprecated,
    })
    expect(diffs.every((d) => d.description)).toBe(true)
  })

  it("C2.10 deprecated: false is treated as not deprecated", () => {
    expect(
      compareOpenApi(doc({ "/a": { get: op() } }), doc({ "/a": { get: op({ deprecated: false }) } }), { metaKey })
        .diffs,
    ).toEqual([])
  })

  it("C2.11 operation and path level servers are annotations", () => {
    const { diffs } = compareOpenApi(
      doc({ "/a": { get: op({ servers: [{ url: "https://a" }] }) } }),
      doc({ "/a": { get: op({ servers: [{ url: "https://b" }] }) } }),
      { metaKey },
    )
    expect(diffs).toMatchObject([{ type: annotation }])
  })

  // ISSUE-17 (fixed): callbacks only have a $ref resolver, no classification rules.
  it("C2.12 changes inside callbacks are classified", () => {
    const cb = (desc: string) => ({
      onEvent: { "{$request.body#/url}": { post: { responses: { 200: { description: desc } } } } },
    })
    const { diffs } = compareOpenApi(
      doc({ "/a": { get: op({ callbacks: cb("one") }) } }),
      doc({ "/a": { get: op({ callbacks: cb("two") }) } }),
      { metaKey },
    )

    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).not.toBe(unclassified)
  })

  // ISSUE-17 (fixed): OpenAPI 3.1 webhooks have no rules at all.
  it("C2.13 changes inside webhooks (3.1) are classified", () => {
    const wh = (desc: string) =>
      doc({}, { openapi: "3.1.0", webhooks: { newPet: { post: { responses: { 200: { description: desc } } } } } })
    const { diffs } = compareOpenApi(wh("one"), wh("two"), { metaKey })

    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).not.toBe(unclassified)
  })

  it("C2.14 vendor extensions on an operation are annotations", () => {
    const { diffs } = compareOpenApi(
      doc({ "/a": { get: op({ "x-internal": true }) } }),
      doc({ "/a": { get: op({ "x-internal": false }) } }),
      { metaKey },
    )
    expect(diffs).toMatchObject([{ path: ["paths", "/a", "get", "x-internal"], type: annotation }])
  })

  it("C2.15 identical documents produce no diffs and no meta", () => {
    const d = doc({
      "/a/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: op({ tags: ["t"], parameters: [{ name: "q", in: "query", schema: { type: "string" } }] }),
      },
    })
    const { diffs, merged } = compareOpenApi(d, clone(d), { metaKey })

    expect(diffs).toEqual([])
    expect(JSON.stringify(merged)).not.toContain("$diff")
    expect(merged.paths["/a/{id}"].get[metaKey]).toBeUndefined()
  })
})
