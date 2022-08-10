import { addPatch, ExampleResource, replacePatch } from "./helpers"

const example = new ExampleResource("externalref.yaml")

describe("Test refs in openapi 3", () => {
  it("all external sources should be found", () => {
    const refs = example.findExternalSources()
    expect(refs.length).toEqual(1)
    expect(refs).toMatchObject(["common.yaml"])
  })

  it("changes circular refs should be merged", () => {
    const path = ["components", "schemas", "Group", "properties", "alias"]
    const value = { type: "string" }

    const after = example.clone([addPatch(path, value)])
    const diff = example.diff(after)
    expect(diff.length).toEqual(3)
  })


  it("should dereference components from external refs", () => {
    const Info = {
      type: "string"
    }
    example.externalSources = {
      "common.yaml": {
        components: { schemas: { Info } }
      }
    }
    
    const merged = example.merge(example.clone(), { resolveUnchangedRefs: true })
    expect(merged.components.schemas.Inventory.properties.extra_info).toMatchObject(Info)
  })

})

const example2 = new ExampleResource("сircularref.yaml")

describe("Test circular refs", () => {
  it("changes circular refs should be merged", () => {
    const path = ["definitions", "baz", "properties", "new", "$ref"]
    const value = "#/definitions/baz"

    const after = example2.clone([replacePatch(path, value)])
    const diff = example2.diff(after)
    expect(diff.length).toEqual(2)
  })

})
