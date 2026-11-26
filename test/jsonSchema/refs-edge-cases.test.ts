import { apiCompare, breaking, compareJsonSchema, jsonSchemaRules, nonBreaking } from "../../src"
import { ExampleResource } from "../helpers"

const metaKey = Symbol("diff")
const s = { type: "string" }
const n = { type: "number" }

const withDefs = (props: Record<string, unknown>, $defs: Record<string, unknown>) => ({
  type: "object",
  properties: props,
  $defs,
})

describe("Block B4 — $ref resolution edge cases", () => {
  it("B4.1 $ref -> inline with identical content yields no diffs", () => {
    const before = withDefs({ a: { $ref: "#/$defs/X" } }, { X: s })
    const after = withDefs({ a: s }, { X: s })
    expect(compareJsonSchema(before, after, { metaKey }).diffs).toEqual([])
    expect(compareJsonSchema(after, before, { metaKey }).diffs).toEqual([])
  })

  it("B4.2 renaming a definition without changing content produces no diff at the usage site", () => {
    const before = withDefs({ a: { $ref: "#/$defs/X" } }, { X: s })
    const after = withDefs({ a: { $ref: "#/$defs/Y" } }, { Y: s })
    const { diffs } = compareJsonSchema(before, after, { metaKey })

    expect(diffs.filter((d) => d.path[0] === "properties")).toEqual([])
    expect(diffs.every((d) => d.type === nonBreaking)).toBe(true)
  })

  it("B4.3 renaming a definition and changing its content reports the change at the usage site", () => {
    const before = withDefs({ a: { $ref: "#/$defs/X" } }, { X: s })
    const after = withDefs({ a: { $ref: "#/$defs/Y" } }, { Y: n })
    const { diffs } = compareJsonSchema(before, after, { metaKey })

    expect(diffs).toContainEqual(expect.objectContaining({ path: ["properties", "a", "type"], type: breaking }))
  })

  it("B4.4 chained references are followed to the final target", () => {
    const mk = (leaf: unknown) =>
      withDefs({ a: { $ref: "#/$defs/A" } }, { A: { $ref: "#/$defs/B" }, B: { $ref: "#/$defs/C" }, C: leaf })
    const { diffs } = compareJsonSchema(mk(s), mk(n), { metaKey })

    expect(diffs).toContainEqual(expect.objectContaining({ path: ["properties", "a", "type"], type: breaking }))
  })

  it("B4.5 a self-recursive schema terminates and classifies the inner change", () => {
    const mk = (leaf: unknown) => ({
      $ref: "#/$defs/Node",
      $defs: { Node: { type: "object", properties: { val: leaf, next: { $ref: "#/$defs/Node" } } } },
    })
    const { diffs } = compareJsonSchema(mk(s), mk(n), { metaKey })

    expect(diffs.length).toBeGreaterThanOrEqual(1)
    expect(diffs.every((d) => d.type === breaking && d.path[d.path.length - 1] === "type")).toBe(true)
  })

  it("B4.6 a reference to the document root terminates", () => {
    const mk = (leaf: unknown) => ({ type: "object", properties: { child: { $ref: "#" }, val: leaf } })
    const { diffs } = compareJsonSchema(mk(s), mk(n), { metaKey })
    expect(diffs).toMatchObject([{ path: ["properties", "val", "type"], type: breaking }])
  })

  // ISSUE-07 (fixed): cycle detection is a string-prefix test on JSON pointers; "#/properties/ab" starts with "#/properties/a",
  // so the second usage is mistaken for a cycle and its content is never compared.
  it("B4.7 sibling properties whose names share a prefix are both resolved", () => {
    const mk = (leaf: unknown) => withDefs({ a: { $ref: "#/$defs/X" }, ab: { $ref: "#/$defs/X" } }, { X: leaf })
    const { diffs } = compareJsonSchema(mk(s), mk(n), { metaKey })

    expect(diffs).toContainEqual(expect.objectContaining({ path: ["properties", "a", "type"] }))
    expect(diffs).toContainEqual(expect.objectContaining({ path: ["properties", "ab", "type"] }))
  })

  // ISSUE-07 (fixed): "#/$defs/PetList/items" starts with "#/$defs/Pet", so Pet is never resolved inside PetList.
  it("B4.8 a definition whose name is a prefix of another definition is resolved inside it", () => {
    const mk = (leaf: unknown) => ({
      $defs: {
        Pet: { type: "object", properties: { name: leaf } },
        PetList: { type: "array", items: { $ref: "#/$defs/Pet" } },
      },
    })
    const { diffs } = compareJsonSchema(mk(s), mk(n), { metaKey })

    expect(diffs).toContainEqual(
      expect.objectContaining({ path: ["$defs", "PetList", "items", "properties", "name", "type"] }),
    )
  })

  // ISSUE-08 (fixed): the $ref result cache and the cycle history live in the closure created by `jsonSchemaRules()`; reusing
  // one rules object for a second comparison serves stale results (or stale "cycle" verdicts) from the first one.
  it("B4.9 a rules object can be reused across independent comparisons", () => {
    const rules = jsonSchemaRules()
    const mk = (leaf: unknown) => withDefs({ a: { $ref: "#/$defs/X" } }, { X: leaf })

    const first = compareJsonSchema(mk(s), mk(s), { rules })
    const second = compareJsonSchema(mk(s), mk(n), { rules })

    expect(first.diffs).toEqual([])
    expect(second.diffs).toContainEqual(expect.objectContaining({ path: ["properties", "a", "type"], type: breaking }))
  })

  // ISSUE-09 (fixed): on a cache hit the diffs are re-annotated with the context of the `$ref` node instead of the changed
  // node, so the second usage gets a generic/wrong description.
  it("B4.10 every usage of a changed $ref gets the same specific description", () => {
    const mk = (leaf: unknown) => withDefs({ a: { $ref: "#/$defs/X" }, b: { $ref: "#/$defs/X" } }, { X: leaf })
    const { diffs } = compareJsonSchema(mk(s), mk(n), { metaKey })

    const a = diffs.find((d) => d.path.join("/") === "properties/a/type")
    const b = diffs.find((d) => d.path.join("/") === "properties/b/type")
    expect(a?.description).toBe("[Replaced] type definition of `a` from `string` to `number`")
    expect(b?.description).toBe("[Replaced] type definition of `b` from `string` to `number`")
  })

  // ISSUE-09 (fixed): the cached `merged` subtree object is reused for every usage, so the merged document contains aliases.
  it("B4.11 merged subtrees of different $ref usages are distinct objects", () => {
    const mk = (leaf: unknown) => withDefs({ a: { $ref: "#/$defs/X" }, b: { $ref: "#/$defs/X" } }, { X: leaf })
    const { merged } = compareJsonSchema(mk(s), mk(n), { metaKey })

    expect(merged.properties.a).not.toBe(merged.properties.b)
  })

  it("B4.12 a broken reference does not throw and is compared as a plain value", () => {
    const before = withDefs({ a: { $ref: "#/$defs/Missing" } }, {})
    expect(compareJsonSchema(before, structuredClone(before), { metaKey }).diffs).toEqual([])

    const fixed = withDefs({ a: { $ref: "#/$defs/X" } }, { X: s })
    const { diffs } = compareJsonSchema(before, fixed, { metaKey })
    expect(diffs.length).toBeGreaterThan(0)
  })

  it("B4.13 keywords next to a $ref are merged into the resolved schema and compared", () => {
    const mk = (desc: string) => withDefs({ a: { $ref: "#/$defs/X", description: desc } }, { X: s })
    const { diffs } = compareJsonSchema(mk("one"), mk("two"), { metaKey })
    expect(diffs).toMatchObject([{ path: ["properties", "a", "description"], action: "replace" }])
  })

  it("B4.14 both `definitions` and `$defs` are crawled and classified", () => {
    const def = compareJsonSchema({ definitions: { X: s } }, { definitions: { X: n } }, { metaKey })
    expect(def.diffs).toMatchObject([{ path: ["definitions", "X", "type"], type: breaking }])

    const defs = compareJsonSchema({ $defs: { X: s } }, { $defs: { X: n } }, { metaKey })
    expect(defs.diffs).toMatchObject([{ path: ["$defs", "X", "type"], type: breaking }])
  })

  it("B4.15 external references are left untouched and do not throw", () => {
    const mk = (ref: string) => withDefs({ a: { $ref: ref } }, {})
    expect(compareJsonSchema(mk("ext.json#/X"), mk("ext.json#/X"), { metaKey }).diffs).toEqual([])
    expect(compareJsonSchema(mk("ext.json#/X"), mk("ext.json#/Y"), { metaKey }).diffs).toHaveLength(1)
  })

  it("B4.16 the same $ref used in many places reports every usage", () => {
    const props = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`p${i}`, { $ref: "#/$defs/X" }]))
    const { diffs } = compareJsonSchema(withDefs(props, { X: s }), withDefs(props, { X: n }), { metaKey })

    const usages = diffs.filter((d) => d.path[0] === "properties")
    expect(usages).toHaveLength(5)
    expect(usages.every((d) => d.type === breaking)).toBe(true)
  })
})

describe("Block B4 — cyclic $ref chains with sibling content (bundled documents)", () => {
  // ISSUE-51 (fixed): `apiCompare(doc, doc)` never returned for bundled documents whose `$ref` cycles carry sibling
  // content (`{ $ref, description }`): the root-level allOf merge resolved the cycle into itself. The compare session
  // now owns `$ref` resolution (reference stack, ancestor check) and the engine guards against cyclic object graphs.
  const self = {
    definitions: {
      thing: { title: "thing", $ref: "#/definitions/thing", description: "points to itself" },
    },
  }
  const pet = {
    title: "pet",
    type: "object",
    properties: {
      age: { $ref: "#/definitions/age" },
      name: { $ref: "#/definitions/name" },
      species: { type: "string", enum: ["cat", "dog", "bird", "fish"] },
    },
  }
  const ancestor = {
    definitions: {
      name: { type: "string" },
      age: { type: "number" },
      person: {
        title: "person",
        properties: {
          spouse: { $ref: "#/definitions/person", description: "extends person" },
          pet: { $ref: "#/definitions/pet", description: "extends pet" },
          name: { type: "string" },
        },
      },
      pet,
    },
  }
  const indirect = {
    definitions: {
      name: { type: "string" },
      age: { type: "number" },
      parent: {
        title: "parent",
        properties: {
          name: { type: "string" },
          children: { items: { $ref: "#/definitions/child", description: "extends child" }, type: "array" },
        },
      },
      child: {
        title: "child",
        properties: {
          parents: { items: { $ref: "#/definitions/parent", description: "extends parent" }, type: "array" },
          pet: { $ref: "#/definitions/pet", description: "extends pet" },
          name: { type: "string" },
        },
      },
      pet,
    },
  }
  const indirectAncestor = {
    definitions: {
      name: { type: "string" },
      age: { type: "number" },
      pet,
      parent: {
        title: "parent",
        properties: {
          name: { type: "string" },
          child: { $ref: "#/definitions/child", description: "extends child" },
        },
      },
      child: {
        title: "child",
        properties: {
          pet: { $ref: "#/definitions/pet", description: "extends pet" },
          name: { type: "string" },
          children: {
            items: { $ref: "#/definitions/child", description: "extends child" },
            type: "array",
            description: "children",
          },
        },
      },
    },
  }
  const fixtures: Record<string, unknown> = {
    self,
    ancestor,
    indirect,
    indirectAncestor,
    "circular-foo": new ExampleResource("circular-foo.json").clone(),
    "circular-bar": new ExampleResource("circular-bar.json").clone(),
  }

  for (const [name, doc] of Object.entries(fixtures)) {
    it(`B4.17 self-comparing the cyclic document "${name}" terminates without diffs`, () => {
      const started = performance.now()
      const { diffs } = apiCompare(structuredClone(doc), structuredClone(doc), { metaKey })
      expect(performance.now() - started).toBeLessThan(2000)
      expect(diffs).toEqual([])
    })
  }

  it("B4.18 a change inside a cyclic chain with sibling content is reported at every usage", () => {
    const after = structuredClone(ancestor)
    after.definitions.age.type = "integer"
    const { diffs } = apiCompare(structuredClone(ancestor), after, { metaKey })
    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.every((d) => d.path[d.path.length - 1] === "type" && d.type === breaking)).toBe(true)
  })
})

// ISSUE-320 (fixed) (P8f): a plain `$ref` facing an inline combinator was wrapped into a one-branch combinator before
// the reference was resolved, so a reference to `{ oneOf, discriminator }` compared with an identical inline copy moved
// the discriminator ("[Removed] discriminator `kind`" at `oneOf/0` and "[Added]" at the root)
describe("Block B4 — a reference facing an inline combinator (ISSUE-320)", () => {
  it("B4.19 a reference is resolved before it is compared with an inline combinator", () => {
    const cat = { type: "object", properties: { kind: s, meow: s } }
    const poly = { oneOf: [{ $ref: "#/$defs/Cat" }], discriminator: { propertyName: "kind" } }
    const doc = (pet: unknown) => ({ type: "object", properties: { pet }, $defs: { Pet: poly, Cat: cat } })
    expect(compareJsonSchema(doc({ $ref: "#/$defs/Pet" }), doc(poly), { metaKey }).diffs).toEqual([])
    expect(compareJsonSchema(doc(poly), doc({ $ref: "#/$defs/Pet" }), { metaKey }).diffs).toEqual([])
    // a change is reported as between the inline schemas
    const paths = (before: unknown) =>
      compareJsonSchema(doc(before), doc({ oneOf: poly.oneOf }), { metaKey }).diffs.map((d) => d.path.join("/"))
    expect(paths({ $ref: "#/$defs/Pet" })).toEqual(paths(poly))
    expect(paths(poly)).toHaveLength(1)
  })
})
