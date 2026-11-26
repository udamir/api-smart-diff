import { annotation, breaking, compareJsonSchema, nonBreaking, risky } from "../../src"

const metaKey = Symbol("diff")

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
      // no `type`: removing it is reported (it was inferred from the validators before POLICY-21)
      properties: {
        id: { type: "number" },
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    // POLICY-21 decided (b), decision §11.19 (ISSUE-136 fixed): the type is no longer inferred from the validators: the removed `type` is the 4th diff
    expect(diffs.length).toEqual(4)

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
      required: { array: { 0: { action: "remove", type: nonBreaking } } },
    })
    // POLICY-03 decided (c), decision §11.14 (ISSUE-130 fixed): removing a property is risky (was non-breaking)
    expect(merged.properties[metaKey]).toMatchObject({
      id: { action: "add", type: nonBreaking },
      name: { action: "remove", type: risky },
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
          default: "",
        },
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    // after order with removed items appended (DESIGN_PROPOSALS §11.2)
    expect(merged).toMatchObject({
      required: ["name", "id", "foo"],
      properties: {
        name: {
          type: "string",
          default: "",
        },
      },
    })
    expect(merged[metaKey]).toMatchObject({
      required: {
        array: {
          0: { action: "add", type: nonBreaking },
          2: { action: "remove", type: nonBreaking },
        },
      },
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
      required: {
        array: {
          0: { action: "add", type: breaking },
          1: { action: "add", type: breaking },
        },
      },
    })
    expect(merged.properties[metaKey]).toMatchObject({
      name: { action: "add", type: breaking },
    })
  })

  it("should compare object jsonSchema with additionalProperties", () => {
    const before = {
      required: ["id"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    }

    const after = {
      required: ["id"],
      additionalProperties: { type: "string" },
      minProperties: 1,
      maxProperties: 3,
      propertyNames: {
        enum: ["id", "name", "foo"],
      },
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
        enum: ["id", "name", "foo"],
      },
    })
    // ISSUE-35: constraining additional properties to a schema rejects payloads that were valid before
    expect(merged[metaKey]).toMatchObject({
      additionalProperties: { action: "add", type: breaking },
      minProperties: { action: "add", type: breaking },
      maxProperties: { action: "add", type: breaking },
      propertyNames: { action: "add", type: breaking },
    })
    // POLICY-42 decided (a): the removed declarations `{ type: string }` equal the explicit `additionalProperties`
    // schema that governs the keys now, so the valid values do not change (was risky by POLICY-03)
    expect(merged.properties[metaKey]).toMatchObject({
      name: { action: "remove", type: annotation },
      id: { action: "remove", type: annotation },
    })
  })

  it("should compare object jsonSchema with additionalProperties change", () => {
    const before = {
      additionalProperties: true,
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
    // ISSUE-35: `true` -> schema is a restriction of the additional properties
    expect(merged[metaKey]).toMatchObject({
      additionalProperties: { action: "replace", replaced: true, type: breaking },
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
      type: { action: "replace", replaced: "number", type: breaking },
    })
  })

  it("should compare object jsonSchema with patternProperties", () => {
    const before = {
      patternProperties: {
        "^[a-z0-9]+$": {
          type: "string",
        },
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

    // POLICY-21 decided (b), decision §11.19 (ISSUE-136 fixed): the type is no longer inferred from the validators: the added `type` is the 3rd diff
    expect(diffs.length).toEqual(3)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged).toMatchObject(after)
    expect(merged[metaKey]).toMatchObject({ type: { action: "add", type: breaking } })
    expect(merged.patternProperties[metaKey]).toMatchObject({
      "^[0-9]+$": { action: "add", type: breaking },
    })
    expect(merged.patternProperties["^[a-z0-9]+$"][metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string", type: breaking },
    })
  })
})
