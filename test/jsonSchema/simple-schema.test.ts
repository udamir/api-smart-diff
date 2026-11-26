import { annotation, breaking, compareJsonSchema, deprecated, nonBreaking, unclassified } from "../../src"

const metaKey = Symbol("diff")

describe("Compare simple jsonSchema", () => {
  it("should compare boolean jsonSchema", () => {
    const before = {
      title: "Boolean",
      type: "boolean",
      description: "Boolean schema",
      default: false,
      maximum: 10, // no effect on a boolean: an annotation (POLICY-10)
    }

    const after = {
      title: "boolean",
      type: "boolean",
      description: "Updated Boolean schema",
      const: true,
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(5)

    diffs.forEach((diff, i) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      title: "boolean",
      type: "boolean",
      description: "Updated Boolean schema",
      default: false,
      const: true,
      maximum: 10,
    })

    expect(merged[metaKey]).toMatchObject({
      const: { action: "add", type: breaking },
      title: { action: "replace", replaced: "Boolean", type: annotation },
      description: { action: "replace", replaced: "Boolean schema", type: annotation },
      default: { action: "remove", type: breaking },
      // POLICY-10 decided (a) (ISSUE-133 fixed): a validator of another type has no effect, an annotation (was
      // unclassified)
      maximum: { action: "remove", type: annotation },
    })
  })

  it("should compare number jsonSchema", () => {
    const before = {
      title: "Title",
      type: "number",
      format: "int64",
      maximum: 10,
      exclusiveMaximum: true, // should be converted to number
      minLength: 3, // no effect on a number: an annotation (POLICY-10)
    }

    const after = {
      type: "number",
      "x-prop": "Added custom tag",
      default: 0,
      exclusiveMaximum: 10,
      pattern: "w+", // no effect on a number: an annotation (POLICY-10)
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(6)

    diffs.forEach((diff) => diff.type !== unclassified && expect(diff).toHaveProperty("description"))

    expect(merged).toMatchObject({
      title: "Title",
      type: "number",
      format: "int64",
      exclusiveMaximum: 10,
      "x-prop": "Added custom tag",
      default: 0,
      minLength: 3,
      pattern: "w+",
    })

    expect(merged[metaKey]).toMatchObject({
      default: { action: "add", type: nonBreaking },
      title: { action: "remove", type: annotation },
      // POLICY-06 decided (d), decision §11.15 (ISSUE-131 fixed): an `x-*` keyword is an annotation (was unclassified)
      "x-prop": { action: "add", type: annotation },
      format: { action: "remove", type: nonBreaking },
      // POLICY-10 decided (a) (ISSUE-133 fixed): validators of another type are annotations (were unclassified)
      minLength: { action: "remove", type: annotation },
      pattern: { action: "add", type: annotation },
    })
  })

  it("should compare string jsonSchema", () => {
    const before = {
      title: "Title",
      type: "string",
      const: "foo", // should be converted to enum
      minLength: 3,
    }

    const after = {
      // no `type`: removing it is reported (it was inferred from the validators before POLICY-21)
      description: "Added string description",
      default: "foo",
      enum: ["baz", "foo"],
      pattern: "w+",
      minLength: 1,
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    // POLICY-21 decided (b), decision §11.19 (ISSUE-136 fixed): the type is no longer inferred from the validators: the
    // removed `type` is the 7th diff
    expect(diffs.length).toEqual(7)

    diffs.forEach((diff, i) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    // merged arrays follow the after order (DESIGN_PROPOSALS §11.2) and hold the original values (§11.1)
    expect(merged).toMatchObject({
      title: "Title",
      type: "string",
      description: "Added string description",
      default: "foo",
      enum: ["baz", "foo"],
      pattern: "w+",
      minLength: 1,
    })

    expect(merged[metaKey]).toMatchObject({
      default: { action: "add", type: nonBreaking },
      enum: { array: { 0: { action: "add", type: nonBreaking } } },
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
      examples: ["a", "c"],
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
      enum: { array: { 1: { action: "replace", replaced: "b", type: breaking } } },
      examples: { array: { 1: { action: "add", type: annotation } } },
    })
  })

  it("should comapre string jsonSchema with deprecated", () => {
    const before = {
      title: "test",
      type: "string",
      description: "test description",
      readOnly: true,
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
      readOnly: { action: "remove", type: nonBreaking },
    })
  })
})
