import { apiCompare, compareJsonSchema, compareOpenApi, type CompareOptions } from "../../src"
import type { OpenApiCompareOptions } from "../../src/openapi/openapi3.types"
import { deepCopy } from "../../src/utils"

// Block M (2.0.2): the merged document holds the compared (normalized) values of every node with a change and the
// after value as written for an unchanged subtree; its objects list the after keys in after order, removed keys last;
// array meta survives copies. The `merged` option is removed.

// biome-ignore lint/suspicious/noExplicitAny: merged documents are read by path
type Any = any

const strip = (value: unknown): Any => JSON.parse(JSON.stringify(value, (key, v) => (key === "$diff" ? undefined : v)))
const at = (root: unknown, path: (string | number)[]): unknown =>
  path.reduce<Any>((node, key) => (node === undefined || node === null ? undefined : node[key]), root)

const info = { title: "t", version: "1" }
const ok = { 200: { description: "ok" } }

describe("Block M — merged document", () => {
  it("M1 a changed parameter shows its compared values; an unchanged sibling stays as written", () => {
    const doc = (type: string) => ({
      openapi: "3.0.3",
      info,
      paths: {
        "/pets": {
          get: {
            parameters: [
              { name: "limit", in: "query", schema: { type } },
              { name: "other", in: "query", schema: { type: "string" } },
            ],
            responses: ok,
          },
        },
      },
    })
    const { merged, diffs } = apiCompare(doc("integer"), doc("string"))
    const parameters = strip((merged as Any).paths["/pets"].get.parameters)
    expect(parameters).toEqual([
      { name: "limit", in: "query", schema: { type: "string" }, style: "form", explode: true },
      { name: "other", in: "query", schema: { type: "string" } },
    ])
    for (const diff of diffs) {
      expect(at(merged, diff.path)).toBe(diff.after)
    }
  })

  it("M2 a changed path-level parameter is shown in the operations only, where its diffs are", () => {
    const doc = (type: string) => ({
      openapi: "3.0.3",
      info,
      paths: {
        "/p": {
          parameters: [{ name: "q", in: "query", schema: { type } }],
          get: { responses: ok },
          post: { responses: ok },
        },
      },
    })
    const { merged, diffs } = apiCompare(doc("string"), doc("integer"))
    const item = (merged as Any).paths["/p"]
    expect(Object.keys(item)).toEqual(["get", "post"])
    expect(diffs.map((diff) => diff.path.join("/"))).toEqual([
      "paths//p/get/parameters/0/schema/type",
      "paths//p/post/parameters/0/schema/type",
    ])
    for (const diff of diffs) {
      expect(at(merged, diff.path)).toBe("integer")
    }
  })

  it("M3 a changed allOf is shown merged, without the original allOf; an unchanged one stays as written", () => {
    const doc = (type: string) => ({
      openapi: "3.0.3",
      info,
      paths: {
        "/p": {
          get: {
            responses: {
              200: {
                description: "ok",
                content: {
                  "application/json": {
                    schema: {
                      allOf: [{ $ref: "#/components/schemas/Pet" }, { type: "object", properties: { x: { type } } }],
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: { schemas: { Pet: { type: "object", properties: { id: { type: "string" } } } } },
    })
    const changed = apiCompare(doc("string"), doc("integer"))
    const schema = (changed.merged as Any).paths["/p"].get.responses["200"].content["application/json"].schema
    expect(strip(schema)).toEqual({ type: "object", properties: { id: { type: "string" }, x: { type: "integer" } } })
    expect(changed.diffs).toHaveLength(1)
    expect(at(changed.merged, changed.diffs[0].path)).toBe("integer")

    const unchanged = apiCompare(doc("string"), doc("string"))
    expect((unchanged.merged as Any).paths["/p"].get.responses["200"].content["application/json"].schema).toEqual(
      doc("string").paths["/p"].get.responses["200"].content["application/json"].schema,
    )
  })

  it("M4 merged objects list the after keys in after order, removed keys last", () => {
    const keys = (value: unknown) => Object.keys(value as object).filter((key) => key !== "$diff")
    const doc = (properties: Record<string, unknown>) => ({
      openapi: "3.0.3",
      info,
      paths: {},
      components: { schemas: { S: { type: "object", properties } } },
    })
    const s = { type: "string" }
    const middle = apiCompare(doc({ a: s, c: s, d: s }), doc({ a: s, b: s, c: s }))
    expect(keys((middle.merged as Any).components.schemas.S.properties)).toEqual(["a", "b", "c", "d"])

    const first = compareJsonSchema(
      { type: "object", properties: { a: s, c: s } },
      { type: "object", properties: { b: s, a: s, c: s } },
    )
    expect(keys((first.merged as Any).properties)).toEqual(["b", "a", "c"])

    // nested, with a key moved: the after order wins
    const nested = compareJsonSchema(
      { type: "object", properties: { o: { type: "object", properties: { y: s, x: s } } } },
      { type: "object", properties: { o: { type: "object", properties: { x: s, z: s, y: { type: "integer" } } } } },
    )
    expect(keys((nested.merged as Any).properties.o.properties)).toEqual(["x", "z", "y"])
  })

  it.each([
    ["a string meta key", "$diff"],
    ["a symbol meta key", Symbol("diff")],
  ])("M5 arrayMeta: true marks the array at every usage of a changed $ref target (%s)", (_title, metaKey) => {
    const doc = (values: string[]) => ({
      openapi: "3.0.3",
      info,
      paths: Object.fromEntries(
        ["/a", "/b", "/c"].map((path) => [
          path,
          {
            get: {
              parameters: [{ name: "k", in: "query", schema: { $ref: "#/components/schemas/K" } }],
              responses: ok,
            },
          },
        ]),
      ),
      components: { schemas: { K: { type: "string", enum: values } } },
    })
    const options: CompareOptions = { arrayMeta: true, metaKey }
    const { merged, diffs } = apiCompare(doc(["a", "b"]), doc(["a", "b", "c"]), options)
    expect(diffs).toHaveLength(4)
    const meta = { 2: { action: "add", type: "non-breaking" } }
    for (const path of ["/a", "/b", "/c"]) {
      expect((merged as Any).paths[path].get.parameters[0].schema.enum[metaKey]).toEqual(meta)
    }
    expect((merged as Any).components.schemas.K.enum[metaKey]).toEqual(meta)
  })

  it("M6 deepCopy keeps the extra keys of an array", () => {
    const symbol = Symbol("meta")
    const array = Object.assign([1, { a: 2 }], { $diff: { 0: { action: "add" } }, [symbol]: { 1: {} } }) as Any
    const copy = deepCopy(array)
    expect([...copy]).toEqual([1, { a: 2 }])
    expect(copy).not.toBe(array)
    expect(copy.$diff).toEqual({ 0: { action: "add" } })
    expect(copy.$diff).not.toBe(array.$diff)
    expect(copy[symbol]).toEqual({ 1: {} })
  })

  it("M7 the removed options are not accepted", () => {
    // @ts-expect-error `merged` was removed in 2.0.2
    const options: CompareOptions = { merged: "original" }
    // @ts-expect-error `profile` of compareOpenApi was never read; removed in 2.0.2
    const openApiOptions: OpenApiCompareOptions = { profile: undefined }
    expect([options, openApiOptions]).toHaveLength(2)
  })
})

describe("Block M8 — case-only renames of OpenAPI keys", () => {
  it("M8.1 a response header renamed by case only names the old and the new header", () => {
    const doc = (name: string) => ({
      openapi: "3.0.3",
      info,
      paths: {
        "/p": {
          get: { responses: { 200: { description: "ok", headers: { [name]: { schema: { type: "string" } } } } } },
        },
      },
    })
    const { diffs } = compareOpenApi(doc("X-Rate"), doc("x-rate"))
    expect(diffs.map((diff) => [diff.type, diff.description])).toEqual([
      ["annotation", "[Renamed] header `X-Rate` to `x-rate` in Response 200"],
    ])
  })

  it("M8.2 an encoding header renamed by case only names its encoding", () => {
    const doc = (name: string) => ({
      openapi: "3.0.3",
      info,
      paths: {
        "/p": {
          post: {
            requestBody: {
              content: {
                "multipart/form-data": {
                  schema: { type: "object" },
                  encoding: { f: { headers: { [name]: { schema: { type: "string" } } } } },
                },
              },
            },
            responses: ok,
          },
        },
      },
    })
    const { diffs } = compareOpenApi(doc("X-A"), doc("x-a"))
    expect(diffs.map((diff) => diff.description)).toEqual([
      "[Renamed] header `X-A` to `x-a` in encoding `f` in Request Body content (multipart/form-data)",
    ])
  })

  it("M8.3 a response code renamed by case only names the old and the new code once each", () => {
    const doc = (code: string) => ({
      openapi: "3.0.3",
      info,
      paths: { "/p": { get: { responses: { [code]: { description: "ok" } } } } },
    })
    const { diffs } = compareOpenApi(doc("2xx"), doc("2XX"))
    expect(diffs.map((diff) => [diff.type, diff.description])).toEqual([
      ["annotation", "[Renamed] Response `2xx` to `2XX`"],
    ])
  })
})
