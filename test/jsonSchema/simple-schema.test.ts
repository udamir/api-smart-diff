import { annotation, breaking, compareJsonSchema, deprecated, nonBreaking, unclassified } from "../../src"

const metaKey = Symbol('diff')

describe("Compare simple jsonSchema", () => {
  it("should compare boolean jsonSchema", () => {
    const before = {
      title: "Boolean",
      type: "boolean",
      description: "Boolean schema",
      default: false,
      maximum: 10,  // should be ignored
    }

    const after = {
      title: "boolean",
      type: "boolean",
      description: "Updated Boolean schema",
      const: true
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(4)

    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      title: "boolean",
      type: "boolean",
      description: "Updated Boolean schema",
      default: false,
      const: true
    })
    expect(merged).not.toHaveProperty("maximum")
    expect(merged[metaKey]).toMatchObject({
      const: { action: "add", type: breaking },
      title: { action: "replace", replaced: "Boolean", type: annotation },
      description: { action: "replace", replaced: "Boolean schema", type: annotation },
      default: { action: "remove", type: breaking }
    })
  })

  it("should compare number jsonSchema", () => {
    const before = {
      title: "Title",
      type: "number",
      format: "int64",
      maximum: 10,
      exclusiveMaximum: true, // should be converted to number
      minLength: 3, // should be ignored
    }

    const after = {
      type: "number",
      "x-prop": "Added custom tag",
      default: 0,
      exclusiveMaximum: 10,
      pattern: "w+", // should be ignored
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(4)

    diffs.forEach((diff) => diff.type !== unclassified && expect(diff).toHaveProperty("description"))

    expect(merged).toMatchObject({
      title: "Title",
      type: "number",
      format: "int64",
      exclusiveMaximum: 10,
      "x-prop": "Added custom tag",
      default: 0,
    })
    expect(merged).not.toHaveProperty("minLength")
    expect(merged).not.toHaveProperty("pattern")
    expect(merged[metaKey]).toMatchObject({
      default: { action: "add", type: nonBreaking },
      title: { action: "remove", type: annotation },
      "x-prop": { action: "add", type: unclassified },
      format: { action: "remove", type: nonBreaking },
    })
  })

  it("should compare string jsonSchema", () => {
    const before = {
      title: "Title",
      type: "string",
      maximum: 10,  // should be ignored
      const: "foo", // should be converted to enum
      minLength: 3,
    }

    const after = {
      // type: "string" - should be calculated
      description: "Added string description",
      default: "foo",
      enum: ["baz", "foo"],
      pattern: "w+",
      minLength: 1,
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(6)

    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      title: "Title",
      type: "string",
      description: "Added string description",
      default: "foo",
      enum: ["foo", "baz"],
      pattern: "w+",
      minLength: 1,
    })
    expect(merged).not.toHaveProperty("maximum")
    expect(merged[metaKey]).toMatchObject({
      default: { action: "add", type: nonBreaking },
      enum: { array: { 1: { action: "add", type: nonBreaking }}},
      title: { action: "remove", type: annotation },
      description: { action: "add", type: annotation },
      pattern: { action: "add", type: breaking },
      minLength: { action: "replace", replaced: 3, type: nonBreaking },
    })
  })

  it("should compare string jsonSchema with example", () => {
    const before = {
      title: "test",
      type: "string",
      enum: ["a", "b", "c"],
      example: "a", // should be converted to examples
    }

    const after = {
      title: "test1",
      type: "string",
      enum: ["a", "d", "c"],
      examples: ["a", "c"]
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(3)

    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      title: "test1",
      type: "string",
      enum: ["a", "d", "c"],
      examples: ["a", "c"],
    })
    expect(merged[metaKey]).toMatchObject({
      title: { action: "replace", replaced: "test", type: annotation },
      enum: { array: { 1: { action: "replace", replaced: "b", type: breaking }}},
      examples: { array: { 1 : { action: "add", type: annotation }}},
    })
  })

  it("should comapre string jsonSchema with deprecated", () => {
    const before = {
      title: "test",
      type: "string",
      description: "test description",
      readOnly: true
    }

    const after = {
      title: "test",
      type: "string",
      description: "test description1",
      deprecated: true,
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(3)

    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      title: "test",
      type: "string",
      description: "test description1",
      readOnly: true,
      deprecated: true,
    })
    expect(merged[metaKey]).toMatchObject({
      description: { action: "replace", replaced: "test description", type: annotation },
      deprecated: { action: "add", type: deprecated },
      readOnly: { action: "remove", type: nonBreaking }
    })
  })
})
