import { ExampleResource } from "./helpers"

const exampleResource = new ExampleResource("externalref.yaml", "OpenApi3")

describe("Test refs in openapi 3", () => {
  it("all external sources should be found", () => {
    const refs = exampleResource.findExternalSources()
    expect(refs.length).toEqual(2)
    expect(refs).toMatchObject(["http://swagger.io", "http://swagger.io/api"])
  })
})
