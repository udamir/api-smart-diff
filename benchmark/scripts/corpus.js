"use strict"
// Functional comparison on the harvested compatibility corpus of the repository (test/compat/**): every
// variant (both documents) goes through every tool of its API type, the outputs are normalized with the vocabulary of
// lib/vocab.js and scored per variant for detection, classification (incl. risky) and description
// (lib/corpus-score.js). Writes results/<type>/corpus.json; normalized outputs go to fixtures/cache/corpus/raw/<type>/
// (gitignored). The case tables are TypeScript: they are exported with the repository's own TypeScript runner (`vpx`
// of vite-plus, `pnpm install` in the root) by scripts/corpus-export.ts and scripts/corpus-export-grpc.ts.
// grpc: the compat family `protoapi`, api-smart-diff 2.0.0 with the ProtoApi engine and buf breaking per variant (each variant's
// compatibility level = buf category; buf gets the variant's `.proto` trees).
//   node scripts/corpus.js [--type=openapi|graphql|asyncapi|grpc] [--tools a,b] [--cases <regexp on variant id>] [--no-export]
//                          [--limit <n per compat family>] [--jobs <n>] [--timeout <ms>] [--rescore] [--export] [--dry-run]
//   --rescore: score fixtures/cache/corpus/raw without running; --export: force the export
//   (it also runs when the export is missing or older than a case table; --no-export keeps an existing export, e.g.
//   to rescore against the same expectations); --cases / --limit = partial run (smoke),
//   recorded as `selection` in corpus.json.
// In-process tools run in one worker per tool (scripts/corpus-worker.js, 10 s per-call timeout, resumed after a hang
// or crash); the Go CLIs run as one process per variant on temporary JSON files. Tools run in parallel (--jobs,
// default 4), so the per-call times in the raw files are indicative only.
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawn, spawnSync } = require("node:child_process")
const P = require("./paths")
const A = require("../adapters")
const TY = require("../lib/types")
const { cliTools } = require("../lib/cli")
const { caseScore, strictScore, expectedClassOf } = require("../lib/corpus-score")
const { LETTER } = require("../lib/vocab")

const argv = process.argv.slice(2)
const opt = (k) => {
  const eq = argv.find((a) => a.startsWith(`${k}=`))
  if (eq) return eq.slice(k.length + 1)
  return argv.includes(k) ? argv[argv.indexOf(k) + 1] : null
}
const types = TY.parseTypes(argv)
const dryRun = TY.isDryRun(argv)
const rescore = argv.includes("--rescore")
const onlyTools = opt("--tools")?.split(",")
const casesRe = opt("--cases") ? new RegExp(opt("--cases")) : null
const limit = opt("--limit") ? Number(opt("--limit")) : null
const jobs = Number(opt("--jobs") || Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2))))
// the corpus pairs are minimal documents: a call that takes longer than this is a hang (--timeout ms, default 10 s)
const PER_CALL_TIMEOUT_MS = Number(opt("--timeout") || 10_000)
const CORPUS = path.join(P.CACHE, "corpus")

const FLOORS = ["microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"]
// tools of each API type: api-smart-diff 1.0.6 / 2.0.0 (repository build), the fork, the type's peers, floors
const CORPUS_TOOLS = {
  openapi: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "oasdiff", "openapi-changes", "openapi-diff", "json-schema-diff", ...FLOORS],
  graphql: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "graphql-inspector", "graphql-js", ...FLOORS],
  asyncapi: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "asyncapi-diff", "openapi-changes", ...FLOORS],
  grpc: ["asd-2.0.0-proto", "buf", ...FLOORS],
}
// the api-smart-diff 2.0.0 row the `beats` list compares with
const REFS = { grpc: "asd-2.0.0-proto" }
const refOf = (type) => REFS[type] || "asd-2.0.0"
// the build of a type's reference row (corpus.json `builds`)
const BUILDS = { grpc: ["asd-2.0.0"] }

// ---- export of the corpus (TypeScript case tables, run with the repository's vpx) ----
const vpx = (script) => spawnSync("pnpm", ["--dir", P.ASD_ROOT, "exec", "vpx", path.join(__dirname, script)], { stdio: "inherit", cwd: P.BENCH, env: { ...process.env, ASD_BENCH: P.BENCH } })
const newestCaseTable = () => {
  let newest = 0
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name)
      if (e.isDirectory()) walk(f)
      else if (/\.(ts|json)$/.test(e.name)) newest = Math.max(newest, fs.statSync(f).mtimeMs)
    }
  }
  for (const d of [path.join(P.ASD_ROOT, "test", "compat"), path.join(P.ASD_ROOT, "test", "helpers")]) if (fs.existsSync(d)) walk(d)
  return newest
}
const newestProtoCaseTable = () => {
  let newest = 0
  for (const d of [path.join(P.ASD_ROOT, "test", "compat", "protoapi"), path.join(P.ASD_ROOT, "test", "helpers")]) {
    if (!fs.existsSync(d)) continue
    for (const e of fs.readdirSync(d)) if (/\.(ts|json)$/.test(e)) newest = Math.max(newest, fs.statSync(path.join(d, e)).mtimeMs)
  }
  return newest
}
const ensureGrpcExport = () => {
  const file = path.join(CORPUS, "grpc.json")
  const missing = !fs.existsSync(file)
  if (!fs.existsSync(path.join(P.ASD_ROOT, "test", "compat", "protoapi"))) return console.warn(`corpus grpc: ${P.ASD_ROOT} has no test/compat/protoapi${missing ? ", no export: skipped" : ", using the previous export"}`)
  const stale = !missing && fs.statSync(file).mtimeMs < newestProtoCaseTable()
  if (!missing && ((!stale && !argv.includes("--export")) || argv.includes("--no-export"))) return
  if (dryRun) return TY.dry("export", missing ? "missing" : stale ? "stale" : "forced", "vpx scripts/corpus-export-grpc.ts")
  const r = vpx("corpus-export-grpc.ts")
  if (r.status !== 0) {
    if (missing) throw new Error("grpc corpus export failed (scripts/corpus-export-grpc.ts)")
    console.warn("grpc corpus export failed; using the previous export")
  }
}

const ensureExport = () => {
  if (types.includes("grpc")) ensureGrpcExport()
  if (!types.some((t) => t !== "grpc")) return
  const files = TY.TYPES.filter((t) => t !== "grpc").map((t) => path.join(CORPUS, `${t}.json`))
  const missing = files.some((f) => !fs.existsSync(f))
  if (!fs.existsSync(path.join(P.ASD_ROOT, "test", "compat"))) {
    // no case tables: keep a previous export, otherwise every type is skipped by runType
    console.warn(`corpus: ${path.join(P.ASD_ROOT, "test", "compat")} not found${missing ? ", no export: skipped" : ", using the previous export"}`)
    return
  }
  const stale = !missing && Math.min(...files.map((f) => fs.statSync(f).mtimeMs)) < newestCaseTable()
  if (!missing && ((!stale && !argv.includes("--export")) || argv.includes("--no-export"))) return
  if (dryRun) return TY.dry("export", missing ? "missing" : stale ? "stale" : "forced", "vpx scripts/corpus-export.ts")
  const r = vpx("corpus-export.ts")
  if (r.status !== 0) {
    if (missing) throw new Error("corpus export failed (scripts/corpus-export.ts)")
    console.warn("corpus export failed; using the previous export")
  }
}

// ---- running ----
const supportsOf = (tool, fx) => (tool.kind === "lib" ? tool.a.supports(fx) : tool.c.supports(fx))
const fixtureOf = (v) => ({ name: v.id, family: v.docFamily, spec: v.spec, kind: "changeset", compareOptions: v.options })

const runLibTool = (type, toolId, ids, onResult) =>
  new Promise((resolve) => {
    const idsFile = path.join(CORPUS, "tmp", type, `${toolId}.ids.json`)
    fs.mkdirSync(path.dirname(idsFile), { recursive: true })
    fs.writeFileSync(idsFile, JSON.stringify(ids))
    const startFrom = (from) => {
      if (from >= ids.length) return resolve()
      const child = spawn(process.execPath, ["--max-old-space-size=8192", "--stack-size=4000", path.join(__dirname, "corpus-worker.js"), "--type", type, "--tool", toolId, "--ids", idsFile, "--from", String(from)], {
        stdio: ["ignore", "pipe", "pipe"],
      })
      let buf = ""
      let current = -1
      let next = from
      let timer
      let ended = false
      let killedFor
      let stderr = ""
      const arm = () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          killedFor = current
          child.kill("SIGKILL")
        }, PER_CALL_TIMEOUT_MS)
      }
      child.stdout.on("data", (d) => {
        buf += d
        let nl
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl)
          buf = buf.slice(nl + 1)
          if (!line.trim()) continue
          let msg
          try {
            msg = JSON.parse(line)
          } catch {
            continue
          }
          if (msg.phase === "start") {
            current = msg.i
            arm()
          } else if (msg.phase === "done") {
            clearTimeout(timer)
            current = -1
            next = msg.i + 1
            const { phase, i, id, ...res } = msg
            onResult(ids[i], res)
          } else if (msg.phase === "end") ended = true
          else if (msg.phase === "fatal") {
            for (let i = next; i < ids.length; i++) onResult(ids[i], { status: "error", error: msg.error })
            next = ids.length
          }
        }
      })
      child.stderr.on("data", (d) => {
        stderr = (stderr + d).slice(-400)
      })
      child.on("exit", () => {
        clearTimeout(timer)
        if (ended || next >= ids.length) return resolve()
        // hang (timeout) or crash on variant `current`: record it and resume with the next one
        const at = current >= 0 ? current : next
        onResult(ids[at], killedFor === at ? { status: "timeout" } : { status: "crash", error: { name: "ProcessExit", message: stderr.trim().split("\n").slice(-2).join(" | ").slice(0, 300) } })
        startFrom(at + 1)
      })
    }
    startFrom(0)
  })

const runCliAsync = (bin, args, cwd) =>
  new Promise((resolve) => {
    const t0 = process.hrtime.bigint()
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], ...(cwd ? { cwd } : {}) })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => child.kill("SIGKILL"), PER_CALL_TIMEOUT_MS)
    child.stdout.on("data", (d) => {
      stdout += d
    })
    child.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-400)
    })
    child.on("error", (e) => {
      clearTimeout(timer)
      resolve({ error: String(e.message), ms: 0 })
    })
    child.on("exit", (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, stdout, stderr, ms: Number(process.hrtime.bigint() - t0) / 1e6 })
    })
  })

// a `.proto` tree of a corpus variant with the bundled imports buf cannot resolve (see scripts/fixtures.js)
let bundle
const writeProtoTree = (dir, sources) => {
  bundle = bundle || require(path.join(P.BUILD, "conv-protoapi", "index.cjs")).bundledFiles
  const files = { ...sources }
  const queue = Object.values(sources)
  while (queue.length) {
    for (const m of queue.pop().matchAll(/^\s*import\s+(?:public\s+|weak\s+)?"([^"]+)"\s*;/gm)) {
      const f = m[1]
      if (files[f] || f.startsWith("google/protobuf/") || !bundle[f]) continue
      files[f] = bundle[f]
      queue.push(bundle[f])
    }
  }
  fs.rmSync(dir, { recursive: true, force: true })
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    fs.writeFileSync(path.join(dir, f), text)
  }
}

const runCliTool = async (type, tool, variants, onResult) => {
  const dir = path.join(CORPUS, "tmp", type, tool.id)
  fs.mkdirSync(dir, { recursive: true })
  for (const [k, v] of variants.entries()) {
    const proto = tool.c.format === "proto"
    const b = path.join(dir, proto ? `${k}.before.proto.d` : `${k}.before.json`)
    const a = path.join(dir, proto ? `${k}.after.proto.d` : `${k}.after.json`)
    if (proto) {
      writeProtoTree(b, v.proto[0])
      writeProtoTree(a, v.proto[1])
    } else {
      fs.writeFileSync(b, JSON.stringify(v.before))
      fs.writeFileSync(a, JSON.stringify(v.after))
    }
    const r = await runCliAsync(tool.c.bin, tool.c.args(b, a, fixtureOf(v)), tool.c.cwd)
    if (r.error || r.signal) onResult(v.id, { status: r.signal === "SIGKILL" ? "timeout" : "error", error: { message: r.error || r.signal } })
    else {
      try {
        onResult(v.id, { status: "ok", ms: r.ms, diffs: tool.c.normalize(r.stdout), exitCode: r.code })
      } catch (e) {
        onResult(v.id, { status: "error", error: { message: `unparseable output (exit ${r.code}): ${String(e.message).slice(0, 100)} | ${String(r.stderr).slice(0, 160)}` } })
      }
    }
    fs.rmSync(b, { force: true, recursive: true })
    fs.rmSync(a, { force: true, recursive: true })
  }
}

const pool = async (tasks, n) => {
  const queue = [...tasks]
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await queue.shift()()
    }),
  )
}

// ---- scoring ----
const emptySummary = () => ({ variants: 0, na: 0, ok: 0, errors: 0, timeouts: 0, detected: 0, classified: [0, 0], breaking: [0, 0], described: [0, 0], all: 0, risky: { expected: 0, agree: 0, verdicts: 0 }, strict: null })
const add = (s, sc, strict) => {
  s.variants++
  if (sc === "n/a") return s.na++
  if (sc.s === "timeout") s.timeouts++
  else if (sc.s) s.errors++
  else s.ok++
  if (sc.d) s.detected++
  for (const [k, f] of [["classified", "c"], ["breaking", "b"], ["described", "a"]]) {
    const x = sc[f]
    if (x === null || x === undefined) continue
    s[k][1]++
    if (x) s[k][0]++
  }
  if (sc.d && sc.c !== 0 && sc.a !== 0) s.all++
  if (sc.rE) s.risky.expected++
  if (sc.rE && sc.rV) s.risky.agree++
  if (sc.rV) s.risky.verdicts++
  if (strict) {
    s.strict = s.strict || { D: 0, C: 0, A: 0, all: 0, of: 0 }
    s.strict.of++
    if (strict[0] === "D") s.strict.D++
    if (strict[1] === "C") s.strict.C++
    if (strict[2] === "A") s.strict.A++
    if (strict === "DCA") s.strict.all++
  }
}
const bit = (x) => (x === null || x === undefined ? null : x ? 1 : 0)
const compact = (tool, v, res, floor) => {
  if (!res || res.status !== "ok") {
    const exp = expectedClassOf(v)
    return { s: res?.status || "missing", n: 0, d: 0, c: exp ? 0 : null, b: exp ? 0 : null, a: floor ? null : 0, v: "", e: exp ? LETTER[exp] : "" }
  }
  const sc = caseScore(tool, v, res.diffs, { floor })
  const out = { n: sc.n, d: bit(sc.d), c: bit(sc.c), b: bit(sc.b), a: bit(sc.a), v: sc.v, e: sc.e }
  if (sc.rE) out.rE = 1
  if (sc.rV) out.rV = 1
  // strict attribution against the current export (raw results of an older run carry only their own strict letters)
  if (res.adiffs) out.strict = strictScore(v, res.adiffs)
  else if (res.strict) out.strict = res.strict
  return out
}

const manifest = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(P.BUILD, "manifest.json"), "utf8"))
  } catch {
    return { variants: {} }
  }
}

const runType = async (type) => {
  const exportFile = path.join(CORPUS, `${type}.json`)
  if (!fs.existsSync(exportFile)) {
    if (dryRun) return TY.dry(type, "corpus export missing; a real run exports it first")
    return console.warn(`corpus ${type}: no export (${path.relative(P.BENCH, exportFile)}), skipped`)
  }
  const corpus = JSON.parse(fs.readFileSync(exportFile, "utf8"))
  let variants = corpus.variants.filter((v) => !casesRe || casesRe.test(v.id))
  if (limit) {
    const per = {}
    variants = variants.filter((v) => (per[v.family] = (per[v.family] || 0) + 1) <= limit)
  }
  const tools = CORPUS_TOOLS[type]
    .filter((id) => !onlyTools || onlyTools.includes(id))
    .map((id) => {
      const c = cliTools.find((x) => x.id === id)
      return c ? { id, kind: "cli", c } : { id, kind: "lib", a: A.get(id) }
    })
  const RAW = path.join(CORPUS, "raw", type)
  const OUT = TY.resultFile(type, "corpus.json")
  console.log(`== ${type}: ${variants.length} of ${corpus.variants.length} variants x ${tools.length} tools -> ${path.relative(P.BENCH, OUT)}`)
  const raw = {}
  const tasks = []
  for (const t of tools) {
    const rawFile = path.join(RAW, `${t.id}.json`)
    raw[t.id] = fs.existsSync(rawFile) ? JSON.parse(fs.readFileSync(rawFile, "utf8")) : {}
    const sup = variants.filter((v) => supportsOf(t, fixtureOf(v)) === true)
    if (dryRun) {
      TY.dry(type, t.id.padEnd(18), `${sup.length} supported variants`, rescore ? "rescore" : t.kind === "lib" ? "worker" : "cli processes", `raw -> ${path.relative(P.BENCH, rawFile)}`)
      continue
    }
    if (rescore || !sup.length) continue
    tasks.push(async () => {
      const t0 = Date.now()
      const counts = {}
      const onResult = (id, res) => {
        raw[t.id][id] = res
        counts[res.status] = (counts[res.status] || 0) + 1
      }
      if (t.kind === "lib") await runLibTool(type, t.id, sup.map((v) => v.id), onResult)
      else await runCliTool(type, t, sup, onResult)
      fs.mkdirSync(RAW, { recursive: true })
      fs.writeFileSync(rawFile, JSON.stringify(raw[t.id]))
      console.log(`${type.padEnd(9)} ${t.id.padEnd(18)} ${String(sup.length).padStart(5)} variants  ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ")}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
    })
  }
  if (dryRun) return
  await pool(tasks, jobs)

  // score
  const summary = {}
  const byFamily = {}
  const out = {}
  const beats = []
  for (const v of variants) {
    const row = { f: v.family, x: LETTER[expectedClassOf(v)] || "", ...(v.issue ? { issue: v.issue } : {}), ...(v.policy ? { policy: v.policy } : {}), t: {} }
    for (const t of tools) {
      const floor = FLOORS.includes(t.id)
      const sup = supportsOf(t, fixtureOf(v)) === true
      const sc = sup ? compact(t.id, v, raw[t.id][v.id], floor) : "n/a"
      if (sup) row.t[t.id] = sc
      summary[t.id] = summary[t.id] || emptySummary()
      byFamily[v.family] = byFamily[v.family] || {}
      byFamily[v.family][t.id] = byFamily[v.family][t.id] || emptySummary()
      add(summary[t.id], sc, sc !== "n/a" && sc.strict)
      add(byFamily[v.family][t.id], sc, sc !== "n/a" && sc.strict)
    }
    // where another tool does better than asd 2.0.0 on this variant (case level)
    const REF = refOf(type)
    const ref = row.t[REF]
    if (ref) {
      for (const t of tools) {
        if (t.id === REF) continue
        const x = row.t[t.id]
        if (!x || x.s) continue
        const dims = [["d", "detected"], ["c", "classified"], ["b", "breaking"], ["a", "described"]].filter(([k]) => x[k] === 1 && ref[k] !== 1 && ref[k] !== null).map(([, n]) => n)
        if (FLOORS.includes(t.id)) dims.splice(0, dims.length, ...dims.filter((d) => d === "detected"))
        if (dims.length) beats.push({ id: v.id, tool: t.id, dims, expected: row.x, ref: `${ref.s || ref.v || "-"}/${ref.n}`, peer: `${x.v || "-"}/${x.n}` })
      }
    }
    out[v.id] = row
  }
  const beatCounts = {}
  for (const b of beats) {
    const c = (beatCounts[b.tool] = beatCounts[b.tool] || { variants: 0, detected: 0, classified: 0, breaking: 0, described: 0 })
    c.variants++
    for (const d of b.dims) c[d]++
  }
  const m = manifest().variants
  const data = {
    type,
    generatedAt: new Date().toISOString(),
    export: corpus.head,
    builds: Object.fromEntries((BUILDS[type] || ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1"]).map((id) => [id, { version: m[id]?.version, git: m[id]?.git }])),
    selection: casesRe || limit || onlyTools ? { cases: opt("--cases"), limit, tools: onlyTools } : null,
    method:
      "case level per variant (lib/corpus-score.js): n = diffs, v / e = verdict / expected class letter, d = detected, c = verdict (most severe class) is the expected class, b = same side of the breaking line (risky = breaking side), a = every diff strongly described; 1 / 0 / null = n/a; strict (api-smart-diff only) = compat attribution D/C/A of test/helpers/compat.ts without the identical / mutation checks",
    tools: tools.map((t) => t.id),
    summary,
    byFamily,
    beats: { reference: refOf(type), counts: beatCounts, list: beats },
    variants: out,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `{\n${Object.entries(data).map(([k, x]) => (k === "variants" ? `"variants":{\n${Object.entries(x).map(([id, r]) => `${JSON.stringify(id)}:${JSON.stringify(r)}`).join(",\n")}\n}` : `${JSON.stringify(k)}:${JSON.stringify(x, null, k === "beats" ? 0 : 1)}`)).join(",\n")}\n}\n`)
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—")
  for (const t of tools) {
    const s = summary[t.id]
    const run = s.variants - s.na
    console.log(
      `${type.padEnd(9)} ${t.id.padEnd(18)} run ${String(run).padStart(5)}  n/a ${String(s.na).padStart(5)}  err ${s.errors}  t/o ${s.timeouts}  detected ${pct(s.detected, run)}  classified ${pct(...s.classified)}  breaking ${pct(...s.breaking)}  described ${pct(...s.described)}  risky ${s.risky.agree}/${s.risky.expected} (${s.risky.verdicts} verdicts)${s.strict ? `  strict D ${pct(s.strict.D, s.strict.of)} C ${pct(s.strict.C, s.strict.of)} A ${pct(s.strict.A, s.strict.of)} all ${pct(s.strict.all, s.strict.of)}` : ""}${beatCounts[t.id] ? `  beats ${refOf(type)} on ${beatCounts[t.id].variants}` : ""}`,
    )
  }
}

const main = async () => {
  ensureExport()
  for (const type of types) await runType(type)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
