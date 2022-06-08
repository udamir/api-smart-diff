import { addPatch, ExampleResource } from "./helpers"

const example = new ExampleResource("externalref.yaml", "OpenApi3")

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
    
    const merged = example.merge(example.clone())
    expect(merged.components.schemas.Inventory.properties.extra_info).toMatchObject(Info)
  })

})
