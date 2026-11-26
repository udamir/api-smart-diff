import {
  apiCompare,
  compareGraphApi,
  detectSpec,
  UnsupportedSpecError,
  breaking,
  nonBreaking,
  risky,
  annotation,
  deprecated,
  unclassified,
  type Diff,
} from "../../src"
import { graphapi } from "../helpers"

// GraphApi 1.0 (gqlapi 0.6, spec https://udamir.github.io/graphapi/spec/v1.0): flat type usages (`$ref`, built-in
// `type`, `type: list` + `items`), `nonNull: true` + `default`, definition members next to the definition's `type`,
// keyed enum values. Expectations come from GraphQL client semantics.

const metaKey = Symbol("diff")

const sdl = (source: string) => graphapi(Object.assign([source], { raw: [source] }) as unknown as TemplateStringsArray)

const compare = (before: string, after: string) => compareGraphApi(sdl(before), sdl(after), { metaKey })

const pathOf = (diff: Diff) => diff.path.join("/")

const byPath = (diffs: Diff[], path: string) => {
  const diff = diffs.find((d) => pathOf(d) === path)
  expect(diff, `expected a diff at "${path}", got: ${diffs.map(pathOf).join(", ")}`).toBeDefined()
  return diff as Diff
}

describe("GraphApi 1.0: documents and routing", () => {
  it("G10.1 a 1.0 document is detected and compared with the 1.0 rule set", () => {
    const doc = sdl("type Query { a: String }")
    expect(doc.graphapi).toBe("1.0")
    const { diffs } = compareGraphApi(doc, sdl("type Query { a: String b: Int }"), { metaKey })
    expect(diffs).toMatchObject([{ path: ["queries", "b"], action: "add", type: nonBreaking, scope: "output" }])
  })

  // GraphApi 0.1.2 (gqlapi 0.5 and earlier) is no longer supported: every entry point rejects it with a message that
  // says how to convert the schema
  const legacy = { graphapi: "0.1.2", queries: { a: { type: "string", nullable: true } } }
  const conversion = "convert the GraphQL SDL with gqlapi 0.6 or later, which writes GraphApi 1.0"

  it("G10.2 a GraphApi 0.1.2 document is rejected by compareGraphApi with UnsupportedSpecError", () => {
    const current = sdl("type Query { a: String }")
    for (const [before, after] of [
      [legacy, current],
      [current, legacy],
      [legacy, legacy],
    ]) {
      expect(() => compareGraphApi(before, after)).toThrow(UnsupportedSpecError)
    }
    expect(() => compareGraphApi(legacy, current)).toThrow(`GraphApi 0.1.2 is not supported: ${conversion}`)
    expect(() => compareGraphApi({ graphapi: "0.2" }, current)).toThrow(`GraphApi 0.2 is not supported: ${conversion}`)
    try {
      compareGraphApi(current, legacy)
    } catch (error) {
      expect(error).toMatchObject({ name: "UnsupportedSpecError", before: "1.0", after: "0.1.2" })
    }
  })

  it("G10.2a a document without a `graphapi` field is GraphApi 0.1.2 for compareGraphApi", () => {
    const { graphapi: _, ...unmarked } = legacy
    expect(() => compareGraphApi(unmarked, sdl("type Query { a: String }"))).toThrow(
      `GraphApi 0.1.2 is not supported (the document has no \`graphapi\` field): ${conversion}`,
    )
    expect(() => apiCompare(unmarked, unmarked, { engine: "graphapi" })).toThrow(UnsupportedSpecError)
  })

  it("G10.2b detectSpec and apiCompare reject GraphApi 0.x and keep marker-less documents as JSON Schema", () => {
    expect(() => detectSpec(legacy)).toThrow(UnsupportedSpecError)
    expect(() => detectSpec(legacy)).toThrow(`GraphApi 0.1.2 is not supported: ${conversion}`)
    expect(() => detectSpec({ graphapi: 0.1 })).toThrow("GraphApi 0.1 is not supported")
    expect(() => apiCompare(legacy, legacy)).toThrow(`GraphApi 0.1.2 is not supported: ${conversion}`)
    expect(() => apiCompare(sdl("type Query { a: String }"), legacy)).toThrow(UnsupportedSpecError)
    expect(detectSpec(sdl("type Query { a: String }"))).toEqual({ engine: "graphapi", version: "1.0" })
    expect(detectSpec({ graphapi: 1 })).toEqual({ engine: "graphapi", version: "1" })
    expect(() => detectSpec({ graphapi: "2.0" })).toThrow("Unsupported GraphApi version: 2.0")
    // no (or a falsy) `graphapi` marker: not a GraphApi document, as in 2.0.0
    const { graphapi: _, ...unmarked } = legacy
    expect(detectSpec(unmarked)).toEqual({ engine: "jsonschema" })
    expect(detectSpec({ ...legacy, graphapi: "" })).toEqual({ engine: "jsonschema" })
  })

  it("G10.2c a YAML `graphapi: 1.0` (a number) is a GraphApi 1.0 document", () => {
    const before = { ...sdl("type Query { a: String }"), graphapi: 1 }
    const after = { ...sdl("type Query { a: String b: Int }"), graphapi: 1 }
    expect(apiCompare(before, after).diffs).toMatchObject([{ path: ["queries", "b"], type: nonBreaking }])
  })

  it("G10.3 identical schemas produce no diffs and merged equals the input", () => {
    const schema = `
      directive @x(v: String) on FIELD_DEFINITION
      scalar Date @specifiedBy(url: "http://a")
      interface N { id: ID! }
      type T implements N { id: ID! a: String @x(v: "1") d: [Date!] }
      union U = T
      enum E { A B @deprecated(reason: "y") }
      input I { a: String b: String! = "x" }
      type Query { q(a: Int = 1, i: I!, e: E): U @deprecated(reason: "x") }
    `
    const { diffs, merged } = compare(schema, schema)
    expect(diffs).toEqual([])
    expect(JSON.parse(JSON.stringify(merged))).toEqual(JSON.parse(JSON.stringify(sdl(schema))))
  })
})

describe("GraphApi 1.0: operations and output types", () => {
  it("G10.4 adding an operation is non-breaking, removing one is breaking", () => {
    expect(compare("type Query { a: String }", "type Query { a: String b: String }").diffs).toMatchObject([
      { path: ["queries", "b"], type: nonBreaking },
    ])
    expect(compare("type Query { a: String b: String }", "type Query { a: String }").diffs).toMatchObject([
      { path: ["queries", "b"], type: breaking },
    ])
  })

  it("G10.5 changing the result type (built-in kind or named type) is breaking", () => {
    expect(compare("type Query { a: String }", "type Query { a: Int }").diffs).toMatchObject([
      { path: ["queries", "a", "type"], type: breaking },
    ])
    const { diffs } = compare(
      "type Query { a: T } type T { x: String } type U { x: String }",
      "type Query { a: U } type T { x: String } type U { x: String }",
    )
    expect(byPath(diffs, "queries/a/$ref").type).toBe(breaking)
  })

  it("G10.6 result nullability: non-null is non-breaking, nullable is breaking", () => {
    expect(compare("type Query { a: String }", "type Query { a: String! }").diffs).toMatchObject([
      { path: ["queries", "a", "nonNull"], action: "add", type: nonBreaking },
    ])
    expect(compare("type Query { a: String! }", "type Query { a: String }").diffs).toMatchObject([
      { path: ["queries", "a", "nonNull"], action: "remove", type: breaking },
    ])
    expect(compare("type Query { a: [String!] }", "type Query { a: [String] }").diffs).toMatchObject([
      { path: ["queries", "a", "items", "nonNull"], type: breaking },
    ])
  })

  it("G10.7 description and deprecation of an operation", () => {
    expect(compare('type Query { "x" a: String }', 'type Query { "y" a: String }').diffs).toMatchObject([
      { path: ["queries", "a", "description"], type: annotation },
    ])
    const { diffs } = compare("type Query { a: String }", 'type Query { a: String @deprecated(reason: "x") }')
    expect(byPath(diffs, "queries/a/deprecation").type).toBe(deprecated)
    expect(diffs.every((d) => d.type !== unclassified)).toBe(true)
  })

  it("G10.8 object fields: adding is non-breaking, removing is breaking, type change is breaking", () => {
    const { diffs: added } = compare(
      "type Query { t: T } type T { a: String }",
      "type Query { t: T } type T { a: String b: String }",
    )
    expect(byPath(added, "components/objects/T/methods/b").type).toBe(nonBreaking)
    const { diffs: removed } = compare(
      "type Query { t: T } type T { a: String b: String }",
      "type Query { t: T } type T { a: String }",
    )
    expect(byPath(removed, "components/objects/T/methods/b").type).toBe(breaking)
    const { diffs: changed } = compare(
      "type Query { t: T } type T { a: String }",
      "type Query { t: T } type T { a: Int }",
    )
    expect(byPath(changed, "components/objects/T/methods/a/type").type).toBe(breaking)
  })

  // a type usage changing form (`type: String` -> `$ref`) is one type change of the field
  it("G10.9 a field changing to a custom scalar is a nominal type change", () => {
    const { diffs } = compare(
      "type Query { t: T } type T { a: String }",
      "scalar Date type Query { t: T } type T { a: Date }",
    )
    const fieldDiffs = diffs.filter((d) => pathOf(d).startsWith("components/objects/T/methods/a"))
    expect(fieldDiffs).toMatchObject([
      {
        path: ["components", "objects", "T", "methods", "a"],
        action: "replace",
        type: breaking,
        before: { type: "String" },
        after: { $ref: "#/components/scalars/Date" },
      },
    ])
  })

  // POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed: clients matching on the interface may get a new concrete type, so an
  // interface implemented by an existing type is risky on both sides (was an annotation)
  it("G10.10 interfaces and implementedBy of an existing type are risky", () => {
    const { diffs } = compare(
      "type Query { t: T } interface I { a: String } type T { a: String }",
      "type Query { t: T } interface I { a: String } type T implements I { a: String }",
    )
    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.every((d) => d.type === risky)).toBe(true)
  })

  it("G10.11 unions and output enums", () => {
    const types = "type A { a: String } type B { b: String }"
    expect(
      byPath(
        compare(`type Query { u: U } ${types} union U = A`, `type Query { u: U } ${types} union U = A | B`).diffs,
        "components/unions/U/oneOf/1",
      ).type,
      // POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed: a union member or output enum value added is risky (was breaking)
    ).toBe(risky)
    expect(
      byPath(
        compare("type Query { e: E } enum E { A B }", "type Query { e: E } enum E { A B C }").diffs,
        "components/enums/E/values/C",
      ).type,
    ).toBe(risky)
    expect(
      byPath(
        compare("type Query { e: E } enum E { A B C }", "type Query { e: E } enum E { A B }").diffs,
        "components/enums/E/values/C",
      ).type,
    ).toBe(nonBreaking)
  })
})

describe("GraphApi 1.0: arguments and input types", () => {
  // POLICY-05 decided (b), decision §11.14 (ISSUE-130 fixed): an argument added with a default is risky (operations that
  // omit it silently get the default; was non-breaking)
  it("G10.12 adding an argument: optional non-breaking, required breaking, with a default risky", () => {
    expect(
      compare("type Query { q(a: String): String }", "type Query { q(a: String, b: String): String }").diffs,
    ).toMatchObject([{ path: ["queries", "q", "args", "b"], type: nonBreaking, scope: "args" }])
    expect(
      compare("type Query { q(a: String): String }", "type Query { q(a: String, b: String!): String }").diffs,
    ).toMatchObject([{ path: ["queries", "q", "args", "b"], type: breaking }])
    expect(
      compare("type Query { q(a: String): String }", "type Query { q(a: String, b: Int! = 1): String }").diffs,
    ).toMatchObject([{ path: ["queries", "q", "args", "b"], type: risky }])
  })

  it("G10.13 removing an argument is breaking", () => {
    expect(
      compare("type Query { q(a: String, b: String): String }", "type Query { q(a: String): String }").diffs,
    ).toMatchObject([{ path: ["queries", "q", "args", "b"], type: breaking }])
  })

  it("G10.14 argument nullability and defaults", () => {
    expect(compare("type Query { q(a: String): String }", "type Query { q(a: String!): String }").diffs).toMatchObject([
      { path: ["queries", "q", "args", "a", "nonNull"], action: "add", type: breaking },
    ])
    expect(compare("type Query { q(a: String!): String }", "type Query { q(a: String): String }").diffs).toMatchObject([
      { path: ["queries", "q", "args", "a", "nonNull"], action: "remove", type: nonBreaking },
    ])
    expect(compare("type Query { q(a: Int!): String }", "type Query { q(a: Int! = 1): String }").diffs).toMatchObject([
      { path: ["queries", "q", "args", "a", "default"], action: "add", type: nonBreaking },
    ])
    expect(compare("type Query { q(a: Int! = 1): String }", "type Query { q(a: Int!): String }").diffs).toMatchObject([
      { path: ["queries", "q", "args", "a", "default"], action: "remove", type: breaking },
    ])
  })

  it("G10.15 changing an argument type is breaking", () => {
    expect(compare("type Query { q(a: String): String }", "type Query { q(a: Int): String }").diffs).toMatchObject([
      { path: ["queries", "q", "args", "a", "type"], type: breaking },
    ])
  })

  it("G10.16 input object fields follow argument semantics through usage", () => {
    const { diffs: required } = compare(
      "type Query { q(i: I): String } input I { a: String }",
      "type Query { q(i: I): String } input I { a: String b: String! }",
    )
    expect(byPath(required, "components/inputObjects/I/properties/b").type).toBe(breaking)
    const { diffs: optional } = compare(
      "type Query { q(i: I): String } input I { a: String }",
      "type Query { q(i: I): String } input I { a: String b: String }",
    )
    expect(byPath(optional, "components/inputObjects/I/properties/b").type).toBe(nonBreaking)
    const { diffs: removed } = compare(
      "type Query { q(i: I): String } input I { a: String b: String }",
      "type Query { q(i: I): String } input I { a: String }",
    )
    expect(byPath(removed, "components/inputObjects/I/properties/b").type).toBe(breaking)
  })

  it("G10.17 input-only enums follow argument semantics", () => {
    const { diffs: added } = compare(
      "type Query { q(e: E): String } enum E { A B }",
      "type Query { q(e: E): String } enum E { A B C }",
    )
    expect(byPath(added, "components/enums/E/values/C").type).toBe(nonBreaking)
    const { diffs: removed } = compare(
      "type Query { q(e: E): String } enum E { A B C }",
      "type Query { q(e: E): String } enum E { A B }",
    )
    expect(byPath(removed, "components/enums/E/values/C").type).toBe(breaking)
  })

  // the most severe usage wins: non-breaking as an input, risky as an output (POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed:
  // was breaking)
  it("G10.18 an enum used as input and output takes the most severe usage class", () => {
    const { diffs } = compare("type Query { q(e: E): E } enum E { A B }", "type Query { q(e: E): E } enum E { A B C }")
    expect(byPath(diffs, "components/enums/E/values/C").type).toBe(risky)
  })
})

describe("GraphApi 1.0: directives", () => {
  it("G10.19 directive definitions: add non-breaking, remove breaking, required argument breaking", () => {
    expect(
      compare("type Query { a: String }", "directive @x on FIELD_DEFINITION type Query { a: String }").diffs,
    ).toMatchObject([{ path: ["components", "directives", "x"], type: nonBreaking }])
    expect(
      compare("directive @x on FIELD_DEFINITION type Query { a: String }", "type Query { a: String }").diffs,
    ).toMatchObject([{ path: ["components", "directives", "x"], type: breaking }])
    const { diffs } = compare(
      "directive @x on FIELD_DEFINITION type Query { a: String }",
      "directive @x(v: String!) on FIELD_DEFINITION type Query { a: String }",
    )
    expect(byPath(diffs, "components/directives/x/args/v").type).toBe(breaking)
  })

  // ISSUE-120 (fixed), POLICY-20 decided (a): a directive location added is non-breaking; usages stay annotations
  it("G10.20 directive locations are classified, usages are annotations", () => {
    const { diffs: location } = compare(
      "directive @x on FIELD_DEFINITION type Query { a: String }",
      "directive @x on FIELD_DEFINITION | OBJECT type Query { a: String }",
    )
    expect(location).toMatchObject([{ type: nonBreaking }])
    const { diffs: usage } = compare(
      "directive @x on FIELD_DEFINITION type Query { a: String }",
      "directive @x on FIELD_DEFINITION type Query { a: String @x }",
    )
    expect(usage.every((d) => d.type === annotation)).toBe(true)
  })

  // ISSUE-26 (fixed): the 1.0 rule set has no templates of its own; descriptions come from the generated fallback (M5)
  it("G10.21 every 1.0 diff carries a description", () => {
    const { diffs } = compare(
      "type Query { q(a: String): T } type T { x: String }",
      'type Query { q(a: String, b: Int!): T @deprecated(reason: "r") } type T { x: Int y: String }',
    )
    expect(diffs.length).toBeGreaterThan(2)
    for (const diff of diffs) {
      expect(typeof diff.description).toBe("string")
      expect(diff.description).not.toBe("")
      expect(diff.description).not.toContain("undefined")
    }
  })
})

// gqlapi 0.6 / GraphApi 1.0 spec: a type usage is written flat on its usage site, so the GraphQL type of a field,
// argument or list item spans the sibling keys `$ref`, `type` and `items`
describe("GraphApi 1.0: flat type usages", () => {
  const fieldDiffs = (diffs: Diff[], prefix: string) => diffs.filter((d) => pathOf(d).startsWith(prefix))

  it("G10.22 a type usage changing form is one breaking type change of the usage site", () => {
    for (const [from, to, before, after] of [
      ["String", "[String]", { type: "String" }, { type: "list", items: { type: "String" } }],
      ["[String]", "String", { type: "list", items: { type: "String" } }, { type: "String" }],
      ["T", "String", { $ref: "#/components/objects/T" }, { type: "String" }],
    ] as const) {
      const { diffs } = compare(
        `type Query { a: ${from} t: T } type T { x: String }`,
        `type Query { a: ${to} t: T } type T { x: String }`,
      )
      expect(diffs).toMatchObject([{ path: ["queries", "a"], action: "replace", type: breaking, before, after }])
      expect(diffs[0].description).toBe(`[Replaced] type of field \`Query.a\` from \`${from}\` to \`${to}\``)
    }
  })

  it("G10.23 the item type of a list changing form is one change of the list items", () => {
    const { diffs } = compare("scalar Date type Query { a: [String!] }", "scalar Date type Query { a: [Date!] }")
    expect(fieldDiffs(diffs, "queries")).toMatchObject([
      { path: ["queries", "a", "items"], action: "replace", type: breaking },
    ])
  })

  it("G10.24 the usage site's own fields are compared next to a type change", () => {
    const { diffs } = compare(
      "type Query { q(a: String): String }",
      'scalar Date type Query { q("d" a: Date! = "x"): String }',
    )
    const arg = fieldDiffs(diffs, "queries/q/args/a")
    expect(arg.map(pathOf).sort()).toEqual([
      "queries/q/args/a",
      "queries/q/args/a/default",
      "queries/q/args/a/description",
      "queries/q/args/a/nonNull",
    ])
    expect(byPath(arg, "queries/q/args/a").type).toBe(breaking)
    expect(arg.every((d) => d.type !== unclassified && d.description)).toBe(true)
  })

  it("G10.25 the merged document keeps the after usage site with the type change metadata", () => {
    const after = sdl('scalar Date type Query { "d" a: Date! }')
    const { merged } = compareGraphApi(sdl("type Query { a: String }"), after, { metaKey })
    const a = (merged as any).queries.a
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(after.queries?.a)))
    expect(a[metaKey]).toMatchObject({ description: { action: "add" }, nonNull: { action: "add" } })
    expect((merged as any).queries[metaKey]).toMatchObject({ a: { action: "replace", type: breaking } })
  })

  it("G10.26 a usage site with the same form compares the reference only", () => {
    expect(compare("type Query { a: [String] }", "type Query { a: [Int] }").diffs).toMatchObject([
      { path: ["queries", "a", "items", "type"], action: "replace", type: breaking },
    ])
  })
})

describe("GraphApi 1.0: directive usages and built-in definitions", () => {
  it("G10.27 a directive usage is `{ $ref, meta }`: an argument changed is one change of that usage", () => {
    const { diffs } = compare(
      'directive @tag(name: String) repeatable on FIELD_DEFINITION type Query { a: String @tag(name: "x") }',
      'directive @tag(name: String) repeatable on FIELD_DEFINITION type Query { a: String @tag(name: "y") }',
    )
    expect(diffs).toMatchObject([{ path: ["queries", "a", "directives", 0, "meta", "name"], type: annotation }])
    expect(diffs[0].description).toMatch(/@tag/)
  })

  it("G10.28 a deprecation is reported once, by `deprecation`, not by its `@deprecated` usage", () => {
    const { diffs } = compare("type Query { a: String }", 'type Query { a: String @deprecated(reason: "x") }')
    expect(diffs.filter((d) => pathOf(d).startsWith("queries"))).toMatchObject([
      { path: ["queries", "a", "deprecation"], action: "add", type: deprecated },
    ])
  })

  it("G10.29 the built-in `@deprecated` definition with or without DIRECTIVE_DEFINITION is the same definition", () => {
    const before = sdl('type Query { a: String @deprecated(reason: "x") }')
    const after = structuredClone(before)
    const definition = (after.components?.directives as any).deprecated
    definition.locations = definition.locations.includes("DIRECTIVE_DEFINITION")
      ? definition.locations.filter((l: string) => l !== "DIRECTIVE_DEFINITION")
      : [...definition.locations, "DIRECTIVE_DEFINITION"]
    definition.description = "another graphql-js wording"
    expect(compareGraphApi(before, after, { metaKey }).diffs).toEqual([])
  })
})

describe("GraphApi 1.0: root operation type names", () => {
  it("G10.30 the name of a new or removed root type is named as written, not as a rename of the default name", () => {
    const without = "type Query { a: String }"
    const withMutation = "schema { query: Query mutation: M } type Query { a: String } type M { m: String }"
    expect(byPath(compare(without, withMutation).diffs, "mutationTypeName")).toMatchObject({
      type: annotation,
      description: "[Added] mutation root type name `M`",
    })
    expect(byPath(compare(withMutation, without).diffs, "mutationTypeName")).toMatchObject({
      type: annotation,
      description: "[Removed] mutation root type name `M`",
    })
    expect(byPath(compare(without, "schema { query: Q } type Q { a: String }").diffs, "queryTypeName")).toMatchObject({
      type: breaking,
      description: "[Replaced] query root type name from `Query` to `Q`",
    })
  })
})
