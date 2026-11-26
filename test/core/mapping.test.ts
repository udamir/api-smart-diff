import {
  type CompareContext,
  arrayMappingResolver,
  caseInsensitiveKeyMappingResolver,
  enumMappingResolver,
  objectMappingResolver,
} from "../../src"
import { contentMediaTypeMappingResolver, paramMappingResolver, pathMappingResolver } from "../../src/openapi"
import { jsonSchemaMappingResolver, requiredMappingResolver } from "../../src/jsonSchema"

const ctx = (before: Partial<CompareContext["before"]> = {}, after: Partial<CompareContext["after"]> = {}) =>
  ({
    before: { path: [], key: "", value: undefined, root: {}, ...before },
    after: { path: [], key: "", value: undefined, root: {}, ...after },
    rules: {},
    options: {},
  }) as CompareContext

describe("Block A4 — key mapping resolvers", () => {
  describe("objectMappingResolver", () => {
    it("A4.1 maps equal keys and splits the rest into added/removed", () => {
      expect(objectMappingResolver({ a: 1, b: 1 }, { b: 2, c: 2 }, ctx())).toEqual({
        mapped: { b: "b" },
        removed: ["a"],
        added: ["c"],
      })
    })
  })

  describe("caseInsensitiveKeyMappingResolver", () => {
    // ISSUE-01 (fixed): the resolver stores the *lowercased* key as both source and target of the mapping, so the engine
    // never finds the real before key ("5XX") in the key map and silently skips the whole subtree.
    it("A4.2 returns the original before key mapped to the original after key", () => {
      expect(caseInsensitiveKeyMappingResolver({ "5XX": 1 }, { "5xx": 2 }, ctx())).toEqual({
        mapped: { "5XX": "5xx" },
        removed: [],
        added: [],
      })
    })

    it("A4.3 same-case uppercase keys map to themselves", () => {
      expect(caseInsensitiveKeyMappingResolver({ "5XX": 1 }, { "5XX": 2 }, ctx()).mapped).toEqual({ "5XX": "5XX" })
    })

    it("A4.4 removed keys are reported with their original spelling", () => {
      expect(caseInsensitiveKeyMappingResolver({ "4XX": 1 }, {}, ctx()).removed).toEqual(["4XX"])
    })

    it("A4.5 lowercase keys map to themselves", () => {
      expect(
        caseInsensitiveKeyMappingResolver({ "200": 1, default: 1 }, { "200": 2, default: 2 }, ctx()).mapped,
      ).toEqual({
        "200": "200",
        default: "default",
      })
    })
  })

  describe("arrayMappingResolver", () => {
    it("A4.6 maps by index and reports the tail as added/removed", () => {
      expect(arrayMappingResolver([1, 2, 3], [1], ctx())).toEqual({ mapped: { 0: 0 }, removed: [1, 2], added: [] })
      expect(arrayMappingResolver([1], [1, 2, 3], ctx())).toEqual({ mapped: { 0: 0 }, removed: [], added: [1, 2] })
      expect(arrayMappingResolver([], [], ctx())).toEqual({ mapped: {}, removed: [], added: [] })
    })
  })

  describe("enumMappingResolver", () => {
    it("A4.7 maps equal primitives regardless of position", () => {
      expect(enumMappingResolver(["a", "b", "c"], ["c", "a"], ctx())).toEqual({
        mapped: { 0: 1, 2: 0 },
        removed: [1],
        added: [],
      })
    })

    it("A4.8 pairs unmatched items positionally as replacements before reporting added/removed", () => {
      expect(enumMappingResolver(["a", "x"], ["a", "y", "z"], ctx())).toEqual({
        mapped: { 0: 0, 1: 1 },
        removed: [],
        added: [2],
      })
    })

    it("A4.9 object items are paired positionally (reference equality never matches)", () => {
      expect(enumMappingResolver([{ a: 1 }], [{ a: 1 }], ctx())).toEqual({ mapped: { 0: 0 }, removed: [], added: [] })
    })
  })

  describe("requiredMappingResolver", () => {
    it("A4.10 maps equal names and reports the rest as added/removed (no positional pairing)", () => {
      expect(requiredMappingResolver(["a", "b"], ["b", "c"], ctx())).toEqual({
        mapped: { 1: 0 },
        removed: [0],
        added: [1],
      })
    })
  })

  describe("pathMappingResolver", () => {
    it("A4.11 matches templated paths regardless of parameter names", () => {
      expect(pathMappingResolver({ "/pet/{id}": 1, "/x": 1 }, { "/pet/{petId}": 2, "/y": 2 }, ctx())).toEqual({
        mapped: { "/pet/{id}": "/pet/{petId}" },
        removed: ["/x"],
        added: ["/y"],
      })
    })

    it("A4.12 does not confuse a literal segment with a template", () => {
      expect(pathMappingResolver({ "/pet/{id}": 1 }, { "/pet/mine": 2 }, ctx())).toEqual({
        mapped: {},
        removed: ["/pet/{id}"],
        added: ["/pet/mine"],
      })
    })
  })

  describe("paramMappingResolver", () => {
    const p = (name: string, where = "query", extra = {}) => ({ name, in: where, ...extra })

    it("A4.13 maps by name and location", () => {
      const before = [p("a"), p("b"), p("b", "header")]
      const after = [p("b", "header"), p("b"), p("c")]
      expect(paramMappingResolver(before, after, ctx())).toEqual({ mapped: { 1: 1, 2: 0 }, removed: [0], added: [2] })
    })

    it("A4.14 maps renamed path parameters positionally through the path template", () => {
      const c = ctx(
        { path: ["paths", "/pet/{id}", "get", "parameters"] },
        { path: ["paths", "/pet/{petId}", "get", "parameters"] },
      )
      expect(paramMappingResolver([p("id", "path")], [p("petId", "path")], c).mapped).toEqual({ 0: 0 })
    })

    it("A4.15 resolves $ref parameters against the document roots", () => {
      const root = (name: string) => ({ components: { parameters: { P: p(name) } } })
      const c = ctx({ root: root("a") }, { root: root("a") })
      expect(paramMappingResolver([{ $ref: "#/components/parameters/P" }], [p("a")], c).mapped).toEqual({ 0: 0 })
    })

    // ISSUE-15 (fixed): `findIndex` returns the first name/in match even when that after item is already mapped, so two
    // before items (e.g. a path-level parameter and its operation-level override) collapse onto one after item.
    it("A4.16 never maps two before items onto the same after item", () => {
      const before = [p("limit", "query", { description: "op" }), p("limit", "query", { description: "path" })]
      const after = [p("limit", "query", { description: "op" }), p("limit", "query", { description: "path" })]
      expect(paramMappingResolver(before, after, ctx())).toEqual({ mapped: { 0: 0, 1: 1 }, removed: [], added: [] })
    })
  })

  describe("contentMediaTypeMappingResolver", () => {
    it("A4.17 ignores media type parameters such as charset", () => {
      expect(
        contentMediaTypeMappingResolver({ "application/json;charset=utf-8": 1 }, { "application/json": 2 }, ctx())
          .mapped,
      ).toEqual({ "application/json;charset=utf-8": "application/json" })
    })

    it("A4.18 matches wildcard media types", () => {
      expect(contentMediaTypeMappingResolver({ "application/json": 1 }, { "application/*": 2 }, ctx()).mapped).toEqual({
        "application/json": "application/*",
      })
      expect(contentMediaTypeMappingResolver({ "text/plain": 1 }, { "*/*": 2 }, ctx()).mapped).toEqual({
        "text/plain": "*/*",
      })
    })

    // ISSUE-21 (fixed): first-match strategy maps `application/json` onto the wildcard when both exist, so an unchanged set
    // of media types that is merely reordered is reported as removed + renamed + added.
    it("A4.19 prefers exact matches over wildcard matches", () => {
      const before = { "application/json": 1, "application/*": 1 }
      const after = { "application/*": 2, "application/json": 2 }
      expect(contentMediaTypeMappingResolver(before, after, ctx())).toEqual({
        mapped: { "application/json": "application/json", "application/*": "application/*" },
        removed: [],
        added: [],
      })
    })
  })

  describe("jsonSchemaMappingResolver", () => {
    it("A4.20 maps oneOf <-> anyOf as a rename instead of remove + add", () => {
      expect(jsonSchemaMappingResolver({ oneOf: [] }, { anyOf: [] }, ctx())).toEqual({
        mapped: { oneOf: "anyOf" },
        removed: [],
        added: [],
      })
    })
  })
})
