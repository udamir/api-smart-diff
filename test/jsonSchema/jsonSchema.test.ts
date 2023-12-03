import { compareJsonSchema } from "../../src"

const metaKey = Symbol('diff')

describe("merge simple jsonSchema", () => {
  it("should merge simple jsonSchema", () => {
    const before = {
      title: "test",
      type: "string",
      enum: ["a", "b", "c"],
      example: "a",
    }

    const after = {
      title: "test1",
      type: "string",
      enum: ["a", "d", "c", 'b'],
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    expect(merged).toMatchObject({
      title: "test1",
      type: "string",
      enum: ["a", "d", "c", "b"],
      examples: ["a"],
    })
    expect(merged[metaKey]).toMatchObject({
      title: { action: "replace", replaced: "test" },
      enum: { array: { 1: { action: "add" }}},
      examples: { action: "remove" }
    })
  })

  it("should merge simple jsonSchema with meta", () => {
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
    expect(merged).toMatchObject({
      title: "test",
      type: "string",
      description: "test description1",
      readOnly: true,
      deprecated: true,
    })
    expect(merged[metaKey]).toMatchObject({
      description: { action: "replace", replaced: "test description" },
      deprecated: { action: "add" },
      readOnly: { action: "remove" }
    })
  })

  it("should merge object jsonSchema", () => {
    const before = {
      type: "object",
      required: ["id"],
      properties: {
        id: {
          type: "string",
        },
        name: {
          type: "string",
        },
      },
    }

    const after = {
      title: "test",
      type: "object",
      required: ["id", "name"],
      properties: {
        id: {
          type: "number",
        },
        name: {
          type: "string",
        },
        test: {
          type: "string",
        },
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(4)
    expect(merged).toMatchObject({
      title: "test",
      type: "object",
      required: ["id", "name"],
      properties: {
        id: {
          type: "number",
        },
        name: {
          type: "string",
        },
        test: {
          type: "string",
        },
      },
    })
    expect(merged[metaKey]).toMatchObject({
      title: { action: "add" },
      required: { array: { 1: { action: "add" }}}
    })
    expect(merged.properties[metaKey]).toMatchObject({
      test: { action: "add" },
    })
    expect(merged.properties.id[metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string" },
    })
  })

  it("should merge jsonSchema with additionalProperties", () => {
    const before = {
      type: "object",
      properties: {
        id: {
          type: "string",
        }
      }
    }

    const after = {
      type: "object",
      properties: {
        id: {
          type: "string",
        }
      },
      additionalProperties: {
        type: "number",
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    expect(merged).toMatchObject(after)
    expect(merged[metaKey]).toMatchObject({
      additionalProperties: { action: "add" }
    })
  })

  it("should create tree from jsonSchema with patternProperties", () => {
    const before = {
      type: "object",
      patternProperties: {
        "^[a-z0-9]+$": {
          type: "string",
        }
      },
    }
    const after = {
      type: "object",
      patternProperties: {
        "^[a-z0-9]+$": {
          type: "number",
        },
        "^[0-9]+$": {
          type: "string",
        },
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(merged).toMatchObject(after)
    expect(merged.patternProperties[metaKey]).toMatchObject({
      "^[0-9]+$": { action: "add" }
    })
    expect(merged.patternProperties["^[a-z0-9]+$"][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string" }
    })
  })
})
