import { addPatch, ExampleResource, removePatch, replacePatch } from "./helpers"
import { annotation, breaking, DiffAction, getValueByPath, nonBreaking, unclassified } from "../src"

const metaKey = Symbol("diff")
const exampleBefore = new ExampleResource("schema-before.yaml", "JsonSchema")
const exapmleAfter = new ExampleResource("schema-after.yaml", "JsonSchema")

describe("Test JsonSchema merge", () => {
  it("should merge 2 jsonschema correctly", () => {
    const after = exapmleAfter.clone()
    const merged = exampleBefore.merge(after, { metaKey, arrayMeta: true })

    expect(merged.required[metaKey]).toMatchObject({ 
      2: { type: nonBreaking, action: DiffAction.remove } 
    })
    expect(merged.patternProperties._name$[metaKey]).toMatchObject({ 
      type: { type: unclassified, action: DiffAction.replace } 
    })
    expect(merged.properties.age[metaKey]).toMatchObject({ 
      minimum: { type: breaking, action: DiffAction.replace },
      maximum: { type: breaking, action: DiffAction.replace },
      readOnly: { type: nonBreaking, action: DiffAction.replace },
      type: { type: breaking, action: DiffAction.replace },
      "x-param": { type: unclassified, action: DiffAction.remove },
    })
    expect(merged.properties.age.enum[metaKey]).toMatchObject({
      4: { type: nonBreaking, action: DiffAction.add },
    }),
    expect(merged.properties.completed_at[metaKey]).toMatchObject({ 
      description: { type: annotation, action: DiffAction.replace },
      format: { type: breaking, action: DiffAction.replace },
      pattern: { type: breaking, action: DiffAction.replace } 
    })
    expect(merged.properties.email[metaKey]).toMatchObject({ 
      default: { type: breaking, action: DiffAction.replace },
      deprecated: { type: nonBreaking, action: DiffAction.replace },
    })
    expect(merged.properties.items[metaKey]).toMatchObject({ 
      description: { type: annotation, action: DiffAction.replace },
    })
    expect(merged.properties.name.examples[metaKey]).toMatchObject({ 
      0: { type: annotation, action: DiffAction.remove },
    })
    expect(merged.properties.permissions.properties[metaKey]).toMatchObject({ 
      ids: { type: breaking, action: DiffAction.remove },
      ids12: { type: nonBreaking, action: DiffAction.add },
    })
    expect(merged.properties.plan.anyOf[metaKey]).toMatchObject({ 
      2: { type: breaking, action: DiffAction.remove },
    })
    expect(merged.properties.plan.anyOf[0].properties.bar[metaKey]).toMatchObject({ 
      type: { type: breaking, action: DiffAction.replace },
    })
    expect(merged.properties.plan.anyOf[0].properties.baz[metaKey]).toMatchObject({ 
      type: { type: breaking, action: DiffAction.replace },
    })
    expect(merged.properties.plan.anyOf[1][metaKey]).toMatchObject({ 
      description: { type: annotation, action: DiffAction.add },
    })
  })
})

const example2 = new ExampleResource("jsonschema.yaml", "JsonSchema")

describe("Test Jsonschema merge options", () => {
  it("should be 'annotation' change in meta on replace of 'title' property", () => {
    const path = ["properties", "age", "title"]
    const oldValue = example2.getValue(path)
    const value = "size"

    const after = example2.clone([replacePatch(path, value)])
    const merged = example2.merge(after, { metaKey })

    const meta = merged.properties.age[metaKey]

    expect(meta).toHaveProperty("title")
    expect(meta.title).toMatchObject({ type: annotation, action: DiffAction.replace, replaced: oldValue })
  })

  it("should be meta in object if arrayMeta is false", () => {
    const path = ["required", 1]
    const value = "age"

    const after = example2.clone([addPatch(path, value)])
    const merged = example2.merge(after, { metaKey })
    const meta = merged[metaKey]

    expect(meta).toHaveProperty("required")
    expect(meta.required.array[1]).toMatchObject({ type: breaking, action: DiffAction.add })
  })

  it("should be meta in array if arrayMeta is true", () => {
    const path = ["required", 1]
    const value = "age"

    const after = example2.clone([addPatch(path, value)])
    const merged = example2.merge(after, { metaKey, arrayMeta: true })
    const meta = merged.required[metaKey]

    expect(meta[1]).toMatchObject({ type: breaking, action: DiffAction.add })
  })

  it("should be 'breaking' change on merge with deleted enum item", () => {
    const path = ["properties", 'foo', "properties", "baz", "enum", 2]

    const after = example2.clone([removePatch(path)])
    const merged = example2.merge(after, { metaKey, arrayMeta: true })
    const meta = getValueByPath(merged, path.slice(0,-1))[metaKey]

    expect(meta).toMatchObject({ 2: { action: "remove", type: breaking }})
  })

  it("should be 'breaking' change on merge with replaced enum item", () => {
    const path = ["properties", 'foo', "properties", "baz", "enum", 3]
    const oldValue = example2.getValue(path)

    const after = example2.clone([replacePatch(path, 50)])
    const merged = example2.merge(after, { metaKey, arrayMeta: true })
    const meta = getValueByPath(merged, path.slice(0,-1))[metaKey]

    expect(meta).toMatchObject({ 3: { action: "replace", replaced: oldValue, type: breaking }})
  })

  it("should be 'non-breaking' change on merge with added enum item", () => {
    const path = ["properties", 'foo', "properties", "baz", "enum", "-"]
    const value = 50

    const after = example2.clone([addPatch(path, value)])
    const merged = example2.merge(after, { metaKey })
    const meta = getValueByPath(merged, path.slice(0, -2))[metaKey]
    const mergedEnum = getValueByPath(merged, path.slice(0, -1))

    expect(mergedEnum[4]).toEqual(value)
    expect(meta).toMatchObject({ enum: { array: { 4: { action: "add", type: nonBreaking }}}})
  })
})
