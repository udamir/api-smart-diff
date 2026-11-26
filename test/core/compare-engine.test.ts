import {
  type CompareRules,
  type MappingResolver,
  DIFF_META_KEY,
  allAnnotation,
  allBreaking,
  allNonBreaking,
  apiCompare,
  breaking,
  compare,
  compareJsonSchema,
  enumMappingResolver,
  nonBreaking,
  unclassified,
} from "../../src"
import { refsCompareResolver } from "../../src/jsonSchema"

const metaKey = Symbol("diff")
const anyRules: CompareRules = { $: allBreaking, "/**": { $: allBreaking } }

// every diff carries the scope it was compared in (DESIGN_PROPOSALS §11.5); plain `compare` runs in the root scope

describe("Block A1 — core compare engine basics", () => {
  it("A1.1 identical documents produce no diffs and a merged copy without meta", () => {
    const doc = { a: 1, b: { c: [1, 2, { d: "x" }] }, e: null }
    const { diffs, merged, rootMergeMeta } = compare(doc, structuredClone(doc), { metaKey, rules: anyRules })

    expect(diffs).toEqual([])
    expect(merged).toEqual(doc)
    expect(merged[metaKey]).toBeUndefined()
    expect(rootMergeMeta).toBeUndefined()
  })

  it("A1.2 primitive roots are compared and classified by the root rule", () => {
    const { diffs, merged, rootMergeMeta } = compare("a", "b", { rules: { $: allBreaking } })

    expect(diffs).toEqual([{ action: "replace", path: [], before: "a", after: "b", type: breaking, scope: "root" }])
    expect(merged).toBe("b")
    expect(rootMergeMeta).toEqual({ action: "replace", type: breaking, replaced: "a" })
  })

  it("A1.3 null values are handled as a distinct type", () => {
    expect(compare(null, null, { rules: anyRules }).diffs).toEqual([])
    expect(compare(null, 1, { rules: anyRules }).diffs).toMatchObject([{ action: "replace", before: null, after: 1 }])
    expect(compare({ a: null }, { a: 0 }, { rules: anyRules }).diffs).toMatchObject([
      { path: ["a"], action: "replace" },
    ])
    expect(compare({ a: null }, { a: null }, { rules: anyRules }).diffs).toEqual([])
  })

  it("A1.4 type change object -> primitive yields a single replace with merged = after", () => {
    const { diffs, merged } = compare({ a: { b: 1 } }, { a: 5 }, { metaKey, rules: anyRules })

    expect(diffs).toEqual([
      { action: "replace", path: ["a"], before: { b: 1 }, after: 5, type: breaking, scope: "root" },
    ])
    expect(merged.a).toBe(5)
    expect(merged[metaKey]).toEqual({ a: { action: "replace", type: breaking, replaced: { b: 1 } } })
  })

  it("A1.5 nested add/remove/replace are reported with full paths and meta on the parent node", () => {
    const before = { x: { keep: 1, gone: 2, changed: "a" } }
    const after = { x: { keep: 1, changed: "b", fresh: true } }
    const { diffs, merged } = compare(before, after, { metaKey, rules: anyRules })

    expect(diffs).toHaveLength(3)
    expect(diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "remove", path: ["x", "gone"], before: 2 }),
        expect.objectContaining({ action: "replace", path: ["x", "changed"], before: "a", after: "b" }),
        expect.objectContaining({ action: "add", path: ["x", "fresh"], after: true }),
      ]),
    )
    // merged document keeps removed values so the consumer can render both sides
    expect(merged.x).toMatchObject({ keep: 1, gone: 2, changed: "b", fresh: true })
    expect(merged.x[metaKey]).toEqual({
      gone: { action: "remove", type: breaking },
      changed: { action: "replace", type: breaking, replaced: "a" },
      fresh: { action: "add", type: breaking },
    })
    expect(merged[metaKey]).toBeUndefined()
  })

  it("A1.6 metaKey defaults to '$diff' and accepts a custom string", () => {
    const d = compare({ a: 1 }, { a: 2 }, { rules: anyRules })
    expect(d.merged[DIFF_META_KEY]).toEqual({ a: { action: "replace", type: breaking, replaced: 1 } })

    const s = compare({ a: 1 }, { a: 2 }, { rules: anyRules, metaKey: "__meta" })
    expect(s.merged.__meta).toBeDefined()
    expect(s.merged[DIFF_META_KEY]).toBeUndefined()
  })

  it("A1.7 arrayMeta switches array meta between the parent node and the array itself", () => {
    const before = { arr: [1, 2] }
    const after = { arr: [1, 3] }

    const parent = compare(before, after, { metaKey, rules: anyRules })
    expect(parent.merged[metaKey]).toEqual({
      arr: { array: { 1: { action: "replace", type: breaking, replaced: 2 } } },
    })
    expect(parent.merged.arr[metaKey]).toBeUndefined()

    const own = compare(before, after, { metaKey, rules: anyRules, arrayMeta: true })
    expect(own.merged[metaKey]).toBeUndefined()
    expect(own.merged.arr[metaKey]).toEqual({ 1: { action: "replace", type: breaking, replaced: 2 } })
  })

  it("A1.8 arrays are mapped by index by default", () => {
    const removed = compare({ a: [1, 2, 3] }, { a: [1, 2] }, { metaKey, rules: anyRules })
    expect(removed.diffs).toEqual([{ action: "remove", path: ["a", 2], before: 3, type: breaking, scope: "root" }])
    expect(removed.merged.a).toEqual([1, 2, 3])

    const added = compare({ a: [1, 2] }, { a: [1, 2, 3] }, { metaKey, rules: anyRules })
    expect(added.diffs).toEqual([{ action: "add", path: ["a", 2], after: 3, type: breaking, scope: "root" }])
    expect(added.merged.a).toEqual([1, 2, 3])

    const replaced = compare({ a: [1, 2] }, { a: [1, 9] }, { metaKey, rules: anyRules })
    expect(replaced.diffs).toEqual([
      { action: "replace", path: ["a", 1], before: 2, after: 9, type: breaking, scope: "root" },
    ])
  })

  it("A1.9 arrays of objects are compared element-wise with nested meta", () => {
    const { diffs, merged } = compare(
      { a: [{ id: 1 }, { id: 2 }] },
      { a: [{ id: 1 }, { id: 3 }] },
      { metaKey, rules: anyRules },
    )

    expect(diffs).toEqual([
      { action: "replace", path: ["a", 1, "id"], before: 2, after: 3, type: breaking, scope: "root" },
    ])
    expect(merged.a[1][metaKey]).toEqual({ id: { action: "replace", type: breaking, replaced: 2 } })
  })

  it("A1.10 rename is reported on the parent path and meta is keyed by the new name", () => {
    const renameMapping: MappingResolver<string> = (before, after) => ({
      added: Object.keys(after).filter((k) => k !== "b"),
      removed: Object.keys(before).filter((k) => k !== "a"),
      mapped: { a: "b" },
    })
    const rules: CompareRules = { $: allBreaking, mapping: renameMapping, "/**": { $: allNonBreaking } }
    const { diffs, merged } = compare({ a: 1 }, { b: 1 }, { metaKey, rules })

    expect(diffs).toEqual([{ action: "rename", path: [], before: "a", after: "b", type: nonBreaking, scope: "root" }])
    expect(merged).toMatchObject({ b: 1 })
    expect(merged).not.toHaveProperty("a")
    expect(merged[metaKey]).toEqual({ b: { action: "rename", type: nonBreaking, replaced: "a" } })
  })

  it("A1.11 'skip' rule keeps the before value and emits no diff", () => {
    const rules: CompareRules = { "/x": { skip: true }, "/**": { $: allBreaking } }
    const { diffs, merged } = compare({ x: 1, y: 1 }, { x: 2, y: 2 }, { metaKey, rules })

    expect(diffs).toEqual([{ action: "replace", path: ["y"], before: 1, after: 2, type: breaking, scope: "root" }])
    expect(merged.x).toBe(1)
  })

  it("A1.12 keys containing JSON-pointer special characters are preserved", () => {
    const before = { "a/b": 1, "c~d": 1, "": 1 }
    const after = { "a/b": 2, "c~d": 2, "": 2 }
    const { diffs, merged } = compare(before, after, { metaKey, rules: anyRules })

    expect(diffs.map((d) => d.path)).toEqual(expect.arrayContaining([["a/b"], ["c~d"], [""]]))
    expect(merged).toMatchObject(after)
  })

  it("A1.13 a node without any matching rule is classified as unclassified", () => {
    const { diffs } = compare({ a: 1 }, { a: 2 }, { rules: {} })
    expect(diffs).toEqual([{ action: "replace", path: ["a"], before: 1, after: 2, type: unclassified, scope: "root" }])
  })

  // POLICY-58 (decided after P3): structurally equal subtrees are skipped by default; `compareUnchanged` walks them
  describe("A1.14 rules on unchanged subtrees (compareUnchanged)", () => {
    // a lint-like custom resolver that reports a missing `owner` on every item, equal or not
    const calls: unknown[] = []
    const lintRules: CompareRules = {
      "/items": {
        "/*": {
          $: allBreaking,
          compare: (ctx) => {
            calls.push(ctx.before.path)
            const value = ctx.after.value as Record<string, unknown>
            if (value.owner !== undefined) {
              return
            }
            const diff = {
              action: "add" as const,
              path: [...ctx.before.path, "owner"],
              type: breaking,
              scope: ctx.scope,
              description: "owner is missing",
            }
            return { diffs: [diff], merged: value }
          },
        },
      },
    }
    const before = { items: { a: { name: "a" }, b: { name: "b", owner: "x" } }, other: 1 }
    const after = { items: { a: { name: "a" }, b: { name: "b", owner: "x" } }, other: 2 }

    it("default: the resolver is not invoked inside a structurally equal subtree", () => {
      calls.length = 0
      const { diffs } = compare(before, after, { rules: { ...lintRules, "/other": { $: allBreaking } } })
      expect(calls).toEqual([])
      expect(diffs.map((d) => d.path.join("/"))).toEqual(["other"])
    })

    it("compareUnchanged: true walks equal subtrees, so the resolver reports on equal values", () => {
      calls.length = 0
      const { diffs } = compare(before, after, {
        rules: { ...lintRules, "/other": { $: allBreaking } },
        compareUnchanged: true,
      })
      expect(calls).toEqual([
        ["items", "a"],
        ["items", "b"],
      ])
      expect(diffs.map((d) => d.path.join("/")).sort()).toEqual(["items/a/owner", "other"])
    })

    it("compareUnchanged: true gives the same result with built-in rules (identical documents: no diff, same merged)", () => {
      const doc = {
        type: "object",
        properties: { a: { $ref: "#/$defs/A" }, b: { type: "array", items: { type: "string" } } },
        $defs: { A: { type: "string", description: "x" } },
      }
      const skipped = compareJsonSchema(doc, structuredClone(doc), { metaKey })
      const walked = compareJsonSchema(doc, structuredClone(doc), { metaKey, compareUnchanged: true })
      expect(walked.diffs).toEqual([])
      expect(walked.merged).toEqual(skipped.merged)
      const changed = structuredClone(doc)
      changed.properties.b.items.type = "number"
      const a = compareJsonSchema(doc, changed, { metaKey })
      const b = compareJsonSchema(doc, changed, { metaKey, compareUnchanged: true })
      expect(b.diffs).toEqual(a.diffs)
      expect(b.merged).toEqual(a.merged)
    })
  })

  // POLICY-60 decided: an annotation change left to the declaration (POLICY-57) that the declaration does not report is
  // emitted at the usage. Here the usage maps the list differently from the declaration (a custom mapping), so its
  // change list/0 ("a" -> "c") is not one the declaration reports (list/0 "a" -> "b", list/1 "b" -> "c")
  it("A1.15 an annotation change the declaration does not report stays at the usage (POLICY-60)", () => {
    const reversed: MappingResolver<number> = (b, a) => {
      const n = Math.min(b.length, a.length)
      const mapped: Record<number, number> = {}
      for (let i = 0; i < n; i++) mapped[i] = n - 1 - i
      return { added: [], removed: [], mapped }
    }
    const content: CompareRules = { $: allAnnotation, "/**": { $: allAnnotation } }
    const rules: CompareRules = {
      "/components": { "/*": content },
      "/usage": { ...content, compare: refsCompareResolver, "/list": { ...content, mapping: reversed } },
    }
    const doc = (list: string[]) => ({ components: { x: { list } }, usage: { $ref: "#/components/x" } })
    const { diffs, merged } = compare(doc(["a", "b"]), doc(["b", "c"]), { rules, metaKey })
    expect(diffs.map((d) => `${d.action} ${d.path.join("/")} ${d.before} ${d.after}`)).toEqual([
      "replace components/x/list/0 a b",
      "replace components/x/list/1 b c",
      "replace usage/list/0 a c",
    ])
    expect(merged.usage.list[metaKey]).toBeUndefined()
    expect(merged.usage[metaKey].list.array[1]).toMatchObject({ action: "replace", type: "annotation", replaced: "a" })
  })
})

describe("Block A3 — array mapping edge cases", () => {
  // ISSUE-02 (fixed): for non-identity array mappings the merged array is written in *before* order (mkey = bkey) while
  // the meta record is keyed by the *after* index (akey), so the meta points at the wrong element.
  it("A3.1 meta index must point at the element that actually changed in merged (enum mapping)", () => {
    const { merged } = compareJsonSchema(
      { type: "string", enum: [1, 2, 3] },
      { type: "string", enum: [3, 1, 5] },
      { metaKey },
    )
    const meta = (merged[metaKey].enum as { array: Record<number, { replaced: unknown }> }).array
    const [index, record] = Object.entries(meta)[0]

    // the replaced element (2 -> 5) must be referenced by the index where 5 lives in merged
    expect(merged.enum[Number(index)]).toBe(5)
    expect(record.replaced).toBe(2)
  })

  it("A3.2 reordering enum values without content change yields no diffs", () => {
    const { diffs } = compareJsonSchema({ enum: [1, 2, 3] }, { enum: [3, 2, 1] }, { metaKey })
    expect(diffs).toEqual([])
  })

  // ISSUE-30 (fixed): createChildContext resolves `bkey || akey`, so removed index 0 is looked up as key "" and the rule
  // function receives the *after* value (undefined) instead of the removed element.
  it("A3.3 rule functions receive the removed element when index 0 is removed", () => {
    const rules: CompareRules = {
      "/arr": {
        mapping: enumMappingResolver,
        "/*": ({ value }) => ({ $: value === "x" ? allBreaking : allNonBreaking }),
      },
    }
    const { diffs } = compare({ arr: ["x", "y"] }, { arr: ["y"] }, { rules })
    expect(diffs).toEqual([{ action: "remove", path: ["arr", 0], before: "x", type: breaking, scope: "root" }])
  })

  // ISSUE-04 (fixed): when a node with transform rules changes from object to array, the array is spread into an object
  // (`{...[1,2]}` -> `{0: 1, 1: 2}`) and compared structurally instead of producing one `replace` diff.
  it("A3.4 object -> array change at a schema node is a single replace diff with merged = after", () => {
    const { diffs, merged } = compareJsonSchema({ type: "object" }, [1, 2], { metaKey })

    expect(diffs).toHaveLength(1)
    expect(diffs[0]).toMatchObject({ action: "replace", path: [], before: { type: "object" }, after: [1, 2] })
    expect(Array.isArray(merged)).toBe(true)
  })

  it("A3.5 empty object vs empty array is a type change", () => {
    const { diffs } = compare({ a: {} }, { a: [] }, { rules: anyRules })
    expect(diffs).toEqual([{ action: "replace", path: ["a"], before: {}, after: [], type: breaking, scope: "root" }])
  })
})

// P10 (ISSUE-416): a `$ref` target pair found unchanged by the unchanged-subtree check is not compared again where the
// walk meets the same pair in the components section, unless the result relied on a cycle being assumed unchanged; the
// result must equal a walk without the check (`compareUnchanged: true`, README "Unchanged subtrees")
describe("A1.16 unchanged `$ref` targets compared once (P10)", () => {
  const doc = (schemas: Record<string, unknown>, schemaFirst = false) => {
    const paths = {
      "/a": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: { "application/json": { schema: { $ref: "#/components/schemas/B" } } },
            },
          },
        },
      },
      "/c": {
        post: {
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/C" } } } },
          responses: { "204": { description: "none" } },
        },
      },
    }
    return schemaFirst
      ? { openapi: "3.1.0", info: { title: "t", version: "1" }, components: { schemas }, paths }
      : { openapi: "3.1.0", info: { title: "t", version: "1" }, paths, components: { schemas } }
  }
  const cycle = (aType: string) => ({
    B: { type: "object", properties: { a: { $ref: "#/components/schemas/A" }, n: { type: "string" } } },
    A: { type: "object", properties: { b: { $ref: "#/components/schemas/B" }, x: { type: aType } } },
    C: {
      type: "object",
      properties: { b: { $ref: "#/components/schemas/B" }, self: { $ref: "#/components/schemas/C" } },
    },
  })
  const plain = (diffs: unknown[]) => JSON.parse(JSON.stringify(diffs))
  const same = (before: unknown, after: unknown) => {
    const checked = apiCompare(before, after, { metaKey })
    const walked = apiCompare(before, after, { metaKey, compareUnchanged: true })
    expect(plain(checked.diffs)).toEqual(plain(walked.diffs))
    expect(JSON.parse(JSON.stringify(checked.merged))).toEqual(JSON.parse(JSON.stringify(walked.merged)))
    return checked.diffs
  }

  it("A1.16.1 a change inside a cycle is reported where the cycle is reached from both sides of the components section", () => {
    for (const schemaFirst of [false, true]) {
      const diffs = same(doc(cycle("string"), schemaFirst), doc(cycle("integer"), schemaFirst))
      expect(diffs.some((d) => d.path.join("/") === "components/schemas/A/properties/x/type")).toBe(true)
      expect(diffs.some((d) => d.path[0] === "paths")).toBe(true)
    }
  })

  it("A1.16.2 an unchanged cycle and self-reference next to a change elsewhere", () => {
    for (const schemaFirst of [false, true]) {
      const before = doc({ ...cycle("string"), D: { type: "string" } }, schemaFirst)
      const after = doc({ ...cycle("string"), D: { type: "integer" } }, schemaFirst)
      const diffs = same(before, after)
      expect(diffs.map((d) => d.path.join("/"))).toEqual(["components/schemas/D/type"])
    }
  })

  it("A1.16.3 a target used from several places, changed and unchanged", () => {
    const shared = (t: string) => ({
      ...cycle("string"),
      E: { type: t },
      F: {
        type: "object",
        properties: { e1: { $ref: "#/components/schemas/E" }, e2: { $ref: "#/components/schemas/E" } },
      },
    })
    same(doc(shared("string")), doc(shared("number")))
    same(doc(shared("string")), doc(shared("string")))
  })

  // `n` schemas S0 … S<n-1>, each referencing the previous one, used by a request body through S<n-1>
  const chain = (n: number, type: string) => ({
    openapi: "3.1.0",
    info: { title: "t", version: "1" },
    paths: {
      "/p": {
        post: {
          requestBody: { content: { "application/json": { schema: { $ref: `#/components/schemas/S${n - 1}` } } } },
          responses: { "204": { description: "none" } },
        },
      },
    },
    components: {
      schemas: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `S${i}`,
          {
            type: "object",
            properties: i === 0 ? { x: { type } } : { next: { $ref: `#/components/schemas/S${i - 1}` } },
          },
        ]),
      ),
    },
  })

  // ISSUE-411 (fixed): the unchanged-subtree check followed `$ref` targets recursively without a bound, so a chain of
  // about 500 schemas threw `RangeError: Maximum call stack size exceeded` from `apiCompare`
  it("A1.16.4 a 600-schema reference chain is compared without exceeding the call stack", () => {
    const diffs = same(chain(600, "string"), chain(600, "integer"))
    expect(diffs.map((d) => [d.path.length, d.type])).toEqual([
      [7 + 2 * 599 + 3, breaking],
      [6, breaking],
    ])
  })

  // ISSUE-414: a reference chain is expanded at its usage by nested resolver calls (`compareNested`), one level of the
  // call stack per reference, so the usage of a chain of a few thousand schemas reports a compare resolver error
  // ("Maximum call stack size exceeded") and its change only at the declaration
  it.fails("A1.16.5 a 3 000-schema reference chain is compared at its usage without errors", () => {
    const { diffs, errors } = apiCompare(chain(3000, "string"), chain(3000, "integer"))
    expect(errors ?? []).toEqual([])
    expect(diffs.map((d) => d.path[0])).toEqual(["paths", "components"])
  })

  // `n` schemas S0 … S<n-1>, each referencing the previous one, with only S0 used (by a request body): no usage expands
  // the chain, but the usage scopes of S0 are those of every schema above it
  const chainAbove = (n: number, type: string) => {
    const doc = chain(n, type)
    doc.paths["/p"].post.requestBody.content["application/json"].schema.$ref = "#/components/schemas/S0"
    return doc
  }

  // ISSUE-410 (fixed): the usage index followed the component-to-component references recursively, one call frame per
  // component, so the change in S0 overflowed the call stack when it was classified and came out `unclassified` with a
  // classification error; ISSUE-412 (fixed): checking the chain took ≈ 15 s, the way to the difference ran through
  // every target (found by the ProtoApi performance test F11)
  it("A1.16.6 a change below a 20 000-schema reference chain is classified by its usage", () => {
    const { diffs, errors } = apiCompare(chainAbove(20_000, "string"), chainAbove(20_000, "integer"))
    expect(errors ?? []).toEqual([])
    expect(diffs.map((d) => [d.path.join("/"), d.type])).toEqual([
      ["paths//p/post/requestBody/content/application/json/schema/properties/x/type", breaking],
      ["components/schemas/S0/properties/x/type", breaking],
    ])
  })
})
