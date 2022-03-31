import { addPatch, ExampleResource, replacePatch } from "./helpers"
import { annotation, breaking, DiffAction } from "../src"

const metaKey = Symbol("diff")
const example = new ExampleResource("jsonschema.yaml", "JsonSchema")

describe("Test Jsonschema merge", () => {
  it("replace of 'title' property should be 'annotation' change in meta", () => {
    const path = ["properties", "age", "title"]
    const oldValue = example.getValue(path)
    const value = "size"

    const after = example.clone([replacePatch(path, value)])
    const merged = example.merge(after, { metaKey })

    const meta = merged.properties.age[metaKey]

    expect(meta).toHaveProperty("title")
    expect(meta.title).toMatchObject({ type: annotation, action: DiffAction.replace, replaced: oldValue })
  })

  it("array change meta should be in object if arrayMeta is false", () => {
    const path = ["required", 1]
    const value = "age"

    const after = example.clone([addPatch(path, value)])
    const merged = example.merge(after, { metaKey })
    const meta = merged[metaKey]

    expect(meta).toHaveProperty("required")
    expect(meta.required.array[1]).toMatchObject({ type: breaking, action: DiffAction.add })
  })

  it("array change meta should be in array if arrayMeta is true", () => {
    const path = ["required", 1]
    const value = "age"

    const after = example.clone([addPatch(path, value)])
    const merged = example.merge(after, { metaKey, arrayMeta: true })
    const meta = merged.required[metaKey]

    expect(meta[1]).toMatchObject({ type: breaking, action: DiffAction.add })
  })
})
