import { addPatch, ExampleResource, removePatch, replacePatch } from "./helpers"
import { DiffAction, DIFF_META_KEY } from "../src/constants"
import { JsonCompare } from "../src/jsonCompare"

const example = new ExampleResource("jsonschema.yaml", "JsonSchema")

describe("Test 'compare' method in JsonCompare", () => {
  it("should be 'replace' diff on value change", () => {
    const path = ["properties", "age", "title"]
    const value = "size"

    const after = example.clone([replacePatch(path, value)])
    const diff = new JsonCompare(example.clone(), after).compare()


    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, after: value, action: DiffAction.replace }])
  })

  it("should be 'remove' diff on property delete", () => {
    const path = ["properties", "age", "minimum"]
    const oldValue = example.getValue(path)

    const after = example.clone([removePatch(path)])
    const diff = new JsonCompare(example.clone(), after).compare()

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, before: oldValue, action: DiffAction.remove }])
  })

  it("should be 'add' diff on property add", () => {
    const path = ["properties", "age", "description"]
    const value = "test description"

    const after = example.clone([addPatch(path, value)])
    const diff = new JsonCompare(example.clone(), after).compare()

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, after: value, action: DiffAction.add }])
  })

  it("should be 'replace' diff on array item change", () => {
    const path = ["required", 0]
    const value = "name"

    const after = example.clone([replacePatch(path, value)])
    const diff = new JsonCompare(example.clone(), after).compare()

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, after: value, action: DiffAction.replace }])
  })

  it("should be 'remove' diff on array item delete", () => {
    const path = ["required", 0]
    const oldValue = example.getValue(path)

    const after = example.clone([removePatch(path)])
    const diff = new JsonCompare(example.clone(), after).compare()

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, before: oldValue, action: DiffAction.remove }])
  })

  it("should be 'add' diff on push array item", () => {
    const path = ["required", 1]
    const value = "name"

    const after = example.clone([addPatch(path, value)])
    const diff = new JsonCompare(example.clone(), after).compare()

    expect(diff.length).toEqual(1)
    expect(diff).toMatchObject([{ path, after: value, action: DiffAction.add }])
  })
})

describe("Test 'buildDiffTree' method in JsonCompare", () => {
  it("should be 'replace' diff on value change", () => {
    const path = ["properties", "age", "title"]
    const value = "size"

    const after = example.clone([replacePatch(path, value)])
    const diffTree = new JsonCompare(example.clone(), after).buildDiffTree()

    expect(diffTree.properties.age[DIFF_META_KEY]).toMatchObject({ title: { after: value, action: DiffAction.replace }})
  })

  it("should be 'remove' diff on property delete", () => {
    const path = ["properties", "age", "minimum"]
    const oldValue = example.getValue(path)

    const after = example.clone([removePatch(path)])
    const diffTree = new JsonCompare(example.clone(), after).buildDiffTree()

    expect(diffTree.properties.age[DIFF_META_KEY].minimum).toMatchObject({ before: oldValue, action: DiffAction.remove })
  })

  it("should be 'add' diff on property add", () => {
    const path = ["properties", "age", "description"]
    const value = "test description"

    const after = example.clone([addPatch(path, value)])
    const diffTree = new JsonCompare(example.clone(), after).buildDiffTree()

    expect(diffTree.properties.age[DIFF_META_KEY].description).toMatchObject({ after: value, action: DiffAction.add })
  })

  it("should be 'replace' diff on array item change", () => {
    const path = ["required", 0]
    const oldValue = example.getValue(path)
    const value = "name"

    const after = example.clone([replacePatch(path, value)])
    const diffTree = new JsonCompare(example.clone(), after).buildDiffTree()

    expect(diffTree.required[DIFF_META_KEY][0]).toMatchObject({ before: oldValue, after: value, action: DiffAction.replace })
  })

  it("should be 'remove' diff on array item delete", () => {
    const path = ["required", 0]
    const oldValue = example.getValue(path)

    const after = example.clone([removePatch(path)])
    const diffTree = new JsonCompare(example.clone(), after).buildDiffTree()

    expect(diffTree.required[DIFF_META_KEY][0]).toMatchObject({ before: oldValue, action: DiffAction.remove })
  })

  it("should be 'add' diff on push array item", () => {
    const path = ["required", 1]
    const value = "name"

    const after = example.clone([addPatch(path, value)])
    const diffTree = new JsonCompare(example.clone(), after).buildDiffTree()

    expect(diffTree.required[DIFF_META_KEY][1]).toMatchObject({ after: value, action: DiffAction.add })
  })
})

describe("Test 'merge' method in JsonMerge", () => {
  it("should be 'replace' diff on value change", () => {
    const path = ["properties", "age", "title"]
    const oldValue = example.getValue(path)
    const value = "size"

    const after = example.clone([replacePatch(path, value)])
    const merged = new JsonCompare(example.clone(), after).merge()

    expect(merged.properties.age[DIFF_META_KEY].title).toMatchObject({ replaced: oldValue, action: DiffAction.replace })
    after.properties.age[DIFF_META_KEY] = { title: { replaced: oldValue, action: DiffAction.replace }}
    expect(merged).toEqual(after)
  })

  it("should be 'remove' diff on property delete", () => {
    const path = ["properties", "age", "minimum"]

    const after = example.clone([removePatch(path)])
    const merged = new JsonCompare(example.clone(), after).merge()

    expect(merged.properties.age[DIFF_META_KEY].minimum).toMatchObject({ action: DiffAction.remove })
  })

  it("should be 'add' diff on property add", () => {
    const path = ["properties", "age", "description"]
    const value = "test description"

    const after = example.clone([addPatch(path, value)])
    const merged = new JsonCompare(example.clone(), after).merge()

    expect(merged.properties.age[DIFF_META_KEY].description).toMatchObject({ action: DiffAction.add })
    expect(merged.properties.age.description).toEqual(value)
  })

  it("should be 'replace' diff on array item change", () => {
    const path = ["required", 0]
    const oldValue = example.getValue(path)
    const value = "name"

    const after = example.clone([replacePatch(path, value)])
    const merged = new JsonCompare(example.clone(), after, { arrayMeta: true }).merge()

    expect(merged.required[DIFF_META_KEY][0]).toMatchObject({ replaced: oldValue, action: DiffAction.replace })
    expect(merged.required[0]).toEqual(value)
  })

  it("should be 'remove' diff on array item delete", () => {
    const path = ["required", 0]
    const oldValue = example.getValue(path)

    const after = example.clone([removePatch(path)])
    const merged = new JsonCompare(example.clone(), after, { arrayMeta: true }).merge()

    expect(merged.required[DIFF_META_KEY][0]).toMatchObject({ action: DiffAction.remove })
    expect(merged.required[0]).toEqual(oldValue)
  })

  it("should be 'add' diff on push array item", () => {
    const path = ["required", 1]
    const value = "name"

    const after = example.clone([addPatch(path, value)])
    const merged = new JsonCompare(example.clone(), after, { arrayMeta: true }).merge()

    expect(merged.required[DIFF_META_KEY][1]).toMatchObject({ action: DiffAction.add })
    expect(merged.required[1]).toEqual(value)
  })
})
