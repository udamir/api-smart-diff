import { DiffAction, annotation, breaking, compareOpenApi, nonBreaking, unclassified } from "../../src"
import { yaml } from "../helpers"

const metaKey = Symbol("diff")

describe("Openapi request body changes", () => {
  it("should compare requestBody", () => {
    const before = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              description: Pet object that needs to be added to the store
              content:
                application/json:
                  example:
                    id: 5
                    name: cat
                  schema:
                    "$ref": "#/components/schemas/Pet"
                application/xml:
                  schema:
                    "$ref": "#/components/schemas/Pet"
      components:
        schemas:
          Pet:
            type: object
            required:
              - id
              - name
            properties:
              id:
                type: integer
                format: int64
              name:
                type: string
                example: doggie
            xml:
              name: Pet
    `

    const after = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              description: Pet object that needs to be added to the store!
              content:
                application/*:
                  encoding:
                    contentType: application/json
                  examples:
                    cat:
                      id: 5
                      name: cat
                  schema:
                    "$ref": "#/components/schemas/Pet"
              required: true
              x-test: true
      components:
        schemas:
          Pet:
            type: object
            required:
              - id
              - name
            properties:
              id:
                type: integer
                format: int64
              name:
                type: string
                example: doggie
            xml:
              name: Pet
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(8)
    diffs.forEach((diff, i) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      i !== 7 && expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged.paths["/pet"].put.requestBody[metaKey]).toMatchObject({
      "x-test": { action: DiffAction.add, type: unclassified },
      description: { action: DiffAction.replace, type: annotation },
      required: { action: DiffAction.add, type: breaking },
    })

    expect(merged.paths["/pet"].put.requestBody.content[metaKey]).toMatchObject({
      "application/*": { action: DiffAction.rename, type: nonBreaking },
      "application/xml": { action: DiffAction.remove, type: breaking },
    })

    expect(merged.paths["/pet"].put.requestBody.content["application/*"][metaKey]).toMatchObject({
      encoding: { action: DiffAction.add, type: breaking },
      example: { action: DiffAction.remove, type: annotation },
      examples: { action: DiffAction.add, type: annotation },
    })
  })

  it("should be non-breaking change to add not required property to requestBody", () => {
    const before = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              content:
                application/json:
                  schema:
                    type: object
                    required:
                      - id
                      - name
                    properties:
                      id:
                        type: integer
                      name:
                        type: string
    `
    const after = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              content:
                application/json:
                  schema:
                    type: object
                    required:
                      - id
                      - name
                    properties:
                      id:
                        type: integer
                      name:
                        type: string
                      test:
                        type: number
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    expect(diffs[0]).toHaveProperty("description")
    expect(diffs[0].description).not.toEqual("")

    expect(merged.paths["/pet"].put.requestBody.content["application/json"].schema.properties[metaKey]).toMatchObject({
      test: { action: DiffAction.add, type: nonBreaking },
    })
  })

  it("should be breaking change to add required property to requestBody", () => {
    const before = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              content:
                application/json:
                  schema:
                    type: object
                    required:
                      - id
                      - name
                    properties:
                      id:
                        type: integer
                      name:
                        type: string
    `
    const after = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              content:
                application/json:
                  schema:
                    type: object
                    required:
                      - id
                      - name
                      - test
                    properties:
                      id:
                        type: integer
                      name:
                        type: string
                      test:
                        type: number
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(diffs[0]).toHaveProperty("description")
    expect(diffs[0].description).not.toEqual("")
    expect(diffs[1]).toHaveProperty("description")
    expect(diffs[1].description).not.toEqual("")

    expect(merged.paths["/pet"].put.requestBody.content["application/json"].schema[metaKey]).toMatchObject({
      required: { array: { 2: { action: DiffAction.add, type: breaking } } },
    })

    expect(merged.paths["/pet"].put.requestBody.content["application/json"].schema.properties[metaKey]).toMatchObject({
      test: { action: DiffAction.add, type: breaking },
    })
  })

  it("should be non-breaking change to remove not required property to requestBody", () => {
    const before = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              content:
                application/json:
                  schema:
                    type: object
                    required:
                      - id
                    properties:
                      id:
                        type: integer
                      name:
                        type: string
    `
    const after = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              content:
                application/json:
                  schema:
                    type: object
                    required:
                      - id
                    properties:
                      id:
                        type: integer
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    expect(diffs[0]).toHaveProperty("description")
    expect(diffs[0].description).not.toEqual("")

    expect(merged.paths["/pet"].put.requestBody.content["application/json"].schema.properties[metaKey]).toMatchObject({
      name: { action: DiffAction.remove, type: nonBreaking },
    })
  })

  it("should be non breaking change to remove required property to requestBody", () => {
    const before = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              content:
                application/json:
                  schema:
                    type: object
                    required:
                      - id
                      - name
                    properties:
                      id:
                        type: integer
                      name:
                        type: string
    `
    const after = yaml`
      paths:
        "/pet":
          put:
            requestBody:
              content:
                application/json:
                  schema:
                    type: object
                    required:
                      - id
                    properties:
                      id:
                        type: integer
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(diffs[0]).toHaveProperty("description")
    expect(diffs[0].description).not.toEqual("")
    expect(diffs[1]).toHaveProperty("description")
    expect(diffs[1].description).not.toEqual("")

    expect(merged.paths["/pet"].put.requestBody.content["application/json"].schema[metaKey]).toMatchObject({
      required: { array: { 1: { action: DiffAction.remove, type: nonBreaking } } },
    })

    expect(merged.paths["/pet"].put.requestBody.content["application/json"].schema.properties[metaKey]).toMatchObject({
      name: { action: DiffAction.remove, type: nonBreaking },
    })
  })
})
