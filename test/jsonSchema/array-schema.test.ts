import { breaking, compareJsonSchema, nonBreaking } from "../../src"

const metaKey = Symbol('diff')

describe("Comapre array jsonSchema", () => {
  it("should compare array jsonSchema with validations change", () => {
    const before = {
      items: {
        type: "string",
      },
      minItems: 1
    }

    const after = {
      type: "array",
      uniqueItems: true,
      minItems: 0,
      maxItems: 3,
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(4)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      items: {
        type: "string",
      },
      uniqueItems: true,
      minItems: 0,
      maxItems: 3,
    })
    expect(merged[metaKey]).toMatchObject({
      items: { action: "remove", type: nonBreaking },
      minItems: { action: "replace", replaced: 1, type: nonBreaking },
      maxItems: { action: "add", type: breaking },
      uniqueItems: { action: "add", type: breaking },
    })
  })

  it("should compare array jsonSchema with validations change", () => {
    const before = {
      type: "array",
      items: {
        type: "string",
      },
    }

    const after = {
      type: "array",
      items: [
        { type: "number" }
      ],
      additionalItems: {
        type: "string"
      }
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject(after)
    expect(merged.items[0][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string", type: breaking }
    })
  })

  it("should compare array jsonSchema (type change to array)", () => {
    const before = {
      type: "number",
    }

    const after = {
      type: "array",
      items: {
        type: "number",
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject(after)
    expect(merged[metaKey]).toMatchObject({
      type: { action: "replace", replaced: "number", type: breaking },
      items: { action: "add", type: nonBreaking },
    })
  })

  it("should merge jsonSchema with array items", () => {
    const before = {
      items: [
        { type: "string" },
        { type: "boolean" },
      ],
    }
    const after = {
      items: [
        { type: "boolean" }
      ],
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged[metaKey]).toMatchObject({
      items: { array: { 1: { action: "remove", type: breaking }}},
    })
    expect(merged.items[0][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string", type: breaking },
    })
  })

  it("should merge jsonSchema with array items", () => {
    const before = {
      type: "array",
      items: [
        { type: "string" },
        { type: "boolean" },
      ],
    }
    const after = {
      type: "array"
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged[metaKey]).toMatchObject({
      items: { array: { 
        0: { action: "remove", type: breaking },
        1: { action: "remove", type: breaking }
      }},
    })
  })

  it("should merge jsonSchema with array items change", () => {
    const before: any = {
      type: "array",
      items: [
        { type: "string" },
        { type: "boolean" },
      ],
    }
    const after: any = {
      items: {
        type: "string"
      }
    }

    const expectedMerged = {
      type: "array",
      items: [
        { type: "string" },
        { type: "string" },
      ],
      additionalItems: {
        type: "string",
      }
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject(expectedMerged)
    expect(merged.items[1][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "boolean", type: breaking },
    })
    expect(merged[metaKey]).toMatchObject({
      additionalItems: { action: "add", type: nonBreaking },
    })
  })
})
