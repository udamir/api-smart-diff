"use strict"
// Process timing of the Go CLIs (oasdiff, openapi-changes): one process per run, inputs are the cached JSON files.
// Per tool a no-op baseline (comparing a minimal document with itself) is measured the same way; "in-process
// equivalent" = median(run) - median(no-op). The cost of writing the inputs (JSON.stringify + writeFileSync of both
// documents) is measured separately per fixture. Peak RSS comes from one extra run under /usr/bin/time -l.
// Written to results/<type>/cli.json (with that type's own no-op baseline); types no CLI accepts (GraphQL) are skipped.
//   node scripts/cli.js [--type=openapi|graphql|asyncapi|grpc] [--fixtures a,b] [--tools oasdiff] [--quick]
// grpc: buf breaking per category on the `.proto` trees; its no-op baseline compares a one-message tree with itself.
//   (--quick = 2 warm-up runs; --dry-run: list the cells, run and write nothing)
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const P = require("./paths")
const F = require("../fixtures")
const { cliTools, runCli } = require("../lib/cli")
const TY = require("../lib/types")
const RS = require("../lib/results")

const argv = process.argv.slice(2)
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1].split(",") : null)
const onlyFx = opt("--fixtures")
const onlyTools = opt("--tools")
const quick = argv.includes("--quick")
const types = TY.parseTypes(argv)
const dryRun = TY.isDryRun(argv)
const TMP = path.join(P.BUILD, "cli-tmp")
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// peak RSS of one extra run: BSD time (macOS) prints bytes with -l, GNU time (Linux) kilobytes with -v
const peakRss = (tool, args) => {
  const mac = process.platform === "darwin"
  const t = spawnSync("/usr/bin/time", [mac ? "-l" : "-v", tool.bin, ...args], { encoding: "utf8", maxBuffer: 1 << 30, ...(tool.cwd ? { cwd: tool.cwd } : {}) })
  if (t.error) return undefined
  const m = mac ? /(\d+)\s+maximum resident set size/.exec(t.stderr || "") : /Maximum resident set size \(kbytes\): (\d+)/.exec(t.stderr || "")
  return m ? Number(m[1]) * (mac ? 1 : 1024) : undefined
}

const series = (tool, args) => {
  const probe = runCli(tool, args)
  if (probe.error || probe.signal || (tool.okStatus ? !tool.okStatus.includes(probe.status) : probe.status > 1)) return { status: probe.signal ? "timeout" : "error", error: probe.error || probe.stderr, probeMs: probe.ms }
  const warmups = quick ? 2 : Math.max(2, Math.min(20, Math.floor(60000 / Math.max(probe.ms, 1))))
  for (let i = 0; i < warmups; i++) runCli(tool, args)
  const times = []
  for (let i = 0; i < 7; i++) times.push(runCli(tool, args).ms)
  return { status: "ok", probeMs: probe.ms, warmups, runs: 7, times, medianMs: median(times), minMs: Math.min(...times), peakRssBytes: peakRss(tool, args) }
}

const runType = (type) => {
  const fixtures = F.all.filter((f) => TY.typeOf(f) === type && (!onlyFx || onlyFx.includes(f.name)))
  const tools = cliTools.filter((t) => (!onlyTools || onlyTools.includes(t.id)) && fixtures.some((f) => t.supports(f) === true))
  if (!fixtures.length || !tools.length) {
    if (fixtures.length) console.log(`== ${type}: no CLI tool accepts these fixtures, skipped`)
    return
  }
  const OUT = TY.resultFile(type, "cli.json")
  if (dryRun) {
    for (const t of tools) TY.dry(type, "no-op baseline".padEnd(24), t.id)
    for (const fx of fixtures) {
      if (!tools.some((t) => t.supports(fx) === true)) continue
      for (const t of tools) TY.dry(type, fx.name.padEnd(24), t.id.padEnd(16), t.supports(fx) === true ? `process series${quick ? " (quick)" : ""}` : `n/a: ${t.supports(fx)}`)
    }
    TY.dry(type, `-> ${path.relative(P.BENCH, OUT)}`)
    return
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.mkdirSync(TMP, { recursive: true })
  // merged into the file before every write (lib/results.js): a partial run keeps the other runs' cells
  const init = () => ({ noop: {}, write: {}, cells: {} })
  const data = init()
  const save = () =>
    RS.update(OUT, init, (d) => {
      d.type = type
      Object.assign(d.noop, data.noop)
      Object.assign(d.write, data.write)
      Object.assign(d.cells, data.cells)
    })
  console.log(`== ${type}: ${fixtures.length} fixtures, ${tools.map((t) => t.id).join(", ")} -> ${path.relative(P.BENCH, OUT)}`)
  const tiny = path.join(TMP, "tiny.json")
  fs.writeFileSync(tiny, JSON.stringify({ openapi: "3.0.3", info: { title: "noop", version: "1.0.0" }, paths: {} }))
  const tiny3 = path.join(TMP, "tiny-aa3.json")
  fs.writeFileSync(tiny3, JSON.stringify({ asyncapi: "3.0.0", info: { title: "noop", version: "1.0.0" } }))
  const tinyProto = path.join(TMP, "tiny.proto.d")
  fs.mkdirSync(tinyProto, { recursive: true })
  fs.writeFileSync(path.join(tinyProto, "a.proto"), 'syntax = "proto3";\npackage noop;\nmessage M { string s = 1; }\n')
  for (const t of tools) {
    data.noop[t.id] = series(t, t.noop(t.format === "proto" ? tinyProto : tiny))
    data.noop[t.id].version = t.version
    console.log(`noop ${t.id}: median ${data.noop[t.id].medianMs?.toFixed(1)} ms, min ${data.noop[t.id].minMs?.toFixed(1)} ms, rss ${((data.noop[t.id].peakRssBytes || 0) / 2 ** 20).toFixed(0)} MB`)
  }
  for (const fx of fixtures) {
    if (!tools.some((t) => t.supports(fx) === true)) continue
    // input write cost (what an in-process caller pays to hand parsed documents to a CLI; grpc: the ProtoApi documents)
    const docFormat = fx.family === "protoapi" ? "protoapi" : "json"
    const b = F.readInput(fx.name, "before", docFormat)
    const a = F.readInput(fx.name, "after", docFormat)
    const w = []
    for (let i = 0; i < 5; i++) {
      const t0 = process.hrtime.bigint()
      fs.writeFileSync(path.join(TMP, "b.json"), JSON.stringify(b))
      fs.writeFileSync(path.join(TMP, "a.json"), JSON.stringify(a))
      w.push(Number(process.hrtime.bigint() - t0) / 1e6)
    }
    data.write[fx.name] = { medianMs: median(w), minMs: Math.min(...w) }
    for (const t of tools) {
      const key = `${fx.name}|${t.id}`
      const sup = t.supports(fx)
      if (sup !== true) {
        data.cells[key] = { fixture: fx.name, tool: t.id, status: "n/a", reason: sup }
        continue
      }
      const r = series(t, t.args(F.file(fx.name, "before", t.format || "json"), F.file(fx.name, "after", t.format || "json"), fx))
      const noop = data.noop[t.id].medianMs
      data.cells[key] = { fixture: fx.name, tool: t.id, ...r, noopMedianMs: noop, inProcessEquivMs: r.status === "ok" ? Math.max(0, r.medianMs - noop) : undefined, measuredAt: RS.now() }
      console.log(`${fx.name.padEnd(24)} ${t.id.padEnd(16)} ${r.status === "ok" ? `median ${r.medianMs.toFixed(1).padStart(9)} ms  min ${r.minMs.toFixed(1).padStart(9)} ms  minus no-op ${(r.medianMs - noop).toFixed(1).padStart(9)} ms  rss ${((r.peakRssBytes || 0) / 2 ** 20).toFixed(0)} MB` : `${r.status} ${String(r.error).slice(0, 120)}`}`)
      save()
    }
  }
  save()
}
const main = () => {
  for (const type of types) runType(type)
}
main()
