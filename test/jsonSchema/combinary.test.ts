import { compareJsonSchema } from "../../src"

const metaKey = Symbol('diff')

describe("schema with combinary", () => {
  it("should merge jsonSchema with oneOf object", () => {
    const before = {
      oneOf: [
        {
          type: "string",
        },
        {
          type: "object",
          required: ['id'],
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

    const after = {
      oneOf: [
        {
          type: "string",
        },
        {
          type: "number",
        },
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

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(merged).toMatchObject(after)
    expect(merged[metaKey]).toMatchObject({ oneOf: { array: { 1: { action: "add"}}} })
    expect(merged.oneOf[2][metaKey]).toMatchObject({
      required: { array: { 0: { action: "add" }}}
    })
  })

  it("should merge jsonSchema with nested oneOf obejct", () => {
    const before = {
      type: "object",
      required: ["id"],
      oneOf: [
        {
          title: "opt1",
          properties: {
            id: {
              type: "string",
            },
            name: {
              type: "string",
            },
          },
        },
        {
          title: "opt3",
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

    const after = {
      type: "object",
      required: ["id"],
      oneOf: [
        {
          oneOf: [
            {
              type: "object",
              title: "opt1",
              properties: {
                id: {
                  type: "string",
                },
                name: {
                  type: "string",
                },
              },
            },
            {
              type: "object",
              title: "opt2",
              properties: {
                id: {
                  type: "string",
                },
                test: {
                  type: "string",
                },
              },
            },
          ],
        },
        {
          type: "object",
          title: "opt3",
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

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    expect(merged).toMatchObject(after)
    expect(merged.oneOf[0][metaKey]).toMatchObject({
      oneOf: { array: { 1: { action: "add" }}}
    })
  })
})
