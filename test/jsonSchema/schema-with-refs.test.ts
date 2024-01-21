import { compareJsonSchema } from "../../src"
import { yaml } from "../helpers"

const metaKey = Symbol('diff')

describe("schema with references", () => {
  it("should merge jsonSchema with refs", () => {
    const before = yaml`
      type: object
      properties:
        id:
          $ref: '#/definitions/id'
      definitions:
        id:
          title: id
          type: string
    `

    const after = yaml`
      type: object
      properties:
        id:
          $ref: '#/definitions/id'
        name:
          $ref: '#/definitions/name'
      definitions:
        id:
          title: id
          type: number
        name:
          title: name
          type: string
    `

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(4)
    expect(merged).toMatchObject({
      ...after,
      properties: {
        id: {
          title: "id",
          type: "number",
        },
        name: { $ref: "#/definitions/name" },
      }
    })
    expect(merged.properties[metaKey]).toMatchObject({
      name: { action: "add" },
    })
    expect(merged.definitions[metaKey]).toMatchObject({
      name: { action: "add" },
    })
    expect(merged.definitions.id[metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string" },
    })
    expect(merged.properties.id[metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string" },
    })
  })

  it("should merge jsonSchema with refs change", () => {
    const before = yaml`
      type: object
      properties:
        id:
          $ref: '#/definitions/id'
        name:
          type: string
      definitions:
        id:
          title: id
          type: string
    `

    const after = yaml`
      type: object
      properties:
        id:
          $ref: '#/definitions/id'
        name:
          $ref: '#/definitions/name'
      definitions:
        id:
          title: id
          type: number
        name:
          title: name
          type: string
    `

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
    expect(merged.definitions[metaKey]).toMatchObject({
      name: { action: "add" },
    })
    expect(merged.definitions.id[metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string" },
    })
    expect(merged.properties.id[metaKey]).toMatchObject({
      type: { action: "replace", replaced: "string" },
    })
  })

  it("should merge jsonSchema with cycle refs", () => {
    const before = yaml`
      type: object
      properties:
        id:
          title: id
          type: string
        parent:
          $ref: '#'
    `

    const after = yaml`
      type: object
      required:
        - id
      properties:
        id:
          title: id
          type: string
        parent:
          $ref: '#'
    `
    
    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    expect(merged[metaKey]).toMatchObject({
      required: { array: { 0: { action: "add" }}},
    })
  })

  it("should merge jsonSchema with changes in cycle refs", () => {
    const before = yaml`
      type: object
      properties:
        model:
          $ref: '#/definitions/model'
      definitions:
        id:
          title: id
          type: string
        model:
          type: object
          properties:
            id:
              $ref: '#/definitions/id'
            parent:
              $ref: '#/definitions/model'
    `

    const after = yaml`
      type: object
      properties:
        model:
          $ref: '#/definitions/model'
      definitions:
        id:
          title: id
          type: string
        model:
          type: object
          properties:
            id:
              $ref: '#/definitions/id'
    `

    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(merged.definitions.model.properties[metaKey]).toMatchObject({
      parent: { action: "remove" },
    })
    expect(merged.properties.model.properties[metaKey]).toMatchObject({
      parent: { action: "remove" },
    })
  })
})

describe("schema with broken reference", () => {
  it("should merge jsonSchema with broken refs", () => {
    const before = yaml`
      type: object
      properties:
        id:
          type: string
    `

    const after = yaml`
      type: object
      properties:
        id:
          $ref: '#/definitions/id'
    `
    
    const { diffs, merged } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(merged.properties.id[metaKey]).toMatchObject({
      type: { action: "remove" },
      $ref: { action: "add" },
    })
  })
})
