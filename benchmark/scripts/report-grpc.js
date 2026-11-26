"use strict"
// Tables of the gRPC / Protocol Buffers report (type grpc): templates/GRPC.template.md -> results/GRPC.md, rendered by
// scripts/report.js (`node scripts/report.js --only grpc`). Reads
// results/grpc/{quality,corpus,bench,heap,cli,clone}.json, build/manifest.json, the fixture metadata and (for the
// corpus breakdown by area and level) the corpus export fixtures/cache/corpus/grpc.json.
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const F = require("../fixtures")
const TY = require("../lib/types")
const { LETTER, side } = require("../lib/vocab")

const LEVELS = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]
const ASD = { FILE: "asd-2.0.0-proto", PACKAGE: "asd-2.0.0-proto-package", WIRE_JSON: "asd-2.0.0-proto-wire-json", WIRE: "asd-2.0.0-proto-wire" }
const BUF = { FILE: "buf", PACKAGE: "buf-package", WIRE_JSON: "buf-wire-json", WIRE: "buf-wire" }
const FLOORS = ["microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"]
const LABEL = {
  ...Object.fromEntries(LEVELS.map((l) => [ASD[l], `asd 2.0.0 ${l}`])),
  ...Object.fromEntries(LEVELS.map((l) => [BUF[l], `buf ${l}`])),
  "asd-2.0.0-proto-e2e": "asd 2.0.0 from .proto (FILE)",
  "protoapi-build": "protoapi build only",
  microdiff: "microdiff",
  jsondiffpatch: "jsondiffpatch",
  "deep-diff": "deep-diff",
  "fast-json-patch": "fast-json-patch",
}

const read = (file, dflt) => {
  const p = TY.resultFile("grpc", file)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : dflt
}
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n")
const fmtMs = (v) => (v === undefined || v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2))
const fmtMB = (b) => (b === undefined || b === null ? "—" : (b / 2 ** 20).toFixed(1))
const pct = (a, b) => (b ? `${a}/${b} (${Math.round((a / b) * 100)}%)` : "—")
const KB = (b) => (b === undefined ? "—" : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`)

const placeholders = () => {
  const T = {}
  const quality = read("quality.json", { cells: {} })
  const bench = read("bench.json", { cells: {} })
  const heap = read("heap.json", { cells: {} })
  const cli = read("cli.json", { noop: {}, write: {}, cells: {} })
  const clone = read("clone.json", {})
  const corpus = read("corpus.json", null)
  const manifest = fs.existsSync(path.join(P.BUILD, "manifest.json")) ? JSON.parse(fs.readFileSync(path.join(P.BUILD, "manifest.json"), "utf8")) : { variants: {} }
  const fixtures = F.all.filter((f) => f.family === "protoapi")
  const meta = (name) => {
    try {
      return F.readMeta(name)
    } catch {
      return {}
    }
  }
  const q = (fx, tool) => quality.cells[`${fx}|${tool}`]

  // ---- environment ----
  const v = manifest.variants
  const env = bench.env || {}
  // results measured before the ProtoApi engine was part of the repository build name that build asd-2.0.0-protoapi
  const asdBuild = v["asd-2.0.0"] || v["asd-2.0.0-protoapi"] || {}
  const asdText = [asdBuild.source || asdBuild.label || "", asdBuild.version ? `version ${asdBuild.version}` : "", asdBuild.git?.commit ? `${asdBuild.git.branch || "?"} at ${asdBuild.git.commit}${asdBuild.git.dirtySrcFiles ? ` with ${asdBuild.git.dirtySrcFiles} uncommitted src files` : ""}` : "", asdBuild.deps ? Object.entries(asdBuild.deps).map(([k, x]) => `${k} ${x}`).join(", ") : ""].filter(Boolean).join("; ")
  T.env_grpc = table(
    ["", ""],
    [
      ["Date", (env.date || "").slice(0, 10)],
      ["Node", `${env.node || process.version}, run as \`node --expose-gc --max-old-space-size=8192 --stack-size=4000\``],
      ["CPU / RAM", `${env.cpu || "?"}, ${env.cores || "?"} logical cores, ${env.memGB || "?"} GB`],
      ["OS", env.platform || "?"],
      ["Builder", `esbuild ${manifest.esbuild || "?"} (\`scripts/build.js\`)`],
      ["asd 2.0.0 (ProtoApi engine)", asdText || "?"],
      ["protoapi", `${v["conv-protoapi"]?.version || "?"} (${v["conv-protoapi"]?.source || "?"}): builds the fixture documents and the end-to-end row`],
      ["buf", `${cli.noop?.buf?.version || "1.75.0"}, GitHub release binary, \`buf breaking --error-format json --config '{"version":"v2","breaking":{"use":["<CATEGORY>"]}}'\``],
      ["npm floors", FLOORS.map((k) => `${k} ${v[k]?.version || "?"}`).join(", ")],
    ],
  )

  // ---- fixtures ----
  T.fixtures_grpc = table(
    ["Fixture", "Kind", "What", ".proto before / after", "ProtoApi JSON before / after", "Expected changes"],
    fixtures.map((f) => {
      const m = meta(f.name)
      return [`\`${f.name}\``, f.kind, f.desc, `${KB(m.formats?.proto?.beforeBytes)} / ${KB(m.formats?.proto?.afterBytes)}`, `${KB(m.formats?.protoapi?.beforeBytes)} / ${KB(m.formats?.protoapi?.afterBytes)}`, m.expectedChanges ?? "—"]
    }),
  )

  // ---- quality ----
  const qualityRow = (fx, tool) => {
    const c = q(fx, tool)
    if (!c) return [LABEL[tool], "—", "—", "—", "—", "—", "—", "—"]
    if (c.status !== "ok") return [LABEL[tool], c.status, "", "", "", "", "", ""]
    return [
      LABEL[tool],
      String(c.diffs),
      pct(c.detected, c.expected),
      c.precision === null || c.precision === undefined ? "—" : `${Math.round(c.precision * 100)}%`,
      pct(c.classAgree, c.detectedAll),
      pct(c.breakingAgree, c.detectedAll),
      c.missedBreaking?.length ? String(c.missedBreaking.length) : "0",
      c.diffs ? `${Math.round((c.described / c.diffs) * 100)}%` : "—",
    ]
  }
  const QTOOLS = [...LEVELS.flatMap((l) => [ASD[l], BUF[l]]), "asd-2.0.0-proto-e2e"]
  const qualityTable = (fx) => table(["Tool", "Diffs", "Detected (breaking side only for buf)", "Precision", "Class agreement", "Breaking agreement", "Missed breaking", "Described"], QTOOLS.map((t) => qualityRow(fx, t)))
  T.quality_grpc = fixtures
    .filter((f) => f.kind !== "identical")
    .map((f) => `\`${f.name}\`:\n\n${qualityTable(f.name)}`)
    .join("\n\n")

  // per change of grpc-shop: expected class per level, asd and buf verdicts
  const expected = F.readExpected("grpc-shop") || []
  const verdictOf = (tool, id) => {
    const c = q("grpc-shop", tool)
    const ch = c?.changes?.find((x) => x.id === id)
    if (!c || c.status !== "ok") return "?"
    if (!ch) return "?"
    return ch.detected ? LETTER[ch.verdict] || "?" : "–"
  }
  T.matrix_grpc_shop = table(
    ["Change", "What", ...LEVELS.map((l) => `${l} exp / asd / buf`), "Rule"],
    expected.map((e) => [
      e.id,
      e.what,
      ...LEVELS.map((l) => {
        const exp = typeof e.class === "object" ? e.class[l] : e.class
        return `${LETTER[exp]} / ${verdictOf(ASD[l], e.id)} / ${verdictOf(BUF[l], e.id)}`
      }),
      e.row || "",
    ]),
  )

  T.identical_grpc = table(
    ["Tool", "Diffs on `grpc-shop-identical`"],
    [...LEVELS.map((l) => ASD[l]), "asd-2.0.0-proto-e2e", ...LEVELS.map((l) => BUF[l]), ...FLOORS].map((t) => {
      const c = q("grpc-shop-identical", t)
      return [LABEL[t], c ? (c.status === "ok" ? String(c.diffs) : c.status) : "—"]
    }),
  )
  T.mutation_grpc = table(
    ["Tool", ...fixtures.filter((f) => f.kind !== "synthetic" || f.name === "grpc-poc-1700").map((f) => `\`${f.name}\``)],
    [...LEVELS.map((l) => ASD[l]), ...FLOORS].map((t) => [
      LABEL[t],
      ...fixtures
        .filter((f) => f.kind !== "synthetic" || f.name === "grpc-poc-1700")
        .map((f) => {
          const c = q(f.name, t)
          if (!c?.run) return "—"
          return `${c.run.mutatedInput === true ? "**mutates input**" : c.run.mutatedInput === false ? "no mutation" : "n/a"}${c.run.mergedDocument ? ", merged document" : ""}`
        }),
    ]),
  )

  // ---- corpus ----
  if (corpus) {
    const s = corpus.summary
    const row = (t) => {
      const x = s[t]
      const name = t === ASD.FILE ? "asd 2.0.0 (each variant at its level)" : t === BUF.FILE ? "buf (each variant's level as category)" : LABEL[t] || t
      if (!x) return [name, "—", "—", "—", "—", "—", "—", "—"]
      const run = x.variants - x.na
      return [name, String(run), pct(x.detected, run), pct(...x.classified), pct(...x.breaking), pct(...x.described), `${x.risky.agree}/${x.risky.expected}`, x.strict ? `${Math.round((x.strict.D / x.strict.of) * 100)}% / ${Math.round((x.strict.C / x.strict.of) * 100)}% / ${Math.round((x.strict.A / x.strict.of) * 100)}% / **${Math.round((x.strict.all / x.strict.of) * 100)}%**` : "—"]
    }
    T.corpus_grpc = `${corpus.export?.variants ?? "?"} variants of ${corpus.export?.cases ?? "?"} cases (compat family \`protoapi\`), exported ${String(corpus.export?.exportedAt || "").slice(0, 10)}; run ${String(corpus.generatedAt).slice(0, 10)}${corpus.selection ? ` (**partial run**: ${JSON.stringify(corpus.selection)})` : ""}. Every variant is compared at its own level (asd \`compatibility\`, buf category).\n\n${table(["Tool", "Variants run", "Detected", "Classified", "Breaking side", "Described", "Risky", "Strict D / C / A / all"], corpus.tools.map(row))}`
    // per level and area: asd vs buf on the breaking line
    const exportFile = path.join(P.CACHE, "corpus", "grpc.json")
    const exp = fs.existsSync(exportFile) ? JSON.parse(fs.readFileSync(exportFile, "utf8")) : null
    if (exp) {
      const byId = new Map(exp.variants.map((x) => [x.id, x]))
      const groups = {}
      const disagree = []
      for (const [id, r] of Object.entries(corpus.variants)) {
        const vt = byId.get(id)
        if (!vt) continue
        const a = r.t["asd-2.0.0-proto"]
        const b = r.t.buf
        if (!a || !b) continue
        const aB = a.v ? side(require("../lib/vocab").FROM_LETTER[a.v]) === "B" : false
        const bB = b.v === "B"
        for (const key of [`${vt.level}|all`, `${vt.level}|${vt.area}`]) {
          const g = (groups[key] = groups[key] || { n: 0, agree: 0, asdOnly: 0, bufOnly: 0, expB: 0, asdExp: 0, bufExp: 0 })
          g.n++
          if (aB === bB) g.agree++
          else if (aB) g.asdOnly++
          else g.bufOnly++
          const expB = side(require("../lib/vocab").FROM_LETTER[r.x] || "") === "B"
          if (expB) g.expB++
          if (aB === expB) g.asdExp++
          if (bB === expB) g.bufExp++
        }
        if (aB !== bB && vt.level === "FILE") disagree.push({ id, title: vt.title, area: vt.area, asd: `${a.v || "–"}/${a.n}`, buf: `${b.v || "–"}/${b.n}`, expected: r.x, sources: (vt.sources || []).filter((x) => x.tool === "buf").map((x) => x.verdict || x.ref).filter(Boolean).join("; ") })
      }
      const areas = [...new Set(exp.variants.map((x) => x.area))].sort()
      T.corpus_levels_grpc = table(
        ["Level", "Variants", "asd and buf on the same side of the breaking line", "asd breaking-side only", "buf breaking only", "Expected breaking-side", "asd matches the expectation", "buf matches the expectation"],
        LEVELS.map((l) => {
          const g = groups[`${l}|all`] || {}
          return [l, String(g.n || 0), pct(g.agree || 0, g.n), String(g.asdOnly || 0), String(g.bufOnly || 0), String(g.expB || 0), pct(g.asdExp || 0, g.n), pct(g.bufExp || 0, g.n)]
        }),
      )
      T.corpus_areas_grpc = table(
        ["Area", ...LEVELS.map((l) => `${l}: same side / variants`)],
        areas.map((ar) => [ar, ...LEVELS.map((l) => {
          const g = groups[`${l}|${ar}`]
          return g ? `${g.agree}/${g.n}${g.bufOnly ? ` (buf only ${g.bufOnly})` : ""}${g.asdOnly ? ` (asd only ${g.asdOnly})` : ""}` : "—"
        })]),
      )
      T.corpus_disagree_grpc = disagree.length
        ? table(["Variant", "Area", "Change", "Expected", "asd verdict / diffs", "buf verdict / findings", "buf verdict recorded by the case"], disagree.sort((a, b) => a.id.localeCompare(b.id)).map((d) => [`\`${d.id}\``, d.area, d.title.replace(/\|/g, "\\|"), d.expected, d.asd, d.buf, d.sources.replace(/\|/g, "\\|") || "—"]))
        : "None."
    } else {
      T.corpus_levels_grpc = T.corpus_areas_grpc = T.corpus_disagree_grpc = "(corpus export fixtures/cache/corpus/grpc.json not present)"
    }
  } else {
    T.corpus_grpc = T.corpus_levels_grpc = T.corpus_areas_grpc = T.corpus_disagree_grpc = "(no corpus run: `node scripts/corpus.js --type=grpc`)"
  }

  // ---- timing ----
  const timing = (fx, tool) => {
    const c = bench.cells[`${fx}|${tool}`]
    if (!c) return "—"
    if (c.status !== "ok") return c.status
    return `${fmtMs(c.medianMs)} / ${fmtMs(c.minMs)}`
  }
  const cliCell = (fx, tool) => {
    const c = cli.cells[`${fx}|${tool}`]
    if (!c) return "—"
    if (c.status !== "ok") return c.status
    return `${fmtMs(c.medianMs)} / ${fmtMs(c.minMs)}`
  }
  const timed = fixtures.filter((f) => f.kind !== "identical" || true)
  const TTOOLS = [...LEVELS.map((l) => ASD[l]), "asd-2.0.0-proto-e2e", "protoapi-build", ...FLOORS]
  T.timing_grpc = table(["Tool", ...timed.map((f) => `\`${f.name}\``)], TTOOLS.map((t) => [LABEL[t], ...timed.map((f) => timing(f.name, t))]))
  T.timing_cli_grpc = table(
    ["buf breaking (process)", ...timed.map((f) => `\`${f.name}\``)],
    [
      ...LEVELS.map((l) => [`${LABEL[BUF[l]]} median / min`, ...timed.map((f) => cliCell(f.name, BUF[l]))]),
      [`no-op (one-message tree vs itself)`, ...timed.map(() => (cli.noop?.buf ? `${fmtMs(cli.noop.buf.medianMs)} / ${fmtMs(cli.noop.buf.minMs)}` : "—"))],
      ["peak RSS FILE (MB)", ...timed.map((f) => fmtMB(cli.cells[`${f.name}|buf`]?.peakRssBytes))],
    ],
  )
  // the design target: compare time within 3× of buf breaking wall time on the 1.4 MB corpus (information only)
  const ratioRows = fixtures
    .filter((f) => f.kind === "synthetic" || f.kind === "changeset")
    .map((f) => {
      const bufC = cli.cells[`${f.name}|buf`]
      const asdC = bench.cells[`${f.name}|asd-2.0.0-proto`]
      const e2eC = bench.cells[`${f.name}|asd-2.0.0-proto-e2e`]
      const bufMs = bufC?.status === "ok" ? bufC.minMs : undefined
      const r = (c) => (c?.status === "ok" && bufMs ? `${(c.minMs / bufMs).toFixed(2)}×` : "—")
      return [`\`${f.name}\``, fmtMs(asdC?.minMs), fmtMs(e2eC?.minMs), fmtMs(bufMs), r(asdC), r(e2eC)]
    })
  T.ratio_grpc = table(["Fixture", "asd compare (min ms)", "asd from .proto: protoapi build + compare (min ms)", "buf breaking FILE (process, min ms)", "compare / buf", "end to end / buf"], ratioRows)
  // scaling 170 -> 1,700 -> 10,200 messages
  const series = ["grpc-poc-170", "grpc-poc-1700", "grpc-poc-10200"]
  const scaleRow = (label, get) => {
    const xs = series.map(get)
    const step = (a, b) => (a && b ? `${(b / a).toFixed(2)}×` : "—")
    return [label, ...xs.map(fmtMs), step(xs[0], xs[1]), step(xs[1], xs[2])]
  }
  T.scaling_grpc = table(
    ["Tool (min ms)", ...series.map((s) => `\`${s}\``), "170 → 1,700 (10× input)", "1,700 → 10,200 (6× input)"],
    [
      ...LEVELS.map((l) => scaleRow(LABEL[ASD[l]], (s) => bench.cells[`${s}|${ASD[l]}`]?.minMs)),
      scaleRow(LABEL["asd-2.0.0-proto-e2e"], (s) => bench.cells[`${s}|asd-2.0.0-proto-e2e`]?.minMs),
      scaleRow(LABEL["protoapi-build"], (s) => bench.cells[`${s}|protoapi-build`]?.minMs),
      scaleRow("buf FILE (process)", (s) => cli.cells[`${s}|buf`]?.minMs),
      scaleRow("fast-json-patch", (s) => bench.cells[`${s}|fast-json-patch`]?.minMs),
    ],
  )
  // heap
  const heapCell = (fx, tool) => {
    const c = heap.cells[`${fx}|${tool}`]
    if (!c) return "—"
    if (c.status !== "ok") return c.status
    const added = c.peakHeapBytes && c.heapBeforeCallBytes ? Math.max(0, c.peakHeapBytes - c.heapBeforeCallBytes) : undefined
    return `${fmtMB(c.peakHeapBytes)} / ${fmtMB(added)} / ${fmtMB(c.heapRetainedBytes)}`
  }
  T.heap_grpc = table(["Tool", ...timed.map((f) => `\`${f.name}\``)], TTOOLS.map((t) => [LABEL[t], ...timed.map((f) => heapCell(f.name, t))]))
  T.clone_grpc = Object.keys(clone).length
    ? table(["Fixture", "structuredClone(before) + structuredClone(after), median / min ms", "asd FILE min ms", "asd / clone"], Object.entries(clone).map(([n, c]) => [`\`${n}\``, `${fmtMs(c.medianMs)} / ${fmtMs(c.minMs)}`, fmtMs(bench.cells[`${n}|asd-2.0.0-proto`]?.minMs), bench.cells[`${n}|asd-2.0.0-proto`]?.minMs ? `${(bench.cells[`${n}|asd-2.0.0-proto`].minMs / c.minMs).toFixed(2)}×` : "—"]))
    : "—"
  return T
}

module.exports = { placeholders }
