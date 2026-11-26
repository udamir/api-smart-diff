"use strict"
// Correctness / classification quality. For every change-set, identical and synthetic fixture and every tool:
// one call in a fresh process (60 s timeout), the tool's diffs normalized to { hay, cls, desc } (adapters.js,
// lib/cli.js) and written to results/<type>/raw/<fixture>/<tool>.json, then scored against
// fixtures/cache/<fx>/expected.json. Scores go to results/<type>/quality.json; a run only touches the types it selects.
//   node scripts/quality.js [--type=openapi|graphql|asyncapi|grpc] [--fixtures a,b] [--tools x,y] [--rescore]
// grpc: an expected class may be given per compatibility level ({ FILE, PACKAGE, WIRE_JSON, WIRE }); every row is scored
// against the class of its own level (adapter / CLI `level`, FILE when absent).
//   (--rescore: reuse results/<type>/raw, no runs; --dry-run: list the cells, run and write nothing)
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const A = require("../adapters")
const F = require("../fixtures")
const { runCase } = require("../lib/runner")
const { cliTools, runCli } = require("../lib/cli")
const TY = require("../lib/types")
const RS = require("../lib/results")

const argv = process.argv.slice(2)
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1].split(",") : null)
const onlyFx = opt("--fixtures")
const onlyTools = opt("--tools")
const rescore = argv.includes("--rescore")
const types = TY.parseTypes(argv)
const dryRun = TY.isDryRun(argv)

const { SEVERITY, side, acceptedFor, weak, ONE_TIER } = require("../lib/vocab")

// the expected change list as seen by a row of a compatibility level (type grpc), and for a one-tier tool (breaking
// only): an expected change below the breaking line is optional, it has nothing to report there
const expectedFor = (expected, tool, level) =>
  expected?.map((e) => {
    const cls = e.class && typeof e.class === "object" ? e.class[level || "FILE"] : e.class
    return { ...e, class: cls, optional: !!e.optional || (ONE_TIER.has(tool) && side(cls) !== "B") }
  })

const matches = (d, e, coarse) => {
  const tokOk = e.tokens.every((t) => (Array.isArray(t) ? t.some((x) => d.hay.includes(x)) : d.hay.includes(t))) && !(e.not || []).some((t) => d.hay.includes(t))
  if (tokOk) return true
  return !!(coarse && e.sites && e.sites.some((s) => s.every((t) => d.hay.includes(t))))
}

const score = (tool, fx, diffs, expected, coarse) => {
  const described = diffs.filter((d) => d.desc && d.desc.trim()).length
  const weakDesc = diffs.filter((d) => d.desc && d.desc.trim() && weak(d.desc, d)).length
  const classes = {}
  for (const d of diffs) classes[d.cls] = (classes[d.cls] || 0) + 1
  const base = { diffs: diffs.length, described, weakDescriptions: weakDesc, classes }
  if (!expected) return base
  if (fx.kind === "identical") return { ...base, spurious: diffs.length }
  if (A.all.find((a) => a.id === tool)?.docLevel) {
    const expectBreaking = expected.some((e) => side(e.class) === "B")
    const verdict = diffs.some((d) => d.cls === "breaking") ? "breaking" : diffs.length ? "non-breaking" : "none"
    return { ...base, docLevel: true, docVerdict: verdict, docExpected: expectBreaking ? "breaking" : "non-breaking", docAgree: (verdict === "breaking") === expectBreaking }
  }
  const matchedDiff = new Array(diffs.length).fill(false)
  const changes = expected.map((e) => {
    const m = []
    diffs.forEach((d, i) => {
      if (matches(d, e, coarse)) {
        m.push(d)
        matchedDiff[i] = true
      }
    })
    const verdict = m.length ? SEVERITY.find((s) => m.some((d) => d.cls === s)) : undefined
    const accepted = acceptedFor(tool, e.class, e.accept)
    const classAgree = verdict ? accepted.has(verdict) : false
    const breakingAgree = verdict ? classAgree || (side(verdict) !== "U" && side(verdict) === side(e.class)) : false
    // risky scored on its own: the change is expected risky and the tool says risky
    const riskyExpected = e.class === "risky"
    const riskyAgree = verdict === "risky" && accepted.has("risky")
    return { id: e.id, expected: e.class, optional: !!e.optional, issue: e.issue, detected: m.length > 0, n: m.length, verdict, classAgree, breakingAgree, riskyExpected, riskyAgree }
  })
  const req = changes.filter((c) => !c.optional)
  const detected = changes.filter((c) => c.detected)
  const matched = matchedDiff.filter(Boolean).length
  return {
    ...base,
    expected: req.length,
    detected: req.filter((c) => c.detected).length,
    recall: req.length ? req.filter((c) => c.detected).length / req.length : null,
    matchedDiffs: matched,
    spurious: diffs.length - matched,
    precision: diffs.length ? matched / diffs.length : null,
    classAgree: detected.filter((c) => c.classAgree).length,
    breakingAgree: detected.filter((c) => c.breakingAgree).length,
    detectedAll: detected.length,
    // risky column: expected-risky changes found as risky / expected-risky changes; risky verdicts over all detected
    // changes (a risky verdict on an expected breaking change still counts for breaking agreement)
    riskyExpected: req.filter((c) => c.riskyExpected).length,
    riskyAgree: req.filter((c) => c.riskyExpected && c.riskyAgree).length,
    riskyVerdicts: detected.filter((c) => c.verdict === "risky").length,
    riskyDiffs: diffs.filter((d) => d.cls === "risky").length,
    endToEnd: req.length ? req.filter((c) => c.detected && c.breakingAgree).length / req.length : null,
    falseBreaking: changes.filter((c) => c.detected && side(c.verdict) === "B" && side(c.expected) === "N" && !c.breakingAgree).map((c) => c.id),
    missedBreaking: changes.filter((c) => !c.optional && side(c.expected) === "B" && (!c.detected || (side(c.verdict) !== "B" && !c.classAgree))).map((c) => c.id),
    changes,
  }
}

const runType = async (type) => {
  const fixtures = F.all.filter((f) => TY.typeOf(f) === type && (!onlyFx || onlyFx.includes(f.name)))
  if (!fixtures.length) return
  const OUT = TY.resultFile(type, "quality.json")
  const RAW = TY.rawDir(type)
  // the file is re-read and merged before every write (lib/results.js), so parallel or chunked runs keep each other's cells
  const data = RS.read(OUT, () => ({ cells: {} }))
  const touched = new Set()
  const tools = [...A.all.filter((a) => !a.aux).map((a) => ({ id: a.id, kind: "lib", a })), ...cliTools.map((c) => ({ id: c.id, kind: "cli", c }))].filter((t) => !onlyTools || onlyTools.includes(t.id))
  console.log(`== ${type}: ${fixtures.length} fixtures -> ${path.relative(P.BENCH, OUT)}`)
  for (const fx of fixtures) {
    const expected = F.readExpected(fx.name) || (fx.kind === "identical" ? [] : undefined)
    for (const t of tools) {
      const key = `${fx.name}|${t.id}`
      const sup = t.kind === "lib" ? t.a.supports(fx) : t.c.supports(fx)
      if (sup !== true) {
        data.cells[key] = { fixture: fx.name, tool: t.id, status: "n/a", reason: sup }
        touched.add(key)
        continue
      }
      const rawFile = path.join(RAW, fx.name, `${t.id}.json`)
      if (dryRun) {
        TY.dry(type, fx.name.padEnd(24), t.id.padEnd(18), rescore ? "rescore" : t.kind === "lib" ? "worker (quality)" : "cli process", `raw -> ${path.relative(P.BENCH, rawFile)}`)
        continue
      }
      let run = data.cells[key]?.run
      if (!rescore) {
        if (t.kind === "lib") {
          run = await runCase({ adapter: t.id, fixture: fx.name, mode: "quality", out: rawFile })
        } else {
          const b = F.file(fx.name, "before", t.c.format || "json")
          const a = F.file(fx.name, "after", t.c.format || "json")
          const r = runCli(t.c, t.c.args(b, a, fx))
          const failed = r.error || r.signal || (t.c.okStatus && !t.c.okStatus.includes(r.status))
          run = { status: failed ? (r.signal === "SIGTERM" ? "timeout" : "error") : "ok", callMs: r.ms, exitCode: r.status, stderr: r.stderr }
          if (run.status === "ok") {
            try {
              const diffs = t.c.normalize(r.stdout)
              fs.mkdirSync(path.dirname(rawFile), { recursive: true })
              fs.writeFileSync(rawFile, JSON.stringify(diffs))
              run.diffs = diffs.length
              run.mergedDocument = false
              run.mutatedInput = false
            } catch (e) {
              run.status = "error"
              run.error = { message: `unparseable output: ${String(e.message).slice(0, 120)} | ${String(r.stdout).slice(0, 120)} | ${r.stderr}` }
            }
          } else run.error = { message: r.error || r.stderr }
        }
      }
      const cell = { fixture: fx.name, tool: t.id, status: run.status, run }
      if (run.status === "ok" && fs.existsSync(rawFile)) {
        const diffs = JSON.parse(fs.readFileSync(rawFile, "utf8"))
        Object.assign(cell, score(t.id, fx, diffs, expectedFor(expected, t.id, t.kind === "lib" ? t.a.level : t.c.level), t.kind === "lib" && !!t.a.coarse))
      }
      if (!rescore) cell.measuredAt = RS.now()
      else if (data.cells[key]?.measuredAt) cell.measuredAt = data.cells[key].measuredAt
      data.cells[key] = cell
      touched.add(key)
      const s = cell
      console.log(
        `${fx.name.padEnd(24)} ${t.id.padEnd(18)} ${String(s.status).padEnd(8)} ${s.diffs !== undefined ? `${String(s.diffs).padStart(6)} diffs` : (s.reason || s.run?.error?.message || "").slice(0, 100)}${s.recall !== undefined && s.recall !== null ? `  recall ${(s.recall * 100).toFixed(0)}%  prec ${s.precision === null ? "-" : `${(s.precision * 100).toFixed(0)}%`}  class ${s.classAgree}/${s.detectedAll}  brk ${s.breakingAgree}/${s.detectedAll}  missedB [${s.missedBreaking}] falseB [${s.falseBreaking}]` : ""}${s.docLevel ? `  doc ${s.docVerdict} (expected ${s.docExpected})` : ""}${fx.kind === "identical" && s.diffs !== undefined ? (s.diffs ? "  <-- NOT ZERO" : "  zero") : ""}${s.run?.mutatedInput === true ? "  [mutates input]" : ""}`,
      )
    }
    if (dryRun) continue
    RS.update(OUT, () => ({ cells: {} }), (d) => {
      d.type = type
      d.generatedAt = RS.now()
      for (const k of touched) d.cells[k] = data.cells[k]
    })
  }
}

const main = async () => {
  for (const type of types) await runType(type)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
