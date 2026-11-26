"use strict"
// Quick mode: a smoke run of every step of every type on a few small fixtures (2 warm-ups, the first variants of each
// compat family of the corpus), written to .work/quick/ so that the committed reports in results/ stay untouched.
// Takes a few minutes; the numbers are not comparable with a full run.
//   node scripts/quick.js [--type=openapi,graphql,asyncapi,grpc] [--no-fork-tests]
// Results: .work/quick/results/<type>/*.json, reports: .work/quick/reports/*.md
const { spawnSync } = require("node:child_process")
const path = require("node:path")
const P = require("./paths")
const TY = require("../lib/types")

const argv = process.argv.slice(2)
const types = TY.parseTypes(argv)
const OUT = path.join(P.BENCH, ".work", "quick")
const env = { ...process.env, BENCH_RESULTS: path.join(OUT, "results"), BENCH_DOCS: path.join(OUT, "reports") }

const FIXTURES = {
  openapi: ["oas-petstore", "oas-petstore-identical", "oas-oneof-40", "js-repo-pair", "js-identical"],
  graphql: ["gql-repo-pair"],
  asyncapi: ["aa2-events", "aa3-events", "aa2-identical", "aa3-identical"],
  grpc: ["grpc-shop", "grpc-shop-identical", "grpc-poc-170"],
}
const steps = (type) => {
  const fx = ["--fixtures", FIXTURES[type].join(",")]
  const t = `--type=${type}`
  return [
    ...(type === "openapi" || type === "graphql") && !argv.includes("--no-fork-tests") ? [["fork-tests", ["scripts/fork-tests.js", t]]] : [],
    ["quality", ["scripts/quality.js", t, ...fx]],
    ["corpus", ["scripts/corpus.js", t, "--limit", "2"]],
    ["bench", ["scripts/bench.js", t, ...fx, "--quick"]],
    ["heap", ["scripts/heap.js", t, "--fixtures", FIXTURES[type][0]]],
    ...(type !== "graphql" ? [["cli", ["scripts/cli.js", t, ...fx, "--quick"]]] : []),
  ]
}

const timings = []
let failed = 0
for (const type of types) {
  for (const [name, args] of steps(type)) {
    const t0 = Date.now()
    console.log(`\n### ${type} ${name}: node ${args.join(" ")}`)
    const r = spawnSync(process.execPath, args, { cwd: P.BENCH, env, stdio: "inherit" })
    timings.push([type, name, ((Date.now() - t0) / 1000).toFixed(1), r.status])
    if (r.status !== 0) failed++
  }
}
const t0 = Date.now()
const only = ["index", ...types].join(",")
const r = spawnSync(process.execPath, ["scripts/report.js", "--only", only], { cwd: P.BENCH, env, stdio: "inherit" })
timings.push(["all", "report", ((Date.now() - t0) / 1000).toFixed(1), r.status])
if (r.status !== 0) failed++
console.log(`\n${"type".padEnd(9)} ${"step".padEnd(11)} ${"seconds".padStart(8)}  exit`)
for (const [type, name, s, status] of timings) console.log(`${type.padEnd(9)} ${name.padEnd(11)} ${s.padStart(8)}  ${status}`)
console.log(`\nreports in ${path.relative(P.BENCH, env.BENCH_DOCS)}/, results in ${path.relative(P.BENCH, env.BENCH_RESULTS)}/`)
process.exit(failed ? 1 : 0)
