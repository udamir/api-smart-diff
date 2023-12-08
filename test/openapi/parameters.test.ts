import { ExampleResource } from "../helpers"
import { annotation, breaking, DiffAction, nonBreaking } from "../../src"

const exampleResource = new ExampleResource("petstore.yaml")

describe("Test openapi 3 parameters compare", () => {

  it("should not add rename diff on query parameter name change", () => {
    const after = exampleResource.clone()
    after.paths["/user/login"].get.parameters[0].name = "login"

    const merged = exampleResource.merge(after)
    expect(merged.paths["/user/login"].get.$diff).toMatchObject({ parameters: { array: {
      0: { action: DiffAction.remove, type: breaking },
      2: { action: DiffAction.add, type: nonBreaking }
    }}})
  })

  it("should classify operation parameter schema change", () => {
    const after = exampleResource.clone()
    after.paths["/pet/findByStatus"].get.parameters[0].schema.description = "Status list"

    const merged = exampleResource.merge(after)
    expect(merged.paths["/pet/findByStatus"].get.parameters[0].schema.$diff).toMatchObject({ description: { action: DiffAction.add, type: annotation } })
  })
  
  it("should classify as breaking change of query param style", () => {
    const after = exampleResource.clone()
    after.paths["/pet/findByStatus"].get.parameters[0].style = "simple"
    
    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: breaking }])
  }) 

  it("should classify as annotation remove of query param style 'form'", () => {
    const after = exampleResource.clone()
    delete after.paths["/pet/findByStatus"].get.parameters[0].style

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: annotation }])
  }) 

  it("should classify as breaking change of query param type from array to string", () => {
    const after = exampleResource.clone()
    after.paths["/pet/findByStatus"].get.parameters[0].schema.type = "string"
    delete after.paths["/pet/findByStatus"].get.parameters[0].schema.items

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: nonBreaking }, { type: breaking }])
  }) 

  it("should classify as non-breaking change of query param type from string to array", () => {
    const after = exampleResource.clone()
    after.paths["/user/login"].get.parameters[0].schema.type = "array"
    after.paths["/user/login"].get.parameters[0].schema.items = { type: "string" }

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: nonBreaking }, { type: nonBreaking }])
  }) 
})
