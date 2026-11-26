import {
  type ChangeAnnotationResolver,
  type CompareRules,
  allAnnotation,
  allBreaking,
  allNonBreaking,
  annotation,
  breaking,
  compare,
  compareAsyncApi,
  compareJsonSchema,
  compareOpenApi,
  enumMappingResolver,
  jsonSchemaRules,
  openApiSchemaRules,
  nonBreaking,
  reverseClassifyRuleTransformer,
  risky,
  transformCompareRules,
  unclassified,
} from "../../src"
import {
  annotationTemplate as t,
  matchPrefixRule,
  mergeExtensionRules,
  resolveClassifyTuple,
  resolveNodeRules,
} from "../../src/core"
import { graphApiSchemaRules } from "../../src/graphapi"

// Block A9 — P1 foundations: the `risky` DiffType (decision §11.14, ISSUE-130), prefix rules `/<prefix>*` with json-crawl 1.x
// semantics (decision §11.15) and the built-in `x-*` extension rule (POLICY-06 / POLICY-07, ISSUE-54 / 73 / 131).

const rules = (r: unknown) => r as CompareRules

describe("Block A9 — risky DiffType", () => {
  it("A9.1 risky is a DiffType that never inverts between directions", () => {
    expect(risky).toBe("risky")
    expect(resolveClassifyTuple([risky, nonBreaking, breaking], "response")).toEqual([risky, breaking, nonBreaking])
    expect(resolveClassifyTuple([nonBreaking, breaking, breaking, risky, nonBreaking, risky], "response")).toEqual([
      risky,
      nonBreaking,
      risky,
    ])
    expect(
      resolveClassifyTuple({ response: [risky, risky, risky], default: allNonBreaking as any }, "response"),
    ).toEqual([risky, risky, risky])
    const reversed: any = transformCompareRules(
      rules({ $: [risky, nonBreaking, breaking] }),
      reverseClassifyRuleTransformer,
    )
    expect(reversed.$).toEqual([risky, breaking, nonBreaking])
  })

  it("A9.2 risky diffs carry the class into the merged meta and rank between breaking and non-breaking", () => {
    const metaKey = Symbol("diff")
    const r = rules({ "/a": { $: [risky, risky, risky] } })
    const { diffs, merged } = compare({}, { a: 1 }, { rules: r, metaKey })
    expect(diffs).toMatchObject([{ type: risky, action: "add" }])
    expect(merged[metaKey]).toMatchObject({ a: { action: "add", type: risky } })
  })

  it("A9.3 a component used in a request and a response takes the most severe class (risky over non-breaking)", () => {
    const doc = (values: string[]) => ({
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {
        "/a": {
          post: {
            requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/E" } } } },
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: { $ref: "#/components/schemas/E" } } },
              },
            },
          },
        },
      },
      components: { schemas: { E: { type: "string", enum: values } } },
    })
    const { diffs } = compareOpenApi(doc(["a"]), doc(["a", "b"]))
    expect(diffs.find((d) => d.path[0] === "components")?.type).toBe(risky)
  })
})

describe("Block A9 — prefix rules (`/<prefix>*`)", () => {
  const xRule = rules({ $: allAnnotation })
  const xLong = rules({ $: allBreaking })
  const star = rules({ $: allNonBreaking, "/child": { $: allBreaking } })

  it("A9.4 exact key > longest prefix > `/*` > `/**`, merged field by field", () => {
    const parent = rules({ "/x-exact": { $: allBreaking }, "/x-*": xRule, "/x-long*": xLong, "/*": star })
    expect(resolveNodeRules(parent, "x-exact", ["x-exact"], 1)?.$).toEqual(allBreaking)
    expect(resolveNodeRules(parent, "x-other", ["x-other"], 1)?.$).toEqual(allAnnotation)
    expect(resolveNodeRules(parent, "x-longer", ["x-longer"], 1)?.$).toEqual(allBreaking)
    // the prefix rule is merged over `/*`: its own fields win, the others come from `/*`
    expect((resolveNodeRules(parent, "x-other", ["x-other"], 1) as any)["/child"]).toEqual({ $: allBreaking })
    expect(resolveNodeRules(parent, "plain", ["plain"], 1)?.$).toEqual(allNonBreaking)
    // an exact rule is merged over the matching prefix rule
    const merged = rules({ "/x-a": { annotate: "exact" }, "/x-*": { $: allAnnotation, annotate: "prefix" } })
    expect(resolveNodeRules(merged, "x-a", ["x-a"], 1)).toEqual({ $: allAnnotation, annotate: "exact" } as any)
    const withAny = rules({ "/x-*": xRule, "/**": { $: allBreaking } })
    const resolved: any = resolveNodeRules(withAny, "x-a", ["x-a"], 1)
    expect(resolved.$).toEqual(allAnnotation)
    expect(resolved["/**"]).toEqual({ $: allBreaking })
    expect(matchPrefixRule(parent, "x-longer")).toBe(xLong)
    expect(matchPrefixRule(parent, "plain")).toBeUndefined()
  })

  it("A9.5 only string keys match; only a trailing `*` after a non-empty prefix makes a prefix rule", () => {
    const parent = rules({ "/1*": xRule })
    expect(resolveNodeRules(parent, 1, [1], 1)).toBeUndefined()
    expect(resolveNodeRules(parent, "10", ["10"], 1)?.$).toEqual(allAnnotation)
    // `/*` and `/**` keep their wildcard meaning, `/*-id` is an exact key, `/a*b*` matches keys starting with `a*b`
    expect(resolveNodeRules(rules({ "/*-id": xRule }), "x-id", ["x-id"], 1)).toBeUndefined()
    expect(resolveNodeRules(rules({ "/*-id": xRule }), "*-id", ["*-id"], 1)?.$).toEqual(allAnnotation)
    expect(resolveNodeRules(rules({ "/a*b*": xRule }), "a*bc", ["a*bc"], 1)?.$).toEqual(allAnnotation)
    expect(resolveNodeRules(rules({ "/a*b*": xRule }), "abc", ["abc"], 1)).toBeUndefined()
  })

  it("A9.6 function prefix rules are resolved per node (never memoized)", () => {
    let calls = 0
    const parent = rules({
      "/x-*": ({ value }: { value: unknown }) => {
        calls++
        return { $: value === 1 ? allBreaking : allAnnotation }
      },
    })
    expect(resolveNodeRules(parent, "x-a", ["x-a"], 1)?.$).toEqual(allBreaking)
    expect(resolveNodeRules(parent, "x-a", ["x-a"], 2)?.$).toEqual(allAnnotation)
    expect(calls).toBe(2)
  })

  it("A9.7 extension rules merge key-wise and reject the former prefix-map keys; transformCompareRules transforms prefix entries", () => {
    const merged = mergeExtensionRules(
      { "/x-*": rules({ $: allAnnotation, annotate: () => undefined }) },
      {
        "/x-*": rules({ $: allBreaking }),
        "/x-extensible-enum": xLong,
      },
    )
    expect(Object.keys(merged)).toEqual(["/x-*", "/x-extensible-enum"])
    expect((merged["/x-*"] as any).$).toEqual(allBreaking)
    expect(typeof (merged["/x-*"] as any).annotate).toBe("function")
    expect(() => mergeExtensionRules({ "x-": xRule } as any)).toThrow(TypeError)
    expect(() =>
      compareOpenApi({ openapi: "3.1.0" }, { openapi: "3.1.0" }, { extensions: { "x-a": xRule } as any }),
    ).toThrow(TypeError)
    const reversed: any = transformCompareRules(
      rules({ "/x-*": { $: [breaking, nonBreaking, breaking], "/*": { $: [breaking, breaking, nonBreaking] } } }),
      reverseClassifyRuleTransformer,
    )
    expect(reversed["/x-*"].$).toEqual([nonBreaking, breaking, nonBreaking])
    expect(reversed["/x-*"]["/*"].$).toEqual([nonBreaking, nonBreaking, breaking])
    const fn: any = transformCompareRules(
      rules({ "/x-*": () => ({ $: [breaking, nonBreaking, breaking] }) }),
      reverseClassifyRuleTransformer,
    )
    expect(fn["/x-*"]({ key: "x-a", path: [], value: 1 }).$).toEqual([nonBreaking, breaking, nonBreaking])
  })
})

describe("Block A9 — built-in `x-*` extension rule", () => {
  const oas = (
    extra: Record<string, unknown>,
    paths: Record<string, unknown> = { "/a": { get: { responses: {} } } },
  ) => ({
    openapi: "3.1.0",
    info: { title: "t", version: "1" },
    paths,
    ...extra,
  })

  it("A9.8 lifecycle extensions (x-sunset, x-stability-level) are annotations naming the key (POLICY-07)", () => {
    const op = (x: Record<string, unknown>) => oas({}, { "/a": { get: { responses: {}, ...x } } })
    for (const [before, after] of [
      [{}, { "x-sunset": "2030-01-01" }],
      [{ "x-stability-level": "stable" }, { "x-stability-level": "beta" }],
    ]) {
      const { diffs } = compareOpenApi(op(before), op(after))
      expect(diffs).toHaveLength(1)
      expect(diffs[0].type).toBe(annotation)
      expect(diffs[0].description).toMatch(/x-sunset|x-stability-level/)
      expect(diffs[0].description).toContain("GET /a")
    }
  })

  it("A9.9 an extension value is compared with an isolated rule tree (ISSUE-54 / ISSUE-73)", () => {
    // `parameters` inside a path-item extension is not compared as path parameters
    const item = (x: unknown) => oas({}, { "/a": { get: { responses: {} }, "x-meta": x } })
    const { diffs } = compareOpenApi(item({ parameters: [{ name: "a" }] }), item({ parameters: [{ name: "b" }] }))
    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.every((d) => d.type === annotation && d.description?.includes("x-meta"))).toBe(true)
    // `x-*` keys of the Paths and Responses objects are not paths or status codes
    const paths = compareOpenApi(
      oas({}, { "/a": { get: { responses: {} } }, "x-p": 1 }),
      oas({}, { "/a": { get: { responses: {} } } }),
    )
    expect(paths.diffs).toMatchObject([{ path: ["paths", "x-p"], action: "remove", type: annotation }])
  })

  it("A9.10 unconfigured x-* keywords inside a JSON Schema and an AsyncAPI document are annotations", () => {
    const { diffs } = compareJsonSchema({ type: "string" }, { type: "string", "x-go-type": "Name" })
    expect(diffs).toMatchObject([{ type: annotation }])
    expect(diffs[0].description).toContain("x-go-type")
    const aa = (x: Record<string, unknown>) => ({
      asyncapi: "2.6.0",
      info: { title: "t", version: "1" },
      channels: {},
      ...x,
    })
    expect(compareAsyncApi(aa({ "x-owner": "a" }), aa({ "x-owner": "b" })).diffs).toMatchObject([{ type: annotation }])
  })

  it("A9.11 a custom prefix rule overrides the built-in one for its prefix (x-extensible-enum with enum semantics)", () => {
    const param = (values: string[]) =>
      oas(
        {},
        {
          "/a/{id}": {
            get: {
              parameters: [
                { name: "id", in: "path", required: true, schema: { type: "string", "x-extensible-enum": values } },
              ],
              responses: {},
            },
          },
        },
      )
    const extensions = {
      "/x-extensible-enum": rules({
        $: allAnnotation,
        compare: undefined,
        mapping: enumMappingResolver,
        "/*": { $: [nonBreaking, breaking, breaking] },
      }),
    }
    const builtin = compareOpenApi(param(["1", "2"]), param(["1"])).diffs
    expect(builtin.every((d) => d.type === annotation)).toBe(true)
    const custom = compareOpenApi(param(["1", "2"]), param(["1"]), { extensions }).diffs
    expect(custom).toMatchObject([{ action: "remove", type: breaking }])
    // other extensions keep the built-in rule
    const other = compareOpenApi(oas({ "x-a": 1 }), oas({ "x-a": 2 }), { extensions }).diffs
    expect(other).toMatchObject([{ type: annotation }])
  })

  // P8a: an extension override and its risky / breaking diffs are described by the same engine as built-in rules: a
  // custom `annotate` template is rendered with the spec dictionary (strict placeholders, `keyword` for a
  // non-annotation `annotation` template), and the generated fallback names the container when it has none
  it("A9.14 custom extension rules are described by the shared description engine", () => {
    const param = (values: string[]) =>
      oas(
        {},
        {
          "/a/{id}": {
            get: {
              parameters: [
                { name: "id", in: "path", required: true, schema: { type: "string", "x-extensible-enum": values } },
              ],
              responses: {},
            },
          },
        },
      )
    // a prefix entry replaces the built-in `/x-*` rule for its keys (an exact `/x-extensible-enum` entry would be
    // merged over it and inherit its isolated compare and annotate)
    const extensions = (annotate?: ChangeAnnotationResolver) => ({
      "/x-extensible-enum*": rules({
        $: allAnnotation,
        mapping: enumMappingResolver,
        "/*": { $: [nonBreaking, breaking, breaking], ...(annotate ? { annotate } : {}) },
      }),
    })
    const describe = (annotate?: ChangeAnnotationResolver) =>
      compareOpenApi(param(["1", "2"]), param(["1"]), { extensions: extensions(annotate) }).diffs.map(
        (d) => d.description,
      )
    // without an `annotate` of its own the change is still described, naming its container
    expect(describe()).toEqual([expect.stringMatching(/^\[Removed\] .*`id`/)])
    expect(describe(({ action }) => t(action, { text: t("annotation", { key: "x-extensible-enum" }) }))).toEqual([
      "[Removed] `x-extensible-enum` in path parameter `id`",
    ])
  })

  // ISSUE-418: the README recipe (an exact `/x-extensible-enum` entry with `compare: undefined` and a `/*` child rule)
  // walks the extension value with the inherited nested rule, whose description took the last path segment as the
  // extension key: "[Removed] extension `2` in query parameter `kind`" instead of naming the value
  it("A9.15 an extension walked with its own child rules describes the values of the extension, not the index", () => {
    const enumRule = {
      "/x-extensible-enum": {
        $: allAnnotation,
        compare: undefined,
        mapping: enumMappingResolver,
        "/*": { $: [nonBreaking, breaking, breaking] },
      },
    } as const
    const param = (values: string[]) =>
      oas(
        {},
        {
          "/pets": {
            get: {
              parameters: [{ name: "kind", in: "query", schema: { type: "string", "x-extensible-enum": values } }],
              responses: {},
            },
          },
        },
      )
    const openapi = compareOpenApi(param(["dog", "cat", "bird"]), param(["dog", "cat"]), { extensions: enumRule })
    expect(openapi.diffs).toMatchObject([
      {
        type: breaking,
        action: "remove",
        description: "[Removed] value `bird` of extension `x-extensible-enum` in query parameter `kind`",
      },
    ])
    const added = compareOpenApi(param(["dog"]), param(["dog", "cat"]), { extensions: enumRule })
    expect(added.diffs).toMatchObject([
      {
        type: nonBreaking,
        action: "add",
        description: "[Added] value `cat` of extension `x-extensible-enum` in query parameter `kind`",
      },
    ])
    // a nested property of an object-valued extension walked with child rules names the property
    const meta = {
      "/x-meta": { compare: undefined, "/owner": { $: allBreaking } },
    } as const
    const objectValued = compareOpenApi(oas({ "x-meta": { owner: "a" } }), oas({ "x-meta": { owner: "b" } }), {
      extensions: meta,
    })
    expect(objectValued.diffs).toMatchObject([{ type: breaking, path: ["x-meta", "owner"] }])
    expect(objectValued.diffs[0].description).toContain("property `owner` of extension `x-meta`")
    // JSON Schema: the same rule on a standalone schema
    const schema = compareJsonSchema(
      { type: "string", "x-extensible-enum": ["a", "b"] },
      { type: "string", "x-extensible-enum": ["a"] },
      { extensions: enumRule },
    )
    expect(schema.diffs).toMatchObject([{ type: breaking, action: "remove", path: ["x-extensible-enum", 1] }])
    expect(schema.diffs[0].description).toContain("value `b` of extension `x-extensible-enum`")
  })

  it("A9.12 a property named x-* in a schema `properties` map is a property, not an extension", () => {
    const { diffs } = compareJsonSchema(
      { type: "object", properties: { "x-a": { type: "string" } } },
      { type: "object", properties: { "x-a": { type: "integer" } } },
    )
    expect(diffs).toMatchObject([{ path: ["properties", "x-a", "type"], type: breaking }])
    expect(unclassified).toBe("unclassified")
  })
})

describe("Block A9 — merged rule sharing", () => {
  // JavaScriptCore stores objects with more than 63 own properties in a slower form; every schema node spreads these
  // rule objects, so one key more costs about 12 % on schema-heavy documents (measured in P1)
  // the schema rule objects have more than 64 keys since the keyword entries left the former `/^` prefix map; JavaScriptCore reads
  // such objects through a slower property storage, which is harmless while they are merged once, not per node
  it("A9.13 rules merged for a function rule are built once and shared by every node it applies to", () => {
    for (const schema of [jsonSchemaRules(), openApiSchemaRules({ version: "3.0" }), graphApiSchemaRules()]) {
      const items = (value: unknown) => resolveNodeRules(schema, "items", ["items"], value)
      expect(items({ type: "string" })).toBe(items({ type: "number" }))
      expect(items([{ type: "string" }])).toBe(items([{ type: "number" }]))
    }
    const shared = rules({ $: allAnnotation })
    const parent = rules({ "/x-*": () => shared, "/*": { $: allBreaking }, "/**": { $: allNonBreaking } })
    expect(resolveNodeRules(parent, "x-a", ["x-a"], 1)).toBe(resolveNodeRules(parent, "x-b", ["x-b"], 2))
  })
})
