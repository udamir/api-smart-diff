import { compareJsonSchema } from "../../src"

const metaKey = Symbol('diff')

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

    expect(diffs.length).toEqual(1)
    expect(merged[metaKey]).toMatchObject({
      required: { action: "add" },
    })
  })

  it("should merge jsonSchema with changes in cycle refs", () => {
    const before = {
      type: "object",
      properties: {
        model: { $ref: "#/defs/model" },
      },
      defs: {
        id: {
          title: "id",
          type: "string",
        },
        model: {
          type: "object",
          properties: {
            id: {
              $ref: "#/defs/id",
            },
            parent: {
              $ref: "#/defs/model",
            },
          },
        },
      },
    }

    const after = {
      type: "object",
      properties: {
        model: { $ref: "#/defs/model" },
      },
      defs: {
        id: {
          title: "id",
          type: "string",
        },
        model: {
          type: "object",
          properties: {
            id: {
              $ref: "#/defs/id",
            },
          },
        },
      },
    }

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(merged.defs.model.properties[metaKey]).toMatchObject({
      parent: { action: "remove" },
    })
    expect(merged.properties.model.properties[metaKey]).toMatchObject({
      parent: { action: "remove" },
    })
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

    expect(diffs.length).toEqual(2)
    expect(merged.properties.id[metaKey]).toMatchObject({
      type: { action: "remove" },
      $ref: { action: "add" },
    })
  })
})