import { breaking, DiffAction, serviceNodeRules } from "../src"
import { ExampleResource, removePatch } from "./helpers"

const metaKey = Symbol("diff")
const exampleResource = new ExampleResource("serviceNode.yaml", serviceNodeRules)

describe("Test service-node merge", () => {
  it("remove operation should be breaking change in meta", () => {
    const after = exampleResource.clone([removePatch(["children", 2])])
    const merged = exampleResource.merge(after, { metaKey, arrayMeta: true })

    const meta = merged.children[metaKey]
    expect(meta).toMatchObject({ 2: { action: DiffAction.remove, type: breaking } })
  })
})

describe("Test service-node merge", () => {
  it("remove operation should be breaking change in meta", () => {
    const after = exampleResource.clone([removePatch(["children", 2])])
    const merged = exampleResource.merge(after, { metaKey, arrayMeta: false })

    const meta = merged[metaKey]
    expect(meta.children.array).toMatchObject({ 2: { action: DiffAction.remove, type: breaking } })
  })
})
