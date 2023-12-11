import { annotation, breaking, compareJsonSchema, nonBreaking } from "../../src"

const metaKey = Symbol('diff')

describe("schema with combinary", () => {
  it("should compare oneOf combinary jsonSchema with added object", () => {
    const before = {
      oneOf: [
        { type: "string" },
        {
          type: "object",
          required: ['id'],
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
      ],
    }

    const after = {
      oneOf: [
        { type: "string" },
        { type: "number" },
        {
          type: "object",
          required: ['name', 'id'],
          properties: {
            id: {
              type: "number",
            },
            name: {
              type: "string",
            },
          },
        },
      ],
    }

    const { diffs, merged } =compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged.oneOf[0]).toMatchObject(after.oneOf[0])
    expect(merged.oneOf[1]).toMatchObject({...after.oneOf[2], required: ["id", "name"] })
    expect(merged.oneOf[2]).toMatchObject(after.oneOf[1])

    expect(merged[metaKey]).toMatchObject({ oneOf: { array: { 2: { action: "add", type: nonBreaking }}} })
    expect(merged.oneOf[1][metaKey]).toMatchObject({
      required: { array: { 1: { action: "add", type: breaking }}}
    })
  })

  it("should compare oneOf combinary jsonSchema with sibling content", () => {
    const before = {
      title: "Title",
      type: "object",
      required: ['id'],  
      properties: {
        id: { type: "number" },
      },
      oneOf: [
        {
          required: ['foo'],  
          properties: {
            foo: { type: "number" },
          },
        },
        {
          properties: {
            name: { type: "string" },
          },
        },
      ],
    }

    const after = {
      type: "object",
      required: ['id'],  
      oneOf: [
        {
          title: "Title",
          properties: {
            id: { type: "number" },
            foo: { type: "number" },
          },
        },
        {
          title: "Title2",
          required: ['name'],  
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
      ],
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged.oneOf[0]).toMatchObject({
      title: "Title",
      type: "object",
      required: [ "foo", "id"],
      properties: {
        foo: { type: "number" },
        id: { type: "number" },
      },
    })
    expect(merged.oneOf[1]).toMatchObject({
      title: "Title2",
      type: "object",
      required: [ "id", "name" ],
      properties: {
        name: { type: "string" },
        id: { type: "number" },
      },
    })

    expect(merged.oneOf[0][metaKey]).toMatchObject({ 
      required: { array: { 0: { action: "remove", type: nonBreaking }}} 
    })
    expect(merged.oneOf[1][metaKey]).toMatchObject({
      required: { array: { 1: { action: "add", type: breaking }}},
      title: { action: "replace", type: annotation, replaced: "Title" }
    })
  })

  it("should compare jsonSchema with nested oneOf object", () => {
    const before = {
      type: "object",
      required: ["id"],
      oneOf: [
        {
          title: "opt1",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
        {
          title: "opt3",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
      ],
    }

    const after = {
      oneOf: [
        {
          oneOf: [
            {
              type: "object",
              title: "opt1",
              required: ["id"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
              },
            },
            {
              type: "object",
              title: "opt2",
              required: ["id"],
              properties: {
                id: { type: "string" },
                test: { type: "string" },
              },
            },
          ],
        },
        {
          type: "object",
          title: "opt3",
          required: ["id"],
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
      ],
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    expect(merged).toMatchObject(after)
    expect(merged.oneOf[0][metaKey]).toMatchObject({
      oneOf: { array: { 1: { action: "add", type: nonBreaking }}}
    })
  })
})
