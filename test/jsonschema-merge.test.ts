import { addPatch, ExampleResource, replacePatch } from "./helpers"
import { ActionType, annotation, breaking } from "../src"
import { resolveObjValue } from "../src/dereference"
import { DIFF_META_KEY } from "../src/context"

const example = new ExampleResource("jsonschema.yaml", "JsonSchema")

describe("Test Jsonschema merge", () => {
  it("replace of 'title' property should be 'annotation' change in meta", () => {
    const path = ["properties", "age", "title"]
    const oldValue = example.getValue(path)
    const value = "size"

    const after = example.clone([replacePatch(path, value)])
    const merged = example.merge(after)

    const obj = resolveObjValue(merged, "/properties/age")

    expect(obj).toHaveProperty(DIFF_META_KEY)
    expect(obj[DIFF_META_KEY]).toHaveProperty("title")
    expect(obj[DIFF_META_KEY].title).toMatchObject({ type: annotation, action: ActionType.replace, replaced: oldValue })
  })

  it("add of required property should be 'breaing' change in meta", () => {
    const path = ["required", 1]
    const value = "age"

    const after = example.clone([addPatch(path, value)])
    const merged = example.merge(after)
    const meta = merged[DIFF_META_KEY]

    expect(meta).toHaveProperty("required")
    expect(meta.required.array[1]).toMatchObject({ type: breaking, action: ActionType.add })
  })
})
