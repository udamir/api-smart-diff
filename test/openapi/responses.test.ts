import { DiffAction, annotation, breaking, compareOpenApi, nonBreaking, unclassified } from "../../src"
import { yaml } from "../helpers"

const metaKey = Symbol("diff")

describe("Openapi response changes", () => {
  it("should compare requestBody", () => {
    const before = yaml`
      paths:
        "/pet/findByStatus":
          get:
            responses:
              '200':
                description: successful operation
                content:
                  application/xml:
                    schema:
                      type: array
                      items:
                        "$ref": "#/components/schemas/Pet"
                  application/json:
                    schema:
                      type: array
                      items:
                        "$ref": "#/components/schemas/Pet"
              '400':
                description: Invalid status value
                content: {}
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
        "/pet/findByStatus":
          get:
            responses:
              '200':
                x-test: true
                description: successful operation
                content:
                  application/json:
                    encoding:
                      contentType: application/json
                    examples:
                      cat:
                        - id: 5
                          name: cat
                        - id: 6
                          name: cat
                    schema:
                      type: array
                      items:
                        "$ref": "#/components/schemas/Pet"
              '400':
                description: Invalid status value
                content: {}
              '404':
                description: Not found
                content: {}
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
              name:
                type: string
                example: doggie
            xml:
              name: Pet
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(7)
    diffs.forEach((diff, i) => {
      i !== 6 && expect(diff).toHaveProperty("description")
      i !== 6 && expect(diff.description).not.toEqual("")
      i !== 4 && expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged.paths["ß/pet/findByStatus"].get.responses[metaKey]).toMatchObject({
      "404": { action: DiffAction.add, type: nonBreaking },
    })

    expect(merged.paths["/pet/findByStatus"].get.responses[200][metaKey]).toMatchObject({
      "x-test": { action: DiffAction.add, type: unclassified },
    })

    expect(merged.paths["/pet/findByStatus"].get.responses[200].content[metaKey]).toMatchObject({
      "application/xml": { action: DiffAction.remove, type: breaking },
    })

    expect(merged.paths["/pet/findByStatus"].get.responses[200].content["application/json"][metaKey]).toMatchObject({
      encoding: { action: DiffAction.add, type: breaking },
      examples: { action: DiffAction.add, type: annotation },
    })

    expect(
      merged.paths["/pet/findByStatus"].get.responses[200].content["application/json"].schema.items.properties.id[
        metaKey
      ],
    ).toMatchObject({
      format: { action: DiffAction.remove, type: breaking },
    })

    expect(merged.components.schemas.Pet.properties.id[metaKey]).toMatchObject({
      format: { action: DiffAction.remove, type: nonBreaking },
    })
  })

  it("should be non-breaking change to add any property to response", () => {
    const before = yaml`
      paths:
        "/pet/findByStatus":
          get:
            responses:
              '200':
                description: successful operation
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
        "/pet/findByStatus":
          get:
            responses:
              '200':
                description: successful operation
                content:
                  application/json:
                    schema:
                      type: object
                      required:
                        - id
                        - name
                        - test2
                      properties:
                        id:
                          type: integer
                        name:
                          type: string
                        test1:
                          type: string
                        test2:
                          type: string
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    for (const diff of diffs) {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    }

    expect(
      merged.paths["/pet/findByStatus"].get.responses["200"].content["application/json"].schema[metaKey],
    ).toMatchObject({
      required: { array: { 2: { action: DiffAction.add, type: nonBreaking } } },
    })

    expect(
      merged.paths["/pet/findByStatus"].get.responses["200"].content["application/json"].schema.properties[metaKey],
    ).toMatchObject({
      test1: { action: DiffAction.add, type: nonBreaking },
      test2: { action: DiffAction.add, type: nonBreaking },
    })
  })

  it("should be breaking change to remove required property from response", () => {
    const before = yaml`
      paths:
        "/pet/findByStatus":
          get:
            responses:
              '200':
                description: successful operation
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
                          type: string
    `
    const after = yaml`
      paths:
        "/pet/findByStatus":
          get:
            responses:
              '200':
                description: successful operation
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

    expect(diffs.length).toEqual(3)
    for (const diff of diffs) {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    }

    expect(
      merged.paths["/pet/findByStatus"].get.responses["200"].content["application/json"].schema[metaKey],
    ).toMatchObject({
      required: { array: { 1: { action: DiffAction.remove, type: breaking } } },
    })

    expect(
      merged.paths["/pet/findByStatus"].get.responses["200"].content["application/json"].schema.properties[metaKey],
    ).toMatchObject({
      name: { action: DiffAction.remove, type: breaking },
      test: { action: DiffAction.remove, type: nonBreaking },
    })
  })
})
