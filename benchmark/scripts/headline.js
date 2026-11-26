"use strict"
// The 1.0.6-vs-2.0.0 table of the Performance section of the documentation (docs/guide/limitations.md) and of the
// CHANGELOG: the published api-smart-diff 1.0.6 against the repository build on the same fixtures, with the timing
// method of scripts/bench.js (fresh process per cell, warm-ups, min of 7 to 11 timed calls). Writes the raw cells to
// .work/headline/results/ and the table to .work/headline/HEADLINE.md (and stdout). Takes a few minutes, most of it
// 1.0.6 on the GitHub REST description and its 60 s timeout on the GitHub GraphQL schema.
// --publish also writes it as results/HEADLINE.md (BENCH_DOCS), the committed report.
//   node scripts/headline.js [--quick] [--publish]
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const P = require("./paths")

const OUT = path.join(P.BENCH, ".work", "headline")
const RESULTS = path.join(OUT, "results")
const env = { ...process.env, BENCH_RESULTS: RESULTS }
const quick = process.argv.includes("--quick")

const ROWS = [
  ["GitHub REST API description (7.6 MB JSON, 1 281 operations), 21 changes", "openapi", "oas-github"],
  ["GitHub public GraphQL schema (1.1 MB SDL), 18 changes", "graphql", "gql-github"],
  ["OpenAPI petstore, 24 changes", "openapi", "oas-petstore"],
  ["A schema with 10 000 properties", "openapi", "oas-wide-10000"],
  ["A schema with 1 500 properties, in a request", "openapi", "oas-dir-request-1500"],
  ["A schema with 1 500 properties, in a response", "openapi", "oas-dir-response-1500"],
  ["AsyncAPI 2.6 event API (3 KB), 12 changes", "asyncapi", "aa2-events"],
]
const ADAPTERS = ["asd-1.0.6", "asd-2.0.0"]

const load = () => os.loadavg().map((x) => x.toFixed(1)).join(" / ")
const loadBefore = load()
for (const type of ["openapi", "graphql", "asyncapi"]) {
  const fixtures = ROWS.filter((r) => r[1] === type).map((r) => r[2])
  const args = ["scripts/bench.js", `--type=${type}`, "--fixtures", fixtures.join(","), "--adapters", ADAPTERS.join(","), ...(quick ? ["--quick"] : [])]
  const r = spawnSync(process.execPath, args, { cwd: P.BENCH, env, stdio: "inherit" })
  if (r.status !== 0) process.exit(r.status || 1)
}
const loadAfter = load()

const cells = Object.assign({}, ...["openapi", "graphql", "asyncapi"].map((t) => JSON.parse(fs.readFileSync(path.join(RESULTS, t, "bench.json"), "utf8")).cells))
const fmt = (c) => {
  if (!c) return "—"
  if (c.status === "timeout" || c.status === "timeout-budget") return "not finished after 60 s"
  if (c.status !== "ok") return c.status
  const ms = c.minMs
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : ms >= 100 ? `${(ms / 1000).toFixed(2)} s` : ms >= 10 ? `${ms.toFixed(0)} ms` : `${ms.toFixed(1)} ms`
}
const manifest = JSON.parse(fs.readFileSync(path.join(P.BUILD, "manifest.json"), "utf8")).variants
const lines = [
  `The published api-smart-diff ${manifest["asd-1.0.6"]?.version} package vs the repository build of ${manifest["asd-2.0.0"]?.version}${manifest["asd-2.0.0"]?.git?.commit ? ` (commit ${manifest["asd-2.0.0"].git.commit})` : ""}; measured `${new Date().toISOString().slice(0, 10)}, Node.js ${process.version}, ${os.cpus()[0].model}; load average (1 / 5 / 15 min) ${loadBefore} before and ${loadAfter} after the run${quick ? "; quick mode (2 warm-ups)" : ""}. Minimum of the timed calls.`,
  "",
  "| Input | 1.0.6 | 2.0.0 |",
  "| --- | --- | --- |",
  ...ROWS.map(([label, , fx]) => `| ${label} | ${fmt(cells[`${fx}|asd-1.0.6`])} | ${fmt(cells[`${fx}|asd-2.0.0`])} |`),
]
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, "HEADLINE.md"), `${lines.join("\n")}\n`)
if (process.argv.includes("--publish")) {
  const doc = [
    "# api-smart-diff benchmark: 1.0.6 vs 2.0.0 headline",
    "",
    "The table of the Performance section of the documentation, re-measured by `npm run headline` ([README](../README.md)): the published api-smart-diff 1.0.6 package against the repository build, one fresh process per cell, 20 warm-up calls (fewer when they would exceed 60 s), minimum of 7 to 11 timed calls, documents parsed outside the timing. The full comparison with the other tools is in the [overview](README.md).",
    "",
    ...lines,
  ]
  fs.mkdirSync(P.DOCS, { recursive: true })
  fs.writeFileSync(path.join(P.DOCS, "HEADLINE.md"), `${doc.join("\n")}\n`)
}
console.log(`\n${lines.join("\n")}\n\nwritten to ${path.relative(P.BENCH, path.join(OUT, "HEADLINE.md"))}`)
