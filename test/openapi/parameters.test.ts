import { annotation, breaking, compareOpenApi, DiffAction, nonBreaking } from "../../src"
import { yaml } from "../helpers"

const metaKey = Symbol('diff')

describe("Test openapi 3 parameters compare", () => {
  it("should add rename diff on path parameter name change", () => {
    const before = yaml`
      paths:
        "/pet/{petId}":
          get: {}
          parameters:
            - name: petId
              in: path
              schema:
                type: string
    `
    const after = yaml`
      paths:
        "/pet/{id}":
          get:
            parameters:
              - name: id
                in: path
                schema:
                  type: string
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    expect(diffs[1]).toHaveProperty("description")
    expect(diffs[1].description).not.toEqual("")
    expect(diffs[1].type).not.toEqual("unclassified")

    expect(merged.paths[metaKey]).toMatchObject({ 
      "/pet/{id}": { action: DiffAction.rename, type: nonBreaking, replaced: "/pet/{petId}" },
    })
    expect(merged.paths["/pet/{id}"].get.parameters[0][metaKey]).toMatchObject({ 
      name: { action: DiffAction.replace, type: nonBreaking, replaced: "petId" },
    })
  })

  it("should map query $ref parameters correctly", () => {
    const before = yaml`
      paths:
        /test/endpoint:
          get:
            parameters:
              - $ref: "#/components/parameters/name"
      components:
        parameters:
          name:
            name: name
            in: query
            schema:
              type: string
            required: true
    `
    const after = yaml`
      paths:
        /test/endpoint:
          get:
            parameters:
              - name: name
                in: query
                schema:
                  type: string
                required: false
      components:
        parameters:
          name:
            name: name
            in: query
            schema:
              type: string
            required: true
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(1)

    expect(diffs[0]).toHaveProperty("description")
    expect(diffs[0].description).not.toEqual("")
    expect(diffs[0].type).not.toEqual("unclassified")
  

    expect(merged.paths["/test/endpoint"].get.parameters[0][metaKey]).toMatchObject({
      required: { action: DiffAction.remove, type: nonBreaking },
    })
  })

  it("should not add rename diff on query parameter name change", () => {
    const before = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: status
              in: query
              schema:
                type: array
    `
    const after = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: stat
              in: query
              schema:
                type: array
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(2)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged.paths["/pet/findByStatus"].get[metaKey]).toMatchObject({ parameters: { array: {
      0: { action: DiffAction.remove, type: breaking },
      1: { action: DiffAction.add, type: nonBreaking }
    }}})
  })

  it("should be add diff on query parameter add", () => {
    const before = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: status
              in: query
              schema:
                type: array
    `
    const after = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: stat
              in: query
              schema:
                type: string
            - name: stat2
              in: query
              required: true
              schema:
                type: string
            - name: stat3
              in: query
              required: true
              schema:
                type: string
                default: 0
            - name: status
              in: query
              schema:
                type: array
    `

    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged.paths["/pet/findByStatus"].get[metaKey]).toMatchObject({ parameters: { array: {
      1: { action: DiffAction.add, type: nonBreaking },
      2: { action: DiffAction.add, type: breaking },
      3: { action: DiffAction.add, type: nonBreaking },
    }}})
  })

  it("should classify operation parameter schema change", () => {
    const before = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: status
              in: query
              schema:
                type: array
    `
    const after = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: status
              in: query
              description: Status values that need to be considered for filter
              required: true
              style: simple
              schema:
                type: array
    `
    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(merged.paths["/pet/findByStatus"].get.parameters[0][metaKey]).toMatchObject({ 
      description: { action: DiffAction.add, type: annotation },
      required: { action: DiffAction.add, type: breaking },
      style: { action: DiffAction.replace, replaced: "form", type: breaking }
    })
  })

  it("should find change when remove of query param style 'form'", () => {
    const before = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: status
              in: query
              style: form
              schema:
                type: array
    `
    const after = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - $ref: "#/components/parameters/status"
      components:
        parameters:
          status:
            name: status
            in: query
            schema:
              type: array
    `

    const { diffs } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
  }) 

  it("should classify as breaking change of query param type from array to string", () => {
    const before = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: status
              in: query
              style: form
              schema:
                type: array
    `
    const after = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: status
              in: query
              schema:
                type: string
    `

    const { diffs } = compareOpenApi(before, after, { metaKey })
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(diffs.length).toEqual(1)
    expect(diffs).toMatchObject([{ type: breaking }])
  }) 

  it("should classify as non-breaking change of query param type from string to array", () => {
    const before = yaml`
    paths:
      "/pet/findByStatus":
        get:
          parameters:
          - name: status
            in: query
            schema:
              type: string
    `
    const after = yaml`
      paths:
        "/pet/findByStatus":
          get:
            parameters:
            - name: status
              in: query
              schema:
                type: array
    `

    const { diffs } = compareOpenApi(before, after, { metaKey })
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })

    expect(diffs.length).toEqual(1)
    expect(diffs).toMatchObject([{ type: nonBreaking }])
  }) 
})
