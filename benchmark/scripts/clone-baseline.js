"use strict"
// Baseline for the real-world performance target of api-smart-diff 2.0.0 ("≤ 1.5× of a structuredClone of both documents"):
// structuredClone of the before and after documents of the given fixtures, 20 warm-ups, 11 timed runs, in one process.
// Each fixture is written to results/<type>/clone.json (merged with the fixtures already there); a run only touches the
// types it selects. Default fixtures per type: see DEFAULTS (AsyncAPI has none).
//   node --expose-gc scripts/clone-baseline.js [--type=openapi|graphql|asyncapi|grpc] [--fixtures a,b] [--dry-run]
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const F = require("../fixtures")
const TY = require("../lib/types")

const DEFAULTS = { openapi: ["oas-petstore", "oas-github", "oas-refs-2000", "oas-wide-10000"], graphql: ["gql-github"], asyncapi: [], grpc: ["grpc-poc-1700", "grpc-poc-10200"] }
const argv = process.argv.slice(2)
const types = TY.parseTypes(argv)
// a bare positional list (the old calling convention) is accepted as --fixtures
const positional = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !["--fixtures", "--type"].includes(argv[i - 1])))
const onlyFx = argv.includes("--fixtures") ? argv[argv.indexOf("--fixtures") + 1].split(",") : positional ? positional.split(",") : null

for (const type of types) {
  const names = (onlyFx || DEFAULTS[type]).filter((n) => TY.typeOf(F.get(n)) === type)
  if (!names.length) continue
  const OUT = TY.resultFile(type, "clone.json")
  if (TY.isDryRun(argv)) {
    TY.dry(type, `structuredClone baseline of ${names.join(", ")} -> ${path.relative(P.BENCH, OUT)}`)
    continue
  }
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {}
  console.log(`== ${type} -> ${path.relative(P.BENCH, OUT)}`)
  for (const n of names) {
    const fmt = F.get(n).family === "graphql" ? "gql-1.0" : F.get(n).family === "protoapi" ? "protoapi" : "json"
    const b = F.readInput(n, "before", fmt)
    const a = F.readInput(n, "after", fmt)
    for (let i = 0; i < 20; i++) structuredClone([b, a])
    const t = []
    for (let i = 0; i < 11; i++) {
      global.gc?.()
      const t0 = process.hrtime.bigint()
      structuredClone(b)
      structuredClone(a)
      t.push(Number(process.hrtime.bigint() - t0) / 1e6)
    }
    t.sort((x, y) => x - y)
    out[n] = { format: fmt, medianMs: t[5], minMs: t[0] }
    console.log(`${n.padEnd(20)} structuredClone(before)+structuredClone(after): median ${t[5].toFixed(2)} ms, min ${t[0].toFixed(2)} ms`)
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
}
