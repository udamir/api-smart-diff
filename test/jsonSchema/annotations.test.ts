import { compareJsonSchema } from "../../src"

const metaKey = Symbol("diff")
const s = { type: "string" }
const n = { type: "number" }

const descriptions = (before: unknown, after: unknown) =>
  compareJsonSchema(before, after, { metaKey }).diffs.map((d) => d.description)

describe("Block B7 — JSON Schema change descriptions", () => {
  it("B7.1 every diff of a mixed change set carries a non-empty description", () => {
    const before = {
      type: "object",
      required: ["a"],
      properties: { a: { type: "string", enum: ["x"], maxLength: 5 }, b: { type: "object", properties: { c: s } } },
    }
    const after = {
      type: "object",
      required: ["a", "d"],
      description: "doc",
      properties: {
        a: { type: "string", enum: ["x", "y"], maxLength: 3, deprecated: true },
        b: { type: "object", properties: { c: n, e: s } },
        d: { oneOf: [s, n] },
      },
    }
    const { diffs } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toBeGreaterThanOrEqual(7)
    for (const diff of diffs) {
      expect(typeof diff.description).toBe("string")
      expect(diff.description).not.toBe("")
      expect(diff.description).not.toContain("undefined")
      expect(diff.description).not.toContain("{{")
    }
  })

  it("B7.2 property changes name the property and its parent target", () => {
    expect(descriptions({ type: "object", properties: {} }, { type: "object", properties: { b: s } })).toEqual([
      "[Added] property `b`",
    ])
    expect(
      descriptions(
        { type: "object", properties: { a: { type: "object", properties: {} } } },
        { type: "object", properties: { a: { type: "object", properties: { c: s } } } },
      ),
    ).toEqual(["[Added] property `c` to `a`"])
    expect(descriptions({ type: "object", properties: { b: s } }, { type: "object", properties: {} })).toEqual([
      "[Removed] property `b`",
    ])
  })

  it("B7.3 required changes name the affected property", () => {
    expect(
      descriptions({ type: "object", properties: { a: s } }, { type: "object", properties: { a: s }, required: ["a"] }),
    ).toEqual(["[Added] required status to `a`"])
    const nested = (req: string[]) => ({
      type: "object",
      properties: { a: { type: "object", properties: { b: s }, required: req } },
    })
    expect(descriptions(nested([]), nested(["b"]))).toEqual(["[Added] required status to `a.b`"])
  })

  // POLICY-119 decided (changed, P8f): a validator change lists its values like other scalar keywords (was
  // "[Replaced] maximum validator", "[Added] minLength validator to `a`")
  it("B7.4 validator changes name the validator, the target and the values", () => {
    expect(descriptions({ type: "number", maximum: 1 }, { type: "number", maximum: 2 })).toEqual([
      "[Replaced] maximum validator from `1` to `2`",
    ])
    expect(
      descriptions(
        { type: "object", properties: { a: { type: "string" } } },
        { type: "object", properties: { a: { type: "string", minLength: 1 } } },
      ),
    ).toEqual(["[Added] minLength validator with value `1` to `a`"])
  })

  it("B7.13 every validator keyword lists its before / after values (POLICY-119)", () => {
    const obj = (a: Record<string, unknown>) => ({ type: "object", properties: { name: a } })
    expect(descriptions(obj({ type: "string", maxLength: 50 }), obj({ type: "string", maxLength: 30 }))).toEqual([
      "[Replaced] maxLength validator of `name` from `50` to `30`",
    ])
    expect(descriptions(obj({ type: "string", maxLength: 50 }), obj({ type: "string" }))).toEqual([
      "[Removed] maxLength validator with value `50` from `name`",
    ])
    expect(descriptions(obj({ type: "string", pattern: "^a" }), obj({ type: "string", pattern: "^[ab]" }))).toEqual([
      "[Replaced] pattern validator of `name` from `^a` to `^[ab]`",
    ])
    expect(descriptions(obj({ type: "array", uniqueItems: false }), obj({ type: "array", uniqueItems: true }))).toEqual(
      ["[Replaced] uniqueItems validator of `name` from `false` to `true`"],
    )
    expect(descriptions(obj({ type: "number", multipleOf: 2 }), obj({ type: "number", multipleOf: 0.5 }))).toEqual([
      "[Replaced] multipleOf validator of `name` from `2` to `0.5`",
    ])
    expect(descriptions(obj({ type: "number" }), obj({ type: "number", exclusiveMinimum: 0 }))).toEqual([
      "[Added] exclusiveMinimum validator with value `0` to `name`",
    ])
    expect(descriptions(obj({ type: "object" }), obj({ type: "object", minProperties: 1 }))).toEqual([
      "[Added] minProperties validator with value `1` to `name`",
    ])
    // inside a conditional applicator the applicator stays named after the target
    const conditional = (max: number) => ({
      if: { minLength: 1 },
      // biome-ignore lint/suspicious/noThenProperty: `then` is a JSON Schema keyword
      then: { maxLength: max },
    })
    expect(descriptions(conditional(5), conditional(3))).toEqual([
      "[Replaced] maxLength validator of the `then` schema from `5` to `3`",
    ])
    // a validator whose value is a schema is named without values
    expect(descriptions({ type: "object" }, { type: "object", propertyNames: { maxLength: 3 } })).toEqual([
      "[Added] propertyNames validator",
    ])
  })

  // P8a: a scalar keyword change names its values (`formatValue`), `const` is a constant value
  it("B7.5 type, format, default and const changes", () => {
    expect(descriptions(s, n)).toEqual(["[Replaced] type definition from `string` to `number`"])
    expect(descriptions({ type: "string", format: "a" }, { type: "string", format: "b" })).toEqual([
      "[Replaced] value format from `a` to `b`",
    ])
    expect(descriptions({ type: "string" }, { type: "string", default: "x" })).toEqual(["[Added] default value `x`"])
    expect(descriptions({ type: "string" }, { type: "string", const: "x" })).toEqual(["[Added] constant value `x`"])
  })

  // ISSUE-57 (fixed) (P8a): an enum value added or removed is described with its action and value (it was
  // "[Replaced] possible values" for every item change)
  it("B7.6 enum value changes name the action and the value", () => {
    expect(descriptions({ type: "string", enum: ["a"] }, { type: "string", enum: ["a", "b"] })).toEqual([
      "[Added] possible value `b`",
    ])
    expect(
      descriptions(
        { type: "object", properties: { a: { type: "string", enum: ["a"] } } },
        { type: "object", properties: { a: { type: "string", enum: [] } } },
      ),
    ).toEqual(["[Removed] possible value `a` from `a`"])
  })

  it("B7.7 status keywords", () => {
    expect(descriptions(s, { ...s, deprecated: true })).toEqual(["[Added] deprecated status"])
    expect(descriptions({ ...s, deprecated: true }, s)).toEqual(["[Removed] deprecated status"])
    expect(descriptions(s, { ...s, readOnly: true })).toEqual(["[Added] readOnly status"])
  })

  it("B7.8 annotations and examples", () => {
    // POLICY-95 decided (c): free-text values are listed (shortened) like any scalar
    expect(descriptions({ ...s, description: "a" }, { ...s, description: "b" })).toEqual([
      "[Replaced] annotation (description) from `a` to `b`",
    ])
    expect(descriptions(s, { ...s, title: "t" })).toEqual(["[Added] annotation (title) `t`"])
    // adding the whole `examples` array is normalized into an item addition (an empty array is injected on the other side)
    expect(descriptions(s, { ...s, examples: ["x"] })).toEqual(["[Added] annotation (example)"])
    expect(descriptions({ ...s, examples: ["x"] }, { ...s, examples: ["x", "y"] })).toEqual([
      "[Added] annotation (example)",
    ])
  })

  it("B7.9 combinator, items and pattern property changes", () => {
    expect(descriptions({ oneOf: [s] }, { oneOf: [s, n] })).toEqual(["[Added] oneOf schema"])
    expect(descriptions({ anyOf: [s, n] }, { anyOf: [s] })).toEqual(["[Removed] anyOf schema"])
    expect(descriptions({ type: "array", items: [s] }, { type: "array", items: [s, n] })).toEqual([
      "[Added] array item with index `1` to `[]`",
    ])
    expect(descriptions({ type: "object" }, { type: "object", patternProperties: { "^x": s } })).toEqual([
      "[Added] property with key pattern `^x`",
    ])
    // cosmetic: the target is computed from the node's own path, so it reads "to `{.*}`"
    expect(descriptions({ type: "object" }, { type: "object", additionalProperties: s })).toEqual([
      "[Added] schema for additional properties to `{.*}`",
    ])
  })

  // ISSUE-13 (fixed): items of a `type` array fall back to the generic `/**` annotation and read "annotation (1)".
  it("B7.10 adding a type to a type array is described as a type change", () => {
    const [text] = descriptions({ type: ["string"] }, { type: ["string", "null"] })
    expect(text).toContain("type")
    expect(text).not.toContain("annotation")
  })

  // ISSUE-28 (fixed): rename diffs are annotated with the parent path, whose last segment is undefined at the root.
  it("B7.11 the oneOf -> anyOf rename description does not contain 'undefined'", () => {
    const [text] = descriptions({ oneOf: [s, n] }, { anyOf: [s, n] })
    expect(text).not.toContain("undefined")
  })

  // ISSUE-12 (fixed)
  it("B7.12 deprecated: false produces no change or a described one", () => {
    const texts = descriptions(s, { ...s, deprecated: false })
    expect(texts.every((t) => typeof t === "string" && t.length > 0)).toBe(true)
  })
})
