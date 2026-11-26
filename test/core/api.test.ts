import {
  type Diff,
  apiCompare,
  breaking,
  compareAsyncApi,
  compareGraphApi,
  compareJsonSchema,
  compareOpenApi,
  detectSpec,
  UnsupportedSpecError,
} from "../../src"
import { discoverCompareEngine } from "../../src/api"
import { yaml } from "../helpers"

const metaKey = Symbol("diff")

describe("Block A8 — public API and engine discovery", () => {
  describe("discoverCompareEngine", () => {
    it("A8.1 routes documents to the matching engine", () => {
      expect(discoverCompareEngine({ openapi: "3.0.3" })).toBe(compareOpenApi)
      expect(discoverCompareEngine({ openapi: "3.1.0" })).toBe(compareOpenApi)
      expect(discoverCompareEngine({ asyncapi: "2.6.0" })).toBe(compareAsyncApi)
      expect(discoverCompareEngine({ graphapi: "0.1.2" })).toBe(compareGraphApi)
      expect(discoverCompareEngine({ type: "object" })).toBe(compareJsonSchema)
    })

    it("A8.2 falls back to JSON Schema for non-object input", () => {
      expect(discoverCompareEngine(null)).toBe(compareJsonSchema)
      expect(discoverCompareEngine("string")).toBe(compareJsonSchema)
      expect(discoverCompareEngine(undefined)).toBe(compareJsonSchema)
    })

    // ISSUE-29 (fixed, DESIGN_PROPOSALS §11.3): unsupported specifications throw `UnsupportedSpecError` instead of
    // being diffed as plain JSON Schema; AsyncAPI 3 is routed to the AsyncAPI engine; `options.engine` forces one.
    it("A8.3 unsupported specifications are rejected with UnsupportedSpecError", () => {
      expect(() => discoverCompareEngine({ swagger: "2.0" })).toThrow(UnsupportedSpecError)
      expect(() => apiCompare({ swagger: "2.0" }, { swagger: "2.0" })).toThrow(/Swagger 2.0 is not supported/)
      expect(() => apiCompare({ openapi: "3.0.0" }, { asyncapi: "2.6.0" })).toThrow(UnsupportedSpecError)
      expect(discoverCompareEngine({ asyncapi: "3.0.0" })).toBe(compareAsyncApi)
      expect(detectSpec({ openapi: 3.1 })).toEqual({ engine: "openapi", version: "3.1" })
    })

    // ISSUE-29 (fixed): the version regexes are anchored.
    it("A8.4 does not treat a major version that merely contains '3' as OpenAPI 3", () => {
      expect(() => discoverCompareEngine({ openapi: "13.0.0" })).toThrow(UnsupportedSpecError)
      expect(() => discoverCompareEngine({ openapi: "4.0.0" })).toThrow(UnsupportedSpecError)
    })

    it("A8.4b options.engine forces an engine", () => {
      const { diffs } = apiCompare({ swagger: "2.0", a: 1 }, { swagger: "2.0", a: 2 }, { engine: "jsonschema" })
      expect(diffs).toMatchObject([{ path: ["a"], action: "replace" }])
    })
  })

  describe("apiCompare", () => {
    const before = yaml`
      openapi: 3.0.0
      paths:
        /p:
          get:
            responses:
              '200':
                description: ok
    `
    const after = yaml`
      openapi: 3.0.0
      paths:
        /p:
          get:
            responses:
              '200':
                description: changed
    `

    it("A8.5 apiCompare selects the engine from the before document and returns diffs + merged", () => {
      const result = apiCompare(before, after, { metaKey })
      const direct = compareOpenApi(before, after, { metaKey })

      expect(result.diffs).toEqual(direct.diffs)
      expect(result.merged).toEqual(direct.merged)
    })

    // DESIGN_PROPOSALS §11.11: the deprecated `apiDiff` / `apiMerge` wrappers are removed in 2.0.0
    it("A8.6 the deprecated apiDiff and apiMerge wrappers are no longer exported", async () => {
      const api = await import("../../src")
      expect("apiDiff" in api).toBe(false)
      expect("apiMerge" in api).toBe(false)
    })

    it("A8.7 a custom annotateHook is invoked for every diff and its result is used as description", () => {
      const seen: Diff[] = []
      const { diffs } = apiCompare(before, after, {
        annotateHook: (diff) => {
          seen.push(diff)
          return `custom:${diff.path.join(".")}`
        },
      })
      expect(seen).toHaveLength(diffs.length)
      expect(diffs.every((d) => d.description?.startsWith("custom:"))).toBe(true)
    })

    it("A8.8 custom rules replace the default rules entirely", () => {
      const { diffs } = apiCompare(before, after, { rules: { "/**": { $: [breaking, breaking, breaking] } } })
      expect(diffs).toMatchObject([{ type: breaking }])
      // without an `annotate` rule the default hook generates a description (DESIGN_PROPOSALS §2 principle 6): the key,
      // the path inside the nearest container (the operation, POLICY-08) and the scalar values (P8a)
      expect(diffs[0].description).toBe(
        "[Replaced] `description` of responses.200 in operation `GET /p` from `ok` to `changed`",
      )
    })

    it("A8.9 an annotateHook returning an empty string leaves description undefined", () => {
      const { diffs } = apiCompare(before, after, { annotateHook: () => "" })
      expect(diffs[0]).not.toHaveProperty("description")
    })
  })

  describe("options", () => {
    // ISSUE-10 (fixed): `externalSources` is part of the public `CompareOptions` type and the README, but nothing in the
    // code base reads it — external $refs are never resolved.
    it("A8.10 externalSources are used to resolve external $refs", () => {
      const schema = { type: "object", properties: { a: { $ref: "ext.yaml#/X" } } }
      const { diffs } = compareJsonSchema(schema, structuredClone(schema), {
        externalSources: {
          before: { "ext.yaml": { X: { type: "string" } } },
          after: { "ext.yaml": { X: { type: "number" } } },
        },
      })

      expect(diffs).toMatchObject([{ action: "replace", path: ["properties", "a", "type"], type: breaking }])
    })

    // ISSUE-417: a `$ref` to a whole external document (no fragment, or an empty one) resolves to the path `[]` of that
    // document, which was taken for an ancestor of the usage (a reference such as `#`) and compared as an opaque node:
    // two different external documents compared as unchanged, without an error.
    it.each(["https://example.com/pet.json", "https://example.com/pet.json#", "pet.json"])(
      "A8.13 a $ref to a whole external document (%s) compares the external documents",
      (ref) => {
        const document = (schema: object) => ({
          openapi: "3.1.0",
          info: { title: "Pets", version: "1.0.0" },
          paths: {
            "/pets": {
              get: { responses: { "200": { description: "A pet", content: { "application/json": { schema } } } } },
            },
          },
        })
        const url = ref.replace(/#$/, "")
        const { diffs, errors } = apiCompare(document({ $ref: ref }), document({ $ref: ref }), {
          externalSources: {
            before: { [url]: { type: "object", properties: { name: { type: "string" } } } },
            after: { [url]: { type: "object", properties: { name: { type: "integer" } } } },
          },
        })

        expect(errors ?? []).toEqual([])
        expect(diffs).toMatchObject([
          {
            type: breaking,
            action: "replace",
            path: [
              "paths",
              "/pets",
              "get",
              "responses",
              "200",
              "content",
              "application/json",
              "schema",
              "properties",
              "name",
              "type",
            ],
            scope: "response",
          },
        ])
      },
    )

    it("A8.14 a $ref to a whole external document in a standalone JSON Schema compares the external documents", () => {
      const schema = { type: "object", properties: { a: { $ref: "ext.json" } } }
      const { diffs } = compareJsonSchema(schema, structuredClone(schema), {
        externalSources: { before: { "ext.json": { type: "string" } }, after: { "ext.json": { type: "number" } } },
      })

      expect(diffs).toMatchObject([{ action: "replace", path: ["properties", "a", "type"], type: breaking }])
    })

    it("A8.15 a whole external document that references itself is compared once (cycle), its change reported", () => {
      const schema = { type: "object", properties: { a: { $ref: "tree.json" } } }
      const tree = (type: string) => ({
        type: "object",
        properties: { value: { type }, child: { $ref: "tree.json" } },
      })
      const { diffs } = compareJsonSchema(schema, structuredClone(schema), {
        externalSources: { before: { "tree.json": tree("string") }, after: { "tree.json": tree("number") } },
      })

      expect(diffs).toMatchObject([
        { action: "replace", path: ["properties", "a", "properties", "value", "type"], type: breaking },
      ])
    })

    // ISSUE-19 (fixed): getMaxOpenApiVersion calls `.startsWith` on whatever `openapi` holds; YAML `openapi: 3.1` is a number.
    it("A8.11 compareOpenApi tolerates a numeric openapi version field", () => {
      expect(() => compareOpenApi({ openapi: 3.1, paths: {} }, { openapi: 3.1, paths: {} })).not.toThrow()
    })

    // AsyncAPI 3 is supported with its own profile; 2 <-> 3 is not comparable (DESIGN_PROPOSALS §11.7)
    it("A8.12 compareAsyncApi rejects unsupported and mixed major versions explicitly", () => {
      expect(() => compareAsyncApi({ asyncapi: "1.2.0" }, { asyncapi: "1.2.0" })).toThrow(/Unsupported version/)
      expect(() => compareAsyncApi({ asyncapi: "2.6.0" }, { asyncapi: "3.0.0" })).toThrow(/Unsupported version/)
      expect(() => compareAsyncApi({ asyncapi: "3.0.0" }, { asyncapi: "3.0.0" })).not.toThrow()
    })
  })
})
