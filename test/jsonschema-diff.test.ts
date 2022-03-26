import { ExampleResource, replacePatch } from "./helpers"
import { annotation } from "../src"

const exampleResource = new ExampleResource("jsonschema.yaml", "JsonSchema")

describe("Test openapi 3 diff", () => {
  it("add servers should be non-breaking change", () => {
    const path = ["properties", "age", "title"]
    const value = "size"

    const after = exampleResource.clone([replacePatch(path, value)])
    const diff = exampleResource.diff(after)
    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{
      path,
      after: value,
      type: annotation
    }])
  })
})
