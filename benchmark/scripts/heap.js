"use strict"
// Peak and retained heap per (fixture, adapter): a fresh `node --expose-gc` process per cell (scripts/run-case.js,
// mode heap). Peak = max heap used before any GC during the measured call (--trace-gc toggled around it) and heapUsed
// right after it; retained = heapUsed after the call with the inputs dropped and gc settled, minus the baseline before
// the inputs were built (the output, including any merged document, is kept alive). Written to results/<type>/heap.json
// (a run only touches the types it selects; the file is re-read before every write, lib/results.js).
//   node scripts/heap.js [--type=openapi|graphql|asyncapi|grpc] [--fixtures a,b] [--adapters x,y] [--dry-run]
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const A = require("../adapters")
const F = require("../fixtures")
const { runCase } = require("../lib/runner")
const TY = require("../lib/types")
const RS = require("../lib/results")

const argv = process.argv.slice(2)
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1].split(",") : null)
const onlyFx = opt("--fixtures")
const onlyAd = opt("--adapters")
const types = TY.parseTypes(argv)
const dryRun = TY.isDryRun(argv)
const AUX_FIXTURES = new Set(["oas-petstore", "oas-github", "oas-github-identical", "oas-refs-2000", "oas-wide-10000", "aa3-events", "gql-github"])
const MB = (b) => (b === undefined ? "-" : `${(b / 2 ** 20).toFixed(1)} MB`)

const runType = async (type) => {
  const fixtures = F.all.filter((f) => TY.typeOf(f) === type && (!onlyFx || onlyFx.includes(f.name)))
  if (!fixtures.length) return
  const OUT = TY.resultFile(type, "heap.json")
  if (!dryRun) fs.mkdirSync(path.dirname(OUT), { recursive: true })
  const init = () => ({ cells: {} })
  console.log(`== ${type}: ${fixtures.length} fixtures -> ${path.relative(P.BENCH, OUT)}`)
  const method = "peak = max(heap used before each GC during the call per --trace-gc, heapUsed right after the call); retained = heapUsed after the call with inputs dropped and 3x gc, minus heapUsed before the inputs were built; one measured call after 3 warm-ups, fresh process per cell"
  if (!dryRun)
    RS.update(OUT, init, (d) => {
      d.type = type
      d.method = method
    })
  for (const fx of fixtures) {
    for (const a of A.all) {
      if (onlyAd && !onlyAd.includes(a.id)) continue
      if (a.aux && !AUX_FIXTURES.has(fx.name)) continue
      if (a.supports(fx) !== true) continue
      if (dryRun) {
        TY.dry(type, fx.name.padEnd(24), a.id.padEnd(22), "heap")
        continue
      }
      const r = await runCase({ adapter: a.id, fixture: fx.name, mode: "heap" })
      r.measuredAt = RS.now()
      RS.update(OUT, init, (d) => {
        d.cells[`${fx.name}|${a.id}`] = r
      })
      console.log(`${fx.name.padEnd(24)} ${a.id.padEnd(22)} ${r.status === "ok" ? `peak ${MB(r.peakHeapBytes).padStart(10)}  retained ${MB(r.heapRetainedBytes).padStart(10)}  input ${MB(r.inputHeapBytes)}` : `${r.status} ${r.error?.message || ""}`.slice(0, 140)}`)
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
