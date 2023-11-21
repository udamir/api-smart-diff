import { compareJsonSchema } from "../src"

const metaKey = Symbol('diff')

describe("jsonschema diff tree tests", () => {
  describe("merge simple schema", () => {
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

  describe("schema with references", () => {
    it("should merge jsonSchema with refs", () => {
      const before = {
        type: "object",
        properties: {
          id: { $ref: "#/defs/id" },
        },
        defs: {
          id: {
            title: "id",
            type: "string",
          },
        },
      }

      const after = {
        type: "object",
        properties: {
          id: { $ref: "#/defs/id" },
          name: { $ref: "#/defs/name" },
        },
        defs: {
          id: {
            title: "id",
            type: "number",
          },
          name: {
            title: "name",
            type: "string",
          },
        },
      }

      const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

      expect(diffs.length).toEqual(4)
      expect(merged).toMatchObject({
        ...after,
        properties: {
          id: {
            title: "id",
            type: "number",
          },
          name: { $ref: "#/defs/name" },
        }
      })
      expect(merged.properties[metaKey]).toMatchObject({
        name: { action: "add" },
      })
      expect(merged.defs[metaKey]).toMatchObject({
        name: { action: "add" },
      })
      expect(merged.defs.id[metaKey]).toMatchObject({
        type: { action: "replace", replaced: "string" },
      })
      expect(merged.properties.id[metaKey]).toMatchObject({
        type: { action: "replace", replaced: "string" },
      })
    })

    it("should merge jsonSchema with refs change", () => {
      const before = {
        type: "object",
        properties: {
          id: { $ref: "#/defs/id" },
          name: {
            type: "string",
          }
        },
        defs: {
          id: {
            title: "id",
            type: "string",
          }
        },
      }

      const after = {
        type: "object",
        properties: {
          id: { $ref: "#/defs/id" },
          name: { $ref: "#/defs/name" },
        },
        defs: {
          id: {
            title: "id",
            type: "number",
          },
          name: {
            title: "name",
            type: "string",
          },
        },
      }

      const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

      expect(diffs.length).toEqual(4)
      expect(merged).toMatchObject({
        ...after,
        properties: {
          id: {
            title: "id",
            type: "number",
          },
          name: {
            title: "name",
            type: "string",
          }
        }
      })
      expect(merged.properties.name[metaKey]).toMatchObject({
        title: { action: "add" },
      })
      expect(merged.defs[metaKey]).toMatchObject({
        name: { action: "add" },
      })
      expect(merged.defs.id[metaKey]).toMatchObject({
        type: { action: "replace", replaced: "string" },
      })
      expect(merged.properties.id[metaKey]).toMatchObject({
        type: { action: "replace", replaced: "string" },
      })
    })

    it("should merge jsonSchema with cycle refs", () => {
      const before = {
        type: "object",
        properties: {
          id: {
            title: "id",
            type: "string",
          },
          parent: { $ref: "#" },
        }
      }

      const after = {
        type: "object",
        required: ['id'],
        properties: {
          id: {
            title: "id",
            type: "string",
          },
          parent: { $ref: "#" },
        }
      }
      

      const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

      expect(diffs.length).toEqual(3)
    })
  })

  describe("schema with broken reference", () => {
    it("should merge jsonSchema with broken refs", () => {
      const before = {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      }

      const after = {
        type: "object",
        properties: {
          id: { $ref: "#/defs/id" },
        },
      }
      
      const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

      expect(diffs.length).toEqual(3)
    })
  })
})
