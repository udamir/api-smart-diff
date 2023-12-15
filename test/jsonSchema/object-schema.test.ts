import { breaking, compareJsonSchema, nonBreaking } from "../../src"

const metaKey = Symbol('diff')

describe("Compare object jsonSchema", () => {

  it("should compare object jsonSchema with required remove", () => {
    const before = {
      type: "object",
      required: ["id"],
      properties: {
        name: { type: "string" },
      },
    }
    
    const after = {
      // type: "object" - should be calculated
      properties: {
        id: { type: "number" },
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(3)

    diffs.forEach((diff) => expect(diff).toHaveProperty("description"))
    diffs.forEach((diff) => expect(diff.type).not.toEqual("unclassified"))

    expect(merged).toMatchObject({
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "number" },
        name: { type: "string" },
      },
    })
    expect(merged[metaKey]).toMatchObject({
      required: { array: { 0: { action: "remove", type: nonBreaking }}}
    })
    expect(merged.properties[metaKey]).toMatchObject({
      id: { action: "add", type: nonBreaking },
      name: { action: "remove", type: breaking },
    })
  })

  it("should compare object jsonSchema with required change", () => {
    const before = {
      required: ["id", "foo"],
    }

    const after = {
      required: ["name", "id"],
      properties: {
        name: {
          type: "string",
          default: ""
        }
      }
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      required: ["id", "foo", "name"],
      properties: {
        name: {
          type: "string",
          default: ""
        }
      }
    })
    expect(merged[metaKey]).toMatchObject({
      required: { array: { 
        1: { action: "remove", type: nonBreaking },
        2: { action: "add", type: nonBreaking },
      }}
    })
    expect(merged.properties[metaKey]).toMatchObject({
      name: { action: "add", type: nonBreaking },
    })
  })

  it("should compare object jsonSchema with required add", () => {
    const before = {
      properties: {
        id: { type: "string" },
      },
    }

    const after = {
      required: ["id", "name", 1],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      required: ["id", "name"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    })
    expect(merged[metaKey]).toMatchObject({
      required: { array: { 
        0: { action: "add", type: breaking },
        1: { action: "add", type: breaking },
      }}
    })
    expect(merged.properties[metaKey]).toMatchObject({
      name: { action: "add", type: nonBreaking },
    })
  })

  it("should compare object jsonSchema with additionalProperties", () => {
    const before = {
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    }

    const after = {
      additionalProperties: { type: "string" },
      minProperties: 1,
      maxProperties: 3,
      propertyNames: {
        enum: ["id", "name", "foo"]
      }
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(6)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject({
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
      additionalProperties: { type: "string" },
      minProperties: 1,
      maxProperties: 3,
      propertyNames: {
        enum: ["id", "name", "foo"]
      }
    })
    expect(merged[metaKey]).toMatchObject({
      additionalProperties: { action: "add", type: nonBreaking },
      minProperties: { action: "add", type: breaking },
      maxProperties: { action: "add", type: breaking },
      propertyNames: { action: "add", type: breaking },
    })
    expect(merged.properties[metaKey]).toMatchObject({
      name: { action: "remove", type: breaking },
      id: { action: "remove", type: breaking },
    })
  })

  it("should compare object jsonSchema with additionalProperties change", () => {
    const before = {
      additionalProperties: true
    }

    const after = {
      additionalProperties: {
        type: "number",
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject(after)
    expect(merged[metaKey]).toMatchObject({
      additionalProperties: { action: "replace", replaced: true, type: nonBreaking }
    })
  })

  it("should compare object jsonSchema with additionalProperties validation change", () => {
    const before = {
      additionalProperties: {
        type: "number",
      },
    }

    const after = {
      additionalProperties: {
        type: "string",
        maxLength: 3,
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
    expect(merged.additionalProperties[metaKey]).toMatchObject({
      maxLength: { action: "add", type: breaking },
      type: { action: "replace", replaced: "number", type: breaking }
    })
  })

  it("should compare object jsonSchema with patternProperties", () => {
    const before = {
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
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject(after)
    expect(merged.patternProperties[metaKey]).toMatchObject({
      "^[0-9]+$": { action: "add", type: breaking }
    })
    expect(merged.patternProperties["^[a-z0-9]+$"][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string", type: breaking }
    })
  })
})
