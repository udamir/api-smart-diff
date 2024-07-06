import { DiffAction, breaking, compareOpenApi, nonBreaking } from "../../src"
import { yaml } from "../helpers"

const metaKey = Symbol('diff')

describe("Openapi 3 operation changes", () => {
  it("should comapre documents with different operations", () => {
    const before = yaml`
      paths:
        "/pet":
          get: {}
          post: {}
        "/pet/findById":
          get: {}
    `
    const after = yaml`
      paths:
        "/pet/{id}":
          get: {}
        "/pet/findById":
          get: {}
    `
    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    for(const diff of diffs) {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    }
    
    expect(merged.paths["/pet"][metaKey]).toMatchObject({ 
      get: { action: DiffAction.remove, type: breaking },
      post: { action: DiffAction.remove, type: breaking },
    })
    expect(merged.paths["/pet/{id}"][metaKey]).toMatchObject({ 
      get: { action: DiffAction.add, type: nonBreaking },
    })
  })

  it("should comapre operations with different annotations", () => {
    const before = yaml`
      paths:
        "/pet":
          get: 
            summary: Get list of pets
            security:
              - petstore_auth:
                - read:pets
            x-codegen-request-body-name: body
    `
    const after = yaml`
      paths:
        "/pet":
          summary: operation with Pet
          get: 
            tags:
              - pet
            operationId: getPet
            deprecated: true
            security:
              - petstore_auth:
                - write:pets
                - read:pets
            x-codegen-request-body-name: test
    `
    const { diffs, merged } = compareOpenApi(before, after, { metaKey })

    expect(diffs.length).toEqual(6)

    for(const diff of diffs) {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    }

    expect(merged.paths["/pet"].get[metaKey]).toMatchObject({ 
      deprecated: { action: 'add', type: 'deprecated' },
      operationId: { action: 'add', type: 'annotation' },
      tags: { array: { 0: { action: 'add', type: 'annotation' }}},
      summary: {action: 'replace', type: 'annotation', replaced: 'Get list of pets'},
      "x-codegen-request-body-name": { action: 'replace', type: 'annotation', replaced: 'body' },
    })
    expect(merged.paths["/pet"].get.security[0][metaKey]).toMatchObject({ 
      petstore_auth: { array: { 1: { action: 'add', type: 'non-breaking' }}},
    })
  })
})