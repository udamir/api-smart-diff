import {
  type Diff,
  type DiffType,
  annotation,
  breaking,
  compareJsonSchema,
  deprecated,
  jsonSchemaRules,
  nonBreaking,
  reverseClassifyRuleTransformer,
  risky,
  transformCompareRules,
  unclassified,
} from "../../src"

const metaKey = Symbol("diff")
const responseRules = transformCompareRules(jsonSchemaRules(), reverseClassifyRuleTransformer)

const diffsOf = (before: unknown, after: unknown, response = false) =>
  compareJsonSchema(before, after, { metaKey, ...(response ? { rules: responseRules } : {}) }).diffs

/** asserts exactly one diff and returns it */
const one = (before: unknown, after: unknown, response = false): Diff => {
  const diffs = diffsOf(before, after, response)
  expect(diffs).toHaveLength(1)
  return diffs[0]
}

const expectType = (before: unknown, after: unknown, type: DiffType, response = false) => {
  expect(one(before, after, response).type).toBe(type)
}

describe("Block B1 — JSON Schema keyword classification (request semantics)", () => {
  describe("numeric validators", () => {
    const num = (extra = {}) => ({ type: "number", ...extra })

    it("B1.1 maximum: add/tighten are breaking, remove/loosen are non-breaking", () => {
      expectType(num(), num({ maximum: 10 }), breaking)
      expectType(num({ maximum: 10 }), num(), nonBreaking)
      expectType(num({ maximum: 10 }), num({ maximum: 5 }), breaking)
      expectType(num({ maximum: 10 }), num({ maximum: 20 }), nonBreaking)
    })

    it("B1.2 minimum: add/tighten are breaking, remove/loosen are non-breaking", () => {
      expectType(num(), num({ minimum: 1 }), breaking)
      expectType(num({ minimum: 1 }), num(), nonBreaking)
      expectType(num({ minimum: 1 }), num({ minimum: 5 }), breaking)
      expectType(num({ minimum: 5 }), num({ minimum: 1 }), nonBreaking)
    })

    // ISSUE-33 (fixed): `jsonSchemaRules()` defaults to draft-04 so numeric exclusiveMinimum/Maximum (draft-06+) are classified
    // with the *boolean* classifier: any replace with a truthy after value is breaking, even when the bound is loosened.
    it("B1.3 numeric exclusiveMaximum/exclusiveMinimum are classified like maximum/minimum", () => {
      expectType(num({ exclusiveMaximum: 5 }), num({ exclusiveMaximum: 10 }), nonBreaking)
      expectType(num({ exclusiveMinimum: 5 }), num({ exclusiveMinimum: 1 }), nonBreaking)
    })

    it("B1.4 numeric exclusive bounds: add is breaking, tighten is breaking", () => {
      expectType(num(), num({ exclusiveMaximum: 5 }), breaking)
      expectType(num({ exclusiveMaximum: 10 }), num({ exclusiveMaximum: 5 }), breaking)
    })

    it("B1.5 multipleOf: add is breaking, remove non-breaking, divisor change depends on divisibility", () => {
      expectType(num(), num({ multipleOf: 2 }), breaking)
      expectType(num({ multipleOf: 2 }), num(), nonBreaking)
      expectType(num({ multipleOf: 2 }), num({ multipleOf: 4 }), breaking)
      expectType(num({ multipleOf: 4 }), num({ multipleOf: 2 }), nonBreaking)
      expectType(num({ multipleOf: 2 }), num({ multipleOf: 3 }), breaking)
    })

    // ISSUE-133 (fixed): POLICY-10 decided (a): a keyword without effect (maximum on a string) is an annotation
    it("B1.6 numeric validators on a non-numeric schema are annotations", () => {
      expectType({ type: "string" }, { type: "string", maximum: 3 }, annotation)
    })

    it("B1.7 integer schemas accept numeric validators", () => {
      expectType({ type: "integer" }, { type: "integer", maximum: 3 }, breaking)
    })
  })

  describe("string validators", () => {
    const str = (extra = {}) => ({ type: "string", ...extra })

    it("B1.8 maxLength / minLength", () => {
      expectType(str(), str({ maxLength: 10 }), breaking)
      expectType(str({ maxLength: 10 }), str(), nonBreaking)
      expectType(str({ maxLength: 10 }), str({ maxLength: 5 }), breaking)
      expectType(str({ maxLength: 5 }), str({ maxLength: 10 }), nonBreaking)
      expectType(str(), str({ minLength: 1 }), breaking)
      expectType(str({ minLength: 1 }), str({ minLength: 3 }), breaking)
      expectType(str({ minLength: 3 }), str({ minLength: 1 }), nonBreaking)
    })

    it("B1.9 pattern: add/change breaking, remove non-breaking", () => {
      expectType(str(), str({ pattern: "^a" }), breaking)
      expectType(str({ pattern: "^a" }), str({ pattern: "^b" }), breaking)
      expectType(str({ pattern: "^a" }), str(), nonBreaking)
    })

    it("B1.10 format: add/change breaking, remove non-breaking", () => {
      expectType(str(), str({ format: "email" }), breaking)
      expectType(str({ format: "email" }), str({ format: "uri" }), breaking)
      expectType(str({ format: "email" }), str(), nonBreaking)
    })

    it("B1.11 enum: add value non-breaking, remove value breaking, replace value breaking", () => {
      expectType(str({ enum: ["a"] }), str({ enum: ["a", "b"] }), nonBreaking)
      expectType(str({ enum: ["a", "b"] }), str({ enum: ["a"] }), breaking)
      expectType(str({ enum: ["a"] }), str({ enum: ["b"] }), breaking)
    })

    it("B1.12 const: add/change breaking, remove non-breaking", () => {
      expectType(str(), str({ const: "a" }), breaking)
      expectType(str({ const: "a" }), str({ const: "b" }), breaking)
      expectType(str({ const: "a" }), str(), nonBreaking)
    })

    it("B1.13 default: add non-breaking, remove/change breaking", () => {
      expectType(str(), str({ default: "a" }), nonBreaking)
      expectType(str({ default: "a" }), str(), breaking)
      expectType(str({ default: "a" }), str({ default: "b" }), breaking)
    })
  })

  describe("array validators", () => {
    const arr = (extra = {}) => ({ type: "array", items: { type: "string" }, ...extra })

    it("B1.14 maxItems / minItems", () => {
      expectType(arr(), arr({ maxItems: 5 }), breaking)
      expectType(arr({ maxItems: 5 }), arr({ maxItems: 2 }), breaking)
      expectType(arr({ maxItems: 2 }), arr({ maxItems: 5 }), nonBreaking)
      expectType(arr({ maxItems: 5 }), arr(), nonBreaking)
      expectType(arr(), arr({ minItems: 1 }), breaking)
      expectType(arr({ minItems: 2 }), arr({ minItems: 1 }), nonBreaking)
    })

    it("B1.15 uniqueItems: enabling is breaking, disabling/removing is non-breaking", () => {
      expectType(arr(), arr({ uniqueItems: true }), breaking)
      expectType(arr({ uniqueItems: true }), arr({ uniqueItems: false }), nonBreaking)
      expectType(arr({ uniqueItems: true }), arr(), nonBreaking)
    })

    it("B1.16 items schema changes are classified like the nested keyword", () => {
      const diff = one(arr(), { type: "array", items: { type: "number" } })
      expect(diff).toMatchObject({ path: ["items", "type"], type: breaking })
    })

    // ISSUE-34 (fixed): `/additionalItems` is `[nonBreaking, breaking, unclassified]` — but adding `additionalItems: false`
    // (or any schema) to a tuple *restricts* what clients may send, which is breaking in request semantics.
    it("B1.17 additionalItems: add is breaking, remove is non-breaking", () => {
      const tuple = (extra = {}) => ({ type: "array", items: [{ type: "string" }], ...extra })
      expectType(tuple(), tuple({ additionalItems: false }), breaking)
      expectType(tuple({ additionalItems: false }), tuple(), nonBreaking)
    })
  })

  describe("object validators", () => {
    const obj = (props: Record<string, unknown>, extra = {}) => ({ type: "object", properties: props, ...extra })
    const s = { type: "string" }

    it("B1.18 adding a property: optional is non-breaking, required without default is breaking", () => {
      expectType(obj({ a: s }), obj({ a: s, b: s }), nonBreaking)

      const diffs = diffsOf(obj({ a: s }, { required: ["a"] }), obj({ a: s, b: s }, { required: ["a", "b"] }))
      expect(diffs).toHaveLength(2)
      expect(diffs.find((d) => d.path.join("/") === "properties/b")?.type).toBe(breaking)
      expect(diffs.find((d) => d.path[0] === "required")?.type).toBe(breaking)
    })

    it("B1.19 adding a required property that has a default is non-breaking", () => {
      const diffs = diffsOf(obj({ a: s }), obj({ a: s, b: { type: "string", default: "x" } }, { required: ["b"] }))
      expect(diffs.every((d) => d.type === nonBreaking)).toBe(true)
    })

    // POLICY-03 decided (c), decision §11.14, ISSUE-130 fixed: clients still sending the property may have it silently dropped (was
    // non-breaking)
    it("B1.20 removing a property is risky", () => {
      expectType(obj({ a: s, b: s }), obj({ a: s }), risky)
    })

    it("B1.21 required: marking an existing property required is breaking, un-requiring is non-breaking", () => {
      expectType(obj({ a: s }), obj({ a: s }, { required: ["a"] }), breaking)
      expectType(obj({ a: s }, { required: ["a"] }), obj({ a: s }), nonBreaking)
    })

    // ISSUE-35 (fixed): `/additionalProperties` is `allNonBreaking`; forbidding additional properties (true/absent -> false, or
    // absent -> schema) rejects payloads that were previously valid, which is breaking in request semantics.
    it("B1.22 additionalProperties: forbidding is breaking, allowing is non-breaking", () => {
      expectType(obj({ a: s }), obj({ a: s }, { additionalProperties: false }), breaking)
      expectType(
        obj({ a: s }, { additionalProperties: true }),
        obj({ a: s }, { additionalProperties: false }),
        breaking,
      )
      expectType(
        obj({ a: s }, { additionalProperties: false }),
        obj({ a: s }, { additionalProperties: true }),
        nonBreaking,
      )
    })

    it("B1.23 additionalProperties schema changes are classified like the nested keyword", () => {
      const diff = one(obj({}, { additionalProperties: s }), obj({}, { additionalProperties: { type: "number" } }))
      expect(diff).toMatchObject({ path: ["additionalProperties", "type"], type: breaking })
    })

    it("B1.24 patternProperties: add breaking, remove non-breaking", () => {
      expectType(obj({}), obj({}, { patternProperties: { "^x": s } }), breaking)
      expectType(obj({}, { patternProperties: { "^x": s } }), obj({}), nonBreaking)
    })

    it("B1.25 propertyNames: add breaking, remove non-breaking", () => {
      expectType(obj({}), obj({}, { propertyNames: { pattern: "^x" } }), breaking)
      expectType(obj({}, { propertyNames: { pattern: "^x" } }), obj({}), nonBreaking)
    })

    it("B1.26 minProperties / maxProperties", () => {
      expectType(obj({}), obj({}, { minProperties: 1 }), breaking)
      expectType(obj({}, { maxProperties: 5 }), obj({}, { maxProperties: 2 }), breaking)
      expectType(obj({}, { maxProperties: 2 }), obj({}, { maxProperties: 5 }), nonBreaking)
    })
  })

  describe("meta keywords", () => {
    const s = (extra = {}) => ({ type: "string", ...extra })

    it("B1.27 title, description and examples are annotations", () => {
      expectType(s(), s({ title: "t" }), annotation)
      expectType(s({ description: "a" }), s({ description: "b" }), annotation)
      expectType(s(), s({ examples: ["x"] }), annotation)
      expectType(s({ examples: ["x"] }), s({ examples: ["x", "y"] }), annotation)
    })

    it("B1.28 deprecated: true is a 'deprecated' change in both directions", () => {
      expectType(s(), s({ deprecated: true }), deprecated)
      expectType(s({ deprecated: true }), s(), deprecated)
    })

    // ISSUE-12 (fixed): `deprecated: false` is semantically equal to no `deprecated` keyword at all.
    it("B1.29 adding deprecated: false is not a change", () => {
      expect(diffsOf(s(), s({ deprecated: false }))).toEqual([])
    })

    it("B1.30 readOnly: enabling is breaking (clients can no longer send the value), disabling is non-breaking", () => {
      expectType(s(), s({ readOnly: true }), breaking)
      expectType(s({ readOnly: true }), s({ readOnly: false }), nonBreaking)
    })

    // POLICY-06 decided (d), decision §11.15 (ISSUE-131 fixed): an `x-*` keyword no prefix rule configures is an
    // annotation naming the key (was unclassified); other unknown keywords stay unclassified; `$comment` is an
    // annotation keyword since ISSUE-90 (fixed, was unclassified)
    it("B1.31 unknown keywords are unclassified, x-* keywords are annotations", () => {
      expectType(s(), s({ "x-custom": 1 }), annotation)
      expectType(s({ $comment: "a" }), s({ $comment: "b" }), annotation)
      expectType(s({ "custom-keyword": "a" }), s({ "custom-keyword": "b" }), unclassified)
    })
  })
})

describe("Block B2 — type keyword handling", () => {
  it("B2.1 changing the scalar type is breaking, removing the type is non-breaking, adding is breaking", () => {
    expectType({ type: "string" }, { type: "number" }, breaking)
    expectType({ type: "string" }, {}, nonBreaking)
    expectType({}, { type: "string" }, breaking)
  })

  // ISSUE-36 (fixed): every `type` replace is breaking, but integer -> number accepts a superset of values (non-breaking in
  // request semantics); only the narrowing direction should be breaking.
  it("B2.2 integer -> number is a widening (non-breaking), number -> integer is breaking", () => {
    expectType({ type: "integer" }, { type: "number" }, nonBreaking)
    expectType({ type: "number" }, { type: "integer" }, breaking)
  })

  it("B2.3 type arrays: adding a type is non-breaking, removing a type is breaking", () => {
    expectType({ type: ["string"] }, { type: ["string", "null"] }, nonBreaking)
    expectType({ type: ["string", "null"] }, { type: ["string"] }, breaking)
  })

  // ISSUE-11 (fixed): `type: "string"` and `type: ["string"]` are the same schema, so string -> [string, null] must be
  // classified exactly like [string] -> [string, null] (non-breaking widening) instead of a breaking type replace.
  it("B2.4 scalar type -> type array is normalized before comparison", () => {
    expectType({ type: "string" }, { type: ["string", "null"] }, nonBreaking)
    expect(diffsOf({ type: "string" }, { type: ["string"] })).toEqual([])
  })

  // ISSUE-136 (fixed): POLICY-21 decided (b): the type is not inferred from validators; an untyped schema accepts every
  // type, so adding `type` narrows it (breaking in a request)
  it("B2.5 adding `type` next to type-specific validators is reported and classified", () => {
    expect(
      diffsOf({ properties: { a: { type: "string" } } }, { type: "object", properties: { a: { type: "string" } } }),
    ).toMatchObject([{ path: ["type"], action: "add", type: breaking }])
    expect(diffsOf({ maxLength: 3 }, { type: "string", maxLength: 3 })).toMatchObject([
      { path: ["type"], action: "add", type: breaking },
    ])
  })

  it("B2.6 nested type changes inside properties carry the full path", () => {
    const diff = one(
      { type: "object", properties: { a: { type: "object", properties: { b: { type: "string" } } } } },
      { type: "object", properties: { a: { type: "object", properties: { b: { type: "number" } } } } },
    )
    expect(diff).toMatchObject({ path: ["properties", "a", "properties", "b", "type"], type: breaking })
  })
})

describe("Block B6 — response (reversed) semantics", () => {
  const obj = (props: Record<string, unknown>, extra = {}) => ({ type: "object", properties: props, ...extra })
  const s = { type: "string" }

  it("B6.1 adding a required property to a response is non-breaking", () => {
    const diffs = diffsOf(obj({ a: s }, { required: ["a"] }), obj({ a: s, b: s }, { required: ["a", "b"] }), true)
    expect(diffs.every((d) => d.type === nonBreaking)).toBe(true)
  })

  it("B6.2 removing a required property from a response is breaking", () => {
    const diffs = diffsOf(obj({ a: s, b: s }, { required: ["a", "b"] }), obj({ a: s }, { required: ["a"] }), true)
    expect(diffs.find((d) => d.path.join("/") === "properties/b")?.type).toBe(breaking)
  })

  // POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed: a loosened response bound is risky (was breaking)
  it("B6.3 loosening a numeric bound in a response is risky, tightening is non-breaking", () => {
    expectType({ type: "number", maximum: 10 }, { type: "number", maximum: 20 }, risky, true)
    expectType({ type: "number", maximum: 20 }, { type: "number", maximum: 10 }, nonBreaking, true)
  })

  // POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed: a new response enum value is risky (was breaking)
  it("B6.4 enum: adding a value to a response is risky, removing is non-breaking", () => {
    expectType({ type: "string", enum: ["a"] }, { type: "string", enum: ["a", "b"] }, risky, true)
    expectType({ type: "string", enum: ["a", "b"] }, { type: "string", enum: ["a"] }, nonBreaking, true)
  })

  it("B6.5 annotations and deprecations keep their type under reversed rules", () => {
    expectType({ type: "string" }, { type: "string", title: "x" }, annotation, true)
    expectType({ type: "string" }, { type: "string", deprecated: true }, deprecated, true)
  })

  // ISSUE-39 (fixed): `/type`, `/format`, `/pattern`, `/const` and `/enum/*` declare `[breaking, nonBreaking, breaking]` without
  // explicit reversed entries, so `reverseClassifyRuleTransformer` turns their *replace* slot into non-breaking for
  // responses. A response field whose type changes from string to number breaks every consumer.
  it("B6.6 replacing type/format/pattern/const in a response is breaking", () => {
    expectType({ type: "string" }, { type: "number" }, breaking, true)
    expectType({ type: "string", format: "date" }, { type: "string", format: "uuid" }, breaking, true)
    expectType({ type: "string", pattern: "^a" }, { type: "string", pattern: "^b" }, breaking, true)
    expectType({ type: "string", const: "a" }, { type: "string", const: "b" }, breaking, true)
  })
})
