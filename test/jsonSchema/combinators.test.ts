import {
  annotation,
  apiCompare,
  breaking,
  compareJsonSchema,
  jsonSchemaRules,
  nonBreaking,
  unclassified,
} from "../../src"

const metaKey = Symbol("diff")
const s = { type: "string" }
const n = { type: "number" }
const b = { type: "boolean" }

describe("Block B3 — combinators (oneOf / anyOf / allOf / not)", () => {
  it("B3.1 adding a oneOf branch is non-breaking, removing one is breaking", () => {
    const added = compareJsonSchema({ oneOf: [s] }, { oneOf: [s, n] }, { metaKey })
    expect(added.diffs).toMatchObject([{ action: "add", path: ["oneOf", 1], type: nonBreaking }])

    const removed = compareJsonSchema({ oneOf: [s, n] }, { oneOf: [s] }, { metaKey })
    expect(removed.diffs).toMatchObject([{ action: "remove", type: breaking }])
    expect(removed.merged.oneOf).toHaveLength(2)
  })

  it("B3.2 reordering branches without content change yields no diffs", () => {
    expect(compareJsonSchema({ anyOf: [s, n, b] }, { anyOf: [b, s, n] }, { metaKey }).diffs).toEqual([])
  })

  it("B3.3 a change inside a branch is matched to the closest branch and classified normally", () => {
    const before = {
      oneOf: [
        { type: "object", properties: { a: s } },
        { type: "object", properties: { x: s } },
      ],
    }
    const after = {
      oneOf: [
        { type: "object", properties: { x: s } },
        { type: "object", properties: { a: n } },
      ],
    }
    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    // decision §11.2 (ISSUE-211 fixed, P5): the diff is reported at the matched branch's merged (after) index 1, where
    // its merge meta is (the path used the before index 0 before P5)
    expect(diffs).toMatchObject([{ action: "replace", path: ["oneOf", 1, "properties", "a", "type"], type: breaking }])
    expect(merged.oneOf[1].properties.a.type).toBe("number")
  })

  it("B3.4 wrapping a plain schema into a oneOf is reported as an added branch", () => {
    const { diffs } = compareJsonSchema(s, { oneOf: [s, n] }, { metaKey })
    expect(diffs).toMatchObject([{ action: "add", path: ["oneOf", 1], type: nonBreaking }])
  })

  it("B3.5 unwrapping a single-branch oneOf back to a plain schema yields no diffs", () => {
    expect(compareJsonSchema({ oneOf: [s] }, s, { metaKey }).diffs).toEqual([])
  })

  // ISSUE-37 (fixed): `jsonSchemaMappingResolver` deliberately maps oneOf <-> anyOf as a rename, but the rename is then
  // classified by the `/**` fallback rule and comes out `unclassified`.
  it("B3.6 oneOf -> anyOf is a classified rename", () => {
    const { diffs } = compareJsonSchema({ oneOf: [s, n] }, { anyOf: [s, n] }, { metaKey })
    expect(diffs).toHaveLength(1)
    expect(diffs[0]).toMatchObject({ action: "rename", before: "oneOf", after: "anyOf" })
    expect(diffs[0].type).not.toBe(unclassified)
  })

  // ISSUE-31 (fixed): keywords placed next to oneOf/anyOf are pushed into every branch (as an allOf), so a single change to a
  // sibling keyword is reported once per branch.
  it("B3.7 a sibling keyword next to oneOf is reported once", () => {
    const { diffs } = compareJsonSchema(
      { oneOf: [s, n], description: "a" },
      { oneOf: [s, n], description: "b" },
      { metaKey },
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(annotation)
  })

  it("B3.8 allOf is merged before comparison, so an equivalent flattened schema yields no diffs", () => {
    const composed = {
      allOf: [
        { type: "object", properties: { a: s } },
        { properties: { b: n }, required: ["b"] },
      ],
    }
    const flat = { type: "object", properties: { a: s, b: n }, required: ["b"] }
    expect(compareJsonSchema(composed, flat, { metaKey }).diffs).toEqual([])
  })

  it("B3.9 notMergeAllOf keeps allOf branches and compares them structurally", () => {
    const before = { allOf: [{ type: "object", properties: { a: s } }] }
    const after = { allOf: [{ type: "object", properties: { a: n } }] }
    const { diffs } = compareJsonSchema(before, after, { metaKey, rules: jsonSchemaRules({ notMergeAllOf: true }) })
    expect(diffs).toMatchObject([{ path: ["allOf", 0, "properties", "a", "type"], type: breaking }])
  })

  it("B3.10 changes inside `not` are classified with inverted semantics", () => {
    // forbidding more (not: maximum 10 -> maximum 20 forbids a larger range) is breaking
    const { diffs } = compareJsonSchema(
      { not: { type: "number", maximum: 10 } },
      { not: { type: "number", maximum: 20 } },
      { metaKey },
    )
    expect(diffs).toMatchObject([{ path: ["not", "maximum"], type: breaking }])
  })

  it("B3.11 nested combinators inside properties keep full paths", () => {
    const before = { type: "object", properties: { v: { oneOf: [s, n] } } }
    const after = { type: "object", properties: { v: { oneOf: [s, n, b] } } }
    const { diffs } = compareJsonSchema(before, after, { metaKey })
    expect(diffs).toMatchObject([{ action: "add", path: ["properties", "v", "oneOf", 2], type: nonBreaking }])
  })

  it("B3.12 combinator branches that are $refs are matched by resolved content", () => {
    const mk = (branches: string[]) => ({
      oneOf: branches.map((name) => ({ $ref: `#/$defs/${name}` })),
      $defs: { A: s, B: n, C: b },
    })
    const { diffs } = compareJsonSchema(mk(["A", "B"]), mk(["B", "A", "C"]), { metaKey })
    expect(diffs.filter((d) => d.path[0] === "oneOf")).toMatchObject([
      { action: "add", path: ["oneOf", 2], type: nonBreaking },
    ])
  })

  it("B3.13 an empty combinator array is handled", () => {
    expect(compareJsonSchema({ oneOf: [] }, { oneOf: [] }, { metaKey }).diffs).toEqual([])
    expect(compareJsonSchema({ oneOf: [] }, { oneOf: [s] }, { metaKey }).diffs).toMatchObject([
      { action: "add", type: nonBreaking },
    ])
  })

  it("B3.14 merged output of a combinator keeps array meta on the parent by default", () => {
    const { merged } = compareJsonSchema({ oneOf: [s] }, { oneOf: [s, n] }, { metaKey })
    expect(merged[metaKey]).toEqual({ oneOf: { array: { 1: { action: "add", type: nonBreaking } } } })
  })

  // ISSUE-93 (fixed): the `not` node is classified in the enclosing direction, only its subtree is inverted
  it("B3.15 adding `not` narrows the schema: breaking in a request, non-breaking in a response", () => {
    expect(compareJsonSchema(s, { ...s, not: { const: "" } }, { metaKey }).diffs).toMatchObject([
      { path: ["not"], action: "add", type: breaking },
    ])
    expect(compareJsonSchema({ ...s, not: { const: "" } }, s, { metaKey }).diffs).toMatchObject([
      { path: ["not"], action: "remove", type: nonBreaking },
    ])
  })

  // ISSUE-93 (fixed): inside a component the subtree of `not` takes the opposite of the component's usage scopes
  it("B3.16 `not` inside a component schema is classified against the opposite of its usages", () => {
    const doc = (schema: unknown, response: boolean) => {
      const content = { "application/json": { schema: { $ref: "#/components/schemas/S" } } }
      return {
        openapi: "3.1.0",
        info: { title: "t", version: "1" },
        paths: {
          "/a": response
            ? { get: { responses: { 200: { description: "ok", content } } } }
            : { post: { requestBody: { content }, responses: { 200: { description: "ok" } } } },
        },
        components: { schemas: { S: schema } },
      }
    }
    for (const response of [false, true]) {
      const type = response ? nonBreaking : breaking
      const { diffs } = apiCompare(
        doc({ ...s, not: { maxLength: 5 } }, response),
        doc({ ...s, not: { maxLength: 10 } }, response),
        {
          metaKey,
        },
      )
      expect(diffs.map((d) => [d.path[0], d.type, d.scope])).toEqual([
        ["paths", type, response ? "request" : "response"],
        ["components", type, "components"],
      ])
    }
  })
})
