import { ExampleResource, replacePatch } from "./helpers"
import { annotation, breaking } from "../src"

const exampleResource = new ExampleResource("jsonschema.yaml", "JsonSchema")

describe("Test Jsonschema diff", () => {
  it("replace of 'title' property should be 'annotation' change", () => {
    const path = ["properties", "age", "title"]
    const value = "size"

    const after = exampleResource.clone([replacePatch(path, value)])
    const diff = exampleResource.diff(after)

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, after: value, type: annotation }])
  })

  it("increase of 'minimum' property should be 'breaing' change", () => {
    const path = ["properties", "age", "minimum"]
    const oldValue = exampleResource.getValue(path)
    const value = oldValue + 1

    const after = exampleResource.clone([replacePatch(path, value)])
    const diff = exampleResource.diff(after)

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, before: oldValue, after: value, type: breaking }])
  })
})
