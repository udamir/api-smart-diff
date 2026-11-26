import { breaking, compareJsonSchema, jsonSchemaRules, nonBreaking, unclassified } from "../../src"

const metaKey = Symbol("diff")
const s = { type: "string" }
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

describe("Block B5 — schema normalization before comparison", () => {
  it("B5.1 const and a single-value enum are equivalent", () => {
    expect(
      compareJsonSchema({ type: "string", const: "a" }, { type: "string", enum: ["a"] }, { metaKey }).diffs,
    ).toEqual([])
  })

  it("B5.2 const -> enum with additional values is a single non-breaking addition", () => {
    const { diffs } = compareJsonSchema(
      { type: "string", const: "a" },
      { type: "string", enum: ["a", "b"] },
      { metaKey },
    )
    expect(diffs).toMatchObject([{ action: "add", path: ["enum", 1], type: nonBreaking }])
  })

  it("B5.3 example and examples are equivalent", () => {
    expect(
      compareJsonSchema({ type: "string", example: "x" }, { type: "string", examples: ["x"] }, { metaKey }).diffs,
    ).toEqual([])
  })

  it("B5.4 draft-04 boolean exclusiveMaximum is equivalent to a numeric exclusiveMaximum", () => {
    const d4 = { type: "number", maximum: 10, exclusiveMaximum: true }
    const d6 = { type: "number", exclusiveMaximum: 10 }
    expect(compareJsonSchema(d4, d6, { metaKey }).diffs).toEqual([])
    expect(compareJsonSchema(d6, d4, { metaKey }).diffs).toEqual([])
  })

  it("B5.5 duplicate entries in required and enum are ignored", () => {
    const a = { type: "object", properties: { a: s }, required: ["a", "a"] }
    const b = { type: "object", properties: { a: s }, required: ["a"] }
    expect(compareJsonSchema(a, b, { metaKey }).diffs).toEqual([])
    expect(compareJsonSchema({ enum: [1, 1, 2] }, { enum: [2, 1] }, { metaKey }).diffs).toEqual([])
  })

  it("B5.6 non-string entries in required are ignored", () => {
    const a = { type: "object", properties: { a: s }, required: ["a", 1, null] }
    const b = { type: "object", properties: { a: s }, required: ["a"] }
    expect(compareJsonSchema(a, b, { metaKey }).diffs).toEqual([])
  })

  it("B5.7 an items schema compared against a tuple is normalized and classified", () => {
    const list = { type: "array", items: s }
    const tuple = { type: "array", items: [s] }
    const { diffs } = compareJsonSchema(list, tuple, { metaKey })

    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.every((d) => d.type !== unclassified)).toBe(true)
  })

  // ISSUE-136 (fixed): POLICY-21 decided (b): the type is not inferred from validators, so a type-less schema compared
  // with a typed one reports the added `type` (breaking in request semantics)
  it("B5.8 a type-less schema compared with a typed one reports the added type", () => {
    expect(compareJsonSchema({ minimum: 1 }, { type: "number", minimum: 1 }, { metaKey }).diffs).toMatchObject([
      { path: ["type"], action: "add", type: breaking },
    ])
    expect(compareJsonSchema({ items: s }, { type: "array", items: s }, { metaKey }).diffs).toMatchObject([
      { path: ["type"], action: "add", type: breaking },
    ])
  })

  describe("merged output faithfulness", () => {
    // ISSUE-20 (fixed): normalization performed for comparison purposes leaks into the merged document, so an unchanged
    // document is returned in a different (sometimes draft-incompatible) shape.
    it("B5.9 merged equals the input for an unchanged draft-04 style schema", () => {
      const doc = { type: "number", maximum: 10, exclusiveMaximum: true }
      const { diffs, merged } = compareJsonSchema(doc, clone(doc), { metaKey })

      expect(diffs).toEqual([])
      expect(merged).toEqual(doc)
    })

    it("B5.10 merged keeps the original required list for an unchanged schema", () => {
      const doc = { type: "object", properties: { a: s }, required: ["a", "a"] }
      const { merged } = compareJsonSchema(doc, clone(doc), { metaKey })
      expect(merged.required).toEqual(["a", "a"])
    })

    it("B5.11 merged contains no synthetic empty containers for unchanged schemas", () => {
      const doc = { type: "object", properties: { a: s } }
      const { merged } = compareJsonSchema(doc, clone(doc), { metaKey })
      expect(merged).toEqual(doc)
    })
  })
})

describe("Block B8 — robustness against unusual but valid input", () => {
  it("B8.1 boolean schemas are compared without throwing", () => {
    expect(compareJsonSchema(true, true, { metaKey }).diffs).toEqual([])
    expect(compareJsonSchema(true, false, { metaKey }).diffs).toMatchObject([
      { action: "replace", before: true, after: false },
    ])
    expect(compareJsonSchema({}, true, { metaKey }).diffs).toMatchObject([{ action: "replace" }])
  })

  it("B8.2 null keyword values are compared as values", () => {
    const { diffs } = compareJsonSchema(
      { type: "string", default: null },
      { type: "string", default: "x" },
      { metaKey },
    )
    expect(diffs).toMatchObject([{ path: ["default"], action: "replace", type: breaking }])
    expect(compareJsonSchema({ enum: [null] }, { enum: [null] }, { metaKey }).diffs).toEqual([])
  })

  it("B8.3 property names equal to schema keywords do not confuse rule resolution", () => {
    const mk = (leaf: unknown) => ({
      type: "object",
      properties: { type: leaf, properties: s, $ref: s, required: s, items: s },
    })
    const { diffs } = compareJsonSchema(mk(s), mk({ type: "number" }), { metaKey })

    expect(diffs).toMatchObject([{ path: ["properties", "type", "type"], type: breaking }])
    expect(diffs[0].description).toBe("[Replaced] type definition of `type` from `string` to `number`")
  })

  it("B8.4 equal object enum values yield no diffs", () => {
    expect(compareJsonSchema({ enum: [{ a: 1 }] }, { enum: [{ a: 1 }] }, { metaKey }).diffs).toEqual([])
  })

  // ISSUE-42 (fixed): enum items are compared structurally, so a changed *object* enum value produces diffs below `/enum/*`
  // where no rule exists -> unclassified, instead of one breaking "possible value replaced" diff.
  it("B8.5 a changed object enum value is a classified change", () => {
    const { diffs } = compareJsonSchema({ enum: [{ a: 1 }] }, { enum: [{ a: 2 }] }, { metaKey })
    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.every((d) => d.type === breaking)).toBe(true)
  })

  // ISSUE-43 (fixed): `requiredItemClassifyRule` navigates `properties.<name>.default` through `getParentContext`, which throws
  // when `properties` is absent; the error is swallowed and the diff degrades to unclassified (with a console.error).
  it("B8.6 required without properties is still classified", () => {
    const { diffs } = compareJsonSchema({ type: "object" }, { type: "object", required: ["a"] }, { metaKey })
    expect(diffs).toMatchObject([{ path: ["required", 0], action: "add", type: breaking }])
  })

  it("B8.7 boolean-valued applicators (items: false, additionalProperties: {}) do not throw", () => {
    const before = { type: "array", items: s, additionalProperties: {} }
    const after = { type: "array", items: false, additionalProperties: {} }
    expect(() => compareJsonSchema(before, after, { metaKey })).not.toThrow()
  })

  it("B8.8 a very deep schema is compared and the leaf path is complete", () => {
    const deep = (depth: number, leaf: unknown): any =>
      depth === 0 ? leaf : { type: "object", properties: { c: deep(depth - 1, leaf) } }
    const started = performance.now()
    const { diffs } = compareJsonSchema(deep(150, s), deep(150, { type: "number" }), { metaKey })

    expect(performance.now() - started).toBeLessThan(2000)
    expect(diffs).toHaveLength(1)
    expect(diffs[0].path).toHaveLength(150 * 2 + 1)
  })

  it("B8.9 undefined values inside objects are tolerated", () => {
    expect(() => compareJsonSchema({ type: "string", title: undefined }, { type: "string" }, { metaKey })).not.toThrow()
  })

  it("B8.10 arrays of schemas at the root are compared element-wise", () => {
    const { diffs } = compareJsonSchema([s, s], [s, { type: "number" }], { metaKey })
    expect(diffs).toMatchObject([{ path: [1, "type"], action: "replace" }])
  })
})

describe("Block B8 — boolean and unsatisfiable schemas (allof-merge 1.0)", () => {
  const metaKey = Symbol("diff")
  const responseRules = { ...jsonSchemaRules(), scope: "response" }

  it("B8.11 a property whose allOf becomes contradictory is forbidden: breaking in a request, non-breaking in a response", () => {
    const before = { type: "object", properties: { a: { type: "string" } } }
    const after = { type: "object", properties: { a: { allOf: [{ type: "string" }, { type: "number" }] } } }

    const request = compareJsonSchema(before, after, { metaKey })
    expect(request.diffs).toMatchObject([
      { path: ["properties", "a"], action: "replace", after: false, type: breaking },
    ])
    // 2.0.2: merged holds the compared value of a changed node, the merged allOf (here the contradiction `false`)
    expect(request.merged.properties.a).toBe(false)

    const response = compareJsonSchema(before, after, { metaKey, rules: responseRules })
    expect(response.diffs).toMatchObject([{ path: ["properties", "a"], type: nonBreaking }])
  })

  it("B8.12 boolean schema transitions are classified by permissiveness", () => {
    const obj = (a: unknown) => ({ type: "object", properties: { a } })
    expect(compareJsonSchema(obj(true), obj(false), { metaKey }).diffs).toMatchObject([{ type: breaking }])
    expect(compareJsonSchema(obj(false), obj(true), { metaKey }).diffs).toMatchObject([{ type: nonBreaking }])
    expect(compareJsonSchema(obj({}), obj(false), { metaKey }).diffs).toMatchObject([{ type: breaking }])
    expect(compareJsonSchema(obj({ type: "string" }), obj(true), { metaKey }).diffs).toMatchObject([
      { type: nonBreaking },
    ])
    expect(compareJsonSchema(obj(true), obj({ type: "string" }), { metaKey }).diffs).toMatchObject([{ type: breaking }])
  })
})
