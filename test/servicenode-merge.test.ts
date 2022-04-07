import { annotation, breaking, DiffAction, serviceNodeRules } from "../src"
import { ExampleResource, removePatch, replacePatch } from "./helpers"

const metaKey = Symbol("diff")
const exampleResource = new ExampleResource("serviceNode.yaml", serviceNodeRules)

describe("Test service-node merge", () => {
  it("should be breaking change in array meta (remove operation)", () => {
    const after = exampleResource.clone([removePatch(["children", 2])])
    const merged = exampleResource.merge(after, { metaKey, arrayMeta: true })

    const meta = merged.children[metaKey]
    expect(meta).toMatchObject({ 2: { action: DiffAction.remove, type: breaking } })
  })

  it("should be breaking change in object meta (remove operation)", () => {
    const after = exampleResource.clone([removePatch(["children", 2])])
    const merged = exampleResource.merge(after, { metaKey, arrayMeta: false })

    const meta = merged[metaKey]
    expect(meta.children.array).toMatchObject({ 2: { action: DiffAction.remove, type: breaking } })
  })

  it("should be annotation change in meta (update summary)", () => {
    const after = exampleResource.clone([replacePatch(["children", 0, "data", "summary"], "Todos list")])
    const merged = exampleResource.merge(after, { metaKey, arrayMeta: false })

    const meta = merged.children[0].data[metaKey]
    expect(meta).toMatchObject({ "summary": { action: DiffAction.replace, type: annotation } })
  })

  it("should be breaking change in meta (remove responsey)", () => {
    const after = exampleResource.clone([removePatch(["children", 0, "data", "responses", 1])])
    const merged = exampleResource.merge(after, { metaKey, arrayMeta: true })

    const meta = merged.children[0].data.responses[metaKey]
    expect(meta).toMatchObject({ 1: { action: DiffAction.remove, type: breaking } })
  })

  it("should be breaking change in meta (remove responsey)", () => {
    const after = exampleResource.clone([removePatch(["children", 0, "data", "responses", 1])])
    const merged = exampleResource.merge(after, { metaKey, arrayMeta: true })

    const meta = merged.children[0].data.responses[metaKey]
    expect(meta).toMatchObject({ 1: { action: DiffAction.remove, type: breaking } })
  })
})
