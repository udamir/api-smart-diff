import { spawnSync } from "node:child_process"
import { apiCompare } from "../../../src"
import { gqlDocs } from "../../helpers/compat"

// DESIGN_PROPOSALS §8 targets that the benchmark (docs/BENCHMARK.md §7.1 in the main worktree) measured as missed on
// 2.0.0. The remaining §8 targets are met and guarded by test/performance.test.ts; peak heap (≤ 2.5× input) is
// measured by the benchmark only (bench/scripts/heap.js) because a heap assertion inside the test runner is not
// reliable.

const time = (fn: () => unknown, runs = 3) => {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < runs; i++) {
    const started = performance.now()
    fn()
    best = Math.min(best, performance.now() - started)
  }
  return best
}

const refs = (n: number, type: string) => ({
  openapi: "3.0.3",
  info: { title: "t", version: "1" },
  paths: Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      `/p${i}`,
      {
        get: {
          responses: {
            200: { description: "ok", content: { "application/json": { schema: { $ref: "#/components/schemas/E" } } } },
          },
        },
      },
    ]),
  ),
  components: { schemas: { E: { type: "object", properties: { code: { type } } } } },
})

// a document of the shape of a real API: many paths, each with parameters, a request body and responses using a
// pool of component schemas (≈ 400 KB of JSON; 2.0.0 took ≈ 18× the clone here before P3)
const large = (variant: number) => {
  const schemas: Record<string, unknown> = {}
  for (let s = 0; s < 150; s++) {
    schemas[`M${s}`] = {
      type: "object",
      required: ["id"],
      properties: Object.fromEntries(
        Array.from({ length: 25 }, (_, p) => [
          `f${p}`,
          p === 0
            ? { type: "string", format: "uuid" }
            : { type: p % 3 ? "string" : "integer", description: `field ${p}` },
        ]),
      ),
    }
  }
  if (variant) (schemas.M7 as any).properties.f3.type = "boolean"
  const paths: Record<string, unknown> = {}
  for (let i = 0; i < 400; i++) {
    const ref = { $ref: `#/components/schemas/M${i % 150}` }
    paths[`/r${i}/{id}`] = {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: {
        operationId: `get${i}`,
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", maximum: 100 } }],
        responses: {
          200: { description: "ok", content: { "application/json": { schema: ref } } },
          404: { description: "nf" },
        },
      },
      put: {
        operationId: `put${i}`,
        requestBody: { required: true, content: { "application/json": { schema: ref } } },
        responses: { 204: { description: "done" } },
      },
    }
  }
  return { openapi: "3.0.3", info: { title: "large", version: "1" }, paths, components: { schemas } }
}

describe("compat core / §8 performance targets", () => {
  // ISSUE-58 (fixed for the decided target): 500 usages of one $ref took 34 ms on the benchmark machine before P3
  // (≈ 40 ms here), ≈ 22–25 ms after P3; POLICY-59 (decided after P3) relaxed the §8 target of 10 ms to ≈ 25 ms for
  // 2.0.0 (a precompiled rule format is planned after 2.0.0). P3b: ≈ 16–18 ms here (bun, min of runs). P8d: ≈ 11–12 ms
  // after the key-mapping shortcut (`identityOnEqualKeys`) and the description / usage-index work; measured in a fresh
  // child process (no coverage instrumentation, no type feedback or heap from the thousands of tests before it in the
  // same process, which made the in-process minimum vary between ≈ 15 and 25 ms with the load of the machine) as the
  // minimum of 15 runs after 5 warm-up runs, so a single slow run (GC, JIT) does not fail the budget.
  it("X-PERF-001 500 usages of one $ref compare in ≤ 25 ms", () => {
    const script = `
      const { compareOpenApi } = require(${JSON.stringify(`${import.meta.dirname}/../../../src`)})
      const refs = ${refs.toString()}
      const before = refs(500, "string")
      const after = refs(500, "integer")
      for (let i = 0; i < 5; i++) compareOpenApi(before, after)
      let best = Number.POSITIVE_INFINITY
      for (let i = 0; i < 15; i++) {
        const started = performance.now()
        compareOpenApi(before, after)
        best = Math.min(best, performance.now() - started)
      }
      console.log(best)
    `
    const child = spawnSync(process.execPath, ["--import", "vite-plus/register", "-e", script], { encoding: "utf8" })
    expect(child.stderr).toBe("")
    const ms = Number(child.stdout.trim())
    // `ASD_PERF_LOG=1 bun test ...` prints the measured time
    if (process.env.ASD_PERF_LOG) console.log(`X-PERF-001 ${ms.toFixed(2)} ms`)
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(25)
  })

  // ISSUE-58 (fixed for this target): a real-world-shaped document took ≈ 9–18× a structuredClone of both documents
  // (GitHub REST 7.6 MB: 1.72 s vs 193 ms); unchanged subtrees are no longer walked (P3), ≈ 1.0–1.3× here.
  it("X-PERF-002 a large document compares in ≤ 1.5× a structuredClone of both documents", () => {
    const before = large(0)
    const after = large(1)
    const clone = time(() => [structuredClone(before), structuredClone(after)])
    const compare = time(() => apiCompare(before, after), 2)
    expect(compare / clone).toBeLessThanOrEqual(1.5)
  })

  // ISSUE-53 (fixed): with the GraphApi 0.1.2 encoding the diff count of a single field removal grew exponentially
  // with the size of a cyclic type graph (the 1.0 encoding reports it once); 0.1.2 usages are now nominal as well.
  it("X-PERF-003 GraphApi 0.1.2: one removed field in a 12-type cyclic graph yields a bounded number of diffs", () => {
    const ring = (k: number, drop?: number) =>
      [
        "type Query { root: T0 }",
        ...Array.from(
          { length: k },
          (_, i) => `type T${i} { id: ID! ${i === drop ? "" : "extra: Int "}f0: T${(i + 1) % k} f1: T${(i + 2) % k} }`,
        ),
      ].join("\n")
    const v10 = apiCompare(gqlDocs(ring(12), "1.0"), gqlDocs(ring(12, 11), "1.0")).diffs.length
    const v012 = apiCompare(gqlDocs(ring(12), "0.1.2"), gqlDocs(ring(12, 11), "0.1.2")).diffs.length
    expect(v10).toBe(1)
    // one declaration diff plus at most one per type that references T11 directly
    expect(v012).toBeLessThanOrEqual(3)
  })
})
