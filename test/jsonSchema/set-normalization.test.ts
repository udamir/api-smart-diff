import { annotation, breaking, compareJsonSchema, nonBreaking } from "../../src"
import { effectiveMaxCount, equivalentBySetRewrite, isSubschema, isUnsatisfiable } from "../../src/jsonSchema"

// ISSUE-153 (fixed) (P5b): set-level normalization of JSON Schema — effective array / object bounds, containment,
// branch partitions and negation algebra. An equivalent rewrite is one annotation of the schema node; a rewrite that is
// not provably equivalent keeps its keyword diffs.

const metaKey = Symbol("diff")
const arr = (extra: Record<string, unknown> = {}) => ({ type: "array", ...extra })
const obj = (extra: Record<string, unknown> = {}) => ({ type: "object", ...extra })
const num = { type: "number" }
const int = { type: "integer" }
const str = { type: "string" }

const types = (before: unknown, after: unknown) =>
  compareJsonSchema(before, after, { metaKey }).diffs.map((d) => d.type)

// an equivalent rewrite: exactly one annotation diff at the given path, in both directions of the comparison
const expectEquivalent = (before: unknown, after: unknown, path: (string | number)[] = []) => {
  for (const [b, a] of [
    [before, after],
    [after, before],
  ]) {
    const { diffs } = compareJsonSchema(b, a, { metaKey })
    expect(diffs).toMatchObject([{ action: "replace", path, type: annotation }])
    expect(diffs[0].description).toMatch(/equivalent/)
  }
}

describe("Block B9 — set-level normalization (ISSUE-153)", () => {
  it("B9.1 effective item and property counts: maxItems 0 ≡ items false, additionalProperties false ≡ maxProperties 0", () => {
    expectEquivalent(arr({ maxItems: 0 }), arr({ items: false }))
    expectEquivalent(arr({ maxItems: 2, prefixItems: [str, num] }), arr({ prefixItems: [str, num], items: false }))
    expectEquivalent(obj({ additionalProperties: false }), obj({ maxProperties: 0 }))
    expect(effectiveMaxCount(arr({ items: false, prefixItems: [str] }), "array")).toBe(1)
    expect(effectiveMaxCount(obj({ additionalProperties: false, properties: { a: str } }), "object")).toBe(
      Number.POSITIVE_INFINITY,
    )
  })

  it("B9.2 not equivalent: a closed object with a declared property vs maxProperties 0, a tuple vs maxItems", () => {
    expect(
      equivalentBySetRewrite(obj({ properties: { a: str }, additionalProperties: false }), obj({ maxProperties: 0 })),
    ).toBe(false)
    expect(equivalentBySetRewrite(arr({ maxItems: 1 }), arr({ prefixItems: [str], items: false }))).toBe(false)
  })

  it("B9.3 two unsatisfiable schemas are equivalent", () => {
    expectEquivalent(
      obj({ properties: { name: false }, required: ["name"] }),
      obj({ properties: { a: obj({ properties: { b: false }, required: ["b"] }) }, required: ["a"] }),
    )
  })

  it("B9.4 branch partitions: count ranges whose union is one range, a type and its complement", () => {
    expectEquivalent({ anyOf: [arr({ minItems: 3 }), arr({ maxItems: 2 })] }, { type: ["array"] })
    expectEquivalent(
      { oneOf: [arr({ items: num, maxItems: 1 }), arr({ items: num, minItems: 2 })] },
      arr({ items: num }),
    )
    expectEquivalent({ anyOf: [{ type: "number", not: int }, int] }, num)
    // a gap (2 items), overlapping oneOf ranges, a oneOf over every type (non-arrays match both branches)
    expect(equivalentBySetRewrite({ anyOf: [arr({ minItems: 3 }), arr({ maxItems: 1 })] }, arr())).toBe(false)
    expect(equivalentBySetRewrite({ oneOf: [arr({ maxItems: 2 }), arr({ minItems: 2 })] }, arr())).toBe(false)
    expect(equivalentBySetRewrite({ oneOf: [{ maxItems: 1 }, { minItems: 2 }] }, {})).toBe(false)
  })

  it("B9.5 negations: a type list as a negated type, double negation, De Morgan", () => {
    expectEquivalent({ type: ["array", "boolean", "integer", "null", "number", "object"] }, { not: str })
    expectEquivalent(int, { type: "number", not: { not: int } })
    const a = arr({ items: str })
    const b = arr({ items: num })
    expectEquivalent({ not: { allOf: [a, b] } }, { anyOf: [{ not: a }, { not: b }] })
    // `integer` has no complement as a type list; `not` of a schema with siblings is not rewritten
    expect(equivalentBySetRewrite({ not: int }, { type: ["array", "boolean", "null", "object", "string"] })).toBe(false)
  })

  it("B9.6 keywords that depend on their siblings are never merged across a negation", () => {
    const before = obj({ properties: { a: str }, not: { not: { additionalProperties: false } } })
    const after = obj({ properties: { a: str }, additionalProperties: false })
    expect(equivalentBySetRewrite(before, after)).toBe(false)
  })

  it("B9.7 spellings the keyword-level comparison handles keep its result (reordered branches: no diff)", () => {
    expect(compareJsonSchema({ anyOf: [str, num] }, { anyOf: [num, str] }, { metaKey }).diffs).toEqual([])
    expect(equivalentBySetRewrite({ anyOf: [str, num] }, { anyOf: [num, str] })).toBe(false)
  })

  it("B9.8 an equivalent rewrite inside a property is reported at the property", () => {
    const { diffs } = compareJsonSchema(
      obj({ properties: { tags: arr({ maxItems: 0 }), name: str } }),
      obj({ properties: { tags: arr({ items: false }), name: str } }),
      { metaKey },
    )
    expect(diffs).toMatchObject([{ action: "replace", path: ["properties", "tags"], type: annotation }])
    expect(diffs[0].description).toContain("property `tags` with an equivalent schema")
  })

  it("B9.9 containment: types, ranges, items, properties, an anyOf branch", () => {
    expect(isSubschema(int, num)).toBe(true)
    expect(isSubschema(num, int)).toBe(false)
    expect(isSubschema(arr({ items: num }), arr({ items: { type: ["string", "number"] } }))).toBe(true)
    expect(isSubschema(arr({ minItems: 3 }), arr({ minItems: 2 }))).toBe(true)
    expect(isSubschema(arr({ minItems: 1 }), arr({ minItems: 2 }))).toBe(false)
    expect(isSubschema(obj({ properties: { a: int }, required: ["a"] }), obj({ properties: { a: num } }))).toBe(true)
    expect(isSubschema(obj({ properties: { a: num } }), obj({ properties: { a: num }, required: ["a"] }))).toBe(false)
    expect(isSubschema(str, { anyOf: [num, { type: "string" }] })).toBe(true)
    expect(isSubschema({ ...str, nullable: true }, str)).toBe(false)
  })

  it("B9.10 a schema contained in its own negation accepts nothing", () => {
    const additional = { additionalProperties: str }
    expect(isUnsatisfiable(obj({ ...additional, not: { anyOf: [additional, { additionalProperties: num }] } }))).toBe(
      true,
    )
    expect(isUnsatisfiable(obj({ ...additional, not: { additionalProperties: num } }))).toBe(false)
    const { diffs } = compareJsonSchema(obj({ ...additional, not: additional }), false, { metaKey })
    expect(diffs).toMatchObject([{ action: "replace", path: [], type: annotation }])
  })

  it("B9.11 a removed branch contained in a remaining one is non-breaking in a request", () => {
    const mixed = arr({ items: { type: ["string", "number"] } })
    expect(types({ anyOf: [arr({ items: num }), mixed, str] }, { anyOf: [mixed] }).sort()).toEqual([
      breaking,
      nonBreaking,
    ])
    // a branch subsumed by another is an equivalent rewrite of the whole anyOf
    expect(types({ anyOf: [int, num, str] }, { anyOf: [num, str] })).toEqual([annotation])
    expect(types({ oneOf: [arr({ items: num }), arr()] }, { oneOf: [arr()] })).toEqual([nonBreaking])
    // not contained: the removal rejects values
    expect(types({ anyOf: [str, num] }, { anyOf: [str] })).toEqual([breaking])
  })

  it("B9.12 maxItems added where items false allowed fewer items is non-breaking in a request", () => {
    expect(types(arr({ items: false }), arr({ maxItems: 3 }))).toEqual([nonBreaking, nonBreaking])
    expect(types(arr(), arr({ maxItems: 3 }))).toEqual([breaking])
  })
})
