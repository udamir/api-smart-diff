import { addPatch, ExampleResource, removePatch, replacePatch } from "./helpers"
import { annotation, breaking, nonBreaking, unclassified } from "../src"

const example = new ExampleResource("jsonschema.yaml", "JsonSchema")

describe("Test Jsonschema diff", () => {
  it("replace of 'title' property should be 'annotation' change", () => {
    const path = ["properties", "age", "title"]
    const value = "size"

    const after = example.clone([replacePatch(path, value)])
    const diff = example.diff(after)

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, after: value, type: annotation }])
  })

  it("increase of 'minimum' property should be 'breaing' change", () => {
    const path = ["properties", "age", "minimum"]
    const oldValue = example.getValue(path)
    const value = oldValue + 1

    const after = example.clone([replacePatch(path, value)])
    const diff = example.diff(after)

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, before: oldValue, after: value, type: breaking }])
  })

  it("decrease of 'maximum' property should be 'breaing' change", () => {
    const path = ["properties", "age", "maximum"]
    const oldValue = example.getValue(path)
    const value = oldValue - 1

    const after = example.clone([replacePatch(path, value)])
    const diff = example.diff(after)

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, before: oldValue, after: value, type: breaking }])
  })

  it("add of 'exclusiveMinimum' property should be 'breaing' change", () => {
    const path = ["properties", "age", "exclusiveMinimum"]
    const value = true

    const after = example.clone([addPatch(path, value)])
    const diff = example.diff(after)

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, after: value, type: breaking }])
  })

  it("remove of required property should be 'non-breaing' change", () => {
    const path = ["required", 0]
    const oldValue = example.getValue(path)

    const after = example.clone([removePatch(path)])
    const diff = example.diff(after)

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, before: oldValue, type: nonBreaking }])
  })

  it("add of required property should be 'breaing' change", () => {
    const path = ["required", 1]
    const value = "age"

    const after = example.clone([addPatch(path, value)])
    const diff = example.diff(after)

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, after: value, type: breaking }])
  })

  it("change type in ref should be 'breaing' change", () => {
    const path = ["$refs", "NameType", "type"]
    const oldValue = example.getValue(path)
    const value = "number"

    const after = example.clone([replacePatch(path, value)])
    const diff = example.diff(after)

    expect(diff.length).toEqual(2)
    expect(diff).toMatchObject([
      { path: ["properties", "name", "type"], before: oldValue, after: value, type: breaking },
      { path, before: oldValue, after: value, type: unclassified },
    ])
  })
})
