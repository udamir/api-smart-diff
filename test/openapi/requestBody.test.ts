import { DiffAction, annotation, breaking, compareOpenApi, nonBreaking, risky, unclassified } from "../../src"
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
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    // vendor extensions are annotations (ISSUE-17, DESIGN_PROPOSALS §4.3)
    expect(merged.paths["/pet"].put.requestBody[metaKey]).toMatchObject({
      "x-test": { action: DiffAction.add, type: annotation },
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

  // POLICY-03 decided (c), decision §11.14 (ISSUE-130 fixed): clients still sending the property may have it silently
  // dropped, so removing it is risky (was non-breaking)
  it("should be risky change to remove not required property to requestBody", () => {
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
      name: { action: DiffAction.remove, type: risky },
    })
  })

  // POLICY-03 decided (c), decision §11.14 (ISSUE-130 fixed): the property removal is risky, dropping its required
  // status alone stays non-breaking
  it("should be risky change to remove required property to requestBody", () => {
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
      name: { action: DiffAction.remove, type: risky },
    })
  })
})
