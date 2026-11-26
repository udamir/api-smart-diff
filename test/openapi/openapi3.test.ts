import { annotation, breaking, compareOpenApi, DiffAction, nonBreaking, risky, unclassified } from "../../src"
import { addPatch, ExampleResource } from "../helpers"

const exampleResource = new ExampleResource("petstore.yaml")

describe("Test openapi 3 diff", () => {
  it("add servers should be non-breaking change", () => {
    const path = ["servers", 2]
    const value = {
      url: "http://localhost:3000",
      description: "Local server1",
    }

    const after = exampleResource.clone([addPatch(path, value)])
    const diff = exampleResource.diff(after)
    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([
      {
        path,
        after: value,
        type: annotation,
      },
    ])
  })

  it("should add diff for rename change with non-breaking change", () => {
    const after = exampleResource.clone()
    after.paths["/pet/{pet}/uploadImage"] = after.paths["/pet/{petId}/uploadImage"]
    delete after.paths["/pet/{petId}/uploadImage"]
    after.paths["/pet/{pet}/uploadImage"].post.parameters[0].name = "pet"

    const diff = exampleResource.diff(after)
    expect(diff.length).toEqual(2)
    expect(diff).toMatchObject([
      {
        path: ["paths"],
        before: "/pet/{petId}/uploadImage",
        after: "/pet/{pet}/uploadImage",
        type: nonBreaking,
        action: DiffAction.rename,
      },
      { path: ["paths", "/pet/{petId}/uploadImage", "post", "parameters", 0, "name"], type: nonBreaking },
    ])
  })

  it("should add rename diff to merged with non-breaking change", () => {
    const after = exampleResource.clone()
    after.paths["/pet/{pet}/uploadImage"] = after.paths["/pet/{petId}/uploadImage"]
    delete after.paths["/pet/{petId}/uploadImage"]
    after.paths["/pet/{pet}/uploadImage"].post.parameters[0].name = "pet"

    const merged = exampleResource.merge(after)
    expect(merged.paths.$diff).toMatchObject({
      "/pet/{pet}/uploadImage": {
        action: DiffAction.rename,
        replaced: "/pet/{petId}/uploadImage",
        type: nonBreaking,
      },
    })
  })

  it("should classify required change after rename", () => {
    const after = exampleResource.clone()
    after.paths["/pet/{pet}"] = after.paths["/pet/{petId}"]
    delete after.paths["/pet/{petId}"]
    after.components.schemas.Pet.required[0] = "id"
    after.components.schemas.Pet.properties.id.default = 0

    const merged = exampleResource.merge(after)
    expect(merged.paths.$diff).toMatchObject({
      "/pet/{pet}": { action: DiffAction.rename, replaced: "/pet/{petId}", type: nonBreaking },
    })
    // after order with the removed name appended (§11.2); response semantics: a new required property is
    // non-breaking, a property that is no longer required is risky (POLICY-05 decided (b), decision §11.14,
    // ISSUE-130 fixed: was breaking), request: the added `id` has a default
    expect(
      merged.paths["/pet/{pet}"].get.responses[200].content["application/json"].schema.$diff.required.array,
    ).toMatchObject({
      0: { action: DiffAction.add, type: nonBreaking },
      2: { action: DiffAction.remove, type: risky },
    })
    expect(merged.paths["/pet"].post.requestBody.content["application/json"].schema.$diff.required.array).toMatchObject(
      {
        0: { action: DiffAction.add, type: nonBreaking },
        2: { action: DiffAction.remove, type: nonBreaking },
      },
    )
  })

  it("should add rename diff on media type rename", () => {
    const after = exampleResource.clone()
    after.paths["/pet"].put.requestBody.content["application/*"] =
      after.paths["/pet"].put.requestBody.content["application/json"]
    delete after.paths["/pet"].put.requestBody.content["application/json"]

    const merged = exampleResource.merge(after)
    expect(merged.paths["/pet"].put.requestBody.content.$diff).toMatchObject({
      "application/*": { action: DiffAction.rename, replaced: "application/json", type: nonBreaking },
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
    after.paths["/user/createWithList"].post.security = [{ api_key: [] }]

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
      ...rest,
      allOf: [{ xml }],
    }
    const diffs = exampleResource.diff(after)
    expect(diffs.length).toEqual(0)
  })

  it("should classify as non-breaking change of additionalProperties from any type to true in request", () => {
    const after = exampleResource.clone()
    after.paths["/pet/{petId}"].post.requestBody.content[
      "application/x-www-form-urlencoded"
    ].schema.properties.customProperties.additionalProperties = true

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ type: nonBreaking }])
  })

  it("should classify change of response code from 5XX to 5xx as an annotation rename", () => {
    const after = exampleResource.clone()
    after.paths["/pet"].put.responses["5xx"] = after.paths["/pet"].put.responses["5XX"]
    delete after.paths["/pet"].put.responses["5XX"]

    // ISSUE-01: the former "0 diffs" passed only because the subtree was never compared; a case-only rename of a
    // response code is now reported once, as an annotation
    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ action: DiffAction.rename, before: "5XX", after: "5xx", type: annotation }])
  })

  it("should annotate response content type correctly on content schema change", () => {
    const after = exampleResource.clone()
    // a contract change (an annotation-only change is reported at the declaration only, POLICY-57)
    after.components.schemas.Pet.properties.name.type = "number"

    const diffs = exampleResource.diff(after)
    const request = diffs.find((d) => d.path[3] === "requestBody")
    const response = diffs.find((d) => d.path[3] === "responses")
    expect(request?.description).toContain("Request Body content")
    expect(response?.description).toContain("Response 200 content")
    expect(request?.description).not.toEqual(response?.description)
  })

  // POLICY-57 / ISSUE-190 (fixed): an annotation-only change inside a component is reported once, at the declaration
  it("should report an annotation-only component change at the declaration only", () => {
    const after = exampleResource.clone()
    after.components.schemas.Pet.description = "some description"

    const diffs = exampleResource.diff(after)
    expect(diffs).toMatchObject([{ path: ["components", "schemas", "Pet", "description"], type: annotation }])
  })

  it("should keep per-usage diffs for contract changes and leave annotation-only changes to the declaration", () => {
    const mk = (pet: unknown) => ({
      openapi: "3.0.3",
      info: { title: "t", version: "1" },
      paths: {
        "/p": {
          get: {
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
              },
            },
          },
        },
      },
      components: { schemas: { Pet: pet } },
    })
    const before = {
      type: "object",
      description: "a",
      title: "T",
      properties: { x: { type: "string", description: "d" } },
    }
    const annotationOnly = { type: "object", description: "b", properties: { x: { type: "string" } } }
    const withContract = { type: "object", description: "b", properties: { x: { type: "number" } } }
    const metaKey = Symbol("diff")

    // only annotations changed: three diffs at the declaration, none at the usage, which stays a reference in merged
    const first = compareOpenApi(mk(before), mk(annotationOnly), { metaKey })
    expect(first.diffs.map((d) => d.path.join("/")).sort()).toEqual([
      "components/schemas/Pet/description",
      "components/schemas/Pet/properties/x/description",
      "components/schemas/Pet/title",
    ])
    expect(first.merged.paths["/p"].get.responses[200].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/Pet",
    })

    // a breaking change as well: it is reported at the usage too; the usage's merged value shows the after state with
    // merge metadata for the breaking change only
    const second = compareOpenApi(mk(before), mk(withContract), { metaKey })
    const usage = second.diffs.filter((d) => d.path[0] === "paths")
    expect(usage).toMatchObject([{ action: "replace", type: breaking, after: "number" }])
    const schema = second.merged.paths["/p"].get.responses[200].content["application/json"].schema
    expect(schema.title).toBeUndefined()
    expect(schema[metaKey]).toBeUndefined()
    expect(schema.properties.x.type).toBe("number")
    expect("description" in schema.properties.x).toBe(false)
    expect(schema.properties.x[metaKey]).toEqual({ type: { action: "replace", type: breaking, replaced: "string" } })
    expect(second.diffs.filter((d) => d.path[0] === "components")).toHaveLength(4)
  })

  // POLICY-61 decided: declaration-only applies only where the declaration is classified; with `components:
  // "unclassified"` the declaration diff is unclassified, so the usage keeps its annotation diff
  it("should keep annotation diffs at the usages with components: unclassified", () => {
    const after = exampleResource.clone()
    after.components.schemas.Pet.description = "some description"

    const { diffs } = compareOpenApi(exampleResource.clone(), after, { components: "unclassified" })
    const declaration = diffs.filter((d) => d.path[0] === "components")
    const usages = diffs.filter((d) => d.path[0] === "paths")
    expect(declaration).toMatchObject([{ path: ["components", "schemas", "Pet", "description"], type: unclassified }])
    expect(usages.length).toBeGreaterThan(0)
    expect(usages.every((d) => d.type === annotation && d.path[d.path.length - 1] === "description")).toBe(true)
  })

  // POLICY-60 decided: an annotation diff is left to the declaration only when the declaration reports the same change.
  // The oneOf branches could pair differently at a usage: at the declaration the nested `$ref` to A is nominal (b0 ~ a0
  // differ by two annotations), at the usage it is compared by content (A changed, which made b0 ~ a1 look closer, and
  // the description change of that pairing was reported nowhere). A usage now pairs the branches as the declaration
  // does (the diffs of nested references to an unchanged declaration and the diffs left to the declaration are counted
  // as the declaration counts them), so its annotation diffs are the declaration's.
  it("should pair combinator branches at a usage as the declaration does (POLICY-60)", () => {
    const mk = (A: unknown, oneOf: unknown[]) => ({
      openapi: "3.0.3",
      info: { title: "t", version: "1" },
      paths: {
        "/p": {
          get: {
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: { $ref: "#/components/schemas/U" } } },
              },
            },
          },
        },
      },
      components: { schemas: { A, U: { oneOf } } },
    })
    const b0 = { type: "object", properties: { p: { $ref: "#/components/schemas/A" } }, description: "one" }
    const a0 = { ...b0, title: "x", "x-foo": 1 }
    const a1 = { type: "object", properties: { p: { type: "number" } }, description: "two" }
    const before = mk({ type: "string", maxLength: 3 }, [b0])
    const after = mk({ type: "number" }, [a0, a1])
    const usage = "paths//p/get/responses/200/content/application/json/schema"
    const list = (diffs: { type: string; action: string; path: unknown[] }[]) =>
      diffs.map((d) => `${d.type} ${d.action} ${d.path.join("/")}`)

    expect(list(compareOpenApi(before, after).diffs)).toEqual([
      `${breaking} remove ${usage}/oneOf/0/properties/p/maxLength`,
      `${breaking} replace ${usage}/oneOf/0/properties/p/type`,
      `${breaking} add ${usage}/oneOf/1`,
      `${breaking} remove components/schemas/A/maxLength`,
      `${breaking} replace components/schemas/A/type`,
      `${annotation} add components/schemas/U/oneOf/0/title`,
      `${annotation} add components/schemas/U/oneOf/0/x-foo`,
      `${breaking} add components/schemas/U/oneOf/1`,
    ])
    // POLICY-61: with unclassified components the usage keeps its annotation diffs (same pairing)
    expect(list(compareOpenApi(before, after, { components: "unclassified" }).diffs).slice(0, 5)).toEqual([
      `${breaking} remove ${usage}/oneOf/0/properties/p/maxLength`,
      `${breaking} replace ${usage}/oneOf/0/properties/p/type`,
      `${annotation} add ${usage}/oneOf/0/title`,
      `${annotation} add ${usage}/oneOf/0/x-foo`,
      `${breaking} add ${usage}/oneOf/1`,
    ])
  })
})
