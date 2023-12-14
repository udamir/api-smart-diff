import { annotation, breaking, DiffAction, nonBreaking, unclassified } from "../../src"
import { addPatch, ExampleResource } from "../helpers"

const exampleResource = new ExampleResource("petstore.yaml")

describe("Test openapi 3 diff", () => {
  it("add servers should be non-breaking change", () => {
    const path = ["servers", 2]
    const value = {
      url: "http://localhost:3000",
      description: "Local server1"
    }

    const after = exampleResource.clone([addPatch(path, value)])
    const diff = exampleResource.diff(after)
    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{
      path,
      after: value,
      type: annotation
    }])
  })

  it("should add diff for rename change with non-breaking change", () => {
    const after = exampleResource.clone()
    after.paths["/pet/{pet}/uploadImage"] = after.paths["/pet/{petId}/uploadImage"]
    delete after.paths["/pet/{petId}/uploadImage"]
    after.paths["/pet/{pet}/uploadImage"].post.parameters[0].name = "pet"

    const diff = exampleResource.diff(after)
    expect(diff.length).toEqual(2)
    expect(diff).toMatchObject([
      { path: ["paths"], before: "/pet/{petId}/uploadImage", after: "/pet/{pet}/uploadImage", type: nonBreaking, action: DiffAction.rename },
      { path: ["paths", "/pet/{petId}/uploadImage", "post", "parameters", 0, "name"], type: nonBreaking }
    ])
  })

  it("should add rename diff to merged with non-breaking change", () => {
    const after = exampleResource.clone()
    after.paths["/pet/{pet}/uploadImage"] = after.paths["/pet/{petId}/uploadImage"]
    delete after.paths["/pet/{petId}/uploadImage"]
    after.paths["/pet/{pet}/uploadImage"].post.parameters[0].name = "pet"

    const merged = exampleResource.merge(after)
    expect(merged.paths.$diff).toMatchObject({ ["/pet/{pet}/uploadImage"]: { action: DiffAction.rename, replaced: "/pet/{petId}/uploadImage", type: nonBreaking } })
  })

  it("should classify required change after rename", () => {
    const after = exampleResource.clone()
    after.paths["/pet/{pet}"] = after.paths["/pet/{petId}"]
    delete after.paths["/pet/{petId}"]
    after.components.schemas.Pet.required[0] = "id"
    after.components.schemas.Pet.properties.id.default = 0

    const merged = exampleResource.merge(after)
    expect(merged.paths.$diff).toMatchObject({ ["/pet/{pet}"]: { action: DiffAction.rename, replaced: "/pet/{petId}", type: nonBreaking } })
    expect(merged.paths["/pet/{pet}"].get.responses[200].content["application/json"].schema.$diff.required.array).toMatchObject({
      0: { action: DiffAction.remove, type: breaking },
      2: { action: DiffAction.add, type: breaking }
    })
    expect(merged.paths["/pet"].post.requestBody.content["application/json"].schema.$diff.required.array).toMatchObject({
      0: { action: DiffAction.remove, type: nonBreaking },
      2: { action: DiffAction.add, type: nonBreaking }
    })
  })

  it("should add rename diff on media type rename", () => {
    const after = exampleResource.clone()
    after.paths["/pet"].put.requestBody.content["application/*"] = after.paths["/pet"].put.requestBody.content["application/json"]
    delete after.paths["/pet"].put.requestBody.content["application/json"]

    const merged = exampleResource.merge(after)
    expect(merged.paths["/pet"].put.requestBody.content.$diff).toMatchObject({ 
      ["application/*"]: { action: DiffAction.rename, replaced: "application/json", type: nonBreaking }
    })
  })

  it("should classify as non-breaking remove of operation security", () => {
    const after = exampleResource.clone()
    after.paths["/user/createWithList"].post.security = [{}]

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: nonBreaking }])
  })

  it("should classify as non-breaking set operation security equal to default", () => {
    const after = exampleResource.clone()
    after.paths["/user/createWithList"].post.security = [{ api_key: []}]

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: nonBreaking }])
  })

  it("should classify as non-breaking set to default operation security if equal to default", () => {
    const after = exampleResource.clone()
    delete after.paths["/pet/{petId}"].get.security

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: nonBreaking }])
  })

  it("should classify as breaking set to default operation security if not equal to default", () => {
    const after = exampleResource.clone()
    delete after.paths["/pet/findByTags"].get.security

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: breaking }])
  })
  
  it("should classify as breaking set to default operation security if not equal to default", () => {
    const after = exampleResource.clone()
    after.paths["/user/{username}"].get.security = [{ petstore_auth: [] }]

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: breaking }])
  })

  it("should do not find changes with allOf diff", () => {
    const after = exampleResource.clone()
    const { xml, ...rest } = after.components.schemas.Order
    after.components.schemas.Order = {
      ...rest, allOf: [ { xml }]
    }
    const diffs = exampleResource.diff(after)
    expect(diffs.length).toEqual(0)
  })
})
