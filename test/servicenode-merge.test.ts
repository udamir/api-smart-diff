import { breaking, DiffAction, serviceNodeRules } from "../src"
import { ExampleResource, removePatch } from "./helpers"

const metaKey = Symbol("diff")
const exampleResource = new ExampleResource("serviceNode.yaml", serviceNodeRules)

describe("Test service-node merge", () => {
  it("remove operation should be breaking change in meta", () => {
    const path = ["children", 2]

    const after = exampleResource.clone([removePatch(path)])
    const merged = exampleResource.merge(after, { metaKey, arrayMeta: true })

    const meta = merged.children[metaKey]
    expect(meta).toMatchObject({ 2: { action: DiffAction.remove, type: breaking } })
  })
})
