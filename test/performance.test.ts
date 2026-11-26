import { spawnSync } from "node:child_process"

import { type CompareResult, compareJsonSchema, compareOpenApi } from "../src"

const wide = (n: number, firstType: string) => ({
  type: "object",
  properties: Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`p${i}`, { type: i === 0 ? firstType : "string" }]),
  ),
})
const deep = (depth: number, leaf: unknown): any =>
  depth === 0 ? leaf : { type: "object", properties: { c: deep(depth - 1, leaf) } }

const oas = (schema: unknown, response: boolean) => ({
  openapi: "3.0.0",
  paths: {
    "/p": {
      post: response
        ? { responses: { 200: { description: "ok", content: { "application/json": { schema } } } } }
        : { requestBody: { content: { "application/json": { schema } } }, responses: {} },
    },
  },
})

/** minimum wall time of `runs` executions, to dampen scheduler noise */
const time = (fn: () => unknown, runs = 2) => {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < runs; i++) {
    const started = performance.now()
    fn()
    best = Math.min(best, performance.now() - started)
  }
  return best
}

describe("Block F — performance characteristics", () => {
  it("F1 a 2000-property object schema compares in well under a second", () => {
    expect(time(() => compareJsonSchema(wide(2000, "string"), wide(2000, "number")))).toBeLessThan(1500)
  })

  // ISSUE-05 (fixed): the root key was recomputed for every child (quadratic in object width); 1000 -> 4000 properties
  // now scales linearly.
  it("F2 comparison time grows linearly with the number of sibling properties", () => {
    const small = time(() => compareJsonSchema(wide(1000, "string"), wide(1000, "number")))
    const large = time(() => compareJsonSchema(wide(4000, "string"), wide(4000, "number")))
    expect(large / small).toBeLessThan(5.5)
  })

  // ISSUE-06 (fixed): reversed (response) rules are produced by `transformCompareRules`, which wraps every function rule so
  // that its result is re-cloned on every invocation; response schemas therefore compare several times slower than
  // request schemas of the same shape.
  it("F3 response schemas compare in a similar time to request schemas", () => {
    const request = time(() => compareOpenApi(oas(wide(1500, "s"), false), oas(wide(1500, "n"), false)))
    const response = time(() => compareOpenApi(oas(wide(1500, "s"), true), oas(wide(1500, "n"), true)))
    expect(response / request).toBeLessThan(2)
  })

  it("F4 a 150-level deep schema compares quickly despite allOf merging at every level", () => {
    expect(time(() => compareJsonSchema(deep(150, { type: "string" }), deep(150, { type: "number" })))).toBeLessThan(
      1000,
    )
  })

  it("F5 many usages of the same $ref are served from the result cache", () => {
    const refs = (n: number, type: string) => ({
      openapi: "3.0.0",
      paths: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `/p${i}`,
          {
            get: {
              responses: {
                200: {
                  description: "ok",
                  content: { "application/json": { schema: { $ref: "#/components/schemas/E" } } },
                },
              },
            },
          },
        ]),
      ),
      components: { schemas: { E: { type: "object", properties: { code: { type } } } } },
    })
    expect(time(() => compareOpenApi(refs(500, "string"), refs(500, "integer")))).toBeLessThan(1500)
  })

  it("F6 combinator matching of 40 x 40 branches stays fast", () => {
    const combo = (n: number, type: string) => ({
      oneOf: Array.from({ length: n }, (_, i) => ({
        type: "object",
        properties: { [`k${i}`]: { type: i === 0 ? type : "string" } },
      })),
    })
    expect(time(() => compareJsonSchema(combo(40, "string"), combo(40, "number")))).toBeLessThan(1000)
  })

  // DESIGN_PROPOSALS §8: a large real-world-sized document (petstore replicated 60x, ~770 KB per side)
  const big = (n: number, mutate: boolean) => {
    const seed = {
      openapi: "3.0.0",
      paths: {
        "/pet": {
          post: {
            requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } } },
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
              },
            },
          },
        },
        "/pet/{id}": {
          get: {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
            responses: {
              200: {
                description: "ok",
                content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: {
            type: "object",
            required: ["id", "name"],
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
              tags: { type: "array", items: { $ref: "#/components/schemas/Tag" } },
            },
          },
          Tag: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" } } },
        },
      },
    }
    const doc: any = { openapi: "3.0.0", paths: {}, components: { schemas: {} } }
    for (let i = 0; i < n; i++) {
      const text = JSON.stringify(seed).replace(
        /#\/components\/schemas\/(\w+)"/g,
        (_m, name) => `#/components/schemas/${name}${i}"`,
      )
      const copy = JSON.parse(text)
      for (const [p, item] of Object.entries(copy.paths)) doc.paths[`/v${i}${p}`] = item
      for (const [name, schema] of Object.entries(copy.components.schemas))
        doc.components.schemas[`${name}${i}`] = schema
    }
    if (mutate) {
      doc.components.schemas.Pet0.properties.name.type = "integer"
    }
    return doc
  }

  it("F7 a large document (hundreds of paths and schemas) compares within budget", () => {
    const before = big(300, false)
    const after = big(300, true)
    expect(time(() => compareOpenApi(before, after))).toBeLessThan(3000)
  })

  it("F8 merged does not alias the inputs of a large document", () => {
    const before = big(20, false)
    const after = big(20, true)
    const { merged } = compareOpenApi(before, after)
    merged.components.schemas.Pet1.properties.name.type = "boolean"
    merged.paths["/v1/pet"].post.responses[200].description = "changed"
    expect(after.components.schemas.Pet1.properties.name.type).toBe("string")
    expect(after.paths["/v1/pet"].post.responses[200].description).toBe("ok")
    expect(before.paths["/v1/pet"].post.responses[200].description).toBe("ok")
  })

  // `n` schemas S0 … S<n-1>, each referencing the previous one and holding its own field `x`, with only S0 used (by a
  // request body); the `x` of every 10th schema changes type
  const chainDoc = (n: number, type: string) => ({
    openapi: "3.1.0",
    info: { title: "t", version: "1" },
    paths: {
      "/p": {
        post: {
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/S0" } } } },
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
            properties: {
              ...(i ? { next: { $ref: `#/components/schemas/S${i - 1}` } } : {}),
              x: { type: i % 10 === 0 ? type : "string" },
            },
          },
        ]),
      ),
    },
  })

  // ISSUE-412, ISSUE-413 (fixed, found by the ProtoApi performance test F11): the way to a difference handed to the walk
  // ran through every target of a reference chain (× 12.9 here with only that fix missing), and the usage scopes were
  // walked from every changed schema up the whole chain (× 20); with both, 1,500 → 9,000 schemas took 160 → 3 700 ms
  // (× 23) and the change in S0 came out `unclassified` (ISSUE-410)
  it("F14 a 9,000-schema reference chain with 10 % of the schemas changed compares linearly in the chain length", () => {
    const run = (n: number) => {
      const before = chainDoc(n, "string")
      const after = chainDoc(n, "integer")
      let result!: CompareResult
      const elapsed = time(() => (result = compareOpenApi(before, after)), 2)
      expect(result.errors ?? []).toEqual([])
      expect(result.diffs.length).toBe(n / 10 + 1)
      return elapsed
    }
    const small = run(1_500)
    const large = run(9_000)
    expect(large).toBeLessThan(2000)
    // 6 × the schemas (and 6 × the changes): at most 1.5 × a linear growth
    expect(large / small).toBeLessThan(6 * 1.5)
  }, 60_000)

  // ISSUE-200 (fixed, P5): the walk recursed (≈ 3 frames per level), so a deeply nested document exceeded the call stack
  // (node, default stack: ≈ 440 levels at gate B1, ≈ 750 after P3b; bun ≈ 3 000); it now keeps the open containers on
  // an explicit stack (≥ 5 000 levels under node). Time and memory still grow with depth² (one path array per node,
  // ISSUE-210)
  it("F9 a schema nested 4 000 levels deep compares without exceeding the call stack", () => {
    // in a child process: JavaScriptCore needs seconds to collect the ≈ 0.3 GB of path arrays this depth takes
    // (ISSUE-210), which would slow down the timed tests after this one
    const script = `
      const { compareJsonSchema } = require(${JSON.stringify(`${import.meta.dirname}/../src`)})
      const deep = (depth, leaf) => (depth === 0 ? leaf : { type: "object", properties: { c: deep(depth - 1, leaf) } })
      console.log(compareJsonSchema(deep(4000, { type: "string" }), deep(4000, { type: "number" })).diffs.length)
    `
    const child = spawnSync(process.execPath, ["--import", "vite-plus/register", "-e", script], { encoding: "utf8" })
    expect(child.stderr).toBe("")
    expect(child.stdout.trim()).toBe("1")
  })
})
