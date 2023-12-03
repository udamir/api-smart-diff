import { compareJsonSchema } from "../../src"

const metaKey = Symbol('diff')

describe("schema with array", () => {
  it("should merge simple jsonSchema (array type change)", () => {
    const before = {
      type: "array",
      items: {
        type: "string",
      },
    }

    const after = {
      type: "array",
      items: [
        {
          type: "number",
        }
      ],
      additionalItems: {
        type: "string"
      }
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    expect(merged).toMatchObject(after)
    expect(merged.items[0][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string" }
    })
  })

  it("should merge simple jsonSchema (type change to array)", () => {
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
    expect(merged).toMatchObject(after)
    expect(merged[metaKey]).toMatchObject({
      type: { action: "replace", replaced: "number" },
      items: { action: "add" },
    })
  })

  it("should merge jsonSchema with array items", () => {
    const before = {
      type: "array",
      items: [
        {
          type: "string",
        },
        {
          type: "boolean",
        },
      ],
    }
    const after = {
      type: "array",
      items: [
        {
          type: "boolean",
        }
      ],
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(merged[metaKey]).toMatchObject({
      items: { array: { 1: { action: "remove" }}},
    })
    expect(merged.items[0][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string" },
    })
  })

  it("should merge jsonSchema with array items", () => {
    const before = {
      type: "array",
      items: [
        {
          type: "string",
        },
        {
          type: "boolean",
        },
      ],
    }
    const after = {
      type: "array"
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(merged[metaKey]).toMatchObject({
      items: { array: { 
        0: { action: "remove" },
        1: { action: "remove" }
      }},
    })
  })

  it("should merge jsonSchema with array items change", () => {
    const before: any = {
      type: "array",
      items: [
        {
          type: "string",
        },
        {
          type: "boolean",
        },
      ],
    }
    const after: any = {
      type: "array",
      items: {
        type: "string"
      }
    }

    const expectedMerged = {
      type: "array",
      items: [
        {
          type: "string",
        },
        {
          type: "string",
        },
      ],
      additionalItems: {
        type: "string",
      }
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(merged).toMatchObject(expectedMerged)
    expect(merged.items[1][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "boolean" },
    })
    expect(merged[metaKey]).toMatchObject({
      additionalItems: { action: "add" },
    })
  })
})
