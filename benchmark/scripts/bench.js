"use strict"
// Timing matrix: one child process per (fixture, adapter) cell (scripts/run-case.js, mode timing), 60 s per-call
// timeout. Results are merged into results/<type>/bench.json (re-running a subset keeps the other cells; a run only
// touches the types it selects; the file is re-read before every write and env.date is kept by partial runs, see
// lib/results.js; BENCH_RUN_DATE ties the chunks of one full run together).
//   node scripts/bench.js [--type=openapi|graphql|asyncapi|grpc] [--fixtures a,b] [--adapters x,y] [--quick] [--out file]
//   (--quick = 2 warm-ups; --out only with a single type; --dry-run: list the cells, run and write nothing)
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const A = require("../adapters")
const F = require("../fixtures")
const { runCase } = require("../lib/runner")
const TY = require("../lib/types")
const RS = require("../lib/results")

const argv = process.argv.slice(2)
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null)
const onlyFx = opt("--fixtures")?.split(",")
const onlyAd = opt("--adapters")?.split(",")
const quick = argv.includes("--quick")
const types = TY.parseTypes(argv)
const dryRun = TY.isDryRun(argv)
if (opt("--out") && types.length !== 1) throw new Error("--out needs exactly one --type")

// option-sensitivity variants run only on these fixtures
const AUX_FIXTURES = new Set(["oas-petstore", "oas-github", "oas-github-identical", "oas-refs-2000", "oas-wide-10000", "aa3-events", "gql-github"])

const runType = async (type) => {
  const fixtures = F.all.filter((f) => TY.typeOf(f) === type && (!onlyFx || onlyFx.includes(f.name)))
  if (!fixtures.length) return
  const OUT = opt("--out") || TY.resultFile(type, "bench.json")
  if (!dryRun) fs.mkdirSync(path.dirname(OUT), { recursive: true })
  const init = () => ({ cells: {} })
  const selection = { fixtures: onlyFx ? fixtures.map((f) => f.name) : "all", adapters: onlyAd || "all", quick }
  if (!dryRun)
    RS.update(OUT, init, (d) => {
      d.type = type
      RS.applyEnv(d, { partial: !!(onlyFx || onlyAd), selection })
    })
  console.log(`== ${type}: ${fixtures.length} fixtures -> ${path.relative(P.BENCH, OUT)}`)
  for (const fx of fixtures) {
    for (const a of A.all) {
      if (onlyAd && !onlyAd.includes(a.id)) continue
      if (a.aux && !AUX_FIXTURES.has(fx.name)) continue
      const key = `${fx.name}|${a.id}`
      const sup = a.supports(fx)
      if (dryRun) {
        TY.dry(type, fx.name.padEnd(24), a.id.padEnd(22), sup === true ? `timing${quick ? " (quick)" : ""}` : `n/a: ${sup}`)
        continue
      }
      if (sup !== true) {
        RS.update(OUT, init, (d) => {
          d.cells[key] = { fixture: fx.name, adapter: a.id, status: "n/a", reason: sup }
        })
        continue
      }
      const r = await runCase({ adapter: a.id, fixture: fx.name, mode: "timing", env: quick ? { BENCH_WARMUP: "2" } : {} })
      r.measuredAt = RS.now()
      RS.update(OUT, init, (d) => {
        d.cells[key] = { ...d.cells[key], ...r }
        if (r.status !== "ok") for (const k of ["medianMs", "minMs", "times", "warmups", "runs"]) delete d.cells[key][k]
      })
      console.log(`${fx.name.padEnd(24)} ${a.id.padEnd(22)} ${r.status === "ok" ? `median ${r.medianMs.toFixed(2).padStart(10)} ms  min ${r.minMs.toFixed(2).padStart(10)} ms  (${r.warmups}w/${r.runs}r) diffs ${r.diffs}` : `${r.status} ${r.error ? r.error.message : ""}`.slice(0, 160)}`)
    }
  }
}
const main = async () => {
  for (const type of types) await runType(type)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
